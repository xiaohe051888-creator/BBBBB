import re

with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'r') as f:
    content = f.read()

# Add states
state_injection = """  // 管理员登录
  const { visible: loginVisible, password: loginPassword, loading: loginLoading, openLogin, closeLogin, setPassword: setLoginPassword, handleLogin: handleAdminLogin } = useAdminLogin();

  // 学习状态
  const [microLearning, setMicroLearning] = useState<any>(null);
  const [deepLearning, setDeepLearning] = useState<any>(null);

  const handleOpenReveal = () => {"""

content = content.replace("""  // 管理员登录
  const { visible: loginVisible, password: loginPassword, loading: loginLoading, openLogin, closeLogin, setPassword: setLoginPassword, handleLogin: handleAdminLogin } = useAdminLogin();

  const handleOpenReveal = () => {""", state_injection)

# Add WS events
ws_injection = """              case 'game_revealed':
                if (data) {
                  addGameOptimistically({
                    game_number: data.game_number,
                    result: data.result,
                  } as any);
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

# Add panel props
panel_injection = """          {/* AI学习状态 */}
          <LearningStatusPanel microLearning={microLearning} deepLearning={deepLearning} systemStatus={systemState?.status} compact />"""

content = content.replace("""          {/* AI学习状态 */}
          <LearningStatusPanel  compact />""", panel_injection)

with open('/workspace/frontend/src/pages/DashboardPage.tsx', 'w') as f:
    f.write(content)

with open('/workspace/frontend/src/components/logs/index.tsx', 'r') as f:
    log_content = f.read()

log_content = log_content.replace('React.FC<any>', 'React.FC<Record<string, unknown>>')

with open('/workspace/frontend/src/components/logs/index.tsx', 'w') as f:
    f.write(log_content)

