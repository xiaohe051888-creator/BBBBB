import re

with open('/workspace/frontend/src/components/dashboard/WorkflowStatusBar.tsx', 'r') as f:
    content = f.read()

new_block = """
    if (systemState?.status === '分析中' && !hasPendingBet) {
      return {
        icon: <BulbIcon style={{ animation: 'spin 2s linear infinite' }} />,
        iconColor: '#1890ff',
        title: `AI正在深度分析中...`,
        subtitle: '正在结合五路走势与历史血迹图进行三模型预测，请稍候',
        bgGradient: 'linear-gradient(135deg, rgba(24,144,255,0.15), rgba(24,144,255,0.08))',
        borderColor: 'rgba(24,144,255,0.25)',
      };
    }
    if (!hasGameData) {
"""

content = content.replace("    if (!hasGameData) {", new_block)

with open('/workspace/frontend/src/components/dashboard/WorkflowStatusBar.tsx', 'w') as f:
    f.write(content)
