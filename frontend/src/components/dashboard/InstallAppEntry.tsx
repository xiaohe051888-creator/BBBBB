import React from 'react';
import { Button } from 'antd';

type Props = {
  visible: boolean;
  onInstall: () => Promise<unknown> | unknown;
};

export function InstallAppEntry({ visible, onInstall }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <div style={{ padding: '8px 16px 0 16px' }}>
      <Button size="small" type="default" onClick={() => void onInstall()}>
        安装 App
      </Button>
    </div>
  );
}
