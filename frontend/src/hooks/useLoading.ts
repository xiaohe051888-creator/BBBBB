/**
 * 全局加载状态管理 Hook
 * 提供应用级别的加载状态控制
 */
import { useState, useCallback, useRef, useEffect } from 'react';

interface LoadingState {
  /** 是否正在加载 */
  isLoading: boolean;
  /** 加载文本 */
  text: string;
  /** 加载进度 (0-100) */
  progress?: number;
}

interface UseLoadingReturn extends LoadingState {
  /** 开始加载 */
  startLoading: (text?: string) => void;
  /** 结束加载 */
  stopLoading: () => void;
  /** 更新加载文本 */
  updateText: (text: string) => void;
  /** 更新进度 */
  updateProgress: (progress: number) => void;
  /** 包装异步函数，自动管理加载状态 */
  withLoading: <T>(promise: Promise<T>, text?: string) => Promise<T>;
}

/**
 * 全局加载状态管理 Hook
 * @returns 加载状态和控制方法
 */
export const useLoading = (): UseLoadingReturn => {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    text: '',
    progress: undefined,
  });

  // 使用 ref 存储超时定时器
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startLoading = useCallback((text: string = '加载中...') => {
    // 清除之前的超时
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState({ isLoading: true, text, progress: undefined });
  }, []);

  const stopLoading = useCallback(() => {
    // 延迟关闭，避免闪烁
    timeoutRef.current = setTimeout(() => {
      setState({ isLoading: false, text: '', progress: undefined });
    }, 200);
  }, []);

  const updateText = useCallback((text: string) => {
    setState(prev => ({ ...prev, text }));
  }, []);

  const updateProgress = useCallback((progress: number) => {
    setState(prev => ({ ...prev, progress: Math.max(0, Math.min(100, progress)) }));
  }, []);

  const withLoading = useCallback(async <T,>(promise: Promise<T>, text?: string): Promise<T> => {
    startLoading(text);
    try {
      const result = await promise;
      return result;
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  return {
    ...state,
    startLoading,
    stopLoading,
    updateText,
    updateProgress,
    withLoading,
  };
};

export default useLoading;
