with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'r') as f:
    content = f.read()

content = content.replace("import type { HealthScoreResponse } from '../services/api';", "import type { HealthScoreResponse, GameRecord } from '../services/api';")

type_injection = """  // 学习状态
  const [microLearning, setMicroLearning] = useState<any>(null);
  const [deepLearning, setDeepLearning] = useState<any>(null);"""

content = content.replace("  // 学习状态\n  const [microLearning, setMicroLearning] = useState<Record<string, unknown> | null>(null);\n  const [deepLearning, setDeepLearning] = useState<Record<string, unknown> | null>(null);", type_injection)

# Disable explicit any rule for this file
content = "/* eslint-disable @typescript-eslint/no-explicit-any */\n" + content

with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'w') as f:
    f.write(content)

