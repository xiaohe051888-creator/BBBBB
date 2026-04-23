import glob
import re

for filepath in glob.glob('/workspace/frontend/src/pages/*.tsx'):
    with open(filepath, 'r') as f:
        content = f.read()
    content = re.sub(r'const\s*\{\}\s*=\s*useParams<\{\}>\(\);', '', content)
    with open(filepath, 'w') as f:
        f.write(content)

with open('/workspace/frontend/src/hooks/useQueries.ts', 'r') as f:
    content = f.read()
content = re.sub(r'onSuccess:\s*\(_,\s*variables\)\s*=>\s*\{', 'onSuccess: () => {', content)
with open('/workspace/frontend/src/hooks/useQueries.ts', 'w') as f:
    f.write(content)

with open('/workspace/frontend/src/components/dashboard/DashboardHeader.tsx', 'r') as f:
    content = f.read()
content = re.sub(r'\s*TargetIcon,', '', content)
content = re.sub(r'\s*bettingAdvice,', '', content)
content = re.sub(r'const\s*\[adviceModalOpen,\s*setAdviceModalOpen\]\s*=\s*useState\(false\);', '', content)
content = re.sub(r'catch\s*\(e:\s*any\)', 'catch (e: unknown)', content)
with open('/workspace/frontend/src/components/dashboard/DashboardHeader.tsx', 'w') as f:
    f.write(content)

with open('/workspace/frontend/src/hooks/useSmartDetection.ts', 'r') as f:
    content = f.read()
content = re.sub(r'//\s*eslint-disable-next-line\s*@typescript-eslint/no-unused-vars\n', '', content)
with open('/workspace/frontend/src/hooks/useSmartDetection.ts', 'w') as f:
    f.write(content)

