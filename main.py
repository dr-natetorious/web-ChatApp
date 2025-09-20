from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from contextlib import asynccontextmanager
import uvicorn

# Import web routes
from api.webroutes import router as web_router

# Import OTEL router
from api.otel import otel_router, cleanup as otel_cleanup

# Import OpenAI router
from api.openai import router as openai_router

# Import Auth router
from api.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events"""
    # Startup
    print("🚀 SecureBank application starting up...")
    print("📊 OpenTelemetry endpoints available at /otel/*")
    print("🤖 OpenAI-compatible API available at /v1/*")
    
    yield
    
    # Shutdown
    print("🛑 SecureBank application shutting down...")
    await otel_cleanup()
    print("✅ Cleanup completed")


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

# Include OTEL router for OpenTelemetry data collection
app.include_router(otel_router, prefix="/otel", tags=["OpenTelemetry"])

# Include OpenAI-compatible API router
app.include_router(openai_router, prefix='/v1', tags=["OpenAI API"])

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