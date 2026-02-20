import { useState } from "react";
import DashboardSidebar from "./components/DashboardSidebar";
import Profiles from "./pages/Profiles";
import Subscription from "./pages/Subscription";
import CreateProfileForm from "./components/CreateProfileForm";
import Proxies from "./pages/Proxies";
import Extensions from "./pages/Extensions";
import Automation from "./pages/Automation";

export default function App() {
  const [activeNav, setActiveNav] = useState("profiles");
  const [showSubscription, setShowSubscription] = useState(false);
  const [showCreateProfile, setShowCreateProfile] = useState(false);

  const handleBack = () => {
    setShowSubscription(false);
    setShowCreateProfile(false);
    setActiveNav("profiles");
  };

  const handleBuyProfiles = () => {
    setShowSubscription(true);
    setShowCreateProfile(false);
  };

  const handleNavigate = (itemId) => {
    setActiveNav(itemId);
    setShowSubscription(false);
    setShowCreateProfile(false);
  };

  const handleNewProfile = () => {
    setActiveNav("profiles");
    setShowSubscription(false);
    setShowCreateProfile(true);
  };

  const handleCloseCreateProfile = () => setShowCreateProfile(false);

  const handleSaveProfile = (payload) => {
    console.log("payload:", payload);
    setShowCreateProfile(false);
  };

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
        ) : showCreateProfile ? (
          <div className="h-100 p-0">
            <div className="cp-panel h-100">
              <CreateProfileForm onClose={handleCloseCreateProfile} onSave={handleSaveProfile} />
            </div>
          </div>
        ) : activeNav === "profiles" ? (
          <Profiles onBuyMore={handleBuyProfiles} onNewProfile={handleNewProfile} />
        ) : activeNav === "automation" ? (
          <Automation />
        ) : activeNav === "proxies" ? (
          <Proxies />

        ) : activeNav === "extensions" ? (
          <Extensions />
        )
          : (
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