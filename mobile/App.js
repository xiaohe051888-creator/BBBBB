import "react-native-gesture-handler";
import "react-native-reanimated";
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AppNavigator from './src/navigation/AppNavigator';

const queryClient = new QueryClient();

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
