import React from 'react';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { formatAdminModeName } from '../utils/beginnerCopy';

type AdminDbTable = 'game_records' | 'bet_records' | 'system_logs' | 'mistake_book';

type Row = Record<string, unknown>;

const modeTag = (value: unknown) => {
  if (value === 'ai' || value === 'single_ai' || value === 'rule') {
    const color = value === 'ai' ? 'purple' : value === 'single_ai' ? 'green' : 'blue';
    return <Tag color={color}>{formatAdminModeName(value)}</Tag>;
  }
  return value || '-';
};

export const buildAdminDbTableColumns = (table: AdminDbTable): ColumnsType<Row> => {
  if (table === 'system_logs') {
    return [
      { title: '编号', dataIndex: 'id', width: '8%' },
      { title: '时间', dataIndex: 'log_time', width: '16%' },
      { title: '事件', dataIndex: 'event_type', width: '14%' },
      { title: '优先级', dataIndex: 'priority', width: '10%', align: 'center', render: (v) => v || '-' },
      { title: '结果', dataIndex: 'event_result', width: '10%', align: 'center', render: (v) => v || '-' },
      { title: '说明', dataIndex: 'description', ellipsis: true },
    ];
  }

  if (table === 'mistake_book') {
    return [
      { title: '编号', dataIndex: 'id', width: '8%' },
      { title: '靴号', dataIndex: 'boot_number', width: '8%', align: 'center' },
      { title: '局号', dataIndex: 'game_number', width: '8%', align: 'center' },
      { title: '失误类型', dataIndex: 'error_type', width: '12%', align: 'center' },
      { title: '预测', dataIndex: 'predict_direction', width: '8%', align: 'center' },
      { title: '实际', dataIndex: 'actual_result', width: '8%', align: 'center' },
      { title: '原因分析', dataIndex: 'analysis', ellipsis: true },
    ];
  }

  if (table === 'bet_records') {
    return [
      { title: '编号', dataIndex: 'id', width: '8%' },
      { title: '靴号', dataIndex: 'boot_number', width: '8%', align: 'center' },
      { title: '局号', dataIndex: 'game_number', width: '8%', align: 'center' },
      { title: '下注方向', dataIndex: 'bet_direction', width: '10%', align: 'center' },
      { title: '下注金额', dataIndex: 'bet_amount', width: '12%', align: 'center' },
      { title: '状态', dataIndex: 'status', width: '10%', align: 'center' },
      { title: '结算金额', dataIndex: 'settlement_amount', width: '12%', align: 'center' },
      { title: '模式', dataIndex: 'prediction_mode', width: '12%', align: 'center', render: modeTag },
    ];
  }

  return [
    { title: '编号', dataIndex: 'id', width: '8%' },
    { title: '靴号', dataIndex: 'boot_number', width: '8%', align: 'center' },
    { title: '局号', dataIndex: 'game_number', width: '8%', align: 'center' },
    { title: '结果', dataIndex: 'result', width: '8%', align: 'center' },
    { title: '预测', dataIndex: 'predict_direction', width: '8%', align: 'center' },
    {
      title: '正确',
      dataIndex: 'predict_correct',
      width: '8%',
      align: 'center',
      render: (v) => (v === null || v === undefined ? '-' : v ? '是' : '否'),
    },
    { title: '盈亏', dataIndex: 'profit_loss', width: '12%', align: 'center' },
    { title: '余额', dataIndex: 'balance_after', width: '12%', align: 'center' },
    { title: '模式', dataIndex: 'prediction_mode', width: '12%', align: 'center', render: modeTag },
  ];
};
