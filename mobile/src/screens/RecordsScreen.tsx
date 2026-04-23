import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FastList: any = FlashList;
import { useBetsQuery, useLogsQuery } from '../hooks/useQueries';

export default function RecordsScreen() {
  const [tab, setTab] = useState<'bets' | 'logs'>('bets');
  const { data: betsData, isLoading: betsLoading, refetch: refetchBets, isRefetching: isRefetchingBets } = useBetsQuery({ page: 1, pageSize: 100 });
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs, isRefetching: isRefetchingLogs } = useLogsQuery({ page: 1, pageSize: 100 });

  const renderBet = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.gameNumber}>第 {item.game_number} 局</Text>
        <Text style={[styles.status, item.status === '已结算' ? styles.statusSettled : styles.statusPending]}>
          {item.status}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.betInfo}>
          下注 <Text style={item.bet_direction === '庄' ? styles.banker : styles.player}>{item.bet_direction}</Text> : {item.bet_amount}
        </Text>
        {item.status === '已结算' && (
          <Text style={styles.resultInfo}>
            开奖: <Text style={item.game_result === '庄' ? styles.banker : item.game_result === '闲' ? styles.player : styles.tie}>{item.game_result}</Text>
            {'  '}盈亏: <Text style={item.profit_loss > 0 ? styles.profit : styles.loss}>{item.profit_loss > 0 ? '+' : ''}{item.profit_loss}</Text>
          </Text>
        )}
      </View>
    </View>
  );

  const renderLog = ({ item }: { item: any }) => (
    <View style={styles.logItem}>
      <Text style={styles.logTime}>{new Date(item.created_at).toLocaleTimeString()}</Text>
      <Text style={styles.logCategory}>[{item.category}]</Text>
      <Text style={styles.logDesc}>{item.description}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>系统记录</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, tab === 'bets' && styles.activeTab]} onPress={() => setTab('bets')}>
          <Text style={[styles.tabText, tab === 'bets' && styles.activeTabText]}>历史注单</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'logs' && styles.activeTab]} onPress={() => setTab('logs')}>
          <Text style={[styles.tabText, tab === 'logs' && styles.activeTabText]}>系统日志</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        {tab === 'bets' ? (
          <FastList
            data={betsData?.bets || []}
            renderItem={renderBet}
            estimatedItemSize={100}
            keyExtractor={(item: any) => item.id.toString()}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={<RefreshControl refreshing={isRefetchingBets} onRefresh={refetchBets} tintColor="#ffd700" />}
          />
        ) : (
          <FastList
            data={logsData?.logs || []}
            renderItem={renderLog}
            estimatedItemSize={60}
            keyExtractor={(item: any) => item.id.toString()}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={<RefreshControl refreshing={isRefetchingLogs} onRefresh={refetchLogs} tintColor="#ffd700" />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: { padding: 16, backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#30363d' },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#161b22', paddingHorizontal: 16, paddingBottom: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#ffd700' },
  tabText: { color: '#8b949e', fontSize: 16, fontWeight: '600' },
  activeTabText: { color: '#ffd700' },
  listContainer: { flex: 1 },
  
  card: { backgroundColor: '#161b22', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#30363d' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  gameNumber: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  status: { fontSize: 14, fontWeight: 'bold' },
  statusPending: { color: '#faad14' },
  statusSettled: { color: '#52c41a' },
  cardBody: { gap: 8 },
  betInfo: { color: '#c9d1d9', fontSize: 15 },
  resultInfo: { color: '#c9d1d9', fontSize: 15 },
  banker: { color: '#ff4d4f', fontWeight: 'bold' },
  player: { color: '#1890ff', fontWeight: 'bold' },
  tie: { color: '#52c41a', fontWeight: 'bold' },
  profit: { color: '#ff4d4f', fontWeight: 'bold' },
  loss: { color: '#52c41a', fontWeight: 'bold' },

  logItem: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#30363d', gap: 8 },
  logTime: { color: '#8b949e', fontSize: 12, width: 70 },
  logCategory: { color: '#58a6ff', fontSize: 13, width: 70 },
  logDesc: { color: '#c9d1d9', fontSize: 14, flex: 1 },
});
