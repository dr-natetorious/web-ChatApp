"""
FastMCP 2 server interface for Snowflake Cortex operations (Local Transport)
"""
import os
import asyncio
from typing import Dict, Any, List, Optional
import logging
from fastmcp import FastMCP
from .client import SnowflakeCortexClient, SnowflakeAuthentication

logger = logging.getLogger(__name__)

# Initialize FastMCP server for local transport
server = FastMCP("Snowflake Cortex")

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
            username=username,
            password=password,
            token=token,
            warehouse=warehouse,
            database=database,
            schema=schema
        )
        _cortex_client = SnowflakeCortexClient(auth=auth)
        await _cortex_client.connect()
        
    return _cortex_client


@server.tool()
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


@server.tool()
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


@server.tool()
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


@server.tool()
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


@server.tool()
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


@server.tool()
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


@server.tool()
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


@server.tool()
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


@server.tool()
async def health_check() -> Dict[str, Any]:
    """
    Check connectivity to Snowflake Cortex API
    
    Returns:
        Dictionary containing health status and connection details
        
    Example:
        {"success": true, "status": "healthy", "account": "myaccount"}
    """
    try:
        client = await get_cortex_client()
        is_healthy = await client.health_check()
        
        return {
            "success": True,
            "status": "healthy" if is_healthy else "unhealthy",
            "api_accessible": is_healthy,
            "account": client.auth.account,
            "warehouse": client.auth.warehouse,
            "database": client.auth.database,
            "schema": client.auth.schema
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "success": False,
            "status": "unhealthy",
            "error": str(e),
            "api_accessible": False
        }


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
        client = await get_cortex_client()
        logger.info("Snowflake Cortex service initialized for local transport")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Snowflake service: {e}")
        return False


# For local testing only - not exposed to network
if __name__ == "__main__":
    # This is for development/testing only
    # In production, the service is used via local transport
    import uvicorn
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    logger.warning("Running Snowflake service in standalone mode - for testing only!")
    
    # Run the server locally for testing
    uvicorn.run(
        "services.snowflake.server:server",
        host="127.0.0.1",  # Only localhost
        port=8002,
        reload=True
    )