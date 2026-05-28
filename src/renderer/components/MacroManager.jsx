import React, { useState, useEffect, useCallback, useRef } from 'react';

const ACTION_TYPES = [
  { value: 'nav.goto',          label: 'Navigate to URL',    params: ['url'] },
  { value: 'nav.back',          label: 'Go Back',            params: [] },
  { value: 'nav.forward',       label: 'Go Forward',         params: [] },
  { value: 'nav.reload',        label: 'Reload Page',        params: [] },
  { value: 'click.element',     label: 'Click Element',      params: ['selector'] },
  { value: 'element.dblclick',  label: 'Double Click',       params: ['selector'] },
  { value: 'hover',             label: 'Hover Element',      params: ['selector'] },
  { value: 'input.fill',        label: 'Fill Input',         params: ['selector', 'value'] },
  { value: 'keyboard.pressKey', label: 'Press Key',          params: ['key'] },
  { value: 'wait',              label: 'Wait',               params: ['ms'] },
  { value: 'page.scroll',       label: 'Scroll Page',        params: ['x', 'y'] },
];

const PARAM_LABELS = {
  url: 'URL',
  selector: 'CSS / XPath Selector',
  value: 'Value',
  key: 'Key (e.g. Enter, Tab)',
  ms: 'Milliseconds',
  x: 'Scroll X (px)',
  y: 'Scroll Y (px)',
};

function generateStepId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyStep() {
  return { id: generateStepId(), type: 'click.element', params: {}, label: '', delay: 0 };
}

function StepRow({ step, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  const actionDef = ACTION_TYPES.find(a => a.value === step.type) || ACTION_TYPES[0];

  function setParam(k, v) {
    onChange({ ...step, params: { ...step.params, [k]: v } });
  }

  function setType(newType) {
    onChange({ ...step, type: newType, params: {} });
  }

  return (
    <div style={{
      background: 'var(--card, #fff)', border: '1px solid var(--border, #e5e7eb)',
      borderRadius: 8, padding: '12px 14px', marginBottom: 8,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Row 1: index, type selector, label, remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ minWidth: 24, fontSize: 12, color: 'var(--muted, #6b7280)', fontWeight: 600 }}>
          #{index + 1}
        </span>
        <select
          value={step.type}
          onChange={e => setType(e.target.value)}
          style={{ flex: '0 0 auto', fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)', background: 'var(--bg, #fff)', color: 'var(--fg, #111)' }}
        >
          {ACTION_TYPES.map(a => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Step label (optional)"
          value={step.label}
          onChange={e => onChange({ ...step, label: e.target.value })}
          style={{ flex: 1, fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)', background: 'var(--bg, #fff)', color: 'var(--fg, #111)' }}
        />
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={onMoveUp} disabled={index === 0} title="Move up"
            style={{ border: 'none', background: 'transparent', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.3 : 1, padding: '2px 4px', fontSize: 14 }}>▲</button>
          <button onClick={onMoveDown} disabled={index === total - 1} title="Move down"
            style={{ border: 'none', background: 'transparent', cursor: index === total - 1 ? 'not-allowed' : 'pointer', opacity: index === total - 1 ? 0.3 : 1, padding: '2px 4px', fontSize: 14 }}>▼</button>
          <button onClick={onRemove} title="Remove step"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '2px 6px', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Row 2: action-specific params */}
      {actionDef.params.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 32 }}>
          {actionDef.params.map(pk => (
            <div key={pk} style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: pk === 'selector' || pk === 'url' || pk === 'value' ? '1 1 200px' : '0 1 120px' }}>
              <label style={{ fontSize: 11, color: 'var(--muted, #6b7280)', fontWeight: 500 }}>{PARAM_LABELS[pk] || pk}</label>
              <input
                type={pk === 'ms' || pk === 'x' || pk === 'y' ? 'number' : 'text'}
                value={step.params[pk] ?? ''}
                onChange={e => setParam(pk, pk === 'ms' || pk === 'x' || pk === 'y' ? Number(e.target.value) : e.target.value)}
                placeholder={PARAM_LABELS[pk] || pk}
                style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)', background: 'var(--bg, #fff)', color: 'var(--fg, #111)' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Row 3: delay before this step */}
      <div style={{ paddingLeft: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 11, color: 'var(--muted, #6b7280)', whiteSpace: 'nowrap' }}>Delay before (ms)</label>
        <input
          type="number"
          min={0}
          max={60000}
          step={100}
          value={step.delay}
          onChange={e => onChange({ ...step, delay: Math.max(0, Number(e.target.value)) })}
          style={{ width: 90, fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)', background: 'var(--bg, #fff)', color: 'var(--fg, #111)' }}
        />
      </div>
    </div>
  );
}

export default function MacroManager({ profiles = [] }) {
  const [macros, setMacros] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runProfileId, setRunProfileId] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const statusTimerRef = useRef(null);
  const recUnsubRef = useRef(null);

  const loadMacros = useCallback(async () => {
    try {
      const r = await window.electronAPI.listMacros();
      if (r?.success) setMacros(r.macros || []);
    } catch {}
  }, []);

  useEffect(() => { loadMacros(); }, [loadMacros]);

  useEffect(() => {
    if (profiles.length && !runProfileId) {
      setRunProfileId(profiles[0]?.id || '');
    }
  }, [profiles]);

  function selectMacro(m) {
    if (dirty) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    setSelectedId(m.id);
    setName(m.name);
    setDescription(m.description || '');
    setSteps(m.steps || []);
    setDirty(false);
    setRunResult(null);
  }

  function newMacro() {
    if (dirty) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    setSelectedId(null);
    setName('New Macro');
    setDescription('');
    setSteps([emptyStep()]);
    setDirty(true);
    setRunResult(null);
  }

  function markDirty() { setDirty(true); }

  function updateStep(index, updated) {
    const next = steps.slice();
    next[index] = updated;
    setSteps(next);
    markDirty();
  }

  function removeStep(index) {
    setSteps(steps.filter((_, i) => i !== index));
    markDirty();
  }

  function addStep() {
    setSteps([...steps, emptyStep()]);
    markDirty();
  }

  function moveStep(index, dir) {
    const next = steps.slice();
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next);
    markDirty();
  }

  async function saveMacro() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { id: selectedId || undefined, name: name.trim(), description, steps };
      const r = await window.electronAPI.saveMacro(payload);
      if (r?.success) {
        setSelectedId(r.macro.id);
        setDirty(false);
        await loadMacros();
      } else {
        alert(r?.error || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteMacro() {
    if (!selectedId) return;
    setConfirmDelete(false);
    const r = await window.electronAPI.deleteMacro(selectedId);
    if (r?.success) {
      setSelectedId(null);
      setName('');
      setDescription('');
      setSteps([]);
      setDirty(false);
      await loadMacros();
    } else {
      alert(r?.error || 'Delete failed');
    }
  }

  async function runMacro() {
    if (!selectedId || !runProfileId) return;
    // Auto-save first if dirty
    if (dirty) {
      await saveMacro();
    }
    setRunning(true);
    setRunResult(null);
    clearTimeout(statusTimerRef.current);
    try {
      const r = await window.electronAPI.runMacro(selectedId, runProfileId);
      // stopped by user — không hiện lỗi, chỉ xóa thông báo
      if (r?.stopped) { setRunResult(null); return; }
      setRunResult(r);
      statusTimerRef.current = setTimeout(() => setRunResult(null), 6000);
    } catch (e) {
      setRunResult({ success: false, error: e?.message || String(e) });
    } finally {
      setRunning(false);
    }
  }

  // Bug #3 fix: dừng macro đang phát lại giữa chừng
  async function stopMacro() {
    if (!runProfileId) return;
    try { await window.electronAPI.stopMacro(runProfileId); } catch {}
    setRunning(false);
    setRunResult(null);
  }

  useEffect(() => () => clearTimeout(statusTimerRef.current), []);

  useEffect(() => () => {
    if (recUnsubRef.current) { recUnsubRef.current(); recUnsubRef.current = null; }
  }, []);

  async function startRecording() {
    if (!runProfileId) { alert('Chọn profile trước khi ghi.'); return; }
    const r = await window.electronAPI.startMacroRecord(runProfileId);
    if (!r?.success) { alert(r?.error || 'Không thể bắt đầu ghi.'); return; }
    setIsRecording(true);
    if (recUnsubRef.current) recUnsubRef.current();
    recUnsubRef.current = window.electronAPI.onMacroRecordStep((data) => {
      if (data.profileId !== runProfileId) return;
      const step = { ...data.step, id: Math.random().toString(36).slice(2, 10) };
      setSteps(prev => [...prev, step]);
      setDirty(true);
    });
  }

  async function stopRecording() {
    if (recUnsubRef.current) { recUnsubRef.current(); recUnsubRef.current = null; }
    setIsRecording(false);
    if (runProfileId) await window.electronAPI.stopMacroRecord(runProfileId).catch(() => {});
  }

  const selected = macros.find(m => m.id === selectedId);
  const hasEditor = selectedId !== null || dirty;

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, gap: 0, background: 'var(--bg, #f8fafc)' }}>
      {/* ── Left: macro list ─────────────────────────────────── */}
      <div style={{
        width: 240, flexShrink: 0, borderRight: '1px solid var(--border, #e5e7eb)',
        display: 'flex', flexDirection: 'column', background: 'var(--sidebar-bg, #fff)',
      }}>
        <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--border, #e5e7eb)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Macros</span>
          <button
            onClick={newMacro}
            style={{ fontSize: 13, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >+ New</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          {macros.length === 0 && (
            <div style={{ padding: '20px 10px', color: 'var(--muted, #6b7280)', fontSize: 13, textAlign: 'center' }}>
              No macros yet.<br />Click "+ New" to create one.
            </div>
          )}
          {macros.map(m => (
            <div
              key={m.id}
              onClick={() => selectMacro(m)}
              style={{
                padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                background: selectedId === m.id ? 'var(--active-bg, #eff6ff)' : 'transparent',
                borderLeft: selectedId === m.id ? '3px solid #3b82f6' : '3px solid transparent',
                color: selectedId === m.id ? '#3b82f6' : 'var(--fg, #111)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name || 'Untitled'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted, #6b7280)', marginTop: 1 }}>{(m.steps || []).length} step{m.steps?.length !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: editor ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {!hasEditor ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted, #6b7280)', fontSize: 14 }}>
            Select a macro or click "+ New"
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border, #e5e7eb)', display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--card, #fff)' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); markDirty(); }}
                  placeholder="Macro name"
                  style={{ fontSize: 16, fontWeight: 700, border: 'none', borderBottom: '2px solid var(--border, #e5e7eb)', outline: 'none', background: 'transparent', color: 'var(--fg, #111)', paddingBottom: 4 }}
                />
                <input
                  type="text"
                  value={description}
                  onChange={e => { setDescription(e.target.value); markDirty(); }}
                  placeholder="Description (optional)"
                  style={{ fontSize: 13, border: 'none', borderBottom: '1px solid var(--border, #e5e7eb)', outline: 'none', background: 'transparent', color: 'var(--muted, #6b7280)', paddingBottom: 2 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
                {dirty && (
                  <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Unsaved</span>
                )}
                <button
                  onClick={saveMacro}
                  disabled={saving || !name.trim()}
                  style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: 'none', background: saving ? '#93c5fd' : '#3b82f6', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                >{saving ? 'Saving…' : 'Save'}</button>
                {selectedId && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                  >Delete</button>
                )}
              </div>
            </div>

            {/* Recording banner */}
            {isRecording && (
              <div style={{
                padding: '8px 20px', background: '#fff1f2',
                borderBottom: '1px solid #fecdd3',
                display: 'flex', alignItems: 'center', gap: 10,
                color: '#be123c', fontSize: 13, fontWeight: 600, flexShrink: 0,
              }}>
                <style>{`@keyframes obt-blink{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
                <span style={{ fontSize: 16, animation: 'obt-blink 1s ease-in-out infinite' }}>●</span>
                <span>Đang ghi — thực hiện thao tác trên trình duyệt, các bước sẽ tự thêm vào đây</span>
                <button
                  onClick={stopRecording}
                  style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 12px', borderRadius: 5, border: '1px solid #be123c', background: 'transparent', color: '#be123c', cursor: 'pointer', fontWeight: 700 }}
                >■ Dừng</button>
              </div>
            )}

            {/* Steps */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
              {steps.length === 0 && (
                <div style={{ color: 'var(--muted, #6b7280)', fontSize: 13, marginBottom: 12 }}>No steps yet. Add a step below.</div>
              )}
              {steps.map((step, i) => (
                <StepRow
                  key={step.id}
                  step={step}
                  index={i}
                  total={steps.length}
                  onChange={updated => updateStep(i, updated)}
                  onRemove={() => removeStep(i)}
                  onMoveUp={() => moveStep(i, -1)}
                  onMoveDown={() => moveStep(i, 1)}
                />
              ))}
              <button
                onClick={addStep}
                style={{ fontSize: 13, padding: '7px 18px', borderRadius: 7, border: '1px dashed var(--border, #d1d5db)', background: 'transparent', color: 'var(--muted, #6b7280)', cursor: 'pointer', width: '100%', marginTop: 4 }}
              >+ Add Step</button>
            </div>

            {/* Footer: run */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border, #e5e7eb)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card, #fff)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--muted, #6b7280)', whiteSpace: 'nowrap' }}>Run on profile:</label>
                <select
                  value={runProfileId}
                  onChange={e => setRunProfileId(e.target.value)}
                  style={{ fontSize: 13, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)', background: 'var(--bg, #fff)', color: 'var(--fg, #111)' }}
                >
                  {profiles.length === 0 && <option value="">No profiles</option>}
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {/* Bug #3 fix: hiển nút Stop khi đang chạy, nút Run khi đứng */}
              {running ? (
                <button
                  onClick={stopMacro}
                  style={{
                    fontSize: 14, padding: '7px 22px', borderRadius: 7, border: 'none',
                    background: '#ef4444',
                    color: '#fff', cursor: 'pointer',
                    fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12 }}>&#9632;</span> Stop
                </button>
              ) : (
                <button
                  onClick={runMacro}
                  disabled={isRecording || !selectedId || !runProfileId || steps.length === 0}
                  style={{
                    fontSize: 14, padding: '7px 22px', borderRadius: 7, border: 'none',
                    background: '#22c55e',
                    color: '#fff', cursor: isRecording || !selectedId || !runProfileId || steps.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 700, opacity: (!selectedId || !runProfileId || steps.length === 0) ? 0.5 : 1,
                  }}
                >► Run</button>
              )}

              <div style={{ width: 1, height: 26, background: 'var(--border, #e5e7eb)', flexShrink: 0 }} />

              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={running || !runProfileId}
                title={isRecording ? 'Dừng ghi' : 'Bắt đầu ghi thao tác từ trình duyệt'}
                style={{
                  fontSize: 13, padding: '7px 16px', borderRadius: 7, border: 'none',
                  background: isRecording ? '#ef4444' : '#6366f1',
                  color: '#fff',
                  cursor: running || !runProfileId ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: running || !runProfileId ? 0.45 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {isRecording
                  ? <><span style={{ fontSize: 11 }}>■</span> Dừng ghi</>
                  : <><span style={{ color: '#fca5a5' }}>●</span> Ghi Macro</>}
              </button>
              {runResult && (
                <div style={{
                  fontSize: 13, padding: '6px 12px', borderRadius: 6,
                  background: runResult.success ? '#dcfce7' : '#fee2e2',
                  color: runResult.success ? '#166534' : '#991b1b',
                  border: `1px solid ${runResult.success ? '#bbf7d0' : '#fecaca'}`,
                  maxWidth: 360,
                }}>
                  {runResult.success ? '✓ Macro completed successfully' : `✗ ${runResult.error || 'Failed'}`}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConfirmDelete(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Delete Macro</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              "<strong>{name}</strong>" will be permanently deleted.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={deleteMacro}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
