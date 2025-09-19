from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

# Import web routes
from api.webroutes import router as web_router

# Import OTEL router
from api.otel import otel_router, cleanup as otel_cleanup

# Import OpenAI router
from api.openai import router as openai_router

# Create FastAPI instance
app = FastAPI(
    title="SecureBank - Online Banking System",
    description="A secure online banking application with chat features",
    version="1.0.0"
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
app.include_router(otel_router, tags=["OpenTelemetry"])

# Include OpenAI-compatible API router
app.include_router(openai_router, prefix='/v1', tags=["OpenAI API"])

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    print("🚀 SecureBank application starting up...")
    print("📊 OpenTelemetry endpoints available at /otel/*")

@app.on_event("shutdown") 
async def shutdown_event():
    """Cleanup on shutdown"""
    print("🛑 SecureBank application shutting down...")
    await otel_cleanup()
    print("✅ Cleanup completed")

# Mount static files
app.mount("/js", StaticFiles(directory="js"), name="javascript")
app.mount("/css", StaticFiles(directory="css"), name="stylesheets")
# app.mount("/static", StaticFiles(directory="static"), name="static")

# Pydantic models
class Message(BaseModel):
    id: Optional[int] = None
    content: str
    sender: str
    timestamp: Optional[str] = None

class User(BaseModel):
    username: str
    email: Optional[str] = None

# In-memory storage (replace with database in production)
messages: List[Message] = []
users: List[User] = []

# API Routes (keep existing API endpoints for backwards compatibility)
@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

# Message endpoints
@app.get("/api/messages", response_model=List[Message])
async def get_messages():
    """Get all messages"""
    return messages

@app.post("/api/messages", response_model=Message)
async def create_message(message: Message):
    """Create a new message"""
    message.id = len(messages) + 1
    from datetime import datetime
    message.timestamp = datetime.now().isoformat()
    messages.append(message)
    return message

@app.get("/api/messages/{message_id}", response_model=Message)
async def get_message(message_id: int):
    """Get a specific message by ID"""
    for message in messages:
        if message.id == message_id:
            return message
    return {"error": "Message not found"}

# User endpoints
@app.get("/api/users", response_model=List[User])
async def get_users():
    """Get all users"""
    return users

@app.post("/api/users", response_model=User)
async def create_user(user: User):
    """Create a new user"""
    users.append(user)
    return user

# Run the application
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)