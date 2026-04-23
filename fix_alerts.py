import os
import glob

def fix_alerts(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Replace Alert.alert with cross-platform alert logic
    if "Alert.alert(" in content and "Platform" not in content:
        content = "import { Platform } from 'react-native';\n" + content

    content = content.replace("Alert.alert('错误', e.message);", "Platform.OS === 'web' ? window.alert(`错误: ${e.message}`) : Alert.alert('错误', e.message);")
    content = content.replace("Alert.alert('成功', '上传成功');", "Platform.OS === 'web' ? window.alert('成功: 上传成功') : Alert.alert('成功', '上传成功');")
    content = content.replace("Alert.alert('开奖失败', e.message);", "Platform.OS === 'web' ? window.alert(`开奖失败: ${e.message}`) : Alert.alert('开奖失败', e.message);")

    with open(file_path, 'w') as f:
        f.write(content)

fix_alerts('/workspace/mobile/src/screens/DashboardScreen.tsx')
