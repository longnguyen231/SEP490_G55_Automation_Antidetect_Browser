import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Modal from "react-bootstrap/Modal";
import Dropdown from "react-bootstrap/Dropdown";

import {
  Play,
  Pause,
  Square,
  Plus,
  Search,
  MoreVertical,
  FileCode,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  Download,
  Trash2,
  Edit2,
  Copy,
  FolderOpen,
  Terminal,
  Loader2,
  ChevronRight,
  Settings,
} from "lucide-react";

/* =========================
   AXIOS CLIENT + FAKE API
========================= */
const api = axios.create({ baseURL: "/api", timeout: 10000 });

let FAKE_SCRIPTS_DB = [
  {
    id: "script-1",
    name: "Auto Login Facebook",
    description: "Automatically logs into Facebook accounts with saved credentials",
    language: "puppeteer",
    lastRun: "2 hours ago",
    status: "completed",
    runCount: 156,
    createdAt: "2024-01-15",
    duration: "45s",
    profilesAssigned: 8,
  },
  {
    id: "script-2",
    name: "Cookie Collector",
    description: "Collects and exports cookies from specified websites",
    language: "javascript",
    lastRun: "1 day ago",
    status: "idle",
    runCount: 89,
    createdAt: "2024-01-10",
    duration: "2m 30s",
    profilesAssigned: 15,
  },
  {
    id: "script-3",
    name: "Form Auto-Fill",
    description: "Automatically fills forms with profile data",
    language: "playwright",
    lastRun: "Running...",
    status: "running",
    runCount: 234,
    createdAt: "2024-01-05",
    profilesAssigned: 5,
  },
  {
    id: "script-4",
    name: "Screenshot Capture",
    description: "Takes screenshots of specified pages for all profiles",
    language: "puppeteer",
    lastRun: "3 days ago",
    status: "failed",
    runCount: 45,
    createdAt: "2024-01-20",
    duration: "15s",
    profilesAssigned: 3,
  },
];

let FAKE_LOGS_DB = [
  {
    id: "log-1",
    scriptId: "script-3",
    scriptName: "Form Auto-Fill",
    profileName: "Profile Alpha",
    status: "running",
    startTime: "2 min ago",
  },
  {
    id: "log-2",
    scriptId: "script-1",
    scriptName: "Auto Login Facebook",
    profileName: "Profile Beta",
    status: "completed",
    startTime: "2 hours ago",
    duration: "45s",
  },
  {
    id: "log-3",
    scriptId: "script-1",
    scriptName: "Auto Login Facebook",
    profileName: "Profile Gamma",
    status: "completed",
    startTime: "2 hours ago",
    duration: "38s",
  },
  {
    id: "log-4",
    scriptId: "script-4",
    scriptName: "Screenshot Capture",
    profileName: "Profile Delta",
    status: "failed",
    startTime: "3 days ago",
    duration: "5s",
    message: "Connection timeout",
  },
];

const FAKE_PROFILES = [
  { id: "p1", name: "Profile Alpha" },
  { id: "p2", name: "Profile Beta" },
  { id: "p3", name: "Profile Gamma" },
  { id: "p4", name: "Profile Delta" },
  { id: "p5", name: "Profile Epsilon" },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiFetchAutomation() {
  // return api.get("/automation");
  await wait(220);
  return { data: { scripts: FAKE_SCRIPTS_DB, logs: FAKE_LOGS_DB, profiles: FAKE_PROFILES } };
}

async function apiCreateScript(payload) {
  // return api.post("/automation/scripts", payload);
  await wait(220);
  const newItem = {
    id: `script-${Date.now()}`,
    name: payload.name,
    description: payload.description || "",
    language: payload.language || "puppeteer",
    lastRun: "Never",
    status: "idle",
    runCount: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    profilesAssigned: 0,
  };
  FAKE_SCRIPTS_DB = [newItem, ...FAKE_SCRIPTS_DB];
  return { data: { item: newItem } };
}

async function apiDeleteScript(id) {
  // return api.delete(`/automation/scripts/${id}`);
  await wait(180);
  const removed = FAKE_SCRIPTS_DB.find((s) => s.id === id);
  FAKE_SCRIPTS_DB = FAKE_SCRIPTS_DB.filter((s) => s.id !== id);
  // logs vẫn giữ demo
  return { data: { ok: true, removed } };
}

async function apiRunScript(scriptId, profileIds) {
  // return api.post(`/automation/scripts/${scriptId}/run`, { profileIds });
  await wait(250);

  const script = FAKE_SCRIPTS_DB.find((s) => s.id === scriptId);
  if (!script) return { data: { ok: false } };

  // update script running
  FAKE_SCRIPTS_DB = FAKE_SCRIPTS_DB.map((s) =>
    s.id === scriptId
      ? { ...s, status: "running", lastRun: "Running...", profilesAssigned: profileIds.length }
      : s
  );

  // add logs per profile
  const nowId = Date.now();
  const profileMap = new Map(FAKE_PROFILES.map((p) => [p.id, p.name]));
  const newLogs = profileIds.map((pid, idx) => ({
    id: `log-${nowId + idx}`,
    scriptId,
    scriptName: script.name,
    profileName: profileMap.get(pid) || pid,
    status: "running",
    startTime: "Just now",
  }));

  FAKE_LOGS_DB = [ ...newLogs, ...FAKE_LOGS_DB ];

  // simulate completion after a bit
  setTimeout(() => {
    // random complete/fail
    const ok = Math.random() > 0.2;

    FAKE_SCRIPTS_DB = FAKE_SCRIPTS_DB.map((s) =>
      s.id === scriptId
        ? {
            ...s,
            status: ok ? "completed" : "failed",
            lastRun: "Just now",
            runCount: (s.runCount || 0) + 1,
            duration: ok ? "40s" : "5s",
          }
        : s
    );

    FAKE_LOGS_DB = FAKE_LOGS_DB.map((l) => {
      if (l.scriptId !== scriptId) return l;
      if (l.status !== "running") return l;
      return {
        ...l,
        status: ok ? "completed" : "failed",
        duration: ok ? "40s" : "5s",
        message: ok ? "" : "Runtime error",
      };
    });
  }, 1400);

  return { data: { ok: true } };
}

async function apiStopScript(scriptId) {
  // return api.post(`/automation/scripts/${scriptId}/stop`);
  await wait(160);

  FAKE_SCRIPTS_DB = FAKE_SCRIPTS_DB.map((s) =>
    s.id === scriptId ? { ...s, status: "stopped", lastRun: "Stopped" } : s
  );
  FAKE_LOGS_DB = FAKE_LOGS_DB.map((l) =>
    l.scriptId === scriptId && l.status === "running" ? { ...l, status: "stopped", duration: "—", message: "Stopped by user" } : l
  );

  return { data: { ok: true } };
}

/* =========================
   UI HELPERS
========================= */
const STATUS_BADGE_CLASS = {
  idle: "auto-badge auto-idle",
  running: "auto-badge auto-running",
  completed: "auto-badge auto-ok",
  failed: "auto-badge auto-fail",
  stopped: "auto-badge auto-stop",
};

const LANG_BADGE_CLASS = {
  javascript: "auto-pill auto-js",
  python: "auto-pill auto-py",
  puppeteer: "auto-pill auto-pp",
  playwright: "auto-pill auto-pw",
};

function StatusIcon({ status }) {
  switch (status) {
    case "running":
      return <Loader2 size={16} className="auto-spin" />;
    case "completed":
      return <CheckCircle size={16} />;
    case "failed":
      return <XCircle size={16} />;
    case "stopped":
      return <AlertCircle size={16} />;
    default:
      return <Clock size={16} />;
  }
}

export default function Automation() {
  const [scripts, setScripts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("scripts"); // scripts | logs
  const [loading, setLoading] = useState(false);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newScript, setNewScript] = useState({
    name: "",
    description: "",
    language: "puppeteer",
    code: "",
  });

  // run modal
  const [showRun, setShowRun] = useState(false);
  const [scriptToRun, setScriptToRun] = useState(null);
  const [selectedProfiles, setSelectedProfiles] = useState([]);

  // delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await apiFetchAutomation();
      setScripts(res?.data?.scripts || []);
      setLogs(res?.data?.logs || []);
      setProfiles(res?.data?.profiles || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // refresh periodically to reflect "fake completion"
  useEffect(() => {
    const t = setInterval(() => {
      refresh();
    }, 1200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredScripts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scripts.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q)
    );
  }, [scripts, searchQuery]);

  const runningCount = useMemo(
    () => scripts.filter((s) => s.status === "running").length,
    [scripts]
  );

  const openRun = (script) => {
    setScriptToRun(script);
    setSelectedProfiles([]);
    setShowRun(true);
  };

  const toggleProfile = (profileId) => {
    setSelectedProfiles((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]
    );
  };

  const confirmRun = async () => {
    if (!scriptToRun || selectedProfiles.length === 0) return;

    // optimistic
    setScripts((prev) =>
      prev.map((s) =>
        s.id === scriptToRun.id ? { ...s, status: "running", lastRun: "Running..." } : s
      )
    );

    setShowRun(false);
    await apiRunScript(scriptToRun.id, selectedProfiles);
    setScriptToRun(null);
    setSelectedProfiles([]);
    refresh();
  };

  const stopScript = async (scriptId) => {
    // optimistic
    setScripts((prev) => prev.map((s) => (s.id === scriptId ? { ...s, status: "stopped" } : s)));
    await apiStopScript(scriptId);
    refresh();
  };

  const createScript = async () => {
    if (!newScript.name.trim()) return;
    await apiCreateScript(newScript);
    setShowCreate(false);
    setNewScript({ name: "", description: "", language: "puppeteer", code: "" });
    refresh();
  };

  const openDelete = (script) => {
    setScriptToDelete(script);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!scriptToDelete) return;
    await apiDeleteScript(scriptToDelete.id);
    setShowDelete(false);
    setScriptToDelete(null);
    refresh();
  };

  return (
    <div className="h-100 d-flex flex-column">
      {/* Header */}
      <div className="px-4 px-lg-5 py-4 border-bottom">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <div className="fw-bold" style={{ fontSize: 34, letterSpacing: -0.6 }}>
              Automation
            </div>
            <div className="k-muted">Create and run automation scripts on your browser profiles</div>
          </div>

          <div className="d-flex align-items-center gap-2 k-muted" style={{ fontSize: 14 }}>
            <Terminal size={16} />
            <span>{runningCount} running</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="d-flex gap-2 mb-3">
          <button
            type="button"
            className={`auto-tab ${activeTab === "scripts" ? "active" : ""}`}
            onClick={() => setActiveTab("scripts")}
          >
            Scripts
          </button>
          <button
            type="button"
            className={`auto-tab ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            Execution Logs
          </button>
        </div>

        {/* Toolbar */}
        <div className="d-flex flex-column flex-lg-row gap-3 align-items-lg-center">
          <div style={{ flex: "1 1 auto", maxWidth: 520 }}>
            <InputGroup>
              <InputGroup.Text className="auto-ig-left">
                <Search size={16} />
              </InputGroup.Text>
              <Form.Control
                className="auto-search"
                placeholder="Search scripts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>
          </div>

          <div className="d-flex align-items-center gap-2 ms-lg-auto">
            <Button className="k-btn-ghost d-flex align-items-center gap-2" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> New Script
            </Button>
            <Button className="k-btn-ghost d-flex align-items-center gap-2">
              <Upload size={16} /> Import
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow-1 overflow-auto px-4 px-lg-5 py-4">
        {loading ? (
          <div className="k-muted">Loading...</div>
        ) : activeTab === "scripts" ? (
          <div className="auto-grid">
            {filteredScripts.length === 0 ? (
              <div className="auto-empty">
                <FileCode size={54} />
                <div className="fw-bold mt-3">No scripts found</div>
                <div className="k-muted mt-1">
                  {searchQuery ? "Try a different search term" : "Create your first automation script"}
                </div>
                {!searchQuery && (
                  <Button className="k-btn-ghost d-flex align-items-center gap-2 mt-3" onClick={() => setShowCreate(true)}>
                    <Plus size={16} /> New Script
                  </Button>
                )}
              </div>
            ) : (
              filteredScripts.map((script) => (
                <Card key={script.id} className="p-4 auto-card">
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="auto-ico">
                        <FileCode size={18} style={{ color: "var(--accent)" }} />
                      </div>
                      <div>
                        <div className="fw-semibold">{script.name}</div>

                        <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                          <span className={LANG_BADGE_CLASS[script.language] || "auto-pill"}>
                            {script.language}
                          </span>

                          <span className={STATUS_BADGE_CLASS[script.status] || "auto-badge"}>
                            <span className="d-inline-flex align-items-center gap-2">
                              <StatusIcon status={script.status} />
                              {script.status}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <Dropdown align="end">
                      <Dropdown.Toggle className="k-btn-ghost k-icon-btn auto-menu">
                        <MoreVertical size={16} />
                      </Dropdown.Toggle>
                      <Dropdown.Menu className="dropdown-menu">
                        <Dropdown.Item className="d-flex align-items-center gap-2">
                          <Edit2 size={16} /> Edit Script
                        </Dropdown.Item>
                        <Dropdown.Item className="d-flex align-items-center gap-2">
                          <Copy size={16} /> Duplicate
                        </Dropdown.Item>
                        <Dropdown.Item className="d-flex align-items-center gap-2">
                          <Download size={16} /> Export
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item className="d-flex align-items-center gap-2">
                          <Settings size={16} /> Configure
                        </Dropdown.Item>
                        <Dropdown.Item className="d-flex align-items-center gap-2">
                          <FolderOpen size={16} /> Open Folder
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item
                          className="d-flex align-items-center gap-2"
                          onClick={() => openDelete(script)}
                          style={{ color: "#ffb2b2" }}
                        >
                          <Trash2 size={16} /> Delete
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>

                  <div className="k-muted mb-3 auto-desc">{script.description}</div>

                  <div className="d-flex flex-wrap gap-3 k-muted" style={{ fontSize: 12 }}>
                    <span className="d-inline-flex align-items-center gap-2">
                      <Clock size={14} /> Last run: {script.lastRun}
                    </span>
                    <span>Runs: {script.runCount}</span>
                    <span>{script.profilesAssigned} profiles</span>
                  </div>

                  <div className="d-flex align-items-center gap-2 pt-3 mt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    {script.status === "running" ? (
                      <>
                        <Button
                          size="sm"
                          className="k-btn-ghost d-flex align-items-center gap-2 flex-grow-1"
                          onClick={() => stopScript(script.id)}
                        >
                          <Square size={16} /> Stop
                        </Button>
                        <Button size="sm" className="k-btn-ghost d-flex align-items-center gap-2">
                          <Pause size={16} /> Pause
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="k-btn-accent d-flex align-items-center gap-2 flex-grow-1"
                          onClick={() => openRun(script)}
                        >
                          <Play size={16} /> Run
                        </Button>
                        <Button size="sm" className="k-btn-ghost">
                          <ChevronRight size={18} />
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : (
          <Card className="p-0 auto-table-card">
            <div className="table-responsive">
              <table className="table mb-0 auto-table">
                <thead>
                  <tr>
                    <th>Script</th>
                    <th>Profile</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="fw-semibold">{log.scriptName}</td>
                      <td>{log.profileName}</td>
                      <td>
                        <span className={STATUS_BADGE_CLASS[log.status] || "auto-badge"}>
                          <span className="d-inline-flex align-items-center gap-2">
                            <StatusIcon status={log.status} />
                            {log.status}
                          </span>
                        </span>
                      </td>
                      <td className="k-muted">{log.startTime}</td>
                      <td className="k-muted">{log.duration || "-"}</td>
                      <td className="k-muted">{log.message || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* CREATE MODAL */}
      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered size="lg">
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title>Create New Script</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="k-muted mb-3">Create a new automation script for your browser profiles</div>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Script Name</Form.Label>
            <Form.Control
              value={newScript.name}
              onChange={(e) => setNewScript((p) => ({ ...p, name: e.target.value }))}
              placeholder="Enter script name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Description</Form.Label>
            <Form.Control
              value={newScript.description}
              onChange={(e) => setNewScript((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe what this script does"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Language / Framework</Form.Label>
            <Form.Select
              value={newScript.language}
              onChange={(e) => setNewScript((p) => ({ ...p, language: e.target.value }))}
            >
              <option value="puppeteer">Puppeteer</option>
              <option value="playwright">Playwright</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Script Code</Form.Label>
            <Form.Control
              as="textarea"
              rows={9}
              className="auto-code"
              value={newScript.code}
              onChange={(e) => setNewScript((p) => ({ ...p, code: e.target.value }))}
              placeholder={`// Enter your ${newScript.language} code here...\n\nawait page.goto('https://example.com');\nawait page.waitForSelector('#login');`}
            />
          </Form.Group>

          <div className="auto-drop">
            <Upload size={16} />
            <span>Or drag and drop a script file here</span>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button className="k-btn-ghost" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
          <Button className="k-btn-accent" onClick={createScript} disabled={!newScript.name.trim()}>
            Create Script
          </Button>
        </Modal.Footer>
      </Modal>

      {/* RUN MODAL */}
      <Modal show={showRun} onHide={() => setShowRun(false)} centered>
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title>Run Script</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="k-muted mb-3">
            Select profiles to run <span className="fw-bold">"{scriptToRun?.name}"</span> on
          </div>

          <div className="d-flex flex-column gap-2 auto-profiles">
            {profiles.map((p) => {
              const checked = selectedProfiles.includes(p.id);
              return (
                <label key={p.id} className={`auto-profile ${checked ? "active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProfile(p.id)}
                    className="form-check-input"
                  />
                  <span className="fw-semibold">{p.name}</span>
                </label>
              );
            })}
          </div>

          <div className="auto-selected mt-3">
            <span className="k-muted">Selected profiles:</span>
            <span className="fw-bold">{selectedProfiles.length}</span>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button className="k-btn-ghost" onClick={() => setShowRun(false)}>
            Cancel
          </Button>
          <Button
            className="k-btn-accent d-flex align-items-center gap-2"
            onClick={confirmRun}
            disabled={selectedProfiles.length === 0}
          >
            <Play size={16} />
            Run on {selectedProfiles.length} profile(s)
          </Button>
        </Modal.Footer>
      </Modal>

      {/* DELETE MODAL */}
      <Modal show={showDelete} onHide={() => setShowDelete(false)} centered>
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title>Delete Script</Modal.Title>
        </Modal.Header>
        <Modal.Body className="k-muted">
          Are you sure you want to delete <span className="fw-bold">{scriptToDelete?.name}</span>? This action cannot be undone.
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button className="k-btn-ghost" onClick={() => setShowDelete(false)}>
            Cancel
          </Button>
          <Button
            className="k-btn-ghost"
            onClick={confirmDelete}
            style={{ borderColor: "rgba(255,77,79,.35)", color: "#ffb2b2" }}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}