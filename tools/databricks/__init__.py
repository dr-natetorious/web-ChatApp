"""
Databricks Genie service module

This module provides:
- DatabricksGenieClient: Async HTTP client for Databricks Genie API
- DatabricksAuthentication: Authentication handler for Genie API
- FastMCP server: Tool interface for handling Genie operations

Usage:
    from services.databricks import DatabricksGenieClient, DatabricksAuthentication
    from services.databricks.server import server as genie_server
    
Environment Variables Required:
    - DATABRICKS_TOKEN: Personal access token for Databricks
    - DATABRICKS_WORKSPACE_URL: Your Databricks workspace URL
"""

from .client import DatabricksGenieClient, DatabricksAuthentication

__all__ = [
    'DatabricksGenieClient',
    'DatabricksAuthentication',
]

__version__ = '1.0.0'
__author__ = 'ChatApp'
__description__ = 'Databricks Genie integration for ChatApp'