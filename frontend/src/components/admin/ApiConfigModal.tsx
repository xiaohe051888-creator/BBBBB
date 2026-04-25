import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message, Space, Spin, Alert } from 'antd';
import type { ApiConfigPayload, ThreeModelStatus } from '../../services/api';
import * as apiService from '../../services/api';

interface ApiConfigModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  role: 'banker' | 'player' | 'combined';
  currentStatus: ThreeModelStatus | null;
}

const PROVIDERS = [
  { label: 'DeepSeek (默认推荐)', value: 'deepseek' },
  { label: 'OpenAI (GPT)', value: 'openai' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: '阿里云 (通义千问)', value: 'aliyun' },
  { label: '自定义兼容API', value: 'custom' },
];

const DEFAULT_MODELS: Record<string, string> = {
  deepseek: 'deepseek-reasoner',
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20240620',
  aliyun: 'qwen-max',
  custom: '',
};

const DEFAULT_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  custom: '',
};

export const ApiConfigModal: React.FC<ApiConfigModalProps> = ({
  visible, onCancel, onSuccess, role, currentStatus
}) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  const roleName = role === 'banker' ? '庄模型' : role === 'player' ? '闲模型' : '综合模型';

  useEffect(() => {
    if (visible && currentStatus?.models?.[role]) {
      const modelConfig = currentStatus.models[role];
      form.setFieldsValue({
        provider: modelConfig.provider || 'deepseek',
        model: modelConfig.model || 'deepseek-reasoner',
        api_key: '', // 不回显API Key
        base_url: modelConfig.base_url || '',
      });
      setTestResult(null);
    }
  }, [visible, currentStatus, role, form]);

  const handleProviderChange = (value: string) => {
    form.setFieldsValue({
      model: DEFAULT_MODELS[value] || '',
      base_url: DEFAULT_BASE_URLS[value] || '',
    });
  };

  const getPayload = async (): Promise<ApiConfigPayload | null> => {
    try {
      const values = await form.validateFields();
      return {
        role,
        ...values,
      };
    } catch {
      return null;
    }
  };

  const handleTest = async () => {
    const payload = await getPayload();
    if (!payload) return;

    if (!payload.api_key && !currentStatus?.models?.[role]?.api_key_set) {
      message.warning('请输入 API Key 进行测试');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      await apiService.testApiConnection(payload);
      setTestResult({ success: true, message: '测试成功！API 连接正常，模型响应符合预期。' });
      message.success('API 测试成功');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || '连接失败';
      setTestResult({ success: false, message: `测试失败: ${errorMsg}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const payload = await getPayload();
    if (!payload) return;

    if (!payload.api_key && !currentStatus?.models?.[role]?.api_key_set) {
      message.warning('首次配置必须输入 API Key');
      return;
    }

    setSaving(true);
    try {
      await apiService.updateApiConfig(payload);
      message.success(`${roleName} API 配置保存成功`);
      onSuccess();
      onCancel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      message.error(`保存失败: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`配置 ${roleName} API`}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="test" onClick={handleTest} loading={testing}>
          测试连通性
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} loading={saving}>
          保存配置
        </Button>,
      ]}
      width={500}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      maskClosable={false}
    >
      <div style={{ marginBottom: 16, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
        配置专属的大模型 API 密钥。如果留空 API Key，将保留现有的密钥不变。
      </div>

      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item 
          name="provider" 
          label="模型服务商" 
          rules={[{ required: true, message: '请选择服务商' }]}
        >
          <Select options={PROVIDERS} onChange={handleProviderChange} />
        </Form.Item>

        <Form.Item 
          name="model" 
          label="模型名称 (Model ID)" 
          rules={[{ required: true, message: '请输入模型名称' }]}
        >
          <Input placeholder="例如: deepseek-reasoner" />
        </Form.Item>

        <Form.Item 
          name="api_key" 
          label={
            <span>
              API Key 
              {currentStatus?.models?.[role]?.api_key_set && 
                <span style={{ marginLeft: 8, color: '#52c41a', fontSize: 12 }}>(已保存过密钥，不修改请留空)</span>
              }
            </span>
          }
          rules={[{ required: !currentStatus?.models?.[role]?.api_key_set, message: '请输入 API Key' }]}
        >
          <Input.Password placeholder="sk-..." />
        </Form.Item>

        <Form.Item 
          name="base_url" 
          label="API Base URL (可选)" 
          tooltip="如果使用代理或自定义兼容接口，请填写完整的 Base URL"
        >
          <Input placeholder="例如: https://api.deepseek.com" />
        </Form.Item>
      </Form>

      {testResult && (
        <Alert 
          type={testResult.success ? 'success' : 'error'}
          message={testResult.success ? '测试通过' : '测试失败'}
          description={testResult.message}
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Modal>
  );
};
