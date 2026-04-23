import glob
import os
import re

for filepath in glob.glob('/workspace/frontend/src/pages/*.tsx'):
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove `{ tableId }` or `{ tableId: 'something' }`
    content = re.sub(r'\{\s*tableId[^{}]*\}', '{}', content)
    # Remove `tableId: xxx,` from objects
    content = re.sub(r'tableId\s*:\s*[^,]+,\s*', '', content)
    content = re.sub(r',\s*tableId\s*:\s*[^}]+', '', content)
    
    # In api.getHealthScore(tableId) -> api.getHealthScore()
    content = re.sub(r'api\.([a-zA-Z0-9_]+)\(tableId(?:,\s*)?', r'api.\1(', content)

    # In DashboardPage.tsx
    content = re.sub(r'tableId=\{tableId\s*\|\|\s*\'\'\}', '', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
        
for filepath in glob.glob('/workspace/frontend/src/hooks/*.ts'):
    with open(filepath, 'r') as f:
        content = f.read()
    content = re.sub(r'\[\s*tableId\s*,', '[', content)
    content = re.sub(r',\s*tableId\s*\]', ']', content)
    content = re.sub(r'\[\s*tableId\s*\]', '[]', content)
    content = re.sub(r'tableId\s*,\s*', '', content)
    with open(filepath, 'w') as f:
        f.write(content)

