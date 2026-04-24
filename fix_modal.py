import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

# Add Modal to imports
content = content.replace("import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Text, Platform } from 'react-native';", "import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Text, Platform, Modal } from 'react-native';")

# Replace absolute view with Modal
modal_old = """      {alertConfig.visible && (
        <View style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999}]}>"""

modal_new = """      <Modal transparent visible={alertConfig.visible} animationType="fade">
        <View style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center'}]}>"""

content = content.replace(modal_old, modal_new)

# Close Modal tag
content = content.replace("          </View>\n        </View>\n      )}\n    </SafeAreaView>", "          </View>\n        </View>\n      </Modal>\n    </SafeAreaView>")

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)
