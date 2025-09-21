import json
import asyncio
from core.utils import parse_tool_call
from tools import get_toolbelt
from dotenv import load_dotenv

load_dotenv()


def run_tool_block(block: str):
    print('Simulated model output:')
    print(block)
    parsed = parse_tool_call(block)
    print('\nparse_tool_call ->')
    print(parsed)
    if parsed:
        func_name = parsed['function']['name']
        args_json = parsed['function'].get('arguments', '{}')
        try:
            args = json.loads(args_json)
        except Exception:
            args = {}

        tb = get_toolbelt()
        # normalize exec name
        exec_name = func_name
        if exec_name.startswith('server.'):
            exec_name = exec_name.split('.', 1)[1]

        res = asyncio.run(tb.execute_tool(exec_name, args))
        print('\nExecute result:')
        print(json.dumps(res, indent=2))
    else:
        print('\nNo complete TOOL block found (or parse failed).')


def main():
    # Test 1: supported tool single-block (databricks)
    content_db = 'TOOL_START\n{"name": "databricks.get_databricks_status", "arguments": {}}\nTOOL_END'
    print('\n=== Test 1: supported tool single-block (databricks) ===')
    run_tool_block(content_db)

    # Test 2: supported tool split across chunks (simulate streaming tokens arriving)
    print('\n=== Test 2: supported tool split across chunks (databricks) ===')
    part1 = 'TOOL_START\n{"name": "databricks.get_databricks_status", '
    part2 = '"arguments": {}}\nTOOL_END'
    combined = part1 + part2
    # Simulate incremental assembly: parsing should only succeed on combined
    print('\n-- chunk 1 --')
    run_tool_block(part1)
    print('\n-- chunk 2 (completes block) --')
    run_tool_block(combined)

    # Test 3: unsupported tool forwarded to client
    print('\n=== Test 3: unsupported tool forwarded to client (fake_tool) ===')
    content_fake = 'TOOL_START\n{"name": "client.fake_tool", "arguments": {"x":1}}\nTOOL_END'
    parsed = parse_tool_call(content_fake)
    print('\nparse_tool_call ->')
    print(parsed)
    if parsed:
        func_name = parsed['function']['name']
        args_json = parsed['function'].get('arguments', '{}')
        try:
            args = json.loads(args_json)
        except Exception:
            args = {}

        tb = get_toolbelt()
        available = tb.available_tools()
        supported = any((t.function.get('name') if isinstance(t.function, dict) else getattr(t.function, 'name', None)) in (func_name, f'server.{func_name}', func_name.split('.', 1)[-1]) for t in available)
        if supported:
            print('\nTool unexpectedly supported locally; executing...')
            exec_name = func_name
            if exec_name.startswith('server.'):
                exec_name = exec_name.split('.', 1)[1]
            res = asyncio.run(tb.execute_tool(exec_name, args))
            print(json.dumps(res, indent=2))
        else:
            print('\nTool not supported locally — forwarding block to client to execute in their context:')
            print(content_fake)


if __name__ == '__main__':
    main()
