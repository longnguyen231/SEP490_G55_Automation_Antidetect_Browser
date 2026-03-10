const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

/**
 * Kiểm tra kết nối của một proxy.
 * @param {Object} proxy - Dữ liệu proxy: { type, host, port, username, password }
 * @returns {Promise<Object>} { success, latency, ip, location, error }
 */
async function checkProxy(proxy) {
    if (!proxy || !proxy.host || !proxy.port || !proxy.type) {
        return { success: false, error: 'Invalid proxy configuration' };
    }

    const { type, host, port, username, password } = proxy;
    const protocol = type.toLowerCase();
    
    // Xây dựng URL auth nếu có
    const authString = (username && password) ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
    let proxyUrl = '';

    if (protocol === 'http') {
        proxyUrl = `http://${authString}${host}:${port}`;
    } else if (protocol === 'https') {
        proxyUrl = `https://${authString}${host}:${port}`;
    } else if (protocol === 'socks4' || protocol === 'socks5') {
        proxyUrl = `${protocol}://${authString}${host}:${port}`;
    } else {
        return { success: false, error: `Unsupported proxy type: ${type}` };
    }

    // Chọn Agent tương ứng với proxy
    let agent;
    try {
        if (protocol === 'http' || protocol === 'https') {
            agent = new HttpsProxyAgent(proxyUrl);
        } else if (protocol.startsWith('socks')) {
            agent = new SocksProxyAgent(proxyUrl);
        }
    } catch (err) {
        return { success: false, error: `Error creating proxy agent: ${err.message}` };
    }

    // Tiến hành đo latency và fetch public IP từ dịch vụ bên thứ 3
    const startTime = Date.now();
    try {
        // Kiểm tra IP thực sự thông qua proxy (thử ipify hoặc một api check IP)
        const response = await axios.get('https://api.ipify.org?format=json', {
            httpsAgent: agent,
            timeout: 10000, // Timeout 10 giây
        });

        const latency = Date.now() - startTime;
        
        if (response.data && response.data.ip) {
            return {
                success: true,
                latency,
                ip: response.data.ip,
                // Location API có thể được gọi thêm ở đây nếu cần, nhưng tạm thời skip để tối ưu thời gian.
            };
        } else {
            return { success: false, error: 'Invalid response from check server' };
        }
    } catch (error) {
        let errorMessage = error.message;
        if (error.code === 'ECONNRESET') errorMessage = 'Connection reset by peer';
        if (error.code === 'ECONNREFUSED') errorMessage = 'Connection refused';
        if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) errorMessage = 'Connection timeout';
        
        return { success: false, error: errorMessage };
    }
}

module.exports = { checkProxy };
