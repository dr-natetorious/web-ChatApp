"""
Utility functions for the Bedrock OpenAI-compatible API.
"""

import json
import uuid
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


def parse_tool_call(text: str) -> Optional[Dict[str, Any]]:
    """Parse TOOL_START...TOOL_END blocks from generated text."""
    if "TOOL_START" not in text:
        return None
    

    try:
        # Extract content between TOOL_START and TOOL_END
        start_idx = text.find("TOOL_START")
        if start_idx == -1:
            return None
        
        # Find the JSON content after TOOL_START
        json_start = start_idx + len("TOOL_START")
        json_content = text[json_start:].strip()
        
        # Parse the JSON
        tool_call = json.loads(json_content)
        
        return {
            "id": f"call_{uuid.uuid4().hex[:24]}",
            "type": "function",
            "function": {
                "name": tool_call.get("name", ""),
                "arguments": json.dumps(tool_call.get("arguments", {}))
            }
        }
    except (json.JSONDecodeError, KeyError) as e:
        logger.warning(f"Failed to parse tool call: {e}")
        return None


def parse_server_call(text: str) -> Optional[Dict[str, Any]]:
    """Parse SERVER_START...SERVER_END blocks from generated text and return the JSON payload.

    Expected format inside block is a JSON object like:
    {
        "name": "get_databricks_status",
        "arguments": { ... }
    }
    """
    if "SERVER_START" not in text:
        return None

    try:
        start_idx = text.find("SERVER_START")
        if start_idx == -1:
            return None

        json_start = start_idx + len("SERVER_START")
        json_content = text[json_start:].strip()

        # Find end marker if present
        end_idx = json_content.find("SERVER_END")
        if end_idx != -1:
            json_content = json_content[:end_idx].strip()

        payload = json.loads(json_content)
        return {
            "id": f"server_call_{uuid.uuid4().hex[:12]}",
            "type": "server",
            "function": {
                "name": payload.get("name", ""),
                "arguments": json.dumps(payload.get("arguments", {}))
            }
        }
    except Exception as e:
        logger.warning(f"Failed to parse server call: {e}")
        return None


def estimate_tokens(text: str) -> int:
    """Simple token estimation (roughly 4 characters per token)."""
    return max(1, len(text) // 4)