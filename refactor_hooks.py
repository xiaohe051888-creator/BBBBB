import os
import glob
import re

hooks_dir = '/workspace/frontend/src/hooks'
files = glob.glob(os.path.join(hooks_dir, '*.ts'))

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    content = re.sub(r'tableId:\s*string\s*\|\s*undefined,?\s*', '', content)
    content = re.sub(r'tableId:\s*string,?\s*', '', content)
    
    # Specific fix for useWebSocket
    if 'useWebSocket' in f:
        content = re.sub(r'if \(!data\.table_id \|\| data\.table_id !== tableId\) return;\s*', '', content)
        content = re.sub(r'tableId', '', content)
        content = re.sub(r'\(,\s*', '(', content)
    
    # Specific fix for useQueries
    if 'useQueries' in f:
        content = re.sub(r'export const use([A-Za-z]+)Optimistically = \(\) => \{\n\s*const queryClient = useQueryClient\(\);\n\n\s*return \(\w*tableId: string,\s*(.*?)\) => \{', 
                         r'export const use\1Optimistically = () => {\n  const queryClient = useQueryClient();\n\n  return (\2) => {', content)
        content = re.sub(r'tableId\?', '', content)
        content = re.sub(r'tableId \?', 'true ?', content)
        content = re.sub(r'!!tableId && ', '', content)
        content = re.sub(r'if \(!tableId\) return.*?\n', '', content)
        content = re.sub(r'queryKeys\.([a-zA-Z]+)\(tableId,?\s*', r'queryKeys.\1(', content)
        content = re.sub(r'queryKeys\.([a-zA-Z]+)\(\)', r'queryKeys.\1()', content)
        content = re.sub(r'\s*tableId,?', '', content)
        
    with open(f, 'w') as file:
        file.write(content)

