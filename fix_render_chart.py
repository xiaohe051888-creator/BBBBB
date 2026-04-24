import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'const RenderChart = \(\) => \{.*?\};\n\n', '', content, flags=re.DOTALL)
content = content.replace("<RenderChart />", "<FiveRoadsChart />")

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)
