/**
 * UploadArea - 上传操作区域组件
 * 包含操作按钮和安全提示
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
// UploadIcons组件暂未使用

interface UploadAreaProps {
  tableId: string;
  filled: number;
  uploading: boolean;
  onUpload: () => void;
}

// Dashboard 图标组件
const DashboardIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
  </svg>
);

// Upload 图标组件
const UploadIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
  </svg>
);

// 警告图标
const WarningIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
  </svg>
);

export const UploadArea: React.FC<UploadAreaProps> = ({
  tableId,
  filled,
  uploading,
  onUpload,
}) => {
  const navigate = useNavigate();

  return (
    <>
      {/* 重置警告提示 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        marginBottom: 12,
        borderRadius: 8,
        background: 'rgba(255,77,79,0.08)',
        border: '1px solid rgba(255,77,79,0.2)',
      }}>
        <span style={{ color: '#ff4d4f', flexShrink: 0 }}>
          <WarningIcon />
        </span>
        <span style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          <strong style={{ color: '#ff4d4f' }}>注意：</strong>
          上传新数据将重置当前桌的所有历史记录和工作流状态
        </span>
      </div>

      {/* 操作按钮 */}
      <div style={{
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        flexWrap: 'wrap',
        padding: '20px',
        borderRadius: 16,
        background: 'linear-gradient(145deg, rgba(22,29,42,0.6), rgba(15,21,33,0.6))',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* 查看仪表盘（不上传） */}
        <button
          onClick={() => navigate(`/dashboard/${tableId}`)}
          style={{
            padding: '14px 28px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            minWidth: 140,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          <DashboardIcon />
          查看仪表盘
        </button>

        {/* 确认上传 */}
        <button
          onClick={onUpload}
          disabled={uploading || filled === 0}
          style={{
            padding: '14px 32px',
            borderRadius: 12,
            border: 'none',
            background: filled === 0
              ? 'rgba(255,255,255,0.06)'
              : 'linear-gradient(135deg, #ffd700 0%, #f0b90b 50%, #d4a017 100%)',
            color: filled === 0 ? 'rgba(255,255,255,0.3)' : '#000',
            cursor: filled === 0 ? 'not-allowed' : 'pointer',
            fontSize: 15,
            fontWeight: 800,
            minWidth: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: filled > 0 ? '0 8px 32px rgba(255,215,0,0.4)' : 'none',
            transition: 'all 0.2s',
            opacity: uploading ? 0.7 : 1,
            letterSpacing: '0.5px',
          }}
        >
          {uploading ? (
            <span>上传中...</span>
          ) : (
            <>
              <UploadIcon />
              确认上传 ({filled}局)
            </>
          )}
        </button>
      </div>
    </>
  );
};
