import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';

interface Props {
  bottomSheetModalRef: React.RefObject<BottomSheetModal>;
  loading: boolean;
  onUpload: (games: string[]) => void;
}

export default function UploadBottomSheet({ bottomSheetModalRef, loading, onUpload }: Props) {
  const snapPoints = useMemo(() => ['50%', '85%'], []);
  const [inputList, setInputList] = useState<string[]>([]);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  const handlePress = (result: '庄' | '闲' | '和') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputList(prev => [...prev, result]);
  };

  const handleBackspace = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputList(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setInputList([]);
  };

  const handleConfirm = () => {
    if (inputList.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpload(inputList);
      setInputList([]); // Clear after upload
    }
  };

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={1}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.container}
      handleIndicatorStyle={styles.indicator}
      enablePanDownToClose={true}
    >
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>快捷录入本靴数据</Text>
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearText}>清空</Text>
          </TouchableOpacity>
        </View>
        
        {/* 显示区 */}
        <View style={styles.displayArea}>
          <ScrollView contentContainerStyle={styles.resultList} horizontal showsHorizontalScrollIndicator={false} ref={ref => ref?.scrollToEnd({animated: true})}>
            {inputList.length === 0 ? (
              <Text style={styles.placeholderText}>请点击下方按钮录入开奖结果...</Text>
            ) : (
              inputList.map((res, i) => (
                <View key={i} style={[styles.resultDot, res === '庄' ? styles.bgBanker : res === '闲' ? styles.bgPlayer : styles.bgTie]}>
                  <Text style={styles.resultText}>{res}</Text>
                </View>
              ))
            )}
          </ScrollView>
          <Text style={styles.countText}>已录入: {inputList.length} 局</Text>
        </View>

        {/* 自定义键盘 */}
        <View style={styles.keypad}>
          <View style={styles.keyRow}>
            <TouchableOpacity style={[styles.keyBtn, styles.borderBanker]} onPress={() => handlePress('庄')}>
              <Text style={[styles.keyText, styles.textBanker]}>庄赢 (B)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.keyBtn, styles.borderPlayer]} onPress={() => handlePress('闲')}>
              <Text style={[styles.keyText, styles.textPlayer]}>闲赢 (P)</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.keyRow}>
            <TouchableOpacity style={[styles.keyBtn, styles.borderTie]} onPress={() => handlePress('和')}>
              <Text style={[styles.keyText, styles.textTie]}>和局 (T)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.keyBtn, styles.borderGray]} onPress={handleBackspace} disabled={inputList.length === 0}>
              <Text style={[styles.keyText, styles.textGray]}>退格 (Del)</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          {loading ? (
            <ActivityIndicator size="large" color="#ffd700" />
          ) : (
            <TouchableOpacity 
              style={[styles.submitBtn, inputList.length === 0 && styles.submitBtnDisabled]} 
              onPress={handleConfirm}
              disabled={inputList.length === 0}
            >
              <Text style={[styles.btnText, inputList.length === 0 && styles.btnTextDisabled]}>确认上传分析</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#161b22', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  indicator: { backgroundColor: '#8b949e', width: 40 },
  contentContainer: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  clearText: { color: '#8b949e', fontSize: 16 },
  displayArea: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 12,
    padding: 16,
    height: 100,
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  placeholderText: { color: '#6e7681', fontSize: 16, fontStyle: 'italic' },
  resultList: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bgBanker: { backgroundColor: '#ff4d4f' },
  bgPlayer: { backgroundColor: '#1890ff' },
  bgTie: { backgroundColor: '#52c41a' },
  resultText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  countText: { color: '#8b949e', fontSize: 12, textAlign: 'right', marginTop: 8 },
  keypad: { gap: 12, marginBottom: 24 },
  keyRow: { flexDirection: 'row', gap: 12 },
  keyBtn: { flex: 1, paddingVertical: 18, borderRadius: 12, alignItems: 'center', borderWidth: 2, backgroundColor: '#0d1117' },
  borderBanker: { borderColor: '#ff4d4f' },
  borderPlayer: { borderColor: '#1890ff' },
  borderTie: { borderColor: '#52c41a' },
  borderGray: { borderColor: '#30363d' },
  keyText: { fontSize: 18, fontWeight: 'bold' },
  textBanker: { color: '#ff4d4f' },
  textPlayer: { color: '#1890ff' },
  textTie: { color: '#52c41a' },
  textGray: { color: '#8b949e' },
  footer: { alignItems: 'center', marginTop: 'auto', marginBottom: 20 },
  submitBtn: {
    backgroundColor: '#ffd700',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnDisabled: { backgroundColor: '#30363d', shadowOpacity: 0, elevation: 0 },
  btnText: { color: '#0d1117', fontSize: 18, fontWeight: 'bold' },
  btnTextDisabled: { color: '#8b949e' },
});
