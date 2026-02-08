/**
 * Application Configuration
 * SEP490 G55 - Automation Antidetect Browser
 * 
 * File này chứa tất cả cấu hình của ứng dụng.
 * Các thành viên có thể thay đổi config tại đây thay vì hardcode trong code.
 */

const path = require('path');
const { app } = require('electron');

// Đường dẫn gốc lưu trữ dữ liệu
const DATA_ROOT = app?.getPath?.('userData') || path.join(__dirname, '../../../data');

/**
 * Cấu hình ứng dụng chính
 */
const APP_CONFIG = {
    // Thông tin ứng dụng
    APP_NAME: 'SEP490 G55 - Automation Antidetect Browser',
    VERSION: '1.0.0',

    // Cấu hình cửa sổ
    WINDOW: {
        WIDTH: 1400,
        HEIGHT: 900,
        MIN_WIDTH: 1024,
        MIN_HEIGHT: 768,
    },

    // Đường dẫn lưu trữ
    PATHS: {
        DATA_ROOT,
        PROFILES: path.join(DATA_ROOT, 'profiles'),
        BROWSER_DATA: path.join(DATA_ROOT, 'browser-data'),
        LOGS: path.join(DATA_ROOT, 'logs'),
        STORAGE_STATE: path.join(DATA_ROOT, 'storage-state'),
    },
};

/**
 * Cấu hình Browser Engine
 */
const BROWSER_CONFIG = {
    // Engine mặc định: 'playwright' hoặc 'cdp'
    DEFAULT_ENGINE: 'playwright',

    // Timeout cho các thao tác (ms)
    TIMEOUTS: {
        NAVIGATION: 30000,
        ELEMENT_WAIT: 10000,
        SCRIPT_EXECUTION: 5000,
    },

    // Các trình duyệt được hỗ trợ
    SUPPORTED_BROWSERS: ['chromium', 'chrome', 'edge'],

    // Cấu hình CDP (Chrome DevTools Protocol)
    CDP: {
        DEFAULT_HOST: '127.0.0.1',
        DEFAULT_PORT: 9222,
    },
};

/**
 * Cấu hình Fingerprint mặc định
 * Antidetect browser cần giả lập các fingerprint để tránh bị phát hiện
 */
const FINGERPRINT_DEFAULTS = {
    // User Agent mặc định
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

    // Ngôn ngữ
    language: 'en-US',

    // Múi giờ
    timezone: 'Asia/Ho_Chi_Minh',

    // Độ phân giải màn hình
    screenResolution: '1920x1080',

    // WebGL
    webgl: true,

    // WebRTC
    webrtc: 'default', // 'default', 'proxy_only', 'disable_udp'

    // Canvas
    canvas: true,

    // Audio
    audio: true,
};

/**
 * Cấu hình Automation
 */
const AUTOMATION_CONFIG = {
    // Độ trễ giữa các action (ms)
    ACTION_DELAY: 500,

    // Số lần retry khi thất bại
    MAX_RETRIES: 3,

    // Các action được hỗ trợ
    SUPPORTED_ACTIONS: [
        'navigate',     // Điều hướng đến URL
        'click',        // Click vào element
        'type',         // Nhập text
        'wait',         // Chờ một khoảng thời gian
        'waitForSelector', // Chờ element xuất hiện
        'screenshot',   // Chụp ảnh màn hình
        'eval',         // Thực thi JavaScript
        'scroll',       // Cuộn trang
        'hover',        // Di chuột qua element
        'select',       // Chọn option trong dropdown
    ],
};

module.exports = {
    APP_CONFIG,
    BROWSER_CONFIG,
    FINGERPRINT_DEFAULTS,
    AUTOMATION_CONFIG,
};
