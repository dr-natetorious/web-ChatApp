"""
Snowflake Cortex Client for async operations
"""
import httpx
from typing import Optional, Dict, Any
import logging
import json
import asyncio

logger = logging.getLogger(__name__)


class SnowflakeAuthentication:
    """
    Handles authentication for Snowflake Cortex API
    """
    
    def __init__(self, 
                 account: Optional[str] = None,
                 token: Optional[str] = None,
                 warehouse: Optional[str] = None,
                 database: Optional[str] = None,
                 schema: Optional[str] = None):
        """
        Initialize Snowflake authentication
        
        Args:
            account: Snowflake account identifier (e.g., 'myorg-myaccount')
            username: Snowflake username
            password: Snowflake password
            token: OAuth token (alternative to username/password)
            warehouse: Default warehouse for queries
            database: Default database
            schema: Default schema
        """
        self.account = account
        self.token = token
        self.warehouse = warehouse
        self.database = database
        self.schema = schema
        self._session_token: Optional[str] = None
        
    def get_headers(self) -> Dict[str, str]:
        """
        Get authentication headers for API requests
        
        Returns:
            Dictionary of headers for authentication
        """
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'ChatApp-SnowflakeCortex/1.0'
        }
        
        # Snowflake SQL API expects token-based authentication. Prefer an
        # OAuth/service token. Username/password basic auth is not supported
        # for the HTTP SQL API in many deployments; require a token and
        # provide clear errors otherwise.
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        elif self._session_token:
            # If we have a session token (obtained via prior auth flow), use it.
            headers['Authorization'] = f'Bearer {self._session_token}'
        else:
            # No token available; raise a helpful error so callers can surface it.
            raise ValueError('Snowflake token not configured. Set SNOWFLAKE_TOKEN in the environment or provide a valid token.')
            
        return headers
    
    def get_base_url(self) -> str:
        """
        Get the base URL for Snowflake API endpoints
        
        Returns:
            Base URL for Snowflake API
        """
        if not self.account:
            raise ValueError("Snowflake account not configured")
            
        return f"https://{self.account}.snowflakecomputing.com/api/v2"
    
    def get_sql_api_url(self) -> str:
        """
        Get the SQL API URL for executing queries
        
        Returns:
            SQL API URL
        """
        return f"{self.get_base_url()}/statements"


class SnowflakeCortexClient:
    """
    Async client for Snowflake Cortex AI operations
    """
    
    def __init__(self, auth: SnowflakeAuthentication, timeout: float = 60.0):
        """
        Initialize the Cortex client
        
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
            
    async def _execute_sql(self, sql: str, parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute SQL statement via Snowflake SQL API
        
        Args:
            sql: SQL statement to execute
            parameters: Optional parameters for the SQL statement
            
        Returns:
            Query results as dictionary
            
        Raises:
            ValueError: For API errors
        """
        if not self._client:
            await self.connect()
            
        if not self._client:
            raise RuntimeError("Failed to initialize HTTP client")
            
        payload = {
            "statement": sql,
            "timeout": self.timeout,
            "database": self.auth.database,
            "schema": self.auth.schema,
            "warehouse": self.auth.warehouse
        }
        
        if parameters:
            payload["bindings"] = parameters
            
        try:
            response = await self._client.post(
                self.auth.get_sql_api_url(),
                json=payload
            )
            response.raise_for_status()
            
            result = response.json()
            
            # Handle async query execution
            if result.get("resultSetMetaData"):
                return result
            elif result.get("statementHandle"):
                # Poll for completion if async
                return await self._poll_query_status(result["statementHandle"])
            else:
                return result
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error {e.response.status_code}: {e.response.text}")
            raise ValueError(f"SQL execution failed: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"Request error: {e}")
            raise ValueError(f"Request failed: {str(e)}")
    
    async def _poll_query_status(self, statement_handle: str, max_polls: int = 30) -> Dict[str, Any]:
        """
        Poll query status until completion
        
        Args:
            statement_handle: Handle for the async query
            max_polls: Maximum number of polling attempts
            
        Returns:
            Query results when complete
        """
        if not self._client:
            raise RuntimeError("HTTP client not initialized")
            
        status_url = f"{self.auth.get_sql_api_url()}/{statement_handle}"
        
        for _ in range(max_polls):
            try:
                response = await self._client.get(status_url)
                response.raise_for_status()
                result = response.json()
                
                status = result.get("statementStatusUrl")
                if status in ["SUCCESS", "FAILED_WITH_ERROR"]:
                    return result
                    
                # Wait before next poll
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.warning(f"Polling error: {e}")
                await asyncio.sleep(2)
                
        raise ValueError("Query polling timeout exceeded")
    
    async def complete_text(self, model: str, prompt: str, 
                           max_tokens: Optional[int] = None,
                           temperature: Optional[float] = None) -> Dict[str, Any]:
        """
        Complete text using Snowflake Cortex COMPLETE function
        
        Args:
            model: Model name (e.g., 'snowflake-arctic', 'llama2-70b-chat')
            prompt: Input text prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0 to 1.0)
            
        Returns:
            Text completion results
        """
        options = {}
        if max_tokens is not None:
            options['max_tokens'] = max_tokens
        if temperature is not None:
            options['temperature'] = temperature
            
        options_json = json.dumps(options) if options else '{}'
        
        sql = f"""
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
            '{model}',
            '{prompt}',
            PARSE_JSON('{options_json}')
        ) as completion;
        """
        
        result = await self._execute_sql(sql)
        logger.info(f"Completed text with model {model}")
        return result
    
    async def extract_text(self, text: str, instruction: str) -> Dict[str, Any]:
        """
        Extract information from text using Cortex EXTRACT_ANSWER function
        
        Args:
            text: Source text to extract from
            instruction: Extraction instruction/question
            
        Returns:
            Extracted information
        """
        sql = f"""
        SELECT SNOWFLAKE.CORTEX.EXTRACT_ANSWER(
            '{text}',
            '{instruction}'
        ) as extracted_answer;
        """
        
        result = await self._execute_sql(sql)
        logger.info("Extracted text information")
        return result
    
    async def sentiment_analysis(self, text: str) -> Dict[str, Any]:
        """
        Analyze sentiment using Cortex SENTIMENT function
        
        Args:
            text: Text to analyze sentiment for
            
        Returns:
            Sentiment analysis results (-1 to 1 scale)
        """
        sql = f"""
        SELECT SNOWFLAKE.CORTEX.SENTIMENT('{text}') as sentiment;
        """
        
        result = await self._execute_sql(sql)
        logger.info("Analyzed text sentiment")
        return result
    
    async def summarize_text(self, text: str) -> Dict[str, Any]:
        """
        Summarize text using Cortex SUMMARIZE function
        
        Args:
            text: Text to summarize
            
        Returns:
            Text summary
        """
        sql = f"""
        SELECT SNOWFLAKE.CORTEX.SUMMARIZE('{text}') as summary;
        """
        
        result = await self._execute_sql(sql)
        logger.info("Summarized text")
        return result
    
    async def translate_text(self, text: str, from_language: str, to_language: str) -> Dict[str, Any]:
        """
        Translate text using Cortex TRANSLATE function
        
        Args:
            text: Text to translate
            from_language: Source language code
            to_language: Target language code
            
        Returns:
            Translated text
        """
        sql = f"""
        SELECT SNOWFLAKE.CORTEX.TRANSLATE(
            '{text}',
            '{from_language}',
            '{to_language}'
        ) as translation;
        """
        
        result = await self._execute_sql(sql)
        logger.info(f"Translated text from {from_language} to {to_language}")
        return result
    
    async def embed_text(self, model: str, text: str) -> Dict[str, Any]:
        """
        Generate embeddings using Cortex EMBED_TEXT function
        
        Args:
            model: Embedding model name (e.g., 'snowflake-arctic-embed-m')
            text: Text to embed
            
        Returns:
            Text embeddings as vector
        """
        sql = f"""
        SELECT SNOWFLAKE.CORTEX.EMBED_TEXT(
            '{model}',
            '{text}'
        ) as embeddings;
        """
        
        result = await self._execute_sql(sql)
        logger.info(f"Generated embeddings with model {model}")
        return result
    
    async def execute_custom_sql(self, sql: str, parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute custom SQL query
        
        Args:
            sql: Custom SQL statement
            parameters: Optional query parameters
            
        Returns:
            Query results
        """
        result = await self._execute_sql(sql, parameters)
        logger.info("Executed custom SQL query")
        return result
    
    async def health_check(self) -> bool:
        """
        Check if the Snowflake API is accessible
        
        Returns:
            True if API is accessible, False otherwise
        """
        try:
            result = await self._execute_sql("SELECT CURRENT_VERSION() as version;")
            return bool(result.get("data"))
        except Exception as e:
            logger.warning(f"Health check failed: {e}")
            return False