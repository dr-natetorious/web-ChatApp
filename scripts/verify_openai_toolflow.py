import json
import asyncio
from core.utils import parse_server_call
from tools import get_toolbelt
from dotenv import load_dotenv

load_dotenv()   

def main():
    # Test 1: databricks
    content_db = 'SERVER_START\n{"name": "server.get_databricks_status", "arguments": {}}\nSERVER_END'
    print('Simulated model output (Databricks):')
    print(content_db)
    server_call = parse_server_call(content_db)
    print('\nparse_server_call ->')
    print(server_call)
    if server_call:
        tool_full = server_call['function']['name']
        args_json = server_call['function'].get('arguments', '{}')
        try:
            args = json.loads(args_json)
        except Exception:
            args = {}
        tb = get_toolbelt()
        exec_name = tool_full.split('.', 1)[1] if tool_full.startswith('server.') else tool_full
        res = asyncio.run(tb.execute_tool(exec_name, args))
        print('\nDatabricks Execute result:')
        print(json.dumps(res, indent=2))

    # Test 2: snowflake
    content_sf = 'SERVER_START\n{"name": "server.get_snowflake_status", "arguments": {}}\nSERVER_END'
    print('\n\nSimulated model output (Snowflake):')
    print(content_sf)
    server_call = parse_server_call(content_sf)
    print('\nparse_server_call ->')
    print(server_call)
    if server_call:
        tool_full = server_call['function']['name']
        args_json = server_call['function'].get('arguments', '{}')
        try:
            args = json.loads(args_json)
        except Exception:
            args = {}
        tb = get_toolbelt()
        exec_name = tool_full.split('.', 1)[1] if tool_full.startswith('server.') else tool_full
        res = asyncio.run(tb.execute_tool(exec_name, args))
        print('\nSnowflake Execute result:')
        print(json.dumps(res, indent=2))


if __name__ == '__main__':
    main()
