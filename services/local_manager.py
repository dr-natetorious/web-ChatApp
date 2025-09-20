"""
Local Services Manager for ChatApp with Policy-Based Multi-Tenant Access Control

This module provides a unified interface to access Databricks and Snowflake services
using local in-process transport with strict policy enforcement for multi-tenant security.
Each tenant has their own policy defining which services, tools, and resources they can access.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

# Import service modules for local transport
from .databricks.server import (
    server as databricks_server,
    initialize_databricks_service,
    cleanup_databricks_service,
    get_genie_client
)
from .snowflake.server import (
    server as snowflake_server, 
    initialize_snowflake_service,
    cleanup_snowflake_service,
    get_cortex_client
)

# Import policy system
from .policy import (
    OperationToolingPolicy,
    UnauthorizedOperationError,
    PolicyValidationError
)

logger = logging.getLogger(__name__)

# Service status tracking
_services_status: Dict[str, Dict[str, Any]] = {
    "databricks": {"initialized": False, "last_check": None, "error": None},
    "snowflake": {"initialized": False, "last_check": None, "error": None}
}


class LocalServicesManager:
    """
    Policy-Aware Local Services Manager for Multi-Tenant Access Control
    
    Coordinates Databricks and Snowflake services with strict policy enforcement.
    Each operation is validated against the tenant's policy before execution.
    Authentication tokens are tenant-specific with no cross-contamination.
    """
    
    def __init__(self, policy: Optional[OperationToolingPolicy] = None):
        self._initialized = False
        self._databricks_available = False
        self._snowflake_available = False
        self._policy = policy
    
    def set_policy(self, policy: OperationToolingPolicy) -> None:
        """
        Set the operation policy for this manager instance
        
        Args:
            policy: OperationToolingPolicy defining tenant permissions
        """
        self._policy = policy
        # Reevaluate service availability based on new policy
        if self._initialized:
            self._databricks_available = self._policy.is_service_enabled("databricks")
            self._snowflake_available = self._policy.is_service_enabled("snowflake")
    
    def get_policy(self) -> Optional[OperationToolingPolicy]:
        """Get the current policy"""
        return self._policy
    
    def _validate_policy_required(self) -> None:
        """Ensure a policy is set for operations"""
        if self._policy is None:
            raise PolicyValidationError("No policy set - operations require tenant policy")
    
    async def initialize(self) -> Dict[str, Any]:
        """
        Initialize all services for local transport with policy enforcement
        
        Returns:
            Dictionary containing initialization status and available services
        """
        if self._initialized:
            return await self.get_status()
        
        logger.info("Initializing local services manager...")
        
        # Initialize Databricks service
        try:
            await initialize_databricks_service()
            self._databricks_available = True if self._policy is None else self._policy.is_service_enabled("databricks")
            _services_status["databricks"]["initialized"] = True
            _services_status["databricks"]["last_check"] = datetime.now(timezone.utc).isoformat()
            logger.info("Databricks service initialized successfully")
        except Exception as e:
            logger.error(f"Databricks service initialization failed: {e}")
            _services_status["databricks"]["error"] = str(e)
            self._databricks_available = False
        
        # Initialize Snowflake service  
        try:
            await initialize_snowflake_service()
            self._snowflake_available = True if self._policy is None else self._policy.is_service_enabled("snowflake")
            _services_status["snowflake"]["initialized"] = True
            _services_status["snowflake"]["last_check"] = datetime.now(timezone.utc).isoformat()
            logger.info("Snowflake service initialized successfully")
        except Exception as e:
            logger.error(f"Snowflake service initialization failed: {e}")
            _services_status["snowflake"]["error"] = str(e)
            self._snowflake_available = False
        
        self._initialized = True
        
        # Log overall status
        available_count = sum([self._databricks_available, self._snowflake_available])
        logger.info(f"Local services initialized: {available_count}/2 services available")
        
        return await self.get_status()
    
    async def get_status(self) -> Dict[str, Any]:
        """
        Get current status of all services with policy information
        
        Returns:
            Dictionary containing service status and policy information
        """
        status = {
            "initialized": self._initialized,
            "services": _services_status.copy(),
            "available_services": {
                "databricks": self._databricks_available,
                "snowflake": self._snowflake_available
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Add policy information if available
        if self._policy:
            status["policy"] = {
                "enabled_services": self._policy.get_enabled_services()
            }
        
        return status
    
    async def call_service_tool(self, service_name: str, tool_name: str, **kwargs) -> Dict[str, Any]:
        """
        Call a tool on any service via local transport with policy enforcement
        
        Args:
            service_name: Name of the service ('databricks' or 'snowflake')
            tool_name: Name of the tool to call
            **kwargs: Arguments for the tool
            
        Returns:
            Tool execution result
            
        Raises:
            PolicyValidationError: If no policy is set
            UnauthorizedOperationError: If operation is not allowed by policy
        """
        # Validate policy is set
        self._validate_policy_required()
        assert self._policy is not None  # For type checker
        
        # Validate operation is allowed by policy
        if not self._policy.validate_operation(service_name, tool_name, **kwargs):
            raise UnauthorizedOperationError(
                service=service_name,
                operation=tool_name,
                details=f"Operation not permitted by tenant policy"
            )
        
        # Service availability mapping
        service_availability = {
            'databricks': self._databricks_available,
            'snowflake': self._snowflake_available
        }
        
        # Check if service is supported
        if service_name not in service_availability:
            return {
                "success": False,
                "error": f"Unknown service '{service_name}'. Supported services: {list(service_availability.keys())}",
                "service": service_name,
                "tool": tool_name
            }
        
        # Check if service is available
        if not service_availability[service_name]:
            return {
                "success": False,
                "error": f"{service_name.title()} service not available",
                "service": service_name,
                "tool": tool_name
            }
        
        try:
            # Get authentication token for the service
            token = self._policy.get_service_token(service_name)
            if not token:
                return {
                    "success": False,
                    "error": f"No authentication token available for {service_name}",
                    "service": service_name,
                    "tool": tool_name
                }
            
            # Inject authentication token and service-specific config into kwargs
            if service_name == "databricks":
                kwargs['_auth_token'] = token
                if self._policy.databricks and self._policy.databricks.workspace_url:
                    kwargs['_workspace_url'] = self._policy.databricks.workspace_url
            elif service_name == "snowflake":
                kwargs['_auth_token'] = token
                # Also inject account and user for Snowflake
                if self._policy.snowflake:
                    kwargs['_account'] = self._policy.snowflake.account
                    kwargs['_user'] = self._policy.snowflake.user
            
            # Import the appropriate server module and call the tool
            if service_name == 'databricks':
                from .databricks import server as server_module
            else:  # snowflake
                from .snowflake import server as server_module
            
            # Get the decorated function directly
            tool_func = getattr(server_module, tool_name, None)
            if not tool_func:
                return {
                    "success": False,
                    "error": f"Tool '{tool_name}' not found in {service_name} service",
                    "service": service_name,
                    "tool": tool_name
                }
            
            # Call the function directly
            result = await tool_func(**kwargs)
            return result
            
        except UnauthorizedOperationError as e:
            logger.warning(f"Unauthorized operation: {e}")
            return {
                "success": False,
                "error": str(e),
                "service": service_name,
                "tool": tool_name
            }
        except Exception as e:
            logger.error(f"{service_name.title()} tool {tool_name} failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "service": service_name,
                "tool": tool_name
            }
    
    async def list_available_tools(self) -> Dict[str, Any]:
        """
        List all available tools across services with policy filtering
        
        Returns:
            Dictionary of available tools organized by service (filtered by policy)
        """
        tools = {"databricks": [], "snowflake": []}
        
        # Service configuration: name -> (availability_flag, module_name, excluded_functions)
        services_config = {
            "databricks": (self._databricks_available, "databricks", ["get_genie_client"]),
            "snowflake": (self._snowflake_available, "snowflake", ["get_cortex_client"])
        }
        
        import inspect
        
        for service_name, (is_available, module_name, excluded_funcs) in services_config.items():
            tools[service_name] = []
            
            if is_available:
                try:
                    # Import the server module
                    if service_name == "databricks":
                        from .databricks import server as server_module
                    elif service_name == "snowflake": 
                        from .snowflake import server as server_module
                    else:
                        continue
                    
                    # Find all async functions in the module (these are the tools)
                    members = inspect.getmembers(server_module, inspect.iscoroutinefunction)
                    all_tools = [name for name, func in members 
                               if not name.startswith('_') and name not in excluded_funcs]
                    
                    # Filter tools based on policy if available
                    if self._policy:
                        filtered_tools = []
                        for tool_name in all_tools:
                            # Check if this tool is allowed by policy
                            if self._policy.validate_operation(service_name, tool_name):
                                filtered_tools.append(tool_name)
                        tools[service_name] = filtered_tools
                    else:
                        tools[service_name] = all_tools
                        
                except Exception as e:
                    logger.warning(f"Could not get {service_name} tools: {e}")
        
        result = {
            "services": tools,
            "total_tools": sum(len(service_tools) for service_tools in tools.values()),
            "available_services": list(k for k, v in tools.items() if v),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Add policy information if available
        if self._policy:
            result["policy_info"] = {
                "filtered_by_policy": True
            }
        
        return result
    
    async def cleanup(self):
        """Clean up all service resources"""
        logger.info("Cleaning up local transport services...")
        
        try:
            await cleanup_databricks_service()
            logger.info("Databricks service cleanup completed")
        except Exception as e:
            logger.error(f"Databricks cleanup failed: {e}")
        
        try:
            await cleanup_snowflake_service()
            logger.info("Snowflake service cleanup completed")
        except Exception as e:
            logger.error(f"Snowflake cleanup failed: {e}")
        
        self._initialized = False
        self._databricks_available = False
        self._snowflake_available = False
        logger.info("Local services cleanup completed")


# Global services manager instance (policy-aware)
_services_manager: Optional[LocalServicesManager] = None


async def get_services_manager(policy: Optional[OperationToolingPolicy] = None) -> LocalServicesManager:
    """
    Get or create the global services manager with optional policy
    
    Args:
        policy: Optional policy to set on the manager
        
    Returns:
        Initialized LocalServicesManager instance
    """
    global _services_manager
    
    if _services_manager is None:
        _services_manager = LocalServicesManager(policy)
        await _services_manager.initialize()
    elif policy is not None:
        # Update policy if provided
        _services_manager.set_policy(policy)
    
    return _services_manager


# Cleanup function
async def cleanup_all_services():
    """Clean up all local services"""
    global _services_manager
    
    if _services_manager:
        await _services_manager.cleanup()
        _services_manager = None