import React, { useRef, useState, Suspense, lazy, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Text, Platform, Modal } from 'react-native';
import { SafeAreaView } from "react-native";
import { BottomSheetModal } from '@gorhom/bottom-sheet';

import { WorkflowStatusBar } from '../components/dashboard/WorkflowStatusBar';
import { FiveRoadsChart } from '../components/roads/FiveRoadsChart';


// Lazy load Skia components
import RevealBottomSheet from '../components/dashboard/RevealBottomSheet';
import UploadBottomSheet from '../components/dashboard/UploadBottomSheet';
import { useGameState } from '../hooks/useGameState';
import { useRevealResultMutation, useUploadGamesMutation, useEndBootMutation } from '../hooks/useQueries';
import { useWebSocket } from '../hooks/useWebSocket';

export default function DashboardScreen() {
  const { systemState, analysis, games } = useGameState();
  const revealMutation = useRevealResultMutation();
  const uploadMutation = useUploadGamesMutation();
  const endBootMutation = useEndBootMutation();

  useWebSocket();

  const [alertConfig, setAlertConfig] = useState<{visible: boolean, title: string, message: string, onConfirm?: () => void, showCancel?: boolean}>({visible: false, title: '', message: ''});

  const showAlert = (title: string, message: string, onConfirm?: () => void, showCancel?: boolean) => {
    if (Platform.OS === 'web') {
      setAlertConfig({visible: true, title, message, onConfirm, showCancel});
    } else {
      if (showCancel) {
        Alert.alert(title, message, [
          { text: '取消', style: 'cancel' },
          { text: '确定', style: 'destructive', onPress: onConfirm }
        ]);
      } else {
        Alert.alert(title, message, [{ text: '确定', onPress: onConfirm }]);
      }
    }
  };

  const revealSheetRef = useRef<BottomSheetModal>(null);
  const uploadSheetRef = useRef<BottomSheetModal>(null);

  const hasGameData = games && games.length > 0;
  const hasPendingBet = !!systemState?.pending_bet;

  const handleOpenReveal = () => {
    revealSheetRef.current?.present();
  };
  const handleOpenUpload = () => {
    console.log('Upload clicked', uploadSheetRef.current);
    uploadSheetRef.current?.present();
  };

  const handleRevealSubmit = async (result: '庄' | '闲' | '和') => {
    try {
      await revealMutation.mutateAsync({ result });
      revealSheetRef.current?.dismiss();
    } catch (e: any) {
      showAlert('开奖失败', e.message);
    }
  };

  const handleUploadSubmit = async (gamesArr: string[]) => {
    try {
      const formatted = gamesArr.map((res, i) => ({ game_number: i + 1, result: res }));
      await uploadMutation.mutateAsync({ games: formatted as any, isNewBoot: false });
      uploadSheetRef.current?.dismiss();
      showAlert('成功', '上传成功');
    } catch (e: any) {
      Alert.alert('上传失败', e.message);
    }
  };

  const handleEndBoot = () => {
    showAlert('结束本靴', '确定要结束本靴并开始深度学习吗？', async () => {
      try {
        await endBootMutation.mutateAsync();
        showAlert('成功', '本靴已结束，进入深度学习');
        uploadSheetRef.current?.present();
      } catch (e: any) {
        showAlert('错误', e.message);
      }
    }, true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>单靴分析终端</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleOpenUpload} style={styles.uploadBtn}>
            <Text style={styles.uploadBtnText}>上传</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEndBoot} style={styles.endBootBtn}>
            <Text style={styles.endBootBtnText}>换靴</Text>
          </TouchableOpacity>
        </View>
      </View>

      <WorkflowStatusBar
        hasPendingBet={hasPendingBet}
        hasGameData={hasGameData}
        analysis={analysis}
        systemState={systemState}
        onOpenReveal={handleOpenReveal}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <FiveRoadsChart />
      </ScrollView>

      <RevealBottomSheet 
        bottomSheetModalRef={revealSheetRef} 
        loading={revealMutation.isPending}
        gameNumber={systemState?.pending_bet?.game_number ?? systemState?.next_game_number}
        onReveal={handleRevealSubmit} 
      />

      <UploadBottomSheet 
        bottomSheetModalRef={uploadSheetRef} 
        loading={uploadMutation.isPending}
        onUpload={handleUploadSubmit} 
      />

      {alertConfig.visible && (<Modal transparent visible={alertConfig.visible} animationType="fade">
        <View style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center'}]}>
          <View style={{backgroundColor: '#161b22', padding: 20, borderRadius: 12, width: '80%', maxWidth: 400, borderWidth: 1, borderColor: '#30363d'}}>
            <Text style={{color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8}}>{alertConfig.title}</Text>
            <Text style={{color: '#c9d1d9', fontSize: 15, marginBottom: 20}}>{alertConfig.message}</Text>
            <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 12}}>
              {alertConfig.showCancel && (
                <TouchableOpacity onPress={() => setAlertConfig({...alertConfig, visible: false})} style={{padding: 10}}>
                  <Text style={{color: '#8b949e', fontSize: 16}}>取消</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => {
                setAlertConfig({...alertConfig, visible: false});
                alertConfig.onConfirm && alertConfig.onConfirm();
              }} style={{padding: 10}}>
                <Text style={{color: '#58a6ff', fontSize: 16, fontWeight: 'bold'}}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>)}
    </SafeAreaView>

  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0d1117' },
  headerBar: { zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#161b22' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', gap: 12 },
  uploadBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)' },
  uploadBtnText: { color: '#c9d1d9', fontSize: 14, fontWeight: 'bold' },
  endBootBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: 'rgba(255,77,79,0.2)' },
  endBootBtnText: { color: '#ff4d4f', fontSize: 14, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
});
