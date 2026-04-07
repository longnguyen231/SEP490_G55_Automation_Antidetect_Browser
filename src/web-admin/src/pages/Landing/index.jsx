import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

// ─── Minimal animation helper ────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: 'shield_person',
    title: 'True Browser Isolation',
    desc: 'Every profile runs in a completely sandboxed environment. Cookies, storage, and fingerprints never leak between sessions.',
  },
  {
    icon: 'fingerprint',
    title: 'Deep Fingerprint Spoofing',
    desc: 'Spoof Canvas, WebGL, Audio, fonts, screen resolution, timezone, language, and WebRTC — all configurable per profile.',
  },
  {
    icon: 'hub',
    title: 'Proxy Per Profile',
    desc: 'Assign HTTP(S), SOCKS4, SOCKS5 proxies to each profile individually. Built-in proxy health checker keeps your IPs clean.',
  },
  {
    icon: 'smart_toy',
    title: 'Browser Automation',
    desc: 'Attach scripts and run multi-step automations right inside the app. Puppeteer-compatible CDP engine included.',
  },
  {
    icon: 'group_work',
    title: 'Team Collaboration',
    desc: 'Share profile groups with team members, assign roles, and monitor activity — all from the web admin panel.',
  },
  {
    icon: 'api',
    title: 'REST API',
    desc: 'Control every feature programmatically. Full OpenAPI spec included so you can integrate with any external tool or workflow.',
  },
];

const STATS = [
  { value: '10M+', label: 'Fingerprint Combinations' },
  { value: '99.9%', label: 'Detection Bypass Rate' },
  { value: '500+', label: 'Profiles Supported' },
  { value: '6', label: 'OS Fingerprints' },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Download & Install',
    desc: 'Run the installer on Windows. No GPU or complex setup required — the engine is fully bundled.',
    icon: 'download',
  },
  {
    step: '02',
    title: 'Create a Profile',
    desc: 'Configure OS, browser version, language, timezone, proxy, and advanced fingerprint settings in one modal.',
    icon: 'manage_accounts',
  },
  {
    step: '03',
    title: 'Launch & Automate',
    desc: 'Click Launch to open an isolated browser window, or attach a script to run headless automation tasks.',
    icon: 'rocket_launch',
  },
];

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#download', label: 'Download' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function FeatureCard({ icon, title, desc, index }) {
  const [ref, visible] = useInView(0.1);
  return (
    <div
      ref={ref}
      className={`bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 flex flex-col gap-4
        transition-all duration-700 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
      </div>
      <div>
        <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function StatItem({ value, label, index }) {
  const [ref, visible] = useInView(0.1);
  return (
    <div
      ref={ref}
      className={`flex flex-col items-center gap-1
        transition-all duration-700 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <span className="text-4xl font-extrabold text-primary tracking-tight">{value}</span>
      <span className="text-sm text-slate-400 text-center">{label}</span>
    </div>
  );
}

function StepCard({ step, title, desc, icon, index }) {
  const [ref, visible] = useInView(0.1);
  return (
    <div
      ref={ref}
      className={`relative flex flex-col gap-4 
        transition-all duration-700 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
        </div>
        <span className="text-5xl font-black text-slate-700 select-none leading-none">{step}</span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [heroRef, heroVisible] = useInView(0.05);
  const [statsRef, statsVisible] = useInView(0.1);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (e, href) => {
    e.preventDefault();
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out.');
  };

  return (
    <div className="min-h-screen bg-background-dark text-slate-100 font-display overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300
          ${scrolled ? 'bg-background-dark/90 backdrop-blur-xl border-b border-slate-800/80 shadow-lg' : 'bg-transparent'}`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/20 p-1.5 rounded-lg">
              <span className="material-symbols-outlined text-primary text-2xl">shield_person</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Vanguard</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={(e) => scrollTo(e, href)}
                className="text-sm font-medium text-slate-400 hover:text-primary transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {user?.role === 'admin' && (
                  <Link
                    to="/dashboard"
                    className="text-sm font-medium text-slate-400 hover:text-primary transition-colors px-3 py-1.5"
                  >
                    Dashboard →
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-slate-500 hover:text-rose-400 transition-colors px-3 py-1.5"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-400 hover:text-primary transition-colors px-3 py-1.5"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-lg border border-primary/40 text-primary text-sm font-semibold
                    hover:bg-primary/10 transition-colors"
                >
                  Register
                </Link>
              </>
            )}
            <a
              href="#download"
              onClick={(e) => scrollTo(e, '#download')}
              className="px-4 py-2 rounded-lg bg-primary text-background-dark text-sm font-semibold
                hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
            >
              Download Free
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-slate-400 hover:text-primary transition-colors p-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden bg-background-dark/95 border-b border-slate-800 px-6 py-4 space-y-3">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={(e) => scrollTo(e, href)}
                className="block text-sm font-medium text-slate-400 hover:text-primary transition-colors py-1"
              >
                {label}
              </a>
            ))}
            {isAuthenticated ? (
              <>
                {user?.role === 'admin' && (
                  <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-primary py-1">
                    Dashboard →
                  </Link>
                )}
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="block text-sm font-medium text-rose-400 py-1 text-left"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-sm text-slate-400 hover:text-primary py-1">
                  Sign In
                </Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="block text-sm text-primary font-semibold py-1">
                  Create Account
                </Link>
              </>
            )}
            <a
              href="#download"
              onClick={(e) => scrollTo(e, '#download')}
              className="block w-full text-center px-4 py-2 rounded-lg bg-primary text-background-dark text-sm font-semibold mt-2"
            >
              Download Free
            </a>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />

        <div
          ref={heroRef}
          className={`relative max-w-4xl mx-auto text-center
            transition-all duration-1000 ease-out
            ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
            bg-primary/10 border border-primary/25 text-primary text-xs font-semibold uppercase tracking-widest mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Open Source · Anti-Detection Browser
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-none mb-6">
            Browse Without&nbsp;
            <span className="relative">
              <span className="text-primary">Being Tracked</span>
              <svg className="absolute -bottom-2 left-0 w-full h-2 overflow-visible" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 6 Q50 0 100 6 Q150 12 200 6" stroke="#00bcd4" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5"/>
              </svg>
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Vanguard is a free antidetect browser for Windows that lets you manage hundreds of isolated browser
            profiles — each with a unique fingerprint, proxy, and automation stack — all from one clean dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#download"
              onClick={(e) => scrollTo(e, '#download')}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-primary text-background-dark
                font-bold text-base hover:bg-primary/90 transition-all duration-200
                shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined text-xl">download</span>
              Download for Windows
            </a>
            {isAuthenticated && user?.role === 'admin' ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-slate-700
                  text-slate-300 font-semibold text-base hover:border-primary/50 hover:text-primary
                  transition-all duration-200"
              >
                Open Dashboard
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </Link>
            ) : !isAuthenticated ? (
              <Link
                to="/login"
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-slate-700
                  text-slate-300 font-semibold text-base hover:border-primary/50 hover:text-primary
                  transition-all duration-200"
              >
                Sign In
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </Link>
            ) : null}
          </div>

          {/* Trust badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
            {['Free & Open Source', 'No Account Required', 'Windows 10/11', 'Offline Capable'].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard preview image / mockup */}
        <div
          className={`relative max-w-5xl mx-auto mt-20
            transition-all duration-1000 ease-out delay-300
            ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
        >
          <div className="relative rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden shadow-2xl shadow-black/60">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-slate-700/60">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="flex-1 mx-4 bg-slate-700/50 rounded-full h-5 flex items-center px-3">
                <span className="text-xs text-slate-500 truncate">https://app.vanguard.local/dashboard</span>
              </div>
            </div>

            {/* Mock dashboard screenshot */}
            <div className="p-4 sm:p-6 bg-background-dark min-h-[280px] sm:min-h-[340px]">
              {/* Stat cards row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { t: 'Total Profiles', v: '128', icon: 'browser_updated', c: 'text-primary' },
                  { t: 'Running', v: '12', icon: 'play_circle', c: 'text-emerald-400' },
                  { t: 'Proxies Active', v: '54', icon: 'hub', c: 'text-amber-400' },
                  { t: 'Expiring Soon', v: '3', icon: 'timer', c: 'text-rose-400' },
                ].map(({ t, v, icon, c }) => (
                  <div key={t} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">{t}</p>
                      <p className="text-xl font-bold text-white">{v}</p>
                    </div>
                    <span className={`material-symbols-outlined text-2xl ${c}`}>{icon}</span>
                  </div>
                ))}
              </div>
              {/* Mock table rows */}
              <div className="space-y-2">
                {['Profile #1', 'Profile #2', 'Profile #3'].map((name, i) => (
                  <div key={name} className="flex items-center justify-between px-4 py-2.5 bg-slate-800/40 border border-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-base">person</span>
                      </div>
                      <span className="text-sm text-slate-300 font-medium">{name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        i === 0 ? 'bg-emerald-500/15 text-emerald-400' :
                        i === 1 ? 'bg-primary/15 text-primary' :
                        'bg-slate-600/40 text-slate-400'
                      }`}>
                        {i === 0 ? 'Running' : i === 1 ? 'Ready' : 'Idle'}
                      </span>
                      <div className="hidden sm:flex gap-1">
                        <div className="w-6 h-6 rounded bg-slate-700/50 flex items-center justify-center">
                          <span className="material-symbols-outlined text-slate-400 text-sm">launch</span>
                        </div>
                        <div className="w-6 h-6 rounded bg-slate-700/50 flex items-center justify-center">
                          <span className="material-symbols-outlined text-slate-400 text-sm">more_vert</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Glow under preview */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-primary/8 blur-2xl rounded-full pointer-events-none" />
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-y border-slate-800/60 bg-slate-900/40">
        <div
          ref={statsRef}
          className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {STATS.map(({ value, label }, i) => (
            <StatItem key={label} value={value} label={label} index={i} />
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-primary font-bold uppercase tracking-widest mb-3">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Built for professionals who care about privacy
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
              From solo testers to full automation teams — Vanguard's feature set covers every use-case without the bloat.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-slate-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-primary font-bold uppercase tracking-widest mb-3">Simple by design</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Up and running in 3 steps
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 relative">
            {/* Connector line (desktop only) */}
            <div className="hidden md:block absolute top-7 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            {HOW_IT_WORKS.map((step, i) => (
              <StepCard key={step.step} {...step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Download ───────────────────────────────────────────────────────── */}
      <section id="download" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Card */}
          <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-primary/5 p-10 text-center overflow-hidden">
            {/* Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
            </div>

            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-primary text-4xl">download</span>
              </div>

              <h2 className="text-3xl font-extrabold text-white mb-3 tracking-tight">
                Download Vanguard
              </h2>
              <p className="text-slate-400 text-sm mb-2">Latest stable release · Windows 10/11 · 64-bit</p>
              <p className="text-slate-500 text-xs mb-8">Free &amp; open source — no account, no telemetry.</p>

              {/* Platform buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <a
                  href="/release/Vanguard-Setup.exe"
                  download
                  className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-primary text-background-dark
                    font-bold text-sm hover:bg-primary/90 transition-all duration-200
                    shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
                >
                  <span className="material-symbols-outlined text-xl">desktop_windows</span>
                  Windows Installer (.exe)
                </a>
                <a
                  href="/release/Vanguard-Portable.zip"
                  download
                  className="flex items-center gap-3 px-6 py-3.5 rounded-xl border border-slate-600
                    text-slate-300 font-semibold text-sm hover:border-primary/50 hover:text-primary
                    transition-all duration-200 w-full sm:w-auto justify-center"
                >
                  <span className="material-symbols-outlined text-xl">folder_zip</span>
                  Portable (.zip)
                </a>
              </div>

              {/* Version info & checksum */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-700/50">
                {[
                  { icon: 'info', label: 'Version', value: 'v1.0.0' },
                  { icon: 'storage', label: 'Size', value: '~95 MB' },
                  { icon: 'update', label: 'Released', value: 'Apr 2026' },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <span className="material-symbols-outlined text-primary text-base">{icon}</span>
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-sm font-semibold text-slate-300">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary links */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            <a
              href="https://github.com/OngBanTat/ObtAutomationAntidetectBrowser"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-base">code</span>
              View Source on GitHub
            </a>
            {isAuthenticated && user?.role === 'admin' && (
              <>
                <span className="hidden sm:block opacity-30">|</span>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-base">dashboard</span>
                  Open Web Dashboard
                </Link>
              </>
            )}
            {!isAuthenticated && (
              <>
                <span className="hidden sm:block opacity-30">|</span>
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-base">login</span>
                  Admin Login
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/60 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/20 p-1.5 rounded-lg">
              <span className="material-symbols-outlined text-primary text-xl">shield_person</span>
            </div>
            <span className="text-base font-bold text-white">Vanguard</span>
            <span className="text-slate-600 text-sm">— Antidetect Browser</span>
          </div>
          <p className="text-xs text-slate-600 text-center">
            © 2026 SEP490 Group 55 · Built with Electron, React &amp; Node.js · MIT License
          </p>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <a
              href="https://github.com/OngBanTat/ObtAutomationAntidetectBrowser"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              GitHub
            </a>
            <Link to="/dashboard" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
