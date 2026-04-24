import re

def fix(path):
    with open(path, 'r') as f:
        content = f.read()

    # if (Platform.OS === 'web') {
    #   return (
    #     <Modal transparent visible={webVisible} animationType="slide">
    
    fix_str = """  if (Platform.OS === 'web') {
    if (!webVisible) return null;
    return (
      <Modal transparent visible={webVisible} animationType="slide">"""

    content = re.sub(r"  if \(Platform\.OS === 'web'\) \{\n    return \(\n      <Modal transparent visible=\{webVisible\}", fix_str, content)

    with open(path, 'w') as f:
        f.write(content)

fix('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx')
fix('/workspace/mobile/src/components/dashboard/RevealBottomSheet.tsx')
