import re

def fix(path):
    with open(path, 'r') as f:
        content = f.read()
    
    # remove bad ts-ignores
    content = content.replace('// @ts-ignore\n', '')
    
    # replace <FlashList with { /* @ts-ignore */ } <FlashList
    content = content.replace('<FlashList\n', '{/* @ts-ignore */}\n<FlashList\n')
    content = content.replace('<FlashList\r\n', '{/* @ts-ignore */}\n<FlashList\n')
    content = content.replace('          <FlashList\n', '          {/* @ts-ignore */}\n          <FlashList\n')
    content = content.replace('        <FlashList\n', '        {/* @ts-ignore */}\n        <FlashList\n')
    
    with open(path, 'w') as f:
        f.write(content)

fix('/workspace/mobile/src/screens/RecordsScreen.tsx')
fix('/workspace/mobile/src/screens/MistakesScreen.tsx')
