import os
import glob
import re

hooks_dir = '/workspace/frontend/src/hooks'

for filepath in glob.glob(os.path.join(hooks_dir, '*.ts')):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Remove tableId from interface properties
    content = re.sub(r'\s*tableId\??\s*:\s*string\s*\|\s*undefined;', '', content)
    content = re.sub(r'\s*tableId\??\s*:\s*string;', '', content)

    # 2. Remove tableId from destructuring options
    content = re.sub(r'\{\s*tableId\s*,\s*', '{ ', content)
    content = re.sub(r'\{\s*tableId\s*=\s*[^,]+,\s*', '{ ', content)
    content = re.sub(r',\s*tableId\s*(?=\})', ' ', content)
    content = re.sub(r'tableId\s*:\s*_[a-zA-Z0-9_]+,\s*', '', content)

    # 3. Remove if (!tableId) return; variants
    content = re.sub(r'if\s*\(!tableId\)\s*return(\s*null|\s*\{.*?\}|\s*\[\])?;\n?', '', content)
    content = re.sub(r'if\s*\(!tableId\s*\|\|\s*(!enabled|isUnmountedRef\.current)\)\s*return;', r'if (\1) return;', content)
    content = re.sub(r'if\s*\((!enabled|isUnmountedRef\.current)\s*\|\|\s*!tableId\)\s*return;', r'if (\1) return;', content)
    content = re.sub(r'if\s*\(!autoRefresh\s*\|\|\s*!tableId\)\s*return;', r'if (!autoRefresh) return;', content)

    # 4. Remove !!tableId && from enabled
    content = re.sub(r'!!tableId\s*&&\s*', '', content)

    # 5. Remove tableId ? ... : ... logic for queryKeys
    content = re.sub(r'tableId\s*\?\s*(queryKeys\.[a-zA-Z0-9_]+\([^)]*\))\s*:\s*\[.*?\]', r'\1', content)
    content = re.sub(r"tableId\s*\?\s*(\['mistakes',\s*[^\]]+\])\s*:\s*\[.*?\]", r'\1', content)

    # 6. Remove tableId parameter from api calls
    content = re.sub(r'api\.([a-zA-Z0-9_]+)\(tableId(?:,\s*)?', r'api.\1(', content)
    content = re.sub(r'api\.([a-zA-Z0-9_]+)\(params\.tableId(?:,\s*)?', r'api.\1(', content)

    # 7. Remove table_id from object literals
    content = re.sub(r'table_id:\s*tableId,?\n?', '', content)
    
    # 8. Remove tableId from queryKeys calls
    content = re.sub(r'queryKeys\.([a-zA-Z0-9_]+)\(tableId(?:,\s*)?', r'queryKeys.\1(', content)
    content = re.sub(r'queryKeys\.([a-zA-Z0-9_]+)\(variables\.tableId(?:,\s*)?', r'queryKeys.\1(', content)

    # 9. Fix custom mutation update functions
    content = re.sub(r'\(tableId:\s*string,\s*', '(', content)
    content = re.sub(r'\(tableId:\s*string\)', '()', content)
    
    # 10. Fix array dependencies
    content = re.sub(r'\[\s*tableId\s*,\s*', '[', content)
    content = re.sub(r',\s*tableId\s*(?=\])', '', content)
    content = re.sub(r'\[\s*tableId\s*\]', '[]', content)

    # 11. Fix useSystemDiagnostics calls
    content = re.sub(r'\{\s*tableId:\s*[^}]+\s*\}', '{}', content)

    # Fix mistakes queryKey
    content = re.sub(r"\['mistakes',\s*tableId,\s*([^\]]+)\]", r"['mistakes', \1]", content)

    with open(filepath, 'w') as f:
        f.write(content)

