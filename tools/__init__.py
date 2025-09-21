"""tools package - exports toolbelt and service subpackages.

Provides a small `tool()` decorator to mark coroutine functions as discoverable
tool implementations. The decorator is defined first to avoid circular
imports when service modules import `tools.tool`.
"""


def tool():
    """Decorator to mark a coroutine as an exposed tool.

    Usage:
        from tools import tool

        @tool()
        async def my_tool(...):
            ...

    The decorator simply attaches an attribute '_is_tool' to the function so
    discovery code can identify it. It returns the original function.
    """
    def _decorator(fn):
        try:
            setattr(fn, '_is_tool', True)
        except Exception:
            pass
        return fn

    return _decorator


from .toolbelt import get_toolbelt
from .policy import (
    OperationToolingPolicy,
    DatabricksPolicy,
    SnowflakePolicy,
    UnauthorizedOperationError,
    PolicyValidationError,
)


def _build_schema_for_fn(fn) -> dict:
    """Build a minimal JSON-schema-like parameter description from a function
    signature. This mirrors the helpers previously duplicated in service
    packages.
    """
    import inspect
    props = {}
    required = []
    try:
        sig = inspect.signature(fn)
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
            props[pname] = {'type': ptype}
            if param.default is inspect._empty:
                required.append(pname)
    except Exception:
        props = {'__payload': {'type': 'object'}}

    schema = {'type': 'object', 'properties': props}
    if required:
        schema['required'] = required
    return schema


def get_builtin_toolset() -> list:
    """Discover @tool() functions in builtin service server modules and
    return a combined list of tool descriptors for databricks + snowflake.

    Each descriptor matches the shape used by the toolbelt (name,
    description, parameters).
    """
    toolset = []
    services = ['databricks', 'snowflake']
    for svc in services:
        try:
            # Import inside the function to avoid import-time circularities.
            module = __import__(f'tools.{svc}.server', fromlist=['*'])
            for name in dir(module):
                if name.startswith('_'):
                    continue
                attr = getattr(module, name)
                if callable(attr) and getattr(attr, '_is_tool', False):
                    desc = (attr.__doc__ or '').strip().splitlines()[0] if attr.__doc__ else ''
                    schema = _build_schema_for_fn(attr)
                    # Expose tools under a service-qualified name (e.g. databricks.list_spaces)
                    toolset.append({
                        'name': f'{svc}.{name}',
                        'description': desc,
                        'parameters': schema
                    })
        except Exception:
            # Ignore failures so partial environments still work
            continue
    return toolset

__all__ = [
    'tool',
    'get_toolbelt',
    'get_builtin_toolset',
    'OperationToolingPolicy',
    'DatabricksPolicy',
    'SnowflakePolicy',
    'UnauthorizedOperationError',
    'PolicyValidationError',
]