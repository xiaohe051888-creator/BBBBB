import re

def fix(path):
    with open(path, 'r') as f:
        content = f.read()
    
    content = content.replace("{/* @ts-ignore */}\n", "")
    content = content.replace("<FlashList", "<FastList")
    content = content.replace("</FlashList>", "</FastList>")
    content = content.replace("import { FlashList } from '@shopify/flash-list';", "import { FlashList } from '@shopify/flash-list';\nconst FastList: any = FlashList;")
    
    with open(path, 'w') as f:
        f.write(content)

fix('/workspace/mobile/src/screens/RecordsScreen.tsx')
fix('/workspace/mobile/src/screens/MistakesScreen.tsx')
