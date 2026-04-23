import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { WorkflowStatusBar } from '../components/dashboard/WorkflowStatusBar';
import { FiveRoadsChart } from '../components/roads/FiveRoadsChart';

export default function DashboardScreen() {
  // 模拟一些状态，实际应用中可以从 useGameState hook 获取
  const [hasGameData, setHasGameData] = useState(true);
  const [hasPendingBet, setHasPendingBet] = useState(false);
  const [systemState, setSystemState] = useState({
    status: '就绪',
    game_number: 1,
    next_game_number: 2,
    pending_bet: null,
  });
  
  const handleOpenReveal = () => {
    Alert.alert('开奖', '弹出开奖输入框');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <WorkflowStatusBar
          hasPendingBet={hasPendingBet}
          hasGameData={hasGameData}
          analysis={null}
          systemState={systemState}
          onOpenReveal={handleOpenReveal}
        />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <FiveRoadsChart />
          {/* 其他组件可以放在这里 */}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
});
