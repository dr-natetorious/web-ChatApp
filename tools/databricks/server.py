"""
FastMCP 2 server interface for Databricks Genie operations (Local Transport)
"""
import os
from typing import Dict, Any, List, Optional
import logging
from .client import DatabricksGenieClient, DatabricksAuthentication
from tools import tool

logger = logging.getLogger(__name__)


# Global client instance
_genie_client: Optional[DatabricksGenieClient] = None


async def get_genie_client() -> DatabricksGenieClient:
    """
    Get or create the global Genie client instance
    
    Returns:
        Initialized DatabricksGenieClient
        
    Raises:
        ValueError: If required environment variables are missing
    """
    global _genie_client
    
    if _genie_client is None:
        # Get configuration from environment
        token = os.getenv('DATABRICKS_TOKEN')
        workspace_url = os.getenv('DATABRICKS_WORKSPACE_URL')
        
        if not token:
            raise ValueError("DATABRICKS_TOKEN environment variable is required")
        if not workspace_url:
            raise ValueError("DATABRICKS_WORKSPACE_URL environment variable is required")
        
        # Initialize authentication and client
        auth = DatabricksAuthentication(token=token, workspace_url=workspace_url)
        _genie_client = DatabricksGenieClient(auth=auth)
        await _genie_client.connect()
        
    return _genie_client


@tool()
async def start_conversation(space_id: str, content: str) -> Dict[str, Any]:
    """
    Start a new conversation with Databricks Genie
    
    Args:
        space_id: Genie space identifier where conversation should be created
        content: Initial message content to start the conversation
        
    Returns:
        Dictionary containing conversation details including conversation_id
        
    Example:
        {"conversation_id": "conv_123", "space_id": "space_456", "status": "active"}
    """
    try:
        client = await get_genie_client()
        result = await client.start_conversation(space_id=space_id, content=content)
        
        logger.info(f"Started conversation in space {space_id}")
        return {
            "success": True,
            "conversation_id": result.get("conversation_id"),
            "space_id": space_id,
            "initial_content": content,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to start conversation: {e}")
        return {
            "success": False,
            "error": str(e),
            "space_id": space_id,
            "content": content
        }


@tool()
async def post_message(conversation_id: str, content: str, 
                      attachments: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Post a message to an existing Databricks Genie conversation
    
    Args:
        conversation_id: ID of the existing conversation
        content: Message content to post
        attachments: Optional list of attachment objects with structure:
                    [{"type": "file", "name": "filename.txt", "content": "..."}]
        
    Returns:
        Dictionary containing message posting results and response
        
    Example:
        {"success": true, "message_id": "msg_789", "response": {...}}
    """
    try:
        client = await get_genie_client()
        result = await client.post_message(
            conversation_id=conversation_id,
            content=content,
            attachments=attachments
        )
        
        logger.info(f"Posted message to conversation {conversation_id}")
        return {
            "success": True,
            "conversation_id": conversation_id,
            "message_content": content,
            "attachments_count": len(attachments) if attachments else 0,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to post message: {e}")
        return {
            "success": False,
            "error": str(e),
            "conversation_id": conversation_id,
            "content": content
        }


@tool()
async def get_attachment(conversation_id: str, attachment_id: str) -> Dict[str, Any]:
    """
    Retrieve an attachment from a Databricks Genie conversation
    
    Args:
        conversation_id: ID of the conversation containing the attachment
        attachment_id: ID of the specific attachment to retrieve
        
    Returns:
        Dictionary containing attachment details and content
        
    Example:
        {"success": true, "attachment": {"name": "chart.png", "type": "image", "content": "..."}}
    """
    try:
        client = await get_genie_client()
        result = await client.get_attachment(
            conversation_id=conversation_id,
            attachment_id=attachment_id
        )
        
        logger.info(f"Retrieved attachment {attachment_id} from conversation {conversation_id}")
        return {
            "success": True,
            "conversation_id": conversation_id,
            "attachment_id": attachment_id,
            "attachment": result
        }
        
    except Exception as e:
        logger.error(f"Failed to get attachment: {e}")
        return {
            "success": False,
            "error": str(e),
            "conversation_id": conversation_id,
            "attachment_id": attachment_id
        }


@tool()
async def get_conversation(conversation_id: str) -> Dict[str, Any]:
    """
    Retrieve conversation details and message history
    
    Args:
        conversation_id: ID of the conversation to retrieve
        
    Returns:
        Dictionary containing conversation details and messages
        
    Example:
        {"success": true, "conversation": {"id": "conv_123", "messages": [...]}}
    """
    try:
        client = await get_genie_client()
        result = await client.get_conversation(conversation_id=conversation_id)
        
        logger.info(f"Retrieved conversation {conversation_id}")
        return {
            "success": True,
            "conversation_id": conversation_id,
            "conversation": result
        }
        
    except Exception as e:
        logger.error(f"Failed to get conversation: {e}")
        return {
            "success": False,
            "error": str(e),
            "conversation_id": conversation_id
        }


@tool()
async def list_spaces() -> Dict[str, Any]:
    """
    List available Databricks Genie spaces
    
    Returns:
        Dictionary containing list of available spaces
        
    Example:
        {"success": true, "spaces": [{"id": "space_123", "name": "Analytics Space"}]}
    """
    try:
        client = await get_genie_client()
        result = await client.list_spaces()
        
        logger.info("Retrieved Genie spaces list")
        return {
            "success": True,
            "spaces": result.get("spaces", []),
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to list spaces: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@tool()
async def get_space(space_id: str) -> Dict[str, Any]:
    """
    Get details about a specific Databricks Genie space
    
    Args:
        space_id: ID of the space to retrieve details for
        
    Returns:
        Dictionary containing space details and configuration
        
    Example:
        {"success": true, "space": {"id": "space_123", "name": "Analytics", "description": "..."}}
    """
    try:
        client = await get_genie_client()
        result = await client.get_space(space_id=space_id)
        
        logger.info(f"Retrieved space details for {space_id}")
        return {
            "success": True,
            "space_id": space_id,
            "space": result
        }
        
    except Exception as e:
        logger.error(f"Failed to get space: {e}")
        return {
            "success": False,
            "error": str(e),
            "space_id": space_id
        }


@tool()
async def health_check() -> Dict[str, Any]:
    """
    Check connectivity to Databricks Genie API
    
    Returns:
        Dictionary containing health status and connection details
        
    Example:
        {"success": true, "status": "healthy", "timestamp": "2024-01-01T12:00:00Z"}
    """
    try:
        # Delegate to the richer status checker which performs a lightweight
        # operational check (list spaces) and returns structured info.
        status = await get_databricks_status()

        # Normalize into a health-like response
        api_ok = bool(status.get('success'))
        return {
            "success": api_ok,
            "status": "healthy" if api_ok else "unhealthy",
            "api_accessible": api_ok,
            "details": status
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "success": False,
            "status": "unhealthy",
            "error": str(e),
            "api_accessible": False
        }


@tool()
async def get_databricks_status(_auth_token: Optional[str] = None, _workspace_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Simple test tool to validate local in-process Databricks tooling.

    Returns a small hello payload and echoes whether auth info was provided
    (either from environment variables or injected by the local services manager).
    """
    try:
        # Prefer injected values if provided, otherwise fall back to environment
        token = _auth_token or os.getenv('DATABRICKS_TOKEN')
        workspace = _workspace_url or os.getenv('DATABRICKS_WORKSPACE_URL')

        if not token or not workspace:
            return {"success": False, "error": "Missing Databricks token or workspace URL in environment or args"}

        auth = DatabricksAuthentication(token=token, workspace_url=workspace)
        client = DatabricksGenieClient(auth=auth)
        await client.connect()
        try:
            # List spaces as a lightweight connectivity check
            spaces = await client.list_spaces()
            # spaces may be a dict with 'spaces' key
            count = None
            if isinstance(spaces, dict):
                if 'spaces' in spaces and isinstance(spaces['spaces'], list):
                    count = len(spaces['spaces'])
            await client.close()
            return {
                "success": True,
                "message": "Connected to Databricks Genie",
                "spaces_count": count,
                "spaces": spaces
            }
        except Exception as e:
            await client.close()
            logger.exception('Databricks client operation failed')
            return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"get_databricks_status failed: {e}")
        return {"success": False, "error": str(e)}


# Cleanup function for service shutdown
async def cleanup_databricks_service():
    """Clean up resources when Databricks service shuts down"""
    global _genie_client
    if _genie_client:
        await _genie_client.close()
        _genie_client = None


# Local transport initialization
async def initialize_databricks_service():
    """Initialize the Databricks service for local use"""
    try:
        # Ensure client initialization; avoid assigning to a local variable
        await get_genie_client()
        logger.info("Databricks Genie service initialized for local transport")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Databricks service: {e}")
        return False


# For local testing only - you can import and call individual functions.