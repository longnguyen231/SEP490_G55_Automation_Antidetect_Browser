import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import InputGroup from "react-bootstrap/InputGroup";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";

import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Download,
  Upload,
  Settings,
  ExternalLink,
  Grid3X3,
  List,
  Filter,
  FolderOpen,
  Globe,
  Shield,
  Puzzle,
  X,
} from "lucide-react";

/* =========================
   AXIOS CLIENT + FAKE API
========================= */
const api = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

let FAKE_EXT_DB = [
  {
    id: "ext-1",
    name: "uBlock Origin",
    version: "1.54.0",
    description: "An efficient blocker for ads and trackers",
    icon: "UB",
    enabled: true,
    category: "privacy",
    size: "4.2 MB",
    profileCount: 8,
    source: "chrome-store",
  },
  {
    id: "ext-2",
    name: "Dark Reader",
    version: "4.9.67",
    description: "Dark mode for every website",
    icon: "DR",
    enabled: true,
    category: "productivity",
    size: "1.8 MB",
    profileCount: 5,
    source: "chrome-store",
  },
  {
    id: "ext-3",
    name: "LastPass",
    version: "4.120.0",
    description: "Password manager and secure vault",
    icon: "LP",
    enabled: false,
    category: "privacy",
    size: "12.4 MB",
    profileCount: 3,
    source: "chrome-store",
  },
  {
    id: "ext-4",
    name: "React DevTools",
    version: "4.28.5",
    description: "Adds React debugging tools to Chrome DevTools",
    icon: "RD",
    enabled: true,
    category: "development",
    size: "2.1 MB",
    profileCount: 2,
    source: "chrome-store",
  },
  {
    id: "ext-5",
    name: "Honey",
    version: "16.5.1",
    description: "Automatic coupons and cashback",
    icon: "HN",
    enabled: false,
    category: "productivity",
    size: "8.7 MB",
    profileCount: 0,
    source: "chrome-store",
  },
  {
    id: "ext-6",
    name: "Custom Script Injector",
    version: "1.0.0",
    description: "Custom extension for automation scripts",
    icon: "CS",
    enabled: true,
    category: "other",
    size: "0.5 MB",
    profileCount: 10,
    source: "local",
  },
];

async function apiFetchExtensions() {
  // return api.get("/extensions");
  await new Promise((r) => setTimeout(r, 250));
  return { data: { items: FAKE_EXT_DB } };
}

async function apiToggleExtension(id) {
  // return api.post(`/extensions/${id}/toggle`);
  await new Promise((r) => setTimeout(r, 150));
  FAKE_EXT_DB = FAKE_EXT_DB.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e));
  return { data: { item: FAKE_EXT_DB.find((e) => e.id === id) } };
}

async function apiDeleteExtension(id) {
  // return api.delete(`/extensions/${id}`);
  await new Promise((r) => setTimeout(r, 200));
  FAKE_EXT_DB = FAKE_EXT_DB.filter((e) => e.id !== id);
  return { data: { ok: true } };
}

async function apiAddExtensionFromUrl(urlOrId) {
  // return api.post(`/extensions`, { urlOrId });
  await new Promise((r) => setTimeout(r, 250));
  const newItem = {
    id: `ext-${Date.now()}`,
    name: "New Extension",
    version: "1.0.0",
    description: "Installed from URL",
    icon: "NE",
    enabled: true,
    category: "other",
    size: "1.0 MB",
    profileCount: 0,
    source: "custom",
    _urlOrId: urlOrId,
  };
  FAKE_EXT_DB = [newItem, ...FAKE_EXT_DB];
  return { data: { item: newItem } };
}

/* =========================
   UI HELPERS
========================= */
const CATEGORY_META = {
  productivity: { label: "productivity", icon: Puzzle, cls: "ext-cat ext-blue" },
  privacy: { label: "privacy", icon: Shield, cls: "ext-cat ext-green" },
  development: { label: "development", icon: Settings, cls: "ext-cat ext-orange" },
  social: { label: "social", icon: Globe, cls: "ext-cat ext-pink" },
  other: { label: "other", icon: FolderOpen, cls: "ext-cat ext-gray" },
};

function ExtCategoryPill({ category }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  const Icon = meta.icon;
  return (
    <span className={meta.cls}>
      <Icon size={12} /> {meta.label}
    </span>
  );
}

export default function Extensions() {
  const [extensions, setExtensions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [filterCategory, setFilterCategory] = useState("all");

  // delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [extToDelete, setExtToDelete] = useState(null);

  // add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState("url"); // "url" | "file"
  const [extensionUrl, setExtensionUrl] = useState("");

  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetchExtensions();
      setExtensions(res?.data?.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const enabledCount = useMemo(() => extensions.filter((e) => e.enabled).length, [extensions]);

  const filteredExtensions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return extensions.filter((ext) => {
      const matchesSearch =
        !q ||
        ext.name.toLowerCase().includes(q) ||
        ext.description.toLowerCase().includes(q);
      const matchesCategory = filterCategory === "all" || ext.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [extensions, searchQuery, filterCategory]);

  const toggleExtension = async (id) => {
    // optimistic UI
    setExtensions((prev) => prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)));
    const res = await apiToggleExtension(id);
    const updated = res?.data?.item;
    if (updated) {
      setExtensions((prev) => prev.map((e) => (e.id === id ? updated : e)));
    }
  };

  const openDelete = (ext) => {
    setExtToDelete(ext);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!extToDelete) return;
    await apiDeleteExtension(extToDelete.id);
    setShowDelete(false);
    setExtToDelete(null);
    fetchData();
  };

  const openAdd = () => {
    setAddMode("url");
    setExtensionUrl("");
    setShowAdd(true);
  };

  const addExtension = async () => {
    if (addMode === "url" && !extensionUrl.trim()) return;
    await apiAddExtensionFromUrl(extensionUrl.trim());
    setShowAdd(false);
    setExtensionUrl("");
    fetchData();
  };

  return (
    <div className="h-100 d-flex flex-column">
      {/* Header */}
      <div className="px-4 px-lg-5 py-4 border-bottom">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <div className="fw-bold" style={{ fontSize: 34, letterSpacing: -0.6 }}>
              Extensions
            </div>
            <div className="k-muted">Manage browser extensions for your profiles</div>
          </div>

          <div className="d-flex align-items-center gap-3">
            <div className="k-muted" style={{ fontSize: 14 }}>
              <span style={{ color: "var(--accent)", fontWeight: 800 }}>{enabledCount}</span>
              <span> / {extensions.length} enabled</span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="d-flex flex-column flex-lg-row gap-3">
          {/* Search */}
          <div style={{ flex: "1 1 auto", minWidth: 320 }}>
            <InputGroup>
              <InputGroup.Text className="ext-ig-left">
                <Search size={16} />
              </InputGroup.Text>
              <Form.Control
                className="ext-search"
                placeholder="Search extensions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>
          </div>

          {/* Filter & View */}
          <div className="d-flex align-items-center gap-2">
            <Form.Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="ext-select"
              style={{ width: 190 }}
            >
              <option value="all">All Categories</option>
              <option value="productivity">Productivity</option>
              <option value="privacy">Privacy</option>
              <option value="development">Development</option>
              <option value="social">Social</option>
              <option value="other">Other</option>
            </Form.Select>

            {/* View mode toggle */}
            <div className="ext-viewtoggle">
              <button
                type="button"
                className={`ext-viewbtn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                type="button"
                className={`ext-viewbtn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                <List size={16} />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="d-flex align-items-center gap-2 ms-lg-auto">
            <Button className="k-btn-ghost k-icon-btn" title="Import extensions">
              <Upload size={16} />
            </Button>
            <Button className="k-btn-ghost k-icon-btn" title="Export extensions">
              <Download size={16} />
            </Button>
            <Button className="k-btn-ghost d-flex align-items-center gap-2" onClick={openAdd}>
              <Plus size={16} /> Add Extension
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow-1 overflow-auto px-4 px-lg-5 py-4">
        {loading ? (
          <div className="k-muted">Loading...</div>
        ) : filteredExtensions.length === 0 ? (
          <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 420 }}>
            <div className="ext-empty">
              <Puzzle size={28} />
            </div>
            <div className="fw-bold mt-3">No extensions found</div>
            <div className="k-muted mt-1">
              {searchQuery ? "Try adjusting your search or filters" : "Add extensions to enhance your browser profiles"}
            </div>
            {!searchQuery && (
              <Button className="k-btn-ghost d-flex align-items-center gap-2 mt-3" onClick={openAdd}>
                <Plus size={16} /> Add Extension
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="ext-grid">
            {filteredExtensions.map((ext) => (
              <Card
                key={ext.id}
                className={`p-4 ext-card ${!ext.enabled ? "ext-disabled" : ""}`}
              >
                <div className="d-flex align-items-start justify-content-between mb-3">
                  <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
                    <div className="ext-icon">{ext.icon}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-semibold text-truncate">{ext.name}</div>
                      <div className="k-muted" style={{ fontSize: 12 }}>
                        v{ext.version}
                      </div>
                    </div>
                  </div>

                  <Dropdown align="end">
                    <Dropdown.Toggle className="k-btn-ghost k-icon-btn">
                      <MoreVertical size={16} />
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="dropdown-menu">
                      <Dropdown.Item className="d-flex align-items-center gap-2">
                        <Settings size={16} /> Options
                      </Dropdown.Item>
                      <Dropdown.Item className="d-flex align-items-center gap-2">
                        <ExternalLink size={16} /> View in Store
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item
                        className="d-flex align-items-center gap-2"
                        onClick={() => openDelete(ext)}
                        style={{ color: "#ffb2b2" }}
                      >
                        <Trash2 size={16} /> Remove
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>

                <div className="k-muted mb-3 ext-desc">{ext.description}</div>

                <div className="d-flex align-items-center gap-2 mb-3">
                  <ExtCategoryPill category={ext.category} />
                  <div className="k-muted" style={{ fontSize: 12 }}>
                    {ext.size}
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="k-muted" style={{ fontSize: 12 }}>
                    Used by <span style={{ color: "rgba(238,240,245,.92)", fontWeight: 800 }}>{ext.profileCount}</span>{" "}
                    profile{ext.profileCount !== 1 ? "s" : ""}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <div className="k-muted" style={{ fontSize: 12 }}>
                      {ext.enabled ? "Enabled" : "Disabled"}
                    </div>
                    <Form.Check
                      type="switch"
                      checked={ext.enabled}
                      onChange={() => toggleExtension(ext.id)}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {filteredExtensions.map((ext) => (
              <Card key={ext.id} className={`p-3 ext-card ${!ext.enabled ? "ext-disabled" : ""}`}>
                <div className="d-flex align-items-center gap-3">
                  <div className="ext-icon ext-icon-sm">{ext.icon}</div>

                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <div className="fw-semibold">{ext.name}</div>
                      <div className="k-muted" style={{ fontSize: 12 }}>
                        v{ext.version}
                      </div>
                      <ExtCategoryPill category={ext.category} />
                    </div>
                    <div className="k-muted text-truncate">{ext.description}</div>
                  </div>

                  <div className="d-none d-md-flex align-items-center gap-5">
                    <div className="text-center">
                      <div className="fw-bold">{ext.profileCount}</div>
                      <div className="k-muted" style={{ fontSize: 12 }}>
                        Profiles
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="fw-bold">{ext.size}</div>
                      <div className="k-muted" style={{ fontSize: 12 }}>
                        Size
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <Form.Check type="switch" checked={ext.enabled} onChange={() => toggleExtension(ext.id)} />
                    <Dropdown align="end">
                      <Dropdown.Toggle className="k-btn-ghost k-icon-btn">
                        <MoreVertical size={16} />
                      </Dropdown.Toggle>
                      <Dropdown.Menu className="dropdown-menu">
                        <Dropdown.Item className="d-flex align-items-center gap-2">
                          <Settings size={16} /> Options
                        </Dropdown.Item>
                        <Dropdown.Item className="d-flex align-items-center gap-2">
                          <ExternalLink size={16} /> View in Store
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item
                          className="d-flex align-items-center gap-2"
                          onClick={() => openDelete(ext)}
                          style={{ color: "#ffb2b2" }}
                        >
                          <Trash2 size={16} /> Remove
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* DELETE MODAL */}
      <Modal show={showDelete} onHide={() => setShowDelete(false)} centered>
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title>Remove Extension</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="k-muted">
            Are you sure you want to remove <span className="fw-bold">{extToDelete?.name}</span>? This extension is currently used by{" "}
            <span className="fw-bold">{extToDelete?.profileCount ?? 0}</span> profile(s). This action cannot be undone.
          </div>
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
            Remove
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ADD MODAL */}
      <Modal show={showAdd} onHide={() => setShowAdd(false)} centered>
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title>Add Extension</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="k-muted mb-3">Install an extension from Chrome Web Store or local file</div>

          {/* mode tabs */}
          <div className="ext-mode-tabs mb-3">
            <button
              type="button"
              className={`ext-mode-btn ${addMode === "url" ? "active" : ""}`}
              onClick={() => setAddMode("url")}
            >
              <Globe size={16} /> From URL
            </button>
            <button
              type="button"
              className={`ext-mode-btn ${addMode === "file" ? "active" : ""}`}
              onClick={() => setAddMode("file")}
            >
              <FolderOpen size={16} /> Local File
            </button>
          </div>

          {addMode === "url" ? (
            <>
              <Form.Label className="fw-semibold">Chrome Web Store URL or Extension ID</Form.Label>
              <Form.Control
                placeholder="https://chrome.google.com/webstore/detail/..."
                value={extensionUrl}
                onChange={(e) => setExtensionUrl(e.target.value)}
              />
              <div className="k-muted mt-2" style={{ fontSize: 12 }}>
                Paste the full Chrome Web Store URL or just the extension ID
              </div>
            </>
          ) : (
            <>
              <Form.Label className="fw-semibold">Extension File (.crx or .zip)</Form.Label>
              <div className="ext-dropzone">
                <Upload size={28} />
                <div className="fw-semibold mt-2">Drop your extension file here</div>
                <div className="k-muted" style={{ fontSize: 12 }}>
                  or click to browse
                </div>
              </div>
            </>
          )}

          <div className="ext-warning mt-3">
            Only install extensions from trusted sources. Malicious extensions can compromise your browser profiles and data.
          </div>
        </Modal.Body>

        <Modal.Footer className="border-top">
          <Button className="k-btn-ghost" onClick={() => setShowAdd(false)}>
            Cancel
          </Button>
          <Button className="k-btn-accent" onClick={addExtension} disabled={addMode === "url" && !extensionUrl.trim()}>
            Add Extension
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}