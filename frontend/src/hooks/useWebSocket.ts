/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback, useState } from 'react';
import { wsBus, type WsConnectionState } from '../services/wsBus';

interface UseWebSocketOptions {
  onStateUpdate?: (data: any) => void;
  onLog?: (data: any) => void;
  onAnalysis?: (data: any) => void;
  onGameRevealed?: (data: any) => void;
  onBetPlaced?: (data: any) => void;
  onReconnect?: () => void;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  /** 发送消息 */
  sendMessage: (message: any) => void;
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
    onReconnect,
  } = options;

  const [connectionState, setConnectionState] = useState<WsConnectionState>('closed');
  // 使用 ref 存储回调函数，避免闭包问题
  const callbacksRef = useRef({
    onStateUpdate,
    onLog,
    onAnalysis,
    onGameRevealed,
    onBetPlaced,
    onReconnect,
  });

  const hasOpenedRef = useRef(false);
  const hadDisconnectRef = useRef(false);

  // 更新回调函数 ref
  useEffect(() => {
    callbacksRef.current = {
      onStateUpdate,
      onLog,
      onAnalysis,
      onGameRevealed,
      onBetPlaced,
      onReconnect,
    };
  }, [onStateUpdate, onLog, onAnalysis, onGameRevealed, onBetPlaced, onReconnect]);

  const sendMessage = useCallback((message: any) => {
    wsBus.send(message);
  }, []);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(wsBus.subscribeMeta((meta) => {
      setConnectionState(meta.connectionState);
      if (meta.connectionState === 'open') {
        if (hadDisconnectRef.current) {
          hadDisconnectRef.current = false;
          callbacksRef.current.onReconnect?.();
        }
        hasOpenedRef.current = true;
        return;
      }
      if (meta.connectionState === 'closed') {
        if (hasOpenedRef.current) hadDisconnectRef.current = true;
      }
    }));

    if (onStateUpdate) unsubs.push(wsBus.subscribe('state_update', (data) => callbacksRef.current.onStateUpdate?.(data as any)));
    if (onLog) unsubs.push(wsBus.subscribe('log', (data) => callbacksRef.current.onLog?.(data as any)));
    if (onAnalysis) unsubs.push(wsBus.subscribe('ai_analysis', (data) => callbacksRef.current.onAnalysis?.(data as any)));
    if (onGameRevealed) unsubs.push(wsBus.subscribe('game_revealed', (data) => callbacksRef.current.onGameRevealed?.(data as any)));
    if (onBetPlaced) unsubs.push(wsBus.subscribe('bet_placed', (data) => callbacksRef.current.onBetPlaced?.(data as any)));

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [onStateUpdate, onLog, onAnalysis, onGameRevealed, onBetPlaced]);

  const reconnect = useCallback(() => {
    wsBus.reconnectNow();
  }, []);

  return {
    sendMessage,
    reconnect,
    connectionState,
  };
};

export default useWebSocket;
