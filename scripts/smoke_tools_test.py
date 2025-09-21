import asyncio
import json
from tools import get_toolbelt
from tools.policy import OperationToolingPolicy, DatabricksPolicy, SnowflakePolicy

async def main():
    # Create a simple policy with tokens from .env or placeholders
    policy = OperationToolingPolicy(
        databricks=DatabricksPolicy(token='fake-token', workspace_url='https://example', spaces=[]),
        snowflake=SnowflakePolicy(token='fake-token', account='acct', user='user')
    )

    toolbelt = get_toolbelt(policy)

    print('Calling get_databricks_status() via toolbelt')
    res1 = await toolbelt.execute_tool('get_databricks_status', {})
    print(json.dumps(res1, indent=2))

    print('\nCalling get_snowflake_status() via toolbelt')
    res2 = await toolbelt.execute_tool('get_snowflake_status', {})
    print(json.dumps(res2, indent=2))

if __name__ == '__main__':
    asyncio.run(main())
