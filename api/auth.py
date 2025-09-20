"""
Authentication and policy management endpoints

This module provides:
- Policy retrieval endpoint to get current policy from headers
- Authentication endpoint for username/password -> policy mapping
- Future integration point for ADFS/SSO
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from typing import Optional, Dict, Any

from dependencies.policies import policy_dependency
from services.policy import OperationToolingPolicy, DatabricksPolicy, SnowflakePolicy

# Create router
router = APIRouter(tags=["auth"])

# Basic auth for username/password endpoint
security = HTTPBasic()


class AuthRequest(BaseModel):
    """Authentication request model"""
    username: str
    password: str


class AuthResponse(BaseModel):
    """Authentication response model"""
    success: bool
    message: str
    policy: Optional[Dict[str, Any]] = None


class PolicyResponse(BaseModel):
    """Policy response model"""
    enabled_services: list[str]
    databricks: Optional[Dict[str, Any]] = None
    snowflake: Optional[Dict[str, Any]] = None


@router.get("/policy", response_model=PolicyResponse)
async def get_current_policy(policy: OperationToolingPolicy = Depends(policy_dependency)):
    """
    Get the current operation policy derived from request headers.
    
    This endpoint reads headers like:
    - X-Enable-Databricks: Token=...; Enabled=true
    - X-Enable-Databricks-Space: space1
    - X-Enable-Snowflake: Token=...; Account=...; User=...
    - X-Enable-Snowflake-Cluster: cluster1
    
    Returns:
        PolicyResponse with current policy configuration
    """
    response_data = {
        "enabled_services": policy.get_enabled_services(),
        "databricks": None,
        "snowflake": None
    }
    
    # Add Databricks info if configured
    if policy.databricks:
        response_data["databricks"] = {
            "enabled": policy.databricks.enabled,
            "workspace_url": policy.databricks.workspace_url,
            "spaces": policy.databricks.spaces,
            "has_token": bool(policy.databricks.token)
        }
    
    # Add Snowflake info if configured
    if policy.snowflake:
        response_data["snowflake"] = {
            "enabled": policy.snowflake.enabled,
            "account": policy.snowflake.account,
            "user": policy.snowflake.user,
            "clusters": policy.snowflake.clusters,
            "databases": policy.snowflake.databases,
            "has_token": bool(policy.snowflake.token)
        }
    
    return PolicyResponse(**response_data)


@router.post("/authenticate", response_model=AuthResponse)
async def authenticate_user(auth_request: AuthRequest):
    """
    Authenticate user with username/password and return initial policy.
    
    This is currently a stub implementation that will be replaced with
    proper authentication (ADFS, SSO, etc.) in the future.
    
    Args:
        auth_request: Username and password
        
    Returns:
        AuthResponse with success status and policy configuration
    """
    
    # STUB: Simple hardcoded authentication
    # TODO: Replace with ADFS/SSO integration
    
    valid_users = {
        "admin": {
            "password": "admin123",
            "policy": {
                "databricks": {
                    "token": "dapi-admin-token",
                    "enabled": True,
                    "spaces": ["admin-space", "shared-space"]
                },
                "snowflake": {
                    "token": "snow-admin-token",
                    "account": "admin-account",
                    "user": "admin",
                    "enabled": True,
                    "clusters": ["admin-warehouse"],
                    "databases": ["admin-db", "shared-db"]
                }
            }
        },
        "user": {
            "password": "user123",
            "policy": {
                "databricks": {
                    "token": "dapi-user-token",
                    "enabled": True,
                    "spaces": ["user-space"]
                },
                "snowflake": {
                    "token": "",
                    "account": "",
                    "user": "",
                    "enabled": False,
                    "clusters": [],
                    "databases": []
                }
            }
        },
        "readonly": {
            "password": "readonly123",
            "policy": {
                "databricks": {
                    "token": "",
                    "enabled": False,
                    "spaces": []
                },
                "snowflake": {
                    "token": "",
                    "enabled": False,
                    "clusters": [],
                    "databases": []
                }
            }
        }
    }
    
    user_data = valid_users.get(auth_request.username)
    
    if not user_data or user_data["password"] != auth_request.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    return AuthResponse(
        success=True,
        message=f"Authentication successful for user: {auth_request.username}",
        policy=user_data["policy"]
    )


@router.post("/authenticate/basic", response_model=AuthResponse)
async def authenticate_basic(credentials: HTTPBasicCredentials = Depends(security)):
    """
    Authenticate using HTTP Basic Auth and return initial policy.
    
    Alternative endpoint that uses HTTP Basic Authentication header
    instead of JSON body.
    
    Args:
        credentials: HTTP Basic Auth credentials
        
    Returns:
        AuthResponse with success status and policy configuration
    """
    auth_request = AuthRequest(
        username=credentials.username,
        password=credentials.password
    )
    
    return await authenticate_user(auth_request)


@router.get("/validate")
async def validate_policy(policy: OperationToolingPolicy = Depends(policy_dependency)):
    """
    Validate the current policy configuration.
    
    This endpoint can be used to test if the current headers
    result in a valid policy configuration.
    
    Returns:
        Validation status and any errors
    """
    try:
        # Basic validation
        enabled_services = policy.get_enabled_services()
        
        validation_results = {
            "valid": True,
            "enabled_services": enabled_services,
            "validation_details": {}
        }
        
        # Validate Databricks if configured
        if policy.databricks:
            databricks_issues = []
            if policy.databricks.enabled and not policy.databricks.token:
                databricks_issues.append("Token required when enabled")
            if not policy.databricks.spaces:
                databricks_issues.append("No spaces configured (will deny all)")
            
            validation_results["validation_details"]["databricks"] = {
                "enabled": policy.databricks.enabled,
                "issues": databricks_issues
            }
        
        # Validate Snowflake if configured
        if policy.snowflake:
            snowflake_issues = []
            if policy.snowflake.enabled and not policy.snowflake.token:
                snowflake_issues.append("Token required when enabled")
            if policy.snowflake.enabled and not policy.snowflake.account:
                snowflake_issues.append("Account required when enabled")
            if policy.snowflake.enabled and not policy.snowflake.user:
                snowflake_issues.append("User required when enabled")
            if not policy.snowflake.clusters:
                snowflake_issues.append("No clusters configured (will deny all)")
            if not policy.snowflake.databases:
                snowflake_issues.append("No databases configured (will deny all)")
            
            validation_results["validation_details"]["snowflake"] = {
                "enabled": policy.snowflake.enabled,
                "issues": snowflake_issues
            }
        
        return validation_results
        
    except Exception as e:
        return {
            "valid": False,
            "error": str(e),
            "enabled_services": []
        }