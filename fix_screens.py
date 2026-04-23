import re

def fix_records():
    with open('/workspace/mobile/src/screens/RecordsScreen.tsx', 'r') as f:
        content = f.read()
    
    content = content.replace("limit: 100", "pageSize: 100")
    content = content.replace("betsData?.items", "betsData?.bets")
    content = content.replace("logsData?.items", "logsData?.logs")
    
    with open('/workspace/mobile/src/screens/RecordsScreen.tsx', 'w') as f:
        f.write(content)

def fix_mistakes():
    with open('/workspace/mobile/src/screens/MistakesScreen.tsx', 'r') as f:
        content = f.read()
    
    content = content.replace("limit: 100", "pageSize: 100")
    content = content.replace("data?.items", "data?.mistakes")
    
    with open('/workspace/mobile/src/screens/MistakesScreen.tsx', 'w') as f:
        f.write(content)

fix_records()
fix_mistakes()
