import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const FiveRoadsChart: React.FC = () => {
  return (
    <View style={[styles.container, styles.emptyContainer]}>
      <Text style={styles.emptyTitle}>📱 原生走势图引擎</Text>
      <Text style={styles.emptySubtitle}>五路走势图使用了原生的高性能 Skia 引擎。</Text>
      <Text style={styles.emptySubtitle}>为了获得千局丝滑滑动的电竞级体验，请使用手机 Expo Go 扫码预览原生 App。</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptySubtitle: {
    color: '#8b949e',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
});

export default FiveRoadsChart;
