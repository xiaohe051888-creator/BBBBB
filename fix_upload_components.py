import re

# 1. ControlBar.tsx
with open('/workspace/frontend/src/components/upload/ControlBar.tsx', 'r') as f:
    content = f.read()

# remove tableId props
content = re.sub(r'\s*tableId\s*:\s*string;', '', content)
content = re.sub(r'\s*onTableIdChange\s*:\s*\([^)]*\)\s*=>\s*void;', '', content)
content = re.sub(r'\s*tableId,?', '', content)
content = re.sub(r'\s*onTableIdChange,?', '', content)

# Remove the Select block for table selection
# It looks something like:
# <Select value={tableId} onChange={onTableIdChange} ...>
# ...
# </Select>
content = re.sub(r'<Select\s+value=\{tableId\}[^>]*>[\s\S]*?</Select>', '', content)

with open('/workspace/frontend/src/components/upload/ControlBar.tsx', 'w') as f:
    f.write(content)

# 2. UploadArea.tsx
with open('/workspace/frontend/src/components/upload/UploadArea.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'\s*tableId\s*:\s*string;', '', content)
content = re.sub(r'\s*tableId,?', '', content)

with open('/workspace/frontend/src/components/upload/UploadArea.tsx', 'w') as f:
    f.write(content)

