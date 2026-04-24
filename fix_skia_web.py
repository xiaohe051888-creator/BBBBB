import re

with open('/workspace/mobile/App.js', 'r') as f:
    content = f.read()

skia_init = """import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Initialize Skia on Web
if (typeof window !== 'undefined') {
  LoadSkiaWeb({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/full/${file}` });
}
"""

if "LoadSkiaWeb" not in content:
    content = content.replace("import AppNavigator from './src/navigation/AppNavigator';", "import AppNavigator from './src/navigation/AppNavigator';\n" + skia_init)
    
    with open('/workspace/mobile/App.js', 'w') as f:
        f.write(content)
