import glob
import re

for filepath in glob.glob('/workspace/frontend/src/pages/*.tsx'):
    with open(filepath, 'r') as f:
        content = f.read()
    content = re.sub(r'const\s*\{\s*\}\s*=\s*useParams<.*?>\(\);', '', content)
    content = re.sub(r'useParams,\s*', '', content)
    content = re.sub(r',\s*useParams', '', content)
    content = re.sub(r'useParams', '', content)
    with open(filepath, 'w') as f:
        f.write(content)

with open('/workspace/frontend/src/components/dashboard/DashboardHeader.tsx', 'r') as f:
    content = f.read()
content = re.sub(r'import\s*React,\s*\{\s*useState\s*\}\s*from\s*\'react\';', "import React from 'react';", content)
with open('/workspace/frontend/src/components/dashboard/DashboardHeader.tsx', 'w') as f:
    f.write(content)
