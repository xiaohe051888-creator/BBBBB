/**
 * 管理员页面 - AI学习 & 数据库查看
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Card, Button, Table, Tag, Space, Statistic, Input, Modal, message,
  Select, Progress, Descriptions, Tabs, Empty,
} from 'antd';
import {
  ExperimentOutlined, DatabaseOutlined, ArrowLeftOutlined,
  LockOutlined, KeyOutlined, HistoryOutlined,
} from '@ant-design/icons';
import * as api from '../services/api';

const AdminPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const token = (location.state as any)?.token;
  
  const [activeTab, setActiveTab] = useState('ai');
  const [modelVersions, setModelVersions] = useState<any[]>([]);
  const [dbRecords, setDbRecords] = useState<any[]>([]);
  const [dbTable, setDbTable] = useState('game_records');
  const [dbPage, setDbPage] = useState(1);
  
  // 修改密码弹窗
  const [changePwdVisible, setChangePwdVisible] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [mustChange, setMustChange] = useState((location.state as any)?.mustChangePassword || false);
  
  // 强制修改密码
  useEffect(() => {
    if (mustChange) setChangePwdVisible(true);
  }, [mustChange]);

  const loadModelVersions = async () => {
    try {
      const res = await api.getModelVersions();
      setModelVersions(res.data.data || []);
    } catch {}
  };

  const loadDbRecords = async () => {
    try {
      const res = await api.getDatabaseRecords(dbTable, dbPage);
      setDbRecords(res.data.data || []);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'ai') loadModelVersions();
    if (activeTab === 'db') loadDbRecords();
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
    } catch (err: any) {
      message.error(err.response?.data?.detail || '修改失败');
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
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: 24 }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回启动页</Button>
          <span style={{ fontSize: 18, fontWeight: 600 }}>管理员后台</span>
        </Space>
        <Space>
          <Button icon={<KeyOutlined />} onClick={() => setChangePwdVisible(true)}>修改密码</Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'ai',
            label: <span><ExperimentOutlined /> AI大模型</span>,
            children: (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* AI学习 */}
                <Card title="AI学习" style={{ gridColumn: 'span 2' }}>
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Descriptions size="small" bordered>
                      <Descriptions.Item label="学习条件">数据库历史有效局总量需达到200局</Descriptions.Item>
                      <Descriptions.Item label="学习范围">按靴执行，不跨靴混样</Descriptions.Item>
                      <Descriptions.Item label="版本限制">最多保留5个版本</Descriptions.Item>
                    </Descriptions>
                    <Button type="primary" icon={<ExperimentOutlined />} size="large">
                      开始AI学习
                    </Button>
                  </Space>
                </Card>

                {/* 模型版本列表 */}
                <Card title="模型版本管理" style={{ gridColumn: 'span 2' }}>
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
                <Space style={{ marginBottom: 16 }}>
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
                  scroll={{ x: 1200 }}
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
