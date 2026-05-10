import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('admin mobile layout regressions', () => {
  it('keeps the user toolbar on the shared mobile fill control class', () => {
    const source = readFileSync(resolve(__dirname, './AdminPage.tsx'), 'utf8');

    expect(source).toMatch(/className="mobile-fill-control admin-users-search"[\s\S]*placeholder="搜索用户名"/);
    expect(source).toMatch(/<Button className="mobile-fill-control" size="small" onClick=\{loadUsers\}/);
  });

  it('adds a dedicated empty-state override for mobile card tables', () => {
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(css).toContain('.mobile-card-table .ant-table-placeholder');
    expect(css).toContain('.mobile-card-table .ant-table-placeholder > td');
    expect(css).toMatch(/\.mobile-card-table \.ant-table-tbody > \.ant-table-placeholder \{[\s\S]*background: transparent !important;[\s\S]*border: none !important;/);
  });

  it('makes mobile action rows stretch inner antd controls to full width', () => {
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(css).toContain('.mobile-action-row > .ant-space-item');
    expect(css).toContain('.mobile-action-row > .ant-space-item > .ant-btn');
    expect(css).toContain('.mobile-action-row > .ant-space-item > .ant-input');
    expect(css).toContain('.mobile-action-row > .ant-space-item > .ant-input-affix-wrapper');
    expect(css).toContain('.mobile-action-row > .ant-space-item > .ant-select');
  });

  it('prevents mobile card tables from rendering summary rows as broken cards', () => {
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(css).toContain('.mobile-card-table .ant-table-summary');
    expect(css).toMatch(/\.mobile-card-table \.ant-table-tbody > tr > td \{[\s\S]*display: flex !important;[\s\S]*background: transparent !important;/);
  });

  it('keeps mode select cards and upload layout on shared mobile layout classes', () => {
    const modeSelect = readFileSync(resolve(__dirname, './ModeSelectPage.tsx'), 'utf8');
    const upload = readFileSync(resolve(__dirname, './UploadDataPage.tsx'), 'utf8');
    const roadmap = readFileSync(resolve(__dirname, './RoadMapPage.tsx'), 'utf8');

    expect(modeSelect).toContain('mode-select-option');
    expect(modeSelect).toContain('mode-select-option-action');
    expect(upload).toContain('upload-workspace');
    expect(upload).toContain('upload-sequence-panel');
    expect(roadmap).toContain('roadmap-chart-shell');
  });

  it('defines shared mobile overrides for mode select, upload workspace, and roadmap shells', () => {
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(css).toContain('.mode-select-option');
    expect(css).toContain('.mode-select-option-action');
    expect(css).toContain('.upload-workspace');
    expect(css).toContain('.upload-sequence-panel');
    expect(css).toContain('.roadmap-chart-shell');
  });

  it('keeps dashboard, upload, and roadmap high-risk sections on shared layout classes', () => {
    const dashboard = readFileSync(resolve(__dirname, './DashboardPage.tsx'), 'utf8');
    const upload = readFileSync(resolve(__dirname, './UploadDataPage.tsx'), 'utf8');
    const roadmap = readFileSync(resolve(__dirname, './RoadMapPage.tsx'), 'utf8');

    expect(dashboard).toContain('dashboard-version-row');
    expect(dashboard).toContain('dashboard-version-badge');
    expect(upload).toContain('upload-header');
    expect(upload).toContain('upload-status-bar');
    expect(upload).toContain('upload-summary-badge');
    expect(roadmap).toContain('roadmap-analysis-shell');
  });

  it('defines shared mobile overrides for dashboard version row, upload status bar, and roadmap analysis shell', () => {
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(css).toContain('.dashboard-version-row');
    expect(css).toContain('.dashboard-version-badge');
    expect(css).toContain('.upload-header');
    expect(css).toContain('.upload-status-bar');
    expect(css).toContain('.upload-summary-badge');
    expect(css).toContain('.roadmap-analysis-shell');
  });

  it('marks admin table cards and flattens nested mobile table shells', () => {
    const adminPage = readFileSync(resolve(__dirname, './AdminPage.tsx'), 'utf8');
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(adminPage).toContain('className="admin-table-card"');
    expect(css).toContain('.admin-table-card,');
    expect(css).toContain('.admin-table-card .ant-card-body');
    expect(css).toContain('.admin-table-card .mobile-card-table .ant-table-container');
    expect(css).toContain('.admin-table-card .mobile-card-table .ant-table-placeholder .ant-empty');
  });

  it('keeps user-facing data tables on shared mobile flattening classes', () => {
    const gameTable = readFileSync(resolve(__dirname, '../components/tables/GameTable.tsx'), 'utf8');
    const betTable = readFileSync(resolve(__dirname, '../components/tables/BetTable.tsx'), 'utf8');
    const logTable = readFileSync(resolve(__dirname, '../components/tables/LogTable.tsx'), 'utf8');
    const betRecords = readFileSync(resolve(__dirname, './BetRecordsPage.tsx'), 'utf8');
    const mistakes = readFileSync(resolve(__dirname, './MistakeBookPage.tsx'), 'utf8');
    const roadmap = readFileSync(resolve(__dirname, './RoadMapPage.tsx'), 'utf8');
    const logs = readFileSync(resolve(__dirname, './LogsPage.tsx'), 'utf8');
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(gameTable).toContain('mobile-card-table dashboard-game-table user-data-table');
    expect(betTable).toContain('mobile-card-table dashboard-bet-table user-data-table');
    expect(logTable).toContain('mobile-card-table dashboard-log-table user-data-table');
    expect(betRecords).toContain('className="mobile-data-card"');
    expect(betRecords).toContain('className="mobile-card-table user-data-table"');
    expect(mistakes).toContain('className="mobile-data-card"');
    expect(mistakes).toContain('className="mobile-card-table user-data-table"');
    expect(roadmap).toContain('className="roadmap-raw-shell mobile-data-card"');
    expect(roadmap).toContain('className="mobile-card-table user-data-table"');
    expect(logs).toContain('className="mobile-data-card"');
    expect(logs).toContain('className="mobile-card-table user-data-table"');
    expect(logs).toContain("'data-label'");
    expect(css).toContain('.mobile-data-card {');
    expect(css).toContain('.mobile-data-card .ant-card-body');
    expect(css).toContain('.mobile-data-card .user-data-table .ant-table-container');
    expect(css).toContain('.mobile-data-card .user-data-table .ant-table-placeholder .ant-empty');
    expect(css).toContain('.mobile-card-table.user-data-table .ant-table-container');
  });

  it('keeps dashboard roadmap, progress, and analysis sections on dedicated mobile card classes', () => {
    const dashboard = readFileSync(resolve(__dirname, './DashboardPage.tsx'), 'utf8');
    const analysisPanel = readFileSync(resolve(__dirname, '../components/dashboard/AnalysisPanel.tsx'), 'utf8');
    const learningPanel = readFileSync(resolve(__dirname, '../components/LearningStatusPanel.tsx'), 'utf8');
    const fiveRoadChart = readFileSync(resolve(__dirname, '../components/roads/FiveRoadChart.tsx'), 'utf8');
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(dashboard).toContain('className="road-card dashboard-section-card dashboard-road-card"');
    expect(dashboard).toContain('className="progress-card dashboard-section-card dashboard-progress-card"');
    expect(analysisPanel).toContain('className="analysis-card dashboard-section-card dashboard-analysis-card"');
    expect(learningPanel).toContain('className="learning-status-card"');
    expect(fiveRoadChart).toContain('className="five-road-chart"');
    expect(fiveRoadChart).toContain('const renderRoadCard = (');
    expect(css).toContain('.dashboard-section-card {');
    expect(css).toContain('.dashboard-road-card {');
    expect(css).toContain('.dashboard-progress-card {');
    expect(css).toContain('.dashboard-analysis-card {');
    expect(css).toContain('.learning-status-card,');
    expect(css).toContain('.five-road-chart {');
    expect(css).toContain('.five-road-chart .roadmap-board-card {');
  });

  it('uses compact one-line mobile labels for bet record cards instead of long wrapped labels', () => {
    const betRecords = readFileSync(resolve(__dirname, './BetRecordsPage.tsx'), 'utf8');
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(betRecords).toContain("mobileLabel: '方向'");
    expect(betRecords).toContain("mobileLabel: '开奖'");
    expect(css).toContain('.bet-records-page .mobile-card-table .ant-table-tbody > tr > td::before');
    expect(css).toContain('white-space: nowrap !important;');
  });

  it('uses a compact profit summary card and simplified bet detail sheet for mobile ux', () => {
    const betRecords = readFileSync(resolve(__dirname, './BetRecordsPage.tsx'), 'utf8');
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(betRecords).toContain('className="mobile-status-card bet-summary-card"');
    expect(betRecords).toContain('className="bet-summary-pill-row"');
    expect(betRecords).toContain('className="bet-summary-stat-row"');
    expect(betRecords).toContain('className="bet-detail-sheet"');
    expect(betRecords).toContain('className="bet-detail-primary-grid"');
    expect(betRecords).toContain('className="bet-detail-list"');
    expect(css).toContain('.bet-summary-card {');
    expect(css).toContain('.bet-detail-sheet {');
  });

  it('renders each road as its own full-width row on mobile', () => {
    const fiveRoadChart = readFileSync(resolve(__dirname, '../components/roads/FiveRoadChart.tsx'), 'utf8');
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(fiveRoadChart).not.toContain('className="five-road-chart-secondary-row"');
    expect(fiveRoadChart).not.toContain('className="five-road-chart-derived-row"');
    expect(fiveRoadChart).toContain('const renderRoadCard = (');
    expect(fiveRoadChart).not.toContain('const derivedFlex = useMemo(() => ({');
    expect(css).not.toContain('.five-road-chart-secondary-row {');
    expect(css).not.toContain('.five-road-chart-derived-row {');
  });

  it('uses responsive bead road sizing instead of a fixed pixel width shell', () => {
    const fiveRoadChart = readFileSync(resolve(__dirname, '../components/roads/FiveRoadChart.tsx'), 'utf8');
    const beadRoadCanvas = readFileSync(resolve(__dirname, '../components/roads/BeadRoadCanvas.tsx'), 'utf8');
    const bigRoadCanvas = readFileSync(resolve(__dirname, '../components/roads/BigRoadCanvas.tsx'), 'utf8');
    const derivedRoadCanvas = readFileSync(resolve(__dirname, '../components/roads/DerivedRoadCanvas.tsx'), 'utf8');
    const roadTypes = readFileSync(resolve(__dirname, '../types/road.ts'), 'utf8');
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(fiveRoadChart).toContain("'bead-road-responsive-card'");
    expect(fiveRoadChart).toContain('className="bead-road-responsive-shell"');
    expect(beadRoadCanvas).toContain('const [containerWidth, setContainerWidth] = useState(0);');
    expect(beadRoadCanvas).toContain('ResizeObserver');
    expect(beadRoadCanvas).toContain('const responsiveColumnGap = useMemo(() =>');
    expect(bigRoadCanvas).toContain('const responsiveColumnGap = useMemo(() =>');
    expect(derivedRoadCanvas).toContain('const responsiveColumnGap = useMemo(() =>');
    expect(roadTypes).toContain('export const calculateResponsiveColumnGap =');
    expect(roadTypes).toContain('export const calculateRoadContentWidth =');
    expect(css).toContain('.bead-road-responsive-card {');
    expect(css).toContain('.bead-road-responsive-shell {');
  });

  it('uses larger bead road circles and keeps every road on an independent row', () => {
    const fiveRoadChart = readFileSync(resolve(__dirname, '../components/roads/FiveRoadChart.tsx'), 'utf8');
    const beadRoadCanvas = readFileSync(resolve(__dirname, '../components/roads/BeadRoadCanvas.tsx'), 'utf8');
    const bigRoadCanvas = readFileSync(resolve(__dirname, '../components/roads/BigRoadCanvas.tsx'), 'utf8');
    const derivedRoadCanvas = readFileSync(resolve(__dirname, '../components/roads/DerivedRoadCanvas.tsx'), 'utf8');
    const roadTypes = readFileSync(resolve(__dirname, '../types/road.ts'), 'utf8');

    expect(fiveRoadChart).toContain('const beadConfig: RoadCanvasConfig = useMemo(() => ({');
    expect(fiveRoadChart).toContain('const beadRoadHeight = useMemo(() => {');
    expect(fiveRoadChart).toContain('return calculateRoadHeight(beadConfig);');
    expect(fiveRoadChart).toContain('const CELL_GAP = 1;');
    expect(fiveRoadChart).toContain('cellSize: 28');
    expect(fiveRoadChart).toContain('fontSize: 12');
    expect(fiveRoadChart).toContain('<BeadRoadCanvas data={roads.bead} config={beadConfig} className="bead-road-responsive-canvas" />');
    expect(fiveRoadChart).toContain("height: `${beadRoadHeight}px`");
    expect(roadTypes).toContain('export const calculateViewportColumns =');
    expect(beadRoadCanvas).toContain('const viewportCols = useMemo(() =>');
    expect(beadRoadCanvas).toContain('const totalCols = useMemo(() =>');
    expect(beadRoadCanvas).toContain('Math.min(14, Math.max(actualCols, viewportCols))');
    expect(beadRoadCanvas).toContain('maxGap: Math.max(mergedConfig.cellGap, 24)');
    expect(bigRoadCanvas).toContain('const viewportCols = useMemo(() =>');
    expect(bigRoadCanvas).toContain('return Math.max(data?.max_columns || 0, viewportCols);');
    expect(bigRoadCanvas).toContain('maxGap: Math.max(mergedConfig.cellGap, 6)');
    expect(derivedRoadCanvas).toContain('const viewportCols = useMemo(() =>');
    expect(derivedRoadCanvas).toContain('return Math.max(data?.max_columns || 0, viewportCols);');
    expect(derivedRoadCanvas).toContain('maxGap: Math.max(mergedConfig.cellGap, 6)');
  });

  it('uses simplified mobile review cards and a non-descriptions review detail sheet', () => {
    const mistakes = readFileSync(resolve(__dirname, './MistakeBookPage.tsx'), 'utf8');
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(mistakes).toContain('className="review-mobile-list"');
    expect(mistakes).toContain('className="review-mobile-card"');
    expect(mistakes).toContain('className="review-mobile-head"');
    expect(mistakes).toContain('className="review-mobile-kpis"');
    expect(mistakes).toContain('className="review-mobile-outcome"');
    expect(mistakes).toContain('className="review-mobile-analysis"');
    expect(mistakes).toContain('className="review-detail-sheet"');
    expect(mistakes).not.toContain('<Descriptions bordered');
    expect(mistakes).toContain('className="review-detail-kpi-grid"');
    expect(mistakes).toContain('className="review-detail-section is-danger"');
    expect(mistakes).toContain('className="review-detail-section is-action"');
    expect(css).toContain('.review-mobile-card {');
    expect(css).toContain('.review-detail-sheet {');
    expect(css).toContain('.review-detail-kpi-grid {');
  });

  it('keeps user-facing status and form pages on shared mobile shell classes', () => {
    const workflow = readFileSync(resolve(__dirname, '../components/dashboard/WorkflowStatusBar.tsx'), 'utf8');
    const systemStatus = readFileSync(resolve(__dirname, '../components/ui/SystemStatusPanel.tsx'), 'utf8');
    const smartAlerts = readFileSync(resolve(__dirname, '../components/ui/SmartAlerts.tsx'), 'utf8');
    const upload = readFileSync(resolve(__dirname, './UploadDataPage.tsx'), 'utf8');
    const modeSelect = readFileSync(resolve(__dirname, './ModeSelectPage.tsx'), 'utf8');
    const login = readFileSync(resolve(__dirname, './LoginPage.tsx'), 'utf8');
    const betRecords = readFileSync(resolve(__dirname, './BetRecordsPage.tsx'), 'utf8');
    const mistakes = readFileSync(resolve(__dirname, './MistakeBookPage.tsx'), 'utf8');
    const logs = readFileSync(resolve(__dirname, './LogsPage.tsx'), 'utf8');
    const roadmap = readFileSync(resolve(__dirname, './RoadMapPage.tsx'), 'utf8');
    const beadGrid = readFileSync(resolve(__dirname, '../components/upload/BeadGridInput.tsx'), 'utf8');
    const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

    expect(workflow).toContain('className="status-bar workflow-status-main workflow-status-shell"');
    expect(systemStatus).toContain('className="system-status-card"');
    expect(smartAlerts).toContain('className="smart-alerts-stack"');
    expect(upload).toContain('className="mobile-status-card"');
    expect(modeSelect).toContain('className="mode-select-card mobile-status-card"');
    expect(login).toContain('className="page-auth-card mobile-status-card"');
    expect(betRecords).toContain('className="mobile-status-card"');
    expect(mistakes).toContain('className="mobile-status-card"');
    expect(logs).toContain('className="mobile-status-card"');
    expect(roadmap).toContain('className="mobile-status-card"');
    expect(beadGrid).toContain('className="bead-grid-shell"');
    expect(css).toContain('.workflow-status-shell,');
    expect(css).toContain('.system-status-card,');
    expect(css).toContain('.mobile-status-card,');
    expect(css).toContain('.page-auth-card,');
    expect(css).toContain('.bead-grid-shell {');
    expect(css).toContain('.smart-alerts-stack {');
  });
});
