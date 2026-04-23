import re

# Fix RecordsScreen
with open('/workspace/mobile/src/screens/RecordsScreen.tsx', 'r') as f:
    content = f.read()

# Fix the broken fastlist props
content = re.sub(r'contentContainerStyle=\{\{ padding: 16 \}\}\n.*?refreshControl.*?\/>\}=\{.*?tintColor="#ffd700" \/>\}', 
                 'contentContainerStyle={{ padding: 16 }}\n            refreshControl={<RefreshControl refreshing={isRefetchingBets} onRefresh={refetchBets} tintColor="#ffd700" />}', 
                 content, flags=re.DOTALL)

content = re.sub(r'contentContainerStyle=\{\{ padding: 16 \}\}\n.*?refreshControl={<RefreshControl refreshing=\{isRefetchingBets\} onRefresh=\{refetchBets\} tintColor="#ffd700" \/>}',
                 'contentContainerStyle={{ padding: 16 }}\n            refreshControl={<RefreshControl refreshing={isRefetchingLogs} onRefresh={refetchLogs} tintColor="#ffd700" />}',
                 content, count=1, flags=re.DOTALL) # Need to make sure we replace the right one... wait, let's just write a proper replacer.

with open('/workspace/mobile/src/screens/RecordsScreen.tsx', 'w') as f:
    f.write(content)
