with open('/workspace/mobile/src/components/dashboard/RevealBottomSheet.tsx', 'r') as f:
    content = f.read()

content = content.replace('\n\n  container: {', '\n\nconst styles = StyleSheet.create({\n  container: {')
with open('/workspace/mobile/src/components/dashboard/RevealBottomSheet.tsx', 'w') as f:
    f.write(content)

with open('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx', 'r') as f:
    content = f.read()

content = content.replace('\n\n  container: {', '\n\nconst styles = StyleSheet.create({\n  container: {')
with open('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx', 'w') as f:
    f.write(content)

