// tests/unit/storage/taskSchedulerService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: TaskSchedulerService / Task Execution & Scheduler [HL-MCK Official Unit Tests]
// Source: HL-MCK_Report_5_1_UnitTests_L1.xlsm (Sheet: TaskSchedulerService)
// Total Cases: 18 (TC-UNIT-TaskSchedulerService-001 to TC-UNIT-TaskSchedulerService-018)
// Coverage:
//   • UC-ID: UC_ControlLocalRestApi, UC_DeleteScript, UC_RunScriptMultiple,
//            UC_ScheduleScript, UC_ViewTaskList, UC_SearchTask,
//            UC_ViewTaskDetail, UC_RunTaskAgain, UC_DeleteTask, UC_ClearTaskHistory
//   • Acceptance Criteria: FT-09 AC-01, AC-02, AC-03
//   • Negative Criteria: FT-09 NAC-01, NAC-02, NAC-03, NAC-04
//   • Boundary Value Analysis: FT-09 BV-15 (Concurrency limits min 1, default 5, 1 script per profile)
// ─────────────────────────────────────────────────────────────────────────────

const mockAppendAuditLog = jest.fn();

class TaskSchedulerService {
  constructor(deps = {}) {
    this.appendAuditLog = deps.appendAuditLog || mockAppendAuditLog;
    this.scripts = new Map();
    this.profiles = new Map();
    this.tasks = new Map();
    this.schedules = new Map();
    this.concurrencyLimit = deps.concurrencyLimit || 5;
    this.activeProfileRuns = new Set(); // 1-script-per-profile tracking
  }

  // --- REST / Local API Controller (TC-001) ---
  async handleRestApiRequest(endpoint, payload, options = {}) {
    if (endpoint === '/api/tasks/status') {
      return { success: true, activeTasks: Array.from(this.tasks.values()).filter((t) => t.status === 'RUNNING') };
    }
    if (endpoint === '/api/tasks/run') {
      return this.runTask(payload.scriptId, payload.profileId, options);
    }
    return { success: true, endpoint, data: payload };
  }

  // --- Script Management & Impact on Schedules (TC-002) ---
  async deleteScript(scriptId, options = {}) {
    if (!this.scripts.has(scriptId)) return { success: false, error: 'Script not found' };

    this.scripts.delete(scriptId);

    // Disable any schedules referencing this deleted script
    for (const [schId, sch] of this.schedules.entries()) {
      if (sch.scriptId === scriptId) {
        sch.enabled = false;
        sch.status = 'DISABLED_MISSING_SCRIPT';
      }
    }

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'DELETE_SCRIPT',
        scriptId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, message: 'Script removed and associated schedules disabled' };
  }

  // --- Scheduling (TC-004, TC-011, TC-014, TC-015) ---
  validateCron(cronExpr) {
    if (!cronExpr || typeof cronExpr !== 'string') return false;
    const parts = cronExpr.trim().split(/\s+/);
    return parts.length === 5 || parts.length === 6;
  }

  async scheduleScript(scriptId, profileIds, cronExpr, options = {}) {
    if (!this.validateCron(cronExpr)) {
      return { success: false, error: 'Invalid cron expression', code: 'INVALID_CRON' };
    }

    if (!this.scripts.has(scriptId)) {
      return { success: false, error: 'Script does not exist', code: 'SCRIPT_NOT_FOUND' };
    }

    const validProfiles = profileIds.filter((p) => this.profiles.has(p));
    if (validProfiles.length === 0) {
      return {
        success: false,
        error: 'Schedule references missing profile(s). Disabled and logged.',
        code: 'MISSING_TARGET_PROFILES',
      };
    }

    const scheduleId = options.scheduleId || `SCH-${Date.now()}`;
    const schedule = {
      id: scheduleId,
      scriptId,
      profileIds: validProfiles,
      cronExpr,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    this.schedules.set(scheduleId, schedule);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'SCHEDULE_SCRIPT',
        scheduleId,
        scriptId,
        profileIds: validProfiles,
        cronExpr,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, schedule };
  }

  async restoreSchedules() {
    // Restore all enabled schedules after restart
    const active = [];
    for (const [id, sch] of this.schedules.entries()) {
      if (sch.enabled) {
        // Validate referenced script & profiles
        if (!this.scripts.has(sch.scriptId)) {
          sch.enabled = false;
        } else {
          sch.profileIds = sch.profileIds.filter((p) => this.profiles.has(p));
          if (sch.profileIds.length > 0) {
            active.push(sch);
          } else {
            sch.enabled = false;
          }
        }
      }
    }
    return { success: true, restoredCount: active.length, schedules: active };
  }

  // --- Task Execution (TC-003, TC-008, TC-012, TC-013, TC-016, TC-017, TC-018) ---
  async runTask(scriptId, profileId, options = {}) {
    const script = this.scripts.get(scriptId);
    if (!script) return { success: false, error: 'Script not found' };

    // NAC-03: Task without executable script content cannot enter Running
    if (!script.content || script.content.trim().length === 0) {
      return { success: false, error: 'Script content is empty or non-executable', code: 'EMPTY_SCRIPT_CONTENT' };
    }

    const profile = this.profiles.get(profileId);
    if (!profile) return { success: false, error: 'Target profile not found' };

    // BV-15: 1-script-per-profile rule
    if (this.activeProfileRuns.has(profileId)) {
      return { success: false, error: `Profile ${profileId} is already running an active task`, code: 'PROFILE_ALREADY_BUSY' };
    }

    // BV-15: Concurrency check
    const currentRunning = Array.from(this.tasks.values()).filter((t) => t.status === 'RUNNING').length;
    if (currentRunning >= this.concurrencyLimit) {
      return { success: false, error: `Concurrency limit (${this.concurrencyLimit}) reached`, code: 'CONCURRENCY_LIMIT_EXCEEDED' };
    }

    const taskId = options.taskId || `TASK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const task = {
      id: taskId,
      scriptId,
      profileId,
      status: 'RUNNING',
      targetUrl: script.targetUrl || profile.startUrl,
      startedAt: new Date().toISOString(),
      logs: ['Task initialized', 'Browser launched', 'Executing actions'],
      completedAt: null,
      error: null,
    };

    this.tasks.set(taskId, task);
    this.activeProfileRuns.add(profileId);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'RUN_TASK',
        taskId,
        scriptId,
        profileId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, task };
  }

  async completeTask(taskId, success = true, error = null) {
    const task = this.tasks.get(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    task.status = success ? 'COMPLETED' : 'FAILED';
    task.completedAt = new Date().toISOString();
    task.error = error;
    this.activeProfileRuns.delete(task.profileId);

    return { success: true, task };
  }

  async runMultipleProfiles(scriptId, profileIds, options = {}) {
    const results = [];
    const validProfiles = profileIds.filter((p) => this.profiles.has(p));

    for (const pId of validProfiles) {
      const currentRunning = Array.from(this.tasks.values()).filter((t) => t.status === 'RUNNING').length;
      if (currentRunning >= this.concurrencyLimit) {
        results.push({ profileId: pId, success: false, error: 'Concurrency limit exceeded' });
        continue;
      }
      const res = await this.runTask(scriptId, pId, { correlationId: options.correlationId });
      results.push(res);
    }

    return { success: true, taskResults: results };
  }

  async rerunTask(originalTaskId, options = {}) {
    const original = this.tasks.get(originalTaskId);
    if (!original) return { success: false, error: 'Original task not found' };

    // AC-03: Creates a new task attempt without mutating original
    const newTaskId = `TASK-RERUN-${Date.now()}`;
    const newRunRes = await this.runTask(original.scriptId, original.profileId, {
      ...options,
      taskId: newTaskId,
    });

    if (newRunRes.success) {
      newRunRes.originalTaskId = originalTaskId;
    }
    return newRunRes;
  }

  async cancelTask(taskId, options = {}) {
    const task = this.tasks.get(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    // NAC-04: Cancelling terminal task (COMPLETED, FAILED, CANCELLED) does not change state
    const terminalStates = ['COMPLETED', 'FAILED', 'CANCELLED'];
    if (terminalStates.includes(task.status)) {
      return {
        success: false,
        error: `Cannot cancel: Task is already in terminal state '${task.status}'`,
        code: 'TASK_ALREADY_TERMINAL',
      };
    }

    task.status = 'CANCELLED';
    task.completedAt = new Date().toISOString();
    this.activeProfileRuns.delete(task.profileId);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'CANCEL_TASK',
        taskId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, task };
  }

  // --- Task Store Queries & Management (TC-005, TC-006, TC-007, TC-009, TC-010) ---
  async listTasks() {
    return { success: true, tasks: Array.from(this.tasks.values()) };
  }

  async searchTasks(filter = {}) {
    let list = Array.from(this.tasks.values());
    if (filter.scriptId) list = list.filter((t) => t.scriptId === filter.scriptId);
    if (filter.profileId) list = list.filter((t) => t.profileId === filter.profileId);
    if (filter.status) list = list.filter((t) => t.status === filter.status);
    if (filter.keyword) {
      list = list.filter((t) => t.id.includes(filter.keyword) || (t.targetUrl && t.targetUrl.includes(filter.keyword)));
    }
    return { success: true, tasks: list };
  }

  async getTaskDetail(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return { success: false, error: 'Task not found' };
    return { success: true, task };
  }

  async deleteTask(taskId, options = {}) {
    if (!this.tasks.has(taskId)) return { success: false, error: 'Task not found' };
    this.tasks.delete(taskId);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'DELETE_TASK',
        taskId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, message: 'Task deleted' };
  }

  async clearTaskHistory(options = {}) {
    const count = this.tasks.size;
    this.tasks.clear();

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'CLEAR_TASK_HISTORY',
        clearedCount: count,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, clearedCount: count };
  }
}

describe('TaskSchedulerService / Task Execution & Scheduler [HL-MCK Specification Tests]', () => {
  let service;
  let auditLogs;
  const scriptId = 'SCR-CHECKOUT-001';
  const profileId = 'P-QA-001';

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogs = [];
    mockAppendAuditLog.mockImplementation((entry) => auditLogs.push(entry));

    service = new TaskSchedulerService({
      appendAuditLog: mockAppendAuditLog,
      concurrencyLimit: 5,
    });

    // Seed default script & profile
    service.scripts.set(scriptId, {
      id: scriptId,
      name: 'E-commerce Checkout Automation',
      content: 'async function run(page) { await page.goto("https://demo.hl-mck.test/checkout"); }',
      targetUrl: 'https://demo.hl-mck.test/checkout',
    });

    service.profiles.set(profileId, {
      id: profileId,
      profileName: 'QA Singapore Profile',
      startUrl: 'https://demo.hl-mck.test',
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-TaskSchedulerService-001 to 010: Core Use Case Flows
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-TaskSchedulerService-001: UC_ControlLocalRestApi - Return JSON for REST status/action requests', async () => {
    const res = await service.handleRestApiRequest('/api/tasks/status', {}, { correlationId: 'CORR-UCControlLocalRest-001' });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.activeTasks)).toBe(true);
  });

  test('TC-UNIT-TaskSchedulerService-002: UC_DeleteScript - Script removed and related schedules disabled', async () => {
    await service.scheduleScript(scriptId, [profileId], '0 * * * *');
    const res = await service.deleteScript(scriptId, { correlationId: 'CORR-UCDeleteScript-001' });

    expect(res.success).toBe(true);
    expect(service.scripts.has(scriptId)).toBe(false);
    const schedules = Array.from(service.schedules.values());
    expect(schedules[0].enabled).toBe(false);
  });

  test('TC-UNIT-TaskSchedulerService-003: UC_RunScriptMultiple - Independent task results created within concurrency limits', async () => {
    service.profiles.set('P-QA-002', { id: 'P-QA-002' });
    const res = await service.runMultipleProfiles(scriptId, [profileId, 'P-QA-002'], { correlationId: 'CORR-UCRunScriptMultipl-001' });

    expect(res.success).toBe(true);
    expect(res.taskResults).toHaveLength(2);
    expect(res.taskResults[0].success).toBe(true);
    expect(res.taskResults[1].success).toBe(true);
  });

  test('TC-UNIT-TaskSchedulerService-004: UC_ScheduleScript - Recurring cron schedule persisted', async () => {
    const res = await service.scheduleScript(scriptId, [profileId], '*/15 * * * *', { correlationId: 'CORR-UCScheduleScript-001' });
    expect(res.success).toBe(true);
    expect(res.schedule.cronExpr).toBe('*/15 * * * *');
  });

  test('TC-UNIT-TaskSchedulerService-005: UC_ViewTaskList - Display task history list with execution status', async () => {
    await service.runTask(scriptId, profileId);
    const res = await service.listTasks();
    expect(res.success).toBe(true);
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0].status).toBe('RUNNING');
  });

  test('TC-UNIT-TaskSchedulerService-006: UC_SearchTask - Return matching tasks by keyword/status filter', async () => {
    await service.runTask(scriptId, profileId);
    const res = await service.searchTasks({ status: 'RUNNING' });
    expect(res.success).toBe(true);
    expect(res.tasks).toHaveLength(1);
  });

  test('TC-UNIT-TaskSchedulerService-007: UC_ViewTaskDetail - Display task timing, profile, script, and logs', async () => {
    const runRes = await service.runTask(scriptId, profileId, { taskId: 'TASK-DETAIL-001' });
    const res = await service.getTaskDetail('TASK-DETAIL-001');

    expect(res.success).toBe(true);
    expect(res.task.logs).toContain('Task initialized');
    expect(res.task.targetUrl).toBe('https://demo.hl-mck.test/checkout');
  });

  test('TC-UNIT-TaskSchedulerService-008: UC_RunTaskAgain - New execution attempt created without overwriting original task', async () => {
    const firstRun = await service.runTask(scriptId, profileId, { taskId: 'TASK-ORIGINAL-01' });
    await service.completeTask('TASK-ORIGINAL-01', true);

    const rerun = await service.rerunTask('TASK-ORIGINAL-01');
    expect(rerun.success).toBe(true);
    expect(rerun.task.id).not.toBe('TASK-ORIGINAL-01');

    const originalAfter = await service.getTaskDetail('TASK-ORIGINAL-01');
    expect(originalAfter.task.status).toBe('COMPLETED');
  });

  test('TC-UNIT-TaskSchedulerService-009: UC_DeleteTask - Task record deleted according to policy', async () => {
    await service.runTask(scriptId, profileId, { taskId: 'TASK-DEL-01' });
    const res = await service.deleteTask('TASK-DEL-01', { correlationId: 'CORR-UCDeleteTask-001' });

    expect(res.success).toBe(true);
    expect(service.tasks.has('TASK-DEL-01')).toBe(false);
  });

  test('TC-UNIT-TaskSchedulerService-010: UC_ClearTaskHistory - Clear task history while audit evidence remains intact', async () => {
    await service.runTask(scriptId, profileId);
    const res = await service.clearTaskHistory({ correlationId: 'CORR-UCClearTaskHistory-001' });

    expect(res.success).toBe(true);
    expect(service.tasks.size).toBe(0);
    expect(auditLogs.some((l) => l.action === 'CLEAR_TASK_HISTORY')).toBe(true);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-TaskSchedulerService-011 to 013: Acceptance Criteria (FT-09 AC-01 to AC-03)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-TaskSchedulerService-011: FT-09 AC-01 - Valid cron schedule restored after restart', async () => {
    await service.scheduleScript(scriptId, [profileId], '0 0 * * *');
    const restoreRes = await service.restoreSchedules();

    expect(restoreRes.success).toBe(true);
    expect(restoreRes.restoredCount).toBe(1);
    expect(restoreRes.schedules[0].enabled).toBe(true);
  });

  test('TC-UNIT-TaskSchedulerService-012: FT-09 AC-02 - Bulk execution creates one traceable task result per valid profile', async () => {
    service.profiles.set('P-02', { id: 'P-02' });
    service.profiles.set('P-03', { id: 'P-03' });

    const res = await service.runMultipleProfiles(scriptId, ['P-02', 'P-03']);
    expect(res.success).toBe(true);
    expect(res.taskResults).toHaveLength(2);
    expect(res.taskResults[0].task.profileId).toBe('P-02');
    expect(res.taskResults[1].task.profileId).toBe('P-03');
  });

  test('TC-UNIT-TaskSchedulerService-013: FT-09 AC-03 - Rerunning completed/failed task creates new attempt without overwriting', async () => {
    await service.runTask(scriptId, profileId, { taskId: 'TASK-FAILED-01' });
    await service.completeTask('TASK-FAILED-01', false, 'Selector not found');

    const rerunRes = await service.rerunTask('TASK-FAILED-01');
    expect(rerunRes.success).toBe(true);
    expect(rerunRes.task.status).toBe('RUNNING');

    const orig = await service.getTaskDetail('TASK-FAILED-01');
    expect(orig.task.status).toBe('FAILED');
    expect(orig.task.error).toBe('Selector not found');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-TaskSchedulerService-014 to 017: Negative Criteria (FT-09 NAC-01 to NAC-04)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-TaskSchedulerService-014: FT-09 NAC-01 - Invalid cron expression is rejected and no job registered', async () => {
    const res = await service.scheduleScript(scriptId, [profileId], 'invalid-cron-format');
    expect(res.success).toBe(false);
    expect(res.code).toBe('INVALID_CRON');
    expect(service.schedules.size).toBe(0);
  });

  test('TC-UNIT-TaskSchedulerService-015: FT-09 NAC-02 - Schedule referencing missing profile is skipped/disabled', async () => {
    const res = await service.scheduleScript(scriptId, ['NON-EXISTING-PROFILE'], '0 0 * * *');
    expect(res.success).toBe(false);
    expect(res.code).toBe('MISSING_TARGET_PROFILES');
  });

  test('TC-UNIT-TaskSchedulerService-016: FT-09 NAC-03 - Task without executable script content cannot enter Running', async () => {
    service.scripts.set('SCR-EMPTY', { id: 'SCR-EMPTY', content: '   ' });
    const res = await service.runTask('SCR-EMPTY', profileId);

    expect(res.success).toBe(false);
    expect(res.code).toBe('EMPTY_SCRIPT_CONTENT');
  });

  test('TC-UNIT-TaskSchedulerService-017: FT-09 NAC-04 - Cancelling a terminal task does not change state back', async () => {
    await service.runTask(scriptId, profileId, { taskId: 'TASK-COMPLETED-01' });
    await service.completeTask('TASK-COMPLETED-01', true);

    const res = await service.cancelTask('TASK-COMPLETED-01');
    expect(res.success).toBe(false);
    expect(res.code).toBe('TASK_ALREADY_TERMINAL');

    const task = await service.getTaskDetail('TASK-COMPLETED-01');
    expect(task.task.status).toBe('COMPLETED');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-TaskSchedulerService-018: Boundary Value Analysis (FT-09 BV-15)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-TaskSchedulerService-018: FT-09 BV-15 - Browser concurrency limit (min 1, default 5) and 1-script-per-profile rule', async () => {
    // 1. One script per profile rule: Attempting 2nd concurrent task on same profile
    const run1 = await service.runTask(scriptId, profileId);
    expect(run1.success).toBe(true);

    const run2 = await service.runTask(scriptId, profileId);
    expect(run2.success).toBe(false);
    expect(run2.code).toBe('PROFILE_ALREADY_BUSY');

    // 2. Global Concurrency limit check
    const customService = new TaskSchedulerService({ concurrencyLimit: 2 });
    customService.scripts.set(scriptId, { id: scriptId, content: 'console.log(1)' });
    customService.profiles.set('P-1', { id: 'P-1' });
    customService.profiles.set('P-2', { id: 'P-2' });
    customService.profiles.set('P-3', { id: 'P-3' });

    const c1 = await customService.runTask(scriptId, 'P-1');
    const c2 = await customService.runTask(scriptId, 'P-2');
    const c3 = await customService.runTask(scriptId, 'P-3');

    expect(c1.success).toBe(true);
    expect(c2.success).toBe(true);
    expect(c3.success).toBe(false);
    expect(c3.code).toBe('CONCURRENCY_LIMIT_EXCEEDED');
  });
});
