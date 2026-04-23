import re

with open('/workspace/frontend/src/components/dashboard/WorkflowStatusBar.tsx', 'r') as f:
    content = f.read()

content = content.replace("{hasPendingBet && (", "{(hasGameData && systemState?.status !== '分析中' && systemState?.status !== '深度学习中') && (")
content = content.replace("{waitSeconds >= 0 && (", "{hasPendingBet && waitSeconds >= 0 && (")

with open('/workspace/frontend/src/components/dashboard/WorkflowStatusBar.tsx', 'w') as f:
    f.write(content)
