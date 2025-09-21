import httpx
import json

# Your Snowflake configuration
ACCOUNT_IDENTIFIER = "dbuvyje-uac93388.snowflakecomputing.com"
USERNAME = "NATEBACHMEIER"
PAT_TOKEN = "eyJraWQiOiI0MzQzNzEyNTYzMjUiLCJhbGciOiJFUzI1NiJ9.eyJwIjoiMTY5Njc2MjYyODoxNjk2NzYyNjI4IiwiaXNzIjoiU0Y6MTA1NiIsImV4cCI6MTc5MDAwNDAzM30.sFCA0DQcADPs_fHdusiaLnT8ywI_QnMrwDpirhZ7FZiIBgjIFBgE59u9mC8ByN4UTZr7BQu1yfShIHI6wXxDmw"

def test_pat_authentication():
    """Test PAT token authentication with Snowflake REST API"""
    
    print("🚀 Testing PAT Token Authentication")
    print("=" * 50)
    
    headers = {
        "Authorization": f"Bearer {PAT_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Python-httpx-client"
    }
    
    # Test query
    query_data = {
        "statement": "SELECT CURRENT_VERSION() as version, CURRENT_USER() as user, CURRENT_ROLE() as role, CURRENT_WAREHOUSE() as warehouse",
        "timeout": 60
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            print(f"📤 Submitting query to: {ACCOUNT_IDENTIFIER}")
            
            response = client.post(
                f"https://{ACCOUNT_IDENTIFIER}/api/v2/statements",
                headers=headers,
                json=query_data
            )
            
            print(f"📥 Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print("✅ PAT Authentication successful!")
                print(f"🔑 Statement Handle: {result.get('statementHandle')}")
                
                # Get the query results
                statement_handle = result['statementHandle']
                
                result_response = client.get(
                    f"https://{ACCOUNT_IDENTIFIER}/api/v2/statements/{statement_handle}",
                    headers=headers
                )
                
                if result_response.status_code == 200:
                    query_result = result_response.json()
                    print("\n🎉 Query Results:")
                    print("=" * 40)
                    
                    if 'data' in query_result and query_result['data']:
                        for row in query_result['data']:
                            print(f"  📊 Snowflake Version: {row[0]}")
                            print(f"  👤 Current User: {row[1]}")
                            print(f"  🎭 Current Role: {row[2]}")
                            print(f"  🏭 Current Warehouse: {row[3] if row[3] else 'None'}")
                    
                    # Show result metadata
                    if 'resultSetMetaData' in query_result:
                        columns = query_result['resultSetMetaData']['rowType']
                        print(f"\n📋 Columns returned: {len(columns)}")
                        for i, col in enumerate(columns):
                            print(f"    {i+1}. {col['name']} ({col['type']})")
                
                return True
                
            else:
                print(f"❌ Request failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def test_database_listing():
    """Test listing databases with PAT token"""
    
    print("\n🗃️  Testing database listing...")
    
    headers = {
        "Authorization": f"Bearer {PAT_TOKEN}",
        "Accept": "application/json"
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(
                f"https://{ACCOUNT_IDENTIFIER}/api/v2/databases",
                headers=headers
            )
            
            if response.status_code == 200:
                databases = response.json()
                print(f"✅ Found {len(databases)} databases:")
                
                for db in databases[:5]:  # Show first 5
                    print(f"  🗃️  {db.get('name', 'Unknown')} (Created: {db.get('created_on', 'Unknown')[:10]})")
                
                if len(databases) > 5:
                    print(f"  ... and {len(databases) - 5} more databases")
                
                return True
            else:
                print(f"❌ Database listing failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def run_custom_query(sql_statement):
    """Execute a custom SQL statement using PAT token"""
    
    print(f"\n🔄 Executing: {sql_statement}")
    
    headers = {
        "Authorization": f"Bearer {PAT_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    query_data = {
        "statement": sql_statement,
        "timeout": 60
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"https://{ACCOUNT_IDENTIFIER}/api/v2/statements",
                headers=headers,
                json=query_data
            )
            
            if response.status_code == 200:
                result = response.json()
                statement_handle = result['statementHandle']
                
                # Get results
                result_response = client.get(
                    f"https://{ACCOUNT_IDENTIFIER}/api/v2/statements/{statement_handle}",
                    headers=headers
                )
                
                if result_response.status_code == 200:
                    query_result = result_response.json()
                    
                    if 'data' in query_result and query_result['data']:
                        print("📊 Results:")
                        for i, row in enumerate(query_result['data'][:3]):  # Show first 3 rows
                            print(f"   Row {i+1}: {row}")
                        
                        if len(query_result['data']) > 3:
                            print(f"   ... and {len(query_result['data']) - 3} more rows")
                    else:
                        print("✅ Query executed successfully (no data returned)")
                        
                    return query_result
                    
            print(f"❌ Query failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Query error: {str(e)}")
        return None

def test_warehouse_operations():
    """Test warehouse-related operations"""
    
    print("\n🏭 Testing warehouse operations...")
    
    # Show warehouses
    result = run_custom_query("SHOW WAREHOUSES")
    
    if result and 'data' in result and result['data']:
        print("✅ Warehouses accessible")
        
        # Try to use a warehouse for a computation
        compute_result = run_custom_query("""
            SELECT 
                42 * 1337 as calculation,
                CURRENT_TIMESTAMP() as timestamp,
                'PAT Authentication Working!' as message
        """)
        
        if compute_result:
            print("✅ Computation successful with PAT token!")
    else:
        print("ℹ️  No warehouses found or no access")

if __name__ == "__main__":
    print("🎯 Snowflake PAT Token Test Suite")
    print("=" * 60)
    
    # Test 1: Basic PAT authentication
    success = test_pat_authentication()
    
    if success:
        print("\n" + "🎉" * 20)
        print("SUCCESS! Your PAT token is working perfectly!")
        print("🎉" * 20)
        
        # Test 2: Database operations
        test_database_listing()
        
        # Test 3: Warehouse operations
        test_warehouse_operations()
        
        # Test 4: Custom queries
        print("\n📝 Testing additional queries...")
        run_custom_query("SELECT CURRENT_ACCOUNT() as account")
        run_custom_query("SELECT COUNT(*) as total_databases FROM INFORMATION_SCHEMA.DATABASES")
        
        print("\n" + "=" * 60)
        print("🚀 Your Snowflake REST API setup is complete!")
        print("\n💡 You can now use this pattern in your applications:")
        print(f"""
        headers = {{
            "Authorization": "Bearer {PAT_TOKEN[:20]}...",
            "Content-Type": "application/json"
        }}
        
        # Submit query
        response = httpx.post(
            "https://{ACCOUNT_IDENTIFIER}/api/v2/statements",
            headers=headers,
            json={{"statement": "YOUR_SQL_HERE"}}
        )
        """)
        
    else:
        print("\n❌ PAT token test failed")
        print("💡 Double-check that the token was copied correctly")

# Required: pip install httpx