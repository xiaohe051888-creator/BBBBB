import React, { useState } from 'react';
import { Modal, Button, Spin } from 'antd';
import { CloudUploadOutlined, LoadingOutlined, WarningOutlined } from '@ant-design/icons';

interface ConfirmUploadModalProps {
  visible: boolean;
  filledCount: number;
  hasActiveGame: boolean;
  currentStatus: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const ConfirmUploadModal: React.FC<ConfirmUploadModalProps> = ({
  visible,
  filledCount,
  hasActiveGame,
  currentStatus,
  onClose,
  onConfirm,
}) => {
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
      styles={{
        mask: { backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.65)' },
        wrapper: {},
        body: {
          background: 'linear-gradient(145deg, #1e2530, #141b24)',
          borderRadius: 16,
          border: '1px solid rgba(24adb5,0.15)', // A cool teal color
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
          background: 'linear-gradient(135deg, rgba(36,173,181,0.15), rgba(36,173,181,0.05))',
          border: '1px solid rgba(36,173,181,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          {loading ? (
            <Spin indicator={<LoadingOutlined style={{ fontSize: 28, color: '#24adb5' }} spin />} />
          ) : (
            <CloudUploadOutlined style={{ fontSize: 28, color: '#24adb5' }} />
          )}
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>
          确认上传数据
        </h2>
        <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6 }}>
          即将上传 <span style={{ color: '#24adb5', fontWeight: 'bold' }}>{filledCount}</span> 局开奖记录<br />
          系统将自动计算走势图并进行AI分析
        </p>
      </div>

      <div style={{
        background: 'rgba(255,169,64,0.08)',
        border: '1px solid rgba(255,169,64,0.3)',
        borderRadius: 10,
        padding: '16px',
        marginBottom: 24,
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#ffa940', fontWeight: 600 }}>
          <WarningOutlined />
          <span>⚠️ 警告：上传将重置当前数据</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 24, color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.8 }}>
          <li>清空当前桌所有历史数据</li>
          <li>重置所有工作流状态</li>
          <li>终止正在进行的AI分析</li>
          <li>取消待处理的下注</li>
        </ul>
        {hasActiveGame && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,77,79,0.15)', borderRadius: 6, border: '1px dashed rgba(255,77,79,0.4)' }}>
            <p style={{ margin: 0, color: '#ff4d4f', fontSize: 13, fontWeight: 500 }}>
              🔴 当前状态：{currentStatus}<br />
              <span style={{ fontSize: 12, opacity: 0.85 }}>上传将强制中断当前流程！</span>
            </p>
          </div>
        )}
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
          取消
        </Button>
        <Button
          type="primary"
          onClick={handleConfirm}
          loading={loading}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #24adb5, #1d8e95)',
            border: 'none',
            fontSize: 15,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(36,173,181,0.3)',
          }}
        >
          确认上传并重置
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmUploadModal;
