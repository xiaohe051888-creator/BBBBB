import React from 'react';
import { Button, Checkbox, Descriptions, Modal, Radio } from 'antd';

import type { SystemState } from '../../hooks';
import { formatUploadActionLabel } from '../../utils/beginnerCopy';

export type UploadAction = 'reset_current_boot' | 'new_boot';
export type BalanceMode = 'keep' | 'reset_default';

export type UploadConfirmValues = {
  action: UploadAction;
  balanceMode: BalanceMode;
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
  const [confirmReset, setConfirmReset] = React.useState(false);
  const isDeepLearning = systemState?.status === '深度学习中';
  const actionText = formatUploadActionLabel(action);
  const balanceText = balanceMode === 'keep' ? '保留当前余额' : '重置余额到 20000';

  React.useEffect(() => {
    if (!open) return;
    setConfirmReset(false);
    setAction(isDeepLearning ? 'new_boot' : 'reset_current_boot');
  }, [open, isDeepLearning]);

  const onOk = () => {
    if (action === 'reset_current_boot' && !confirmReset) return;
    onSubmit({ action, balanceMode });
  };

  const okText = action === 'reset_current_boot' ? '确认重做当前这靴并上传' : '确认结束当前这靴并上传';

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (submitting) return;
        onCancel();
      }}
      title="确认上传"
      width={560}
      style={{ maxWidth: 'calc(100vw - 20px)' }}
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
              { label: '重做当前这靴数据', value: 'reset_current_boot', disabled: isDeepLearning },
              { label: '结束当前这靴并开始下一靴', value: 'new_boot' },
            ]}
          />
          {isDeepLearning && (
            <div style={{ fontSize: 12, color: 'rgba(250,173,20,0.85)' }}>
              当前系统正在学习中。为了不打断流程，暂时不能重做当前这靴，只能先结束当前这靴，再把这次上传排队处理。
            </div>
          )}
        </div>

        {action === 'reset_current_boot' && (
          <Checkbox checked={confirmReset} onChange={(e) => setConfirmReset(e.target.checked)} disabled={submitting}>
            我已确认要清空当前这靴的数据（不可恢复）
          </Checkbox>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div
        style={{
          padding: '10px 12px',
          borderRadius: 12,
          border: `1px solid ${action === 'reset_current_boot' ? 'rgba(255,77,79,0.25)' : 'rgba(255,255,255,0.10)'}`,
          background: action === 'reset_current_boot' ? 'rgba(255,77,79,0.08)' : 'rgba(255,255,255,0.03)',
          color: 'rgba(255,255,255,0.85)',
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>本次操作摘要</div>
        <div>动作：{actionText}</div>
        <div>余额：{balanceText}</div>
        {action === 'reset_current_boot' && (
          <div style={{ color: 'rgba(255,255,255,0.75)' }}>
            将清空当前这靴的记录、下注、错题记录、路图和相关运行状态
          </div>
        )}
      </div>
    </Modal>
  );
};
