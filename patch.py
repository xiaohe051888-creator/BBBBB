import re

file_path = '/workspace/frontend/src/pages/DashboardPage.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# 1. log
content = content.replace(
    "case 'log':\n                if (data) addLogOptimistically( data);\n                break;",
    "case 'log':\n                if (data) {\n                  addLogOptimistically( data);\n                  queryClient.invalidateQueries({ queryKey: ['logs'] });\n                }\n                break;"
)

# 2. bet_placed
content = content.replace(
    "status: '等待开奖',\n                  });\n                }\n                break;",
    "status: '等待开奖',\n                  });\n                  queryClient.invalidateQueries({ queryKey: ['bets'] });\n                  queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });\n                }\n                break;"
)

# 3. game_revealed
content = content.replace(
    "status: '分析中',\n                  });\n                }\n                break;",
    "status: '分析中',\n                  });\n                  queryClient.invalidateQueries({ queryKey: ['games'] });\n                  queryClient.invalidateQueries({ queryKey: ['bets'] });\n                  queryClient.invalidateQueries({ queryKey: queryKeys.roads() });\n                  queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });\n                  queryClient.invalidateQueries({ queryKey: queryKeys.stats() });\n                }\n                break;"
)

# 4. ai_analysis
content = content.replace(
    "bet_amount: data.bet_amount || null,\n                  });\n                }\n                break;",
    "bet_amount: data.bet_amount || null,\n                  });\n                  queryClient.invalidateQueries({ queryKey: queryKeys.analysis() });\n                  queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });\n                }\n                break;"
)

# 5. state_update
content = content.replace(
    "game_number: data.game_number,\n                  });\n                }\n                break;",
    "game_number: data.game_number,\n                  });\n                  queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });\n                }\n                break;"
)

# 6. useEffect deps
content = content.replace(
    "}, [ addLogOptimistically, addBetOptimistically, updateBetOptimistically, addGameOptimistically, updateRoadsOptimistically, updateStateOptimistically, updateAnalysisOptimistically]);",
    "}, [ addLogOptimistically, addBetOptimistically, updateBetOptimistically, addGameOptimistically, updateRoadsOptimistically, updateStateOptimistically, updateAnalysisOptimistically, queryClient]);"
)

# 7. Remove unused timer states
content = re.sub(
    r"  // 工作流计时器\n  const \[timer, setTimer\] = useState<TimerState>\(\{ remaining: 0 \}\);\n  const \[formattedTime, setFormattedTime\] = useState\('00:00'\);\n\n  useEffect\(\(\) => \{\n    const interval = setInterval\(\(\) => \{\n      setTimer\(prev => \(\{ remaining: Math\.max\(0, prev\.remaining - 1\) \}\)\);\n    \}, 1000\);\n    return \(\) => clearInterval\(interval\);\n  \}, \[\]\);\n\n  useEffect\(\(\) => \{\n    const mins = Math\.floor\(timer\.remaining / 60\);\n    const secs = timer\.remaining % 60;\n    setFormattedTime\(`\$\{mins\.toString\(\)\.padStart\(2, '0'\)\}:\$\{secs\.toString\(\)\.padStart\(2, '0'\)\}`\);\n  \}, \[timer\.remaining\]\);\n",
    "",
    content
)

# 8. Use useWaitTimer to pass timer to WorkflowStatusBar
content = content.replace(
    "  // 等待开奖计时器\n  const hasPendingBet = !!systemState?.pending_bet;\n  // pendingGameNumber暂未使用\n  void systemState?.pending_bet?.game_number;\n  useWaitTimer({ enabled: hasPendingBet });",
    "  // 等待开奖计时器\n  const hasPendingBet = !!systemState?.pending_bet;\n  // pendingGameNumber暂未使用\n  void systemState?.pending_bet?.game_number;\n  const { seconds: waitSeconds, formattedTime: waitFormattedTime } = useWaitTimer({ enabled: hasPendingBet });"
)

content = content.replace(
    "timer={timer}\n        formattedTime={formattedTime}",
    "timer={{ remaining: waitSeconds }}\n        formattedTime={waitFormattedTime}"
)

with open(file_path, 'w') as f:
    f.write(content)

print('Patched DashboardPage.tsx')
