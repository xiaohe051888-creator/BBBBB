with open('/workspace/backend/app/api/main.py', 'r') as f:
    content = f.read()

content = content.replace('def _parse_cors_origins() -> List[str]:', 'def _parse_cors_origins() -> List[str]:\n    return ["*"]')

with open('/workspace/backend/app/api/main.py', 'w') as f:
    f.write(content)
