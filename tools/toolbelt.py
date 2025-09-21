"""
Toolbelt: server-side tool manager for in-process invocation.

Provides available_tools() and execute_tool() for server-side tools.
Start with two hardcoded tools: get_databricks_status and get_snowflake_status.
"""
from typing import List, Dict, Any, Optional
import logging
import os
from tools.databricks.client import DatabricksGenieClient, DatabricksAuthentication
from tools.snowflake.client import SnowflakeCortexClient, SnowflakeAuthentication
from core.models import Tool

# Import the server modules themselves so we can access the tool functions defined
# Use distinct names (module suffix) to avoid later name collisions with the
# `server` objects imported by the LocalServicesManager section below.
# Hardcoded local test implementations for server-side tools.
# These allow in-process execution without importing the FastMCP server modules.
async def get_databricks_status(_auth_token: Optional[str] = None, _workspace_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Use the Databricks Genie client to perform a simple operation (list spaces)
    to prove we can connect. Auth and workspace URL are taken from the provided
    args or environment variables.
    """
    try:
        token = os.getenv('DATABRICKS_TOKEN')
        workspace = os.getenv('DATABRICKS_WORKSPACE_URL')

        if not token or not workspace:
            return {"success": False, "error": "Missing Databricks token or workspace URL in environment or args"}

        auth = DatabricksAuthentication(token=token, workspace_url=workspace)
        client = DatabricksGenieClient(auth=auth)
        await client.connect()
        try:
            # List spaces as a lightweight connectivity check
            spaces = await client.list_spaces()
            # spaces may be a dict with 'spaces' key
            count = None
            if isinstance(spaces, dict):
                if 'spaces' in spaces and isinstance(spaces['spaces'], list):
                    count = len(spaces['spaces'])
            await client.close()
            return {
                "success": True,
                "message": "Connected to Databricks Genie",
                "spaces_count": count,
                "spaces": spaces
            }
        except Exception as e:
            await client.close()
            logger.exception('Databricks client operation failed')
            return {"success": False, "error": str(e)}
    except Exception as e:
        logger.exception('get_databricks_status top-level failure')
        return {"success": False, "error": str(e)}


async def get_snowflake_status(_auth_token: Optional[str] = None, _username: Optional[str] = None, _password: Optional[str] = None) -> Dict[str, Any]:
    """
    Use the Snowflake Cortex client to execute a simple query (SELECT 1)
    to prove connectivity. Credentials are taken from args or environment.
    """
    try:
        # Snowflake SQL API uses bearer token authentication. Ignore username/password.
        token =  os.getenv('SNOWFLAKE_TOKEN')
        account = os.getenv('SNOWFLAKE_ACCOUNT')
        warehouse = os.getenv('SNOWFLAKE_WAREHOUSE')
        database = os.getenv('SNOWFLAKE_DATABASE')
        schema = os.getenv('SNOWFLAKE_SCHEMA', 'PUBLIC')

        if not account:
            return {"success": False, "error": "Missing SNOWFLAKE_ACCOUNT in environment"}

        if not token:
            return {"success": False, "error": "Snowflake requires a bearer token for the SQL API. Set SNOWFLAKE_TOKEN in the environment."}

        # Construct auth using only the bearer token and account details
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
            # Execute a simple SELECT CURRENT_VERSION() as a connectivity check
            result = await client.execute_custom_sql("SELECT CURRENT_VERSION() as version;")
            await client.close()
            return {
                "success": True,
                "message": "Connected to Snowflake Cortex",
                "result": result
            }
        except Exception as e:
            # If SELECT 1 fails, try a fallback 'SHOW USERS' to demonstrate a different API path
            logger.warning(f"SELECT 1 failed, attempting SHOW USERS fallback: {e}")
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
        logger.exception('get_snowflake_status top-level failure')
        return {"success": False, "error": str(e)}

logger = logging.getLogger(__name__)


class Toolbelt:
    def __init__(self, policy=None):
        # policy can be used to filter tools per-caller in future
        self.policy = policy

    def available_tools(self) -> List[Tool]:
        tools: List[Tool] = []
        # Prefer the centralized builtin toolset provider if available
        try:
            import tools as tools_pkg
            if hasattr(tools_pkg, 'get_builtin_toolset'):
                for td in tools_pkg.get_builtin_toolset() or []:
                    tools.append(Tool(type='function', function=td))
        except Exception:
            logger.debug('tools.get_builtin_toolset not available')

        # As a fallback, discover functions directly in server modules
        if not tools:
            import inspect
            from typing import Dict as _Dict, Any as _Any

            service_modules = [
                ("databricks", "tools.databricks.server"),
                ("snowflake", "tools.snowflake.server")
            ]

            for service_name, module_path in service_modules:
                try:
                    module = __import__(module_path, fromlist=['*'])
                except Exception as e:
                    logger.warning(f"Could not import {module_path}: {e}")
                    continue

                for attr_name in dir(module):
                    # Skip private attrs
                    if attr_name.startswith('_'):
                        continue
                    try:
                        attr = getattr(module, attr_name)
                    except Exception:
                        continue

                    # Identify functions decorated with @tool()
                    if callable(attr) and getattr(attr, '_is_tool', False):
                        description = (attr.__doc__ or '').strip().splitlines()[0] if attr and attr.__doc__ else ''

                        # Build JSON Schema properties from function signature
                        properties: Dict[str, Dict[str, str]] = {}
                        required: List[str] = []
                        try:
                            sig = inspect.signature(attr)
                            for pname, param in sig.parameters.items():
                                if pname == 'self':
                                    continue
                                ann = param.annotation
                                ptype = 'string'
                                try:
                                    ann_str = str(ann)
                                    if 'Dict' in ann_str or 'dict' in ann_str or 'Any' in ann_str:
                                        ptype = 'object'
                                except Exception:
                                    ptype = 'string'

                                properties[pname] = {'type': ptype}
                                if param.default is inspect._empty:
                                    required.append(pname)
                        except Exception:
                            properties = {'__payload': {'type': 'object'}}

                        schema: Dict[str, _Any] = {
                            'type': 'object',
                            'properties': properties
                        }
                        if required:
                            schema['required'] = required

                        # Tool name follows the server.<function-name> convention
                        tools.append(Tool(type='function', function={
                            'name': f'server.{attr_name}',
                            'description': description,
                            'parameters': schema
                        }))

        return tools

    async def execute_tool(self, tool_name: str, args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        args = args or {}
        # Build a name -> call target map from available tools for quick lookup.
        tools_list = self.available_tools()
        tool_map = {}
        for t in tools_list:
            # t.function can be a dict descriptor (from discovery) or a python callable
            if isinstance(t.function, dict):
                tool_map[t.function['name']] = t.function
            else:
                # Try to synthesize a name from the function if possible
                fname = getattr(t.function, '__name__', None)
                if fname:
                    tool_map[fname] = t.function

        # Accept service-qualified names like 'databricks.<name>' or
        # legacy underscore-separated names like 'databricks_get_databricks_status'.
        candidates = [tool_name]
        if isinstance(tool_name, str) and '_' in tool_name and not ('.' in tool_name):
            # normalize first underscore to a dot: databricks_get_foo -> databricks.get_foo
            parts = tool_name.split('_', 1)
            if len(parts) == 2:
                candidates.append(f"{parts[0]}.{parts[1]}")
        if isinstance(tool_name, str) and '.' in tool_name:
            # also allow the bare function name as a fallback
            candidates.append(tool_name.split('.', 1)[-1])
        else:
            candidates.append(tool_name)

        found = None
        for cand in candidates:
            if cand in tool_map:
                found = tool_map[cand]
                break

        if not found:
            # Unknown tool
            return {'success': False, 'error': f'Unknown server tool: {tool_name}'}

        # If found is a dict descriptor, import and call the actual function from the module
        if isinstance(found, dict):
            # found['name'] is like 'databricks.list_spaces'
            full_name = found['name']
            try:
                service, fn = full_name.split('.', 1)
            except Exception:
                return {'success': False, 'error': f'Invalid tool name: {full_name}'}

            module_path = f'tools.{service}.server'
            try:
                module = __import__(module_path, fromlist=['*'])
            except Exception as e:
                logger.exception('Failed to import service module for tool execution')
                return {'success': False, 'error': str(e)}

            if not hasattr(module, fn):
                return {'success': False, 'error': f'Tool function {fn} not found in {module_path}'}

            func = getattr(module, fn)
        else:
            func = found

        try:
            import inspect
            sig = inspect.signature(func)
            call_kwargs = {}
            for pname in sig.parameters.keys():
                if pname == 'self':
                    continue
                if pname in args:
                    call_kwargs[pname] = args[pname]

            result = await func(**call_kwargs)
            return result
        except Exception as e:
            logger.exception('Server tool execution failed')
            return {'success': False, 'error': str(e)}


_default_toolbelt = Toolbelt()

def get_toolbelt(policy=None) -> Toolbelt:
    # For now ignore policy; can be extended
    return _default_toolbelt
