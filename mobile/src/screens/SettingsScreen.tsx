import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { updateApiKeys, testApiKeys, adjustBalance, getSystemState } from '../services/api';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  
  const [balanceAmount, setBalanceAmount] = useState('1000');
  
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const handleSaveKeys = async () => {
    try {
      setSaving(true);
      await updateApiKeys({
        openai_key: openaiKey || undefined,
        anthropic_key: anthropicKey || undefined,
        gemini_key: geminiKey || undefined,
      });
      Alert.alert('成功', 'API Keys 已更新，并已写入环境变量。');
      setOpenaiKey('');
      setAnthropicKey('');
      setGeminiKey('');
    } catch (err: any) {
      Alert.alert('错误', err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestKeys = async () => {
    try {
      setTesting(true);
      const res = await testApiKeys();
      const data = res.data;
      const msg = `OpenAI: ${data.openai?.success ? '✅' : '❌'}
Anthropic: ${data.anthropic?.success ? '✅' : '❌'}
Gemini: ${data.gemini?.success ? '✅' : '❌'}`;
      Alert.alert('测试结果', msg);
    } catch (err: any) {
      Alert.alert('测试错误', err.message || '测试调用失败');
    } finally {
      setTesting(false);
    }
  };

  const handleAdjustBalance = async (action: 'add' | 'subtract') => {
    try {
      setAdjusting(true);
      const amount = parseFloat(balanceAmount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('错误', '请输入有效的金额');
        return;
      }
      await adjustBalance(amount, action);
      queryClient.invalidateQueries({ queryKey: ['gameState'] });
      Alert.alert('成功', `已成功${action === 'add' ? '增加' : '扣除'}本金 ${amount}。`);
    } catch (err: any) {
      Alert.alert('错误', err.response?.data?.detail || err.message || '操作失败');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.header}>系统设置</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API 大模型配置</Text>
        <Text style={styles.helpText}>留空则不修改当前配置。配置保存后可点击测试进行连通性验证。</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>OpenAI API Key</Text>
          <TextInput
            style={styles.input}
            placeholder="sk-..."
            placeholderTextColor="#8b949e"
            value={openaiKey}
            onChangeText={setOpenaiKey}
            secureTextEntry
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Anthropic API Key</Text>
          <TextInput
            style={styles.input}
            placeholder="sk-ant-..."
            placeholderTextColor="#8b949e"
            value={anthropicKey}
            onChangeText={setAnthropicKey}
            secureTextEntry
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gemini API Key</Text>
          <TextInput
            style={styles.input}
            placeholder="AIza..."
            placeholderTextColor="#8b949e"
            value={geminiKey}
            onChangeText={setGeminiKey}
            secureTextEntry
          />
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.primaryBtn]} onPress={handleSaveKeys} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>保存配置</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondaryBtn]} onPress={handleTestKeys} disabled={testing}>
            {testing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>测试连接</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>资金管理</Text>
        <Text style={styles.helpText}>如果自动下注输光了，可以在这里手动增加或扣除本金。</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>操作金额</Text>
          <TextInput
            style={styles.input}
            placeholder="输入金额"
            placeholderTextColor="#8b949e"
            value={balanceAmount}
            onChangeText={setBalanceAmount}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.successBtn]} onPress={() => handleAdjustBalance('add')} disabled={adjusting}>
            <Text style={styles.buttonText}>增加本金 (+)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.dangerBtn]} onPress={() => handleAdjustBalance('subtract')} disabled={adjusting}>
            <Text style={styles.buttonText}>扣除本金 (-)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    marginTop: 40,
  },
  section: {
    backgroundColor: '#161b22',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#c9d1d9',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#8b949e',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#c9d1d9',
    marginBottom: 6,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    color: '#fff',
    padding: 12,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  primaryBtn: {
    backgroundColor: '#238636',
  },
  secondaryBtn: {
    backgroundColor: '#1f6feb',
  },
  successBtn: {
    backgroundColor: '#238636',
  },
  dangerBtn: {
    backgroundColor: '#da3633',
  }
});