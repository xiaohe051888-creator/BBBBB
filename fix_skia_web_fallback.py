import re

with open('/workspace/mobile/src/components/roads/FiveRoadsChart.tsx', 'r') as f:
    content = f.read()

# Add Platform import if missing
if "import { Platform" not in content:
    content = content.replace("import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';", "import { View, Text, StyleSheet, ScrollView, Dimensions, Platform } from 'react-native';")

# Add fallback inside FiveRoadsChart
fallback = """export const FiveRoadsChart: React.FC = () => {
  const { games } = useGameState();
  
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyTitle}>📱 原生走势图引擎</Text>
        <Text style={styles.emptySubtitle}>五路走势图使用了原生的高性能 Skia 引擎。</Text>
        <Text style={styles.emptySubtitle}>为了获得最佳的千局丝滑滑动体验，请在手机上使用 Expo Go 扫码预览原生 App。</Text>
      </View>
    );
  }
"""

content = re.sub(r'export const FiveRoadsChart: React\.FC = \(\) => \{\n  const \{ games \} = useGameState\(\);', fallback, content)

with open('/workspace/mobile/src/components/roads/FiveRoadsChart.tsx', 'w') as f:
    f.write(content)
