/**
 * fingerprintInit.js — Browser-side fingerprint injection scripts.
 *
 * All functions passed to context.addInitScript() execute inside the browser
 * context BEFORE any page scripts. They must be completely self-contained
 * (no Node.js APIs, no closures over outer scope).
 */

// Hàm phân tích chuỗi độ phân giải màn hình dạng "1920x1080" thành object { width, height }
// Trả về null nếu chuỗi không hợp lệ (để tránh lỗi khi dữ liệu người dùng nhập sai)
function parseResolution(res) {
  try {
    if (!res || typeof res !== 'string') return null;
    const m = res.match(/^(\d+)x(\d+)$/);
    if (!m) return null;
    const width = Math.max(1, parseInt(m[1], 10));
    const height = Math.max(1, parseInt(m[2], 10));
    return { width, height };
  } catch { return null; }
}

// Simple string hash for generating seed from profile ID
// Hàm băm đơn giản: chuyển chuỗi profileId thành một số nguyên dương (seed).
// seed này được dùng để khởi tạo bộ sinh số ngẫu nhiên mulberry32 —
// đảm bảo mỗi profile luôn tạo ra cùng một chuỗi nhiễu (deterministic noise).
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    // Thuật toán djb2: dịch bit + cộng charCode, giữ 32-bit
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Ép kiểu về số nguyên 32-bit (tránh số quá lớn)
  }
  return Math.abs(hash); // Luôn trả về số dương
}

// Hàm chính: tiêm tất cả các script giả mạo fingerprint vào trình duyệt.
// - context: đối tượng BrowserContext của Playwright — đại diện cho một phiên trình duyệt
// - profile: hồ sơ người dùng (chứa fingerprint, cài đặt)
// - settings: cài đặt từ UI (hardware, audio, webgl, v.v.)
// - overrideUserAgent: User-Agent tùy chỉnh (nếu có)
// - safeMode: chế độ an toàn — chỉ chạy block 0, bỏ qua tất cả Object.defineProperty
//   (Cloudflare Enterprise phát hiện được descriptor bị thay đổi)
// - isFirefox: true nếu đang dùng trình duyệt Firefox (cần xử lý khác Chrome)
async function applyFingerprintInitScripts(context, profile, settings, { overrideUserAgent, safeMode, isFirefox } = {}) {
  // Lấy dữ liệu fingerprint và cài đặt nâng cao từ profile/settings
  // Dùng || {} để tránh lỗi nếu profile hoặc settings là null/undefined
  const fp = (profile && profile.fingerprint) || {};
  const adv = (settings && settings.advanced) || {};
  const locale = fp.language || settings?.language || 'en-US';
  const userAgent = overrideUserAgent || fp.userAgent || undefined;
  // Use 0 as sentinel = "use real hardware value, don't spoof"
  // 0 = giá trị sentinel: không giả mạo, dùng giá trị thật của máy
  const cpuCores = Number(settings?.cpuCores) || 0;
  const deviceMemory = Number(settings?.memoryGB) || 0;
  // apply: object chứa các cờ bật/tắt từng nhóm override (navigator, webgl, canvas, v.v.)
  const apply = (settings && settings.applyOverrides) || {};

  // Safe mode: only run block 0 (webdriver + CDP cleanup).
  // All Object.defineProperty overrides on native prototypes are detected
  // by Cloudflare enterprise, so we skip them in safe mode.
  // All sections are strict opt-in (=== true).
  // Old profiles without section settings get no injection (backward compatible).
  // New profiles: each section only injects when its UI toggle is explicitly ON.

  // Kiểm tra từng section có được bật trong UI không (=== true để strict opt-in).
  // Profile cũ không có setting này => không inject gì (backward compatible).
  // Chỉ inject khi người dùng đã bật công tắc tương ứng trong giao diện.
  const identitySectionEnabled = settings?.identity?.enabled === true;  // Section danh tính (navigator, UA, ngôn ngữ)
  const hwSectionEnabled       = settings?.hardware?.enabled === true;  // Section phần cứng (CPU, RAM)
  const webglSectionEnabled    = settings?.webgl?.enabled    === true;  // Section WebGL (card đồ họa)
  const displaySectionEnabled  = settings?.display?.enabled  === true;  // Section màn hình (độ phân giải)
  const canvasSectionEnabled   = settings?.canvas?.enabled   === true;  // Section Canvas (fingerprint ảnh)
  const audioSectionEnabled    = settings?.audio?.enabled    === true;  // Section AudioContext (fingerprint âm thanh)
  const batterySectionEnabled  = settings?.battery?.enabled  === true;  // Section pin
  const mediaSectionEnabled    = settings?.media?.enabled    === true;  // Section thiết bị media (mic, webcam)
  const networkSectionEnabled  = settings?.network?.enabled  === true;  // Section mạng (loại kết nối)

  // Tổng hợp điều kiện cuối: một section chỉ thực sự chạy khi:
  //   1. Không ở safeMode (safeMode chỉ cho phép block 0 chạy)
  //   2. apply.<tên section> không bị tắt (apply.hardware !== false)
  //   3. Section đó được bật trong UI (hwSectionEnabled === true)
  // applyAntiDetection không bị chặn bởi safeMode vì nó là bảo vệ cơ bản nhất.
  const applyHardware = !safeMode && apply.hardware !== false && hwSectionEnabled;
  const applyNavigator = !safeMode && apply.navigator !== false && identitySectionEnabled;
  const applyUA = !safeMode && apply.userAgent !== false && identitySectionEnabled;
  const applyWebgl = !safeMode && apply.webgl !== false && webglSectionEnabled;
  const applyLang = !safeMode && apply.language !== false && identitySectionEnabled;
  const applyViewport = !safeMode && apply.viewport !== false && displaySectionEnabled;
  // Canvas và Audio còn kiểm tra thêm fp.canvas / fp.audio !== false (cờ từ dữ liệu fingerprint)
  const applyCanvas = !safeMode && apply.canvas !== false && fp.canvas !== false && canvasSectionEnabled;
  const applyAudio = !safeMode && apply.audio !== false && fp.audio !== false && audioSectionEnabled;
  const applyBattery = !safeMode && batterySectionEnabled;
  const applyMedia   = !safeMode && mediaSectionEnabled;
  const applyNetwork = !safeMode && networkSectionEnabled;
  // Anti-detection luôn bật trừ khi bị tắt tường minh — đây là lớp bảo vệ quan trọng nhất
  const applyAntiDetection = apply.antiDetection !== false;

  // Generate a stable per-profile seed for consistent noise
  // seed = số hạt giống duy nhất cho mỗi profile, dùng để khởi tạo PRNG (mulberry32).
  // Cùng một profile => cùng seed => cùng chuỗi nhiễu => fingerprint nhất quán qua các lần chạy.
  const profileSeed = hashCode(profile?.id || 'default');

  // Canvas seed: use fingerprint.canvasNoise (set by UI) for unique per-profile noise
  // Nếu người dùng đặt canvasNoise thủ công trong UI, dùng giá trị đó; ngược lại dùng profileSeed.
  const canvasSeed = (fp.canvasNoise && Number(fp.canvasNoise) > 0) ? Number(fp.canvasNoise) : profileSeed;

  // Canvas intensity: 1 = very sparse (1/400 pixels), 10 = denser (1/40 pixels)
  // Độ dày nhiễu canvas: 1 rất thưa (1/400 pixel), 10 dày hơn (1/40 pixel).
  // Giá trị càng cao thì fingerprint càng khác biệt nhưng ảnh có thể bị méo nhẹ.
  const canvasIntensity = Math.max(1, Math.min(10, Number(fp.canvasNoiseIntensity) || 1));

  // Audio seed: use fingerprint.audioNoise (set by UI) for unique per-profile noise
  // Tương tự canvasSeed nhưng dành cho AudioContext fingerprint
  const audioSeed = (fp.audioNoise && Number(fp.audioNoise) > 0) ? Number(fp.audioNoise) : profileSeed;

  // audioSampleRate: tần số lấy mẫu âm thanh (44100 Hz hoặc 48000 Hz thường gặp).
  // 0 = không giả mạo, dùng giá trị thật của máy.
  const audioSampleRate = Number(fp.audioSampleRate) > 0 ? Number(fp.audioSampleRate) : 0;

  // audioChannelCount: số kênh âm thanh (mono=1, stereo=2, surround=6).
  // 0 = không giả mạo. Hàm IIFE phân tích chuỗi người dùng nhập ("mono", "stereo", v.v.)
  const audioChannelCount = (() => {
    const s = String(fp.audioChannels || '').toLowerCase();
    if (/mono|1ch/.test(s)) return 1;
    if (/stereo|2ch/.test(s)) return 2;
    if (/surround|5\.1|6ch/.test(s)) return 6;
    return 0; // 0 = don't spoof
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // 0. ANTI-AUTOMATION DETECTION (must run FIRST, before anything else)
  //    Cloudflare, DataDome, PerimeterX all check these signals.
  //    Can be disabled via network.antiDetection=false or applyOverrides.antiDetection=false
  // ═══════════════════════════════════════════════════════════════════════
  // addInitScript(): tiêm script vào context TRƯỚC KHI trang web nào được tải.
  // Script chạy trong môi trường browser (không có Node.js), nên phải tự đóng gói hoàn toàn.
  // Đây là cách Playwright cho phép ta can thiệp vào browser trước khi website phát hiện automation.
  if (applyAntiDetection) try {
    await context.addInitScript(() => {
      try {
        // ── navigator.webdriver ──
        // Only override if Playwright/CDP actually set it to true.
        // If --disable-blink-features=AutomationControlled already made it false/undefined,
        // we skip the Object.defineProperty entirely — Cloudflare detects tampered descriptors
        // even when the returned value is correct.
        // navigator.webdriver = true là dấu hiệu rõ ràng nhất trình duyệt đang bị điều khiển tự động.
        // Cloudflare, DataDome, PerimeterX đều kiểm tra thuộc tính này đầu tiên.
        // Chỉ override khi giá trị thật là true — nếu đã false thì không cần (tránh để lại dấu vết).
        try {
          const wd = navigator.webdriver;
          if (wd === true) {
            // Xóa thuộc tính webdriver khỏi prototype của navigator trước,
            // vì descriptor trên prototype có thể chặn việc override trực tiếp.
            // Object.getPrototypeOf(navigator) = NavigatorID.prototype (prototype chain)
            const proto = Object.getPrototypeOf(navigator);
            if (proto) {
              try {
                delete proto.webdriver;
                // Object.defineProperty: định nghĩa lại thuộc tính với getter trả về false
                // Dùng getter thay vì gán giá trị trực tiếp để vượt qua kiểm tra của bot detector
                Object.defineProperty(proto, 'webdriver', {
                  get: () => false,
                  configurable: true,
                  enumerable: true,
                });
              } catch {}
            }
            try {
              // Cũng override trực tiếp trên instance navigator (phòng trường hợp proto không hoạt động)
              Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
                configurable: true,
                enumerable: true,
              });
            } catch {}
          }
        } catch {}

        // ── Remove Playwright/CDP artifacts ──
        // Xóa các biến toàn cục do Playwright và ChromeDriver để lại trong window.
        // Các công cụ phát hiện bot thường tìm những biến này để nhận ra automation.
        try { delete window.__playwright; } catch {}
        try { delete window.__pw_manual; } catch {}
        try { delete window.__PW_inspect; } catch {}
        // cdc_* là biến do ChromeDriver (Selenium) inject vào — phải xóa để tránh bị phát hiện
        try { delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array; } catch {}
        try { delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise; } catch {}
        try { delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol; } catch {}
        // Remove any window property starting with 'cdc_' or '__'playwright markers
        // Quét toàn bộ window để xóa mọi biến bắt đầu bằng 'cdc_' hoặc '__playwright'
        // (phòng khi Playwright thêm biến mới mà chưa được liệt kê ở trên)
        try {
          for (const key of Object.keys(window)) {
            if (key.startsWith('cdc_') || key.startsWith('__cdc_') ||
                key.startsWith('__playwright') || key.startsWith('__pw')) {
              try { delete window[key]; } catch {}
            }
          }
        } catch {}
      } catch {}
    });
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════
  // 0b. FIREFOX-SPECIFIC: Remove Marionette/Selenium/GeckoDriver traces
  //     These globals are injected by Geckodriver/Marionette and are checked
  //     by bot detection tools specifically for Firefox automation.
  // ═══════════════════════════════════════════════════════════════════════
  // Section 0b chỉ chạy với Firefox (isFirefox === true).
  // Firefox dùng Marionette/GeckoDriver thay vì ChromeDriver nên để lại dấu vết khác.
  // Các biến _selenium, __webdriver_* là đặc trưng của Selenium trên Firefox.
  if (isFirefox && applyAntiDetection) try {
    await context.addInitScript(() => {
      try {
        // Marionette / GeckoDriver traces
        // Xóa tất cả biến toàn cục do Selenium/GeckoDriver/Marionette inject vào Firefox
        try { delete window._selenium; } catch {}
        try { delete window.__selenium_evaluate; } catch {}
        try { delete window.__selenium_unwrapped; } catch {}
        try { delete window.__selenium_async_script; } catch {}
        try { delete window.__selenium_async_script_timeout; } catch {}
        try { delete window.__webdriver_evaluate; } catch {}
        try { delete window.__webdriver_script_fn; } catch {}
        try { delete window.__webdriver_script_timeout; } catch {}
        try { delete window.__webdriverAsyncExecutor; } catch {}
        try { delete window.__$webdriverAsyncExecutor; } catch {}
        try { delete window.__fxdriver_evaluate; } catch {}
        try { delete window.__fxdriver_unwrapped; } catch {}
        try { delete window.__webdriverFunc; } catch {}
        // Biến của Watir (framework automation Ruby dùng trên Firefox)
        try { delete window.__lastWatirAlert; } catch {}
        try { delete window.__lastWatirConfirm; } catch {}
        try { delete window.__lastWatirPrompt; } catch {}
        // Playwright BiDi markers
        try { delete window.__playwright; } catch {}
        try { delete window.__pw_manual; } catch {}

        // navigator.webdriver — Firefox sets this to true under automation
        // Trên Firefox, trả về undefined thay vì false (khớp với hành vi Firefox thật)
        try {
          const proto = Object.getPrototypeOf(navigator);
          if (proto) {
            try {
              delete proto.webdriver;
              Object.defineProperty(proto, 'webdriver', {
                get: () => undefined, // Firefox thật: undefined (không phải false)
                configurable: true,
                enumerable: false,    // Firefox không liệt kê thuộc tính này trong for...in
              });
            } catch {}
          }
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true,
            enumerable: false,
          });
        } catch {}

        // Hide automation from document.documentElement attributes
        // GeckoDriver đôi khi thêm attribute 'webdriver' vào thẻ <html>.
        // Dùng MutationObserver để liên tục xóa attribute này ngay khi nó xuất hiện.
        try {
          const obs = new MutationObserver(() => {
            try { document.documentElement.removeAttribute('webdriver'); } catch {}
          });
          obs.observe(document.documentElement, { attributes: true });
          try { document.documentElement.removeAttribute('webdriver'); } catch {}
        } catch {}
      } catch {}
    });
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════
  // 0c. FIREFOX navigator properties — vendor, productSub, buildID, plugins
  //     These differ between real Firefox and Chrome. Must match Firefox values.
  // ═══════════════════════════════════════════════════════════════════════
  // Section 0c: giả mạo các thuộc tính navigator đặc trưng của Firefox.
  // Chrome và Firefox có giá trị khác nhau cho vendor, productSub, oscpu, v.v.
  // Nếu ta dùng Chrome-based engine mà để lộ giá trị Chrome, bot detector sẽ biết ngay.
  if (isFirefox && applyAntiDetection) try {
    // ffOscpu: chuỗi OS phù hợp với platform được chọn trong profile
    // (ví dụ Win32 → "Windows NT 10.0; Win64; x64")
    const ffOscpu = (() => {
      const plat = adv.platform || 'Win32';
      if (plat === 'Win32') return 'Windows NT 10.0; Win64; x64';
      if (plat === 'MacIntel') return 'Intel Mac OS X 10.15';
      return 'Linux x86_64';
    })();
    await context.addInitScript(({ oscpu }) => {
      try {
        // navigator.vendor — real Firefox always returns "" (empty string)
        // Chrome trả về "Google Inc.", Firefox thật trả về "" — phải match Firefox
        try {
          Object.defineProperty(navigator, 'vendor', { get: () => '', configurable: true });
        } catch {}

        // navigator.productSub — Firefox: "20100101", Chrome: "20030107"
        // Khác nhau giữa hai trình duyệt, bot detector dùng để phân biệt
        try {
          Object.defineProperty(navigator, 'productSub', { get: () => '20100101', configurable: true });
        } catch {}

        // navigator.buildID — Firefox-specific property (Chrome doesn't have it)
        // Thuộc tính chỉ có trên Firefox, Chrome không có — thêm vào để giả Firefox hoàn chỉnh
        try {
          Object.defineProperty(navigator, 'buildID', { get: () => '20181001000000', configurable: true });
        } catch {}

        // navigator.oscpu — Firefox-specific, shows OS string
        // Ví dụ: "Windows NT 10.0; Win64; x64" — Chrome không có thuộc tính này
        try {
          Object.defineProperty(navigator, 'oscpu', { get: () => oscpu, configurable: true });
        } catch {}

        // navigator.plugins — real Firefox 85+ returns empty PluginArray
        // Firefox 85+ không còn hỗ trợ plugin nên trả về mảng rỗng.
        // Object.create(PluginArray.prototype): tạo object giả nhưng vẫn instanceof PluginArray
        // (prototype chain phải đúng để qua được instanceof check của bot detector)
        try {
          const emptyPluginArray = Object.create(PluginArray.prototype);
          Object.defineProperty(emptyPluginArray, 'length', { get: () => 0, enumerable: true });
          emptyPluginArray.item = () => null;
          emptyPluginArray.namedItem = () => null;
          emptyPluginArray.refresh = () => {};
          emptyPluginArray[Symbol.iterator] = function* () {};
          Object.defineProperty(navigator, 'plugins', { get: () => emptyPluginArray, configurable: true });
        } catch {}

        // navigator.mimeTypes — empty in real Firefox 85+
        // Tương tự plugins — Firefox 85+ trả về mảng rỗng cho mimeTypes
        try {
          const emptyMimeArray = Object.create(MimeTypeArray.prototype);
          Object.defineProperty(emptyMimeArray, 'length', { get: () => 0, enumerable: true });
          emptyMimeArray.item = () => null;
          emptyMimeArray.namedItem = () => null;
          emptyMimeArray[Symbol.iterator] = function* () {};
          Object.defineProperty(navigator, 'mimeTypes', { get: () => emptyMimeArray, configurable: true });
          // pdfViewerEnabled = true: Firefox vẫn xem được PDF dù plugin rỗng (dùng built-in viewer)
          Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => true, configurable: true });
        } catch {}

        // window.InstallTrigger — most important Firefox identity marker
        // Nearly every bot detection script checks: typeof InstallTrigger !== 'undefined'
        // Đây là dấu nhận dạng quan trọng nhất của Firefox.
        // Hầu hết script phát hiện bot đều check: typeof InstallTrigger !== 'undefined'
        try {
          if (typeof window.InstallTrigger === 'undefined') {
            Object.defineProperty(window, 'InstallTrigger', {
              get: () => ({}),  // Trả về object rỗng (không phải undefined)
              configurable: true,
              enumerable: true,
            });
          }
        } catch {}

        // window.sidebar — Firefox sidebar API (absent in Chrome)
        // Chrome không có window.sidebar — thêm vào để giả Firefox đầy đủ hơn
        try {
          if (typeof window.sidebar === 'undefined') {
            Object.defineProperty(window, 'sidebar', {
              get: () => ({ addPanel: () => {}, addPersistentPanel: () => {} }),
              configurable: true,
            });
          }
        } catch {}

        // document.mozFullScreen — Firefox fullscreen API
        // API fullscreen của Firefox dùng prefix "moz" — Chrome không có
        try {
          if (typeof document.mozFullScreen === 'undefined') {
            Object.defineProperty(document, 'mozFullScreen', { get: () => false, configurable: true });
            Object.defineProperty(document, 'mozFullScreenEnabled', { get: () => true, configurable: true });
          }
        } catch {}

        // Remove Chrome-only window properties that leak browser identity
        // window.chrome và window.google chỉ có trên Chrome — xóa đi khi giả Firefox
        try { delete window.chrome; } catch {}
        try { delete window.google; } catch {}
      } catch {}
    }, { oscpu: ffOscpu });
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════
  // 1. HARDWARE: CPU cores & device memory
  // ═══════════════════════════════════════════════════════════════════════
  // NOTE: Only override if the spoofed value differs from the real value.
  // Cloudflare detects descriptor tampering on navigator properties,
  // so we skip the override when the real value already matches.
  //
  // Section 1: giả mạo thông tin phần cứng (số CPU core, dung lượng RAM).
  // navigator.hardwareConcurrency = số luồng CPU (1, 2, 4, 8, 16...).
  // navigator.deviceMemory = RAM theo GB, làm tròn xuống lũy thừa 2 (0.25, 0.5, 1, 2, 4, 8...).
  // Hai thuộc tính này thường được dùng để nhận dạng máy tính cụ thể trong fingerprint.
  // QUAN TRỌNG: chỉ override nếu giá trị thật KHÁC giá trị muốn giả mạo —
  // Cloudflare phát hiện descriptor bị thay đổi dù giá trị trả về đúng.
  if (applyHardware) {
    try {
      await context.addInitScript(({ cores, mem }) => {
        // cores/mem = 0 means "use real value, don't spoof"
        try {
          if (cores > 0) {
            const realCores = navigator.hardwareConcurrency;
            // Chỉ override nếu giá trị thật khác giá trị cần giả — tránh để lộ descriptor bị sửa
            if (realCores !== cores) {
              Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores, configurable: true });
            }
          }
        } catch {}
        try {
          if (mem > 0) {
            const realMem = navigator.deviceMemory;
            // Tương tự: chỉ override khi cần thiết
            if (realMem !== mem) {
              Object.defineProperty(navigator, 'deviceMemory', { get: () => mem, configurable: true });
            }
          }
        } catch {}
      }, { cores: cpuCores, mem: deviceMemory });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. NAVIGATOR: platform, DNT, touchPoints, languages, plugins
  // ═══════════════════════════════════════════════════════════════════════
  // Section 2: giả mạo các thuộc tính nhận dạng trong đối tượng navigator.
  // navigator là đối tượng JavaScript chứa thông tin về trình duyệt và hệ điều hành.
  // applyNavigator (biến từ trên) = true khi section identity được bật và không ở safeMode.
  if (applyNavigator) {
    try {
      await context.addInitScript(({ adv, primaryLang, flags }) => {
        try {
          if (!adv || typeof adv !== 'object') return;

          // Platform: hệ điều hành/kiến trúc máy (ví dụ: "Win32", "MacIntel", "Linux x86_64")
          // Phải khớp với User-Agent và các thuộc tính navigator khác để không bị phát hiện mâu thuẫn.
          // Ghi đè qua prototype để Object.getOwnPropertyDescriptor(navigator,'platform') = undefined
          // (trông giống trình duyệt thật hơn là ghi đè trực tiếp vào navigator)
          if (adv.platform) {
            try {
              const navProto = Object.getPrototypeOf(navigator);
              const platDesc = navProto && Object.getOwnPropertyDescriptor(navProto, 'platform');
              if (platDesc && platDesc.configurable) {
                Object.defineProperty(navProto, 'platform', { get: () => adv.platform, configurable: true, enumerable: platDesc.enumerable });
              } else {
                Object.defineProperty(navigator, 'platform', { get: () => adv.platform, configurable: true });
              }
            } catch {}
          }

          // Do Not Track: cờ "Không theo dõi" của người dùng.
          // '1' = bật DNT, null = tắt DNT (không phải '0' — đây là đặc tả của W3C)
          if (typeof adv.dnt === 'boolean') {
            try { Object.defineProperty(navigator, 'doNotTrack', { get: () => (adv.dnt ? '1' : null), configurable: true }); } catch {}
          }

          // Max Touch Points: số điểm chạm tối đa (0 = không có màn hình cảm ứng, 5 hoặc 10 = có)
          // Bot thường có maxTouchPoints = 0 (không phải thiết bị di động)
          // Nếu muốn giả làm mobile, đặt giá trị này > 0
          if (typeof adv.maxTouchPoints === 'number') {
            try { Object.defineProperty(navigator, 'maxTouchPoints', { get: () => adv.maxTouchPoints, configurable: true }); } catch {}
          }

          // Languages: danh sách ngôn ngữ ưa thích của trình duyệt (ví dụ: ['en-US', 'en', 'vi'])
          // navigator.languages = mảng đầy đủ, navigator.language = phần tử đầu tiên
          // Object.freeze() để mảng không bị sửa đổi từ bên ngoài
          if (flags.applyLang) {
            try {
              // Phân tích languages từ adv: có thể là mảng hoặc chuỗi "en-US,en,vi"
              const langs = Array.isArray(adv.languages) ? adv.languages : (typeof adv.languages === 'string' ? adv.languages.split(',').map(s => s.trim()).filter(Boolean) : []);
              const finalLangs = langs.length ? langs : (primaryLang ? [primaryLang] : []);
              if (finalLangs && finalLangs.length) {
                const frozen = Object.freeze([...finalLangs]); // Đóng băng mảng để bảo toàn giá trị
                Object.defineProperty(navigator, 'languages', { get: () => frozen, configurable: true });
                Object.defineProperty(navigator, 'language', { get: () => frozen[0], configurable: true });
              }
            } catch {}
          }

          // ── Realistic Plugins (Chrome only — Firefox 85+ has empty plugins, handled separately) ──
          // Tạo danh sách plugin giả cho Chrome (chỉ PDF viewer — Chrome thật cũng chỉ có thế này).
          // Firefox 85+ xử lý riêng ở section 0c bên trên.
          // prototype chain phải đúng: Object.create(Plugin.prototype) để instanceof Plugin = true
          if (!flags.isFirefox && typeof adv.plugins === 'number' && adv.plugins >= 0) {
            try {
              // Danh sách plugin PDF thật sự tồn tại trong Chrome hiện đại
              const pluginDefs = [
                { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              ];
              // Chỉ lấy số plugin theo cài đặt của profile (tối đa bằng số plugin thật Chrome có)
              const count = Math.min(adv.plugins, pluginDefs.length);
              const selectedPlugins = pluginDefs.slice(0, count);
              const mimeType = 'application/pdf';
              const mimeDesc = 'Portable Document Format';
              const mimeExt = 'pdf';

              const mimeTypes = [];
              const plugins = [];

              for (const def of selectedPlugins) {
                // Build MimeType: tạo object MimeType giả với đúng prototype
                // Object.create(MimeType.prototype): giả object vẫn pass instanceof MimeType
                const mt = Object.create(MimeType.prototype);
                Object.defineProperties(mt, {
                  type: { get: () => mimeType, enumerable: true },       // "application/pdf"
                  suffixes: { get: () => mimeExt, enumerable: true },    // "pdf"
                  description: { get: () => mimeDesc, enumerable: true },
                });

                // Build Plugin: tạo object Plugin giả với đúng prototype
                const plugin = Object.create(Plugin.prototype);
                Object.defineProperties(plugin, {
                  name: { get: () => def.name, enumerable: true },
                  filename: { get: () => def.filename, enumerable: true },
                  description: { get: () => def.description, enumerable: true },
                  length: { get: () => 1, enumerable: true },   // Mỗi plugin có 1 mime type
                  0: { get: () => mt, enumerable: true },        // plugin[0] = MimeType của nó
                });

                // Cross-link: liên kết 2 chiều giữa MimeType và Plugin (như browser thật làm)
                // mt.enabledPlugin → plugin, plugin[Symbol.iterator] → mt
                Object.defineProperty(mt, 'enabledPlugin', { get: () => plugin, enumerable: true });
                plugin[Symbol.iterator] = function* () { yield mt; };

                mimeTypes.push(mt);
                plugins.push(plugin);
              }

              // PluginArray: mảng chứa các plugin — phải dùng Object.create(PluginArray.prototype)
              // để instanceof PluginArray = true, tránh bị phát hiện bởi kiểm tra kiểu dữ liệu
              const fakePluginArray = Object.create(PluginArray.prototype);
              Object.defineProperty(fakePluginArray, 'length', { get: () => plugins.length, enumerable: true });
              plugins.forEach((p, i) => {
                // Đăng ký mỗi plugin theo chỉ số số (plugins[0], plugins[1]...)
                Object.defineProperty(fakePluginArray, i, { get: () => p, enumerable: true });
              });
              fakePluginArray.item = (idx) => plugins[idx] || null;
              fakePluginArray.namedItem = (name) => plugins.find(p => p.name === name) || null;
              fakePluginArray.refresh = () => {};
              fakePluginArray[Symbol.iterator] = function* () { for (const p of plugins) yield p; };

              // MimeTypeArray: mảng chứa các mime type — tương tự PluginArray
              const fakeMimeArray = Object.create(MimeTypeArray.prototype);
              Object.defineProperty(fakeMimeArray, 'length', { get: () => mimeTypes.length, enumerable: true });
              mimeTypes.forEach((m, i) => {
                Object.defineProperty(fakeMimeArray, i, { get: () => m, enumerable: true });
              });
              fakeMimeArray.item = (idx) => mimeTypes[idx] || null;
              fakeMimeArray.namedItem = (type) => mimeTypes.find(m => m.type === type) || null;
              fakeMimeArray[Symbol.iterator] = function* () { for (const m of mimeTypes) yield m; };

              // Gán plugins và mimeTypes giả vào navigator
              Object.defineProperty(navigator, 'plugins', { get: () => fakePluginArray, configurable: true });
              Object.defineProperty(navigator, 'mimeTypes', { get: () => fakeMimeArray, configurable: true });
              // pdfViewerEnabled: true nếu có ít nhất 1 plugin (= Chrome có thể xem PDF)
              Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => count > 0, configurable: true });
            } catch {}
          }
        } catch {}
      }, { adv, primaryLang: locale, flags: { applyLang: !!applyLang, isFirefox: !!isFirefox } });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. USER-AGENT + appVersion consistency
  // ═══════════════════════════════════════════════════════════════════════
  // Section 3: ghi đè User-Agent trong JavaScript.
  // User-Agent (UA) là chuỗi định danh trình duyệt gửi lên server (ví dụ:
  // "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...").
  // applyUA = biến từ Node.js, userAgent = chuỗi UA người dùng cấu hình.
  // QUAN TRỌNG: UA trong JS (navigator.userAgent) phải khớp với UA trong HTTP header
  // (được set bởi Playwright/browser), nếu không sẽ bị phát hiện mâu thuẫn.
  if (applyUA && userAgent) {
    try {
      await context.addInitScript(({ ua }) => {
        try {
          // Ghi đè navigator.userAgent qua PROTOTYPE thay vì trực tiếp trên navigator.
          // Lý do: nếu dùng Object.defineProperty(navigator, 'userAgent', ...) trực tiếp,
          // Cloudflare phát hiện bằng Object.getOwnPropertyDescriptor(navigator, 'userAgent')
          // — giá trị trả về sẽ là custom descriptor thay vì undefined (trình duyệt thật).
          // Ghi đè trên prototype: Object.getOwnPropertyDescriptor(navigator, 'userAgent')
          // trả về undefined (không có own-property) → trông giống trình duyệt thật hơn.
          const proto = Object.getPrototypeOf(navigator);
          const uaDesc = proto && Object.getOwnPropertyDescriptor(proto, 'userAgent');
          if (uaDesc && uaDesc.configurable) {
            Object.defineProperty(proto, 'userAgent', {
              get: () => ua,
              configurable: true,
              enumerable: uaDesc.enumerable,
            });
          } else {
            // Fallback: ghi đè trực tiếp nếu prototype không configurable
            Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true });
          }
          // navigator.appVersion = phần sau "Mozilla/" trong UA (đặc tả cũ nhưng vẫn được kiểm tra)
          const appVer = ua.indexOf('Mozilla/') === 0 ? ua.substring(8) : ua;
          Object.defineProperty(navigator, 'appVersion', { get: () => appVer, configurable: true });
        } catch {}
      }, { ua: userAgent });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. VIEWPORT & SCREEN properties
  // ═══════════════════════════════════════════════════════════════════════
  // Section 4: giả mạo kích thước màn hình và viewport.
  // Nhiều script fingerprint đọc screen.width/height, window.outerWidth/outerHeight,
  // và devicePixelRatio để xác định loại thiết bị và màn hình.
  // Tất cả các giá trị này phải nhất quán với nhau (không mâu thuẫn).
  if (applyViewport) {
    try {
      // parseResolution: chuyển chuỗi "1920x1080" → { width: 1920, height: 1080 }
      const resolution = parseResolution(fp.screenResolution);
      await context.addInitScript(({ dpr, res }) => {
        try {
          // devicePixelRatio: tỉ lệ pixel vật lý / pixel CSS (1.0 = màn hình thường, 2.0 = Retina)
          // Màn hình 4K thường có dpr = 2 hoặc 3
          if (typeof dpr === 'number' && dpr > 0) {
            Object.defineProperty(window, 'devicePixelRatio', { get: () => dpr, configurable: true });
          }
          if (res) {
            const w = res.width, h = res.height;
            const taskbar = 40; // Giả sử thanh taskbar cao 40px (Windows mặc định)
            // screen.width/height: kích thước màn hình vật lý toàn bộ (bao gồm taskbar)
            try { Object.defineProperty(screen, 'width', { get: () => w, configurable: true }); } catch {}
            try { Object.defineProperty(screen, 'height', { get: () => h, configurable: true }); } catch {}
            // screen.availWidth/availHeight: phần màn hình khả dụng (trừ taskbar)
            try { Object.defineProperty(screen, 'availWidth', { get: () => w, configurable: true }); } catch {}
            try { Object.defineProperty(screen, 'availHeight', { get: () => h - taskbar, configurable: true }); } catch {}
            // colorDepth/pixelDepth: độ sâu màu (24-bit = True Color tiêu chuẩn hiện đại)
            try { Object.defineProperty(screen, 'colorDepth', { get: () => 24, configurable: true }); } catch {}
            try { Object.defineProperty(screen, 'pixelDepth', { get: () => 24, configurable: true }); } catch {}
            // outerWidth/outerHeight: kích thước cửa sổ browser (bao gồm thanh tab, địa chỉ...)
            try { Object.defineProperty(window, 'outerWidth', { get: () => w, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'outerHeight', { get: () => h, configurable: true }); } catch {}
            // screenX / screenY — top-left of browser window on the monitor
            // Tọa độ góc trên-trái của cửa sổ browser trên màn hình (0,0 = góc trên-trái màn hình)
            try { Object.defineProperty(window, 'screenX', { get: () => 0, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'screenY', { get: () => 0, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'screenLeft', { get: () => 0, configurable: true }); } catch {}
            try { Object.defineProperty(window, 'screenTop', { get: () => 0, configurable: true }); } catch {}
          }
        } catch {}
      }, { dpr: Number(adv.devicePixelRatio || 1), res: resolution });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. WEBGL vendor & renderer spoofing
  // ═══════════════════════════════════════════════════════════════════════
  // Section 5: giả mạo thông tin card đồ họa qua WebGL API.
  // WebGL cho phép JS đọc thông tin GPU: tên nhà sản xuất (vendor) và tên card (renderer).
  // Đây là một trong những fingerprint mạnh nhất vì GPU là duy nhất cho từng máy.
  // Ví dụ: vendor="NVIDIA Corporation", renderer="NVIDIA GeForce RTX 3080/PCIe/SSE2"
  // webglMaxTexture: kích thước texture tối đa (thường là 16384 hoặc 32768)
  const webglMaxTexture = Number(fp.maxTextureSize) || 0;
  // webglExtensions: danh sách extension WebGL được hỗ trợ (phân tách bởi dấu phẩy trong UI)
  // Các extension khác nhau giữa GPU/driver → là fingerprint bổ sung
  const webglExtensions = (typeof fp.webglExtensions === 'string' && fp.webglExtensions.trim())
    ? fp.webglExtensions.split(',').map(e => e.trim()).filter(Boolean)
    : null;
  if (applyWebgl && (adv.webglVendor || adv.webglRenderer || webglMaxTexture || webglExtensions)) {
    try {
      await context.addInitScript(({ vendor, renderer, maxTextureSize, extensions }) => {
        try {
          // patch(): hàm nội bộ patch prototype của WebGLRenderingContext
          // prototype là đối tượng cha chung — patch 1 lần áp dụng cho mọi WebGL context
          const patch = (proto) => {
            if (!proto) return;
            if (proto.getParameter) {
              const origGetParam = proto.getParameter;
              // Ghi đè getParameter để chặn các tham số định danh GPU
              // Các hằng số hex là mã tham số WebGL theo chuẩn OpenGL/WebGL spec:
              Object.defineProperty(proto, 'getParameter', {
                value: function (param) {
                  if (param === 0x9245 && vendor) return vendor;      // UNMASKED_VENDOR_WEBGL (extension WEBGL_debug_renderer_info)
                  if (param === 0x9246 && renderer) return renderer;  // UNMASKED_RENDERER_WEBGL (extension WEBGL_debug_renderer_info)
                  if (param === 0x1F01 && renderer) return renderer;  // RENDERER (tên GPU cơ bản)
                  if (param === 0x1F00 && vendor) return vendor;      // VENDOR (tên nhà sản xuất cơ bản)
                  if (param === 0x0D33 && maxTextureSize) return maxTextureSize; // MAX_TEXTURE_SIZE (kích thước texture tối đa)
                  return origGetParam.apply(this, arguments); // Tham số khác: trả về giá trị thật
                },
                configurable: true,
              });
            }
            if (extensions && proto.getSupportedExtensions) {
              const origGetExts = proto.getSupportedExtensions;
              // getSupportedExtensions(): trả về danh sách extension giả từ profile
              // extensions.slice() tạo bản sao để tránh mutation
              Object.defineProperty(proto, 'getSupportedExtensions', {
                value: function () { return extensions.slice(); },
                configurable: true,
              });
            }
            if (extensions && proto.getExtension) {
              const origGetExt = proto.getExtension;
              // getExtension(name): chỉ trả về extension nếu nằm trong danh sách giả
              // Trả về null nếu extension không có trong danh sách → website không dùng được
              Object.defineProperty(proto, 'getExtension', {
                value: function (name) {
                  if (!extensions.includes(name)) return null;
                  return origGetExt.apply(this, arguments);
                },
                configurable: true,
              });
            }
          };

          // Patch cả WebGL 1 và WebGL 2 (browser hiện đại hỗ trợ cả hai)
          if (window.WebGLRenderingContext) patch(WebGLRenderingContext.prototype);
          if (window.WebGL2RenderingContext) patch(WebGL2RenderingContext.prototype);
        } catch {}
      }, { vendor: adv.webglVendor, renderer: adv.webglRenderer, maxTextureSize: webglMaxTexture || null, extensions: webglExtensions });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. CANVAS fingerprint noise
  //    Uses a flag to prevent recursion (toDataURL → getImageData → noise)
  // ═══════════════════════════════════════════════════════════════════════
  // Section 6: thêm nhiễu ngẫu nhiên nhỏ vào pixel của Canvas để thay đổi fingerprint.
  // Canvas fingerprinting hoạt động bằng cách vẽ text/hình lên canvas rồi đọc pixel —
  // mỗi máy/GPU/driver vẽ ra ảnh pixel khác nhau nhỏ → tạo fingerprint duy nhất.
  // Giải pháp: thêm noise ±1 vào một số pixel → mỗi profile có ảnh khác nhau,
  // nhưng noise quá nhỏ để người dùng nhìn thấy sự khác biệt bằng mắt thường.
  if (applyCanvas) {
    try {
      await context.addInitScript(({ seed, intensity }) => {
        try {
          // Seeded PRNG — deterministic per profile
          // mulberry32: thuật toán sinh số ngẫu nhiên giả (PRNG) rất nhanh, chất lượng tốt.
          // Nhận seed (số nguyên) → trả về hàm không tham số, mỗi lần gọi trả về số trong [0, 1).
          // Cùng seed → cùng chuỗi số → cùng nhiễu → fingerprint nhất quán cho 1 profile.
          function mulberry32(a) {
            return function () {
              a |= 0; a = a + 0x6D2B79F5 | 0;       // Cộng hằng số ma thuật (tăng entropy)
              let t = Math.imul(a ^ a >>> 15, 1 | a); // XOR và nhân (trộn bit)
              t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; // Thêm 1 bước trộn nữa
              return ((t ^ t >>> 14) >>> 0) / 4294967296; // Chuẩn hóa về [0, 1)
            };
          }
          const rng = mulberry32(seed); // Khởi tạo PRNG với seed của profile này

          // ── Noise function: intensity 1=sparse(1/400px), 10=denser(1/40px) ──
          // perturbImageData: hàm thêm nhiễu vào mảng pixel của imageData.
          // imageData.data là Uint8ClampedArray [R,G,B,A, R,G,B,A, ...] — 4 byte mỗi pixel.
          // step: bước nhảy giữa các pixel được nhiễu (intensity cao → step nhỏ → nhiều pixel bị nhiễu hơn).
          function perturbImageData(imageData) {
            const data = imageData.data;
            const len = data.length;
            // divisor điều chỉnh theo intensity: intensity=1 → divisor=400 (rất thưa), intensity=10 → divisor=40 (dày hơn)
            const divisor = Math.max(40, 400 - (intensity - 1) * 40);
            const step = Math.max(4, Math.floor(len / divisor) * 4); // Nhân 4 vì 4 byte/pixel
            for (let i = 0; i < len; i += step) {
              for (let c = 0; c < 3; c++) { // Chỉ nhiễu R, G, B — bỏ qua Alpha (c=3)
                const noise = rng() < 0.5 ? -1 : 1; // Ngẫu nhiên +1 hoặc -1
                const val = data[i + c] + noise;
                // Kẹp giá trị trong [0, 255] — Uint8ClampedArray tự kẹp nhưng cần explicit
                data[i + c] = val < 0 ? 0 : val > 255 ? 255 : val;
              }
            }
            return imageData;
          }

          // Use a flag to prevent recursion when toDataURL calls getImageData internally
          // _isPerturbing: cờ ngăn đệ quy vô tận.
          // Khi ta patch getImageData, nếu toDataURL bên trong cũng gọi getImageData → lại kích hoạt patch → vòng lặp.
          // Giải pháp: set cờ = true trước khi nhiễu, bỏ qua nếu cờ đang bật.
          let _isPerturbing = false;

          // Patch getImageData (the core extraction API)
          // getImageData(): API cốt lõi để đọc pixel từ canvas — fingerprint tool dùng hàm này.
          // Lưu hàm gốc, gọi nó, rồi thêm nhiễu vào kết quả trước khi trả về.
          const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
          Object.defineProperty(CanvasRenderingContext2D.prototype, 'getImageData', {
            value: function () {
              const imageData = origGetImageData.apply(this, arguments); // Gọi hàm gốc trước
              if (!_isPerturbing) { // Chỉ nhiễu nếu không đang trong vòng nhiễu khác
                _isPerturbing = true;
                try { perturbImageData(imageData); } finally { _isPerturbing = false; }
              }
              return imageData;
            },
            configurable: true,
          });

          // Patch toDataURL — perturb pixels, then call original
          // toDataURL(): xuất canvas thành chuỗi base64 (ví dụ: "data:image/png;base64,...")
          // Fingerprint tool thường dùng canvas.toDataURL() để lấy fingerprint.
          // Chiến lược: đọc pixel, thêm nhiễu, ghi lại vào canvas, rồi mới xuất ảnh.
          const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
          Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
            value: function () {
              if (!_isPerturbing) {
                _isPerturbing = true;
                try {
                  const ctx = this.getContext('2d');
                  if (ctx) {
                    // Đọc toàn bộ pixel canvas (gọi origGetImageData để không trigger patch lại)
                    const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                    perturbImageData(imgData); // Thêm nhiễu vào pixel
                    ctx.putImageData(imgData, 0, 0); // Ghi pixel đã nhiễu trở lại canvas
                  }
                } catch {} finally { _isPerturbing = false; }
              }
              return origToDataURL.apply(this, arguments); // Xuất canvas đã được nhiễu
            },
            configurable: true,
          });

          // Patch toBlob
          // toBlob(): tương tự toDataURL nhưng trả về Blob thay vì chuỗi base64
          // Cùng chiến lược: nhiễu pixel trước, rồi mới xuất blob
          const origToBlob = HTMLCanvasElement.prototype.toBlob;
          Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            value: function () {
              if (!_isPerturbing) {
                _isPerturbing = true;
                try {
                  const ctx = this.getContext('2d');
                  if (ctx) {
                    const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                    perturbImageData(imgData);
                    ctx.putImageData(imgData, 0, 0);
                  }
                } catch {} finally { _isPerturbing = false; }
              }
              return origToBlob.apply(this, arguments);
            },
            configurable: true,
          });

          // Patch OffscreenCanvas.convertToBlob
          // OffscreenCanvas: canvas chạy ngoài main thread (trong Worker) — cũng cần patch
          // convertToBlob() là phiên bản của toBlob() dành cho OffscreenCanvas
          if (typeof OffscreenCanvas !== 'undefined' && OffscreenCanvas.prototype.convertToBlob) {
            const origConvert = OffscreenCanvas.prototype.convertToBlob;
            Object.defineProperty(OffscreenCanvas.prototype, 'convertToBlob', {
              value: function () {
                if (!_isPerturbing) {
                  _isPerturbing = true;
                  try {
                    const ctx = this.getContext('2d');
                    if (ctx && ctx.getImageData) {
                      const imgData = ctx.getImageData(0, 0, this.width, this.height);
                      perturbImageData(imgData);
                      ctx.putImageData(imgData, 0, 0);
                    }
                  } catch {} finally { _isPerturbing = false; }
                }
                return origConvert.apply(this, arguments);
              },
              configurable: true,
            });
          }
        } catch {}
      }, { seed: canvasSeed, intensity: canvasIntensity });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. AUDIOCONTEXT fingerprint noise
  //    Seeded noise on AnalyserNode frequency/time data — per-profile stable hash.
  //    NOTE: Only runs when safeMode=false. Prototype patching detected by
  //    Cloudflare Enterprise; safe for non-CF sites (YouTube, Facebook, Amazon).
  // ═══════════════════════════════════════════════════════════════════════
  // Section 7: thêm nhiễu vào AudioContext fingerprint.
  // AudioContext fingerprinting hoạt động bằng cách tạo âm thanh (oscillator) qua OfflineAudioContext,
  // rồi đọc dữ liệu tần số/thời gian từ AnalyserNode — mỗi máy cho kết quả float khác nhau nhỏ.
  // Giải pháp: thêm nhiễu ±0.0001 vào Float32 (không nghe được) và ±1 vào Uint8 (rất nhỏ).
  // Ngoài ra giả mạo sampleRate và channelCount của AudioContext để thêm đa dạng.
  if (applyAudio) {
    try {
      await context.addInitScript(({ seed, sampleRate, channelCount }) => {
        try {
          // mulberry32: PRNG giống section 6, khởi tạo với seed khác (seed ^ 9001) để tạo chuỗi số độc lập
          function mulberry32(a) {
            return function () {
              a |= 0; a = a + 0x6D2B79F5 | 0;
              let t = Math.imul(a ^ a >>> 15, 1 | a);
              t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
              return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
          }

          // Perturb Float32Array output — noise cực nhỏ, không nghe được
          // perturbFloat32: thêm nhiễu ±0.00005 vào mảng Float32 (dữ liệu tần số/thời gian).
          // 0.0001 là giới hạn ngưỡng nghe của người (thực ra còn nhỏ hơn nhiều) — không ảnh hưởng âm thanh.
          // Bỏ qua phần tử = 0 (không có tín hiệu tại điểm đó — nhiễu vào 0 vẫn là 0 về mặt thực tế).
          function perturbFloat32(array, rng) {
            for (let i = 0; i < array.length; i++) {
              if (array[i] !== 0) array[i] += (rng() - 0.5) * 0.0001; // ±0.00005 tối đa
            }
          }

          // Perturb Uint8Array output — ±1 trên một số phần tử thưa
          // perturbUint8: thêm nhiễu ±1 vào Uint8Array (dữ liệu tần số dạng byte [0-255]).
          // Bước nhảy 4 để nhiễu thưa hơn — ít ảnh hưởng đến chất lượng âm thanh thực.
          function perturbUint8(array, rng) {
            for (let i = 0; i < array.length; i += 4) {
              const delta = rng() < 0.5 ? -1 : 1;
              const v = array[i] + delta;
              array[i] = v < 0 ? 0 : v > 255 ? 255 : v;
            }
          }

          if (typeof AnalyserNode !== 'undefined') {
            // seed ^ 9001: XOR seed với số cố định để tạo chuỗi số KHÁC với canvas (tránh cùng pattern)
            const rng = mulberry32(seed ^ 9001);

            // Patch 4 phương thức của AnalyserNode — đây là các hàm fingerprint dùng để đọc dữ liệu âm thanh:
            // getFloatFrequencyData: đọc dữ liệu tần số dạng Float32 (dB) — fingerprint tool hay dùng
            const origGFFD = AnalyserNode.prototype.getFloatFrequencyData;
            Object.defineProperty(AnalyserNode.prototype, 'getFloatFrequencyData', {
              value: function (array) { origGFFD.apply(this, arguments); perturbFloat32(array, rng); },
              configurable: true,
            });

            // getByteFrequencyData: đọc dữ liệu tần số dạng Uint8 [0-255]
            const origGBFD = AnalyserNode.prototype.getByteFrequencyData;
            Object.defineProperty(AnalyserNode.prototype, 'getByteFrequencyData', {
              value: function (array) { origGBFD.apply(this, arguments); perturbUint8(array, rng); },
              configurable: true,
            });

            // getFloatTimeDomainData: đọc dữ liệu miền thời gian dạng Float32 (waveform)
            const origGFTD = AnalyserNode.prototype.getFloatTimeDomainData;
            Object.defineProperty(AnalyserNode.prototype, 'getFloatTimeDomainData', {
              value: function (array) { origGFTD.apply(this, arguments); perturbFloat32(array, rng); },
              configurable: true,
            });

            // getByteTimeDomainData: đọc dữ liệu miền thời gian dạng Uint8
            const origGBTD = AnalyserNode.prototype.getByteTimeDomainData;
            Object.defineProperty(AnalyserNode.prototype, 'getByteTimeDomainData', {
              value: function (array) { origGBTD.apply(this, arguments); perturbUint8(array, rng); },
              configurable: true,
            });
          }

          if (typeof AudioContext !== 'undefined') {
            // rng2: chuỗi số ngẫu nhiên thứ 2 (seed ^ 9002) dùng để chọn sampleRate ngẫu nhiên
            const rng2 = mulberry32(seed ^ 9002);
            // spoofRate: nếu user đặt sampleRate thủ công thì dùng; ngược lại random 48000 hoặc 44100
            // (hai giá trị phổ biến nhất của soundcard thật)
            const spoofRate = sampleRate > 0 ? sampleRate : (rng2() > 0.5 ? 48000 : 44100);
            const OrigAC = window.AudioContext;
            const OrigOAC = window.OfflineAudioContext;

            // PatchedAudioContext: hàm thay thế constructor AudioContext
            // Khi website gọi new AudioContext(), họ thực ra gọi PatchedAudioContext()
            // Bên trong vẫn tạo AudioContext thật (new OrigAC()), chỉ thay đổi sampleRate
            function PatchedAudioContext(opts) {
              const inst = opts ? new OrigAC(opts) : new OrigAC();
              // Ghi đè sampleRate trên instance cụ thể (không ảnh hưởng toàn bộ prototype)
              Object.defineProperty(inst, 'sampleRate', { get: () => spoofRate, configurable: true });
              if (channelCount > 0 && inst.destination) {
                // Ghi đè số kênh âm thanh của destination node (loa output)
                try { Object.defineProperty(inst.destination, 'maxChannelCount', { get: () => channelCount, configurable: true }); } catch {}
                try { Object.defineProperty(inst.destination, 'channelCount', { get: () => channelCount, configurable: true }); } catch {}
              }
              return inst;
            }
            // Giữ nguyên prototype chain để instanceof AudioContext vẫn đúng
            PatchedAudioContext.prototype = OrigAC.prototype;
            try { Object.defineProperty(window, 'AudioContext', { value: PatchedAudioContext, configurable: true, writable: true }); } catch {}

            if (OrigOAC) {
              // PatchedOfflineAudioContext: tương tự nhưng cho OfflineAudioContext
              // OfflineAudioContext dùng để render audio không realtime — hay được dùng để fingerprint
              // vì cho kết quả deterministic (không phụ thuộc vào soundcard)
              function PatchedOfflineAudioContext(ch, len, sr) {
                const inst = new OrigOAC(ch, len, sr);
                // Dùng sampleRate do caller cung cấp (sr), fallback về spoofRate
                Object.defineProperty(inst, 'sampleRate', { get: () => sr || spoofRate, configurable: true });
                return inst;
              }
              PatchedOfflineAudioContext.prototype = OrigOAC.prototype;
              try { Object.defineProperty(window, 'OfflineAudioContext', { value: PatchedOfflineAudioContext, configurable: true, writable: true }); } catch {}
            }
          }
        } catch {}
      }, { seed: audioSeed, sampleRate: audioSampleRate, channelCount: audioChannelCount });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 8. CLIENTRECTS noise (element dimension fingerprinting)
  // ═══════════════════════════════════════════════════════════════════════
  // Section 8: thêm nhiễu vào kích thước phần tử DOM (ClientRects fingerprint).
  // ClientRects fingerprinting: đọc tọa độ và kích thước của phần tử HTML (getBoundingClientRect).
  // Mỗi font/OS/GPU render text hơi khác nhau → kích thước phần tử chứa text sẽ khác nhau nhỏ.
  // Giải pháp: cộng nhiễu ±0.000005 pixel vào x, y, width, height — mắt thường không thấy,
  // nhưng đủ để tạo fingerprint duy nhất cho mỗi profile. Layout không bị ảnh hưởng.
  if (applyNavigator) {
    try {
      await context.addInitScript(({ seed }) => {
        try {
          // mulberry32: cùng PRNG, seed + 1337 để tạo chuỗi số KHÁC biệt với canvas/audio
          function mulberry32(a) {
            return function () {
              a |= 0; a = a + 0x6D2B79F5 | 0;
              let t = Math.imul(a ^ a >>> 15, 1 | a);
              t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
              return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
          }
          const rng = mulberry32(seed + 1337); // Offset 1337 để tạo dòng số khác section khác

          // patchDOMRect: thêm nhiễu cực nhỏ vào đối tượng DOMRect và trả về DOMRect mới.
          // DOMRect chứa { x, y, width, height, top, left, right, bottom }.
          // Noise = ±0.000005 pixel — đủ để fingerprint khác nhau, không đủ để layout bị vỡ.
          function patchDOMRect(rect) {
            if (!rect || typeof rect.x !== 'number') return rect;
            // Very small noise that won't break layouts
            const nx = rect.x + (rng() - 0.5) * 0.00001;
            const ny = rect.y + (rng() - 0.5) * 0.00001;
            const nw = rect.width + (rng() - 0.5) * 0.00001;
            const nh = rect.height + (rng() - 0.5) * 0.00001;
            return new DOMRect(nx, ny, nw, nh); // Trả về DOMRect mới với giá trị đã nhiễu
          }

          // getBoundingClientRect(): API phổ biến nhất để đọc vị trí và kích thước phần tử.
          // Gọi hàm gốc, rồi wrap kết quả bằng patchDOMRect trước khi trả về.
          const origGBCR = Element.prototype.getBoundingClientRect;
          Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            value: function () { return patchDOMRect(origGBCR.call(this)); },
            configurable: true,
          });

          // getClientRects(): trả về danh sách DOMRect cho các dòng text trong phần tử.
          // Multi-line text → nhiều rect, mỗi rect đại diện cho 1 dòng.
          const origGCR = Element.prototype.getClientRects;
          Object.defineProperty(Element.prototype, 'getClientRects', {
            value: function () {
              const rects = origGCR.call(this);
              const result = [];
              for (let i = 0; i < rects.length; i++) result.push(patchDOMRect(rects[i]));
              result.item = (idx) => result[idx] || null;
              Object.defineProperty(result, 'length', { value: result.length });
              return result;
            },
            configurable: true,
          });

          // Range.getClientRects / getBoundingClientRect
          // Range: đối tượng đại diện cho đoạn text được chọn (selection).
          // Cũng cần patch vì fingerprint tool có thể dùng Range để đo kích thước text.
          if (typeof Range !== 'undefined') {
            const origRGBCR = Range.prototype.getBoundingClientRect;
            Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
              value: function () { return patchDOMRect(origRGBCR.call(this)); },
              configurable: true,
            });
            const origRGCR = Range.prototype.getClientRects;
            Object.defineProperty(Range.prototype, 'getClientRects', {
              value: function () {
                const rects = origRGCR.call(this);
                const result = [];
                for (let i = 0; i < rects.length; i++) result.push(patchDOMRect(rects[i]));
                result.item = (idx) => result[idx] || null;
                Object.defineProperty(result, 'length', { value: result.length });
                return result;
              },
              configurable: true,
            });
          }
        } catch {}
      }, { seed: profileSeed });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 9. WEBRTC IP leak protection (JS-level)
  // ═══════════════════════════════════════════════════════════════════════
  // Section 9: bảo vệ rò rỉ IP thật qua WebRTC.
  // WebRTC (Web Real-Time Communication) dùng ICE protocol để kết nối P2P (peer-to-peer).
  // Vấn đề: ICE có thể lộ IP thật của máy dù đang dùng proxy/VPN — vì nó dùng UDP bypass proxy.
  // Có 2 chế độ:
  //   - disable_udp: xóa hoàn toàn RTCPeerConnection → WebRTC không hoạt động (an toàn nhất)
  //   - proxy_only: chỉ cho phép kết nối qua TURN relay server (bắt buộc qua proxy)
  const webrtcMode = settings?.webrtc || 'default';
  if (webrtcMode === 'disable_udp' || webrtcMode === 'proxy_only') {
    try {
      await context.addInitScript(({ mode }) => {
        try {
          if (mode === 'disable_udp') {
            // Completely remove WebRTC APIs
            // Thay RTCPeerConnection bằng hàm ném lỗi → website không thể dùng WebRTC
            const noop = function () { throw new DOMException('WebRTC is disabled', 'NotSupportedError'); };
            Object.defineProperty(window, 'RTCPeerConnection', { value: noop, configurable: true, writable: true });
            // webkit prefix: Safari/Chrome cũ dùng tiền tố này
            Object.defineProperty(window, 'webkitRTCPeerConnection', { value: noop, configurable: true, writable: true });
            // moz prefix: Firefox cũ dùng tiền tố này
            Object.defineProperty(window, 'mozRTCPeerConnection', { value: noop, configurable: true, writable: true });
          } else if (mode === 'proxy_only') {
            const OrigRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
            if (OrigRTC) {
              // WrappedRTC: bọc RTCPeerConnection để ép buộc dùng TURN relay (qua proxy)
              const WrappedRTC = function (config, constraints) {
                config = Object.assign({}, config || {});
                // iceTransportPolicy = 'relay': bắt buộc tất cả traffic qua TURN server (không dùng UDP trực tiếp)
                config.iceTransportPolicy = 'relay';
                if (config.iceServers) {
                  // Lọc chỉ giữ lại TURN server (bắt đầu bằng 'turn') — bỏ STUN server (lộ IP trực tiếp)
                  config.iceServers = config.iceServers.filter(function (s) {
                    const urls = Array.isArray(s.urls) ? s.urls : [s.urls || s.url || ''];
                    return urls.some(function (u) { return typeof u === 'string' && u.startsWith('turn'); });
                  });
                }
                return new OrigRTC(config, constraints); // Tạo RTCPeerConnection thật với config đã lọc
              };
              WrappedRTC.prototype = OrigRTC.prototype; // Giữ prototype chain đúng
              if (OrigRTC.generateCertificate) WrappedRTC.generateCertificate = OrigRTC.generateCertificate;
              Object.defineProperty(window, 'RTCPeerConnection', { value: WrappedRTC, configurable: true, writable: true });
              Object.defineProperty(window, 'webkitRTCPeerConnection', { value: WrappedRTC, configurable: true, writable: true });
            }
          }
        } catch {}
      }, { mode: webrtcMode });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 10. BATTERY API — gated by battery section toggle, uses profile values
  // ═══════════════════════════════════════════════════════════════════════
  // Section 10: giả mạo Battery Status API (navigator.getBattery()).
  // API này cho phép website đọc trạng thái pin của thiết bị (% pin, đang sạc hay không...).
  // Vấn đề: thông tin pin khác nhau theo thiết bị → dùng để fingerprint.
  // Máy để bàn không có pin → trả về pin giả giúp giả làm laptop/mobile.
  if (applyBattery) {
    // batteryCharging: đọc từ profile, chấp nhận nhiều dạng giá trị ('Yes', true, 'true')
    const batteryCharging = fp.batteryCharging === 'Yes' || fp.batteryCharging === true || fp.batteryCharging === 'true';
    // batteryLevel: mức pin từ 0.0 (hết) đến 1.0 (đầy), mặc định 0.8 (80%) nếu không cấu hình
    const batteryLevel = (fp.batteryLevel != null && !isNaN(Number(fp.batteryLevel)))
      ? Math.max(0, Math.min(1, Number(fp.batteryLevel))) : 0.8;
    // batteryChargingTime: thời gian sạc đầy (giây). Nếu đang sạc: dùng giá trị cấu hình hoặc 0 (đã đầy).
    // Nếu không sạc: Infinity (không có thời gian sạc vì đang xả)
    const batteryChargingTime = batteryCharging
      ? (Number(fp.batteryChargingTime) >= 0 ? Number(fp.batteryChargingTime) : 0)
      : Infinity;
    // batteryDischargingTime: thời gian xả hết (giây). Nếu đang sạc: Infinity (không xả).
    // Nếu không sạc: dùng giá trị cấu hình hoặc 10000 giây (~2.7 giờ) làm mặc định
    const batteryDischargingTime = batteryCharging
      ? Infinity
      : (Number(fp.batteryDischargingTime) > 0 ? Number(fp.batteryDischargingTime) : 10000);
    try {
      await context.addInitScript(({ charging, level, chargingTime, dischargingTime }) => {
        try {
          // Tạo đối tượng BatteryManager giả — interface theo Web Battery API spec
          const fakeBattery = {
            charging,          // boolean: đang cắm sạc?
            chargingTime,      // số giây để sạc đầy (Infinity nếu không sạc)
            dischargingTime,   // số giây để hết pin (Infinity nếu đang sạc)
            level,             // 0.0–1.0: mức pin hiện tại
            // Các hàm event listener giả — không làm gì nhưng phải có để tránh lỗi TypeError
            addEventListener: function () {},
            removeEventListener: function () {},
            dispatchEvent: function () { return false; },
          };
          // Ghi đè navigator.getBattery(): trả về Promise với fakeBattery thay vì pin thật
          if (navigator.getBattery) {
            Object.defineProperty(navigator, 'getBattery', {
              value: function () { return Promise.resolve(fakeBattery); },
              configurable: true,
            });
          }
        } catch {}
      }, { charging: batteryCharging, level: batteryLevel, chargingTime: batteryChargingTime, dischargingTime: batteryDischargingTime });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 11. NETWORK INFORMATION API — gated by network section toggle, uses profile values
  // ═══════════════════════════════════════════════════════════════════════
  // Section 11: giả mạo Network Information API (navigator.connection).
  // API này cho phép website biết loại kết nối mạng: wifi, 4g, 3g, slow-2g...
  // Các thuộc tính quan trọng:
  //   - effectiveType: loại kết nối hiệu quả ('wifi', '4g', '3g', '2g', 'slow-2g')
  //   - downlink: tốc độ tải xuống ước tính (Mbps)
  //   - rtt: Round-Trip Time — độ trễ mạng ước tính (milliseconds)
  // Mặc định: nếu connectionType chứa 'wifi' → giả wifi (30Mbps, 20ms RTT), ngược lại → 4g (10Mbps, 50ms)
  if (applyNetwork) {
    const connType = (fp.connectionType || 'Ethernet').toLowerCase();
    const isWifi = connType.includes('wi-fi') || connType.includes('wifi');
    // Wifi: tốc độ cao hơn, độ trễ thấp hơn so với 4G mobile
    const netEffectiveType = isWifi ? 'wifi' : '4g';
    const netDownlink = isWifi ? 30 : 10;   // Mbps: wifi ~30, 4g ~10
    const netRtt = isWifi ? 20 : 50;         // ms: wifi ~20ms, 4g ~50ms
    try {
      await context.addInitScript(({ effectiveType, downlink, rtt }) => {
        try {
          // Tạo đối tượng NetworkInformation giả — interface theo Network Information API spec
          const fakeConn = {
            effectiveType,   // Loại kết nối hiệu quả
            downlink,        // Tốc độ tải xuống (Mbps)
            rtt,             // Độ trễ (ms)
            saveData: false, // Chế độ tiết kiệm dữ liệu — false = không bật
            // Event listener giả (API có sự kiện 'change' khi mạng thay đổi)
            addEventListener: function () {},
            removeEventListener: function () {},
            dispatchEvent: function () { return false; },
          };
          // navigator.connection: thuộc tính trả về NetworkInformation object
          Object.defineProperty(navigator, 'connection', { get: () => fakeConn, configurable: true });
        } catch {}
      }, { effectiveType: netEffectiveType, downlink: netDownlink, rtt: netRtt });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 12. MEDIA DEVICES — spoof enumerateDevices() count
  // ═══════════════════════════════════════════════════════════════════════
  // Section 12: giả mạo danh sách thiết bị media (webcam, microphone, loa).
  // navigator.mediaDevices.enumerateDevices() trả về danh sách thiết bị audio/video.
  // Vấn đề: số lượng và loại thiết bị khác nhau theo máy → là fingerprint.
  // Ví dụ: máy headless (không có UI) thường không có thiết bị nào → dễ bị phát hiện.
  // Giải pháp: trả về danh sách thiết bị giả khớp với cấu hình profile.
  // LƯU Ý: label luôn là '' (chuỗi rỗng) vì label thật chỉ có sau khi user cấp quyền camera/mic.
  if (applyMedia) {
    // Đọc số lượng từng loại thiết bị từ settings, làm tròn về số nguyên không âm
    const numSpeakers    = Math.max(0, Math.round(Number(settings?.mediaDevices?.speakers)    || 1)); // Mặc định 1 loa
    const numMicrophones = Math.max(0, Math.round(Number(settings?.mediaDevices?.microphones) || 0)); // Mặc định 0 mic
    const numWebcams     = Math.max(0, Math.round(Number(settings?.mediaDevices?.webcams)     || 0)); // Mặc định 0 webcam
    try {
      await context.addInitScript(({ speakers, microphones, webcams }) => {
        try {
          if (!navigator.mediaDevices) return; // Thoát sớm nếu API không tồn tại
          const fakeDevices = [];
          // Thêm các thiết bị giả theo thứ tự: loa → mic → webcam
          // kind: loại thiết bị theo chuẩn MediaDevices API
          for (let i = 0; i < speakers; i++)
            fakeDevices.push({ kind: 'audiooutput', deviceId: 'speaker_' + i, groupId: 'g_sp_' + i, label: '' });
          for (let i = 0; i < microphones; i++)
            fakeDevices.push({ kind: 'audioinput', deviceId: 'mic_' + i, groupId: 'g_mic_' + i, label: '' });
          for (let i = 0; i < webcams; i++)
            fakeDevices.push({ kind: 'videoinput', deviceId: 'cam_' + i, groupId: 'g_cam_' + i, label: '' });
          // Ghi đè enumerateDevices() để trả về danh sách thiết bị giả
          // writable: true cần thiết vì một số browser để enumerateDevices là writable
          Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
            value: function () { return Promise.resolve(fakeDevices); },
            configurable: true, writable: true,
          });
        } catch {}
      }, { speakers: numSpeakers, microphones: numMicrophones, webcams: numWebcams });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 13. SPEECH SYNTHESIS — gated by identity (navigator overrides)
  // ═══════════════════════════════════════════════════════════════════════
  // Section 13: giả mạo danh sách giọng đọc của Speech Synthesis API.
  // speechSynthesis.getVoices() trả về danh sách giọng đọc (SpeechSynthesisVoice) cài sẵn trong OS.
  // Vấn đề: danh sách này khác nhau theo OS/ngôn ngữ cài đặt → là fingerprint mạnh.
  // Giải pháp: không thêm/xóa giọng mà xáo trộn thứ tự theo seed và giới hạn số lượng.
  // Mục tiêu: hai profile cùng máy sẽ thấy giọng đọc theo thứ tự và số lượng khác nhau.
  if (applyNavigator) {
    try {
      await context.addInitScript(({ seed }) => {
        try {
          if (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices) {
            const origGetVoices = speechSynthesis.getVoices.bind(speechSynthesis);
            // mulberry32: PRNG với seed + 8191 để tạo chuỗi số riêng cho section này
            function mulberry32(a) {
              return function () {
                a |= 0; a = a + 0x6D2B79F5 | 0;
                let t = Math.imul(a ^ a >>> 15, 1 | a);
                t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
              };
            }
            const rng = mulberry32(seed + 8191); // Offset 8191 (số nguyên tố) để độc lập với section khác
            let cached = null; // Cache kết quả để không xáo trộn lại mỗi lần gọi (nhất quán)
            Object.defineProperty(speechSynthesis, 'getVoices', {
              value: function () {
                if (cached) return cached; // Trả về cache nếu đã tính trước đó
                const voices = origGetVoices();
                if (!voices || voices.length === 0) return voices; // Nếu không có giọng → trả thật
                const arr = [].concat(voices); // Sao chép mảng để không thay đổi danh sách gốc
                // Fisher-Yates shuffle: thuật toán xáo trộn ngẫu nhiên có seed → kết quả nhất quán
                for (let i = arr.length - 1; i > 0; i--) {
                  const j = Math.floor(rng() * (i + 1));
                  const t = arr[i]; arr[i] = arr[j]; arr[j] = t; // Hoán đổi phần tử i và j
                }
                // Giới hạn số giọng: lấy tối đa 20-29 giọng đầu (ngẫu nhiên theo seed)
                // Giả làm máy không có quá nhiều giọng cài sẵn → tự nhiên hơn
                cached = arr.slice(0, Math.min(arr.length, 20 + Math.floor(rng() * 10)));
                return cached;
              },
              configurable: true,
            });
          }
        } catch {}
      }, { seed: profileSeed });
    } catch {}
  }

  // Blocks 13-16 (keyboard, iframe, performance.now, fonts) REMOVED.
  // They override native DOM/API prototypes (Element.prototype.appendChild,
  // performance.now, CanvasRenderingContext2D.measureText, document.fonts.check)
  // which Cloudflare enterprise detects as automation signatures.
  // rebrowser-playwright handles CDP-level stealth at the network layer.
  //
  // Các block 14-16 đã bị xóa vì lý do sau:
  // - Chúng ghi đè prototype của DOM/API gốc (Element, performance, Canvas, FontFace...)
  // - Cloudflare Enterprise phát hiện bất kỳ prototype nào bị thay đổi → đánh dấu là automation
  // - Chức năng stealth ở tầng CDP (Chrome DevTools Protocol) do rebrowser-playwright xử lý thay thế
}

// Xuất 2 hàm để các module khác trong Node.js có thể import và sử dụng:
// - applyFingerprintInitScripts: hàm chính để tiêm fingerprint vào browser context
// - parseResolution: hàm tiện ích phân tích chuỗi độ phân giải "WxH"
module.exports = { applyFingerprintInitScripts, parseResolution };
