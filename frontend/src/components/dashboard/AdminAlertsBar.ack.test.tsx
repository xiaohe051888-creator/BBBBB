// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminAlertsBar } from './AdminAlertsBar';

const getAdminTokenMock = vi.fn();
const adminMaintenanceAlertsMock = vi.fn();
const adminMaintenanceAcknowledgeAlertsMock = vi.fn();

vi.mock('../../services/api', () => ({
  getAdminToken: () => getAdminTokenMock(),
  adminMaintenanceAlerts: (...args: unknown[]) => adminMaintenanceAlertsMock(...args),
  adminMaintenanceAcknowledgeAlerts: (...args: unknown[]) => adminMaintenanceAcknowledgeAlertsMock(...args),
}));

describe('AdminAlertsBar acknowledge', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('hides acknowledged alerts and shows again when newer alerts arrive', async () => {
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
    adminMaintenanceAlertsMock
      .mockResolvedValueOnce({
        data: {
          count: 1,
          unacknowledged_count: 1,
          latest_alert_log_id: 101,
          acknowledged_alert_log_id: null,
          data: [
            {
              id: 101,
              log_time: '2026-05-10T11:37:19Z',
              boot_number: 12,
              game_number: 24,
              event_code: 'UT-P1',
              event_type: '测试',
              event_result: 'Exception',
              description: '严重告警',
              category: '系统异常',
              priority: 'P1',
              source_module: 'analysis',
              task_id: 'task-1',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 1,
          unacknowledged_count: 0,
          latest_alert_log_id: 101,
          acknowledged_alert_log_id: 101,
          data: [
            {
              id: 101,
              log_time: '2026-05-10T11:37:19Z',
              boot_number: 12,
              game_number: 24,
              event_code: 'UT-P1',
              event_type: '测试',
              event_result: 'Exception',
              description: '严重告警',
              category: '系统异常',
              priority: 'P1',
              source_module: 'analysis',
              task_id: 'task-1',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 2,
          unacknowledged_count: 1,
          latest_alert_log_id: 202,
          acknowledged_alert_log_id: 101,
          data: [
            {
              id: 202,
              log_time: '2026-05-10T11:39:19Z',
              boot_number: 12,
              game_number: 25,
              event_code: 'UT-P1-2',
              event_type: '测试2',
              event_result: 'Exception',
              description: '新的严重告警',
              category: '系统异常',
              priority: 'P1',
              source_module: 'analysis',
              task_id: 'task-2',
            },
          ],
        },
      });

    adminMaintenanceAcknowledgeAlertsMock.mockResolvedValue({
      data: {
        acknowledged_alert_log_id: 101,
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

    expect(container.innerHTML).toContain('系统告警');

    const normalize = (text?: string | null) => text?.replace(/\s+/g, '') || '';
    const confirmButton = Array.from(document.querySelectorAll('button')).find((button) =>
      normalize(button.textContent).includes('确认'),
    );
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.innerHTML).not.toContain('系统告警');

    await act(async () => {
      root.unmount();
    });

    const root2 = createRoot(container);
    await act(async () => {
      root2.render(
        <MemoryRouter>
          <AdminAlertsBar />
        </MemoryRouter>,
      );
    });

    expect(container.innerHTML).toContain('系统告警');

    await act(async () => {
      root2.unmount();
    });
    container.remove();
  });
});
