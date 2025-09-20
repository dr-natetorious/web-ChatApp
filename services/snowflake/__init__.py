"""
Snowflake Cortex service module

This module provides:
- SnowflakeCortexClient: Async HTTP client for Snowflake Cortex AI functions
- SnowflakeAuthentication: Authentication handler for Snowflake API
- FastMCP server: Tool interface for handling Cortex operations

Usage:
    from services.snowflake import SnowflakeCortexClient, SnowflakeAuthentication
    from services.snowflake.server import server as cortex_server
    
Environment Variables Required:
    - SNOWFLAKE_ACCOUNT: Snowflake account identifier
    - SNOWFLAKE_TOKEN: OAuth token OR
    - SNOWFLAKE_USERNAME + SNOWFLAKE_PASSWORD: Username/password auth
    - SNOWFLAKE_WAREHOUSE: Warehouse name (optional)
    - SNOWFLAKE_DATABASE: Database name (optional)
    - SNOWFLAKE_SCHEMA: Schema name (default: PUBLIC)

Cortex Functions Available:
    - Text completion with various LLMs (Snowflake Arctic, Llama 2, Mistral, etc.)
    - Text extraction and question answering
    - Sentiment analysis
    - Text summarization
    - Language translation
    - Text embeddings generation
    - Semantic search
    - Custom SQL execution
"""

from .client import SnowflakeCortexClient, SnowflakeAuthentication
from .server import server

__all__ = [
    'SnowflakeCortexClient',
    'SnowflakeAuthentication', 
    'server'
]

__version__ = '1.0.0'
__author__ = 'ChatApp'
__description__ = 'Snowflake Cortex AI integration for ChatApp'