import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, Select, Button, App, Alert, Grid } from 'antd';
import type { ApiConfigPayload, ThreeModelStatus } from '../../services/api';
import * as apiService from '../../services/api';
import { toCnApiTestError } from '../../utils/i18nErrors';
import { formatApiConfigLabel } from '../../utils/beginnerCopy';

interface ApiConfigModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
  role: 'banker' | 'player' | 'combined' | 'single';
  currentStatus: ThreeModelStatus | null;
}

const PROVIDERS = [
  { label: '深度求索（默认推荐）', value: 'deepseek' },
  { label: '开放AI平台', value: 'openai' },
  { label: '克劳德平台', value: 'anthropic' },
  { label: '阿里云 (通义千问)', value: 'aliyun' },
  { label: '自定义兼容接口', value: 'custom' },
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
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [provider, setProvider] = useState<string>('deepseek');
  const initializedRef = useRef(false);

  const roleName = role === 'banker' ? '庄模型' : role === 'player' ? '闲模型' : role === 'combined' ? '综合模型' : '单AI模型';

  useEffect(() => {
    if (!visible) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    if (currentStatus?.models?.[role]) {
      const modelConfig = currentStatus.models[role];
      setProvider(modelConfig.provider || 'deepseek');
      form.setFieldsValue({
        provider: modelConfig.provider || 'deepseek',
        model: modelConfig.model || (role === 'single' ? 'deepseek-v4-pro' : 'deepseek-reasoner'),
        api_key: '', // 不回显API Key
        base_url: modelConfig.base_url || '',
      });
      setTestResult(null);
      initializedRef.current = true;
    }
  }, [visible, currentStatus, role, form]);

  const MODEL_OPTIONS: Record<string, { label: string; value: string }[]> = {
    deepseek: [
      { label: '深度求索 V4 专业版（推荐）', value: 'deepseek-v4-pro' },
      { label: '推理增强版（推荐）', value: 'deepseek-reasoner' },
      { label: '通用对话版', value: 'deepseek-chat' },
    ],
    openai: [
      { label: '旗舰版', value: 'gpt-4o' },
      { label: '轻量版', value: 'gpt-4o-mini' },
    ],
    anthropic: [
      { label: '高质量版', value: 'claude-3-5-sonnet-20240620' },
    ],
    aliyun: [
      { label: '旗舰版', value: 'qwen-max' },
    ],
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    form.setFieldsValue({
      model: role === 'single' && value === 'deepseek' ? 'deepseek-v4-pro' : DEFAULT_MODELS[value] || '',
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
      message.warning(`${formatApiConfigLabel('enterSecretKey')}后再测试`);
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      await apiService.testApiConnection(payload);
      setTestResult({ success: true, message: '测试成功，当前设置可以正常连接并返回结果。' });
      message.success('当前设置测试通过');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const raw = err.response?.data?.detail || err.message || '连接失败';
      const errorMsg = toCnApiTestError(String(raw));
      setTestResult({ success: false, message: `测试失败：${errorMsg}` });
    } finally {
      await Promise.resolve(onSuccess());
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const payload = await getPayload();
    if (!payload) return;

    if (!payload.api_key && !currentStatus?.models?.[role]?.api_key_set) {
      message.warning(`第一次设置时必须填写${formatApiConfigLabel('secretKey')}`);
      return;
    }

    setSaving(true);
    try {
      await apiService.updateApiConfig(payload);
      message.success(`${roleName}设置已保存`);
      await Promise.resolve(onSuccess());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const raw = err.response?.data?.detail || err.message || '保存失败';
      message.error(`保存失败：${toCnApiTestError(String(raw))}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${formatApiConfigLabel('titlePrefix')}${roleName}接口`}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="test" onClick={handleTest} loading={testing}>
          {formatApiConfigLabel('testConnection')}
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} loading={saving}>
          {formatApiConfigLabel('saveConfig')}
        </Button>,
      ]}
      width={500}
      style={{ maxWidth: 'calc(100vw - 20px)' }}
      mask={{ closable: false }}
    >
      <div style={{ marginBottom: 16, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
        在这里填写当前模型要用的访问信息。如果访问密钥留空，就继续沿用之前已保存的内容。
      </div>

      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item 
          name="provider" 
          label={formatApiConfigLabel('provider')}
          rules={[{ required: true, message: '请选择服务平台' }]}
        >
          <Select options={PROVIDERS} onChange={handleProviderChange} popupMatchSelectWidth={!isMobile} />
        </Form.Item>

        <Form.Item 
          name="model" 
          label={formatApiConfigLabel('modelName')}
          rules={[{ required: true, message: '请输入模型名称' }]}
        >
          {provider === 'custom' ? (
            <Input placeholder="例如：具体模型名称" />
          ) : (
            <Select options={MODEL_OPTIONS[provider] || []} popupMatchSelectWidth={!isMobile} />
          )}
        </Form.Item>

        <Form.Item 
          name="api_key" 
          label={
            <span>
              接口密钥 
              {currentStatus?.models?.[role]?.api_key_set && 
                <span style={{ marginLeft: 8, color: '#52c41a', fontSize: 12 }}>(之前已保存，不修改可留空)</span>
              }
            </span>
          }
          rules={[{ required: !currentStatus?.models?.[role]?.api_key_set, message: formatApiConfigLabel('enterSecretKey') }]}
        >
          <Input.Password placeholder={formatApiConfigLabel('enterSecretKey')} />
        </Form.Item>

        <Form.Item 
          name="base_url" 
          label="接口地址（可选）"
          tooltip="如果你使用代理地址或自定义兼容接口，请填写完整地址"
          hidden={provider !== 'custom' && role !== 'single'}
        >
          <Input placeholder="例如：接口地址" />
        </Form.Item>
      </Form>

      {testResult && (
        <Alert 
          type={testResult.success ? 'success' : 'error'}
          title={testResult.success ? '测试通过' : '测试失败'}
          description={testResult.message}
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Modal>
  );
};
