import React, { useState } from 'react';
import { Modal, Input, Button, App } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import { uploadGameResults } from '../../services/api';
import type { GameUploadItem } from '../../services/api';

interface UploadModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  // 解析输入的文本：支持中英文（庄/闲/和、B/P/T），自动过滤无效字符
  const parseInput = (text: string): GameUploadItem[] => {
    const chars = text.replace(/[^庄闲和BPTbpt]/g, '').toUpperCase();
    return Array.from(chars).map((char, index) => {
      let result: '庄' | '闲' | '和' = '庄';
      if (char === '闲' || char === 'P') result = '闲';
      else if (char === '和' || char === 'T') result = '和';
      
      return {
        game_number: index + 1,
        result,
      };
    });
  };

  const handleUpload = async () => {
    const games = parseInput(inputValue);
    
    if (games.length === 0) {
      message.warning('请输入有效的开奖数据 (支持 庄/闲/和 或 B/P/T)');
      return;
    }
    if (games.length > 72) {
      message.warning('单次最多支持录入 72 局');
      return;
    }

    setLoading(true);
    try {
      // isNewBoot 传 false，触发后端覆盖逻辑
      await uploadGameResults(games, false);
      message.success('数据上传成功，当前靴数据已清空并重新开始！');
      setInputValue('');
      onSuccess();
    } catch (err: any) {
      message.error(err.response?.data?.error || err.message || '上传失败');
    } finally {
      setLoading(false);
    }
  };

  const parsedGames = parseInput(inputValue);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
          <CloudUploadOutlined style={{ color: '#1890ff', fontSize: 20 }} />
          <span>上传数据 (覆盖重置本靴)</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading} style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}>
          取消
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={loading} 
          onClick={handleUpload}
          style={{ background: '#1890ff', borderColor: '#1890ff' }}
        >
          确认上传并重置
        </Button>
      ]}
      styles={{
        mask: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0, 0, 0, 0.7)' },
        body: { padding: '24px 0' }
      }}
    >
      <div style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 16, lineHeight: 1.6 }}>
        请输入历史开奖结果（支持输入 <strong>庄/闲/和</strong> 或 <strong>B/P/T</strong>，自动忽略空格及其他字符）。
        <br />
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>注意：确认上传后，将清空当前靴已保存的微学习数据和开奖记录，并以新数据重新开始。</span>
      </div>
      <Input.TextArea
        rows={6}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="例如：庄闲庄和闲 (或 B P B T P)"
        style={{
          background: 'rgba(0,0,0,0.3)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8
        }}
      />
      <div style={{ marginTop: 12, height: 20 }}>
        {inputValue && (
          <span style={{ color: parsedGames.length > 72 ? '#ff4d4f' : '#52c41a' }}>
            已解析 {parsedGames.length} 局数据 {parsedGames.length > 72 ? '(超限)' : ''}
          </span>
        )}
      </div>
    </Modal>
  );
};
