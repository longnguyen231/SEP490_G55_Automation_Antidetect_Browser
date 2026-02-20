import React, { useState } from "react";
import { Offcanvas, Button, Card } from "react-bootstrap";
import {
  Menu,
  X,
  Globe,
  FolderOpen,
  Share2,
  Zap,
  Trash2,
  Smartphone,
  Settings,
  Users,
  Plus,
  LogOut,
  ShoppingCart,
} from "lucide-react";

const NAVIGATION_ITEMS = [
  { id: "profiles", label: "Profiles", icon: <Globe size={18} /> },
  { id: "groups", label: "Groups", icon: <FolderOpen size={18} /> },
  { id: "proxies", label: "Proxies", icon: <Share2 size={18} /> },
  { id: "extensions", label: "Extensions", icon: <Zap size={18} /> },
  { id: "trash", label: "Trash", icon: <Trash2 size={18} />, badge: 3 },
  { id: "cloud-phone", label: "Cloud Phone", icon: <Smartphone size={18} /> },
];

const SECONDARY_ITEMS = [
  { id: "automation", label: "Automation", icon: <Zap size={18} /> },
  { id: "team", label: "Team", icon: <Users size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
];

function NavButton({ item, activeItem, onClick }) {
  const active = activeItem === item.id;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`k-navbtn ${active ? "active" : ""}`}
    >
      <span className="d-flex align-items-center gap-3">
        {item.icon}
        <span style={{ fontSize: 14, fontWeight: 650 }}>{item.label}</span>
      </span>
      {item.badge ? <span className="k-pill k-badge">{item.badge}</span> : null}
    </button>
  );
}

function BrandBlock() {
  return (
    <div className="p-4">
      <div className="d-flex align-items-center gap-3">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, var(--primary), var(--accent))",
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            fontSize: 12,
            color: "#0b0f14",
          }}
        >
          HL
        </div>
        <div>
          <div className="fw-bold" style={{ fontSize: 18 }}>
            HL-KCM
          </div>
          <div className="k-muted" style={{ fontSize: 12 }}>
            v3.2.1
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardSidebar({
  activeItem = "profiles",
  onNavigate,
  onBuyProfiles,
  onNewProfile,
  userName = "Minh Chuc",
  userEmail = "chuc@obtbrowser.com",
}) {
  const [showMobile, setShowMobile] = useState(false);

  const sidebarBody = (
    <div className="d-flex flex-column h-100 k-sidebar">
      <div className="border-bottom" style={{ borderColor: "var(--border)" }}>
        <BrandBlock />
      </div>

      <div className="flex-grow-1 overflow-auto px-3 py-3">
        <div className="d-grid gap-2 mb-3">
          {NAVIGATION_ITEMS.map((it) => (
            <NavButton
              key={it.id}
              item={it}
              activeItem={activeItem}
              onClick={() => {
                onNavigate?.(it.id);
                setShowMobile(false);
              }}
            />
          ))}
        </div>

        <div className="k-divider my-3" />

        <div className="d-grid gap-2">
          {SECONDARY_ITEMS.map((it) => (
            <NavButton
              key={it.id}
              item={it}
              activeItem={activeItem}
              onClick={() => {
                onNavigate?.(it.id);
                setShowMobile(false);
              }}
            />
          ))}
        </div>
      </div>

      <div className="p-3 border-top" style={{ borderColor: "var(--border)" }}>
        <div className="d-grid gap-2 mb-3">
          <Button
            className="k-btn-primary d-flex align-items-center justify-content-center gap-2"
            onClick={onNewProfile}
          >
            <Plus size={16} /> New Profile
          </Button>

          <Button
            className="k-btn-accent d-flex align-items-center justify-content-center gap-2"
            onClick={onBuyProfiles}
          >
            <ShoppingCart size={16} /> Buy More Profiles
          </Button>
        </div>

        <Card className="k-card-quiet p-3">
          <div className="mb-3">
            <div className="fw-semibold">{userName}</div>
            <div className="k-muted text-truncate" style={{ fontSize: 12 }}>
              {userEmail}
            </div>
          </div>
          <Button
            className="k-btn-ghost w-100 d-flex align-items-center justify-content-center gap-2"
            size="sm"
          >
            <LogOut size={14} /> Logout
          </Button>
        </Card>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <div
        className="d-lg-none position-fixed"
        style={{ top: 16, left: 16, zIndex: 1050 }}
      >
        <Button className="k-btn-ghost" onClick={() => setShowMobile(true)}>
          <Menu size={18} />
        </Button>
      </div>

      {/* Desktop sidebar */}
      <div className="d-none d-lg-block" style={{ width: 280, height: "100vh" }}>
        {sidebarBody}
      </div>

      {/* Mobile sidebar */}
      <Offcanvas
        show={showMobile}
        onHide={() => setShowMobile(false)}
        placement="start"
        className="text-light"
        style={{ background: "transparent" }}
      >
        <div style={{ background: "transparent", height: "100%" }}>
          <div className="position-absolute" style={{ right: 12, top: 12, zIndex: 1 }}>
            <Button className="k-btn-ghost" onClick={() => setShowMobile(false)}>
              <X size={18} />
            </Button>
          </div>
          {sidebarBody}
        </div>
      </Offcanvas>
    </>
  );
}
