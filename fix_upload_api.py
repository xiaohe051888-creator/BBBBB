import re

with open('/workspace/frontend/src/services/api.ts', 'r') as f:
    content = f.read()

content = content.replace("bootNumber?: number,", "isNewBoot?: boolean,")
content = content.replace("boot_number: bootNumber,", "is_new_boot: isNewBoot,")

with open('/workspace/frontend/src/services/api.ts', 'w') as f:
    f.write(content)
