import os
import glob
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Safely remove `tableId?: string;` and `tableId: string | undefined;` from interfaces
    content = re.sub(r'^\s*tableId\??\s*:\s*string\s*\|\s*undefined;\n', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s*tableId\??\s*:\s*string;\n', '', content, flags=re.MULTILINE)

    # Safely remove tableId from options destructuring
    # e.g. const { tableId, ... } = options; -> const { ... } = options;
    content = re.sub(r'\{\s*tableId\s*,\s*', '{ ', content)
    content = re.sub(r',\s*tableId\s*(?=\})', ' ', content)
    
    # In useQueries.ts, table_id: tableId,
    content = re.sub(r'^\s*table_id:\s*tableId,\n', '', content, flags=re.MULTILINE)

    # In useQueries.ts, tableId ? queryKeys.systemState(tableId) : ['systemState', '']
    content = re.sub(r'tableId\s*\?\s*queryKeys\.([a-zA-Z0-9_]+)\(tableId(?:,\s*([^)]+))?\)\s*:\s*\[[^\]]+\]', 
                     lambda m: f"queryKeys.{m.group(1)}({m.group(2) if m.group(2) else ''})", content)
                     
    # Remove if (!tableId) return ...
    content = re.sub(r'^\s*if\s*\(\!tableId\)\s*return.*?\n', '', content, flags=re.MULTILINE)
    
    # Remove !!tableId && enabled -> enabled
    content = content.replace('!!tableId && enabled', 'enabled')

    # api calls without tableId
    content = re.sub(r'api\.([a-zA-Z0-9_]+)\(tableId(?:,\s*)?', r'api.\1(', content)
    content = re.sub(r'api\.([a-zA-Z0-9_]+)\(params\.tableId(?:,\s*)?', r'api.\1(', content)
    
    # queryKeys calls without tableId
    content = re.sub(r'queryKeys\.([a-zA-Z0-9_]+)\(tableId(?:,\s*)?', r'queryKeys.\1(', content)
    content = re.sub(r'queryKeys\.([a-zA-Z0-9_]+)\(variables\.tableId(?:,\s*)?', r'queryKeys.\1(', content)

    # update function definitions
    content = re.sub(r'\(tableId:\s*string,\s*', '(', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

hooks_dir = '/workspace/frontend/src/hooks'
for filepath in glob.glob(os.path.join(hooks_dir, '*.ts')):
    process_file(filepath)

