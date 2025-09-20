"""
LLM implementations for different Bedrock models.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any, Union
from .models import ChatMessage, Tool


class BaseLLM(ABC):
    """Abstract base class for LLM implementations."""
    
    def __init__(self, model_id: str):
        self.model_id = model_id
    
    @abstractmethod
    def format_messages(self, messages: List[ChatMessage], max_tokens: int, 
                       temperature: float, top_p: float, 
                       stop: Optional[Union[str, List[str]]], 
                       tools: Optional[List[Tool]] = None) -> Dict[str, Any]:
        """Format messages for the specific model."""
        pass
    
    @abstractmethod
    def parse_response(self, response: Dict[str, Any]) -> tuple[str, str, int, int]:
        """Parse response and return (text, finish_reason, prompt_tokens, completion_tokens)."""
        pass


class LlamaLLM(BaseLLM):
    """Llama model implementation."""
    
    def format_messages(self, messages: List[ChatMessage], max_tokens: int, 
                       temperature: float, top_p: float, 
                       stop: Optional[Union[str, List[str]]], 
                       tools: Optional[List[Tool]] = None) -> Dict[str, Any]:
        """Format messages for Llama models."""
        # Build system prompt with tools if provided
        system_prompt = self._build_system_prompt(tools) if tools else ""
        
        # Convert messages to Llama format with system prompt
        prompt = self._format_llama_prompt(messages, system_prompt)
        
        payload = {
            "prompt": prompt,
            "max_gen_len": max_tokens,
            "temperature": temperature,
            "top_p": top_p
        }
        
        # Always include TOOL_END as a stop sequence when tools are available
        stop_sequences = []
        if tools:
            stop_sequences.append("TOOL_END")
        
        if stop:
            if isinstance(stop, str):
                stop_sequences.append(stop)
            else:
                stop_sequences.extend(stop)
        
        if stop_sequences:
            payload["stop_sequences"] = stop_sequences
        
        return payload
    
    def parse_response(self, response: Dict[str, Any]) -> tuple[str, str, int, int]:
        """Parse Llama response."""
        text = response.get("generation", "")
        
        # Map Llama stop reasons to OpenAI format
        stop_reason = response.get("stop_reason", "stop")
        finish_reason = "stop" if stop_reason in ["stop", "end_of_turn"] else "length"
        
        # Extract token counts if available
        prompt_tokens = response.get("prompt_token_count", 0)
        completion_tokens = response.get("generation_token_count", 0)
        
        return text, finish_reason, prompt_tokens, completion_tokens
    
    def _format_llama_prompt(self, messages: List[ChatMessage], system_prompt: str = "") -> str:
        """Format messages into Llama chat template."""
        prompt = "<|begin_of_text|>"
        
        # Add system prompt if provided
        if system_prompt:
            prompt += f"<|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>"
        
        for message in messages:
            if message.role == "system":
                # Skip if we already added system prompt, otherwise include it
                if not system_prompt:
                    prompt += f"<|start_header_id|>system<|end_header_id|>\n\n{message.content}<|eot_id|>"
            elif message.role == "user":
                prompt += f"<|start_header_id|>user<|end_header_id|>\n\n{message.content}<|eot_id|>"
            elif message.role == "assistant":
                prompt += f"<|start_header_id|>assistant<|end_header_id|>\n\n{message.content}<|eot_id|>"
        
        # Add assistant header for completion
        prompt += "<|start_header_id|>assistant<|end_header_id|>\n\n"
        return prompt
    
    def _build_system_prompt(self, tools: List[Tool]) -> str:
        """Build system prompt with tool descriptions."""
        tool_descriptions = []
        for tool in tools:
            func = tool.function
            name = func.get("name", "")
            description = func.get("description", "")
            parameters = func.get("parameters", {})
            
            tool_desc = f"- {name}: {description}"
            if parameters and "properties" in parameters:
                props = parameters["properties"]
                if props:
                    param_list = ", ".join([f"{k} ({v.get('type', 'any')})" for k, v in props.items()])
                    tool_desc += f"\n  Parameters: {param_list}"
            tool_descriptions.append(tool_desc)
        
        tools_text = "\n".join(tool_descriptions)
        
        return f"""You are a helpful assistant with access to tools. When you need to use a tool, format your response as:

TOOL_START
{{
  "name": "tool_name",
  "arguments": {{
    "param1": "value1",
    "param2": "value2"
  }}
}}
TOOL_END

Available tools:
{tools_text}

Important: After TOOL_START, provide ONLY the JSON tool call, then TOOL_END. The client will execute the tool and provide results in a TOOL_USED_START...TOOL_USED_END block. You can then continue your response normally."""


class NovaLLM(BaseLLM):
    """Nova model implementation."""
    
    def format_messages(self, messages: List[ChatMessage], max_tokens: int, 
                       temperature: float, top_p: float, 
                       stop: Optional[Union[str, List[str]]], 
                       tools: Optional[List[Tool]] = None) -> Dict[str, Any]:
        """Format messages for Nova models."""
        formatted_messages = []
        
        # Add system message with tools if provided
        if tools:
            system_prompt = self._build_system_prompt(tools)
            formatted_messages.append({
                "role": "system",
                "content": [{"text": system_prompt}]
            })
        
        # Convert other messages
        for msg in messages:
            # Skip system messages if we already added one with tools
            if msg.role == "system" and tools:
                continue
            formatted_messages.append({
                "role": msg.role,
                "content": [{"text": msg.content}]
            })
        
        payload = {
            "messages": formatted_messages,
            "inferenceConfig": {
                "max_new_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p
            }
        }
        
        # Always include TOOL_END as a stop sequence when tools are available
        stop_sequences = []
        if tools:
            stop_sequences.append("TOOL_END")
        
        if stop:
            if isinstance(stop, str):
                stop_sequences.append(stop)
            else:
                stop_sequences.extend(stop)
        
        if stop_sequences:
            payload["inferenceConfig"]["stopSequences"] = stop_sequences
        
        return payload
    
    def parse_response(self, response: Dict[str, Any]) -> tuple[str, str, int, int]:
        """Parse Nova response."""
        output = response.get("output", {})
        message = output.get("message", {})
        content = message.get("content", [])
        
        text = ""
        if content and len(content) > 0:
            text = content[0].get("text", "")
        
        # Map Nova stop reasons to OpenAI format
        stop_reason = output.get("stopReason", "end_turn")
        finish_reason = "stop" if stop_reason == "end_turn" else "length" if stop_reason == "max_tokens" else "stop"
        
        # Extract actual token counts
        usage = response.get("usage", {})
        prompt_tokens = usage.get("inputTokens", 0)
        completion_tokens = usage.get("outputTokens", 0)
        
        return text, finish_reason, prompt_tokens, completion_tokens
    
    def _build_system_prompt(self, tools: List[Tool]) -> str:
        """Build system prompt with tool descriptions."""
        tool_descriptions = []
        for tool in tools:
            func = tool.function
            name = func.get("name", "")
            description = func.get("description", "")
            parameters = func.get("parameters", {})
            
            tool_desc = f"- {name}: {description}"
            if parameters and "properties" in parameters:
                props = parameters["properties"]
                if props:
                    param_list = ", ".join([f"{k} ({v.get('type', 'any')})" for k, v in props.items()])
                    tool_desc += f"\n  Parameters: {param_list}"
            tool_descriptions.append(tool_desc)
        
        tools_text = "\n".join(tool_descriptions)
        
        return f"""You are a helpful assistant with access to tools. When you need to use a tool, format your response as:

TOOL_START
{{
  "name": "tool_name",
  "arguments": {{
    "param1": "value1",
    "param2": "value2"
  }}
}}
TOOL_END

Available tools:
{tools_text}

Important: After TOOL_START, provide ONLY the JSON tool call, then TOOL_END. The client will execute the tool and provide results in a TOOL_USED_START...TOOL_USED_END block. You can then continue your response normally."""


def create_llm(model_name: str) -> BaseLLM:
    """Create appropriate LLM instance based on model name."""
    model_mapping = {
        "llama": ("us.meta.llama3-2-3b-instruct-v1:0", LlamaLLM),
        "nova": ("amazon.nova-pro-v1:0", NovaLLM)
    }
    
    if model_name not in model_mapping:
        available_models = list(model_mapping.keys())
        raise ValueError(f"Model '{model_name}' not supported. Available models: {available_models}")
    
    model_id, llm_class = model_mapping[model_name]
    return llm_class(model_id)