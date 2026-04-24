import re

with open('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx', 'r') as f:
    content = f.read()

# Replace useImperativeHandle with manual assignment
fixed = """  // Expose present/dismiss to the ref for Web Modal fallback
  if (Platform.OS === 'web' && bottomSheetModalRef) {
    (bottomSheetModalRef as any).current = {
      present: () => setWebVisible(true),
      dismiss: () => setWebVisible(false)
    };
  }
"""

content = re.sub(r'  // Expose present/dismiss to the ref for Web Modal fallback.*?  \}\)\);', fixed, content, flags=re.DOTALL)

with open('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx', 'w') as f:
    f.write(content)
