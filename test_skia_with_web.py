import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

# I will use a simple state to wait for Skia
fix_skia = """import React, { useRef, useState, Suspense, lazy, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Text, Platform } from 'react-native';
import { SafeAreaView } from "react-native";
import { BottomSheetModal } from '@gorhom/bottom-sheet';

import { WorkflowStatusBar } from '../components/dashboard/WorkflowStatusBar';
import RevealBottomSheet from '../components/dashboard/RevealBottomSheet';
import UploadBottomSheet from '../components/dashboard/UploadBottomSheet';

import { useGameState } from '../hooks/useGameState';
import { useRevealResultMutation, useUploadGamesMutation, useEndBootMutation } from '../hooks/useQueries';
import { useWebSocket } from '../hooks/useWebSocket';

// Lazy load Skia components
const LazyFiveRoadsChart = lazy(() => import('../components/roads/FiveRoadsChart').then(m => ({ default: m.FiveRoadsChart })));

const RenderChart = () => {
  const [skiaLoaded, setSkiaLoaded] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      // @ts-ignore
      import('@shopify/react-native-skia/lib/module/web').then(async ({ LoadSkiaWeb }) => {
        await LoadSkiaWeb({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/full/${file}` });
        setSkiaLoaded(true);
      }).catch(console.error);
    }
  }, []);

  if (!skiaLoaded) {
    return (
      <View style={{height: 200, justifyContent: 'center', alignItems: 'center'}}>
        <Text style={{color: '#8b949e'}}>Loading Skia Engine...</Text>
      </View>
    );
  }

  return (
    <Suspense fallback={<View style={{height: 200, justifyContent: 'center', alignItems: 'center'}}><Text style={{color: '#8b949e'}}>Loading Chart...</Text></View>}>
      <LazyFiveRoadsChart />
    </Suspense>
  );
};
"""

content = re.sub(r'import React, \{ useRef, useState, Suspense, lazy \} from \'react\';\n.*?const RenderChart = \(\) => \{.*?\};\n', fix_skia, content, flags=re.DOTALL)

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)
