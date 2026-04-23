import re

with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'r') as f:
    content = f.read()

# Add states for micro and deep learning
state_injection = """  // 登录弹窗
  const [loginVisible, setLoginVisible] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // 学习状态
  const [microLearning, setMicroLearning] = useState<any>(null);
  const [deepLearning, setDeepLearning] = useState<any>(null);
"""

content = re.sub(r'  // 登录弹窗.*?const \[loginLoading, setLoginLoading\] = useState\(false\);', state_injection, content, flags=re.DOTALL)

# Add websocket handlers
ws_injection = """              case 'game_revealed':
                if (data) {
                  addGameOptimistically( {
                    game_number: data.game_number,
                    result: data.result,
                  });
                  queryClient.invalidateQueries({ queryKey: ['games'] });
                  queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
                }
                break;
              case 'micro_learning':
                setMicroLearning(data);
                break;
              case 'deep_learning_started':
              case 'deep_learning_progress':
              case 'deep_learning_completed':
              case 'deep_learning_failed':
                setDeepLearning(data);
                if (data.status === '完成' || data.status === '失败') {
                  queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
                }
                break;"""

content = re.sub(r'              case \'game_revealed\':.*?queryClient.invalidateQueries\(\{ queryKey: queryKeys.systemState\(\) \}\);\n                \}\n                break;', ws_injection, content, flags=re.DOTALL)

# Pass props to LearningStatusPanel
panel_injection = """          {/* AI学习状态 */}
          <LearningStatusPanel microLearning={microLearning} deepLearning={deepLearning} systemStatus={systemState?.status} compact />"""

content = content.replace("          {/* AI学习状态 */}\n          <LearningStatusPanel  compact />", panel_injection)

with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'w') as f:
    f.write(content)
