import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface WorkflowStatusBarProps {
  hasPendingBet: boolean;
  hasGameData: boolean;
  analysis: {
    prediction?: string | null;
    confidence?: number;
  } | null;
  systemState: {
    status?: string;
    game_number?: number;
    pending_bet?: {
      game_number: number;
    } | null;
    next_game_number?: number;
  } | null;
  onOpenReveal: () => void;
}

export const WorkflowStatusBar: React.FC<WorkflowStatusBarProps> = ({
  hasPendingBet,
  hasGameData,
  analysis,
  systemState,
  onOpenReveal,
}) => {
  const pendingGameNumber = systemState?.pending_bet?.game_number ?? systemState?.next_game_number;

  const getStatusConfig = () => {
    if (hasPendingBet) {
      return {
        title: `第 ${pendingGameNumber} 局已下注，等待开奖结果`,
        subtitle: '请点击【开奖】按钮输入结果',
        bgColor: '#fffbe6',
        borderColor: '#ffe58f',
        textColor: '#faad14',
      };
    }
    if (analysis?.prediction && !hasPendingBet) {
      return {
        title: `AI分析完成，推荐下注：${analysis.prediction}`,
        subtitle: 'AI分析完成，系统自动下注中...',
        bgColor: '#f6ffed',
        borderColor: '#b7eb8f',
        textColor: '#52c41a',
      };
    }

    if (systemState?.status === '分析中' && !hasPendingBet) {
      return {
        title: `AI正在深度分析中...`,
        subtitle: '正在结合五路走势与历史血迹图进行三模型预测，请稍候',
        bgColor: '#e6f7ff',
        borderColor: '#91d5ff',
        textColor: '#1890ff',
      };
    }
    if (!hasGameData) {
      return {
        title: '系统已就绪，请上传开奖记录',
        subtitle: '请上传数据开始',
        bgColor: '#e6f7ff',
        borderColor: '#91d5ff',
        textColor: '#1890ff',
      };
    }
    return {
      title: `当前第 ${systemState?.game_number || 0} 局，等待下一步操作`,
      subtitle: '请根据系统状态进行相应操作',
      bgColor: '#f5f5f5',
      borderColor: '#d9d9d9',
      textColor: '#595959',
    };
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: config.textColor }]}>{config.title}</Text>
        <Text style={styles.subtitle}>{config.subtitle}</Text>
      </View>
      
      {hasGameData && systemState?.status !== '分析中' && systemState?.status !== '深度学习中' && (
        <TouchableOpacity style={styles.button} onPress={onOpenReveal}>
          <Text style={styles.buttonText}>开奖</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  button: {
    backgroundColor: '#faad14',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default WorkflowStatusBar;
