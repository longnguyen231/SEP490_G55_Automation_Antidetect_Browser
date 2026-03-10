// Web Admin Dashboard Main App

import { useState } from 'react';
import { useApiClient } from '@hooks/useApiClient';
import { useProfiles } from '@hooks/useProfiles';
import { useToast } from '@hooks/useToast';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { ToastContainer } from '@components/common/Toast';

function App() {
  const [apiBaseURL] = useState('http://localhost:5478');
  
  // Setup API client for web (REST only)
  const api = useApiClient({
    baseURL: apiBaseURL,
    preferIpc: false  // Web always uses REST
  });
  
  // Use shared hooks
  const { 
    profiles, 
    loading, 
    error,
    runningProfiles,
    launchProfile,
    stopProfile 
  } = useProfiles(api);
  
  const { toasts, success, error: showError, removeToast } = useToast();

  const handleLaunch = async (profileId) => {
    try {
      await launchProfile(profileId, { headless: false });
      success('Profile launched successfully!');
    } catch (err) {
      showError(`Failed to launch: ${err.message}`);
    }
  };

  const handleStop = async (profileId) => {
    try {
      await stopProfile(profileId);
      success('Profile stopped!');
    } catch (err) {
      showError(`Failed to stop: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>OBT Web Admin Dashboard</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        Manage browser profiles remotely via REST API
      </p>

      {error && (
        <div style={{ 
          padding: '12px', 
          background: 'var(--color-danger-light)', 
          color: 'var(--color-danger)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px'
        }}>
          Error: {error}
        </div>
      )}

      {loading ? (
        <div>Loading profiles...</div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px',
          marginTop: '20px'
        }}>
          {profiles.map(profile => {
            const isRunning = !!runningProfiles[profile.id];
            
            return (
              <Card
                key={profile.id}
                title={profile.name}
                subtitle={profile.description || 'No description'}
                variant="elevated"
              >
                <div style={{ 
                  display: 'flex', 
                  gap: '8px',
                  marginTop: '12px'
                }}>
                  <Button
                    variant={isRunning ? 'secondary' : 'success'}
                    size="small"
                    onClick={() => isRunning ? handleStop(profile.id) : handleLaunch(profile.id)}
                  >
                    {isRunning ? 'Stop' : 'Launch'}
                  </Button>
                  
                  {isRunning && (
                    <span style={{ 
                      fontSize: '12px',
                      color: 'var(--color-success)',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      ● Running
                    </span>
                  )}
                </div>

                <div style={{ 
                  marginTop: '12px',
                  fontSize: '12px',
                  color: 'var(--text-muted)'
                }}>
                  {profile.fingerprint?.os || 'Unknown OS'} • {profile.fingerprint?.browser || 'Chrome'}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {profiles.length === 0 && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3>No profiles found</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              Make sure the Desktop App is running with API server enabled.
            </p>
          </div>
        </Card>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

export default App;
