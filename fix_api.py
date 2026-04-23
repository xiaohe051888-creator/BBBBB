import re

with open('/workspace/frontend/src/services/api.ts', 'r') as f:
    content = f.read()

# Replace parameter tableId: string
content = re.sub(r'tableId:\s*string,\s*', '', content)
content = re.sub(r'tableId:\s*string\s*(?=\))', '', content)
content = re.sub(r',\s*table_id:\s*tableId', '', content)
content = re.sub(r'table_id:\s*tableId,\s*', '', content)
content = re.sub(r'\{\s*table_id:\s*tableId\s*\}', '{ }', content)
content = re.sub(r'table_id:\s*tableId', '', content)

# Fix specific things
content = content.replace("const params: Record<string, any> = {  };", "const params: Record<string, any> = { };")
content = content.replace("`${baseWsUrl}/ws/${tableId}`", "`${baseWsUrl}/ws`")

with open('/workspace/frontend/src/services/api.ts', 'w') as f:
    f.write(content)
