import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

# Replace window.alert/confirm with simple custom modal
# First, let's add a state for custom alert
alert_state = """  const [alertConfig, setAlertConfig] = useState<{visible: boolean, title: string, message: string, onConfirm?: () => void, showCancel?: boolean}>({visible: false, title: '', message: ''});

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
  };"""

content = content.replace("  const revealSheetRef = useRef<BottomSheetModal>(null);", alert_state + "\n  const revealSheetRef = useRef<BottomSheetModal>(null);")

# Replace window.alert and Alert.alert
content = re.sub(r"Platform\.OS === 'web' \? window\.alert\(`错误: \$\{e\.message\}`\) : Alert\.alert\('错误', e\.message\);", "showAlert('错误', e.message);", content)
content = re.sub(r"Platform\.OS === 'web' \? window\.alert\('成功: 上传成功'\) : Alert\.alert\('成功', '上传成功'\);", "showAlert('成功', '上传成功');", content)
content = re.sub(r"Platform\.OS === 'web' \? window\.alert\(`开奖失败: \$\{e\.message\}`\) : Alert\.alert\('开奖失败', e\.message\);", "showAlert('开奖失败', e.message);", content)
content = re.sub(r"Alert\.alert\('开奖失败', e\.message\);", "showAlert('开奖失败', e.message);", content)

# Replace end boot logic
end_boot_logic = """  const handleEndBoot = () => {
    showAlert('结束本靴', '确定要结束本靴并开始深度学习吗？', async () => {
      try {
        await endBootMutation.mutateAsync();
        showAlert('成功', '本靴已结束，进入深度学习');
        uploadSheetRef.current?.present();
      } catch (e: any) {
        showAlert('错误', e.message);
      }
    }, true);
  };"""

content = re.sub(r'  const handleEndBoot = \(\) => \{.*?\n  \};', end_boot_logic, content, flags=re.DOTALL)

# Add Modal component
modal_ui = """      <UploadBottomSheet 
        bottomSheetModalRef={uploadSheetRef} 
        loading={uploadMutation.isPending}
        onUpload={handleUploadSubmit} 
      />

      {alertConfig.visible && (
        <View style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999}]}>
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
      )}
    </SafeAreaView>
"""

content = content.replace("      <UploadBottomSheet \n        bottomSheetModalRef={uploadSheetRef} \n        loading={uploadMutation.isPending}\n        onUpload={handleUploadSubmit} \n      />\n    </SafeAreaView>", modal_ui)

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)

