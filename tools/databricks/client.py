"""
Databricks Genie Client for async operations
"""
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime
import asyncio
import logging

logger = logging.getLogger(__name__)


class DatabricksAuthentication:
    """
    Handles authentication for Databricks Genie API
    """
    
    def __init__(self, token: Optional[str] = None, workspace_url: Optional[str] = None):
        """
        Initialize Databricks authentication
        
        Args:
            token: Databricks personal access token
            workspace_url: Databricks workspace URL (e.g., https://your-workspace.databricks.com)
        """
        self.token = token
        self.workspace_url = workspace_url.rstrip('/') if workspace_url else None
        
    def get_headers(self) -> Dict[str, str]:
        """
        Get authentication headers for API requests
        
        Returns:
            Dictionary of headers for authentication
        """
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
            
        return headers
    
    def get_base_url(self) -> str:
        """
        Get the base URL for Genie API endpoints
        
        Returns:
            Base URL for Genie API
        """
        if not self.workspace_url:
            raise ValueError("Workspace URL not configured")
            
        return f"{self.workspace_url}/api/2.0/genie"


class DatabricksGenieClient:
    """
    Async client for Databricks Genie API operations
    """
    
    def __init__(self, auth: DatabricksAuthentication, timeout: float = 30.0):
        """
        Initialize the Genie client
        
        Args:
            auth: Authentication handler
            timeout: Request timeout in seconds
        """
        self.auth = auth
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
        
    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
        
    async def connect(self):
        """Initialize the HTTP client"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                headers=self.auth.get_headers(),
                timeout=self.timeout,
                follow_redirects=True
            )
            
    async def close(self):
        """Close the HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None
            
    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """
        Make an authenticated request to the Genie API
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (relative to base URL)
            **kwargs: Additional arguments for httpx request
            
        Returns:
            JSON response as dictionary
            
        Raises:
            httpx.HTTPError: For HTTP errors
            ValueError: For API errors
        """
        if not self._client:
            await self.connect()
            
        if not self._client:
            raise RuntimeError("Failed to initialize HTTP client")
            
        url = f"{self.auth.get_base_url()}/{endpoint.lstrip('/')}"
        
        try:
            response = await self._client.request(method, url, **kwargs)
            response.raise_for_status()
            
            if response.headers.get('content-type', '').startswith('application/json'):
                return response.json()
            else:
                return {'content': response.text, 'status_code': response.status_code}
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error {e.response.status_code}: {e.response.text}")
            raise ValueError(f"API request failed: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"Request error: {e}")
            raise ValueError(f"Request failed: {str(e)}")
    
    async def start_conversation(self, space_id: str, content: str) -> Dict[str, Any]:
        """
        Start a new conversation with Genie
        
        Args:
            space_id: Genie space identifier
            content: Initial message content
            
        Returns:
            Conversation details including conversation_id
        """
        payload = {
            "content": content,
            "space_id": space_id
        }
        
        response = await self._request(
            "POST",
            "/conversations",
            json=payload
        )
        
        logger.info(f"Started conversation {response.get('conversation_id')} in space {space_id}")
        return response
    
    async def post_message(self, conversation_id: str, content: str, 
                          attachments: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Post a message to an existing conversation
        
        Args:
            conversation_id: Existing conversation ID
            content: Message content
            attachments: Optional list of attachment objects
            
        Returns:
            Message response details
        """
        payload: Dict[str, Any] = {
            "content": content
        }
        
        if attachments:
            payload["attachments"] = attachments
            
        response = await self._request(
            "POST",
            f"/conversations/{conversation_id}/messages",
            json=payload
        )
        
        logger.info(f"Posted message to conversation {conversation_id}")
        return response
    
    async def get_conversation(self, conversation_id: str) -> Dict[str, Any]:
        """
        Get conversation details and messages
        
        Args:
            conversation_id: Conversation ID to retrieve
            
        Returns:
            Conversation details and message history
        """
        response = await self._request(
            "GET",
            f"/conversations/{conversation_id}"
        )
        
        return response
    
    async def get_attachment(self, conversation_id: str, attachment_id: str) -> Dict[str, Any]:
        """
        Get attachment details from a conversation
        
        Args:
            conversation_id: Conversation ID containing the attachment
            attachment_id: Attachment ID to retrieve
            
        Returns:
            Attachment details and content
        """
        response = await self._request(
            "GET",
            f"/conversations/{conversation_id}/attachments/{attachment_id}"
        )
        
        return response
    
    async def list_spaces(self) -> Dict[str, Any]:
        """
        List available Genie spaces
        
        Returns:
            List of available spaces
        """
        response = await self._request(
            "GET",
            "/spaces"
        )
        
        return response
    
    async def get_space(self, space_id: str) -> Dict[str, Any]:
        """
        Get details about a specific Genie space
        
        Args:
            space_id: Space ID to retrieve
            
        Returns:
            Space details and configuration
        """
        response = await self._request(
            "GET",
            f"/spaces/{space_id}"
        )
        
        return response
    
    async def health_check(self) -> bool:
        """
        Check if the Genie API is accessible
        
        Returns:
            True if API is accessible, False otherwise
        """
        try:
            await self.list_spaces()
            return True
        except Exception as e:
            logger.warning(f"Health check failed: {e}")
            return False