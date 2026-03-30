const { chromium } = require('playwright');
const axios = require('axios');

async function run() {
  try {
    console.log("Connecting to running Electron app via Chrome DevTools Protocol...");
    
    // Tìm URL debugger của Electron
    let jsonResp;
    try {
      const response = await axios.get('http://127.0.0.1:9222/json/version', { timeout: 3000 });
      jsonResp = response.data;
    } catch (e) {
      console.log("Could not reach debugger on port 9222. The dev server might not have --remote-debugging-port=9222 enabled.");
      return;
    }

    const webSocketDebuggerUrl = jsonResp.webSocketDebuggerUrl;
    console.log("WS URL:", webSocketDebuggerUrl);

    // Connect bằng Playwright
    const browser = await chromium.connectOverCDP(webSocketDebuggerUrl);
    const contexts = browser.contexts();
    
    let page;
    for (const ctx of contexts) {
      for (const p of ctx.pages()) {
        const title = await p.title();
        const url = p.url();
        console.log(`Found Window: [${title}] ${url}`);
        if (url.includes('localhost:5173') || url.includes('index.html')) {
          page = p;
          break;
        }
      }
      if (page) break;
    }

    if (!page) {
      console.log("Could not find the main window.");
      await browser.close();
      return;
    }

    console.log("Found Main Window.");
    
    // Chuyển sang tab Proxy
    console.log("Clicking Proxies tab in sidebar...");
    await page.locator('text="Proxies"').click({ timeout: 5000 }).catch(() => {});
    
    // Đợi render
    await page.waitForTimeout(1000);

    // Click nút Refesh All ở tab Proxy List
    console.log("Clicking Check All Proxies...");
    const checkAllBtn = page.locator('button[title="Check All"]');
    if (await checkAllBtn.isVisible()) {
        await checkAllBtn.click();
        console.log("Clicked! Wait 5 seconds for proxy checker...");
    } else {
        console.log("Not found Check All button");
    }

    await page.waitForTimeout(5000);
    console.log("Done. Please check the screen.");
    
    await browser.disconnect();

  } catch (err) {
    console.error("Automation error:", err);
  }
}

run();
