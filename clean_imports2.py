import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

# remove duplicates
content = re.sub(r"import RevealBottomSheet from '\.\./components/dashboard/RevealBottomSheet';\nimport UploadBottomSheet from '\.\./components/dashboard/UploadBottomSheet';\n\nimport \{ useGameState \} from '\.\./hooks/useGameState';\nimport \{ useRevealResultMutation, useUploadGamesMutation, useEndBootMutation \} from '\.\./hooks/useQueries';\nimport \{ useWebSocket \} from '\.\./hooks/useWebSocket';", "", content, count=1)

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)
