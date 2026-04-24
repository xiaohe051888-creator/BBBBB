with open('/workspace/backend/app/api/main.py', 'r') as f:
    content = f.read()

content = content.replace("    _: dict = Depends(get_current_user),", "    # _: dict = Depends(get_current_user),")

with open('/workspace/backend/app/api/main.py', 'w') as f:
    f.write(content)
