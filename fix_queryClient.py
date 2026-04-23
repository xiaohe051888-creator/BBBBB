import re

with open('/workspace/frontend/src/lib/queryClient.ts', 'r') as f:
    content = f.read()

content = re.sub(r'\(tableId: string\)', '()', content)
content = re.sub(r'\(tableId: string,\s*(.*?)\)', r'(\1)', content)
content = re.sub(r"\['([a-zA-Z]+)', tableId\]", r"['\1']", content)
content = re.sub(r"\['([a-zA-Z]+)', tableId,\s*(.*?)\]", r"['\1', \2]", content)

with open('/workspace/frontend/src/lib/queryClient.ts', 'w') as f:
    f.write(content)
