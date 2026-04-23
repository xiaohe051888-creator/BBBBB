import re

with open('/workspace/frontend/src/pages/UploadPage.tsx', 'r') as f:
    content = f.read()

# add useLocation import
content = content.replace("import { useNavigate } from 'react-router-dom';", "import { useNavigate, useLocation } from 'react-router-dom';")

# read location state
content = content.replace("const navigate = useNavigate();", "const navigate = useNavigate();\n  const location = useLocation();\n  const isNewBoot = location.state?.isNewBoot || false;")

# remove old bootNumber state
content = re.sub(r'const\s*\[bootNumber\]\s*=\s*useState<number\s*\|\s*undefined>\(undefined\);\n', '', content)

# pass isNewBoot
content = content.replace("api.uploadGameResults(validGames as any, bootNumber)", "api.uploadGameResults(validGames as any, isNewBoot)")

# add visual hint
content = content.replace("<Title level={3} style={{ margin: 0 }}>", "<Title level={3} style={{ margin: 0 }}>\n            {isNewBoot ? '录入新靴数据' : '上传覆盖本靴数据'}")

with open('/workspace/frontend/src/pages/UploadPage.tsx', 'w') as f:
    f.write(content)

