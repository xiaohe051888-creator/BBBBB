import React from 'react';
import { Button } from 'antd';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function InstallAppHelp({ visible, onClose }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <div className="install-app-guide" role="dialog" aria-modal="false">
      <div className="install-app-guide-head">
        <strong>安装 App</strong>
        <Button size="small" type="text" onClick={onClose}>
          关闭
        </Button>
      </div>
      <ol className="install-app-guide-steps">
        <li>当前浏览器暂时没有返回安装能力</li>
        <li>请继续使用 Chrome 打开本站，不要放在内嵌浏览器里</li>
        <li>可尝试从浏览器菜单选择“安装应用”或“添加到主屏幕”</li>
        <li>如果仍没有入口，说明当前会话暂时不支持直接拉起安装</li>
      </ol>
    </div>
  );
}
