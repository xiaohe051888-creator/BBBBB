with open('/workspace/mobile/App.js', 'r') as f:
    content = f.read()

# remove LoadSkiaWeb from App.js to avoid conflict
content = content.replace('// @ts-ignore\nimport { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";\n\n// Initialize Skia on Web\nif (typeof window !== \'undefined\') {\n  LoadSkiaWeb({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/full/${file}` });\n}\n\n', '')

with open('/workspace/mobile/App.js', 'w') as f:
    f.write(content)
