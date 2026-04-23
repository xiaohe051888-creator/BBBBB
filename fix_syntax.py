with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if i in [40, 41, 42, 43, 44]:
        if line.strip() == "}":
            continue
    new_lines.append(line)

with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'w') as f:
    f.writelines(new_lines)
