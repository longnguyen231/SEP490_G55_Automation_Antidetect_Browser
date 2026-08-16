# HƯỚNG DẪN KIỂM THỬ TOÀN DIỆN UNIT TEST (TESTING GUIDE)
## DỰ ÁN: HL-MCK AUTOMATION ANTIDETECT BROWSER

---

## MỤC LỤC
1. [Tổng Quan Kiến Trúc Kiểm Thử](#1-tổng-quan-kiến-trúc-kiểm-thử)
2. [Hướng Dẫn Lệnh Chạy Kiểm Thử Nhanh](#2-hướng-dẫn-lệnh-chạy-kiểm-thử-nhanh)
3. [Hướng Dẫn Kiểm Thử Chi Tiết Từng Module (10 Services Master Plan L1)](#3-hướng-dẫn-kiểm-thử-chi-tiết-từng-module)
   - 3.1. [ProfileService (25 Test Cases)](#31-profileservice-testsunitstorageprofileservicetestjs)
   - 3.2. [FingerprintService (14 Test Cases)](#32-fingerprintservice-testsunitstoragefingerprintservicetestjs)
   - 3.3. [ProxyService (22 Test Cases)](#33-proxyservice-testsunitstorageproxyservicetestjs)
   - 3.4. [ScriptService (44 Test Cases)](#34-scriptservice-testsunitstoragescriptservicetestjs)
   - 3.5. [RuntimeService (16 Test Cases)](#35-runtimeservice-testsunitstorageruntimeservicetestjs)
   - 3.6. [StoragePrivacyService (21 Test Cases)](#36-storageprivacyservice-testsunitstoragestorageprivacyservicetestjs)
   - 3.7. [LicensePortalService (49 Test Cases)](#37-licenseportalservice-testsunitstoragelicenseportalservicetestjs)
   - 3.8. [SessionCookieService (16 Test Cases)](#38-sessioncookieservice-testsunitstoragesessioncookieservicetestjs)
   - 3.9. [TaskSchedulerService (18 Test Cases)](#39-taskschedulerservice-testsunitstoragetaskschedulerservicetestjs)
   - 3.10. [MonitoringLogService (25 Test Cases)](#310-monitoringlogservice-testsunitstoragemonitoringlogservicetestjs)
4. [Hướng Dẫn Kiểm Thử Cơ Chế Bật/Tắt Fingerprint (28 Test Cases)](#4-hướng-dẫn-kiểm-thử-cơ-chế-bậttắt-fingerprint)
5. [Hướng Dẫn Kiểm Thử API & Web Admin](#5-hướng-dẫn-kiểm-thử-api--web-admin)
6. [Quy Chuẩn Đánh Giá Pass/Fail & Báo Cáo Lỗi](#6-quy-chuẩn-đánh-giá-passfail--báo-cáo-lỗi)

---

## 1. TỔNG QUAN KIẾN TRÚC KIỂM THỬ

- **Framework kiểm thử**: [Jest](https://jestjs.io/)
- **Môi trường thực thi**: Node.js v18+ (Hỗ trợ môi trường Windows / Linux / macOS)
- **Cơ chế Mocking & Cô lập**: 
  - Mock In-Memory State độc lập cho từng test suite để tránh rò rỉ dữ liệu giữa các ca kiểm thử.
  - Tự động reset mock (`beforeEach(() => { jest.clearAllMocks(); })`) trước mỗi test case.
  - Đảm bảo tính tuân thủ an toàn thông tin: không lưu trữ plaintext secret/password trong audit log, luôn kèm `correlationId` để truy vết.
- **Tiêu chuẩn khớp đặc tả**:
  - `HL-MCK_Report_5_1_UnitTests_L1.xlsm`: 250 test cases chuẩn nghiệp vụ cấp L1.
  - `HL-MCK_Fake_Fingerprint_BaoCao_v4.xlsx`: 28 test cases cơ chế Bật/Tắt (Toggle ON/OFF) Fingerprint.

---

## 2. HƯỚNG DẪN LỆNH CHẠY KIỂM THỬ NHANH

Mở Terminal (PowerShell / Command Prompt / Bash) tại thư mục gốc dự án: `d:\Anti\SEP490_G55_Automation_Antidetect_Browser`

### 2.1. Chạy toàn bộ 32 Test Suites (666 tests)
```bash
npx jest tests/unit/
```

### 2.2. Chạy với thông tin chi tiết từng test case (Verbose Mode)
```bash
npx jest tests/unit/ --verbose
```

### 2.3. Chạy riêng 10 Services của Master Plan L1
```bash
npx jest tests/unit/storage/profileService.test.js tests/unit/storage/fingerprintService.test.js tests/unit/storage/proxyService.test.js tests/unit/storage/scriptService.test.js tests/unit/storage/runtimeService.test.js tests/unit/storage/storagePrivacyService.test.js tests/unit/storage/licensePortalService.test.js tests/unit/storage/sessionCookieService.test.js tests/unit/storage/taskSchedulerService.test.js tests/unit/storage/monitoringLogService.test.js --verbose
```

### 2.4. Chạy một file test cụ thể
```bash
# Ví dụ chạy ProfileService
npx jest tests/unit/storage/profileService.test.js --verbose

# Ví dụ chạy Fingerprint Spoofing
npx jest tests/unit/main/fingerprintSpoofing.test.js --verbose
```

### 2.5. Chạy lọc theo tên Test Case (Pattern Matching)
```bash
# Chỉ chạy các test case liên quan đến Canvas
npx jest -t "Canvas" --verbose

# Chỉ chạy các test case có mã FT-01
npx jest -t "FT-01" --verbose
```

### 2.6. Xuất báo cáo độ phủ mã nguồn (Coverage Report)
```bash
npx jest tests/unit/ --coverage
```

---

## 3. HƯỚNG DẪN KIỂM THỬ CHI TIẾT TỪNG MODULE

### 3.1. ProfileService (`tests/unit/storage/profileService.test.js`)
- **Số lượng test case**: 25 Cases (`TC-UNIT-ProfileService-001` đến `TC-UNIT-ProfileService-025`)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/storage/profileService.test.js --verbose
  ```
- **Mục tiêu kiểm thử**:
  - `TC-001 -> TC-010`: Kiểm thử Use Case (Tạo, Xem danh sách, Chi tiết, Chỉnh sửa, Xóa, Nhân bản/Clone, Khởi chạy nhanh, Gán tag/nhóm, Tìm kiếm profile).
  - `TC-011 -> TC-014 (AC-01 -> AC-04)`: Xác thực tạo profile trạng thái `Ready`, cập nhật cấu hình phản ánh ngay lần mở tiếp theo, xóa profile dọn sạch thư mục cô lập, clone profile sinh ID và Canvas noise seed hoàn toàn mới.
  - `TC-015 -> TC-018 (NAC-01 -> NAC-04)`: Từ chối tên rỗng/chỉ chứa khoảng trắng, từ chối ID trùng lặp, từ chối chỉnh sửa profile đang ở trạng thái `Running`, ngăn chặn xóa profile đang chạy.
  - `TC-019 -> TC-025 (BV-01 -> BV-06)`: Kiểm thử giá trị biên độ dài tên (1 - 100 ký tự), cấu hình phần cứng CPU/RAM (CPU 1-64 cores, RAM 1-64GB), kiểm tra giới hạn luồng chạy song song (Concurrency limit).

---

### 3.2. FingerprintService (`tests/unit/storage/fingerprintService.test.js`)
- **Số lượng test case**: 14 Cases (`TC-UNIT-FingerprintService-001` đến `TC-UNIT-FingerprintService-014`)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/storage/fingerprintService.test.js --verbose
  ```
- **Mục tiêu kiểm thử**:
  - `TC-001 -> TC-007`: Kiểm tra khởi tạo Fingerprint Preset, áp dụng Canvas Noise, WebGL Vendor/Renderer giả lập, AudioContext Noise, Font list injection, WebRTC Public IP spoofing.
  - `TC-008 -> TC-010 (AC-01 -> AC-03)`: Đảm bảo 2 profile khác nhau luôn sinh ra 2 hash fingerprint khác nhau; tính nhất quán (deterministic) của fingerprint qua nhiều phiên của cùng 1 profile.
  - `TC-011 -> TC-013 (NAC-01 -> NAC-03)`: Từ chối kết hợp OS/Browser không hợp lệ (ví dụ: Windows Safari), từ chối WebGL vendor không đúng định dạng chuẩn, chặn giá trị Audio SampleRate bất thường (< 8000Hz hoặc > 192000Hz).
  - `TC-014 (BV-07)`: Kiểm tra biên độ phân giải màn hình chuẩn (800x600 đến 3840x2160).

---

### 3.3. ProxyService (`tests/unit/storage/proxyService.test.js`)
- **Số lượng test case**: 22 Cases (`TC-UNIT-ProxyService-001` đến `TC-UNIT-ProxyService-022`)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/storage/proxyService.test.js --verbose
  ```
- **Mục tiêu kiểm thử**:
  - `TC-001 -> TC-013`: Thêm proxy HTTP/SOCKS5, kiểm tra tình trạng kết nối (Proxy Health Check), lấy IP thực tế qua proxy, xoay proxy tự động (Auto-Rotate URL), import/export danh sách proxy từ file txt/json, gán proxy vào profile.
  - `TC-014 -> TC-017 (AC-01 -> AC-04)`: Thêm proxy mới tạo bản ghi `Unchecked`; kiểm tra proxy thành công cập nhật latency và IP mà không làm lộ/thay đổi mật khẩu; gán proxy thiết lập route độc lập.
  - `TC-018 -> TC-021 (NAC-01 -> NAC-04)`: Từ chối định dạng host/IP sai, loại proxy không hỗ trợ, từ chối xoay proxy khi thiếu URL cấu hình, gán proxy không tồn tại trả về lỗi rõ ràng.
  - `TC-022 (BV-07)`: Kiểm tra biên cổng mạng (Port 1 - 65535 hợp lệ; 0 và 65536 bị từ chối).

---

### 3.4. ScriptService (`tests/unit/storage/scriptService.test.js`)
- **Số lượng test case**: 44 Cases (`TC-UNIT-ScriptService-001` đến `TC-UNIT-ScriptService-044`)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/storage/scriptService.test.js --verbose
  ```
- **Mục tiêu kiểm thử**:
  - `TC-001 -> TC-024`: Trình soạn thảo kịch bản Playwright/Puppeteer, lưu bản nháp/bản phát hành, import/export kịch bản, chạy thử nghiệm (Dry Run), thực thi kịch bản trên profile, tạm dừng (Pause), tiếp tục (Resume), hủy bỏ (Stop/Abort), truyền biến tham số môi trường.
  - `TC-025 -> TC-032 (AC-01 -> AC-08)`: API injection an toàn; ghi log thực thi từng bước kèm thời gian; trạng thái chuyển sang `COMPLETED` khi hoàn thành, `FAILED` khi gặp lỗi cú pháp.
  - `TC-033 -> TC-040 (NAC-01 -> NAC-08)`: Chặn thực thi kịch bản chứa mã độc hại nguy hiểm bị cấm (như truy cập trái phép filesystem ngoài phạm vi); từ chối script rỗng; chặn chạy 2 script đồng thời trên cùng 1 profile.
  - `TC-041 -> TC-044 (BV-08 -> BV-09)`: Kiểm tra giới hạn thời gian thực thi (Timeout 1s đến 300s), kiểm tra dung lượng script tối đa.

---

### 3.5. RuntimeService (`tests/unit/storage/runtimeService.test.js`)
- **Số lượng test case**: 16 Cases (`TC-UNIT-RuntimeService-001` đến `TC-UNIT-RuntimeService-016`)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/storage/runtimeService.test.js --verbose
  ```
- **Mục tiêu kiểm thử**:
  - `TC-001 -> TC-009`: Quản lý phiên bản lõi Chromium / Firefox, tải về runtime mới, kiểm tra tính toàn vẹn file thực thi (Executable Checksum), cài đặt và gỡ bỏ runtime an toàn.
  - `TC-010 -> TC-012 (AC-01 -> AC-03)`: Phân biệt chính xác giữa bản cài đặt bị thiếu (`Missing`) và bị hỏng (`Broken`); tải runtime hiển thị tiến trình phần trăm từ 0% đến 100%.
  - `TC-013 -> TC-015 (NAC-01 -> NAC-03)`: Chặn khởi chạy profile khi runtime bị lỗi; từ chối lệnh tải trùng lặp cho cùng một engine đang được tải.
  - `TC-016 (BV-10)`: Kiểm tra điều kiện dung lượng ổ đĩa khả dụng (>= 2048 MB cho phép tải, < 2048 MB từ chối và cảnh báo).

---

### 3.6. StoragePrivacyService (`tests/unit/storage/storagePrivacyService.test.js`)
- **Số lượng test case**: 21 Cases (`TC-UNIT-StoragePrivacyService-001` đến `TC-UNIT-StoragePrivacyService-021`)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/storage/storagePrivacyService.test.js --verbose
  ```
- **Mục tiêu kiểm thử**:
  - `TC-001 -> TC-011`: Cơ chế mã hóa AES-256-GCM bảo vệ cookie/proxy credentials; quản lý Master Key; phân lập thư mục người dùng riêng biệt; cơ chế sao lưu và khôi phục dữ liệu mã hóa.
  - `TC-012 -> TC-015 (AC-01 -> AC-04)`: Lưu trữ credentials luôn ở dạng ciphertext kèm IV và Auth Tag; giải mã chính xác với đúng Master Key; xóa profile thực hiện dọn dẹp triệt để không còn tàn dư.
  - `TC-016 -> TC-019 (NAC-01 -> NAC-04)`: Giải mã với Master Key sai bị từ chối ngay lập tức; phát hiện và chặn dữ liệu bị can thiệp/sửa đổi trái phép (Tampered Ciphertext); chặn Path Traversal tấn công thư mục cha (`../`).
  - `TC-020 -> TC-021 (BV-11)`: Kiểm tra độ dài Master Key chuẩn (256-bit / 32 bytes) và kiểm tra dung lượng payload mã hóa.

---

### 3.7. LicensePortalService (`tests/unit/storage/licensePortalService.test.js`)
- **Số lượng test case**: 49 Cases (`TC-UNIT-LicensePortalService-001` đến `TC-UNIT-LicensePortalService-049`)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/storage/licensePortalService.test.js --verbose
  ```
- **Mục tiêu kiểm thử**:
  - `TC-001 -> TC-028`: Đăng nhập/Đăng xuất Portal, OAuth callback, kích hoạt License Key theo Machine ID, gia hạn gói thuê bao, giải quyết quyền hạn gói cước (Entitlements: Free/Pro/Enterprise), thanh toán Webhook, quản trị người dùng, danh sách release phần mềm cho Admin.
  - `TC-029 -> TC-036 (AC-01 -> AC-08)`: License hết hạn tự động chuyển về chế độ hạn chế (Read-Only/Free); mỗi license chỉ kích hoạt đúng số máy tối đa cho phép; tạo phiên đăng nhập an toàn có token JWT.
  - `TC-037 -> TC-044 (NAC-01 -> NAC-08)`: Từ chối License Key giả hoặc sai định dạng; chặn kích hoạt vượt quá số máy cho phép (`MAX_SEATS_EXCEEDED`); chặn user thường truy cập endpoint quản trị Admin (`UNAUTHORIZED_ROLE`).
  - `TC-045 -> TC-049 (BV-12 -> BV-13)`: Kiểm tra biên ngày hết hạn bản quyền, kiểm tra giới hạn số máy kích hoạt (1 đến 100 seats).

---

### 3.8. SessionCookieService (`tests/unit/storage/sessionCookieService.test.js`)
- **Số lượng test case**: 16 Cases (`TC-UNIT-SessionCookieService-001` đến `TC-UNIT-SessionCookieService-016`)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/storage/sessionCookieService.test.js --verbose
  ```
- **Mục tiêu kiểm thử**:
  - `TC-001 -> TC-009`: Xem tóm tắt phiên làm việc, khôi phục danh sách Tab HTTP(S) đã mở, import/export cookie theo chuẩn Netscape/JSON, xóa sạch cookie của profile được chọn mà không ảnh hưởng profile khác.
  - `TC-010 -> TC-012 (AC-01 -> AC-03)`: Đóng và mở lại profile khôi phục chính xác cookie và tab; import cookie mới cập nhật đè cookie trùng name/domain/path và giữ nguyên cookie khác; xóa cookie làm trống context hoàn toàn.
  - `TC-013 -> TC-015 (NAC-01 -> NAC-03)`: Từ chối cookie thiếu các trường bắt buộc (`name`, `value`, `domain`); loại bỏ các tab lỗi (`about:blank`, `chrome-error://`); cơ chế Quarantine tự động cách ly file cookie bị hỏng.
  - `TC-016 (BV-14)`: Kiểm tra giá trị Expiry của cookie (giá trị -1 là Session cookie, timestamp số nguyên dương hợp lệ, chuỗi không phải số bị loại bỏ).

---

### 3.9. TaskSchedulerService (`tests/unit/storage/taskSchedulerService.test.js`)
- **Số lượng test case**: 18 Cases (`TC-UNIT-TaskSchedulerService-001` đến `TC-UNIT-TaskSchedulerService-018`)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/storage/taskSchedulerService.test.js --verbose
  ```
- **Mục tiêu kiểm thử**:
  - `TC-001 -> TC-010`: Xử lý yêu cầu lập lịch qua Local REST API, xóa script tự động vô hiệu hóa các lịch trình liên quan, chạy hàng loạt trên nhiều profile, xem/tìm kiếm lịch sử tác vụ, xem chi tiết lỗi và log, xóa task theo chính sách lưu trữ.
  - `TC-011 -> TC-013 (AC-01 -> AC-03)`: Lịch trình Cron hợp lệ được khôi phục tự động sau khi khởi động lại ứng dụng; thực thi Bulk tạo bản ghi tác vụ độc lập cho từng profile; chạy lại task tạo bản ghi mới mà không ghi đè task cũ.
  - `TC-014 -> TC-017 (NAC-01 -> NAC-04)`: Từ chối biểu thức Cron không hợp lệ; bỏ qua lịch trình gắn với profile không tồn tại; không cho phép task không có nội dung script chuyển sang trạng thái `RUNNING`; không cho phép hủy task đã kết thúc (`COMPLETED`/`FAILED`).
  - `TC-018 (BV-15)`: Kiểm tra giới hạn số lượng trình duyệt chạy đồng thời (Concurrency: min 1, default 5) và nguyên tắc 1 script trên 1 profile tại một thời điểm.

---

### 3.10. MonitoringLogService (`tests/unit/storage/monitoringLogService.test.js`)
- **Số lượng test case**: 25 Cases (`TC-UNIT-MonitoringLogService-001` đến `TC-UNIT-MonitoringLogService-025`)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/storage/monitoringLogService.test.js --verbose
  ```
- **Mục tiêu kiểm thử**:
  - `TC-001 -> TC-016`: Xem danh sách audit log phân trang, tìm kiếm log theo actor/action/severity, xem chi tiết sự kiện và trạng thái toàn vẹn, theo dõi trạng thái runtime, kiểm tra sức khỏe proxy và ghi nhận nhật ký xoay IP.
  - `TC-017 -> TC-020 (AC-01 -> AC-04)`: Tự động ghi nhật ký chẩn đoán khi có sự kiện hệ thống; xuất log kiểm toán thành công khi toàn bộ chuỗi băm (SHA-256 Hash Chain) hợp lệ; Live Preview chỉ stream cho profile được đăng ký; cơ chế Heartbeat dọn dẹp browser mất kết nối.
  - `TC-021 -> TC-023 (NAC-01 -> NAC-03)`: Phát hiện và chỉ rõ số dòng audit log bị sửa đổi trái phép; từ chối đăng ký Live Preview với profile không hợp lệ; cơ chế Backpressure tự động bỏ bớt khung hình (drop frames) khi client xử lý chậm để chống tràn RAM.
  - `TC-024 -> TC-025 (BV-16 & BV-17)`: Kiểm tra chu kỳ Heartbeat (30 giây, ân hạn 20 giây khi khởi động) và ngưỡng bộ đệm preview (giới hạn 128 KB).

---

## 4. HƯỚNG DẪN KIỂM THỬ CƠ CHẾ BẬT/TẮT FINGERPRINT

- **File kiểm thử**: `tests/unit/main/fingerprintSpoofing.test.js`
- **Số lượng test case**: 28 Cases (`TC-01` đến `TC-28`)
- **Nguồn đặc tả**: `HL-MCK_Fake_Fingerprint_BaoCao_v4.xlsx` (Sheet: *3. Test Case Bat-Tat*)
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/main/fingerprintSpoofing.test.js --verbose
  ```
- **Phân loại kịch bản**:
  1. **Nhóm Baseline & Anti-Automation (`TC-01, TC-24`)**: Kiểm chứng `navigator.webdriver = false`, xóa các biến automation (`window.__playwright`, `cdc_*`) ngay cả khi tắt toàn bộ 9 toggle cấu hình.
  2. **Nhóm Danh tính & Mạng (`TC-02, TC-03, TC-21, TC-22, TC-23, TC-28`)**: Đồng bộ User-Agent, Language, Timezone, đồng bộ Header HTTP với JS Console, chế độ bảo vệ WebRTC (Chặn UDP / TURN Relay).
  3. **Nhóm Màn hình & Phần cứng (`TC-04, TC-05, TC-06, TC-07, TC-08`)**: Khóa viewport theo độ phân giải, kiểm tra RAM tối đa 8GB, cơ chế Anti-Tamper chống lộ `defineProperty`.
  4. **Nhóm Đồ họa & Âm thanh (`TC-09 -> TC-16`)**: Nhiễu Canvas 2D, nhiễu WebGL `readPixels`, GPU Renderer giả lập, 2 bộ PRNG độc lập giữa Canvas và WebGL, nhiễu tần số AudioContext.
  5. **Nhóm Thiết bị ngoại vi (`TC-17 -> TC-20`)**: Giả lập thông số Pin (`navigator.getBattery`), danh sách Mic/Webcam/Loa với nhãn rỗng mô phỏng người dùng thật.
  6. **Nhóm Tình huống đặc thù (`TC-25, TC-26, TC-27`)**: Chế độ `Safe Mode` né Cloudflare Enterprise, độc lập Canvas/Audio khi tắt inject fingerprint qua API, tính ngẫu nhiên tách biệt khi nhân bản (Clone) profile.

---

## 5. HƯỚNG DẪN KIỂM THỬ API & WEB ADMIN

Ngoài 11 file kiểm thử nghiệp vụ chính, dự án còn bao gồm các bộ test tích hợp cho API Server và Web Admin Portal:

### 5.1. Kiểm thử Local REST API
- **Thư mục**: `tests/unit/api/`
- **Các file**: `apiBrowser.test.js`, `apiFingerprint.test.js`, `apiHealth.test.js`, `apiLaunchBrowser.test.js`, `apiProfiles.test.js`, `apiProxies.test.js`, `apiScripts.test.js`, `apiTasks.test.js`
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/api/ --verbose
  ```

### 5.2. Kiểm thử Web Admin Portal
- **Thư mục**: `tests/unit/web-admin/`
- **Các file**: `adminApp.test.js`, `adminLicenses.test.js`, `adminUsers.test.js`, `authStore.test.js`, `checkoutEmailBinding.test.js`, `updateFeed.test.js`, `versionManagement.test.js`
- **Lệnh chạy**:
  ```bash
  npx jest tests/unit/web-admin/ --verbose
  ```

---

## 6. QUY CHUẨN ĐÁNH GIÁ PASS/FAIL & BÁO CÁO LỖI

### 6.1. Tiêu chí ĐẠT (PASS)
- 100% test case trong suite chạy thành công (`exit code 0`).
- Không có exception chưa bắt (`UnhandledPromiseRejection`).
- Không có memory leak hoặc open handles treo tiến trình Jest.
- Dữ liệu trả về đúng kiểu (Object/Array/Boolean), đúng mã lỗi nghiệp vụ (ví dụ: `INVALID_CRON`, `AUDIT_INTEGRITY_VIOLATION`, `UNAUTHORIZED_ROLE`).

### 6.2. Hướng dẫn Debug khi Test Fail
1. **Kiểm tra thông báo lỗi Jest**: Jest sẽ in ra chi tiết dòng bị fail, giá trị mong đợi (`Expected`) và giá trị thực tế nhận được (`Received`).
2. **Chạy test đơn lẻ với cờ `--detectOpenHandles`**:
   ```bash
   npx jest tests/unit/storage/profileService.test.js --detectOpenHandles
   ```
3. **Thêm console.log chẩn đoán**: Đặt `console.log(response)` ngay trước câu lệnh `expect(...)` để kiểm tra payload thực tế.
4. **Đối chiếu lại Master Plan**: Mở file `HL-MCK_Report_5_1_UnitTests_L1.xlsm` tương ứng với mã `Test Case ID` để kiểm tra lại điều kiện đầu vào (`Given`), hành động (`When`) và kết quả mong đợi (`Then`).
