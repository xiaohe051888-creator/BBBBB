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
    expect(css).toContain('.mobile-data-card .ant-card-body');
    expect(css).toContain('.mobile-data-card .user-data-table .ant-table-container');
    expect(css).toContain('.mobile-data-card .user-data-table .ant-table-placeholder .ant-empty');
    expect(css).toContain('.mobile-card-table.user-data-table .ant-table-container');
  });
});
