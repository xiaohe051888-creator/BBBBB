import React from 'react';
import { Modal, Button, Space } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

interface ClearDataModalProps {
  visible: boolean;
  filledCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  visible,
  filledCount,
  onClose,
  onConfirm,
}) => {
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      width={420}
      styles={{
        mask: { backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.65)' },
        wrapper: {},
        body: {
          background: 'linear-gradient(145deg, #1e2530, #141b24)',
          borderRadius: 16,
          border: '1px solid rgba(255,77,79,0.15)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          padding: '32px 24px 24px',
        }
      }}
      closeIcon={<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>×</span>}
    >
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(255,77,79,0.15), rgba(255,77,79,0.05))',
          border: '1px solid rgba(255,77,79,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <DeleteOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>
          确认清空数据
        </h2>
        <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6 }}>
          确定要清空所有已填写的数据吗？<br />
          此操作不可撤销，已填写的 <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{filledCount}</span> 局数据将被永久清除。
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <Button
          onClick={onClose}
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
          danger
          onClick={() => {
            onConfirm();
            onClose();
          }}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #ff4d4f, #cf1322)',
            border: 'none',
            fontSize: 15,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(255,77,79,0.3)',
          }}
        >
          确认清空
        </Button>
      </div>
    </Modal>
  );
};

export default ClearDataModal;
