import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

# Load Skia lazily to avoid CanvasKit is not defined errors on web startup
content = content.replace("import { FiveRoadsChart } from '../components/roads/FiveRoadsChart';", "import { Platform } from 'react-native';\nimport { FiveRoadsChart } from '../components/roads/FiveRoadsChart';")

skia_lazy = """import React, { Suspense, lazy } from 'react';
const LazyFiveRoadsChart = lazy(() => import('../components/roads/FiveRoadsChart').then(m => ({ default: m.FiveRoadsChart })));

const RenderChart = () => {
  if (Platform.OS === 'web') {
    return (
      <Suspense fallback={<View style={{height: 200, justifyContent: 'center', alignItems: 'center'}}><Text style={{color: '#8b949e'}}>Loading Skia Canvas...</Text></View>}>
        <LazyFiveRoadsChart />
      </Suspense>
    );
  }
  return <FiveRoadsChart />;
};"""

if "LazyFiveRoadsChart" not in content:
    content = content.replace("import { FiveRoadsChart } from '../components/roads/FiveRoadsChart';", "import { FiveRoadsChart } from '../components/roads/FiveRoadsChart';\n" + skia_lazy)
    content = content.replace("<FiveRoadsChart />", "<RenderChart />")

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)
