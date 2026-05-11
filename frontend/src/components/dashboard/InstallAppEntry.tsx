import React from 'react';
import { Button } from 'antd';

import { InstallAppGuide } from './InstallAppGuide';

type Props = {
  visible: boolean;
  platform: 'android' | 'ios' | 'none';
  guideVisible: boolean;
  onInstall: () => Promise<unknown> | unknown;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
  onDismiss: () => void;
};

export function InstallAppEntry({
  visible,
  platform,
  guideVisible,
  onInstall,
  onOpenGuide,
  onCloseGuide,
  onDismiss,
}: Props) {
  if (!visible || platform === 'none') {
    return null;
  }

  const isIos = platform === 'ios';
  const handlePrimaryClick = isIos ? onOpenGuide : () => void onInstall();

  return (
    <>
      <div className="install-app-entry">
        <div className="install-app-entry-copy">
          <strong>{isIos ? '安装到桌面' : '安装 App'}</strong>
          <span>像 App 一样打开</span>
        </div>
        <div className="install-app-entry-actions">
          <Button size="small" type="default" onClick={handlePrimaryClick}>
            {isIos ? '安装到桌面' : '安装 App'}
          </Button>
          <Button size="small" type="text" onClick={onDismiss}>
            稍后
          </Button>
        </div>
      </div>
      <InstallAppGuide visible={guideVisible} onClose={onCloseGuide} />
    </>
  );
}
