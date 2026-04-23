import os
import glob
import re

def fix_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Remove tableId from interfaces
    content = re.sub(r'^\s*tableId\??\s*:\s*string;\n', '', content, flags=re.MULTILINE)
    
    # Remove tableId from destructured props
    content = re.sub(r'\{\s*tableId\s*,?\s*', '{ ', content)
    content = re.sub(r',\s*tableId\s*(?=\})', ' ', content)
    
    # Remove tableId from api calls
    content = re.sub(r'api\.([a-zA-Z0-9_]+)\(tableId(?:,\s*)?', r'api.\1(', content)

    # Remove UI text references to tableId
    content = re.sub(r'<strong[^>]*>\{tableId\}桌</strong>\s*·\s*', '', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

fix_file('/workspace/frontend/src/components/dashboard/DashboardHeader.tsx')
fix_file('/workspace/frontend/src/components/dashboard/AnalysisPanel.tsx')
fix_file('/workspace/frontend/src/components/learning/LearningStatusPanel.tsx')
