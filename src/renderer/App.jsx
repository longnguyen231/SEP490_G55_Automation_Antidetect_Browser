import React, { useState, useEffect } from 'react';
import './App.css';

/**
 * Main Application Component
 * SEP490 G55 - Automation Antidetect Browser
 * 
 * Component chính của ứng dụng.
 * Quản lý state và routing giữa các views.
 */

function App() {
    // State quản lý profiles
    const [profiles, setProfiles] = useState([]);
    const [runningProfiles, setRunningProfiles] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State cho view hiện tại
    const [currentView, setCurrentView] = useState('profiles'); // 'profiles', 'automation', 'settings'
    const [selectedProfile, setSelectedProfile] = useState(null);

    /**
     * Load profiles khi component mount
     */
    useEffect(() => {
        loadProfiles();
        loadRunningProfiles();

        // Lắng nghe sự thay đổi running profiles
        if (window.electronAPI) {
            window.electronAPI.onRunningProfilesChanged((data) => {
                setRunningProfiles(data.map || {});
            });
        }

        return () => {
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners();
            }
        };
    }, []);

    /**
     * Load danh sách profiles
     */
    async function loadProfiles() {
        try {
            setLoading(true);
            if (window.electronAPI) {
                const result = await window.electronAPI.profiles.getAll();
                if (result.success) {
                    setProfiles(result.profiles);
                } else {
                    setError(result.error);
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Load running profiles
     */
    async function loadRunningProfiles() {
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.browser.getRunning();
                if (result.success) {
                    setRunningProfiles(result.profiles);
                }
            }
        } catch (err) {
            console.error('Failed to load running profiles:', err);
        }
    }

    /**
     * Tạo profile mới
     */
    async function handleCreateProfile() {
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.profiles.create({
                    name: `Profile ${profiles.length + 1}`,
                });
                if (result.success) {
                    setProfiles([...profiles, result.profile]);
                }
            }
        } catch (err) {
            setError(err.message);
        }
    }

    /**
     * Launch một profile
     */
    async function handleLaunchProfile(profileId) {
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.browser.launch(profileId);
                if (!result.success) {
                    setError(result.error);
                }
            }
        } catch (err) {
            setError(err.message);
        }
    }

    /**
     * Stop một profile
     */
    async function handleStopProfile(profileId) {
        try {
            if (window.electronAPI) {
                await window.electronAPI.browser.stop(profileId);
            }
        } catch (err) {
            setError(err.message);
        }
    }

    /**
     * Xóa một profile
     */
    async function handleDeleteProfile(profileId) {
        if (!confirm('Bạn có chắc muốn xóa profile này?')) return;

        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.profiles.delete(profileId);
                if (result.success) {
                    setProfiles(profiles.filter(p => p.id !== profileId));
                }
            }
        } catch (err) {
            setError(err.message);
        }
    }

    /**
     * Render danh sách profiles
     */
    function renderProfiles() {
        if (loading) {
            return <div className="loading">Đang tải...</div>;
        }

        if (profiles.length === 0) {
            return (
                <div className="empty-state">
                    <p>Chưa có profile nào. Hãy tạo profile đầu tiên!</p>
                    <button onClick={handleCreateProfile} className="btn btn-primary">
                        + Tạo Profile
                    </button>
                </div>
            );
        }

        return (
            <div className="profiles-grid">
                {profiles.map(profile => {
                    const isRunning = !!runningProfiles[profile.id];
                    return (
                        <div key={profile.id} className={`profile-card ${isRunning ? 'running' : ''}`}>
                            <div className="profile-header">
                                <h3>{profile.name}</h3>
                                <span className={`status-badge ${isRunning ? 'running' : 'stopped'}`}>
                                    {isRunning ? '🟢 Running' : '⚪ Stopped'}
                                </span>
                            </div>

                            <div className="profile-info">
                                <p><strong>Group:</strong> {profile.group || 'Default'}</p>
                                <p><strong>Start URL:</strong> {profile.startUrl || 'https://www.google.com'}</p>
                                <p><strong>Engine:</strong> {profile.settings?.engine || 'playwright'}</p>
                            </div>

                            <div className="profile-actions">
                                {isRunning ? (
                                    <button
                                        onClick={() => handleStopProfile(profile.id)}
                                        className="btn btn-danger"
                                    >
                                        Stop
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleLaunchProfile(profile.id)}
                                        className="btn btn-success"
                                    >
                                        Launch
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedProfile(profile)}
                                    className="btn btn-secondary"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDeleteProfile(profile.id)}
                                    className="btn btn-danger-outline"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="app">
            {/* Header */}
            <header className="app-header">
                <h1>🌐 SEP490 G55 - Automation Antidetect Browser</h1>
                <nav className="nav-tabs">
                    <button
                        className={currentView === 'profiles' ? 'active' : ''}
                        onClick={() => setCurrentView('profiles')}
                    >
                        📋 Profiles
                    </button>
                    <button
                        className={currentView === 'automation' ? 'active' : ''}
                        onClick={() => setCurrentView('automation')}
                    >
                        🤖 Automation
                    </button>
                    <button
                        className={currentView === 'settings' ? 'active' : ''}
                        onClick={() => setCurrentView('settings')}
                    >
                        ⚙️ Settings
                    </button>
                </nav>
            </header>

            {/* Error Alert */}
            {error && (
                <div className="alert alert-error">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Main Content */}
            <main className="app-main">
                {currentView === 'profiles' && (
                    <div className="view-profiles">
                        <div className="view-header">
                            <h2>Browser Profiles</h2>
                            <button onClick={handleCreateProfile} className="btn btn-primary">
                                + Tạo Profile Mới
                            </button>
                        </div>
                        {renderProfiles()}
                    </div>
                )}

                {currentView === 'automation' && (
                    <div className="view-automation">
                        <h2>🤖 Automation Scripts</h2>
                        <p>Chức năng automation sẽ được phát triển tại đây.</p>
                    </div>
                )}

                {currentView === 'settings' && (
                    <div className="view-settings">
                        <h2>⚙️ Settings</h2>
                        <p>Cài đặt ứng dụng sẽ được phát triển tại đây.</p>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <p>SEP490 G55 Team - Automation Antidetect Browser v1.0.0</p>
            </footer>
        </div>
    );
}

export default App;
