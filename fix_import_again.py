with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

if "import { FiveRoadsChart }" not in content:
    content = content.replace("import { WorkflowStatusBar } from '../components/dashboard/WorkflowStatusBar';", "import { WorkflowStatusBar } from '../components/dashboard/WorkflowStatusBar';\nimport { FiveRoadsChart } from '../components/roads/FiveRoadsChart';")
    
with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)
