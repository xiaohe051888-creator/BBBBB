import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';", "import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Text, Platform } from 'react-native';")

end_boot_logic = """  const handleEndBoot = () => {
    console.log('End boot clicked');
    if (Platform.OS === 'web') {
      if (window.confirm('确定要结束本靴并开始深度学习吗？')) {
        endBootMutation.mutateAsync().then(() => {
          window.alert('本靴已结束，进入深度学习');
          uploadSheetRef.current?.present();
        }).catch((e: any) => window.alert(e.message));
      }
      return;
    }

    Alert.alert(
      '结束本靴',
      '确定要结束本靴并开始深度学习吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定', 
          style: 'destructive',
          onPress: async () => {
            try {
              await endBootMutation.mutateAsync();
              Alert.alert('成功', '本靴已结束，进入深度学习');
              uploadSheetRef.current?.present(); // Prompt to upload new data
            } catch (e: any) {
              Alert.alert('错误', e.message);
            }
          }
        }
      ]
    );
  };"""

content = re.sub(r'  const handleEndBoot = \(\) => \{.*?\}\n      \]\n    \);\n  \};', end_boot_logic, content, flags=re.DOTALL)

# Add console.log to handleOpenUpload
content = content.replace("  const handleOpenUpload = () => {\n    uploadSheetRef.current?.present();\n  };", "  const handleOpenUpload = () => {\n    console.log('Upload clicked', uploadSheetRef.current);\n    uploadSheetRef.current?.present();\n  };")

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)
