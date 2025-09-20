"""
FastAPI router for OpenAI-compatible chat completions using AWS Bedrock.
Supports both regular and streaming responses via SSE.
"""

import boto3
import json
import uuid
import time
import logging
import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator

from core.models import (
    ChatMessage,
    ChatCompletionRequest,
    ChatCompletionChoice,
    ChatCompletionUsage,
    ChatCompletionResponse,
    ChatCompletionStreamResponse,
    ChatCompletionStreamChoice,
    ChatCompletionStreamChoiceDelta
)
from core.llm import create_llm
from core.utils import parse_tool_call, estimate_tokens

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Bedrock client
bedrock_client = boto3.client('bedrock-runtime')

# Create router
router = APIRouter(tags=["chat"])


@router.post("/chat/completions")
async def create_chat_completion(request: ChatCompletionRequest):
    """Create a chat completion using AWS Bedrock with optional streaming."""
    
    if request.stream:
        return StreamingResponse(
            stream_chat_completion(request),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    else:
        # Collect streaming response into a single response
        return await collect_streaming_response(request)


async def stream_chat_completion(request: ChatCompletionRequest) -> AsyncGenerator[str, None]:
    """Stream chat completion tokens via Server-Sent Events."""
    
    try:
        # Create appropriate LLM instance to resolve model alias
        llm = create_llm(request.model)
        
        # Use request parameters with defaults
        max_tokens = request.max_tokens or 1000
        temperature = request.temperature or 0.7
        top_p = request.top_p or 1.0
        
        # Format messages using LLM-specific logic (same as non-streaming)
        payload = llm.format_messages(
            request.messages, 
            max_tokens, 
            temperature, 
            top_p, 
            request.stop,
            request.tools
        )
        
        logger.info(f"Streaming with resolved model: {llm.model_id}")
        logger.debug(f"Streaming payload: {json.dumps(payload, indent=2)}")
        
        # Call Bedrock with invoke_model_with_response_stream (same as Llama formatting)
        response = bedrock_client.invoke_model_with_response_stream(
            modelId=llm.model_id,
            body=json.dumps(payload),
            contentType="application/json",
            accept="application/json"
        )
        
        completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
        created = int(time.time())
        
        logger.info(f"Started streaming with completion_id: {completion_id}")
        
        # Send initial chunk with role
        initial_chunk = ChatCompletionStreamResponse(
            id=completion_id,
            object="chat.completion.chunk",
            created=created,
            model=request.model,
            choices=[
                ChatCompletionStreamChoice(
                    index=0,
                    delta=ChatCompletionStreamChoiceDelta(role="assistant"),
                    finish_reason=None
                )
            ]
        )
        yield f"data: {initial_chunk.model_dump_json()}\n\n"

        # Stream content chunks - handle invoke_model_with_response_stream format
        for event in response['body']:
            chunk = event.get('chunk')
            if chunk:
                chunk_bytes = chunk.get('bytes')
                if chunk_bytes:
                    chunk_data = json.loads(chunk_bytes.decode())
                    logger.debug(f"Received streaming chunk: {chunk_data}")
                    
                    # Extract content based on model type
                    content = ""
                    finish_reason = None
                    
                    # For Llama models
                    if 'generation' in chunk_data:
                        content = chunk_data.get('generation', '')
                        if chunk_data.get('stop_reason'):
                            finish_reason = "stop"
                    
                    # For Nova models  
                    elif 'delta' in chunk_data:
                        delta = chunk_data['delta']
                        if 'text' in delta:
                            content = delta['text']
                    
                    # Send content chunk
                    if content:
                        logger.debug(f"Streaming content: {repr(content)}")
                        chunk_response = ChatCompletionStreamResponse(
                            id=completion_id,
                            object="chat.completion.chunk",
                            created=created,
                            model=request.model,
                            choices=[
                                ChatCompletionStreamChoice(
                                    index=0,
                                    delta=ChatCompletionStreamChoiceDelta(content=content),
                                    finish_reason=None
                                )
                            ]
                        )
                        yield f"data: {chunk_response.model_dump_json()}\n\n"
                    
                    # Handle completion
                    if finish_reason:
                        final_chunk = ChatCompletionStreamResponse(
                            id=completion_id,
                            object="chat.completion.chunk",
                            created=created,
                            model=request.model,
                            choices=[
                                ChatCompletionStreamChoice(
                                    index=0,
                                    delta=ChatCompletionStreamChoiceDelta(),
                                    finish_reason=finish_reason
                                )
                            ]
                        )
                        yield f"data: {final_chunk.model_dump_json()}\n\n"
                        break        # Send final [DONE] message
        yield "data: [DONE]\n\n"
        
    except Exception as e:
        logger.error(f"Streaming error: {e}", exc_info=True)
        
        # Send error chunk
        error_chunk = ChatCompletionStreamResponse(
            id=f"chatcmpl-{uuid.uuid4().hex[:12]}",
            object="chat.completion.chunk",
            created=int(time.time()),
            model=request.model,
            choices=[
                ChatCompletionStreamChoice(
                    index=0,
                    delta=ChatCompletionStreamChoiceDelta(),
                    finish_reason="error"
                )
            ]
        )
        yield f"data: {error_chunk.model_dump_json()}\n\n"
        yield "data: [DONE]\n\n"


async def collect_streaming_response(request: ChatCompletionRequest) -> ChatCompletionResponse:
    """Collect streaming response into a single non-streaming response."""
    
    try:
        content_parts = []
        completion_id = None
        created = None
        finish_reason = "stop"
        
        # Collect all streaming chunks
        async for chunk_data in stream_chat_completion(request):
            if chunk_data.startswith("data: "):
                data = chunk_data[6:].strip()
                
                if data == "[DONE]":
                    break
                
                try:
                    chunk = json.loads(data)
                    if not completion_id:
                        completion_id = chunk.get("id")
                        created = chunk.get("created")
                    
                    choice = chunk.get("choices", [{}])[0]
                    delta = choice.get("delta", {})
                    
                    # Collect content
                    if delta.get("content"):
                        content_parts.append(delta["content"])
                    
                    # Update finish reason
                    if choice.get("finish_reason"):
                        finish_reason = choice["finish_reason"]
                        
                except json.JSONDecodeError:
                    continue
        
        # Join all content parts
        full_content = "".join(content_parts)
        
        # Create non-streaming response
        return ChatCompletionResponse(
            id=completion_id or f"chatcmpl-{uuid.uuid4().hex[:12]}",
            object="chat.completion",
            created=created or int(time.time()),
            model=request.model,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatMessage(role="assistant", content=full_content),
                    finish_reason=finish_reason
                )
            ],
            usage=ChatCompletionUsage(
                prompt_tokens=0,  # Would need to calculate
                completion_tokens=0,  # Would need to calculate  
                total_tokens=0
            )
        )
        
    except Exception as e:
        logger.error(f"Error collecting streaming response: {e}")
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