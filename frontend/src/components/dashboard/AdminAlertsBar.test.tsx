// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminAlertsBar } from './AdminAlertsBar';

const getAdminTokenMock = vi.fn();
const adminMaintenanceAlertsMock = vi.fn();

vi.mock('../../services/api', () => ({
  getAdminToken: () => getAdminTokenMock(),
  adminMaintenanceAlerts: (...args: unknown[]) => adminMaintenanceAlertsMock(...args),
}));

describe('AdminAlertsBar', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('renders alerts as a compact collapsed summary before showing details', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    getAdminTokenMock.mockReturnValue('token');
    adminMaintenanceAlertsMock.mockResolvedValue({
      data: {
        count: 1,
        data: [
          {
            id: 1,
            log_time: '2026-05-10T11:37:19Z',
            boot_number: 12,
            game_number: 24,
            event_code: 'LOG-MDL-003',
            event_type: '规则兜底接管',
            event_result: '成功',
            description: '单AI失败后已切换规则兜底继续下注：下一局AI分析失败(reveal): analysis returned no result',
            category: '工作流事件',
            priority: 'P1',
            source_module: 'analysis',
            task_id: 'task-1',
          },
        ],
      },
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminAlertsBar />
        </MemoryRouter>,
      );
    });

    const html = container.innerHTML;
    const normalize = (text?: string | null) => text?.replace(/\s+/g, '') || '';
    expect(html).toContain('系统告警');
    expect(html).toContain('近24小时 1 条高优先级');
    expect(html).not.toContain('刷新');
    expect(html).not.toContain('查看全部');
    expect(html).not.toContain('最近24小时内检测到 1 条高优先级');
    expect(html).not.toContain('智能分析：系统已自动改用备用判断');
    expect(html).not.toContain('智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。');

    const confirmButton = Array.from(document.querySelectorAll('button')).find((button) =>
      normalize(button.textContent).includes('确认'),
    );
    const expandButton = Array.from(document.querySelectorAll('button')).find((button) =>
      normalize(button.textContent).includes('展开'),
    );
    expect(confirmButton).toBeTruthy();
    expect(expandButton).toBeTruthy();

    await act(async () => {
      expandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const expandedHtml = container.innerHTML;
    expect(expandedHtml).toContain('查看全部');
    expect(expandedHtml).toContain('智能分析：系统已自动改用备用判断');
    expect(expandedHtml).toContain('智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。');
    expect(expandedHtml).not.toContain('P1 1');
    expect(expandedHtml).not.toContain('P1 事件');
    expect(expandedHtml).not.toContain('LOG-MDL-003');
    expect(expandedHtml).not.toContain('analysis returned no result');
    expect(expandedHtml).not.toContain('(reveal)');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
