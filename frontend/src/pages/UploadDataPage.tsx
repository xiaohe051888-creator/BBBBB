import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Space } from 'antd';

const UploadDataPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>上传数据</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>支持 1=庄 2=闲 3=和 与 6×12 珠盘格子录入</div>
        </div>
        <Button onClick={() => navigate('/dashboard')}>返回首页</Button>
      </Space>

      <Card>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          页面功能开发中
        </div>
      </Card>
    </div>
  );
};

export default UploadDataPage;

