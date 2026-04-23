/**
 * WebSocket 连接管理 Hook
 * 统一管理 WebSocket 连接、重连和消息处理
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import * as api from '../services/api';

interface WebSocketMessage {
  type: string;
  table_id?: string;
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
 * WebSocket 连接管理 Hook
 * @param options 配置选项
 * @returns WebSocket 操作方法
 */
export const useWebSocket = (options: UseWebSocketOptions): UseWebSocketReturn => {
  const { onStateUpdate,
    onLog,
    onAnalysis,
    onGameRevealed,
    onBetPlaced,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);
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

  // 建立连接 - 在 useEffect 中定义 connect 避免渲染时访问 ref
  useEffect(() => {
    isUnmountedRef.current = false;
    // 使用setTimeout避免同步setState
    const stateTimer = setTimeout(() => {
      setConnectionState('connecting');
    }, 0);

    const connect = () => {
      if (isUnmountedRef.current) return;

      try {
        const ws = api.createWebSocket();
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionState('open');
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
          if (!isUnmountedRef.current) {
            reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
          }
        };
      } catch {
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
