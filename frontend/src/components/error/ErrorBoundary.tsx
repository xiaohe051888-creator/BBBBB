/**
 * React 错误边界组件
 * 捕获子组件渲染错误，防止整个应用崩溃
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 错误边界组件
 * 使用方法: <ErrorBoundary><YourComponent /></ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误到控制台
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });

    // 可以在这里添加错误上报逻辑
    // reportError(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 自定义错误UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Result
          status="error"
          title="组件渲染出错"
          subTitle={
            <div style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
              <p style={{ color: '#ff4d4f', fontWeight: 500 }}>
                {this.state.error?.message || '未知错误'}
              </p>
              {this.state.errorInfo && (
                <details style={{ marginTop: 16, textAlign: 'left' }}>
                  <summary style={{ cursor: 'pointer', color: '#1890ff' }}>
                    查看错误详情
                  </summary>
                  <pre
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: '#f6f8fa',
                      borderRadius: 6,
                      fontSize: 12,
                      overflow: 'auto',
                      maxHeight: 300,
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          }
          extra={[
            <Button type="primary" key="reset" onClick={this.handleReset}>
              重试
            </Button>,
            <Button key="reload" onClick={() => window.location.reload()}>
              刷新页面
            </Button>,
          ]}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * 页面级错误边界
 * 用于包裹整个页面，提供更友好的错误提示
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('PageErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d1117',
            padding: 24,
          }}
        >
          <Result
            status="500"
            title="页面出错了"
            subTitle={
              <div style={{ color: 'rgba(255,255,255,0.65)' }}>
                <p>{this.state.error?.message || '页面渲染过程中发生错误'}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                  请尝试刷新页面或返回首页
                </p>
              </div>
            }
            extra={[
              <Button
                type="primary"
                key="home"
                onClick={() => (window.location.href = '/')}
                style={{
                  background: 'linear-gradient(135deg, #1890ff, #0050b3)',
                  border: 'none',
                }}
              >
                返回首页
              </Button>,
              <Button
                key="reload"
                onClick={() => window.location.reload()}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderColor: 'rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                刷新页面
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
