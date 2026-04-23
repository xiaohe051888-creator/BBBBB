/**
 * 管理员页面 - AI学习 & 数据库查看（手动模式）
 * 移除爬虫相关功能，专注AI模型管理和数据查看
 * 优化：精致图标、自适应布局、中文全站
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Card, Button, Table, Tag, Space, Input, Modal, message,
  Select, Tabs, Empty, Statistic, Row, Col, Divider,
} from 'antd';
import * as api from '../services/api';
import { clearToken } from '../services/api';
import { useSystemDiagnostics } from '../hooks/useSystemDiagnostics';

// 精致图标组件
const Icons = {
  Back: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
  AI: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  ),
  Database: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  Key: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
  ),
  Robot: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  ),
  Logout: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
    </svg>
  ),
  Experiment: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z"/>
    </svg>
  ),
  Banker: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff4d4f">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  Player: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1890ff">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  Brain: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#52c41a">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
};

const AdminPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = (location.state as any)?.token || api.getToken();
  
  // 系统诊断（AdminPage使用默认桌号）
  const { addIssue } = useSystemDiagnostics({});
  
  // 未登录则重定向到首页
  React.useEffect(() => {
    if (!token) {
      navigate('/');
    }
  }, [token, navigate]);
  
  const [activeTab, setActiveTab] = useState('ai');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [modelVersions, setModelVersions] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dbRecords, setDbRecords] = useState<any[]>([]);
  const [dbTable, setDbTable] = useState('game_records');
  const [dbPage, setDbPage] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiLearningStatus, setAiLearningStatus] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [threeModelStatus, setThreeModelStatus] = useState<any>(null);
  
  // 修改密码弹窗
  const [changePwdVisible, setChangePwdVisible] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mustChange, setMustChange] = useState((location.state as any)?.mustChangePassword || false);
  
  // 强制修改密码
  useEffect(() => {
    if (mustChange) setChangePwdVisible(true);
  }, [mustChange]);

  const loadModelVersions = async () => {
    try {
      const res = await api.getModelVersions();
      setModelVersions(res.data.data || []);
    } catch {
      // 加载失败，静默处理
    }
  };

  const loadDbRecords = async () => {
    try {
      const res = await api.getDatabaseRecords(dbTable, dbPage);
      setDbRecords(res.data.data || []);
    } catch {
      // 加载失败，静默处理
    }
  };

  const loadAiLearningStatus = async () => {
    try {
      const res = await api.getAiLearningStatus();
      setAiLearningStatus(res.data);
    } catch {
      // 加载失败，静默处理
    }
  };

  const loadThreeModelStatus = async () => {
    try {
      const res = await api.getThreeModelStatus();
      setThreeModelStatus(res.data);
    } catch {
      // 加载失败，静默处理
    }
  };

  useEffect(() => {
    if (activeTab === 'ai') {
      loadModelVersions();
      loadAiLearningStatus();
      loadThreeModelStatus();
    }
    if (activeTab === 'db') loadDbRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dbTable, dbPage]);

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd) {
      message.warning('请输入完整密码');
      return;
    }
    try {
      await api.changePassword(oldPwd, newPwd);
      message.success('密码修改成功');
      setChangePwdVisible(false);
      setMustChange(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '修改失败';
      message.error(errorMsg);
      // 记录错误到系统状态面板
      addIssue({
        level: 'warning',
        title: '密码修改失败',
        detail: `修改密码失败: ${errorMsg}`,
        source: 'system',
      });
    }
  };

  const tableColumns = [
    { title: 'ID', dataIndex: 'id', width: '8%' },
    { title: '桌号', dataIndex: 'table_id', width: '8%', align: 'center' as const },
    { title: '靴号', dataIndex: 'boot_number', width: '8%', align: 'center' as const },
    { title: '局号', dataIndex: 'game_number', width: '8%', align: 'center' as const },
    { title: '结果', dataIndex: 'result', width: '8%', align: 'center' as const },
    { title: '预测', dataIndex: 'predict_direction', width: '8%', align: 'center' as const },
    { title: '正确', dataIndex: 'predict_correct', width: '8%', align: 'center' as const, render: (v: boolean | null) => v === null ? '-' : v ? <Tag color="success" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}><Icons.Check /> 是</Tag> : <Tag color="error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}><Icons.Close /> 否</Tag> },
    { title: '盈亏', dataIndex: 'profit_loss', width: '12%', align: 'center' as const },
    { title: '余额', dataIndex: 'balance_after', width: '12%', align: 'center' as const },
  ];

  return (
    <div className="page-wrapper" style={{ padding: '16px' }}>
      {/* 顶部 */}
      <div className="page-nav-bar" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="page-nav-left" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button icon={<Icons.Back />} onClick={() => navigate('/')} size="small">返回启动页</Button>
          <span className="page-nav-title" style={{ fontSize: 16, fontWeight: 600 }}>管理员后台</span>
          <Tag color="blue">手动模式</Tag>
        </div>
        <div className="page-nav-right" style={{ display: 'flex', gap: 8 }}>
          <Button icon={<Icons.Key />} onClick={() => setChangePwdVisible(true)} size="small">修改密码</Button>
          <Button danger icon={<Icons.Logout />} onClick={() => { clearToken(); navigate('/'); }} size="small">退出登录</Button>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'ai',
            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Robot /> AI大模型</span>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 三模型状态 */}
                <Card title="三模型状态" size="small">
                  {threeModelStatus ? (
                    <Row gutter={[12, 12]}>
                      <Col xs={24} sm={8}>
                        <Card size="small" style={{ borderLeft: '3px solid #ff4d4f', background: 'rgba(255,77,79,0.04)' }}>
                          <div style={{ fontWeight: 700, color: '#ff4d4f', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icons.Banker /> 庄模型
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {threeModelStatus.models?.banker?.provider} · {threeModelStatus.models?.banker?.model}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {threeModelStatus.models?.banker?.api_key_set ? (
                              <Tag color="success" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Check /> 已配置</Tag>
                            ) : (
                              <Tag color="error" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Close /> 未配置</Tag>
                            )}
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Card size="small" style={{ borderLeft: '3px solid #1890ff', background: 'rgba(24,144,255,0.04)' }}>
                          <div style={{ fontWeight: 700, color: '#1890ff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icons.Player /> 闲模型
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {threeModelStatus.models?.player?.provider} · {threeModelStatus.models?.player?.model}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {threeModelStatus.models?.player?.api_key_set ? (
                              <Tag color="success" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Check /> 已配置</Tag>
                            ) : (
                              <Tag color="error" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Close /> 未配置</Tag>
                            )}
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Card size="small" style={{ borderLeft: '3px solid #52c41a', background: 'rgba(82,196,26,0.04)' }}>
                          <div style={{ fontWeight: 700, color: '#52c41a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icons.Brain /> 综合模型
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {threeModelStatus.models?.combined?.provider} · {threeModelStatus.models?.combined?.model}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {threeModelStatus.models?.combined?.api_key_set ? (
                              <Tag color="success" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Check /> 已配置</Tag>
                            ) : (
                              <Tag color="error" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Close /> 未配置</Tag>
                            )}
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  ) : (
                    <Empty description="加载中..." />
                  )}
                </Card>

                {/* AI学习 */}
                <Card title="AI学习" size="small">
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Row gutter={[12, 12]}>
                      <Col xs={24} sm={8}>
                        <Statistic title="学习条件" value="200局" suffix="历史数据" />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Statistic title="学习范围" value="按靴" suffix="不跨靴" />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Statistic title="版本限制" value="5个" suffix="最多保留" />
                      </Col>
                    </Row>
                    <Divider style={{ margin: '12px 0', borderColor: 'rgba(255,255,255,0.06)' }} />
                    <Button 
                      type="primary" 
                      icon={<Icons.Experiment />} 
                      size="large"
                      disabled={aiLearningStatus?.is_learning}
                    >
                      {aiLearningStatus?.is_learning ? '学习中...' : '开始AI学习'}
                    </Button>
                    {aiLearningStatus?.is_learning && (
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                        当前任务：{aiLearningStatus.current_task}
                      </div>
                    )}
                  </Space>
                </Card>

                {/* 模型版本列表 */}
                <Card title="模型版本管理" size="small">
                  <Table
                    dataSource={modelVersions}
                    columns={[
                      { title: '版本号', dataIndex: 'version', width: '12%' },
                      { title: '创建时间', dataIndex: 'created_at', width: '18%', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
                      { title: '样本数', dataIndex: 'training_sample_count', width: '10%', align: 'center' as const },
                      { title: '学习前准确率', dataIndex: 'accuracy_before', width: '12%', align: 'center' as const, render: (v: number) => v ? `${(v*100).toFixed(1)}%` : '-' },
                      { title: '学习后准确率', dataIndex: 'accuracy_after', width: '12%', align: 'center' as const, render: (v: number) => v ? `${(v*100).toFixed(1)}%` : '-' },
                      { title: '状态', dataIndex: 'is_active', width: '10%', align: 'center' as const, render: (v: boolean) => v ? <Tag color="green">使用中</Tag> : <Tag>未启用</Tag> },
                      { title: '使用局数', dataIndex: 'total_runs', width: '10%', align: 'center' as const },
                      { title: '命中数', dataIndex: 'hit_count', width: '10%', align: 'center' as const },
                    ]}
                    rowKey="version"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: <Empty description="暂无模型版本" /> }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'db',
            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Database /> 数据库存储</span>,
            children: (
              <Card title="数据库记录查看" size="small">
                <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                  <span>选择表：</span>
                  <Select
                    value={dbTable}
                    onChange={(v) => { setDbTable(v); setDbPage(1); }}
                    style={{ width: 160 }}
                    options={[
                      { label: '开奖记录', value: 'game_records' },
                      { label: '下注记录', value: 'bet_records' },
                      { label: '系统日志', value: 'system_logs' },
                      { label: '错题本', value: 'mistake_book' },
                    ]}
                  />
                </Space>
                <Table
                  dataSource={dbRecords}
                  columns={tableColumns}
                  rowKey="id"
                  size="small"
                  scroll={{ x: 'max-content' }}
                  pagination={{ current: dbPage, pageSize: 50, onChange: setDbPage, total: 1000 }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={changePwdVisible}
        onOk={handleChangePassword}
        onCancel={() => { if (!mustChange) setChangePwdVisible(false); }}
        okText="确认修改"
        cancelText="取消"
        closable={!mustChange}
        maskClosable={!mustChange}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ display: 'block', marginBottom: 4 }}>原密码</span>
            <Input.Password value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
          </div>
          <div>
            <span style={{ display: 'block', marginBottom: 4 }}>新密码</span>
            <Input.Password value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPage;
