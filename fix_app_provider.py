with open('/workspace/mobile/App.js', 'r') as f:
    content = f.read()

fixed = """
import { Platform } from 'react-native';
const Provider = Platform.OS === 'web' ? React.Fragment : BottomSheetModalProvider;

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <AppNavigator />
          <StatusBar style="light" />
        </Provider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
"""

import re
content = re.sub(r'export default function App\(\) \{.*?\n\}', fixed.strip(), content, flags=re.DOTALL)

with open('/workspace/mobile/App.js', 'w') as f:
    f.write(content)
