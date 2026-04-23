import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';

interface Props {
  bottomSheetModalRef: React.RefObject<BottomSheetModal>;
  loading: boolean;
  onUpload: (games: string[]) => void;
}

export default function UploadBottomSheet({ bottomSheetModalRef, loading, onUpload }: Props) {
  const snapPoints = useMemo(() => ['50%', '80%'], []);
  const [inputText, setInputText] = useState('');

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  const handleConfirm = () => {
    const mapping: Record<string, string> = { '1': '庄', '2': '闲', '3': '和' };
    const arr = inputText.split('').map(char => mapping[char]).filter(Boolean);
    if (arr.length > 0) {
      onUpload(arr);
    }
  };

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.container}
      handleIndicatorStyle={styles.indicator}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <View style={styles.contentContainer}>
        <Text style={styles.title}>快捷上传本靴数据</Text>
        <Text style={styles.subtitle}>输入数字序列（1=庄, 2=闲, 3=和）</Text>
        
        <TextInput
          style={styles.input}
          placeholder="例如: 1212111"
          placeholderTextColor="#6e7681"
          value={inputText}
          onChangeText={setInputText}
          keyboardType="numeric"
          multiline
        />

        <View style={styles.footer}>
          {loading ? (
            <ActivityIndicator size="large" color="#ffd700" />
          ) : (
            <TouchableOpacity style={styles.submitBtn} onPress={handleConfirm}>
              <Text style={styles.btnText}>确认覆盖上传 ({inputText.length}局)</Text>
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
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#8b949e', fontSize: 14, marginBottom: 16 },
  input: {
    backgroundColor: '#0d1117',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  footer: { alignItems: 'center' },
  submitBtn: {
    backgroundColor: '#ffd700',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { color: '#0d1117', fontSize: 16, fontWeight: 'bold' },
});
