const fs = require('fs');
const crypto = require('crypto');
const { proxiesFilePath } = require('./paths');
const { appendLog } = require('../logging/logger');

// --------------- Helpers ---------------

function generateShortId() {
    try {
        const bytes = crypto.randomBytes(6).toString('hex');
        const t = Date.now().toString(36);
        return (t + bytes.slice(0, 6)).toLowerCase();
    } catch {
        const t = Date.now().toString(36);
        const r = Math.random().toString(36).slice(2, 8);
        return (t + r).toLowerCase();
    }
}

const VALID_TYPES = ['http', 'https', 'socks4', 'socks5'];

function validateProxyInput(p) {
    const errors = [];
    if (!p || typeof p !== 'object') return ['Payload must be an object'];
    const host = (p.host || '').trim();
    if (!host) errors.push('Host is required');
    const port = Number(p.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('Port must be 1-65535');
    if (p.type && !VALID_TYPES.includes(p.type)) errors.push(`Type must be one of: ${VALID_TYPES.join(', ')}`);
    if (p.name && String(p.name).length > 200) errors.push('Name too long (>200 chars)');
    return errors;
}



function readProxies() {
    try {
        const raw = fs.readFileSync(proxiesFilePath(), 'utf8');
        if (!raw.trim()) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        appendLog('system', `readProxies fallback (corrupt?): ${e.message}`);
        return [];
    }
}

function writeProxies(list) {
    try {
        const p = proxiesFilePath();
        const lockPath = p + '.lock';
        // Acquire simple lock (best-effort). Remove stale (>20s) lock.
        try {
            if (fs.existsSync(lockPath)) {
                const stat = fs.statSync(lockPath);
                const age = Date.now() - stat.mtimeMs;
                if (age > 20000) { try { fs.unlinkSync(lockPath); } catch { } }
            }
            fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
        } catch (e) {
            return false;
        }
        try {
            const tmp = p + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
            fs.renameSync(tmp, p);
        } finally {
            try { fs.unlinkSync(lockPath); } catch { }
        }
        return true;
    } catch (e) {
        appendLog('system', `writeProxies error: ${e.message}`);
        return false;
    }
}

// --------------- CRUD ---------------

async function getProxiesInternal() {
    return readProxies();
}

async function getProxyByIdInternal(id) {
    const proxies = readProxies();
    const proxy = proxies.find(p => p.id === id);
    if (!proxy) return { success: false, error: 'Proxy not found' };
    return { success: true, proxy };
}

async function createProxyInternal(data) {
    try {
        if (!data || typeof data !== 'object') return { success: false, error: 'Invalid payload' };
        const errors = validateProxyInput(data);
        if (errors.length) return { success: false, error: errors[0] };

        const proxies = readProxies();
        let newId = generateShortId();
        const existingIds = new Set(proxies.map(p => p.id));
        while (existingIds.has(newId)) newId = generateShortId();

        const nowIso = new Date().toISOString();
        const proxy = {
            id: newId,
            name: (data.name || '').trim() || `Proxy ${proxies.length + 1}`,
            type: VALID_TYPES.includes(data.type) ? data.type : 'http',
            host: String(data.host).trim(),
            port: Number(data.port),
            username: (data.username || '').trim(),
            password: (data.password || '').trim(),
            status: 'unchecked',
            lastChecked: null,
            latency: null,
            country: (data.country || '').trim(),
            note: (data.note || '').trim(),
            rotateUrl: (data.rotateUrl || '').trim(),
            createdAt: nowIso,
            updatedAt: nowIso,
        };

        proxies.push(proxy);
        const ok = writeProxies(proxies);
        if (!ok) return { success: false, error: 'Failed to persist proxies file' };
        appendLog('system', `Created proxy ${proxy.id} (${proxy.name})`);
        return { success: true, proxy };
    } catch (e) {
        appendLog('system', `createProxyInternal error: ${e.message}`);
        return { success: false, error: e.message };
    }
}

async function updateProxyInternal(id, data) {
    try {
        if (!id) return { success: false, error: 'Proxy id is required' };
        if (!data || typeof data !== 'object') return { success: false, error: 'Invalid payload' };

        const proxies = readProxies();
        const idx = proxies.findIndex(p => p.id === id);
        if (idx === -1) return { success: false, error: 'Proxy not found' };

        const existing = proxies[idx];

        // Build merged proxy — only override provided fields
        const merged = { ...existing };
        if (data.name != null) merged.name = String(data.name).trim();
        if (data.type != null) {
            if (!VALID_TYPES.includes(data.type)) return { success: false, error: `Type must be one of: ${VALID_TYPES.join(', ')}` };
            merged.type = data.type;
        }
        if (data.host != null) {
            const h = String(data.host).trim();
            if (!h) return { success: false, error: 'Host is required' };
            merged.host = h;
        }
        if (data.port != null) {
            const p = Number(data.port);
            if (!Number.isInteger(p) || p < 1 || p > 65535) return { success: false, error: 'Port must be 1-65535' };
            merged.port = p;
        }
        if (data.username != null) merged.username = String(data.username).trim();
        if (data.password != null) merged.password = String(data.password).trim();
        if (data.country != null) merged.country = String(data.country).trim();
        if (data.note != null) merged.note = String(data.note).trim();
        if (data.rotateUrl != null) merged.rotateUrl = String(data.rotateUrl).trim();
        // Allow checker module to update status/latency
        if (data.status != null) merged.status = data.status;
        if (data.lastChecked != null) merged.lastChecked = data.lastChecked;
        if (data.latency != null) merged.latency = data.latency;

        merged.updatedAt = new Date().toISOString();
        proxies[idx] = merged;

        const ok = writeProxies(proxies);
        if (!ok) return { success: false, error: 'Failed to persist proxies file' };
        appendLog('system', `Updated proxy ${id}`);
        return { success: true, proxy: merged };
    } catch (e) {
        appendLog('system', `updateProxyInternal error: ${e.message}`);
        return { success: false, error: e.message };
    }
}

async function deleteProxyInternal(id) {
    try {
        if (!id) return { success: false, error: 'Proxy id is required' };
        const proxies = readProxies();
        const filtered = proxies.filter(p => p.id !== id);
        if (filtered.length === proxies.length) return { success: false, error: 'Proxy not found' };

        const ok = writeProxies(filtered);
        if (!ok) return { success: false, error: 'Failed to persist proxies file' };
        appendLog('system', `Deleted proxy ${id}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function deleteProxiesBulkInternal(ids) {
    try {
        if (!Array.isArray(ids) || !ids.length) return { success: false, error: 'ids must be a non-empty array' };
        const idSet = new Set(ids.map(String));
        const proxies = readProxies();
        const filtered = proxies.filter(p => !idSet.has(p.id));
        const deletedCount = proxies.length - filtered.length;

        const ok = writeProxies(filtered);
        if (!ok) return { success: false, error: 'Failed to persist proxies file' };
        appendLog('system', `Bulk deleted ${deletedCount} proxies`);
        return { success: true, deleted: deletedCount };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// --------------- Import / Export ---------------

/**
 * Parse a single proxy line into a proxy data object.
 * Supports formats:
 *   host:port
 *   host:port:username:password
 *   type://host:port
 *   type://username:password@host:port
 */
function parseProxyLine(line) {
    const s = (line || '').trim();
    if (!s || s.startsWith('#') || s.startsWith('//')) return null;

    // Try URL-style first: type://[user:pass@]host:port
    const urlMatch = s.match(/^(https?|socks[45]?):\/\/(?:([^:@]+):([^@]+)@)?([^:\/]+):(\d+)\s*$/i);
    if (urlMatch) {
        let type = urlMatch[1].toLowerCase();
        if (type === 'socks') type = 'socks5';
        return {
            type,
            username: urlMatch[2] || '',
            password: urlMatch[3] || '',
            host: urlMatch[4],
            port: parseInt(urlMatch[5], 10),
        };
    }

    // host:port or host:port:user:pass
    const parts = s.split(':');
    if (parts.length === 2) {
        const port = parseInt(parts[1], 10);
        if (parts[0] && Number.isInteger(port) && port >= 1 && port <= 65535) {
            return { type: 'http', host: parts[0].trim(), port, username: '', password: '' };
        }
    }
    if (parts.length === 4) {
        const port = parseInt(parts[1], 10);
        if (parts[0] && Number.isInteger(port) && port >= 1 && port <= 65535) {
            return { type: 'http', host: parts[0].trim(), port, username: parts[2].trim(), password: parts[3].trim() };
        }
    }

    return null; // unparseable
}

async function importProxiesInternal(text, _format) {
    try {
        if (!text || typeof text !== 'string') return { success: false, error: 'Text input is required' };

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) return { success: false, error: 'No proxy lines found' };

        const proxies = readProxies();
        const existingIds = new Set(proxies.map(p => p.id));
        const nowIso = new Date().toISOString();
        const imported = [];
        let skipped = 0;

        for (const line of lines) {
            const parsed = parseProxyLine(line);
            if (!parsed) { skipped++; continue; }

            let newId = generateShortId();
            while (existingIds.has(newId)) newId = generateShortId();
            existingIds.add(newId);

            const proxy = {
                id: newId,
                name: `${parsed.host}:${parsed.port}`,
                type: parsed.type,
                host: parsed.host,
                port: parsed.port,
                username: parsed.username,
                password: parsed.password,
                status: 'unchecked',
                lastChecked: null,
                latency: null,
                country: '',
                note: '',
                createdAt: nowIso,
                updatedAt: nowIso,
            };
            imported.push(proxy);
            proxies.push(proxy);
        }

        if (!imported.length) return { success: false, error: `No valid proxies found (${skipped} lines skipped)` };

        const ok = writeProxies(proxies);
        if (!ok) return { success: false, error: 'Failed to persist proxies file' };
        appendLog('system', `Imported ${imported.length} proxies (${skipped} skipped)`);
        return { success: true, imported: imported.length, skipped, proxies: imported };
    } catch (e) {
        appendLog('system', `importProxiesInternal error: ${e.message}`);
        return { success: false, error: e.message };
    }
}

async function exportProxiesInternal(ids) {
    try {
        const proxies = readProxies();
        const toExport = ids && Array.isArray(ids) && ids.length
            ? proxies.filter(p => ids.includes(p.id))
            : proxies;

        const lines = toExport.map(p => {
            const auth = (p.username && p.password) ? `${p.username}:${p.password}@` : '';
            return `${p.type || 'http'}://${auth}${p.host}:${p.port}`;
        });

        return { success: true, text: lines.join('\n'), count: lines.length };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = {
    getProxiesInternal,
    getProxyByIdInternal,
    createProxyInternal,
    updateProxyInternal,
    deleteProxyInternal,
    deleteProxiesBulkInternal,
    importProxiesInternal,
    exportProxiesInternal,
    readProxies,
    writeProxies,
};
