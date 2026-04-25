/**
 * 数字填充弹窗组件
 * 通过输入数字序列快速填充游戏结果
 */
import React, { useState } from 'react';
import { Modal, Input } from 'antd';
import { NumberFillIcon } from './UploadIcons';
import { NUM_TO_RESULT, RESULT_COLORS, RESULT_BG } from './uploadConstants';

interface NumberFillModalProps {
  visible: boolean;
  rowCount: number;
  onClose: () => void;
  onFill: (input: string) => void;
}

export const NumberFillModal: React.FC<NumberFillModalProps> = ({
  visible,
  rowCount,
  onClose,
  onFill,
}) => {
  const [numberInput, setNumberInput] = useState('');

  const handleFill = () => {
    if (!numberInput.trim()) return;
    onFill(numberInput);
    setNumberInput('');
    onClose();
  };

  const handleClose = () => {
    setNumberInput('');
    onClose();
  };

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      centered
      width={440}
      style={{
        background: 'linear-gradient(145deg, #1a2332, #141b26)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 48px rgba(0,0,0,0.4)',
        padding: '24px',
      }}
      styles={{
        header: { display: 'none' },
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(114,46,209,0.2), rgba(114,46,209,0.08))',
          border: '1px solid rgba(114,46,209,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
        }}>
          <NumberFillIcon />
        </div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>数字填充</h2>
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
          输入数字序列快速填充开奖结果
        </p>
      </div>

      {/* 说明卡片 */}
      <div style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 16,
        padding: '10px 14px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap',
      }}>
        {[
          { num: '1', label: '庄', color: '#ff4d4f' },
          { num: '2', label: '闲', color: '#1890ff' },
          { num: '3', label: '和', color: '#52c41a' },
        ].map(item => (
          <div key={item.num} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: `${item.color}20`,
              border: `1px solid ${item.color}50`,
              color: item.color,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>{item.num}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>= {item.label}</span>
          </div>
        ))}
      </div>

      {/* 输入框 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          value={numberInput}
          onChange={e => {
            const val = e.target.value.replace(/[^123]/g, '').slice(0, rowCount);
            setNumberInput(val);
          }}
          onPressEnter={handleFill}
          placeholder={`请输入数字序列（最多${rowCount}位）`}
          size="large"
          autoFocus
          style={{
            height: 50,
            borderRadius: 10,
            fontSize: 16,
            fontFamily: 'monospace',
            letterSpacing: '2px',
            textAlign: 'center',
          }}
          styles={{ input: { color: '#fff' } }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
          fontSize: 11,
          color: 'rgba(255,255,255,0.35)',
        }}>
          <span>已输入 {numberInput.length} 位</span>
          <span>最多 {rowCount} 位</span>
        </div>
      </div>

      {/* 预览 */}
      {numberInput.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>预览</div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 5,
            fontSize: 12,
          }}>
            {numberInput.split('').map((num, idx) => (
              <span key={idx} style={{
                padding: '3px 8px',
                borderRadius: 5,
                background: RESULT_BG[NUM_TO_RESULT[num]],
                border: `1px solid ${RESULT_COLORS[NUM_TO_RESULT[num]]}`,
                color: RESULT_COLORS[NUM_TO_RESULT[num]],
                fontWeight: 600,
                minWidth: 26,
                textAlign: 'center',
              }}>
                {NUM_TO_RESULT[num]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 按钮 */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleClose}
          style={{
            flex: 1,
            padding: '12px 20px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          取消
        </button>
        <button
          onClick={handleFill}
          disabled={!numberInput.trim()}
          style={{
            flex: 1,
            padding: '12px 20px',
            borderRadius: 10,
            border: 'none',
            background: numberInput.trim()
              ? 'linear-gradient(135deg, #722ed1, #531dab)'
              : 'rgba(255,255,255,0.08)',
            color: numberInput.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
            cursor: numberInput.trim() ? 'pointer' : 'not-allowed',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          确认填充
        </button>
      </div>
    </Modal>
  );
};

export default NumberFillModal;
