"""
FastAPI router for OpenAI-compatible chat completions using AWS Bedrock.
"""

import boto3
import json
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException

from .models import (
    ChatMessage,
    ChatCompletionRequest,
    ChatCompletionChoice,
    ChatCompletionUsage,
    ChatCompletionResponse
)
from .llm import create_llm
from .utils import parse_tool_call, estimate_tokens

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Bedrock client
bedrock_client = boto3.client('bedrock-runtime')

# Create router
router = APIRouter(prefix="/v1", tags=["chat"])


@router.post("/chat/completions")
async def create_chat_completion(request: ChatCompletionRequest) -> ChatCompletionResponse:
    """Create a chat completion using AWS Bedrock."""
    
    try:
        # Create appropriate LLM instance
        llm = create_llm(request.model)
        
        # Use request parameters with defaults
        max_tokens = request.max_tokens or 1000
        temperature = request.temperature or 0.7
        top_p = request.top_p or 1.0
        
        # Format messages using LLM-specific logic
        payload = llm.format_messages(
            request.messages, 
            max_tokens, 
            temperature, 
            top_p, 
            request.stop,
            request.tools
        )
        
        logger.info(f"Calling Bedrock model: {llm.model_id}")
        logger.debug(f"Payload: {json.dumps(payload, indent=2)}")
        
        # Call Bedrock
        response = bedrock_client.invoke_model(
            modelId=llm.model_id,
            body=json.dumps(payload),
            contentType="application/json",
            accept="application/json"
        )
        
        # Parse response
        response_body = json.loads(response["body"].read())
        logger.debug(f"Bedrock response: {json.dumps(response_body, indent=2)}")
        
        # Parse using LLM-specific logic
        generated_text, finish_reason, prompt_tokens, completion_tokens = llm.parse_response(response_body)
        
        # Check for tool calls in the response
        tool_call = parse_tool_call(generated_text) if request.tools else None
        
        # If we found a tool call, adjust the response
        if tool_call:
            finish_reason = "tool_calls"
            # Remove the TOOL_START...TOOL_END block from the message content
            if "TOOL_START" in generated_text:
                generated_text = generated_text[:generated_text.find("TOOL_START")].strip()
        
        # Create the message
        message = ChatMessage(role="assistant", content=generated_text)
        
        # Create the choice
        choice = ChatCompletionChoice(
            index=0,
            message=message,
            finish_reason=finish_reason
        )
        
        # Add tool calls if present
        if tool_call:
            choice.tool_calls = [tool_call]
        
        # Fall back to estimation if no actual token counts
        if prompt_tokens == 0 or completion_tokens == 0:
            prompt_text = " ".join([msg.content for msg in request.messages])
            prompt_tokens = prompt_tokens or estimate_tokens(prompt_text)
            completion_tokens = completion_tokens or estimate_tokens(generated_text)
        
        total_tokens = prompt_tokens + completion_tokens
        
        # Create OpenAI-compatible response
        completion_response = ChatCompletionResponse(
            id=f"chatcmpl-{uuid.uuid4().hex[:29]}",
            created=int(datetime.now().timestamp()),
            model=request.model,
            choices=[choice],
            usage=ChatCompletionUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens
            )
        )
        
        return completion_response
        
    except ValueError as e:
        logger.error(f"Invalid model or configuration: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing chat completion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/models")
async def list_models():
    """List available models."""
    models = []
    available_models = ["llama", "nova"]
    
    for model_name in available_models:
        models.append({
            "id": model_name,
            "object": "model",
            "created": int(datetime.now().timestamp()),
            "owned_by": "bedrock"
        })
    
    return {
        "object": "list",
        "data": models
    }


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "bedrock-openai-proxy"}