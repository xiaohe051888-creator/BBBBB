import glob
import re

for filepath in glob.glob('/workspace/frontend/src/pages/*.tsx'):
    with open(filepath, 'r') as f:
        content = f.read()
    
    content = re.sub(r'if\s*\(!tableId\)\s*return;\n', '', content)
    content = re.sub(r"queryClient\.invalidateQueries\(\{ queryKey: \['[a-zA-Z]+', tableId\] \}\);", 
                     lambda m: m.group(0).replace(", tableId", ""), content)
    content = re.sub(r"queryClient\.invalidateQueries\(\{ queryKey: \['[a-zA-Z]+', tableId, [^\]]+\] \}\);", 
                     lambda m: m.group(0).replace(", tableId", ""), content)
    content = re.sub(r"queryClient\.invalidateQueries\(\{ queryKey: queryKeys\.([a-zA-Z]+)\(tableId(?:,\s*([^)]+))?\)\s*\}\);",
                     lambda m: f"queryClient.invalidateQueries({{ queryKey: queryKeys.{m.group(1)}({m.group(2) if m.group(2) else ''}) }});", content)
                     
    with open(filepath, 'w') as f:
        f.write(content)
