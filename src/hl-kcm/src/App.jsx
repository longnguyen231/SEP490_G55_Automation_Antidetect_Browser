import { useState } from "react";
import DashboardSidebar from "./components/DashboardSidebar";
import Profiles from "./pages/Profiles";
import Subscription from "./pages/Subscription";

export default function App() {
  const [activeNav, setActiveNav] = useState("profiles");
  const [showSubscription, setShowSubscription] = useState(false);

  const handleBack = () => {
    setShowSubscription(false);
    setActiveNav("profiles");
  };

  const handleBuyProfiles = () => setShowSubscription(true);

  const handleNavigate = (itemId) => {
    setActiveNav(itemId);
    setShowSubscription(false);
  };

  const handleNewProfile = () => alert("New Profile (UI only).");

  return (
    <div className="d-flex" style={{ height: "100vh", overflow: "hidden" }}>
      <DashboardSidebar
        activeItem={activeNav}
        onNavigate={handleNavigate}
        onBuyProfiles={handleBuyProfiles}
        onNewProfile={handleNewProfile}
        userName="Minh Chuc"
        userEmail="chuc@obtbrowser.com"
      />

      <main className="flex-grow-1" style={{ height: "100vh", overflow: "hidden" }}>
        {showSubscription ? (
          <Subscription onBack={handleBack} />
        ) : activeNav === "profiles" ? (
          <Profiles onBuyMore={handleBuyProfiles} onNewProfile={handleNewProfile} />
        ) : (
          <div className="h-100 d-flex flex-column">
            <div className="px-4 px-lg-5 py-4 border-bottom">
              <div className="fw-bold" style={{ fontSize: 34, letterSpacing: -0.6 }}>
                {activeNav.toUpperCase()}
              </div>
              <div className="k-muted">Screen placeholder — làm sau.</div>
            </div>
            <div className="flex-grow-1 overflow-auto px-4 px-lg-5 py-4">
              <div className="k-card p-4">
                <div className="k-muted">Placeholder for {activeNav}.</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
