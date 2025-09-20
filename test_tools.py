import requests
import json

# Test if tools are being passed correctly and if tool calls work
try:
    response = requests.post(
        'http://127.0.0.1:8000/v1/chat/completions',
        headers={'Content-Type': 'application/json'},
        json={
            'model': 'llama',
            'messages': [{'role': 'user', 'content': 'Create a simple bar chart showing sales data for Q1: Jan 100, Feb 150, Mar 200'}],
            'stream': False,
            'tools': [
                {
                    'type': 'function',
                    'function': {
                        'name': 'render_chart',
                        'description': 'Display a chart (bar, line, pie, etc.) with data visualization',
                        'parameters': {
                            'type': 'object',
                            'properties': {
                                'title': {'type': 'string'},
                                'chartType': {'type': 'string', 'enum': ['bar', 'line', 'pie']},
                                'chartData': {'type': 'object'}
                            }
                        }
                    }
                }
            ]
        }
    )
    
    print(f'Status: {response.status_code}')
    if response.status_code == 200:
        result = response.json()
        print('=== Response ===')
        print(json.dumps(result, indent=2))
        
        # Check if we get a tool call
        if 'choices' in result and len(result['choices']) > 0:
            choice = result['choices'][0]
            message = choice.get('message', {})
            
            if 'tool_calls' in message and message['tool_calls']:
                print('\n=== Tool Calls Found ===')
                for call in message['tool_calls']:
                    print(f'Tool: {call.get("function", {}).get("name", "unknown")}')
                    print(f'Args: {call.get("function", {}).get("arguments", "{}")}')
            elif 'content' in message:
                print('\n=== Response Content ===')
                print(message['content'])
                # Check if content contains TOOL_START/TOOL_END blocks
                if 'TOOL_START' in message['content'] and 'TOOL_END' in message['content']:
                    print('\n✅ Found TOOL_START/TOOL_END blocks in response!')
                else:
                    print('\n❌ No TOOL blocks found in response')
            else:
                print('\n=== No Tool Calls or Content ===')
    else:
        print(f'Error: {response.text}')
except Exception as e:
    print(f'Exception: {e}')
