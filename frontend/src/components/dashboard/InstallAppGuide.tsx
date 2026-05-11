import React from 'react';
import { Button } from 'antd';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function InstallAppGuide({ visible, onClose }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <div className="install-app-guide" role="dialog" aria-modal="false">
      <div className="install-app-guide-head">
        <strong>安装到桌面</strong>
        <Button size="small" type="text" onClick={onClose}>
          关闭
        </Button>
      </div>
      <ol className="install-app-guide-steps">
        <li>点击 Safari 的分享按钮</li>
        <li>选择“添加到主屏幕”</li>
        <li>从桌面像 App 一样打开</li>
      </ol>
    </div>
  );
}
