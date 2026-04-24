import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Plus, Trash2, Search, FileCode, RefreshCw, ChevronRight, X, Download, Upload, Edit2, Pause, Square } from 'lucide-react';
import Editor from '@monaco-editor/react';

/* ═══════════════ API Reference Data ═══════════════ */
const API_REF = [
  { cat: 'page', methods: [
    { name: 'page.goto(url, options?)', desc: 'Navigate to URL', snippet: `await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });` },
    { name: 'page.reload(options?)', desc: 'Reload the current page', snippet: `await page.reload({ waitUntil: 'domcontentloaded' });` },
    { name: 'page.goBack()', desc: 'Navigate back in history', snippet: `await page.goBack();` },
    { name: 'page.goForward()', desc: 'Navigate forward in history', snippet: `await page.goForward();` },
    { name: 'page.title()', desc: 'Get the page <title>', snippet: `const t = await page.title();\nlog('Title: ' + t);` },
    { name: 'page.url()', desc: 'Get the current URL (sync)', snippet: `const url = page.url();\nlog('URL:', url);` },
    { name: 'page.content()', desc: 'Get the full page HTML', snippet: `const html = await page.content();\nlog('HTML length:', html.length);` },
    { name: 'page.locator(sel)', desc: 'Create a locator for element', snippet: `const el = page.locator('#my-element');\nawait el.click();` },
    { name: 'page.getByText(text)', desc: 'Find element by visible text', snippet: `const btn = page.getByText('Submit');\nawait btn.click();` },
    { name: 'page.getByRole(role)', desc: 'Find element by ARIA role', snippet: `const link = page.getByRole('link', { name: 'Sign in' });\nawait link.click();` },
    { name: 'page.getByPlaceholder(text)', desc: 'Find input by placeholder', snippet: `const input = page.getByPlaceholder('Enter email');\nawait input.fill('test@example.com');` },
    { name: 'page.click(selector, options?)', desc: 'Click an element', snippet: `await page.click('#submit-btn');` },
    { name: 'page.dblclick(selector, options?)', desc: 'Double-click an element', snippet: `await page.dblclick('#item');` },
    { name: 'page.hover(selector, options?)', desc: 'Hover the mouse over an element', snippet: `await page.hover('.menu-trigger');` },
    { name: 'page.focus(selector)', desc: 'Focus an element', snippet: `await page.focus('#search-input');` },
    { name: 'page.fill(selector, value)', desc: 'Clear & fill an input field', snippet: `await page.fill('#email', 'user@example.com');` },
    { name: 'page.type(selector, text)', desc: 'Type text key by key', snippet: `await page.type('#search', 'hello world', { delay: 100 });` },
    { name: 'page.press(selector, key)', desc: 'Press a keyboard key', snippet: `await page.press('#search', 'Enter');` },
    { name: 'page.check(selector)', desc: 'Check a checkbox', snippet: `await page.check('#agree-terms');` },
    { name: 'page.uncheck(selector)', desc: 'Uncheck a checkbox', snippet: `await page.uncheck('#newsletter');` },
    { name: 'page.selectOption(sel, val)', desc: 'Select a dropdown option', snippet: `await page.selectOption('#country', 'VN');` },
    { name: 'page.setInputFiles(sel, f)', desc: 'Upload file to input', snippet: `await page.setInputFiles('#file-upload', '/path/to/file.pdf');` },
    { name: 'page.waitForSelector(sel)', desc: 'Wait for element to appear', snippet: `await page.waitForSelector('#result', { timeout: 10000 });` },
    { name: 'page.waitForTimeout(ms)', desc: 'Wait for specified milliseconds', snippet: `await page.waitForTimeout(2000);` },
    { name: 'page.waitForLoadState(s)', desc: 'Wait for page load state', snippet: `await page.waitForLoadState('networkidle');` },
    { name: 'page.waitForURL(url)', desc: 'Wait until URL matches pattern', snippet: `await page.waitForURL('**/dashboard/**');` },
    { name: 'page.waitForResponse(url)', desc: 'Wait for network response', snippet: `const resp = await page.waitForResponse('**/api/data');\nconst json = await resp.json();\nlog('API data:', json);` },
    { name: 'page.evaluate(fn)', desc: 'Run JS in the browser context', snippet: `const result = await page.evaluate(() => {\n  return document.title;\n});\nlog('Result:', result);` },
    { name: 'page.evaluate(fn, arg)', desc: 'Pass argument to browser JS', snippet: `const text = await page.evaluate((sel) => {\n  return document.querySelector(sel)?.textContent;\n}, '#price');\nlog('Text:', text);` },
    { name: 'page.$(selector)', desc: 'Query a single element', snippet: `const el = await page.$('#main');\nif (el) log('Found #main');` },
    { name: 'page.$$(selector)', desc: 'Query all matching elements', snippet: `const items = await page.$$('.item');\nlog('Found', items.length, 'items');` },
    { name: 'page.$eval(sel, fn)', desc: 'Evaluate on single element', snippet: `const text = await page.$eval('h1', el => el.textContent);\nlog('Heading:', text);` },
    { name: 'page.$$eval(sel, fn)', desc: 'Evaluate on all elements', snippet: `const texts = await page.$$eval('.link', els => els.map(e => e.href));\nlog('Links:', texts);` },
    { name: 'page.screenshot()', desc: 'Take a page screenshot', snippet: `const buf = await page.screenshot({ fullPage: true });\nlog('Screenshot size:', buf.length, 'bytes');` },
    { name: 'page.screenshot({ path })', desc: 'Save screenshot to file', snippet: `await page.screenshot({ path: 'screenshot.png', fullPage: true });` },
    { name: 'page.pdf()', desc: 'Export page as PDF', snippet: `await page.pdf({ path: 'page.pdf', format: 'A4' });` },
    { name: 'page.keyboard.press(key)', desc: 'Press a keyboard key globally', snippet: `await page.keyboard.press('Tab');` },
    { name: 'page.keyboard.type(text)', desc: 'Type text without focusing', snippet: `await page.keyboard.type('Hello!');` },
    { name: 'page.mouse.click(x, y)', desc: 'Click at coordinates', snippet: `await page.mouse.click(100, 200);` },
    { name: 'page.mouse.move(x, y)', desc: 'Move mouse to position', snippet: `await page.mouse.move(300, 400, { steps: 10 });` },
    { name: 'page.mouse.wheel(dx, dy)', desc: 'Scroll mouse wheel', snippet: `await page.mouse.wheel(0, 500); // scroll down 500px` },
    { name: 'page.route(url, handler)', desc: 'Intercept network requests', snippet: `await page.route('**/api/**', (route) => {\n  log('Intercepted:', route.request().url());\n  route.continue();\n});` },
    { name: 'page.on("dialog", fn)', desc: 'Handle alert/confirm/prompt', snippet: `page.on('dialog', async (dialog) => {\n  log('Dialog:', dialog.type(), dialog.message());\n  await dialog.accept();\n});` },
    { name: 'page.close()', desc: 'Close the current tab', snippet: `await page.close();` },
    { name: 'page.bringToFront()', desc: 'Focus/activate tab', snippet: `await page.bringToFront();` },
    { name: 'page.frameLocator(sel)', desc: 'Locate inside an iframe', snippet: `await page.frameLocator('#iframe').locator('#btn').click();` },
  ]},
  { cat: 'context', methods: [
    { name: 'context.newPage()', desc: 'Open a new tab', snippet: `const newTab = await context.newPage();\nawait newTab.goto('https://example.com');` },
    { name: 'context.pages()', desc: 'List all open tabs', snippet: `const pages = context.pages();\nlog('Open tabs:', pages.length);\npages.forEach((p, i) => log('Tab ' + i + ':', p.url()));` },
    { name: 'context.cookies()', desc: 'Get all cookies', snippet: `const cookies = await context.cookies();\nlog('Cookies:', cookies.length);\ncookies.forEach(c => log(c.name, '=', c.value));` },
    { name: 'context.addCookies(list)', desc: 'Add cookies to context', snippet: `await context.addCookies([{\n  name: 'token',\n  value: 'abc123',\n  domain: '.example.com',\n  path: '/',\n}]);` },
    { name: 'context.clearCookies()', desc: 'Clear all cookies', snippet: `await context.clearCookies();` },
  ]},
  { cat: 'globals', methods: [
    { name: 'log(...args)', desc: 'Log a message to task output', snippet: `log('Step completed:', { status: 'ok' });` },
    { name: 'sleep(ms)', desc: 'Pause execution for ms', snippet: `await sleep(2000); // wait 2 seconds` },
    { name: 'assert(cond, msg)', desc: 'Assert condition is true', snippet: `const title = await page.title();\nassert(title.includes('Dashboard'), 'Should be on Dashboard');` },
    { name: 'profileId', desc: 'Current profile ID string', snippet: `log('Running on profile:', profileId);` },
    { name: 'cdp', desc: 'CDP session for low-level access', snippet: `if (cdp) {\n  const { result } = await cdp.send('Runtime.evaluate', { expression: 'navigator.userAgent' });\n  log('UA:', result.value);\n}` },
  ]},
  { cat: 'patterns', methods: [
    { name: 'Login flow', desc: 'Complete login example', snippet: `await page.goto('https://example.com/login');\nawait page.fill('#email', 'user@example.com');\nawait page.fill('#password', 'secret123');\nawait page.click('#login-btn');\nawait page.waitForURL('**/dashboard');\nlog('Logged in! Title:', await page.title());` },
    { name: 'Scrape list', desc: 'Extract data from a page', snippet: `await page.goto('https://example.com/products');\nconst items = await page.$$eval('.product', els => els.map(el => ({\n  name: el.querySelector('.name')?.textContent,\n  price: el.querySelector('.price')?.textContent,\n})));\nlog('Products:', items);` },
    { name: 'Fill form', desc: 'Complete form submission', snippet: `await page.goto('https://example.com/register');\nawait page.fill('#name', 'John Doe');\nawait page.fill('#email', 'john@example.com');\nawait page.selectOption('#country', 'VN');\nawait page.check('#agree');\nawait page.click('#submit');\nawait page.waitForSelector('.success');\nlog('Form submitted!');` },
    { name: 'Scroll to bottom', desc: 'Infinite scroll pattern', snippet: `let prevHeight = 0;\nfor (let i = 0; i < 10; i++) {\n  const height = await page.evaluate(() => document.body.scrollHeight);\n  if (height === prevHeight) break;\n  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));\n  await sleep(1500);\n  prevHeight = height;\n  log('Scroll', i + 1, '- height:', height);\n}` },
    { name: 'Try/catch with retry', desc: 'Retry on failure', snippet: `for (let attempt = 1; attempt <= 3; attempt++) {\n  try {\n    await page.click('#flaky-btn', { timeout: 5000 });\n    log('Clicked on attempt', attempt);\n    break;\n  } catch (e) {\n    log('Attempt', attempt, 'failed:', e.message);\n    if (attempt === 3) throw e;\n    await sleep(1000);\n  }\n}` },
    { name: 'Loop through pages', desc: 'Pagination pattern', snippet: `let pageNum = 1;\nwhile (true) {\n  log('Processing page', pageNum);\n  const items = await page.$$('.item');\n  log('Found', items.length, 'items');\n  const hasNext = await page.locator('.next-page').isVisible();\n  if (!hasNext) break;\n  await page.click('.next-page');\n  await page.waitForLoadState('networkidle');\n  pageNum++;\n}` },
  ]},
];

const totalMethods = API_REF.reduce((s, c) => s + c.methods.length, 0);

const CRON_PRESETS = [
  { label: 'Every 5m', cron: '*/5 * * * *' },
  { label: 'Every 15m', cron: '*/15 * * * *' },
  { label: 'Every 30m', cron: '*/30 * * * *' },
  { label: 'Hourly', cron: '0 * * * *' },
  { label: 'Daily 9am', cron: '0 9 * * *' },
  { label: 'Midnight', cron: '0 0 * * *' },
  { label: 'Mon 9am', cron: '0 9 * * 1' },
];

const MINUTE_OPTIONS = ['* (every)', '*/5', '*/10', '*/15', '*/30', '0', '15', '30', '45'];
const HOUR_OPTIONS = ['* (every)', '0', '1', '2', '3', '6', '8', '9', '12', '15', '18', '21'];
const DAY_OPTIONS = ['* (every)', '1', '5', '10', '15', '20', '25'];
const MONTH_OPTIONS = ['* (every)', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const WEEKDAY_OPTIONS = ['* (every)', '0', '1', '2', '3', '4', '5', '6'];

function describeCron(expr) {
  if (!expr) return '';
  const parts = expr.split(' ');
  if (parts.length !== 5) return expr;
  const [min, hr, day, mon, wd] = parts;
  if (min.startsWith('*/')) return `Every ${min.slice(2)} minutes`;
  if (min === '0' && hr === '*') return 'Every hour';
  if (min === '0' && hr === '0' && day === '*' && mon === '*' && wd === '*') return 'Every day at midnight';
  if (min === '0' && hr !== '*' && day === '*' && mon === '*' && wd === '*') return `Every day at ${hr}:00`;
  if (min === '0' && hr !== '*' && wd !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[Number(wd)] || 'Day ' + wd} at ${hr}:00`;
  }
  return expr;
}

const DEFAULT_CODE = `// Available globals: page, cdp, profileId, log()
// Type 'page.' or 'cdp.' to see autocomplete

await page.goto('https://example.com');
log('Page title: ' + await page.title());
`;

/* ═══════════════ Main Component ═══════════════ */
export default function ScriptsManager({ profiles = [] }) {
    const [activeTab, setActiveTab] = useState('scripts');

    return (
        <div className="w-full h-full flex flex-col p-4" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center gap-4 mb-4">
                <h1 className="text-[1.2rem] font-bold" style={{ color: 'var(--fg)' }}>Scripts &amp; Tasks</h1>
                <div className="flex p-1 rounded-lg" style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}>
                    {['scripts', 'logs', 'modules'].map(tab => (
                        <button key={tab} className={`px-3 py-1 text-[0.75rem] font-medium rounded transition ${activeTab === tab ? 'btn btn-primary' : 'btn btn-secondary'}`} onClick={() => setActiveTab(tab)}>
                            {tab === 'scripts' ? 'Scripts' : tab === 'logs' ? 'Task Logs' : 'Script Modules'}
                        </button>
                    ))}
                </div>
            </div>
            {activeTab === 'scripts' && <ScriptsTab profiles={profiles} />}
            {activeTab === 'logs' && <TaskLogsTab profiles={profiles} />}
            {activeTab === 'modules' && <ScriptModulesTab />}
        </div>
    );
}

/* ═══════════════ Scripts Tab ═══════════════ */
function ScriptsTab({ profiles }) {
    const [scripts, setScripts] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [editing, setEditing] = useState(null);
    const [filter, setFilter] = useState('');
    const [runProfileId, setRunProfileId] = useState('');
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState(null);
    // Per-script run state: { [scriptId]: 'idle' | 'running' | 'success' | 'error' }
    const [scriptStates, setScriptStates] = useState({});
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    // Run modal state
    const [runModalScript, setRunModalScript] = useState(null);
    // Bulk run modal
    const [bulkRunScript, setBulkRunScript] = useState(null);

    // Schedule state
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleProfileId, setScheduleProfileId] = useState('');
    const [cronExpr, setCronExpr] = useState('*/5 * * * *');
    const [cronMinute, setCronMinute] = useState('*/5');
    const [cronHour, setCronHour] = useState('* (every)');
    const [cronDay, setCronDay] = useState('* (every)');
    const [cronMonth, setCronMonth] = useState('* (every)');
    const [cronWeekday, setCronWeekday] = useState('* (every)');

    // Browser mode
    const [browserMode, setBrowserMode] = useState('visible');

    const load = useCallback(async () => {
        try {
            const list = await window.electronAPI.listScripts();
            setScripts(Array.isArray(list) ? list : []);
        } catch { setScripts([]); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Sync cron fields → expression
    useEffect(() => {
        const clean = v => v.replace(' (every)', '');
        const expr = `${clean(cronMinute)} ${clean(cronHour)} ${clean(cronDay)} ${clean(cronMonth)} ${clean(cronWeekday)}`;
        setCronExpr(expr);
    }, [cronMinute, cronHour, cronDay, cronMonth, cronWeekday]);

    const applyCronPreset = (cron) => {
        setCronExpr(cron);
        const [m, h, d, mo, w] = cron.split(' ');
        setCronMinute(m === '*' ? '* (every)' : m);
        setCronHour(h === '*' ? '* (every)' : h);
        setCronDay(d === '*' ? '* (every)' : d);
        setCronMonth(mo === '*' ? '* (every)' : mo);
        setCronWeekday(w === '*' ? '* (every)' : w);
    };

    const handleNew = () => {
        setEditing({ id: null, name: '', description: '', code: DEFAULT_CODE });
        setSelectedId(null);
        setRunResult(null);
        setScheduleEnabled(false);
        setBrowserMode('visible');
    };

    const handleSelect = (s) => {
        setEditing({ ...s });
        setSelectedId(s.id);
        setRunResult(null);
        // Load schedule from script if exists
        setScheduleEnabled(!!s.schedule?.enabled);
        if (s.schedule?.cron) applyCronPreset(s.schedule.cron);
        if (s.schedule?.profileId) setScheduleProfileId(s.schedule.profileId);
        setBrowserMode(s.browserMode || 'visible');
    };

    const handleSave = async () => {
        if (!editing) return;
        try {
            const res = await window.electronAPI.saveScript({
                id: editing.id,
                name: editing.name,
                description: editing.description,
                code: editing.code,
                schedule: scheduleEnabled ? { enabled: true, cron: cronExpr, profileId: scheduleProfileId } : { enabled: false },
                browserMode,
            });
            if (!res?.success) { alert(res?.error || 'Save failed'); return; }
            await load();
            if (!editing.id && res.script?.id) {
                setEditing(prev => ({ ...prev, id: res.script.id }));
                setSelectedId(res.script.id);
            }
        } catch (e) { alert(e?.message || String(e)); }
    };

    const handleDelete = async (id, e) => {
        e && e.stopPropagation();
        if (!window.confirm('Delete this script?')) return;
        try {
            await window.electronAPI.deleteScript(id);
            await load();
            if (selectedId === id) { setEditing(null); setSelectedId(null); }
        } catch (e2) { alert(e2?.message || String(e2)); }
    };

    const handleRun = async (scriptId) => {
        const pid = runProfileId || (profiles[0]?.id || '');
        if (!pid) { alert('Select a profile to run this script first.'); return; }
        const sid = scriptId || editing?.id;
        if (!sid) { alert('Save script first.'); return; }
        setRunning(true);
        setRunResult(null);
        setScriptStates(prev => ({ ...prev, [sid]: 'running' }));
        try {
            const res = await window.electronAPI.executeScript(pid, sid, { timeoutMs: 120000 });
            setRunResult(res);
            setScriptStates(prev => ({ ...prev, [sid]: res.success ? 'success' : 'error' }));
            // Reset state after 5s
            setTimeout(() => setScriptStates(prev => ({ ...prev, [sid]: 'idle' })), 5000);
        } catch (e) {
            setRunResult({ success: false, error: e?.message || String(e), logs: [] });
            setScriptStates(prev => ({ ...prev, [sid]: 'error' }));
            setTimeout(() => setScriptStates(prev => ({ ...prev, [sid]: 'idle' })), 5000);
        } finally { setRunning(false); }
    };

    // Open run modal for a script
    const openRunModal = (script) => {
        setRunModalScript(script);
    };

    // Called when modal finishes execution
    const handleModalRunComplete = (scriptId, result) => {
        setRunResult(result);
        setScriptStates(prev => ({ ...prev, [scriptId]: result.success ? 'success' : 'error' }));
        setTimeout(() => setScriptStates(prev => ({ ...prev, [scriptId]: 'idle' })), 5000);
    };

    const handleDeleteWithConfirm = (id, e) => {
        e && e.stopPropagation();
        setDeleteConfirmId(id);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            await window.electronAPI.deleteScript(deleteConfirmId);
            await load();
            if (selectedId === deleteConfirmId) { setEditing(null); setSelectedId(null); }
        } catch (err) { alert(err?.message || String(err)); }
        setDeleteConfirmId(null);
    };

    const handleInsertSnippet = (snippet) => {
        if (!editing) return;
        setEditing(prev => ({ ...prev, code: (prev.code || '') + '\n' + snippet + '\n' }));
    };

    const handleExportJson = async () => {
        try {
            const res = await window.electronAPI.listScripts();
            const list = Array.isArray(res) ? res : (res?.scripts || []);
            const exportData = list.map(({ id, name, description, code, cronSchedule, cronEnabled, cronProfileId }) =>
                ({ id, name, description, code, cronSchedule, cronEnabled, cronProfileId })
            );
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `scripts-export-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
        } catch { alert('Export failed'); }
    };

    const handleImportJson = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            try {
                const data = JSON.parse(text);
                const list = Array.isArray(data) ? data : [data];
                let imported = 0;
                for (const s of list) {
                    if (!s.name && !s.code) continue;
                    await window.electronAPI.saveScript({ id: null, name: s.name || 'Imported', description: s.description || '', code: s.code || '' });
                    imported++;
                }
                const updated = await window.electronAPI.listScripts();
                setScripts(Array.isArray(updated) ? updated : (updated?.scripts || []));
                alert(`Imported ${imported} script(s)`);
            } catch { alert('Invalid JSON file'); }
        };
        input.click();
    };

    const filtered = scripts.filter(s => !filter || (s.name || '').toLowerCase().includes(filter.toLowerCase()));

    return (
        <div className="flex-1 flex flex-row rounded-lg gap-[1px] overflow-hidden" style={{ background: 'var(--border)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            {/* ═══ Left Sidebar — Script Cards ═══ */}
            <div className="w-[280px] flex flex-col" style={{ background: 'var(--card)' }}>
                {/* Search + New */}
                <div className="px-3 py-2 flex gap-2 items-center" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex-1 relative">
                        <Search size={13} className="absolute left-2.5 top-[0.45rem]" style={{ color: 'var(--muted)' }} />
                        <input placeholder="Search scripts..." value={filter} onChange={e => setFilter(e.target.value)}
                            className="w-full rounded text-[0.72rem] pl-7 pr-2 py-1"
                            style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }} />
                    </div>
                    <button className="p-1.5 rounded-md transition-all duration-150 hover:scale-105"
                        style={{ background: 'var(--success)', color: '#fff' }}
                        onClick={handleNew} title="New Script"><Plus size={16} /></button>
                </div>

                {/* Script Cards List */}
                <div className="flex-1 overflow-y-auto py-1.5 px-2 space-y-1.5">
                    {filtered.map(s => {
                        const state = scriptStates[s.id] || 'idle';
                        const isActive = selectedId === s.id;
                        const borderColor = state === 'running' ? '#f59e0b' : state === 'success' ? '#10b981' : state === 'error' ? '#ef4444' : isActive ? 'var(--primary)' : 'var(--border2)';
                        return (
                            <div key={s.id}
                                className="rounded-lg p-2.5 cursor-pointer transition-all duration-200 group hover:shadow-md"
                                style={{
                                    background: isActive ? 'var(--glass-strong)' : 'var(--card2)',
                                    border: `1.5px solid ${borderColor}`,
                                    transform: isActive ? 'scale(1.01)' : 'scale(1)',
                                }}
                                onClick={() => handleSelect(s)}
                            >
                                {/* Card top: name + state indicator */}
                                <div className="flex items-center gap-2 mb-1.5">
                                    {state === 'running' && <RefreshCw size={11} className="animate-spin shrink-0 text-amber-400" />}
                                    {state === 'success' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />}
                                    {state === 'error' && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />}
                                    {state === 'idle' && <FileCode size={12} className="shrink-0" style={{ color: 'var(--muted)' }} />}
                                    <span className="text-[0.75rem] font-semibold truncate flex-1" style={{ color: isActive ? 'var(--primary)' : 'var(--fg)' }}>{s.name || '(untitled)'}</span>
                                </div>

                                {/* Description */}
                                {s.description && <div className="text-[0.62rem] truncate mb-2 pl-[22px]" style={{ color: 'var(--muted)' }}>{s.description}</div>}

                                {/* Card bottom: action buttons */}
                                <div className="flex items-center gap-1.5 pl-[18px]">
                                    {/* Run button */}
                                    <button
                                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[0.62rem] font-semibold transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ background: state === 'running' ? '#d97706' : '#10b981', color: '#fff' }}
                                        title={state === 'running' ? 'Running...' : 'Run script'}
                                        disabled={state === 'running'}
                                        onClick={e => { e.stopPropagation(); openRunModal(s); }}
                                    >
                                        {state === 'running'
                                            ? <><RefreshCw size={10} className="animate-spin" /> Running</>
                                            : <><Play size={10} /> Run</>
                                        }
                                    </button>

                                    {/* Bulk Run button */}
                                    <button
                                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[0.62rem] font-semibold transition-all duration-150 hover:brightness-110"
                                        style={{ background: '#6366f1', color: '#fff' }}
                                        title="Run on multiple profiles"
                                        onClick={e => { e.stopPropagation(); setBulkRunScript(s); }}
                                    >
                                        <Play size={10} /> Bulk
                                    </button>

                                    {/* Edit button */}
                                    <button
                                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[0.62rem] font-medium transition-all duration-150 hover:brightness-125"
                                        style={{ background: 'var(--glass)', color: 'var(--fg)', border: '1px solid var(--border2)' }}
                                        title="Edit script"
                                        onClick={e => { e.stopPropagation(); handleSelect(s); }}
                                    >
                                        <Edit2 size={10} /> Edit
                                    </button>

                                    {/* Delete button */}
                                    <button
                                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.62rem] font-medium transition-all duration-150 opacity-60 hover:opacity-100 hover:brightness-110"
                                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                                        title="Delete script"
                                        onClick={e => handleDeleteWithConfirm(s.id, e)}
                                    >
                                        <Trash2 size={12} /> Del
                                    </button>

                                    {/* State badge */}
                                    {state === 'success' && <span className="ml-auto text-[0.58rem] text-emerald-500 font-medium">Done</span>}
                                    {state === 'error' && <span className="ml-auto text-[0.58rem] text-red-400 font-medium">Failed</span>}
                                </div>
                            </div>
                        );
                    })}
                    {!filtered.length && (
                        <div className="flex flex-col items-center justify-center py-8 text-center" style={{ color: 'var(--muted)' }}>
                            <FileCode size={32} strokeWidth={1} className="mb-2 opacity-40" />
                            <p className="text-[0.75rem]">No scripts yet</p>
                            <p className="text-[0.65rem]">Click + to create one</p>
                        </div>
                    )}
                </div>

                {/* Bottom actions */}
                <div className="p-2.5 flex gap-2" style={{ background: 'var(--card2)', borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-secondary flex-1 text-[0.68rem] flex items-center justify-center gap-1 py-1" onClick={handleExportJson}><Download size={11} /> Export</button>
                    <button className="btn btn-secondary flex-1 text-[0.68rem] flex items-center justify-center gap-1 py-1" onClick={handleImportJson}><Upload size={11} /> Import</button>
                </div>

            </div>

            {/* ═══ Center Editor Area ═══ */}
            <div className="flex-1 flex flex-col" style={{ background: 'var(--card)' }}>
                {editing ? (
                    <div className="flex flex-col h-full">
                        {/* Header: Name, Description, Actions */}
                        <div className="p-3 flex flex-col gap-2" style={{ background: 'var(--card2)', borderBottom: '1px solid var(--border)' }}>
                            <div className="flex gap-3 items-center">
                                <span className="text-[0.85rem] font-semibold" style={{ color: 'var(--fg)' }}>{editing.id ? 'Edit Script' : 'New Script'}</span>
                                <div className="flex-1" />
                                <button className="btn btn-secondary text-[0.7rem]" onClick={() => { setEditing(null); setSelectedId(null); }}>Cancel</button>
                                <button className="btn btn-success text-[0.7rem]" onClick={handleSave}>Save</button>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-[0.68rem] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Name</label>
                                    <input className="w-full rounded px-2 py-1.5 text-[0.75rem]"
                                        style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                        value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Login to site" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[0.68rem] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Description (optional)</label>
                                    <input className="w-full rounded px-2 py-1.5 text-[0.75rem]"
                                        style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                        value={editing.description} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} placeholder="What does this script do?" />
                                </div>
                            </div>
                        </div>

                        {/* Auto-run Schedule */}
                        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[0.78rem] font-semibold" style={{ color: 'var(--fg)' }}>Auto-run schedule</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={scheduleEnabled} onChange={e => setScheduleEnabled(e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 rounded-full peer-checked:bg-blue-500 transition" style={{ background: scheduleEnabled ? 'var(--primary)' : 'var(--border2)' }}>
                                        <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${scheduleEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                    </div>
                                </label>
                            </div>
                            {scheduleEnabled && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[0.7rem] font-medium" style={{ color: 'var(--muted)' }}>Profile:</label>
                                        <select className="flex-1 rounded px-2 py-1 text-[0.72rem]" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                            value={scheduleProfileId} onChange={e => setScheduleProfileId(e.target.value)}>
                                            <option value="">Select profile</option>
                                            {profiles.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                                        </select>
                                    </div>
                                    {/* Preset buttons */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {CRON_PRESETS.map(p => (
                                            <button key={p.cron}
                                                className={`px-2 py-0.5 rounded text-[0.68rem] font-medium transition ${cronExpr === p.cron ? 'text-white' : ''}`}
                                                style={{ background: cronExpr === p.cron ? 'var(--primary)' : 'var(--glass)', border: '1px solid var(--border2)', color: cronExpr === p.cron ? '#fff' : 'var(--fg)' }}
                                                onClick={() => applyCronPreset(p.cron)}>{p.label}</button>
                                        ))}
                                    </div>
                                    {/* Cron dropdowns */}
                                    <div className="flex gap-2">
                                        {[
                                            { label: 'Minute', value: cronMinute, set: setCronMinute, options: MINUTE_OPTIONS },
                                            { label: 'Hour', value: cronHour, set: setCronHour, options: HOUR_OPTIONS },
                                            { label: 'Day', value: cronDay, set: setCronDay, options: DAY_OPTIONS },
                                            { label: 'Month', value: cronMonth, set: setCronMonth, options: MONTH_OPTIONS },
                                            { label: 'Weekday', value: cronWeekday, set: setCronWeekday, options: WEEKDAY_OPTIONS },
                                        ].map(f => (
                                            <div key={f.label} className="flex-1">
                                                <label className="text-[0.62rem] font-medium block mb-0.5" style={{ color: 'var(--muted)' }}>{f.label}</label>
                                                <select className="w-full rounded px-1 py-1 text-[0.7rem]" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                                    value={f.value} onChange={e => f.set(e.target.value)}>
                                                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Cron expression display */}
                                    <div className="flex items-center gap-3">
                                        <input className="rounded px-2 py-1 text-[0.72rem] font-mono w-[140px]"
                                            style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                            value={cronExpr} onChange={e => setCronExpr(e.target.value)} />
                                        <span className="text-[0.7rem]" style={{ color: 'var(--muted)' }}>{describeCron(cronExpr)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Browser Mode */}
                        <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                            <div>
                                <span className="text-[0.78rem] font-semibold block" style={{ color: 'var(--fg)' }}>Browser mode</span>
                                <span className="text-[0.68rem]" style={{ color: 'var(--muted)' }}>{browserMode === 'headless' ? 'Background (no window)' : 'Visible (show window)'}</span>
                            </div>
                            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border2)' }}>
                                <button className={`px-3 py-1 text-[0.72rem] font-medium transition ${browserMode === 'headless' ? 'text-white' : ''}`}
                                    style={{ background: browserMode === 'headless' ? 'var(--primary)' : 'var(--glass)', color: browserMode === 'headless' ? '#fff' : 'var(--fg)' }}
                                    onClick={() => setBrowserMode('headless')}>Headless</button>
                                <button className={`px-3 py-1 text-[0.72rem] font-medium transition ${browserMode === 'visible' ? 'text-white' : ''}`}
                                    style={{ background: browserMode === 'visible' ? 'var(--primary)' : 'var(--glass)', color: browserMode === 'visible' ? '#fff' : 'var(--fg)' }}
                                    onClick={() => setBrowserMode('visible')}>Visible</button>
                            </div>
                        </div>

                        {/* Monaco Editor */}
                        <div className="flex-1 relative" style={{ minHeight: 200 }}>
                            <Editor height="100%" language="javascript" theme="vs-dark"
                                value={editing.code} onChange={v => setEditing(p => ({ ...p, code: v || '' }))}
                                options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: 'on', padding: { top: 8 } }} />
                        </div>

                        {/* Run bar */}
                        <div className="px-3 py-2 flex items-center gap-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--card2)' }}>
                            <select className="rounded px-2 py-1 text-[0.72rem]" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                value={runProfileId} onChange={e => setRunProfileId(e.target.value)}>
                                <option value="">Select profile to run...</option>
                                {profiles.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                            </select>
                            <button className="btn btn-success text-[0.75rem] flex items-center gap-1" onClick={() => editing?.id ? openRunModal(editing) : alert('Save script first.')} disabled={running}>
                                {running ? <><RefreshCw size={14} className="animate-spin" /> Running...</> : <><Play size={14} /> Run</>}
                            </button>
                        </div>

                        {/* Run result */}
                        {runResult && (
                            <div className="max-h-[150px] font-mono text-[0.72rem] overflow-y-auto p-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--fg)' }}>
                                <div className={`mb-2 flex items-center gap-2 font-bold ${runResult.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {runResult.success ? '✅ Completed' : '❌ Error'} {runResult.error && `— ${runResult.error}`}
                                </div>
                                {runResult.logs?.map((l, i) => (
                                    <div key={i} className="mb-0.5">
                                        <span className="mr-2" style={{ color: 'var(--muted)' }}>[{new Date(l.time).toLocaleTimeString()}]</span>
                                        <span>{l.message}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
                        <FileCode size={48} strokeWidth={1} />
                        <p className="text-[0.8rem]">Select a script or create a new one</p>
                    </div>
                )}
            </div>

            {/* ═══ Right API Reference ═══ */}
            <ApiReferencePanel onInsert={editing ? handleInsertSnippet : null} />

            {/* Run Script Modal */}
            {runModalScript && (
                <RunScriptModal
                    script={runModalScript}
                    profiles={profiles}
                    onClose={() => setRunModalScript(null)}
                    onComplete={handleModalRunComplete}
                />
            )}

            {/* Bulk Run Modal */}
            {bulkRunScript && (
                <BulkRunModal
                    script={bulkRunScript}
                    profiles={profiles}
                    onClose={() => setBulkRunScript(null)}
                />
            )}

            {/* Delete Confirmation Modal — rendered at root level so it's not clipped by overflow */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDeleteConfirmId(null)}>
                    <div className="rounded-xl p-5 w-[360px] shadow-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                                <Trash2 size={20} className="text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-[0.9rem] font-semibold" style={{ color: 'var(--fg)' }}>Delete Script</h3>
                                <p className="text-[0.72rem]" style={{ color: 'var(--muted)' }}>
                                    "{scripts.find(s => s.id === deleteConfirmId)?.name || 'Script'}"
                                </p>
                            </div>
                        </div>
                        <p className="text-[0.75rem] mb-4" style={{ color: 'var(--muted)' }}>
                            This action cannot be undone. The script and its schedule will be permanently deleted.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button className="btn btn-secondary text-[0.75rem] px-4" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                            <button className="px-4 py-1.5 rounded-md text-[0.75rem] font-medium text-white transition-all duration-150 hover:brightness-110"
                                style={{ background: '#ef4444' }}
                                onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════ Bulk Run Modal ═══════════════ */
function BulkRunModal({ script, profiles = [], onClose }) {
    const [selectedIds, setSelectedIds] = useState([]);
    const [concurrency, setConcurrency] = useState(3);
    const [browserMode, setBrowserMode] = useState('visible');
    const [showWarning, setShowWarning] = useState(false);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    // Per-profile status: { [profileId]: 'pending' | 'running' | 'success' | 'error' | 'stopped' }
    const [statuses, setStatuses] = useState({});
    const [errors, setErrors] = useState({});
    const abortRef = useRef(false);

    const toggleProfile = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const toggleAll = () => {
        setSelectedIds(prev => prev.length === profiles.length ? [] : profiles.map(p => p.id));
    };

    const setStatus = (id, status) => setStatuses(prev => ({ ...prev, [id]: status }));

    const handleRunClick = () => {
        if (!selectedIds.length) return;
        if (selectedIds.length >= 5 && !showWarning) {
            setShowWarning(true);
            return;
        }
        executeRun();
    };

    const executeRun = async () => {
        setShowWarning(false);
        abortRef.current = false;
        setRunning(true);
        setDone(false);
        setErrors({});
        const initialStatuses = {};
        selectedIds.forEach(id => { initialStatuses[id] = 'pending'; });
        setStatuses(initialStatuses);

        // Queue runner with concurrency limit
        const queue = [...selectedIds];
        let active = 0;

        await new Promise(resolve => {
            const runNext = () => {
                while (active < concurrency && queue.length > 0) {
                    if (abortRef.current) {
                        // Mark remaining as stopped
                        [...queue].forEach(id => setStatus(id, 'stopped'));
                        queue.length = 0;
                        break;
                    }
                    const profileId = queue.shift();
                    active++;
                    setStatus(profileId, 'running');
                    window.electronAPI.executeScript(profileId, script.id, {
                        timeoutMs: 120000,
                        headless: browserMode === 'headless',
                    }).then(res => {
                        setStatus(profileId, res.success ? 'success' : 'error');
                        if (!res.success) setErrors(prev => ({ ...prev, [profileId]: res.error || 'Failed' }));
                    }).catch(e => {
                        setStatus(profileId, 'error');
                        setErrors(prev => ({ ...prev, [profileId]: e?.message || 'Error' }));
                    }).finally(() => {
                        active--;
                        if (queue.length > 0 && !abortRef.current) {
                            runNext();
                        } else if (active === 0) {
                            resolve();
                        }
                    });
                }
                if (active === 0 && queue.length === 0) resolve();
            };
            runNext();
        });

        setRunning(false);
        setDone(true);
    };

    const handleStop = () => {
        abortRef.current = true;
        // Stop all currently running scripts
        selectedIds.forEach(id => {
            if (statuses[id] === 'running') {
                window.electronAPI.stopScript(id).catch(() => {});
            }
        });
    };

    const statusColor = { pending: '#6b7280', running: '#f59e0b', success: '#10b981', error: '#ef4444', stopped: '#6b7280' };
    const statusLabel = { pending: 'Pending', running: 'Running...', success: 'Done', error: 'Failed', stopped: 'Stopped' };

    const counts = selectedIds.reduce((acc, id) => {
        const s = statuses[id] || 'pending';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} onClick={!running ? onClose : undefined}>
            <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ background: 'var(--card)', border: '1px solid var(--border)', width: '560px', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'var(--card2)', borderBottom: '1px solid var(--border)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                        <Play size={18} color="#fff" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[0.9rem] font-bold" style={{ color: 'var(--fg)' }}>Bulk Run</h3>
                        <p className="text-[0.7rem] truncate" style={{ color: 'var(--muted)' }}>{script?.name || 'Script'}</p>
                    </div>
                    <button className="p-1.5 rounded-lg transition hover:brightness-125" style={{ background: 'var(--glass)', color: 'var(--muted)' }} onClick={onClose} disabled={running}>
                        <X size={16} />
                    </button>
                </div>

                {/* Settings row */}
                {!running && !done && (
                    <div className="px-5 py-3 flex items-center gap-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
                        <div className="flex items-center gap-2">
                            <label className="text-[0.72rem] font-semibold" style={{ color: 'var(--fg)' }}>Concurrency:</label>
                            <select className="rounded px-2 py-1 text-[0.72rem]" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                value={concurrency} onChange={e => setConcurrency(Number(e.target.value))}>
                                {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n} at a time</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[0.72rem] font-semibold" style={{ color: 'var(--fg)' }}>Mode:</label>
                            <select className="rounded px-2 py-1 text-[0.72rem]" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                value={browserMode} onChange={e => setBrowserMode(e.target.value)}>
                                <option value="visible">Visible</option>
                                <option value="headless">Headless</option>
                            </select>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            <button className="text-[0.68rem] px-2 py-1 rounded" style={{ background: 'var(--glass)', color: 'var(--muted)', border: '1px solid var(--border2)' }} onClick={toggleAll}>
                                {selectedIds.length === profiles.length ? 'Deselect All' : 'Select All'}
                            </button>
                            <span className="text-[0.68rem]" style={{ color: 'var(--muted)' }}>{selectedIds.length} selected</span>
                        </div>
                    </div>
                )}

                {/* Progress summary when running */}
                {(running || done) && (
                    <div className="px-5 py-2 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
                        {counts.running > 0 && <span className="text-[0.72rem] font-medium text-amber-400">⏳ {counts.running} running</span>}
                        {counts.success > 0 && <span className="text-[0.72rem] font-medium text-emerald-500">✅ {counts.success} done</span>}
                        {counts.error > 0 && <span className="text-[0.72rem] font-medium text-rose-500">❌ {counts.error} failed</span>}
                        {counts.pending > 0 && <span className="text-[0.72rem]" style={{ color: 'var(--muted)' }}>⏸ {counts.pending} pending</span>}
                        {done && <span className="ml-auto text-[0.72rem] font-semibold" style={{ color: 'var(--fg)' }}>Completed</span>}
                    </div>
                )}

                {/* Profile list */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                    {profiles.map(p => {
                        const checked = selectedIds.includes(p.id);
                        const status = statuses[p.id];
                        const engine = p?.settings?.engine || 'playwright';
                        const isCamoufox = engine === 'camoufox';
                        const isFirefox = engine === 'playwright-firefox' || engine === 'firefox';
                        const engineLabel = isCamoufox ? 'Camoufox' : isFirefox ? 'Firefox' : 'Chromium';
                        return (
                            <div key={p.id}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition"
                                style={{
                                    background: checked ? 'var(--glass-strong)' : 'var(--card2)',
                                    border: `1px solid ${checked ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                                    opacity: (running && !status) ? 0.5 : 1,
                                }}
                                onClick={() => !running && !done && toggleProfile(p.id)}
                            >
                                {/* Checkbox */}
                                {!running && !done && (
                                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                                        style={{ background: checked ? '#6366f1' : 'var(--glass)', border: `1.5px solid ${checked ? '#6366f1' : 'var(--border2)'}` }}>
                                        {checked && <span style={{ color: '#fff', fontSize: '0.65rem', lineHeight: 1 }}>✓</span>}
                                    </div>
                                )}

                                {/* Status dot when running */}
                                {(running || done) && status && (
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0 flex items-center justify-center">
                                        {status === 'running'
                                            ? <RefreshCw size={11} className="animate-spin text-amber-400" />
                                            : <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor[status] }} />
                                        }
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <div className="text-[0.78rem] font-semibold truncate" style={{ color: 'var(--fg)' }}>{p.name || p.id.slice(0, 8)}</div>
                                    <div className="text-[0.65rem]" style={{ color: 'var(--muted)' }}>{engineLabel} · {p.id.slice(0, 8)}</div>
                                </div>

                                {/* Status label */}
                                {status && (
                                    <span className="text-[0.65rem] font-medium shrink-0" style={{ color: statusColor[status] }}>
                                        {statusLabel[status]}
                                    </span>
                                )}
                                {errors[p.id] && (
                                    <span className="text-[0.62rem] text-rose-400 truncate max-w-[120px]" title={errors[p.id]}>{errors[p.id]}</span>
                                )}
                            </div>
                        );
                    })}
                    {!profiles.length && (
                        <div className="py-8 text-center text-[0.75rem]" style={{ color: 'var(--muted)' }}>No profiles available.</div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 flex items-center justify-between gap-2" style={{ background: 'var(--card2)', borderTop: '1px solid var(--border)' }}>
                    {running ? (
                        <>
                            <div className="flex items-center gap-2 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                                <RefreshCw size={14} className="animate-spin" /> Running {selectedIds.length} profiles...
                            </div>
                            <button className="px-4 py-2 rounded-lg text-[0.78rem] font-semibold text-white flex items-center gap-2 hover:brightness-110 transition"
                                style={{ background: '#dc2626' }}
                                onClick={handleStop}>
                                <Square size={14} /> Stop All
                            </button>
                        </>
                    ) : done ? (
                        <>
                            <span className="text-[0.75rem] font-medium" style={{ color: 'var(--fg)' }}>
                                {counts.success || 0}/{selectedIds.length} succeeded
                            </span>
                            <button className="px-4 py-2 rounded-lg text-[0.78rem] font-medium hover:brightness-110 transition"
                                style={{ background: 'var(--glass)', color: 'var(--fg)', border: '1px solid var(--border2)' }}
                                onClick={onClose}>
                                Close
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="px-4 py-2 rounded-lg text-[0.78rem] font-medium hover:brightness-110 transition"
                                style={{ background: 'var(--glass)', color: 'var(--fg)', border: '1px solid var(--border2)' }}
                                onClick={onClose}>
                                Cancel
                            </button>
                            <button className="px-5 py-2 rounded-lg text-[0.78rem] font-semibold text-white flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 hover:shadow-lg transition"
                                style={{ background: selectedIds.length ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#4b5563' }}
                                disabled={!selectedIds.length}
                                onClick={handleRunClick}>
                                <Play size={14} /> Run {selectedIds.length > 0 ? `${selectedIds.length} profiles` : ''}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Red Warning Modal (DDoS Prevention) */}
            {showWarning && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => setShowWarning(false)}>
                    <div className="rounded-xl p-6 w-[420px] shadow-[0_0_40px_rgba(239,68,68,0.3)] flex flex-col" style={{ background: '#1e1e2e', border: '2px solid #ef4444' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-red-500/20">
                                <span className="text-red-500 text-[1.5rem]">⚠️</span>
                            </div>
                            <div>
                                <h3 className="text-[1.1rem] font-bold text-red-500">Cảnh Báo Đạo Đức / Security</h3>
                                <p className="text-[0.75rem] text-rose-300">High-Concurrency Execution Alert</p>
                            </div>
                        </div>
                        <div className="text-[0.8rem] mb-5 space-y-2 text-rose-100">
                            <p>Bạn đang chuẩn bị chạy kịch bản tự động trên <strong>{selectedIds.length}</strong> tab trình duyệt cùng lúc.</p>
                            <p className="font-semibold text-white">Rủi ro tiềm ẩn:</p>
                            <ul className="list-disc pl-5 opacity-90 space-y-1">
                                <li><strong>Tốn tải băng thông (Bandwidth abuse)</strong> của máy chủ đích.</li>
                                <li>Hành vi của bạn có thể vô tình cấu thành một cuộc tấn công <strong>Từ Chối Dịch Vụ (DDoS)</strong> nếu kịch bản liên tục tải lại hoặc request API nhanh.</li>
                                <li>Mọi hành vi vi phạm đạo đức đều được ghi lại vào nhật ký Audit không thể xóa.</li>
                            </ul>
                            <p className="mt-3 text-[0.75rem] opacity-75">Bạn có chắc chắn muốn phát động phiên chạy này không?</p>
                        </div>
                        <div className="flex gap-3 justify-end mt-2">
                            <button className="px-4 py-2 rounded flex-1 text-[0.8rem] font-medium hover:bg-white/10 text-white transition border border-white/20" onClick={() => setShowWarning(false)}>
                                Hủy bỏ (Cancel)
                            </button>
                            <button className="px-4 py-2 flex-1 rounded text-[0.8rem] font-bold text-white transition-all hover:brightness-125" style={{ background: '#ef4444', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' }} onClick={executeRun}>
                                Tôi chịu trách nhiệm (Run)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════ Run Script Modal ═══════════════ */
function RunScriptModal({ script, profiles = [], defaultProfileId = '', onClose, onComplete }) {
    const [selectedProfileId, setSelectedProfileId] = useState(defaultProfileId || '');
    const [browserMode, setBrowserMode] = useState(script?.browserMode || 'visible');
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [result, setResult] = useState(null);
    const [logs, setLogs] = useState([]);

    const canRun = !!selectedProfileId && !isRunning;

    const handleRun = async () => {
        if (!canRun) return;
        setIsRunning(true);
        setIsPaused(false);
        setResult(null);
        setLogs([]);
        try {
            const res = await window.electronAPI.executeScript(selectedProfileId, script.id, {
                timeoutMs: 120000,
                headless: browserMode === 'headless',
            });
            setResult(res);
            setLogs(res.logs || []);
            onComplete?.(script.id, res);
            // Auto-close on success after 1.5s
            if (res.success) {
                setTimeout(() => onClose?.(), 1500);
            }
        } catch (e) {
            const errResult = { success: false, error: e?.message || String(e), logs: [] };
            setResult(errResult);
            onComplete?.(script.id, errResult);
        } finally {
            setIsRunning(false);
            setIsPaused(false);
        }
    };

    const handleStop = async () => {
        await window.electronAPI.stopScript(selectedProfileId);
    };

    const handlePauseResume = async () => {
        if (isPaused) {
            await window.electronAPI.resumeScript(selectedProfileId);
            setIsPaused(false);
        } else {
            await window.electronAPI.pauseScript(selectedProfileId);
            setIsPaused(true);
        }
    };

    const selectedProfile = profiles.find(p => p.id === selectedProfileId);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
            <div className="rounded-2xl w-[480px] shadow-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'var(--card2)', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                            <Play size={18} color="#fff" />
                        </div>
                        <div>
                            <h3 className="text-[0.9rem] font-bold" style={{ color: 'var(--fg)' }}>Run Script</h3>
                            <p className="text-[0.7rem]" style={{ color: 'var(--muted)' }}>{script?.name || 'Untitled Script'}</p>
                        </div>
                    </div>
                    <button className="p-1.5 rounded-lg transition hover:brightness-125" style={{ background: 'var(--glass)', color: 'var(--muted)' }} onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                    {/* Script info */}
                    {script?.description && (
                        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}>
                            <span className="text-[0.68rem]" style={{ color: 'var(--muted)' }}>{script.description}</span>
                        </div>
                    )}

                    {/* Browser Mode */}
                    <div>
                        <label className="text-[0.72rem] font-semibold block mb-2" style={{ color: 'var(--fg)' }}>Browser Mode</label>
                        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border2)' }}>
                            <button className="flex-1 px-3 py-2 text-[0.75rem] font-medium transition flex items-center justify-center gap-2"
                                style={{ background: browserMode === 'visible' ? 'var(--primary)' : 'var(--glass)', color: browserMode === 'visible' ? '#fff' : 'var(--fg)' }}
                                onClick={() => setBrowserMode('visible')}>
                                <span style={{ fontSize: '1rem' }}>🖥️</span> Visible
                            </button>
                            <button className="flex-1 px-3 py-2 text-[0.75rem] font-medium transition flex items-center justify-center gap-2"
                                style={{ background: browserMode === 'headless' ? 'var(--primary)' : 'var(--glass)', color: browserMode === 'headless' ? '#fff' : 'var(--fg)', borderLeft: '1px solid var(--border2)' }}
                                onClick={() => setBrowserMode('headless')}>
                                <span style={{ fontSize: '1rem' }}>👻</span> Headless
                            </button>
                        </div>
                        <p className="text-[0.65rem] mt-1" style={{ color: 'var(--muted)' }}>
                            {browserMode === 'headless' ? 'Browser runs in background — no window shown' : 'Browser window will be visible during execution'}
                        </p>
                    </div>

                    {/* Profile Selection */}
                    <div>
                        <label className="text-[0.72rem] font-semibold block mb-2" style={{ color: 'var(--fg)' }}>Select Profile</label>
                        <select className="w-full rounded-lg px-3 py-2 text-[0.78rem]"
                            style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                            value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)}>
                            <option value="">— Choose a profile —</option>
                            {profiles.map(p => <option key={p.id} value={p.id}>{p.name || p.id.slice(0, 8)}</option>)}
                        </select>
                        {selectedProfile && (
                            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}>
                                <div className="w-2 h-2 rounded-full" style={{ background: '#10b981' }} />
                                <span className="text-[0.7rem] font-medium" style={{ color: 'var(--fg)' }}>{selectedProfile.name}</span>
                                <span className="text-[0.62rem] font-mono ml-auto" style={{ color: 'var(--muted)' }}>{selectedProfile.id?.slice(0, 8)}</span>
                            </div>
                        )}
                        {!profiles.length && (
                            <p className="text-[0.68rem] mt-1 text-amber-400">No profiles available. Create a profile first.</p>
                        )}
                    </div>

                    {/* Result */}
                    {result && (
                        <div className="rounded-lg p-3" style={{ background: result.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[0.78rem] font-semibold ${result.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {result.success ? '✅ Script completed successfully' : '❌ Script failed'}
                                </span>
                            </div>
                            {result.error && <p className="text-[0.72rem] text-rose-400">{result.error}</p>}
                            {logs.length > 0 && (
                                <div className="mt-2 max-h-[100px] overflow-y-auto font-mono text-[0.68rem] space-y-0.5" style={{ color: 'var(--fg)' }}>
                                    {logs.map((l, i) => (
                                        <div key={i}><span style={{ color: 'var(--muted)' }}>[{new Date(l.time).toLocaleTimeString()}]</span> {l.message}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 flex items-center justify-between gap-2" style={{ background: 'var(--card2)', borderTop: '1px solid var(--border)' }}>
                    {isRunning ? (
                        <>
                            <div className="flex items-center gap-2 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>{isPaused ? 'Paused' : 'Executing...'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="px-4 py-2 rounded-lg text-[0.78rem] font-semibold text-white transition-all duration-200 flex items-center gap-2 hover:brightness-110"
                                    style={{ background: isPaused ? '#10b981' : '#f59e0b' }}
                                    onClick={handlePauseResume}>
                                    {isPaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
                                </button>
                                <button className="px-4 py-2 rounded-lg text-[0.78rem] font-semibold text-white transition-all duration-200 flex items-center gap-2 hover:brightness-110"
                                    style={{ background: '#dc2626' }}
                                    onClick={handleStop}>
                                    <Square size={14} /> Stop
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <button className="px-4 py-2 rounded-lg text-[0.78rem] font-medium transition hover:brightness-110"
                                style={{ background: 'var(--glass)', color: 'var(--fg)', border: '1px solid var(--border2)' }}
                                onClick={onClose}>
                                Cancel
                            </button>
                            <button className="px-5 py-2 rounded-lg text-[0.78rem] font-semibold text-white transition-all duration-200 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 hover:shadow-lg"
                                style={{ background: canRun ? 'linear-gradient(135deg, #10b981, #059669)' : '#4b5563' }}
                                disabled={!canRun}
                                onClick={handleRun}>
                                <Play size={15} /> Run Script
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
function ApiReferencePanel({ onInsert }) {
    const [search, setSearch] = useState('');

    const filteredCats = search.trim()
        ? API_REF.map(c => ({ ...c, methods: c.methods.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.desc.toLowerCase().includes(search.toLowerCase())) })).filter(c => c.methods.length > 0)
        : API_REF;
    const resultCount = filteredCats.reduce((s, c) => s + c.methods.length, 0);

    return (
        <div className="w-[260px] flex flex-col" style={{ background: 'var(--card)', borderLeft: '1px solid var(--border)' }}>
            <div className="px-3 py-2 text-[0.78rem] font-semibold" style={{ color: 'var(--fg)', borderBottom: '1px solid var(--border)' }}>API Reference</div>
            <div className="px-3 py-1.5 relative" style={{ borderBottom: '1px solid var(--border)' }}>
                <Search size={12} className="absolute left-5 top-[0.65rem]" style={{ color: 'var(--muted)' }} />
                <input placeholder="Search methods..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full rounded pl-6 pr-6 py-1 text-[0.7rem]"
                    style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }} />
                {search && <button className="absolute right-5 top-[0.6rem]" onClick={() => setSearch('')} style={{ color: 'var(--muted)' }}><X size={12} /></button>}
            </div>
            <div className="px-3 py-0.5 text-[0.65rem]" style={{ color: 'var(--muted)' }}>{search ? `${resultCount} results` : `${totalMethods} methods`}</div>
            <div className="flex-1 overflow-y-auto px-1 pb-2">
                {filteredCats.map(cat => <ApiCategory key={cat.cat} cat={cat} onInsert={onInsert} forceOpen={!!search} />)}
                {!filteredCats.length && <div className="p-3 text-[0.72rem] text-center" style={{ color: 'var(--muted)' }}>No methods found</div>}
            </div>
        </div>
    );
}

function ApiCategory({ cat, onInsert, forceOpen }) {
    const [open, setOpen] = useState(cat.cat === 'page');
    const [hovered, setHovered] = useState(null);

    useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

    return (
        <div className="mb-0.5">
            <button className="w-full flex items-center gap-1 px-2 py-1 text-[0.72rem] font-semibold rounded transition"
                style={{ color: 'var(--primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => setOpen(!open)}>
                <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                <span className="flex-1 text-left">{cat.cat}</span>
                <span className="text-[0.6rem] font-normal px-1.5 rounded-full" style={{ background: 'var(--glass)', color: 'var(--muted)' }}>{cat.methods.length}</span>
            </button>
            {open && (
                <div className="pl-4 pr-1">
                    {cat.methods.map(m => (
                        <div key={m.name} className="py-1 px-2 rounded transition cursor-default"
                            onMouseEnter={() => setHovered(m.name)} onMouseLeave={() => setHovered(null)}
                            style={{ background: hovered === m.name ? 'var(--glass-hover)' : 'transparent' }}>
                            <div className="flex items-center justify-between gap-1">
                                <code className="text-[0.68rem] font-mono" style={{ color: 'var(--primary)' }}>{m.name}</code>
                                {onInsert && m.snippet && (
                                    <button className="px-1.5 py-0 rounded text-[0.58rem] font-bold uppercase tracking-wide opacity-60 hover:opacity-100 transition-opacity"
                                        style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}
                                        onClick={() => onInsert(m.snippet)}>insert</button>
                                )}
                            </div>
                            <div className="text-[0.64rem]" style={{ color: 'var(--muted)' }}>{m.desc}</div>
                            {m.snippet && hovered === m.name && (
                                <pre className="mt-1 p-2 rounded text-[0.64rem] font-mono overflow-x-auto leading-relaxed"
                                    style={{ background: '#1e1e2e', color: '#a6e3a1', border: '1px solid rgba(255,255,255,0.06)', maxHeight: 120, overflowY: 'auto' }}>{m.snippet}</pre>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════════ Task Logs Tab ═══════════════ */
function TaskLogsTab({ profiles = [] }) {
    const [tasks, setTasks] = useState([]);
    const [selected, setSelected] = useState(null);
    const [detailLogs, setDetailLogs] = useState([]);
    const [rerunModal, setRerunModal] = useState(null); // { script, defaultProfileId }

    const loadTasks = useCallback(async () => {
        try { const list = await window.electronAPI.getTaskLogs(); setTasks(Array.isArray(list) ? list : []); } catch { setTasks([]); }
    }, []);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    const handleSelect = async (task) => {
        setSelected(task);
        try { const res = await window.electronAPI.getTaskLog(task.id); if (res?.success) setDetailLogs(res.taskLog?.logs || []); else setDetailLogs([]); } catch { setDetailLogs([]); }
    };

    const handleDelete = async (e, id, name) => {
        e.stopPropagation();
        if (!window.confirm(`Delete log "${name || 'this task'}"?`)) return;
        try {
            await window.electronAPI.deleteTaskLog(id);
            setTasks(prev => prev.filter(t => t.id !== id));
            if (selected?.id === id) { setSelected(null); setDetailLogs([]); }
        } catch {}
    };

    const handleClear = async () => {
        if (!window.confirm('Clear all task logs?')) return;
        try { await window.electronAPI.clearTaskLogs(); setTasks([]); setSelected(null); setDetailLogs([]); } catch {}
    };

    const handleRunAgain = async () => {
        if (!selected) return;
        // Task tạo từ API: có scriptContent nhưng không có scriptId → chạy trực tiếp
        if (!selected.scriptId) {
            try {
                await window.electronAPI.runTask(selected.id);
                // Reload danh sách và cập nhật task đang chọn
                const updatedList = await window.electronAPI.getTaskLogs();
                if (Array.isArray(updatedList)) {
                    setTasks(updatedList);
                    const updated = updatedList.find(t => t.id === selected.id);
                    if (updated) {
                        setSelected(updated);
                        const detail = await window.electronAPI.getTaskLog(updated.id);
                        setDetailLogs(detail?.success ? (detail.taskLog?.logs || []) : []);
                    }
                }
            } catch {}
            return;
        }
        // Task từ script library → mở modal
        try {
            const res = await window.electronAPI.getScript(selected.scriptId);
            if (res?.success && res.script) {
                setRerunModal({ script: res.script, defaultProfileId: selected.profileId });
            }
        } catch {}
    };

    return (
        <>
        {rerunModal && (
            <RunScriptModal
                script={rerunModal.script}
                profiles={profiles}
                defaultProfileId={rerunModal.defaultProfileId}
                onClose={() => setRerunModal(null)}
                onComplete={() => setRerunModal(null)}
            />
        )}
        <div className="flex-1 flex flex-row rounded-lg gap-[1px] overflow-hidden" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
            <div className="w-[300px] flex flex-col" style={{ background: 'var(--card)' }}>
                <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
                    <span className="text-[0.75rem] font-medium" style={{ color: 'var(--muted)' }}>Tasks ({tasks.length})</span>
                    <div className="flex gap-1">
                        <button className="p-1 rounded" style={{ color: 'var(--muted)' }} onClick={loadTasks} title="Refresh"><RefreshCw size={13} /></button>
                        <button className="p-1 rounded" style={{ color: 'var(--danger)' }} onClick={handleClear} title="Clear all"><Trash2 size={13} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {tasks.map(t => (
                        <div key={t.id} className="px-3 py-2 cursor-pointer border-l-4 transition group"
                            style={{ borderColor: selected?.id === t.id ? 'var(--primary)' : 'transparent', background: selected?.id === t.id ? 'var(--glass-strong)' : 'transparent', borderBottom: '1px solid var(--border)' }}
                            onClick={() => handleSelect(t)}>
                            <div className="flex justify-between items-center">
                                <span className="text-[0.72rem] font-medium truncate flex-1 mr-1" style={{ color: 'var(--fg)' }}>{t.name || t.scriptName || 'Script'}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className={`text-[0.65rem] font-medium ${t.status === 'completed' ? 'text-emerald-500' : t.status === 'error' ? 'text-rose-500' : 'text-amber-400'}`}>
                                        {t.status === 'completed' ? '✅' : t.status === 'error' ? '❌' : '⏳'}
                                    </span>
                                    <button
                                        className="opacity-50 hover:opacity-100 p-0.5 rounded hover:bg-red-500/10 transition-all"
                                        style={{ color: 'var(--danger)' }}
                                        onClick={(e) => handleDelete(e, t.id, t.name || t.scriptName)}
                                        title="Delete this log"
                                    ><X size={11} /></button>
                                </div>
                            </div>
                            <div className="flex justify-between text-[0.62rem] mt-0.5" style={{ color: 'var(--muted)' }}>
                                <span>Profile: {(t.profileId || '').slice(0, 8)}</span>
                                <span>{new Date(t.completedAt || t.createdAt || t.finishedAt || t.startedAt).toLocaleTimeString()}</span>
                            </div>
                        </div>
                    ))}
                    {!tasks.length && <div className="p-4 text-[0.75rem] text-center" style={{ color: 'var(--muted)' }}>No tasks yet. Run a script to create one.</div>}
                </div>
            </div>
            <div className="flex-1 flex flex-col" style={{ background: 'var(--card)' }}>
                {selected ? (
                    <>
                        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
                            <span className="text-[0.75rem] font-semibold" style={{ color: 'var(--fg)' }}>{selected.name || selected.scriptName}</span>
                            <span className={`text-[0.65rem] ${selected.status === 'completed' ? 'text-emerald-500' : 'text-rose-500'}`}>{selected.status}</span>
                            <span className="text-[0.65rem]" style={{ color: 'var(--muted)' }}>
                              {new Date(selected.createdAt || selected.startedAt).toLocaleString()}
                              {(selected.completedAt || selected.finishedAt) ? ` → ${new Date(selected.completedAt || selected.finishedAt).toLocaleString()}` : ''}
                            </span>
                            <button className="ml-auto px-3 py-1 rounded-lg text-[0.72rem] font-semibold text-white flex items-center gap-1.5 hover:brightness-110 transition"
                                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                                onClick={handleRunAgain}>
                                <Play size={12} /> {selected.status === 'queued' ? 'Run' : 'Run Again'}
                            </button>
                        </div>
                        {selected.error && <div className="px-3 py-1.5 text-[0.72rem] text-rose-400" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(220,38,38,0.05)' }}>Error: {selected.error}</div>}
                        <div className="flex-1 overflow-y-auto p-3 font-mono text-[0.72rem]" style={{ color: 'var(--fg)' }}>
                            {detailLogs.map((l, i) => (
                                <div key={i} className="mb-0.5"><span className="mr-2" style={{ color: 'var(--muted)' }}>[{new Date(l.time).toLocaleTimeString()}]</span><span>{l.message}</span></div>
                            ))}
                            {!detailLogs.length && <div style={{ color: 'var(--muted)' }}>No log entries</div>}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-[0.75rem]" style={{ color: 'var(--muted)' }}>Select a task to view its output.</div>
                )}
            </div>
        </div>
        </>
    );
}

/* ═══════════════ Script Modules Tab ═══════════════ */
function ScriptModulesTab() {
    const [modules, setModules] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // { type: 'ok'|'err', msg }

    useEffect(() => {
        window.electronAPI?.listScriptModules?.().then(r => {
            if (r?.success) setModules(r.modules || []);
        });
    }, []);

    const handleInstall = async () => {
        const pkg = input.trim();
        if (!pkg) return;
        setLoading(true);
        setStatus(null);
        const r = await window.electronAPI?.installScriptModule?.(pkg);
        setLoading(false);
        if (r?.success) {
            setModules(r.modules || []);
            setInput('');
            setStatus({ type: 'ok', msg: `"${pkg}" installed successfully` });
        } else {
            setStatus({ type: 'err', msg: r?.error || 'Install failed' });
        }
    };

    const handleUninstall = async (name) => {
        setLoading(true);
        setStatus(null);
        const r = await window.electronAPI?.uninstallScriptModule?.(name);
        setLoading(false);
        if (r?.success) {
            setModules(r.modules || []);
            setStatus({ type: 'ok', msg: `"${name}" uninstalled` });
        } else {
            setStatus({ type: 'err', msg: r?.error || 'Uninstall failed' });
        }
    };

    return (
        <div className="w-full flex-1">
            <div className="rounded-xl p-4 w-full" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-[0.8rem] mb-3" style={{ color: 'var(--muted)' }}>
                    Install npm packages for use in automation scripts via{' '}
                    <code className="font-mono text-[0.75rem]" style={{ color: 'var(--fg)' }}>require('package-name')</code>.
                    Built-in modules available: <code className="font-mono text-[0.7rem]" style={{ color: 'var(--fg)' }}>path, crypto, url, os, util, buffer, zlib</code>.
                </p>
                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        placeholder="e.g. axios or lodash@4"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !loading && handleInstall()}
                        disabled={loading}
                        className="flex-1 rounded-md px-3 py-1.5 text-[0.75rem]"
                        style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                    />
                    <button
                        className="btn btn-success text-[0.75rem] min-w-[80px]"
                        onClick={handleInstall}
                        disabled={loading || !input.trim()}
                    >
                        {loading ? '...' : 'Install'}
                    </button>
                </div>

                {status && (
                    <div className={`text-[0.72rem] px-3 py-1.5 rounded mb-3 ${status.type === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {status.msg}
                    </div>
                )}

                {modules.length === 0 ? (
                    <p className="text-[0.75rem] italic" style={{ color: 'var(--muted)' }}>No modules installed.</p>
                ) : (
                    <div className="flex flex-col gap-1">
                        {modules.map(m => (
                            <div key={m.name} className="flex items-center justify-between px-3 py-1.5 rounded-md" style={{ background: 'var(--glass)', border: '1px solid var(--border2)' }}>
                                <div>
                                    <span className="text-[0.78rem] font-medium" style={{ color: 'var(--fg)' }}>{m.name}</span>
                                    <span className="ml-2 text-[0.65rem]" style={{ color: 'var(--muted)' }}>v{m.version}</span>
                                </div>
                                <button
                                    className="text-[0.65rem] px-2 py-0.5 rounded text-red-400 hover:bg-red-500/10 transition-all"
                                    onClick={() => handleUninstall(m.name)}
                                    disabled={loading}
                                    title="Uninstall"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
