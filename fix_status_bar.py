import re

with open('/workspace/frontend/src/components/dashboard/WorkflowStatusBar.tsx', 'r') as f:
    content = f.read()

content = content.replace("    status?: string;\n    next_game_number?: number;", "    next_game_number?: number;")

with open('/workspace/frontend/src/components/dashboard/WorkflowStatusBar.tsx', 'w') as f:
    f.write(content)
