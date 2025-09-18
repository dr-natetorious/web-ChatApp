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


def estimate_tokens(text: str) -> int:
    """Simple token estimation (roughly 4 characters per token)."""
    return max(1, len(text) // 4)