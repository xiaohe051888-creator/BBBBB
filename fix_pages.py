import os
import glob
import re

# Fix useGameState.ts and useSmartDetection.ts
def fix_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Remove tableId from objects and arrays
    content = re.sub(r'tableId\s*:\s*[^,]+,?\s*', '', content)
    content = re.sub(r'tableId\s*,?\s*', '', content)
    content = re.sub(r'table_id:\s*tableId,\s*', '', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

fix_file('/workspace/frontend/src/hooks/useGameState.ts')
fix_file('/workspace/frontend/src/hooks/useSmartDetection.ts')

pages_dir = '/workspace/frontend/src/pages'
for filepath in glob.glob(os.path.join(pages_dir, '*.tsx')):
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove tableId parameter from hooks
    content = re.sub(r'tableId:\s*tableId\s*,?\s*', '', content)
    content = re.sub(r'tableId\s*,?\s*(?=\})', '', content)
    content = re.sub(r'\{\s*tableId[^{}]*\}', '{}', content)
    content = re.sub(r'tableId\s*=\s*[\'"][^\'"]*[\'"]\s*,?\s*', '', content)
    
    # Fix queryClient.invalidateQueries({ queryKey: queryKeys.xxx(tableId) })
    content = re.sub(r'queryKeys\.([a-zA-Z0-9_]+)\(tableId(?:,\s*)?', r'queryKeys.\1(', content)
    
    # Fix api calls
    content = re.sub(r'api\.([a-zA-Z0-9_]+)\(tableId(?:,\s*)?', r'api.\1(', content)

    # Fix addLogOptimistically(tableId, ...) -> addLogOptimistically(...)
    content = re.sub(r'addLogOptimistically\(tableId,\s*', 'addLogOptimistically(', content)
    content = re.sub(r'addBetOptimistically\(tableId,\s*', 'addBetOptimistically(', content)
    content = re.sub(r'updateBetOptimistically\(tableId,\s*', 'updateBetOptimistically(', content)
    content = re.sub(r'addGameOptimistically\(tableId,\s*', 'addGameOptimistically(', content)
    content = re.sub(r'updateRoadsOptimistically\(tableId,\s*', 'updateRoadsOptimistically(', content)
    content = re.sub(r'updateStateOptimistically\(tableId,\s*', 'updateStateOptimistically(', content)
    content = re.sub(r'updateAnalysisOptimistically\(tableId,\s*', 'updateAnalysisOptimistically(', content)

    # Fix usePlaceBetMutation calls
    content = re.sub(r'tableId:\s*tableId\s*,\s*direction', 'direction', content)
    content = re.sub(r'tableId:\s*tableId\s*,\s*result', 'result', content)

    # Fix useSystemDiagnostics calls
    content = re.sub(r'useSystemDiagnostics\(\{.*?\}\)', 'useSystemDiagnostics({})', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

