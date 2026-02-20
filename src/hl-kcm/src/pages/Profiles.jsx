import React, { useEffect, useState } from "react";
import { Button, Card, Container, Dropdown, Form, Stack } from "react-bootstrap";
import { Plus, MoreVertical, Edit2, Copy, Play, Pause, Trash2 } from "lucide-react";

/** MOCK DATA + API hook (đổi sau) */
const MOCK_PROFILES = [
  { id: "1", name: "Instagram Account 1", status: "active", browserType: "Chrome", lastUsed: "2 hours ago", ipLocation: "United States", tags: ["social-media", "business"] },
  { id: "2", name: "Facebook Ads Manager", status: "active", browserType: "Chrome", lastUsed: "1 hour ago", ipLocation: "Canada", tags: ["ads", "marketing"] },
  { id: "3", name: "Amazon Seller Central", status: "inactive", browserType: "Firefox", lastUsed: "1 day ago", ipLocation: "UK", tags: ["ecommerce"] },
  { id: "4", name: "Test Profile", status: "running", browserType: "Chrome", lastUsed: "30 minutes ago", ipLocation: "Germany", tags: ["testing"] },
];

async function apiGetProfiles() {
  // sau này: return fetch(...).then(r=>r.json())
  return new Promise((r) => setTimeout(() => r(MOCK_PROFILES), 120));
}

function StatusPill({ status }) {
  const map = {
    running: { bg: "rgba(34,197,94,.10)", border: "rgba(34,197,94,.22)", color: "#4ade80", label: "Running" },
    active:  { bg: "rgba(59,130,246,.10)", border: "rgba(59,130,246,.22)", color: "#60a5fa", label: "Ready" },
    inactive:{ bg: "rgba(148,163,184,.10)", border: "rgba(148,163,184,.22)", color: "#94a3b8", label: "Inactive" },
  };
  const v = map[status] || map.inactive;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:999, background:v.bg, border:`1px solid ${v.border}`, color:v.color, fontSize:12, fontWeight:800 }}>
      {v.label}
    </span>
  );
}

export default function Profiles({ onBuyMore, onNewProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    let alive = true;
    apiGetProfiles().then((d) => alive && setProfiles(d));
    return () => (alive = false);
  }, []);

  const allSelected = profiles.length > 0 && selected.length === profiles.length;

  const toggleOne = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = (checked) => setSelected(checked ? profiles.map((p) => p.id) : []);

  return (
    <div className="h-100 d-flex flex-column">
      {/* Header */}
      <div className="px-4 px-lg-5 py-4 k-headerline">
        <div className="d-flex align-items-start justify-content-between gap-3">
          <div>
            <div className="fw-bold" style={{ fontSize: 40, letterSpacing: -0.8 }}>
              Browser Profiles
            </div>
            <div className="k-muted">
              You have <span style={{ color: "var(--accent)", fontWeight: 900 }}>{profiles.length} / 10</span> profiles in your current plan
            </div>
          </div>

          <Button className="k-btn-accent d-flex align-items-center gap-2" onClick={onNewProfile}>
            <Plus size={16} /> New Profile
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-grow-1 overflow-auto px-4 px-lg-5 py-4">
        <Container fluid className="px-0">
          {/* Toolbar */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <Form.Check
              type="checkbox"
              id="selectAll"
              checked={!!allSelected}
              onChange={(e) => toggleAll(e.target.checked)}
              label={
                <span className="k-muted" style={{ fontSize: 14, marginLeft: 6 }}>
                  {selected.length > 0 ? `${selected.length} selected` : "Select all"}
                </span>
              }
            />

            {selected.length > 0 && (
              <Stack direction="horizontal" gap={2}>
                <Button className="k-btn-ghost d-flex align-items-center gap-2" size="sm">
                  <Play size={16} /> Start
                </Button>
                <Button className="k-btn-ghost d-flex align-items-center gap-2" size="sm">
                  <Pause size={16} /> Stop
                </Button>
                <Button
                  className="k-btn-ghost d-flex align-items-center gap-2"
                  size="sm"
                  style={{ borderColor: "rgba(255,77,79,.35)", color: "var(--danger)" }}
                >
                  <Trash2 size={16} /> Delete
                </Button>
              </Stack>
            )}
          </div>

          {/* Grid */}
          <div className="k-grid">
            {profiles.map((p) => (
              <Card key={p.id} className="k-card k-profile-card position-relative">
                {/* (blob giảm mạnh, card sẽ đen hơn) */}
                <div className="k-grad-blob" />

                {/* Checkbox */}
                <div className="position-absolute" style={{ top: 16, left: 16, zIndex: 2 }}>
                  <Form.Check
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggleOne(p.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Options */}
                <div className="position-absolute k-opts" style={{ top: 10, right: 10, zIndex: 2 }}>
                  <Dropdown align="end">
                    <Dropdown.Toggle as="button" className="k-btn-ghost k-icon-btn">
                      <MoreVertical size={16} className="k-muted" />
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item className="d-flex gap-2 align-items-center">
                        <Play size={16} /> Start
                      </Dropdown.Item>
                      <Dropdown.Item className="d-flex gap-2 align-items-center">
                        <Edit2 size={16} /> Edit
                      </Dropdown.Item>
                      <Dropdown.Item className="d-flex gap-2 align-items-center">
                        <Copy size={16} /> Clone
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item className="d-flex gap-2 align-items-center" style={{ color: "var(--danger)" }}>
                        <Trash2 size={16} /> Delete
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>

                <div className="p-4 k-profile-pad">
                  {/* Title + Status */}
                  <div className="mb-3">
                    <div className="k-title" style={{ paddingRight: 36 }}>
                      {p.name}
                    </div>
                    <div className="mt-2">
                      <StatusPill status={p.status} />
                    </div>
                  </div>

                  {/* Details (thoáng hơn) */}
                  <div className="k-details">
                    <div className="d-flex justify-content-between">
                      <span className="k-meta">Browser:</span>
                      <span className="k-value">{p.browserType}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="k-meta">Location:</span>
                      <span className="k-value">{p.ipLocation}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="k-meta">Last used:</span>
                      <span className="k-value">{p.lastUsed}</span>
                    </div>
                  </div>

                  {/* Tags (thoáng hơn) */}
                  {p.tags?.length ? (
                    <div className="d-flex flex-wrap k-tags">
                      {p.tags.map((t) => (
                        <span key={t} className="k-pill">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {/* Actions (thoáng hơn) */}
                  <div className="border-top d-flex k-actions" style={{ borderColor: "var(--border)" }}>
                    <Button className="k-btn-ghost flex-fill d-flex align-items-center justify-content-center gap-2" size="sm">
                      <Play size={16} /> Start
                    </Button>
                    <Button className="k-btn-ghost flex-fill d-flex align-items-center justify-content-center gap-2" size="sm">
                      <Edit2 size={16} /> Edit
                    </Button>
                    <Button className="k-btn-ghost flex-fill d-flex align-items-center justify-content-center gap-2" size="sm">
                      <Copy size={16} /> Clone
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {/* Upgrade card */}
            <Card className="k-card k-empty d-flex align-items-center justify-content-center">
              <button type="button" onClick={onBuyMore} style={{ background: "transparent", border: "none" }} className="text-center p-4">
                <div className="d-flex flex-column align-items-center gap-3">
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 16,
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(0,210,211,.10)",
                      border: "1px solid rgba(0,210,211,.25)",
                    }}
                  >
                    <Plus size={26} style={{ color: "var(--accent)" }} />
                  </div>
                  <div>
                    <div className="fw-semibold">Add More Profiles</div>
                    <div className="k-muted" style={{ fontSize: 14 }}>
                      Upgrade your plan to add more
                    </div>
                  </div>
                </div>
              </button>
            </Card>
          </div>
        </Container>
      </div>
    </div>
  );
}
