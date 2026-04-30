import React from 'react';
import { Button, Checkbox, Descriptions, Modal, Radio, Switch } from 'antd';

import type { SystemState } from '../../hooks';

export type UploadAction = 'reset_current_boot' | 'new_boot';
export type BalanceMode = 'keep' | 'reset_default';

export type UploadConfirmValues = {
  action: UploadAction;
  balanceMode: BalanceMode;
  runDeepLearning: boolean;
};

type Props = {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: UploadConfirmValues) => void;
  systemState: SystemState | null | undefined;
  gamesCount: number;
  submitting: boolean;
};

export const UploadConfirmModal: React.FC<Props> = ({
  open,
  onCancel,
  onSubmit,
  systemState,
  gamesCount,
  submitting,
}) => {
  const [action, setAction] = React.useState<UploadAction>('reset_current_boot');
  const [balanceMode, setBalanceMode] = React.useState<BalanceMode>('keep');
  const [runDeepLearning, setRunDeepLearning] = React.useState(true);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const predictionMode = systemState?.prediction_mode || 'ai';

  React.useEffect(() => {
    if (!open) return;
    setConfirmReset(false);
    setRunDeepLearning(predictionMode === 'ai');
  }, [open]);

  React.useEffect(() => {
    if (predictionMode !== 'ai') {
      setRunDeepLearning(false);
    }
  }, [predictionMode]);

  const onOk = () => {
    if (action === 'reset_current_boot' && !confirmReset) return;
    onSubmit({ action, balanceMode, runDeepLearning });
  };

  const okText = action === 'reset_current_boot' ? '确认覆盖本靴并上传' : '确认结束本靴并上传';

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (submitting) return;
        onCancel();
      }}
      title="确认上传"
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={submitting}>
          取消
        </Button>,
        <Button
          key="ok"
          type="primary"
          danger={action === 'reset_current_boot'}
          disabled={action === 'reset_current_boot' && !confirmReset}
          onClick={onOk}
          loading={submitting}
        >
          {okText}
        </Button>,
      ]}
    >
      <Descriptions
        size="small"
        column={1}
        items={[
          { label: '当前靴号', children: systemState?.boot_number ?? '-' },
          { label: '当前已开局', children: systemState?.game_number ?? '-' },
          { label: '将写入局数', children: gamesCount },
          { label: '当前余额', children: systemState?.balance?.toLocaleString?.() ?? systemState?.balance ?? '-' },
        ]}
      />

      <div style={{ height: 12 }} />

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>余额处理</div>
          <Radio.Group
            value={balanceMode}
            onChange={(e) => setBalanceMode(e.target.value)}
            options={[
              { label: '保留当前余额', value: 'keep' },
              { label: '重置余额到 20000', value: 'reset_default' },
            ]}
          />
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>提交动作</div>
          <Radio.Group
            value={action}
            onChange={(e) => {
              const next = e.target.value as UploadAction;
              setAction(next);
              setConfirmReset(false);
            }}
            options={[
              { label: '重置本靴（覆盖本靴）', value: 'reset_current_boot' },
              { label: '结束本靴（开启新靴）', value: 'new_boot' },
            ]}
          />
        </div>

        {action === 'new_boot' && predictionMode === 'ai' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'grid', gap: 2 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>执行深度学习（end_boot）</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>关闭后进入快速实验模式</div>
            </div>
            <Switch checked={runDeepLearning} onChange={setRunDeepLearning} disabled={submitting} />
          </div>
        )}

        {action === 'new_boot' && predictionMode !== 'ai' && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            当前为规则模式，深度学习不可用，将直接开启新靴并写入数据
          </div>
        )}

        {action === 'reset_current_boot' && (
          <Checkbox checked={confirmReset} onChange={(e) => setConfirmReset(e.target.checked)} disabled={submitting}>
            我已确认将清空本靴数据（不可恢复）
          </Checkbox>
        )}
      </div>
    </Modal>
  );
};
