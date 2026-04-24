import re

def fix(path):
    with open(path, 'r') as f:
        content = f.read()

    # Add enablePanDownToClose={true} to BottomSheetModal
    content = content.replace("handleIndicatorStyle={styles.indicator}", "handleIndicatorStyle={styles.indicator}\n      enablePanDownToClose={true}")

    with open(path, 'w') as f:
        f.write(content)

fix('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx')
fix('/workspace/mobile/src/components/dashboard/RevealBottomSheet.tsx')

