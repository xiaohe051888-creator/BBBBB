import re

with open('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx', 'r') as f:
    content = f.read()

content = content.replace('      <Modal transparent visible={webVisible} animationType="slide"> animationType="slide">', '      <Modal transparent visible={webVisible} animationType="slide">')

with open('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx', 'w') as f:
    f.write(content)

with open('/workspace/mobile/src/components/dashboard/RevealBottomSheet.tsx', 'r') as f:
    content = f.read()

content = content.replace('      <Modal transparent visible={webVisible} animationType="slide"> animationType="slide">', '      <Modal transparent visible={webVisible} animationType="slide">')

with open('/workspace/mobile/src/components/dashboard/RevealBottomSheet.tsx', 'w') as f:
    f.write(content)
