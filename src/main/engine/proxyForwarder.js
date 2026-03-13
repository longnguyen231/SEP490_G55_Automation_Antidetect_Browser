const ProxyChain = require('proxy-chain');

function buildUpstreamUrl(proxy) {
  try {
    if (!proxy || !proxy.server) return null;
    let server = String(proxy.server).trim();
    if (!/^https?:\/\//i.test(server) && !/^socks\d?:\/\//i.test(server)) {
      // Default to http if no scheme provided
      server = `http://${server}`;
    }
    const u = new URL(server);
    // Inject credentials if provided in proxy object and not already in URL
    if (proxy.username) u.username = encodeURIComponent(proxy.username);
    if (proxy.password) u.password = encodeURIComponent(proxy.password);
    return u.toString();
  } catch (e) {
    return null;
  }
}

async function startProxyForwarder(proxy, { appendLog, profileId } = {}) {
  const upstreamProxyUrl = buildUpstreamUrl(proxy);
  if (!upstreamProxyUrl) throw new Error('Invalid upstream proxy configuration');

  const server = new ProxyChain.Server({
    // We'll bind dynamically in listen(); local only
    verbose: false,
    // Route all requests via the upstream proxy URL
    prepareRequestFunction: () => ({ upstreamProxyUrl }),
  });

  await server.listen(0, '127.0.0.1');
  const address = server.server.address();
  const port = address && address.port;
  const localUrl = `http://127.0.0.1:${port}`;
  appendLog && profileId && appendLog(profileId, `Started local proxy forwarder at ${localUrl} -> ${upstreamProxyUrl.replace(/:\/\/(.*?)@/,'://***:***@')}`);

  const stop = async () => {
    try { await server.close(true); } catch {}
    appendLog && profileId && appendLog(profileId, 'Stopped local proxy forwarder');
  };

  return { url: localUrl, port, stop, _server: server };
}

module.exports = { startProxyForwarder };
