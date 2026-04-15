import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getLicenseRequestUrl } from '../config/app.config';

export default function LicenseInfoPanel({ onRefresh }) {
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [machineCode, setMachineCode] = useState('Loading...');
  const [showActivateForm, setShowActivateForm] = useState(false);
  const [jwtInput, setJwtInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activatedInfo, setActivatedInfo] = useState(null);

  useEffect(() => {
    console.log('🎯 [LicenseInfoPanel] Component mounted!');
    alert('🎯 LicenseInfoPanel loaded! DevTools working.');
    loadLicenseInfo();
    loadMachineCode();
  }, []);

  const loadMachineCode = async () => {
    try {
      const code = await window.electronAPI.getMachineCode();
      setMachineCode(code || 'UNKNOWN');
    } catch (error) {
      console.error('Failed to get machine code:', error);
      setMachineCode('ERROR');
    }
  };

  const loadLicenseInfo = async () => {
    try {
      const info = await window.electronAPI.getLicenseInfo();
      setLicenseInfo(info);
    } catch (error) {
      console.error('Failed to load license info:', error);
      setLicenseInfo({ valid: false, tier: 'free', maxProfiles: 5 });
    } finally {
      setLoading(false);
    }
  };

  const copyTextSafely = async (text) => {
    const value = String(text || '');

    // Preferred path: browser clipboard API (requires focused document in many environments)
    try {
      if (navigator?.clipboard?.writeText && document?.hasFocus?.()) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (error) {
      console.warn('navigator.clipboard.writeText failed, trying fallback:', error);
    }

    // Fallback for Electron: write from main process clipboard API
    try {
      const result = await window.electronAPI?.writeClipboardText?.(value);
      if (result?.success) return true;
    } catch (error) {
      console.warn('electronAPI.writeClipboardText fallback failed:', error);
    }

    return false;
  };

  const handleDeactivate = async () => {
    if (!confirm('Bạn có chắc muốn deactivate license? Tài khoản sẽ chuyển về Free plan.')) {
      return;
    }

    try {
      const result = await window.electronAPI.deactivateLicense();
      if (result?.success) {
        localStorage.removeItem('hl-license-activated');
        localStorage.removeItem('hl-license-tier');
        localStorage.removeItem('hl-license-expiry');
        alert('✅ License đã được deactivate. App sẽ reload...');
        window.location.reload();
      }
    } catch (error) {
      alert('❌ Deactivate failed: ' + error.message);
    }
  };

  const handleActivate = async () => {
    console.log('[LicenseInfoPanel] 🚀 handleActivate() called!');
    
    const jwt = jwtInput.trim();
    if (!jwt) {
      alert('⚠️ Vui lòng paste JWT license key vào ô bên trên!');
      setActivateError('Please paste your JWT license key');
      return;
    }

    setActivating(true);
    setActivateError('');

    try {
      console.log('[LicenseInfoPanel] Validating JWT...');
      const result = await window.electronAPI.validateJwtLicense(jwt);
      console.log('[LicenseInfoPanel] Validation result:', result);
      
      if (result?.valid) {
        console.log('[LicenseInfoPanel] License valid! Saving to localStorage...');
        localStorage.setItem('hl-license-activated', 'true');
        localStorage.setItem('hl-license-tier', result.payload?.tier || 'free');
        if (result.payload?.expiresAt) {
          localStorage.setItem('hl-license-expiry', result.payload.expiresAt);
        }
        
        // Show IMMEDIATE alert notification
        const tierName = result.payload?.tier?.toUpperCase() || 'PRO';
        const expiryDate = result.payload?.expiresAt 
          ? new Date(result.payload.expiresAt * 1000).toLocaleDateString('vi-VN')
          : 'N/A';
        
        alert(
          `🎉 KÍCH HOẠT THÀNH CÔNG!\n\n` +
          `👑 Tier: ${tierName}\n` +
          `∞ Profiles: ${result.payload?.maxProfiles === -1 ? 'Unlimited' : result.payload?.maxProfiles}\n` +
          `📅 Hết hạn: ${expiryDate}\n\n` +
          `App sẽ tự động reload để áp dụng...`
        );
        
        // Show success modal with license info
        console.log('[LicenseInfoPanel] Showing success modal with payload:', result.payload);
        setActivatedInfo(result.payload);
        setShowSuccessModal(true);
        
        // Force re-render to ensure modal shows
        setTimeout(() => {
          console.log('[LicenseInfoPanel] Modal should be visible now. State:', {
            showSuccessModal: true,
            activatedInfo: result.payload
          });
        }, 100);
        
        // Auto-reload after 3 seconds
        setTimeout(() => {
          console.log('[LicenseInfoPanel] Auto-reloading app...');
          window.location.reload();
        }, 3000);
      } else {
        console.warn('[LicenseInfoPanel] Validation failed:', result);
        
        // Show error alert
        let errorMsg = '❌ KÍCH HOẠT THẤT BẠI!\n\n';
        
        // Handle specific errors
        if (result?.expired) {
          errorMsg += 'License đã hết hạn.\nVui lòng yêu cầu license mới.';
          setActivateError('❌ License has expired. Please request a new license.');
        } else if (result?.machineCodeMismatch) {
          errorMsg += 'License này dành cho máy khác.\nMachine code không khớp.';
          setActivateError('❌ This license is for a different device. Machine code mismatch.');
        } else {
          errorMsg += 'Chữ ký JWT không hợp lệ.\nVui lòng kiểm tra lại JWT.';
          setActivateError('❌ Invalid license signature. Please check your JWT.');
        }
        
        alert(errorMsg);
      }
    } catch (error) {
      console.error('[LicenseInfoPanel] Activation error:', error);
      alert(`❌ LỖI KÍCH HOẠT!\n\n${error.message}\n\nVui lòng thử lại hoặc liên hệ support.`);
      setActivateError('❌ Activation failed: ' + error.message);
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-[var(--card)] rounded-lg border border-[var(--border)]">
        <p className="text-[var(--muted)]">Loading license info...</p>
      </div>
    );
  }

  const tierColors = {
    free: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', badge: 'bg-gray-500' },
    pro: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', badge: 'bg-purple-600' }
  };

  const colors = tierColors[licenseInfo?.tier] || tierColors.free;
  const isNearExpiry = licenseInfo?.nearExpiry && licenseInfo?.daysRemaining > 0;
  const isExpired = licenseInfo?.expired || (licenseInfo?.daysRemaining < 0);

  return (
    <div className={`p-5 rounded-lg border border-[var(--border)] ${colors.bg}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">
            {licenseInfo?.tier === 'pro' ? '👑' : '🆓'}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--fg)]">
              License Status
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white ${colors.badge}`}>
                {licenseInfo?.tier?.toUpperCase() || 'FREE'}
              </span>
              {licenseInfo?.valid && !isExpired && (
                <span className="text-xs text-green-600 dark:text-green-400">✓ Active</span>
              )}
              {isExpired && (
                <span className="text-xs text-red-600 dark:text-red-400">✗ Expired</span>
              )}
            </div>
          </div>
        </div>

        {licenseInfo?.valid && licenseInfo?.tier !== 'free' && (
          <button
            onClick={handleDeactivate}
            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium hover:underline"
          >
            Deactivate
          </button>
        )}
      </div>

      {/* License Details */}
      <div className="space-y-2.5">
        <div className="flex justify-between items-center">
          <span className="text-sm text-[var(--muted)]">Profile Limit:</span>
          <span className="text-sm font-semibold text-[var(--fg)]">
            {licenseInfo?.maxProfiles === -1 ? '∞ Unlimited' : `${licenseInfo?.maxProfiles || 5}`}
          </span>
        </div>

        {licenseInfo?.valid && licenseInfo?.expiresAt && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-[var(--muted)]">Expires:</span>
            <span className={`text-sm font-medium ${isNearExpiry ? 'text-orange-600 dark:text-orange-400' : isExpired ? 'text-red-600 dark:text-red-400' : 'text-[var(--fg)]'}`}>
              {new Date(licenseInfo.expiresAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
              {!isExpired && licenseInfo?.daysRemaining !== undefined && (
                <span className="ml-1 text-xs">
                  ({licenseInfo.daysRemaining} days left)
                </span>
              )}
            </span>
          </div>
        )}

        {licenseInfo?.features && licenseInfo.features.length > 0 && (
          <div className="pt-2 border-t border-[var(--border)] mt-3">
            <span className="text-xs text-[var(--muted)] block mb-1.5">Features:</span>
            <div className="flex flex-wrap gap-1.5">
              {licenseInfo.features.map((feature, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 rounded bg-[var(--glass-strong)] text-[var(--fg)] font-medium"
                >
                  ✓ {feature.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expiry Warning */}
      {isNearExpiry && !isExpired && (
        <div className="mt-3 p-2.5 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded text-xs text-orange-800 dark:text-orange-300">
          ⚠️ License expires in {licenseInfo.daysRemaining} days. Please renew soon!
        </div>
      )}

      {isExpired && (
        <div className="mt-3 p-2.5 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-xs text-red-800 dark:text-red-300">
          ❌ License has expired. Your account has been downgraded to Free plan (5 profiles max).
        </div>
      )}

      {/* Upgrade CTA for free users */}
      {(!licenseInfo?.valid || licenseInfo?.tier === 'free') && (
        <>
          {/* Machine Code & Activation */}
          <div className="mt-3 p-3 bg-[var(--glass)] border border-[var(--border)] rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--fg)]">Machine Code</span>
              <button
                onClick={async () => {
                  const ok = await copyTextSafely(machineCode);
                  if (!ok) alert('Không thể copy machine code. Vui lòng chọn thủ công và copy.');
                }}
                className="text-xs text-[var(--primary)] hover:underline font-medium"
              >
                📋 Copy
              </button>
            </div>
            <code className="block text-xs bg-[var(--card)] border border-[var(--border)] p-2 rounded font-mono text-[var(--fg)] mb-2 break-all">
              {machineCode}
            </code>
            
            {!showActivateForm ? (
              <button
                onClick={() => setShowActivateForm(true)}
                className="w-full text-xs bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-3 py-2 rounded font-semibold transition"
              >
                🔑 Activate License
              </button>
            ) : (
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1.5">Paste JWT License:</label>
                <textarea
                  value={jwtInput}
                  onChange={(e) => { setJwtInput(e.target.value); setActivateError(''); }}
                  placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
                  rows={4}
                  disabled={activating}
                  className="w-full text-xs p-2 border border-[var(--border)] rounded resize-none font-mono bg-[var(--card)] text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none"
                />
                {activateError && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 mb-1.5">{activateError}</p>
                )}
                <div className="flex gap-2 mt-2">
                  {/* TEST BUTTON - REMOVE AFTER DEBUGGING */}
                  <button
                    onClick={() => alert('🧪 TEST: Button onClick works!')}
                    className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-2 rounded font-semibold"
                  >
                    🧪 TEST
                  </button>
                  
                  <button
                    onClick={handleActivate}
                    disabled={activating || !jwtInput.trim()}
                    className={`flex-1 text-xs px-3 py-2 rounded font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      activating 
                        ? 'bg-yellow-500 text-white animate-pulse' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {activating ? '⏳ Đang xác thực...' : '✅ Activate'}
                  </button>
                  <button
                    onClick={() => { setShowActivateForm(false); setJwtInput(''); setActivateError(''); }}
                    disabled={activating}
                    className="text-xs bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded font-medium transition disabled:opacity-30"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upgrade CTA */}
          <div className="mt-3 p-3 bg-gradient-to-r from-purple-500 to-blue-600 rounded text-white text-center">
            <p className="text-xs font-semibold mb-1.5">Need a Pro License?</p>
            <p className="text-xs opacity-90 mb-2">
              Request license online with your machine code
            </p>
            <button
              onClick={async () => {
                const url = getLicenseRequestUrl(machineCode);
                
                try {
                  const result = await window.electronAPI.openExternal(url);
                  if (result?.success) {
                    console.log('✅ Browser opened:', url);
                  } else {
                    throw new Error(result?.error || 'Failed to open browser');
                  }
                } catch (err) {
                  console.error('Failed to open browser:', err);
                  
                  // Fallback: Try to copy URL to clipboard for manual paste
                  let clipboardMsg = '';
                  try {
                    const copied = await copyTextSafely(url);
                    if (!copied) throw new Error('Clipboard unavailable');
                    clipboardMsg = 'URL đã được copy vào clipboard.\n';
                  } catch (clipErr) {
                    // Clipboard failed too - not critical
                    clipboardMsg = 'Copy URL này và paste vào browser:\n';
                  }
                  
                  alert(`⚠️ Không thể mở browser tự động.\n\n${clipboardMsg}${url}`);
                }
              }}
              className="text-xs bg-white text-purple-600 hover:bg-gray-100 px-3 py-1.5 rounded font-semibold transition"
            >
              Request Pro License →
            </button>
          </div>
        </>
      )}
      
      {/* Success Modal - Rendered using Portal */}
      {showSuccessModal && activatedInfo && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scaleIn">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-center">
              <div className="text-6xl mb-3 animate-bounce">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Kích Hoạt Thành Công!
              </h2>
              <p className="text-purple-100 text-sm">
                License của bạn đã được kích hoạt
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Tier Badge */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-full shadow-lg">
                  <span className="text-2xl">👑</span>
                  <span className="text-xl font-bold">
                    {activatedInfo.tier?.toUpperCase() || 'PRO'}
                  </span>
                </div>
              </div>

              {/* License Details */}
              <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Profile Limit:
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {activatedInfo.maxProfiles === -1 ? '∞ Unlimited' : activatedInfo.maxProfiles}
                  </span>
                </div>

                {activatedInfo.expiresAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Hết hạn:
                    </span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {new Date(activatedInfo.expiresAt * 1000).toLocaleDateString('vi-VN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}

                {activatedInfo.features && activatedInfo.features.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-600 dark:text-gray-400 block mb-2">
                      Tính năng kích hoạt:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activatedInfo.features.map((feature, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium"
                        >
                          ✓ {feature.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Auto-reload notice */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-900 px-4 py-2 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>App sẽ tự động reload trong 4 giây...</span>
                </div>
              </div>

              {/* Manual reload button */}
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl"
              >
                Reload Ngay
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
