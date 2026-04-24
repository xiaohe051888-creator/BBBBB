import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

# Make it conditional
content = content.replace("<Modal transparent visible={alertConfig.visible} animationType=\"fade\">", "{alertConfig.visible && (<Modal transparent visible={alertConfig.visible} animationType=\"fade\">")
content = content.replace("          </View>\n        </View>\n      </Modal>", "          </View>\n        </View>\n      </Modal>)}")

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)
