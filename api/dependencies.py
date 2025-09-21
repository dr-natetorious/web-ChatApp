"""
Policy dependencies for HTTP header-based policy initialization

This module parses HTTP headers to dynamically create OperationToolingPolicy instances.
Supports configuration via headers like:
- X-Enable-Databricks: Token=dapi-abc123; Workspace_Url=https://...
- X-Enable-Databricks-Space: space1
- X-Enable-Databricks-Space: space2
- X-Enable-Snowflake: Token=snow-token; Account=myaccount; User=myuser
- X-Enable-Snowflake-Cluster: cluster1
- X-Enable-Snowflake-Database: database1

Notes:
- Providing a Token= automatically enables the service
- Use Enabled=false to explicitly disable even with a token
"""
from typing import Optional, Dict, List
from fastapi import Request, HTTPException
from tools.policy import OperationToolingPolicy, DatabricksPolicy, SnowflakePolicy


def parse_auth_header(header_value: str) -> Dict[str, str]:
    """
    Parse authentication header value in format: Key1=value1; Key2=value2
    
    Returns:
        Dict with keys and values (no lists, just auth info)
    """
    result = {}
    if not header_value:
        return result
    
    # Split by semicolon to get key=value pairs
    pairs = [pair.strip() for pair in header_value.split(';') if pair.strip()]
    
    for pair in pairs:
        if '=' not in pair:
            continue
            
        key, value = pair.split('=', 1)
        key = key.strip().lower()
        value = value.strip()
        result[key] = value
    
    return result


def get_resource_headers(request: Request, prefix: str) -> List[str]:
    """
    Get all headers with a specific prefix and return their values.
    
    Args:
        request: FastAPI Request object
        prefix: Header prefix (e.g., 'X-Enable-Databricks-Space')
        
    Returns:
        List of header values
    """
    resources = []
    prefix_lower = prefix.lower()
    
    for name, value in request.headers.items():
        if name.lower() == prefix_lower:
            # Handle comma-separated values in a single header
            if ',' in value:
                resources.extend([v.strip() for v in value.split(',') if v.strip()])
            else:
                resources.append(value.strip())
    
    return resources


def create_databricks_policy_from_headers(request: Request) -> Optional[DatabricksPolicy]:
    """
    Create DatabricksPolicy from headers.
    
    Expected headers:
    - X-Enable-Databricks: Token=dapi-abc123; Workspace_Url=https://...
    - X-Enable-Databricks-Space: space1
    - X-Enable-Databricks-Space: space2
    
    Note: Providing Token= automatically enables the service
    """
    auth_header = request.headers.get('X-Enable-Databricks', '')
    if not auth_header:
        return None
    
    # Parse auth information
    auth_info = parse_auth_header(auth_header)
    
    # Extract values with defaults
    token = auth_info.get('token', '')
    # If token is provided, infer enabled=true unless explicitly disabled
    enabled = auth_info.get('enabled', 'true' if token else 'false').lower() in ('true', '1', 'yes', 'on')
    workspace_url = auth_info.get('workspace_url', auth_info.get('workspace', ''))
    
    # Get all space headers
    spaces = get_resource_headers(request, 'X-Enable-Databricks-Space')
    
    return DatabricksPolicy(
        token=token,
        enabled=enabled,
        workspace_url=workspace_url or None,
        spaces=spaces
    )


def create_snowflake_policy_from_headers(request: Request) -> Optional[SnowflakePolicy]:
    """
    Create SnowflakePolicy from headers.
    
    Expected headers:
    - X-Enable-Snowflake: Token=snow-token; Account=myaccount; User=myuser
    - X-Enable-Snowflake-Cluster: cluster1
    - X-Enable-Snowflake-Database: database1
    
    Note: Providing Token= automatically enables the service
    """
    auth_header = request.headers.get('X-Enable-Snowflake', '')
    if not auth_header:
        return None
    
    # Parse auth information
    auth_info = parse_auth_header(auth_header)
    
    # Extract required values
    token = auth_info.get('token', '')
    account = auth_info.get('account', '')
    user = auth_info.get('user', '')
    
    # Extract optional values
    # If token is provided, infer enabled=true unless explicitly disabled
    enabled = auth_info.get('enabled', 'true' if token else 'false').lower() in ('true', '1', 'yes', 'on')
    
    # Get resource headers
    clusters = get_resource_headers(request, 'X-Enable-Snowflake-Cluster')
    databases = get_resource_headers(request, 'X-Enable-Snowflake-Database')
    
    # Account and user are required for Snowflake when enabled
    if enabled and (not account or not user):
        raise HTTPException(
            status_code=400,
            detail="Snowflake requires 'account' and 'user' when enabled"
        )
    
    return SnowflakePolicy(
        token=token,
        account=account,
        user=user,
        enabled=enabled,
        clusters=clusters,
        databases=databases
    )


def create_policy_from_headers(request: Request) -> OperationToolingPolicy:
    """
    Create OperationToolingPolicy from HTTP headers.
    
    Supported headers:
    - X-Enable-Databricks: Token=dapi-abc123
    - X-Enable-Databricks-Space: space1
    - X-Enable-Databricks-Space: space2
    - X-Enable-Snowflake: Token=snow-token; Account=myaccount; User=myuser
    - X-Enable-Snowflake-Cluster: cluster1
    - X-Enable-Snowflake-Database: database1
    
    Note: Providing Token= automatically enables the service
    
    Args:
        request: FastAPI Request object
        
    Returns:
        OperationToolingPolicy instance
        
    Raises:
        HTTPException: If header parsing fails or required values are missing
    """
    try:
        # Parse headers using new header-based functions
        databricks_policy = create_databricks_policy_from_headers(request)
        snowflake_policy = create_snowflake_policy_from_headers(request)
        
        # Create and return policy
        return OperationToolingPolicy(
            databricks=databricks_policy,
            snowflake=snowflake_policy
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Policy validation error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Header parsing error: {str(e)}"
        )


def policy_dependency(request: Request) -> OperationToolingPolicy:
    """
    FastAPI dependency function to extract policy from request headers.
    
    Usage:
        @app.get("/api/databricks/spaces")
        async def list_spaces(policy: OperationToolingPolicy = Depends(policy_dependency)):
            # Use policy here
            pass
    """
    return create_policy_from_headers(request)