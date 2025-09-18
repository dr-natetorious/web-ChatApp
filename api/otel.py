from fastapi import APIRouter, Request, HTTPException, Header
from typing import Optional, Dict, Any
import httpx
import logging
from datetime import datetime
import json
import os

# Configure logging
logger = logging.getLogger(__name__)

class DynatraceForwarder:
    """Handles forwarding OpenTelemetry data to self-hosted Dynatrace"""
    
    def __init__(self):
        self.url = os.getenv("DYNATRACE_URL")
        self.api_token = os.getenv("DYNATRACE_API_TOKEN")
        self.environment_id = os.getenv("DYNATRACE_ENVIRONMENT_ID")
        self.timeout = int(os.getenv("DYNATRACE_TIMEOUT", "10"))
        self.enabled = os.getenv("DYNATRACE_ENABLED", "false").lower() == "true"
        self.client = None
        
        self.endpoint_mapping = {
            "traces": "v1/traces",
            "metrics": "v1/metrics", 
            "logs": "v1/logs"
        }
    
    @property
    def is_configured(self) -> bool:
        """Check if Dynatrace is properly configured"""
        return self.enabled and all([self.url, self.api_token, self.environment_id])
    
    def _get_client(self) -> Optional[httpx.AsyncClient]:
        """Lazy initialization of HTTP client"""
        if not self.is_configured:
            return None
            
        if self.client is None:
            self.client = httpx.AsyncClient(
                timeout=self.timeout,
                headers={
                    "Authorization": f"Api-Token {self.api_token}",
                    "Content-Type": "application/json"
                }
            )
        return self.client
    
    async def forward(self, signal_type: str, payload: Dict[Any, Any]) -> Dict[str, Any]:
        """Forward OpenTelemetry data to Dynatrace"""
        if not self.enabled:
            logger.info(f"Dynatrace disabled, skipping {signal_type} forward")
            return {"status": "skipped", "reason": "disabled"}
        
        if not self.is_configured:
            logger.warning(f"Dynatrace not configured, skipping {signal_type} forward")
            return {"status": "skipped", "reason": "not_configured"}
        
        client = self._get_client()
        if not client:
            return {"status": "error", "reason": "client_error"}
        
        try:
            endpoint = self.endpoint_mapping[signal_type]
            url = f"{self.url}/e/{self.environment_id}/api/v2/otlp/{endpoint}"
            
            response = await client.post(url, json=payload)
            response.raise_for_status()
            
            return {
                "status": "success",
                "dynatrace_response_code": response.status_code
            }
            
        except httpx.TimeoutException:
            logger.warning(f"Dynatrace timeout for {signal_type}")
            return {"status": "timeout", "reason": "timeout"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Dynatrace API error: {e.response.status_code}")
            return {"status": "error", "reason": "api_error", "code": e.response.status_code}
        except httpx.RequestError as e:
            logger.warning(f"Dynatrace connection error: {str(e)}")
            return {"status": "error", "reason": "connection_error"}
        except Exception as e:
            logger.error(f"Unexpected Dynatrace error: {str(e)}")
            return {"status": "error", "reason": "unexpected_error"}
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Dynatrace connection health"""
        base_response = {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
        
        if not self.enabled:
            return {**base_response, "dynatrace_connection": "disabled"}
        
        if not self.is_configured:
            return {**base_response, "dynatrace_connection": "not_configured"}
        
        client = self._get_client()
        if not client:
            return {**base_response, "dynatrace_connection": "client_error"}
        
        try:
            response = await client.get(
                f"{self.url}/e/{self.environment_id}/api/v2/entities",
                timeout=5.0
            )
            return {
                **base_response,
                "dynatrace_connection": "ok" if response.status_code == 200 else "error",
                "dynatrace_response_code": response.status_code
            }
        except Exception as e:
            return {**base_response, "dynatrace_connection": "error", "error": str(e)}
    
    async def cleanup(self):
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()
            self.client = None

# Initialize forwarder
dynatrace = DynatraceForwarder()

# Router instance
otel_router = APIRouter(prefix="/otel", tags=["opentelemetry"])

def ensure_service_name(payload: Dict[Any, Any], resource_key: str) -> Dict[Any, Any]:
    """Ensure service.name attribute exists for proper Dynatrace mapping"""
    if resource_key in payload:
        for resource_item in payload[resource_key]:
            resource = resource_item.get('resource', {})
            attributes = resource.get('attributes', [])
            
            service_name_exists = any(attr.get('key') == 'service.name' for attr in attributes)
            if not service_name_exists:
                attributes.append({
                    'key': 'service.name',
                    'value': {'stringValue': 'unknown-service'}
                })
    return payload

async def handle_otel_data(signal_type: str, request: Request, x_forwarded_for: Optional[str]):
    """Common handler for all OpenTelemetry signal types"""
    try:
        payload = await request.json()
        logger.info(f"Received {signal_type} from {x_forwarded_for or 'unknown'}")
        
        # Ensure service.name exists for proper Dynatrace mapping
        resource_mapping = {
            "traces": "resourceSpans",
            "metrics": "resourceMetrics", 
            "logs": "resourceLogs"
        }
        transformed_payload = ensure_service_name(payload, resource_mapping[signal_type])
        
        # Forward to Dynatrace
        result = await dynatrace.forward(signal_type, transformed_payload)
        return {**result, "timestamp": datetime.utcnow().isoformat()}
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except Exception as e:
        logger.error(f"Error processing {signal_type}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@otel_router.post("/v1/traces")
async def receive_traces(request: Request, x_forwarded_for: Optional[str] = Header(None)):
    """Receive OpenTelemetry traces and forward to Dynatrace"""
    return await handle_otel_data("traces", request, x_forwarded_for)

@otel_router.post("/v1/metrics")
async def receive_metrics(request: Request, x_forwarded_for: Optional[str] = Header(None)):
    """Receive OpenTelemetry metrics and forward to Dynatrace"""
    return await handle_otel_data("metrics", request, x_forwarded_for)

@otel_router.post("/v1/logs")
async def receive_logs(request: Request, x_forwarded_for: Optional[str] = Header(None)):
    """Receive OpenTelemetry logs and forward to Dynatrace"""
    return await handle_otel_data("logs", request, x_forwarded_for)

@otel_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return await dynatrace.health_check()

# Cleanup function
async def cleanup():
    """Close HTTP client on shutdown"""
    await dynatrace.cleanup()