"""
Services module for ChatApp with Policy-Based Multi-Tenant Access Control

Contains various service integrations using local in-process transport with strict
policy enforcement for multi-tenant security:
- databricks: Databricks Genie API integration  
- snowflake: Snowflake Cortex AI integration
- local_manager: Policy-aware unified local transport manager
- policy: Multi-tenant access control policy models

Usage:
    # Create a policy (example with explicit parameters)
    from services.policy import OperationToolingPolicy, DatabricksPolicy
    
    policy = OperationToolingPolicy(
        databricks=DatabricksPolicy(
            token="your-databricks-token",
            spaces=["space1", "space2"]  # Simple list of space IDs
        )
    )
    
    # Use policy-aware local transport manager
    from services.local_manager import get_services_manager
    
    policy = OperationToolingPolicy(...)  # Create policy as shown above
    manager = await get_services_manager(policy)
    result = await manager.call_service_tool("databricks", "start_conversation", space_id="...", content="...")
    
    # Direct client access (if needed)
    from services.databricks import DatabricksGenieClient
    from services.snowflake import SnowflakeCortexClient
    
    # Individual service servers (for testing only)
    from services.databricks.server import server as databricks_server
    from services.snowflake.server import server as snowflake_server
"""

from . import databricks
from . import snowflake
from . import local_manager
from . import policy

# Export the core manager functions
from .local_manager import (
    get_services_manager,
    cleanup_all_services
)

# Export policy models
from .policy import (
    OperationToolingPolicy,
    DatabricksPolicy,
    SnowflakePolicy,
    UnauthorizedOperationError,
    PolicyValidationError
)

__all__ = [
    'databricks', 
    'snowflake', 
    'local_manager',
    'policy',
    'get_services_manager',
    'cleanup_all_services',
    'OperationToolingPolicy',
    'DatabricksPolicy', 
    'SnowflakePolicy',
    'UnauthorizedOperationError',
    'PolicyValidationError'
]

from . import databricks
from . import snowflake
from . import local_manager

# Export the core manager functions
from .local_manager import (
    get_services_manager,
    cleanup_all_services
)

__all__ = [
    'databricks', 
    'snowflake', 
    'local_manager',
    'get_services_manager',
    'cleanup_all_services'
]