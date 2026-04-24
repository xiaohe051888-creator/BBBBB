import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

# Add proper import
content = content.replace("import { useGameState }", "import { FiveRoadsChart } from '../components/roads/FiveRoadsChart';\nimport { useGameState }")

# Remove lazy stuff
content = re.sub(r'const LazyFiveRoadsChart = lazy\(.*?;\n', '', content)
content = re.sub(r'<LazyFiveRoadsChart />', '', content)

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)

