import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Nav from "react-bootstrap/Nav";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import InputGroup from "react-bootstrap/InputGroup";
import Modal from "react-bootstrap/Modal";
import Dropdown from "react-bootstrap/Dropdown";

import {
  Plus,
  Search,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  MoreVertical,
  CheckCircle,
  XCircle,
  Globe,
  Shield,
  Settings,
  FileText,
  Edit2,
  Copy,
  ExternalLink,
  Filter,
  ChevronDown,
} from "lucide-react";

/* =========================
   AXIOS CLIENT + FAKE API
========================= */
const api = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

/** Fake DB */
let FAKE_DB = [
  {
    id: "proxy-001",
    name: "US Proxy 1",
    type: "SOCKS5",
    host: "192.168.1.100",
    port: 1080,
    username: "user1",
    outboundIP: "45.33.32.156",
    country: "US",
    status: "active",
    latency: 45,
    tags: ["premium", "fast"],
    profileCount: 3,
    lastChecked: "2 mins ago",
  },
  {
    id: "proxy-002",
    name: "EU Proxy 1",
    type: "HTTP",
    host: "10.0.0.50",
    port: 8080,
    outboundIP: "185.199.108.153",
    country: "DE",
    status: "active",
    latency: 120,
    tags: ["europe"],
    profileCount: 5,
    lastChecked: "5 mins ago",
  },
  {
    id: "proxy-003",
    name: "Asia Proxy 1",
    type: "SOCKS5",
    host: "172.16.0.25",
    port: 1080,
    username: "asia_user",
    outboundIP: "103.21.244.0",
    country: "SG",
    status: "error",
    tags: ["asia"],
    profileCount: 0,
    lastChecked: "1 hour ago",
  },
  {
    id: "proxy-004",
    name: "VN Proxy 1",
    type: "HTTPS",
    host: "192.168.2.200",
    port: 443,
    outboundIP: "14.225.254.100",
    country: "VN",
    status: "inactive",
    latency: 85,
    tags: ["vietnam", "local"],
    profileCount: 2,
    lastChecked: "30 mins ago",
  },
];

/** Fake endpoints (đổi sang api thật rất dễ) */
async function apiFetchProxies() {
  // return api.get("/proxies");
  await new Promise((r) => setTimeout(r, 250));
  return { data: { items: FAKE_DB } };
}

async function apiCreateProxy(payload) {
  // return api.post("/proxies", payload);
  await new Promise((r) => setTimeout(r, 250));
  const newItem = {
    id: `proxy-${Date.now()}`,
    status: "inactive",
    latency: undefined,
    outboundIP: payload.outboundIP || undefined,
    country: payload.country || "??",
    profileCount: 0,
    lastChecked: undefined,
    ...payload,
  };
  FAKE_DB = [newItem, ...FAKE_DB];
  return { data: { item: newItem } };
}

async function apiDeleteProxy(id) {
  // return api.delete(`/proxies/${id}`);
  await new Promise((r) => setTimeout(r, 200));
  FAKE_DB = FAKE_DB.filter((p) => p.id !== id);
  return { data: { ok: true } };
}

async function apiBulkDelete(ids) {
  // return api.post(`/proxies/bulk-delete`, { ids });
  await new Promise((r) => setTimeout(r, 250));
  FAKE_DB = FAKE_DB.filter((p) => !ids.includes(p.id));
  return { data: { ok: true } };
}

async function apiCheckProxy(id) {
  // return api.post(`/proxies/${id}/check`);
  await new Promise((r) => setTimeout(r, 800));
  const ok = Math.random() > 0.3;
  const latency = Math.floor(Math.random() * 200) + 20;

  FAKE_DB = FAKE_DB.map((p) =>
    p.id === id
      ? {
          ...p,
          status: ok ? "active" : "error",
          latency: ok ? latency : undefined,
          lastChecked: "Just now",
        }
      : p
  );

  const item = FAKE_DB.find((p) => p.id === id);
  return { data: { item } };
}

async function apiCheckAll() {
  // return api.post(`/proxies/check-all`);
  await new Promise((r) => setTimeout(r, 800));
  FAKE_DB = FAKE_DB.map((p) => {
    const ok = Math.random() > 0.25;
    const latency = Math.floor(Math.random() * 220) + 25;
    return {
      ...p,
      status: ok ? "active" : "error",
      latency: ok ? latency : undefined,
      lastChecked: "Just now",
    };
  });
  return { data: { items: FAKE_DB } };
}

/* =========================
   UI HELPERS
========================= */
const MAX_PROXIES = 2000;

function TypeBadge({ type }) {
  const map = {
    HTTP: "proxy-badge proxy-http",
    HTTPS: "proxy-badge proxy-https",
    SOCKS4: "proxy-badge proxy-socks4",
    SOCKS5: "proxy-badge proxy-socks5",
  };
  return <span className={map[type] || "proxy-badge"}>{type}</span>;
}

function StatusBadge({ status, latency }) {
  if (status === "active") {
    return (
      <div className="d-flex align-items-center gap-2">
        <span className="proxy-status proxy-status-active">
          <CheckCircle size={14} /> Active
        </span>
        {typeof latency === "number" ? (
          <span className="k-muted" style={{ fontSize: 12 }}>
            {latency}ms
          </span>
        ) : null}
      </div>
    );
  }
  if (status === "inactive") {
    return (
      <span className="proxy-status proxy-status-inactive">
        <XCircle size={14} /> Inactive
      </span>
    );
  }
  if (status === "checking") {
    return (
      <span className="proxy-status proxy-status-checking">
        <RefreshCw size={14} className="spin" /> Checking
      </span>
    );
  }
  return (
    <span className="proxy-status proxy-status-error">
      <XCircle size={14} /> Error
    </span>
  );
}

function CountryPill({ country }) {
  return (
    <div className="proxy-flag">
      {country || "??"}
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */
export default function Proxies() {
  const [activeTab, setActiveTab] = useState("list");

  const [proxies, setProxies] = useState([]);
  const [selected, setSelected] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // delete
  const [showDelete, setShowDelete] = useState(false);
  const [proxyToDelete, setProxyToDelete] = useState(null);

  // add modal
  const [showAdd, setShowAdd] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [newProxy, setNewProxy] = useState({
    name: "",
    type: "HTTP",
    host: "",
    port: "",
    username: "",
    password: "",
    tags: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetchProxies();
      setProxies(res?.data?.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return proxies;
    return proxies.filter((p) => {
      return (
        p.name?.toLowerCase().includes(q) ||
        String(p.host || "").includes(q) ||
        String(p.outboundIP || "").includes(q)
      );
    });
  }, [proxies, searchQuery]);

  const allChecked = filtered.length > 0 && selected.length === filtered.length;

  const toggleSelectAll = () => {
    if (allChecked) setSelected([]);
    else setSelected(filtered.map((p) => p.id));
  };

  const toggleSelectOne = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openDelete = (proxy) => {
    setProxyToDelete(proxy);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!proxyToDelete) return;
    await apiDeleteProxy(proxyToDelete.id);
    setShowDelete(false);
    setProxyToDelete(null);
    setSelected((prev) => prev.filter((id) => id !== proxyToDelete.id));
    fetchData();
  };

  const bulkDelete = async () => {
    if (selected.length === 0) return;
    await apiBulkDelete(selected);
    setSelected([]);
    fetchData();
  };

  const checkOne = async (id) => {
    setProxies((prev) => prev.map((p) => (p.id === id ? { ...p, status: "checking" } : p)));
    const res = await apiCheckProxy(id);
    const updated = res?.data?.item;
    if (updated) {
      setProxies((prev) => prev.map((p) => (p.id === id ? updated : p)));
    }
  };

  const checkAll = async () => {
    setProxies((prev) => prev.map((p) => ({ ...p, status: "checking" })));
    const res = await apiCheckAll();
    setProxies(res?.data?.items || []);
  };

  const openAdd = () => {
    setNewProxy({
      name: "",
      type: "HTTP",
      host: "",
      port: "",
      username: "",
      password: "",
      tags: "",
    });
    setShowAdd(true);
  };

  const onChangeNew = (field, value) => {
    setNewProxy((p) => ({ ...p, [field]: value }));
  };

  const testConnection = async () => {
    setIsTesting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsTesting(false);
  };

  const addProxy = async () => {
    if (!newProxy.name || !newProxy.host || !newProxy.port) return;

    const payload = {
      name: newProxy.name,
      type: newProxy.type,
      host: newProxy.host,
      port: Number(newProxy.port),
      username: newProxy.username || undefined,
      tags: newProxy.tags
        ? newProxy.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      // outboundIP/country/profileCount/status để backend set
    };

    await apiCreateProxy(payload);
    setShowAdd(false);
    fetchData();
  };

  return (
    <div className="h-100 d-flex flex-column">
      {/* Header */}
      <div className="px-4 px-lg-5 py-4 border-bottom">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <div className="fw-bold" style={{ fontSize: 34, letterSpacing: -0.6 }}>
              Proxies
            </div>
            <div className="k-muted">Manage your proxy connections for browser profiles</div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Shield size={16} style={{ color: "var(--accent)" }} />
            <div className="k-muted">Proxies:</div>
            <div className="fw-bold">{proxies.length}</div>
            <div className="k-muted">/ {MAX_PROXIES}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="d-flex gap-2">
          {[
            { id: "list", label: "List", icon: FileText },
            { id: "configuration", label: "Configuration", icon: Settings },
            { id: "resources", label: "Resources", icon: Globe },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`proxy-tab ${active ? "active" : ""}`}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* LIST TAB */}
      {activeTab === "list" && (
        <div className="flex-grow-1 overflow-hidden px-4 px-lg-5 py-4 d-flex flex-column">
          {/* Toolbar */}
          <div className="d-flex align-items-center gap-3 mb-3">
            <div style={{ minWidth: 420, maxWidth: 520, flex: "1 1 auto" }}>
              <InputGroup>
                <InputGroup.Text className="proxy-ig-left">
                  <Search size={16} />
                </InputGroup.Text>
                <Form.Control
                  className="proxy-search"
                  placeholder="Search by name, host, or IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </div>

            <Button className="k-btn-ghost d-flex align-items-center gap-2">
              <Filter size={16} /> Filter <ChevronDown size={14} />
            </Button>

            <div className="flex-grow-1" />

            <div className="d-flex align-items-center gap-2">
              <Button className="k-btn-ghost d-flex align-items-center gap-2" onClick={openAdd}>
                <Plus size={16} /> Add Proxy
              </Button>

              <Button className="k-btn-ghost k-icon-btn" title="Check All" onClick={checkAll}>
                <RefreshCw size={16} />
              </Button>
              <Button className="k-btn-ghost k-icon-btn" title="Import">
                <Upload size={16} />
              </Button>
              <Button className="k-btn-ghost k-icon-btn" title="Export">
                <Download size={16} />
              </Button>

              {selected.length > 0 && (
                <Button
                  className="k-btn-ghost k-icon-btn"
                  title="Delete Selected"
                  onClick={bulkDelete}
                  style={{ borderColor: "rgba(255,77,79,.35)", color: "#ffb2b2" }}
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          </div>

          {/* selection info */}
          {selected.length > 0 && (
            <div className="proxy-selection mb-3 d-flex align-items-center justify-content-between">
              <div>{selected.length} proxy(s) selected</div>
              <button type="button" className="proxy-link" onClick={() => setSelected([])}>
                Clear selection
              </button>
            </div>
          )}

          {/* Table */}
          <Card className="flex-grow-1 overflow-hidden">
            <div className="proxy-table-wrap">
              <table className="proxy-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>
                      <Form.Check
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>PROXY NAME</th>
                    <th>TYPE</th>
                    <th>HOST / PORT</th>
                    <th>OUTBOUND IP</th>
                    <th>STATUS</th>
                    <th>TAGS</th>
                    <th>PROFILES</th>
                    <th className="text-end">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-5 k-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-5">
                        <div className="d-flex flex-column align-items-center gap-3">
                          <div className="proxy-empty">
                            <Globe size={28} />
                          </div>
                          <div className="fw-bold">No proxies found</div>
                          <div className="k-muted">
                            {searchQuery ? "Try adjusting your search criteria" : "Add your first proxy to get started"}
                          </div>
                          {!searchQuery && (
                            <Button className="k-btn-ghost d-flex align-items-center gap-2" onClick={openAdd}>
                              <Plus size={16} /> Add Proxy
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => (
                      <tr key={p.id} className={selected.includes(p.id) ? "selected" : ""}>
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selected.includes(p.id)}
                            onChange={() => toggleSelectOne(p.id)}
                          />
                        </td>

                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <CountryPill country={p.country} />
                            <div>
                              <div className="fw-semibold">{p.name}</div>
                              <div className="k-muted" style={{ fontSize: 12 }}>
                                {p.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <TypeBadge type={p.type} />
                        </td>

                        <td>
                          <div className="font-mono">{p.host}:{p.port}</div>
                          {p.username ? (
                            <div className="k-muted" style={{ fontSize: 12 }}>
                              @{p.username}
                            </div>
                          ) : null}
                        </td>

                        <td>
                          {p.outboundIP ? <div className="font-mono">{p.outboundIP}</div> : <span className="k-muted">-</span>}
                        </td>

                        <td>
                          <StatusBadge status={p.status} latency={p.latency} />
                        </td>

                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            {p.tags?.length ? (
                              p.tags.map((t) => (
                                <span key={t} className="proxy-tag">
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="k-muted">-</span>
                            )}
                          </div>
                        </td>

                        <td>{p.profileCount}</td>

                        <td className="text-end">
                          <div className="d-inline-flex align-items-center gap-2">
                            <Button
                              size="sm"
                              className="k-btn-ghost"
                              onClick={() => checkOne(p.id)}
                              disabled={p.status === "checking"}
                              style={{ padding: "6px 12px", borderRadius: 10 }}
                            >
                              {p.status === "checking" ? <RefreshCw size={14} className="spin" /> : "Check"}
                            </Button>

                            <Dropdown align="end">
                              <Dropdown.Toggle className="k-btn-ghost k-icon-btn" id={`dd-${p.id}`}>
                                <MoreVertical size={16} />
                              </Dropdown.Toggle>

                              <Dropdown.Menu className="dropdown-menu">
                                <Dropdown.Item className="d-flex align-items-center gap-2">
                                  <Edit2 size={16} /> Edit
                                </Dropdown.Item>
                                <Dropdown.Item className="d-flex align-items-center gap-2">
                                  <Copy size={16} /> Duplicate
                                </Dropdown.Item>
                                <Dropdown.Item className="d-flex align-items-center gap-2">
                                  <ExternalLink size={16} /> Test Connection
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item
                                  className="d-flex align-items-center gap-2"
                                  onClick={() => openDelete(p)}
                                  style={{ color: "#ffb2b2" }}
                                >
                                  <Trash2 size={16} /> Delete
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* CONFIG TAB */}
      {activeTab === "configuration" && (
        <div className="flex-grow-1 overflow-auto px-4 px-lg-5 py-4">
          <Card className="p-4">
            <div className="fw-bold mb-2">Proxy Configuration</div>
            <div className="k-muted">Global proxy settings and configuration options will appear here.</div>
          </Card>
        </div>
      )}

      {/* RESOURCES TAB */}
      {activeTab === "resources" && (
        <div className="flex-grow-1 overflow-auto px-4 px-lg-5 py-4">
          <Card className="p-4">
            <div className="fw-bold mb-2">Proxy Resources</div>
            <div className="k-muted">Browse and purchase proxy resources from providers.</div>
          </Card>
        </div>
      )}

      {/* DELETE MODAL */}
      <Modal show={showDelete} onHide={() => setShowDelete(false)} centered>
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title>Delete Proxy</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="k-muted">
            Are you sure you want to delete <span className="fw-bold">{proxyToDelete?.name}</span>? This proxy is currently used by{" "}
            <span className="fw-bold">{proxyToDelete?.profileCount ?? 0}</span> profile(s). This action cannot be undone.
          </div>
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button className="k-btn-ghost" onClick={() => setShowDelete(false)}>
            Cancel
          </Button>
          <Button className="k-btn-ghost" onClick={confirmDelete} style={{ borderColor: "rgba(255,77,79,.35)", color: "#ffb2b2" }}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ADD MODAL */}
      <Modal show={showAdd} onHide={() => setShowAdd(false)} centered size="lg">
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title>Add New Proxy</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="k-muted mb-3">Configure your proxy connection settings</div>

          <Row className="g-3">
            <Col xs={12}>
              <Form.Label className="fw-semibold">Proxy Name</Form.Label>
              <Form.Control
                value={newProxy.name}
                onChange={(e) => onChangeNew("name", e.target.value)}
                placeholder="Enter a name for this proxy"
              />
            </Col>

            <Col md={4}>
              <Form.Label className="fw-semibold">Proxy Type</Form.Label>
              <Form.Select value={newProxy.type} onChange={(e) => onChangeNew("type", e.target.value)}>
                <option value="HTTP">HTTP</option>
                <option value="HTTPS">HTTPS</option>
                <option value="SOCKS4">SOCKS4</option>
                <option value="SOCKS5">SOCKS5</option>
              </Form.Select>
            </Col>

            <Col md={5}>
              <Form.Label className="fw-semibold">Host</Form.Label>
              <Form.Control
                value={newProxy.host}
                onChange={(e) => onChangeNew("host", e.target.value)}
                placeholder="192.168.1.100"
                className="font-mono"
              />
            </Col>

            <Col md={3}>
              <Form.Label className="fw-semibold">Port</Form.Label>
              <Form.Control
                value={newProxy.port}
                onChange={(e) => onChangeNew("port", e.target.value)}
                placeholder="8080"
                type="number"
                className="font-mono"
              />
            </Col>

            <Col md={6}>
              <Form.Label className="fw-semibold">
                Username <span className="k-muted" style={{ fontWeight: 500 }}>(optional)</span>
              </Form.Label>
              <Form.Control value={newProxy.username} onChange={(e) => onChangeNew("username", e.target.value)} placeholder="Enter username" />
            </Col>

            <Col md={6}>
              <Form.Label className="fw-semibold">
                Password <span className="k-muted" style={{ fontWeight: 500 }}>(optional)</span>
              </Form.Label>
              <Form.Control value={newProxy.password} onChange={(e) => onChangeNew("password", e.target.value)} placeholder="Enter password" type="password" />
            </Col>

            <Col xs={12}>
              <Form.Label className="fw-semibold">
                Tags <span className="k-muted" style={{ fontWeight: 500 }}>(comma separated)</span>
              </Form.Label>
              <Form.Control value={newProxy.tags} onChange={(e) => onChangeNew("tags", e.target.value)} placeholder="premium, fast, us-west" />
            </Col>

            <Col xs={12}>
              <div className="proxy-preview">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-semibold">Connection Preview</div>
                  <Button
                    className="k-btn-ghost d-flex align-items-center gap-2"
                    onClick={testConnection}
                    disabled={!newProxy.host || !newProxy.port || isTesting}
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw size={14} className="spin" /> Testing...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} /> Test Connection
                      </>
                    )}
                  </Button>
                </div>

                <div className="font-mono k-muted">
                  {newProxy.type.toLowerCase()}://
                  {newProxy.username ? `${newProxy.username}:***@` : ""}
                  {newProxy.host || "host"}:{newProxy.port || "port"}
                </div>
              </div>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer className="border-top">
          <Button className="k-btn-ghost" onClick={() => setShowAdd(false)}>
            Cancel
          </Button>
          <Button
            className="k-btn-accent"
            onClick={addProxy}
            disabled={!newProxy.name || !newProxy.host || !newProxy.port}
          >
            Add Proxy
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}