"""
FastMCP 2 server interface for Snowflake Cortex operations (Local Transport)
"""
import os
from typing import Dict, Any, List, Optional
import logging
from .client import SnowflakeCortexClient, SnowflakeAuthentication
from tools import tool

logger = logging.getLogger(__name__)


# Global client instance
_cortex_client: Optional[SnowflakeCortexClient] = None


async def get_cortex_client() -> SnowflakeCortexClient:
    """
    Get or create the global Cortex client instance
    
    Returns:
        Initialized SnowflakeCortexClient
        
    Raises:
        ValueError: If required environment variables are missing
    """
    global _cortex_client
    
    if _cortex_client is None:
        # Get configuration from environment
        account = os.getenv('SNOWFLAKE_ACCOUNT')
        username = os.getenv('SNOWFLAKE_USERNAME')
        password = os.getenv('SNOWFLAKE_PASSWORD')
        token = os.getenv('SNOWFLAKE_TOKEN')
        warehouse = os.getenv('SNOWFLAKE_WAREHOUSE')
        database = os.getenv('SNOWFLAKE_DATABASE')
        schema = os.getenv('SNOWFLAKE_SCHEMA', 'PUBLIC')
        
        if not account:
            raise ValueError("SNOWFLAKE_ACCOUNT environment variable is required")
        if not token and not (username and password):
            raise ValueError("Either SNOWFLAKE_TOKEN or SNOWFLAKE_USERNAME/SNOWFLAKE_PASSWORD is required")
        
        # Initialize authentication and client
        auth = SnowflakeAuthentication(
            account=account,
            token=token,
            warehouse=warehouse,
            database=database,
            schema=schema
        )
        _cortex_client = SnowflakeCortexClient(auth=auth)
        await _cortex_client.connect()
        
    return _cortex_client


@tool()
async def complete_text(model: str, prompt: str, 
                       max_tokens: Optional[int] = None,
                       temperature: Optional[float] = None) -> Dict[str, Any]:
    """
    Complete text using Snowflake Cortex COMPLETE function
    
    Args:
        model: Model name (e.g., 'snowflake-arctic', 'llama2-70b-chat', 'mistral-large')
        prompt: Input text prompt to complete
        max_tokens: Maximum number of tokens to generate (optional)
        temperature: Sampling temperature between 0.0 and 1.0 (optional)
        
    Returns:
        Dictionary containing the text completion results
        
    Example:
        {"success": true, "completion": "The generated text...", "model": "snowflake-arctic"}
    """
    try:
        client = await get_cortex_client()
        result = await client.complete_text(
            model=model,
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        logger.info(f"Completed text with model {model}")
        return {
            "success": True,
            "model": model,
            "prompt": prompt,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to complete text: {e}")
        return {
            "success": False,
            "error": str(e),
            "model": model,
            "prompt": prompt
        }


@tool()
async def extract_answer(text: str, question: str) -> Dict[str, Any]:
    """
    Extract specific information from text using Cortex EXTRACT_ANSWER function
    
    Args:
        text: Source text to extract information from
        question: Question or instruction for what to extract
        
    Returns:
        Dictionary containing the extracted answer
        
    Example:
        {"success": true, "answer": "The extracted information", "question": "What is...?"}
    """
    try:
        client = await get_cortex_client()
        result = await client.extract_text(text=text, instruction=question)
        
        logger.info("Extracted answer from text")
        return {
            "success": True,
            "text_length": len(text),
            "question": question,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to extract answer: {e}")
        return {
            "success": False,
            "error": str(e),
            "question": question
        }


@tool()
async def analyze_sentiment(text: str) -> Dict[str, Any]:
    """
    Analyze sentiment of text using Cortex SENTIMENT function
    
    Args:
        text: Text to analyze for sentiment
        
    Returns:
        Dictionary containing sentiment score (-1 to 1 scale)
        
    Example:
        {"success": true, "sentiment": 0.8, "text": "I love this product!"}
    """
    try:
        client = await get_cortex_client()
        result = await client.sentiment_analysis(text=text)
        
        logger.info("Analyzed text sentiment")
        return {
            "success": True,
            "text": text,
            "text_length": len(text),
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to analyze sentiment: {e}")
        return {
            "success": False,
            "error": str(e),
            "text": text
        }


@tool()
async def summarize_text(text: str) -> Dict[str, Any]:
    """
    Summarize text using Cortex SUMMARIZE function
    
    Args:
        text: Text to summarize
        
    Returns:
        Dictionary containing the text summary
        
    Example:
        {"success": true, "summary": "Brief summary...", "original_length": 1000}
    """
    try:
        client = await get_cortex_client()
        result = await client.summarize_text(text=text)
        
        logger.info("Summarized text")
        return {
            "success": True,
            "original_text": text,
            "original_length": len(text),
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to summarize text: {e}")
        return {
            "success": False,
            "error": str(e),
            "text_length": len(text)
        }


@tool()
async def translate_text(text: str, from_language: str, to_language: str) -> Dict[str, Any]:
    """
    Translate text using Cortex TRANSLATE function
    
    Args:
        text: Text to translate
        from_language: Source language code (e.g., 'en', 'es', 'fr')
        to_language: Target language code (e.g., 'en', 'es', 'fr')
        
    Returns:
        Dictionary containing the translated text
        
    Example:
        {"success": true, "translation": "Hola mundo", "from": "en", "to": "es"}
    """
    try:
        client = await get_cortex_client()
        result = await client.translate_text(
            text=text,
            from_language=from_language,
            to_language=to_language
        )
        
        logger.info(f"Translated text from {from_language} to {to_language}")
        return {
            "success": True,
            "original_text": text,
            "from_language": from_language,
            "to_language": to_language,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to translate text: {e}")
        return {
            "success": False,
            "error": str(e),
            "from_language": from_language,
            "to_language": to_language
        }


@tool()
async def generate_embeddings(model: str, text: str) -> Dict[str, Any]:
    """
    Generate text embeddings using Cortex EMBED_TEXT function
    
    Args:
        model: Embedding model name (e.g., 'snowflake-arctic-embed-m', 'snowflake-arctic-embed-l')
        text: Text to generate embeddings for
        
    Returns:
        Dictionary containing the embedding vectors
        
    Example:
        {"success": true, "embeddings": [0.1, 0.2, ...], "model": "snowflake-arctic-embed-m"}
    """
    try:
        client = await get_cortex_client()
        result = await client.embed_text(model=model, text=text)
        
        logger.info(f"Generated embeddings with model {model}")
        return {
            "success": True,
            "model": model,
            "text": text,
            "text_length": len(text),
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        return {
            "success": False,
            "error": str(e),
            "model": model,
            "text": text
        }


@tool()
async def execute_sql(sql: str, parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Execute custom SQL query on Snowflake
    
    Args:
        sql: SQL statement to execute
        parameters: Optional parameters for parameterized queries
        
    Returns:
        Dictionary containing query results
        
    Example:
        {"success": true, "rows": [...], "columns": [...], "sql": "SELECT..."}
    """
    try:
        client = await get_cortex_client()
        result = await client.execute_custom_sql(sql=sql, parameters=parameters)
        
        logger.info("Executed custom SQL query")
        return {
            "success": True,
            "sql": sql,
            "parameters": parameters,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to execute SQL: {e}")
        return {
            "success": False,
            "error": str(e),
            "sql": sql,
            "parameters": parameters
        }


@tool()
async def cortex_search(query: str, search_service: str, 
                       columns: Optional[List[str]] = None,
                       filter_expr: Optional[str] = None,
                       limit: Optional[int] = None) -> Dict[str, Any]:
    """
    Perform semantic search using Snowflake Cortex Search
    
    Args:
        query: Search query text
        search_service: Name of the Cortex Search service
        columns: Optional list of columns to search in
        filter_expr: Optional filter expression for results
        limit: Optional limit on number of results
        
    Returns:
        Dictionary containing search results
        
    Example:
        {"success": true, "results": [...], "query": "search term"}
    """
    try:
        client = await get_cortex_client()
        
        # Build the Cortex Search SQL
        columns_str = ", ".join(columns) if columns else "*"
        filter_clause = f" WHERE {filter_expr}" if filter_expr else ""
        limit_clause = f" LIMIT {limit}" if limit else ""
        
        sql = f"""
        SELECT {columns_str}
        FROM TABLE(
            SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
                '{search_service}',
                '{query}'
            )
        ){filter_clause}{limit_clause};
        """
        
        result = await client.execute_custom_sql(sql=sql)
        
        logger.info(f"Performed Cortex search with service {search_service}")
        return {
            "success": True,
            "query": query,
            "search_service": search_service,
            "columns": columns,
            "filter_expr": filter_expr,
            "limit": limit,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to perform Cortex search: {e}")
        return {
            "success": False,
            "error": str(e),
            "query": query,
            "search_service": search_service
        }


@tool()
async def health_check() -> Dict[str, Any]:
    """
    Check connectivity to Snowflake Cortex API
    
    Returns:
        Dictionary containing health status and connection details
        
    Example:
        {"success": true, "status": "healthy", "account": "myaccount"}
    """
    try:
        # Delegate to the richer status checker which performs an operational
        # connectivity check (execute a simple SQL) and returns structured info.
        status = await get_snowflake_status()
        api_ok = bool(status.get('success'))
        # Normalize into a health-like response
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
async def get_snowflake_status() -> Dict[str, Any]:
    """
    Simple test tool to validate local in-process Snowflake tooling.

    Returns a small hello payload and echoes whether auth info was provided
    (either from environment variables or injected by the caller).
    """
    try:
        # Resolve credentials from injected args or environment
        token = os.getenv('SNOWFLAKE_TOKEN')
        account = os.getenv('SNOWFLAKE_ACCOUNT')
        warehouse = os.getenv('SNOWFLAKE_WAREHOUSE')
        database = os.getenv('SNOWFLAKE_DATABASE')
        schema = os.getenv('SNOWFLAKE_SCHEMA', 'PUBLIC')

        if not account:
            return {"success": False, "error": "Missing SNOWFLAKE_ACCOUNT in environment"}

        if not token:
            return {"success": False, "error": "Snowflake requires a bearer token for the SQL API. Set SNOWFLAKE_TOKEN in the environment."}

        # Construct auth using the bearer token and account details
        auth = SnowflakeAuthentication(
            account=account,
            token=token,
            warehouse=warehouse,
            database=database,
            schema=schema
        )
        client = SnowflakeCortexClient(auth=auth)
        await client.connect()
        try:
            # Execute a simple CURRENT_VERSION() as a connectivity check
            result = await client.execute_custom_sql("SELECT CURRENT_VERSION() as version;")
            await client.close()
            return {
                "success": True,
                "message": "Connected to Snowflake Cortex",
                "result": result
            }
        except Exception as e:
            # If the primary query fails, attempt a fallback
            logger.warning(f"Primary connectivity query failed, attempting fallback: {e}")
            try:
                result2 = await client.execute_custom_sql("SHOW USERS;")
                await client.close()
                return {
                    "success": True,
                    "message": "Connected to Snowflake Cortex (fallback)",
                    "result": result2
                }
            except Exception as e2:
                await client.close()
                logger.exception('Snowflake client operation failed (fallback)')
                return {"success": False, "error": str(e2)}
    except Exception as e:
        logger.error(f"get_snowflake_status failed: {e}")
        return {"success": False, "error": str(e)}


# Cleanup function for server shutdown
async def cleanup():
    """Clean up resources when server shuts down"""
    global _cortex_client
    if _cortex_client:
        await _cortex_client.close()
        _cortex_client = None


# Cleanup function for service shutdown
async def cleanup_snowflake_service():
    """Clean up resources when Snowflake service shuts down"""
    global _cortex_client
    if _cortex_client:
        await _cortex_client.close()
        _cortex_client = None


# Local transport initialization
async def initialize_snowflake_service():
    """Initialize the Snowflake service for local use"""
    try:
        await get_cortex_client()
        logger.info("Snowflake Cortex service initialized for local transport")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Snowflake service: {e}")
        return False


# For local testing only - you can import and call individual functions.