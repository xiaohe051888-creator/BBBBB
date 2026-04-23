with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'r') as f:
    content = f.read()

content = content.replace("import type { HealthScoreResponse, GameRecord } from '../services/api';", "import type { HealthScoreResponse } from '../services/api';\nimport type { GameRecord } from '../hooks/useGameState';")

with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'w') as f:
    f.write(content)
