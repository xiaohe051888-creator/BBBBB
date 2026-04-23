import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FastList: any = FlashList;
import { useMistakesQuery } from '../hooks/useQueries';

export default function MistakesScreen() {
  const { data, isLoading } = useMistakesQuery({ page: 1, pageSize: 100 });

  const renderMistake = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>第 {item.game_number} 局 - {item.error_type}</Text>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.prediction}>预测: <Text style={item.predict_direction === '庄' ? styles.banker : styles.player}>{item.predict_direction}</Text></Text>
        <Text style={styles.actual}>实际: <Text style={item.actual_result === '庄' ? styles.banker : styles.player}>{item.actual_result}</Text></Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>AI 错题本</Text>
      </View>
      
      <View style={styles.listContainer}>
                <FastList
          data={data?.mistakes || []}
          renderItem={renderMistake}
          estimatedItemSize={120}
          keyExtractor={(item: any) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  headerBar: { padding: 16, backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#30363d' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  listContainer: { flex: 1 },
  
  card: { backgroundColor: '#161b22', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#30363d' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  date: { color: '#8b949e', fontSize: 12 },
  body: { flexDirection: 'row', gap: 24 },
  prediction: { color: '#c9d1d9', fontSize: 16 },
  actual: { color: '#c9d1d9', fontSize: 16 },
  banker: { color: '#ff4d4f', fontWeight: 'bold' },
  player: { color: '#1890ff', fontWeight: 'bold' },
});
