/**
 * Dashboard 组件导出
 */
export { default as RevealModal } from './RevealModal';
export { default as LoginModal } from './LoginModal';

// 拆分后的子组件
export { DashboardHeader } from './DashboardHeader';
export { WorkflowStatusBar } from './WorkflowStatusBar';
export { AnalysisPanel } from './AnalysisPanel';

// 兼容旧导入（已废弃，请使用新组件名）
export { DashboardHeader as TopStatusBar } from './DashboardHeader';
export { WorkflowStatusBar as WorkflowBar } from './WorkflowStatusBar';
