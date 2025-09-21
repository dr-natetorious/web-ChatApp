from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from contextlib import asynccontextmanager
import uvicorn
import os
import logging
from pathlib import Path

# Import web routes
from api.webroutes import router as web_router

# Import OTEL router
# OpenTelemetry will be initialized here (no separate api.otel router)
from typing import Dict, Optional
# Configure logging early so exporter debug logs are visible
logging.basicConfig(level=logging.DEBUG)
logging.getLogger("opentelemetry").setLevel(logging.DEBUG)
logging.getLogger("opentelemetry.exporter").setLevel(logging.DEBUG)
logging.getLogger("opentelemetry.sdk").setLevel(logging.DEBUG)
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor


# OTEL state
_tracer_provider: Optional[TracerProvider] = None
_httpx_instrumented = False
_fastapi_instrumented = False


def _parse_otlp_headers_from_dynatrace(token: Optional[str]) -> Dict[str, str]:
    """Build headers for Dynatrace OTLP HTTP ingest from DYNATRACE_API_TOKEN.

    Returns a simple Authorization header using the token. Token will be
    masked in logs.
    """
    headers: Dict[str, str] = {}
    if not token:
        return headers
    headers["Authorization"] = f"Api-Token {token}"
    return headers


def setup_tracing(app: FastAPI) -> None:
    """
    Configure OpenTelemetry with OTLP/HTTP exporter and instrument FastAPI + httpx.
    Reads OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS from environment.
    """
    global _tracer_provider, _httpx_instrumented, _fastapi_instrumented

    if _tracer_provider is not None:
        return  # already initialized

    # Use Dynatrace-specific environment variables only
    dyn_url = os.getenv("DYNATRACE_URL")
    dyn_token = os.getenv("DYNATRACE_API_TOKEN")
    endpoint = None
    if dyn_url:
        # Ensure the URL doesn't end with a slash and append OTLP path
        endpoint = dyn_url.rstrip("/") + "/api/v2/otlp/v1/traces"
    headers = _parse_otlp_headers_from_dynatrace(dyn_token)

    # Logging for debug (token masked)
    try:
        import logging
        logging.basicConfig(level=logging.DEBUG)
        log = logging.getLogger(__name__)
        masked = None
        if dyn_token:
            masked = dyn_token[:4] + "..." + dyn_token[-4:]
        log.debug("OTLP endpoint=%s headers.Authorization=%s", endpoint, masked)
    except Exception:
        pass

    resource = Resource.create({
        "service.name": os.getenv("OTEL_SERVICE_NAME", "web-chatapp"),
    })

    exporter_kwargs = {}
    if endpoint:
        exporter_kwargs["endpoint"] = endpoint
    if headers:
        exporter_kwargs["headers"] = headers

    exporter = OTLPSpanExporter(**exporter_kwargs)

    # Wrap exporter to log success/failure results
    class LoggingOTLPExporter(OTLPSpanExporter):
        def export(self, spans):
            try:
                result = super().export(spans)
                logging.getLogger(__name__).debug("OTLP export result: %s", result)
                return result
            except Exception as e:
                logging.getLogger(__name__).exception("OTLP exporter failed to export spans: %s", e)
                raise

    exporter = LoggingOTLPExporter(**exporter_kwargs)

    provider = TracerProvider(resource=resource)
    span_processor = BatchSpanProcessor(exporter)
    provider.add_span_processor(span_processor)
    # Also add a SimpleSpanProcessor for immediate, synchronous export during debugging
    try:
        provider.add_span_processor(SimpleSpanProcessor(exporter))
    except Exception:
        pass

    trace.set_tracer_provider(provider)
    _tracer_provider = provider

    # Instrument FastAPI app and httpx client
    try:
        FastAPIInstrumentor.instrument_app(app)
        _fastapi_instrumented = True
    except Exception:
        _fastapi_instrumented = False

    try:
        HTTPXClientInstrumentor().instrument()
        _httpx_instrumented = True
    except Exception:
        _httpx_instrumented = False


async def otel_cleanup() -> None:
    """
    Shutdown the tracer provider cleanly on app shutdown.
    """
    global _tracer_provider
    if _tracer_provider:
        try:
            _tracer_provider.shutdown()
        except Exception:
            pass
        _tracer_provider = None


# ...existing code... (smoke route will be registered after `app` is created)

# Import OpenAI router
from api.openai import router as openai_router

# Import Auth router
from api.auth import router as auth_router

# Import OTEL router
from api.otel import otel_router as otel_router  

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events"""
    # Startup
    print("🚀 SecureBank application starting up...")
    print("📊 OpenTelemetry endpoints available at /otel/*")
    print("🤖 OpenAI-compatible API available at /v1/*")
    
    # Initialize OpenTelemetry (OTLP/HTTP) and instrument app + httpx
    try:
        setup_tracing(app)
        print("🛰️  OpenTelemetry initialized (OTLP/HTTP)")
    except Exception as e:
        print(f"⚠️  Failed to initialize OpenTelemetry: {e}")

    yield
    
    # Shutdown
    print("🛑 SecureBank application shutting down...")
    await otel_cleanup()
    print("✅ Cleanup completed")


# Load .env from project root if available (optional)
# If python-dotenv is installed this will populate os.environ from the .env file.
try:
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(dotenv_path=env_path)
            print(f"Loaded environment variables from {env_path}")
        except Exception as e:
            # python-dotenv not installed or failed to load; continue without failing.
            print(f"python-dotenv not available or failed to load .env: {e}")
except Exception:
    # Keep main resilient to any unexpected environment loading errors
    pass

# Create FastAPI instance with lifespan
app = FastAPI(
    title="SecureBank - Online Banking System",
    description="A secure online banking application with chat features",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include web routes (HTML pages)
app.include_router(web_router, tags=["Web Pages"])

# OTEL status endpoint (no separate router file)
@app.get("/otel/status")
async def otel_status():
    return {
        "otel": "ready" if _tracer_provider is not None else "not-initialized",
        "fastapi_instrumented": _fastapi_instrumented,
        "httpx_instrumented": _httpx_instrumented,
    }

# Include OpenAI-compatible API router
app.include_router(openai_router, prefix='/v1', tags=["OpenAI API"])

# Include the OTEL router for metrics and traces
app.include_router(otel_router, tags=["OpenTelemetry"])

# Include Auth router
app.include_router(auth_router, prefix='/auth', tags=["Authentication"])

# Mount static files
app.mount("/js", StaticFiles(directory="js"), name="javascript")
app.mount("/css", StaticFiles(directory="css"), name="stylesheets")
# app.mount("/static", StaticFiles(directory="static"), name="static")


# API Routes (keep existing API endpoints for backwards compatibility)
@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


# Run the application
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)