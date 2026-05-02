import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import * as api from '../../services/api';

export const AdminAlertsBar: React.FC = () => {
  const navigate = useNavigate();
  const isLoggedIn = !!api.getToken();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<api.AdminMaintenanceAlertsResponse | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const res = await api.adminMaintenanceAlerts(24, 20);
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchAlerts();
    if (!isLoggedIn) return;
    const t = setInterval(fetchAlerts, 10000);
    return () => clearInterval(t);
  }, [fetchAlerts, isLoggedIn]);

  const items = useMemo(() => data?.data || [], [data]);
  const count = data?.count || 0;

  if (!isLoggedIn || count <= 0) return null;

  return (
    <div style={{
      margin: '12px 16px 0 16px',
      border: '1px solid rgba(255,77,79,0.45)',
      background: 'rgba(255,77,79,0.10)',
      borderRadius: 12,
      padding: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#ff4d4f', flexShrink: 0 }} />
          <span style={{ color: '#ffccc7', fontWeight: 700, whiteSpace: 'nowrap' }}>严重告警</span>
          <Tag color="error" style={{ margin: 0 }}>P1 {count}</Tag>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            最近24小时内检测到 {count} 条 P1 事件
          </span>
        </div>
        <Space size={8} wrap>
          <Button size="small" loading={loading} onClick={fetchAlerts}>刷新</Button>
          <Button size="small" onClick={() => setExpanded(v => !v)}>{expanded ? '收起' : '展开'}</Button>
          <Button size="small" type="primary" danger onClick={() => navigate('/dashboard/logs?priority=P1')}>查看全部</Button>
        </Space>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                background: 'rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '8px 10px',
                cursor: 'pointer',
              }}
              onClick={() => navigate('/dashboard/logs?priority=P1')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: '#ffd6e7', fontSize: 12, fontWeight: 600 }}>
                  {it.log_time ? dayjs(it.log_time).format('MM-DD HH:mm:ss') : '--'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                  {it.event_type} · {it.event_code}
                </span>
              </div>
              <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.80)', fontSize: 12, lineHeight: 1.4 }}>
                {it.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

