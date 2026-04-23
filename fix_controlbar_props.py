import re

with open('/workspace/frontend/src/components/upload/ControlBar.tsx', 'r') as f:
    content = f.read()

content = re.sub(r"interface ControlBarProps \{: '19' \| '20' \| '21' \| '22';", "interface ControlBarProps {", content)

with open('/workspace/frontend/src/components/upload/ControlBar.tsx', 'w') as f:
    f.write(content)
