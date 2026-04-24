import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

# remove the lazy RenderChart entirely
content = re.sub(r'const LazyFiveRoadsChart = lazy\(\(\) => import\(\'\.\./components/roads/FiveRoadsChart\'\)\.then\(m => \(\{ default: m\.FiveRoadsChart \}\)\)\);\n\nconst RenderChart = \(\) => \{.*?  \);\n\};\n\n', '', content, flags=re.DOTALL)

# replace RenderChart with FiveRoadsChart
content = content.replace("<RenderChart />", "<FiveRoadsChart />")

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)
