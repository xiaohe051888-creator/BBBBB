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
});
