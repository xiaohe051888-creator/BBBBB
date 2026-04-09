/**
 * 管理员页面 - AI学习 & 数据库查看（手动模式）
 * 移除爬虫相关功能，专注AI模型管理和数据查看
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Card, Button, Table, Tag, Space, Input, Modal, message,
  Select, Tabs, Empty, Statistic, Row, Col, Divider,
} from 'antd';
import {
  ExperimentOutlined, DatabaseOutlined, ArrowLeftOutlined,
  KeyOutlined, RobotOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import * as api from '../services/api';
import { clearToken } from '../services/api';

const AdminPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = (location.state as any)?.token || api.getToken();
  
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
    }
  };

  const tableColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '桌号', dataIndex: 'table_id', width: 60 },
    { title: '靴号', dataIndex: 'boot_number', width: 60 },
    { title: '局号', dataIndex: 'game_number', width: 60 },
    { title: '结果', dataIndex: 'result', width: 60 },
    { title: '预测', dataIndex: 'predict_direction', width: 60 },
    { title: '正确', dataIndex: 'predict_correct', width: 60, render: (v: boolean | null) => v === null ? '-' : v ? '✓' : '✗' },
    { title: '盈亏', dataIndex: 'profit_loss', width: 80 },
    { title: '余额', dataIndex: 'balance_after', width: 100 },
  ];

  return (
    <div className="page-wrapper">
      {/* 顶部 */}
      <div className="page-nav-bar">
        <div className="page-nav-left">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回启动页</Button>
          <span className="page-nav-title">管理员后台</span>
          <Tag color="blue">手动模式</Tag>
        </div>
        <div className="page-nav-right">
          <Button icon={<KeyOutlined />} onClick={() => setChangePwdVisible(true)}>修改密码</Button>
          <Button danger onClick={() => { clearToken(); navigate('/'); }}>退出登录</Button>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'ai',
            label: <span><RobotOutlined /> AI大模型</span>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 三模型状态 */}
                <Card title="三模型状态">
                  {threeModelStatus ? (
                    <Row gutter={[16, 16]}>
                      <Col span={8}>
                        <Card size="small" style={{ borderLeft: '3px solid #ff4d4f', background: 'rgba(255,77,79,0.04)' }}>
                          <div style={{ fontWeight: 700, color: '#ff4d4f', marginBottom: 8 }}>🔴 庄模型</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {threeModelStatus.models?.banker?.provider} · {threeModelStatus.models?.banker?.model}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {threeModelStatus.models?.banker?.api_key_set ? (
                              <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
                            ) : (
                              <Tag color="error">未配置</Tag>
                            )}
                          </div>
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" style={{ borderLeft: '3px solid #1890ff', background: 'rgba(24,144,255,0.04)' }}>
                          <div style={{ fontWeight: 700, color: '#1890ff', marginBottom: 8 }}>🔵 闲模型</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {threeModelStatus.models?.player?.provider} · {threeModelStatus.models?.player?.model}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {threeModelStatus.models?.player?.api_key_set ? (
                              <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
                            ) : (
                              <Tag color="error">未配置</Tag>
                            )}
                          </div>
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" style={{ borderLeft: '3px solid #52c41a', background: 'rgba(82,196,26,0.04)' }}>
                          <div style={{ fontWeight: 700, color: '#52c41a', marginBottom: 8 }}>🧠 综合模型</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {threeModelStatus.models?.combined?.provider} · {threeModelStatus.models?.combined?.model}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {threeModelStatus.models?.combined?.api_key_set ? (
                              <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
                            ) : (
                              <Tag color="error">未配置</Tag>
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
                <Card title="AI学习">
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic title="学习条件" value="200局" suffix="历史数据" />
                      </Col>
                      <Col span={8}>
                        <Statistic title="学习范围" value="按靴" suffix="不跨靴" />
                      </Col>
                      <Col span={8}>
                        <Statistic title="版本限制" value="5个" suffix="最多保留" />
                      </Col>
                    </Row>
                    <Divider style={{ margin: '12px 0', borderColor: 'rgba(255,255,255,0.06)' }} />
                    <Button 
                      type="primary" 
                      icon={<ExperimentOutlined />} 
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
                <Card title="模型版本管理">
                  <Table
                    dataSource={modelVersions}
                    columns={[
                      { title: '版本号', dataIndex: 'version', width: 120 },
                      { title: '创建时间', dataIndex: 'created_at', width: 180, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
                      { title: '样本数', dataIndex: 'training_sample_count', width: 80 },
                      { title: '学习前准确率', dataIndex: 'accuracy_before', width: 100, render: (v: number) => v ? `${(v*100).toFixed(1)}%` : '-' },
                      { title: '学习后准确率', dataIndex: 'accuracy_after', width: 100, render: (v: number) => v ? `${(v*100).toFixed(1)}%` : '-' },
                      { title: '状态', dataIndex: 'is_active', width: 80, render: (v: boolean) => v ? <Tag color="green">使用中</Tag> : <Tag>未启用</Tag> },
                      { title: '使用局数', dataIndex: 'total_runs', width: 80 },
                      { title: '命中数', dataIndex: 'hit_count', width: 80 },
                    ]}
                    rowKey="version"
                    size="small"
                    pagination={false}
                    scroll={{ x: 800 }}
                    locale={{ emptyText: <Empty description="暂无模型版本" /> }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'db',
            label: <span><DatabaseOutlined /> 数据库存储</span>,
            children: (
              <Card title="数据库记录查看">
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
                  scroll={{ x: 900 }}
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
