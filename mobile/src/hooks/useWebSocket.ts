import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { queryClient, queryKeys } from '../lib/queryClient';
import * as api from '../services/api';

interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

interface UseWebSocketOptions {
  onStateUpdate?: (data: Record<string, unknown>) => void;
  onLog?: () => void;
  onAnalysis?: (data: Record<string, unknown>) => void;
  onGameRevealed?: () => void;
  onBetPlaced?: () => void;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  /** 发送消息 */
  sendMessage: (message: unknown) => void;
  /** 手动重连 */
  reconnect: () => void;
  /** 连接状态 */
  connectionState: 'connecting' | 'open' | 'closing' | 'closed';
}

/**
 * WebSocket 连接管理 Hook (React Native 版)
 * @param options 配置选项
 * @returns WebSocket 操作方法
 */
export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const { 
    onStateUpdate,
    onLog,
    onAnalysis,
    onGameRevealed,
    onBetPlaced,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);
  const appState = useRef(AppState.currentState);

  // 使用 state 触发重连
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closing' | 'closed'>('closed');
  
  // 使用 ref 存储回调函数，避免闭包问题
  const callbacksRef = useRef({
    onStateUpdate,
    onLog,
    onAnalysis,
    onGameRevealed,
    onBetPlaced,
  });

  // 更新回调函数 ref
  useEffect(() => {
    callbacksRef.current = {
      onStateUpdate,
      onLog,
      onAnalysis,
      onGameRevealed,
      onBetPlaced,
    };
  }, [onStateUpdate, onLog, onAnalysis, onGameRevealed, onBetPlaced]);

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // 监听 AppState 变化（前后台切换）
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App 回到前台，检查 WS 状态并强制重连
        console.log('[WebSocket] App 回到前台，触发重连');
        setReconnectTrigger(prev => prev + 1);
        
        // 同时触发全量数据刷新，防止后台期间遗漏 WebSocket 消息
        queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
        queryClient.invalidateQueries({ queryKey: queryKeys.roads() });
        queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
        queryClient.invalidateQueries({ queryKey: queryKeys.analysis() });
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 建立连接
  useEffect(() => {
    isUnmountedRef.current = false;
    
    // 使用setTimeout避免同步setState
    const stateTimer = setTimeout(() => {
      setConnectionState('connecting');
    }, 0);

    const connect = async () => {
      if (isUnmountedRef.current) return;

      try {
        // React Native 中的 createWebSocket 是 async 的，因为需要从 AsyncStorage 获取 token
        const ws = await api.createWebSocket();
        
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionState('open');
          console.log('[WebSocket] 连接已建立');
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            const callbacks = callbacksRef.current;

            switch (message.type) {
              case 'state_update':
                callbacks.onStateUpdate?.(message.data);
                break;
              case 'log':
                callbacks.onLog?.();
                break;
              case 'ai_analysis':
                callbacks.onAnalysis?.(message.data);
                break;
              case 'game_revealed':
                callbacks.onGameRevealed?.();
                break;
              case 'bet_placed':
                callbacks.onBetPlaced?.();
                break;
              default:
                // 未知消息类型，静默处理
                break;
            }
          } catch (err) {
            console.error('[WebSocket] 消息解析错误:', err);
          }
        };

        ws.onerror = (err) => {
          console.error('[WebSocket] 连接错误:', err);
        };

        ws.onclose = () => {
          setConnectionState('closed');
          console.log('[WebSocket] 连接已关闭');
          if (!isUnmountedRef.current) {
            reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
          }
        };
      } catch (err) {
        console.error('[WebSocket] 创建连接失败:', err);
        setConnectionState('closed');
        if (!isUnmountedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, reconnectInterval + 2000);
        }
      }
    };

    connect();

    return () => {
      clearTimeout(stateTimer);
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [reconnectInterval, reconnectTrigger]);

  const reconnect = useCallback(() => {
    console.log('[WebSocket] 手动触发重连');
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    // 触发 useEffect 重新执行
    setReconnectTrigger(prev => prev + 1);
  }, []);

  return {
    sendMessage,
    reconnect,
    connectionState,
  };
};

export default useWebSocket;
