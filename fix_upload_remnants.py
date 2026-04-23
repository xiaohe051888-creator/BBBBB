import re

# 1. ControlBar.tsx
with open('/workspace/frontend/src/components/upload/ControlBar.tsx', 'r') as f:
    content = f.read()

# remove the table selector section completely
content = re.sub(r'\{/\* 桌台选择 \*/\}[\s\S]*?</div>', '', content)
content = re.sub(r'<div style=\{\{\s*display: \'flex\',\s*alignItems: \'center\',\s*gap: 8,[\s\S]*?\{/\* 局数控制 \*/\}', '{/* 局数控制 */}', content)
content = re.sub(r'<div style=\{\{\s*display: \'flex\',\s*alignItems: \'center\',\s*gap: 8,[\s\S]*?</button>\s*\)\)\}\s*</div>', '', content)

with open('/workspace/frontend/src/components/upload/ControlBar.tsx', 'w') as f:
    f.write(content)

# 2. UploadArea.tsx
with open('/workspace/frontend/src/components/upload/UploadArea.tsx', 'r') as f:
    content = f.read()

content = content.replace("navigate(`/dashboard/${}`)", "navigate('/dashboard')")

with open('/workspace/frontend/src/components/upload/UploadArea.tsx', 'w') as f:
    f.write(content)

