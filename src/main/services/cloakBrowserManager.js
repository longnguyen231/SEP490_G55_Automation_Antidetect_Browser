const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWindowRef = null;
function setMainWindowRef(win) {
  mainWindowRef = win;
}

function getCloakBrowserDir() {
  const { getDataRoot } = require("../storage/paths");
  return path.join(getDataRoot(), "cloakbrowser");
}

// Function to get the executable path dynamically from the module
async function getCloakBrowserExecutableAsync() {
  try {
    process.env.CLOAKBROWSER_CACHE_DIR = getCloakBrowserDir();
    const cb = await import("cloakbrowser");
    const info = cb.binaryInfo();
    if (info.installed && fs.existsSync(info.binaryPath)) {
      return info.binaryPath;
    }
  } catch {}
  return null;
}

// Synchronous fallback just in case
function getCloakBrowserExecutableSync() {
  const dir = getCloakBrowserDir();
  // typical path: .cloakbrowser/chromium-146.0.7680.177.5/chrome.exe
  try {
    const dirs = fs.readdirSync(dir);
    for (const d of dirs) {
      if (d.startsWith("chromium-")) {
        const p =
          process.platform === "win32"
            ? path.join(dir, d, "chrome.exe")
            : process.platform === "darwin"
              ? path.join(
                  dir,
                  d,
                  "Chromium.app",
                  "Contents",
                  "MacOS",
                  "Chromium",
                )
              : path.join(dir, d, "chrome");
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {}
  return null;
}

function sendLog(log, percent = null) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send("browser-runtime-progress", {
      browserName: "cloakbrowser",
      log,
      percent,
    });
  }
}

const activeInstall = { running: false };

async function checkStatus() {
  process.env.CLOAKBROWSER_CACHE_DIR = getCloakBrowserDir();
  let downloaded = false;
  let exePath = null;
  let version = null;

  try {
    const cb = await import("cloakbrowser");
    const info = cb.binaryInfo();
    downloaded = info.installed;
    if (downloaded && fs.existsSync(info.binaryPath)) {
      exePath = info.binaryPath;
      version = info.version;
    }
  } catch (e) {
    // fallback sync check
    exePath = getCloakBrowserExecutableSync();
    if (exePath) {
      downloaded = true;
      version = "Unknown";
    }
  }

  let sizeStr = "0 MB";
  if (downloaded && exePath) {
    try {
      const getFolderSize =
        require("./browserManagerService").getFolderSize ||
        async function (d) {
          let total = 0;
          const entries = await fs.promises.readdir(d, { withFileTypes: true });
          await Promise.all(
            entries.map(async (e) => {
              try {
                const fp = path.join(d, e.name);
                if (e.isDirectory()) total += await getFolderSize(fp);
                else total += (await fs.promises.stat(fp)).size;
              } catch {}
            }),
          );
          return total;
        };
      // The actual downloaded folder
      const baseDir = path.dirname(
        process.platform === "darwin"
          ? path.dirname(path.dirname(path.dirname(exePath)))
          : path.dirname(exePath),
      );
      const sizeBytes = await getFolderSize(baseDir);
      sizeStr = (sizeBytes / (1024 * 1024)).toFixed(2) + " MB";
    } catch {}
  }

  return {
    status: downloaded ? "installed" : "missing",
    path: exePath,
    version: version,
    size: sizeStr,
    isInstalling: activeInstall.running,
    lastLog: "",
  };
}

async function install() {
  if (activeInstall.running)
    return { success: false, error: "CloakBrowser is already installing." };
  activeInstall.running = true;

  try {
    sendLog("Starting CloakBrowser download...", 0);

    // Ensure directory exists
    const dir = getCloakBrowserDir();
    fs.mkdirSync(dir, { recursive: true });

    const cmd = process.platform === "win32" ? "npx.cmd" : "npx";

    await new Promise((resolve, reject) => {
      const child = spawn(cmd, ["cloakbrowser", "install"], {
        env: { ...process.env, CLOAKBROWSER_CACHE_DIR: dir },
        cwd: path.resolve(__dirname, "../../.."), // root project
        shell: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", // required on Windows to execute .cmd files via cmd.exe
      });

      let lastPercent = 0;

      child.stdout.on("data", (data) => {
        const text = data.toString();
        const match = text.match(/(\d+)%/);
        if (match) {
          lastPercent = parseInt(match[1], 10);
        }
        sendLog(text.trim().split("\n").pop() || text.trim(), lastPercent);
      });

      child.stderr.on("data", (data) => {
        const text = data.toString();
        sendLog(text.trim().split("\n").pop() || text.trim(), lastPercent);
      });

      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Exit code ${code}`));
      });
      child.on("error", reject);
    });

    sendLog("CloakBrowser installed successfully!", 100);
    activeInstall.running = false;
    return { success: true };
  } catch (e) {
    activeInstall.running = false;
    sendLog(`Install failed: ${e.message}`, null);
    return { success: false, error: e.message };
  }
}

async function uninstall() {
  try {
    process.env.CLOAKBROWSER_CACHE_DIR = getCloakBrowserDir();
    const cb = await import("cloakbrowser");
    cb.clearCache();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  setMainWindowRef,
  getCloakBrowserDir,
  getCloakBrowserExecutableAsync,
  getCloakBrowserExecutableSync,
  checkStatus,
  install,
  uninstall,
};
