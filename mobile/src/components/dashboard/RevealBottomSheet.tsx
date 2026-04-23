import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';

interface Props {
  bottomSheetModalRef: React.RefObject<BottomSheetModal>;
  loading: boolean;
  gameNumber?: number;
  onReveal: (result: '庄' | '闲' | '和') => void;
}

export default function RevealBottomSheet({ bottomSheetModalRef, loading, gameNumber, onReveal }: Props) {
  const snapPoints = useMemo(() => ['35%'], []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.container}
      handleIndicatorStyle={styles.indicator}
    >
      <View style={styles.contentContainer}>
        <Text style={styles.title}>
          第 {gameNumber || '-'} 局开奖
        </Text>
        <Text style={styles.subtitle}>请选择实际开奖结果：</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#ffd700" style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.btn, styles.bankerBtn]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onReveal('庄'); }}>
              <Text style={styles.btnText}>庄赢 (B)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.playerBtn]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onReveal('闲'); }}>
              <Text style={styles.btnText}>闲赢 (P)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.tieBtn]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onReveal('和'); }}>
              <Text style={styles.btnText}>和局 (T)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#161b22', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  indicator: { backgroundColor: '#8b949e', width: 40 },
  contentContainer: { flex: 1, padding: 20, alignItems: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#8b949e', fontSize: 14, marginBottom: 24 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', gap: 12 },
  btn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  bankerBtn: { backgroundColor: 'rgba(255, 77, 79, 0.2)', borderWidth: 1, borderColor: '#ff4d4f' },
  playerBtn: { backgroundColor: 'rgba(24, 144, 255, 0.2)', borderWidth: 1, borderColor: '#1890ff' },
  tieBtn: { backgroundColor: 'rgba(82, 196, 26, 0.2)', borderWidth: 1, borderColor: '#52c41a' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
