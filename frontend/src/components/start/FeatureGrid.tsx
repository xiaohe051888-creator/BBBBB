/**
 * 功能特点展示网格组件
 */
import React from 'react';
import { Icons } from './StartIcons';

const features = [
  { icon: <Icons.AI />, text: 'AI三模型', desc: '满血预测' },
  { icon: <Icons.Chart />, text: '五路走势图', desc: '国际标准' },
  { icon: <Icons.Edit />, text: '手动输入', desc: '灵活上传' },
];

export const FeatureGrid: React.FC = () => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8,
      marginBottom: 28,
    }}>
      {features.map((feature, index) => (
        <div key={index} style={{
          textAlign: 'center',
          padding: '12px 8px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.3s ease',
        }}>
          <div style={{ 
            fontSize: 20, 
            marginBottom: 6,
            color: 'rgba(255,215,0,0.8)',
            display: 'flex',
            justifyContent: 'center',
          }}>{feature.icon}</div>
          <div style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 'clamp(10px, 2.5vw, 12px)',
            fontWeight: 600,
          }}>{feature.text}</div>
          <div style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: 'clamp(9px, 2vw, 10px)',
            marginTop: 2,
          }}>{feature.desc}</div>
        </div>
      ))}
    </div>
  );
};
