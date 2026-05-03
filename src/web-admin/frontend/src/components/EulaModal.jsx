import React, { useEffect, useRef, useState } from 'react';

const EULA_VERSION = 'v1';
const STORAGE_KEY = `hlmck_eula_agreed_${EULA_VERSION}`;

export function hasAgreedToEula() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

export function markEulaAgreed() {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
}

// ─── EULA content sections ────────────────────────────────────────────────────
const SECTIONS = [
  {
    title: '1. Scope of Use',
    body: `The HL-MCK Antidetect Browser software ("Software") is licensed for use by individuals or organizations ("User") under the terms of this agreement. The User may install and use the Software on the device registered with a license. Any form of copying, redistribution, or resale of the Software without written permission from the development team is strictly prohibited.`,
  },
  {
    title: '2. Lawful Purpose',
    body: `This Software is designed for lawful security testing, multi-platform account management, research and development. The User agrees not to use the Software to:\n• Commit fraud, deception, or any illegal activity\n• Bypass security measures of any system without authorization\n• Collect personal data without consent\n• Attack or disrupt third-party services\n• Violate the terms of service of online platforms`,
  },
  {
    title: '3. Ethics Policy',
    body: `The User agrees to follow ethical principles when using antidetect technology:\n• Only use it on accounts lawfully owned by yourself\n• Do not use it to create or operate networks of fake accounts (bot farms)\n• Do not use it for spam, phishing, or distributing malware\n• Respect the privacy and data of others\n• Report any discovered security vulnerabilities to the development team instead of exploiting them`,
  },
  {
    title: '4. Intellectual Property',
    body: `All source code, interfaces, documentation, and components of the Software are the intellectual property of the SEP490 Group 55 development team. The User has no right to reverse engineer, decompile, or create derivative works from the Software without written permission.`,
  },
  {
    title: '5. Data & Privacy',
    body: `The Software stores profile data, cookies, and configuration locally on the User's computer. The development team does not collect or transmit any personal data to external servers, except for technical information required for license verification (Machine Code). The User is solely responsible for securing locally stored data on their device.`,
  },
  {
    title: '6. Limitation of Liability',
    body: `The Software is provided "as-is." The development team is not responsible for any direct, indirect, incidental, or consequential damages arising from the use or inability to use the Software, including but not limited to data loss, business interruption, or damages caused by violation of third-party terms of service.`,
  },
  {
    title: '7. Termination',
    body: `This agreement takes effect from the moment the User downloads or installs the Software. The development team reserves the right to terminate this agreement and revoke the license if the User is found to be in violation of any terms, without prior notice.`,
  },
  {
    title: '8. Changes to Terms',
    body: `The development team may update this agreement over time. The latest version is always published on the official website. Continued use of the Software after changes are published constitutes acceptance of the new terms.`,
  },
];

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   onAgree?: () => void   — if provided → shows "Agree & Download" button
 *   downloadLabel?: string — button label, e.g. "Windows Installer"
 *   readOnly?: boolean     — read-only, no agree button (default false)
 */
export default function EulaModal({ isOpen, onClose, onAgree, downloadLabel, readOnly = false }) {
  const bodyRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [checked, setChecked] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setScrolled(false);
      setChecked(false);
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // Track scroll to unlock agree button
  const handleScroll = () => {
    if (!bodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 40) setScrolled(true);
  };

  const handleAgree = () => {
    if (!checked) return;
    markEulaAgreed();
    onAgree?.();
    onClose();
  };

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const canAgree = scrolled && checked;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={handleBackdrop}
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col"
           style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700/60 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">gavel</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-tight">
              End User License Agreement (EULA)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">HL-MCK Antidetect Browser · {EULA_VERSION}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Scroll hint */}
        {!scrolled && !readOnly && (
          <div className="flex items-center gap-2 px-6 py-2 bg-amber-500/8 border-b border-amber-500/15 shrink-0">
            <span className="material-symbols-outlined text-amber-400 text-sm">info</span>
            <p className="text-xs text-amber-400">Please read to the end to enable the agree button</p>
          </div>
        )}

        {/* Content */}
        <div
          ref={bodyRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-300 leading-relaxed"
          style={{ overscrollBehavior: 'contain' }}
        >
          <p className="text-slate-400 text-xs border-l-2 border-primary/40 pl-3">
            By downloading and installing the Software, you confirm that you have read, understood, and agreed to all the terms below.
            If you do not agree, please do not download or use the Software.
          </p>

          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h3 className="text-sm font-semibold text-white mb-1.5">{s.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-line">{s.body}</p>
            </div>
          ))}

          <p className="text-slate-600 text-xs pt-2 border-t border-slate-800">
            © 2026 SEP490 Group 55 · HL-MCK Antidetect Browser · All rights reserved.
          </p>
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="px-6 py-4 border-t border-slate-700/60 space-y-3 shrink-0 bg-slate-900/80 rounded-b-2xl">
            {/* Checkbox */}
            <label className={`flex items-start gap-3 cursor-pointer group transition-opacity ${!scrolled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div
                onClick={() => scrolled && setChecked(v => !v)}
                className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer
                  ${checked ? 'bg-primary border-primary' : 'border-slate-600 group-hover:border-slate-400'}`}
              >
                {checked && (
                  <span className="material-symbols-outlined text-background-dark" style={{ fontSize: '11px', fontVariationSettings: "'FILL' 1" }}>check</span>
                )}
              </div>
              <span className="text-xs text-slate-400 leading-relaxed">
                I have read and agree to all Terms of Service and the Ethics Policy of HL-MCK Antidetect Browser
              </span>
            </label>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-700/60 text-slate-400 text-sm font-medium hover:border-slate-600 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAgree}
                disabled={!canAgree}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-background-dark text-sm font-bold
                  hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Agree &amp; Download {downloadLabel || ''}
              </button>
            </div>
          </div>
        )}

        {/* Footer read-only */}
        {readOnly && (
          <div className="px-6 py-4 border-t border-slate-700/60 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-slate-700/60 text-slate-400 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
