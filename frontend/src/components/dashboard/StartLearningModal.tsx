import React, { useState } from 'react';
import { Modal, Button, Spin, Alert } from 'antd';
import { ExperimentOutlined, LoadingOutlined, CheckCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

interface StartLearningModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const StartLearningModal: React.FC<StartLearningModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={!loading ? onClose : undefined}
      footer={null}
      centered
      width={440}
      styles={{
        mask: { backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.65)' },
        wrapper: {},
        body: {
          background: 'linear-gradient(145deg, #1e2530, #141b24)',
          borderRadius: 16,
          border: '1px solid rgba(114,46,209,0.15)', // Purple
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          padding: '32px 24px 24px',
        }
      }}
      closeIcon={<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>×</span>}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(114,46,209,0.15), rgba(114,46,209,0.05))',
          border: '1px solid rgba(114,46,209,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          {loading ? (
            <Spin indicator={<LoadingOutlined style={{ fontSize: 28, color: '#722ed1' }} spin />} />
          ) : (
            <ExperimentOutlined style={{ fontSize: 28, color: '#722ed1' }} />
          )}
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>
          确认开始 AI 深度学习
        </h2>
        <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6 }}>
          管理员操作：启动 AI 模型训练过程<br />
          系统将对收集的历史数据进行特征提取和模型迭代
        </p>
      </div>

      <div style={{
        background: 'rgba(114,46,209,0.08)',
        border: '1px solid rgba(114,46,209,0.3)',
        borderRadius: 10,
        padding: '16px',
        marginBottom: 24,
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#b37feb', fontWeight: 600 }}>
          <SafetyCertificateOutlined />
          <span>训练前置提示</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 24, color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.8 }}>
          <li>此过程可能需要消耗 <span style={{ color: '#fff' }}>1~3 分钟</span>，请勿关闭服务</li>
          <li>学习期间，新录入的局数将被挂起直到学习完成</li>
          <li>模型会在学习完成后自动保存并生成新版本</li>
          <li>当前历史数据不足 200 局时，学习效果可能不佳</li>
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          暂不学习
        </Button>
        <Button
          type="primary"
          onClick={handleConfirm}
          loading={loading}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #722ed1, #531dab)',
            border: 'none',
            fontSize: 15,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(114,46,209,0.3)',
          }}
        >
          立即开始学习
        </Button>
      </div>
    </Modal>
  );
};

export default StartLearningModal;
