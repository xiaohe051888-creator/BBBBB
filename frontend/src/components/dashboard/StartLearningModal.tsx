import React, { useState } from 'react';
import { Modal, Button, Spin, Grid } from 'antd';
import { ExperimentOutlined, LoadingOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { formatLearningLabel } from '../../utils/beginnerCopy';

interface StartLearningModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  modeLabel?: string;
}

export const StartLearningModal: React.FC<StartLearningModalProps> = ({
  visible,
  onClose,
  onConfirm,
  modeLabel,
}) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (loading) return;
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
      style={{ maxWidth: 'calc(100vw - 20px)' }}
      styles={{
        mask: { backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.65)' },
        wrapper: {},
        body: {
          background: 'linear-gradient(145deg, #1e2530, #141b24)',
          borderRadius: 16,
          border: '1px solid rgba(114,46,209,0.15)', // Purple
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          padding: 'clamp(20px, 4vw, 32px) clamp(16px, 3vw, 24px) clamp(16px, 3vw, 24px)',
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
          {formatLearningLabel('title')}
        </h2>
        {modeLabel && (
          <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
            当前模式：{modeLabel}
          </div>
        )}
        <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6 }}>
          管理员操作：让系统用已有历史数据做一轮自动优化<br />
          完成后会生成一版新的可用配置
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
          <span>开始前请先确认</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 24, color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.8 }}>
          <li>历史记录总量需要在 <span style={{ color: '#fff', fontWeight: 'bold' }}>200 ~ 1000 局</span> 之间，系统才能开始优化</li>
          <li>系统会按每一靴的数据依次处理，直到把数据库里的历史内容跑完</li>
          <li>此过程可能需要消耗 <span style={{ color: '#fff' }}>1~3 分钟</span>，请勿关闭服务</li>
          <li>全部完成后，系统会自动保存并生成一个新版本</li>
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
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
          {formatLearningLabel('cancel')}
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
          {formatLearningLabel('confirm')}
        </Button>
      </div>
    </Modal>
  );
};

export default StartLearningModal;
