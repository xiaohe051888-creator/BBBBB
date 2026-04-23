import os
import glob
import re

def fix_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r') as f:
        content = f.read()

    # remove tableId props
    content = re.sub(r'tableId\??\s*:\s*string\s*\|\s*undefined;', '', content)
    content = re.sub(r'tableId\??\s*:\s*string;', '', content)
    content = re.sub(r'table_id\??\s*:\s*string;', '', content)
    
    # remove from destructuring
    content = re.sub(r',\s*tableId\s*(?=\})', ' ', content)
    content = re.sub(r'\{\s*tableId\s*,', '{ ', content)
    content = re.sub(r'void\s*tableId;', '', content)
    
    # fix MistakeBookPage.tsx
    content = re.sub(r'<Descriptions\.Item label="桌号">\{selectedMistake\.table_id\}</Descriptions\.Item>', '', content)
    content = re.sub(r"\{\s*title:\s*'桌号',\s*dataIndex:\s*'table_id',\s*width:\s*'8%',\s*align:\s*'center'\s*as\s*const\s*\},", "", content)

    # fix api.ts
    content = re.sub(r'// 如果环境变量已包含完整路径，使用它；否则拼接 table_id', '', content)
    
    # fix useQueries.ts
    content = re.sub(r'table_id:\s*item\.table_id\s*as\s*string,', '', content)
    
    # fix constants.ts
    content = re.sub(r'uploadComplete:\s*\([^)]*\)\s*=>.*?,', '', content)

    with open(filepath, 'w') as f:
        f.write(content)

files_to_fix = [
    '/workspace/frontend/src/components/dashboard/TopStatusBar.tsx',
    '/workspace/frontend/src/components/dashboard/RightPanel.tsx',
    '/workspace/frontend/src/components/LearningStatusPanel.tsx',
    '/workspace/frontend/src/utils/constants.ts',
    '/workspace/frontend/src/hooks/useGameState.ts',
    '/workspace/frontend/src/hooks/useQueries.ts',
    '/workspace/frontend/src/hooks/useWebSocket.ts',
    '/workspace/frontend/src/services/api.ts',
    '/workspace/frontend/src/pages/MistakeBookPage.tsx',
    '/workspace/frontend/src/pages/AdminPage.tsx',
]

for f in files_to_fix:
    fix_file(f)

