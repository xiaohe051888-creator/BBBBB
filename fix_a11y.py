import re

def add_a11y(path):
    with open(path, 'r') as f:
        content = f.read()
    
    content = re.sub(r'<TouchableOpacity([^>]*)>', r'<TouchableOpacity accessibilityRole="button"\1>', content)
    
    with open(path, 'w') as f:
        f.write(content)

add_a11y('/workspace/mobile/src/screens/DashboardScreen.tsx')
add_a11y('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx')
add_a11y('/workspace/mobile/src/components/dashboard/RevealBottomSheet.tsx')
