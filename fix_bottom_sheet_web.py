import re

with open('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx', 'r') as f:
    content = f.read()

# Replace BottomSheetModal with a custom conditional wrapper for web
web_fix = """import React, { useCallback, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';

interface Props {
  bottomSheetModalRef: React.RefObject<any>;
  loading: boolean;
  onUpload: (games: string[]) => void;
}

export default function UploadBottomSheet({ bottomSheetModalRef, loading, onUpload }: Props) {
  const snapPoints = useMemo(() => ['50%', '85%'], []);
  const [inputList, setInputList] = useState<string[]>([]);
  const [webVisible, setWebVisible] = useState(false);

  // Expose present/dismiss to the ref for Web Modal fallback
  useImperativeHandle(bottomSheetModalRef, () => ({
    present: () => {
      if (Platform.OS === 'web') {
        setWebVisible(true);
      } else {
        (bottomSheetModalRef as any).current?.present();
      }
    },
    dismiss: () => {
      if (Platform.OS === 'web') {
        setWebVisible(false);
      } else {
        (bottomSheetModalRef as any).current?.dismiss();
      }
    }
  }));

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  const handlePress = (result: '庄' | '闲' | '和') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputList(prev => [...prev, result]);
  };

  const handleBackspace = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputList(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setInputList([]);
  };

  const handleConfirm = () => {
    if (inputList.length > 0) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpload(inputList);
      setInputList([]);
    }
  };

  const content = (
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
  );

  if (Platform.OS === 'web') {
    return (
      <Modal transparent visible={webVisible} animationType="slide">
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'}}>
          <TouchableOpacity style={{flex: 1}} onPress={() => setWebVisible(false)} />
          <View style={{backgroundColor: '#161b22', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%'}}>
            {content}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef as any}
      index={1}
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
"""

with open('/workspace/mobile/src/components/dashboard/UploadBottomSheet.tsx', 'w') as f:
    f.write(web_fix + "\n" + content.split("const styles = StyleSheet.create({")[1])
    
