"""
Toolbelt: server-side tool manager for in-process invocation.

Provides available_tools() and execute_tool() for server-side tools.
Start with two hardcoded tools: get_databricks_status and get_snowflake_status.
"""
from typing import List, Dict, Any, Optional
import logging
from core.models import Tool

# Import the server modules themselves so we can access the tool functions defined
# Use distinct names (module suffix) to avoid later name collisions with the
# `server` objects imported by the LocalServicesManager section below.
# The lightweight status helpers were moved to their respective service
# modules (tools.databricks.server and tools.snowflake.server) so that
# the concrete connectivity checks run in the service modules where the
# service clients and lifecycle are managed. Keeping them here caused
# duplicate definitions and import cycles.

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
            from typing import Any as _Any

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
