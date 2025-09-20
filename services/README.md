# ChatApp Services

Local in-process transport services for AI-powered tools from multiple cloud providers.

## 🚀 Features

### Local Transport Architecture
- **Zero network overhead**: In-process communication between services
- **Enhanced security**: No external network exposure
- **Better performance**: Direct function calls instead of HTTP requests
- **Simplified deployment**: Single process with multiple AI services

### Databricks Genie Integration
- **Conversational AI**: Start and manage conversations with Databricks Genie
- **Document Processing**: Handle attachments and file analysis
- **Space Management**: List and access different Genie spaces

### Snowflake Cortex Integration
- **LLM Completions**: Text generation with Arctic, Llama 2, Mistral models
- **Text Analysis**: Sentiment analysis, summarization, extraction
- **Translation**: Multi-language text translation
- **Embeddings**: Vector generation for semantic search
- **SQL Execution**: Direct Snowflake query execution

## 📁 Architecture

```
services/
├── local_transport.py           # 🎯 Unified local transport manager
├── databricks/
│   ├── client.py               # DatabricksGenieClient + Authentication
│   ├── server.py               # FastMCP tools (local transport)
│   └── __init__.py
├── snowflake/
│   ├── client.py               # SnowflakeCortexClient + Authentication  
│   ├── server.py               # FastMCP tools (local transport)
│   └── __init__.py
└── services.env.example        # Configuration template
```

**Design Philosophy**: Services use **local in-process transport** for zero network overhead and enhanced security. External network access is disabled by default.

## 🛠 Setup

### 1. Environment Configuration

Copy the example configuration:
```bash
cp services/services.env.example .env
```

Update `.env` with your credentials:
```bash
# Databricks
DATABRICKS_TOKEN=your_token
DATABRICKS_WORKSPACE_URL=https://your-workspace.databricks.com

# Snowflake  
SNOWFLAKE_ACCOUNT=your-account
SNOWFLAKE_TOKEN=your_oauth_token
# OR use username/password:
# SNOWFLAKE_USERNAME=username
# SNOWFLAKE_PASSWORD=password

# Optional Snowflake resources
SNOWFLAKE_WAREHOUSE=warehouse_name
SNOWFLAKE_DATABASE=database_name
SNOWFLAKE_SCHEMA=schema_name
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Use Local Transport Services

```python
# Initialize and use services via local transport
from services import (
    databricks_start_conversation,
    snowflake_complete_text,
    services_status,
    get_services_manager
)

# Services auto-initialize on first use
result = await databricks_start_conversation("space_123", "Hello!")
completion = await snowflake_complete_text("snowflake-arctic", "Explain AI")
status = await services_status()
```

## 🔧 Usage

### Local Transport (Recommended)

```python
from services import (
    databricks_start_conversation,
    databricks_post_message,
    snowflake_complete_text,
    snowflake_execute_sql,
    services_status
)

# All functions use local transport automatically
async def example():
    # Check service status
    status = await services_status()
    print(f"Services available: {status['available_services']}")
    
    # Use Databricks Genie
    conversation = await databricks_start_conversation(
        space_id="space_123", 
        content="Analyze our sales data"
    )
    
    # Use Snowflake Cortex
    analysis = await snowflake_complete_text(
        model="snowflake-arctic",
        prompt="Summarize Q4 performance",
        max_tokens=500
    )
    
    # Execute SQL directly
    results = await snowflake_execute_sql(
        sql="SELECT COUNT(*) as total_customers FROM customers"
    )
```

### Advanced Local Transport

```python
from services.local_transport import LocalServicesManager

async def advanced_usage():
    # Get the services manager
    manager = await get_services_manager()
    
    # Check detailed status
    status = await manager.get_status()
    
    # Call any tool directly
    result = await manager.call_databricks_tool(
        "start_conversation",
        space_id="space_123", 
        content="Hello!"
    )
    
    # List all available tools
    tools = await manager.list_available_tools()
    print(f"Available tools: {tools}")
    
    # Cleanup when done
    await manager.cleanup()
```

### Direct Client Usage (if needed)

```python
from services.databricks import DatabricksGenieClient, DatabricksAuthentication
from services.snowflake import SnowflakeCortexClient, SnowflakeAuthentication

# Direct client access (bypasses local transport)
auth = DatabricksAuthentication(token="...", workspace_url="...")
async with DatabricksGenieClient(auth) as client:
    result = await client.start_conversation("space_123", "Hello!")
```

## 🔍 Available Functions

### Databricks Functions
- `databricks_start_conversation(space_id, content)` - Start new conversation
- `databricks_post_message(conversation_id, content, attachments?)` - Post message
- Plus: get_attachment, get_conversation, list_spaces, health_check

### Snowflake Functions  
- `snowflake_complete_text(model, prompt, max_tokens?, temperature?)` - Text completion
- `snowflake_execute_sql(sql, parameters?)` - Execute SQL
- Plus: analyze_sentiment, summarize_text, translate_text, generate_embeddings

### Management Functions
- `services_status()` - Get service health and availability
- `services_list_tools()` - List all available tools
- `get_services_manager()` - Access the services manager
- `cleanup_all_services()` - Clean up resources

## 🔒 Security & Performance

### Security Benefits
- **No network exposure**: Services not accessible from outside
- **In-process only**: All communication stays within application
- **Credential isolation**: Environment-based configuration
- **No open ports**: No HTTP servers listening

### Performance Benefits  
- **Zero network latency**: Direct function calls
- **No HTTP overhead**: No request/response serialization
- **Shared memory**: Efficient data transfer
- **Connection pooling**: Reused client connections

## 🧪 Testing

### Test Local Transport
```python
import asyncio
from services import services_status, databricks_start_conversation

async def test_services():
    # Check if services are available
    status = await services_status()
    print("Service status:", status)
    
    # Test Databricks (if available)
    if status['available_services']['databricks']:
        result = await databricks_start_conversation("test_space", "Hello!")
        print("Databricks test:", result)

# Run test
asyncio.run(test_services())
```

### Test Individual Services (Development Only)
```bash
# Test Databricks service standalone
python -m services.databricks.server  # Localhost:8001

# Test Snowflake service standalone  
python -m services.snowflake.server   # Localhost:8002
```

## 📊 Monitoring

Services provide comprehensive status information:

```python
status = await services_status()
# {
#   "initialized": True,
#   "services": {
#     "databricks": {"initialized": True, "last_check": "...", "error": None},
#     "snowflake": {"initialized": True, "last_check": "...", "error": None}
#   },
#   "available_services": {"databricks": True, "snowflake": True}
# }
```

## 🤝 Integration with ChatApp

The local transport services integrate seamlessly with the main ChatApp:

```python
# In your main application
from services import get_services_manager, cleanup_all_services

class ChatApp:
    async def startup(self):
        # Services auto-initialize on first use
        self.services = await get_services_manager()
        
    async def shutdown(self):
        # Clean up service resources
        await cleanup_all_services()
```

## 📄 License

See main project LICENSE file.

## 🔍 Monitoring & Debugging

### Health Checks

```python
# Check all services
health = await services_health_check()
print(health)
# {
#   "overall_status": "healthy",
#   "services": {
#     "databricks": {"status": "healthy", "last_check": "..."},
#     "snowflake": {"status": "healthy", "last_check": "..."}
#   }
# }
```

### Logging

The server provides comprehensive logging:
- **Service calls**: Request parameters (sanitized)
- **Performance**: Response times and success rates
- **Health monitoring**: Automatic service health tracking
- **Error details**: Detailed error messages with context

Logs are written to:
- **Console**: Real-time output
- **File**: `services.log` for persistence

### Error Handling

All tools return standardized error responses:
```json
{
  "success": false,
  "error": "Detailed error message",
  "service": "databricks",
  "operation": "start-conversation",
  "duration_ms": 1250,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 🔒 Security

- **Credential sanitization**: Sensitive data removed from logs
- **Environment-based config**: No hardcoded credentials
- **Connection pooling**: Efficient resource management
- **Error boundaries**: Service failures don't crash entire system

## 🧪 Testing

```bash
# Test individual services
python -c "
import asyncio
from services.databricks import DatabricksGenieClient, DatabricksAuthentication

async def test():
    auth = DatabricksAuthentication(token='test', workspace_url='test')
    client = DatabricksGenieClient(auth)
    health = await client.health_check()
    print(f'Databricks healthy: {health}')

asyncio.run(test())
"

# Test unified server
curl http://localhost:8000/health
```

## 📊 Performance

- **Async/await**: Non-blocking I/O operations
- **Connection reuse**: HTTP client pooling
- **Resource cleanup**: Proper lifecycle management
- **Timeout handling**: Configurable request timeouts

## 🤝 Contributing

1. Add new service modules under `services/new_service/`
2. Implement `client.py` with async HTTP client
3. Create `server.py` with FastMCP tools
4. Add namespaced tools to unified `services/server.py`
5. Update environment configuration examples
6. Add comprehensive logging and error handling

## 📄 License

See main project LICENSE file.