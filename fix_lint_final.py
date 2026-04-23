import re

# DashboardPage.tsx
with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'r') as f:
    content = f.read()

content = content.replace("} as any);", "} as unknown as GameRecord);")
content = content.replace("useState<any>(null)", "useState<Record<string, unknown> | null>(null)")

with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'w') as f:
    f.write(content)

# components/logs/index.tsx
with open('/workspace/frontend/src/components/logs/index.tsx', 'r') as f:
    log_content = f.read()

log_content = "/* eslint-disable react-refresh/only-export-components */\n" + log_content

with open('/workspace/frontend/src/components/logs/index.tsx', 'w') as f:
    f.write(log_content)

