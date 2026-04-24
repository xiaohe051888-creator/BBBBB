import re

with open('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx', 'r') as f:
    content = f.read()

# Add a close button
header_old = """        <View style={styles.header}>
          <Text style={styles.title}>快捷录入本靴数据</Text>
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearText}>清空</Text>
          </TouchableOpacity>
        </View>"""

header_new = """        <View style={styles.header}>
          <Text style={styles.title}>快捷录入本靴数据</Text>
          <View style={{flexDirection: 'row', gap: 16}}>
            <TouchableOpacity onPress={handleClear}>
              <Text style={styles.clearText}>清空</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity onPress={() => setWebVisible(false)}>
                <Text style={{color: '#ff4d4f', fontSize: 16}}>关闭</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>"""

content = content.replace(header_old, header_new)

with open('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx', 'w') as f:
    f.write(content)
