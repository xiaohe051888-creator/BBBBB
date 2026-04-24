import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Modal } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';

interface Props {
  bottomSheetModalRef: React.RefObject<any>;
  loading: boolean;
  gameNumber?: number;
  onReveal: (result: '庄' | '闲' | '和') => void;
}

export default function RevealBottomSheet({ bottomSheetModalRef, loading, gameNumber, onReveal }: Props) {
  const snapPoints = useMemo(() => ['35%'], []);
  const [webVisible, setWebVisible] = useState(false);

  if (Platform.OS === 'web' && bottomSheetModalRef) {
    (bottomSheetModalRef as any).current = {
      present: () => setWebVisible(true),
      dismiss: () => setWebVisible(false)
    };
  }

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  const content = (
      <View style={styles.contentContainer}>
        <Text style={styles.title}>
          第 {gameNumber || '-'} 局开奖
        </Text>
        <Text style={styles.subtitle}>请选择实际开奖结果：</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#ffd700" style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity accessibilityRole="button" style={[styles.btn, styles.bankerBtn]} onPress={() => { if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onReveal('庄'); }}>
              <Text style={styles.btnText}>庄赢 (B)</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={[styles.btn, styles.playerBtn]} onPress={() => { if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onReveal('闲'); }}>
              <Text style={styles.btnText}>闲赢 (P)</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={[styles.btn, styles.tieBtn]} onPress={() => { if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onReveal('和'); }}>
              <Text style={styles.btnText}>和局 (T)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
  );

  if (Platform.OS === 'web') {
    if (!webVisible) return null;
    return (
      <Modal transparent visible={webVisible} animationType="slide">
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'}}>
          <TouchableOpacity accessibilityRole="button" style={{flex: 1}} onPress={() => setWebVisible(false)} />
          <View style={{backgroundColor: '#161b22', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '35%'}}>
            {content}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef as any}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.container}
      handleIndicatorStyle={styles.indicator}
      enablePanDownToClose={true}
    >
      {content}
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
