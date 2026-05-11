import React from 'react';
import { Button } from 'antd';

import { InstallAppGuide } from './InstallAppGuide';
import { InstallAppHelp } from './InstallAppHelp';

type Props = {
  visible: boolean;
  platform: 'android-ready' | 'android-help' | 'ios';
  guideVisible: boolean;
  helpVisible: boolean;
  onInstall: () => Promise<unknown> | unknown;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
  onOpenHelp: () => void;
  onCloseHelp: () => void;
};

export function InstallAppEntry({
  visible,
  platform,
  guideVisible,
  helpVisible,
  onInstall,
  onOpenGuide,
  onCloseGuide,
  onOpenHelp,
  onCloseHelp,
}: Props) {
  if (!visible) {
    return null;
  }

  const isIos = platform === 'ios';
  const isAndroidHelp = platform === 'android-help';
  const handlePrimaryClick = isIos
    ? onOpenGuide
    : isAndroidHelp
      ? onOpenHelp
      : () => void onInstall();

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
        </div>
      </div>
      <InstallAppGuide visible={guideVisible} onClose={onCloseGuide} />
      <InstallAppHelp visible={helpVisible} onClose={onCloseHelp} />
    </>
  );
}
