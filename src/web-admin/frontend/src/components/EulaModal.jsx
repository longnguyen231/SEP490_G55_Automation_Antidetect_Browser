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
    title: '1. Phạm vi sử dụng',
    body: `Phần mềm HL-MCK Antidetect Browser ("Phần mềm") được cấp phép sử dụng cho cá nhân hoặc tổ chức ("Người dùng") theo các điều khoản trong thỏa thuận này. Người dùng được phép cài đặt và sử dụng Phần mềm trên thiết bị đã đăng ký license. Mọi hình thức sao chép, phân phối lại hoặc bán lại Phần mềm mà không có sự cho phép bằng văn bản của nhóm phát triển đều bị nghiêm cấm.`,
  },
  {
    title: '2. Mục đích sử dụng hợp pháp',
    body: `Phần mềm này được thiết kế cho các mục đích kiểm thử bảo mật hợp pháp, quản lý tài khoản đa nền tảng, nghiên cứu và phát triển. Người dùng cam kết không sử dụng Phần mềm để:\n• Gian lận, lừa đảo hoặc thực hiện hành vi vi phạm pháp luật\n• Vượt qua các biện pháp bảo mật của hệ thống mà không được phép\n• Thu thập dữ liệu cá nhân trái phép\n• Tấn công hoặc làm gián đoạn dịch vụ của bên thứ ba\n• Vi phạm điều khoản dịch vụ của các nền tảng trực tuyến`,
  },
  {
    title: '3. Chính sách đạo đức (Ethics Policy)',
    body: `Người dùng đồng ý tuân thủ các nguyên tắc đạo đức khi sử dụng công nghệ antidetect:\n• Chỉ sử dụng trên các tài khoản thuộc sở hữu hợp pháp của mình\n• Không sử dụng để tạo hoặc vận hành các mạng lưới tài khoản giả mạo (bot farms)\n• Không sử dụng vào mục đích spam, phishing hoặc phát tán mã độc\n• Tôn trọng quyền riêng tư và dữ liệu của người khác\n• Báo cáo các lỗ hổng bảo mật phát hiện được cho nhóm phát triển thay vì khai thác`,
  },
  {
    title: '4. Quyền sở hữu trí tuệ',
    body: `Toàn bộ mã nguồn, giao diện, tài liệu và các thành phần của Phần mềm là tài sản trí tuệ của nhóm phát triển SEP490 Group 55. Người dùng không có quyền dịch ngược (reverse engineer), decompile, hay tạo ra các sản phẩm phái sinh từ Phần mềm mà không có sự cho phép bằng văn bản.`,
  },
  {
    title: '5. Dữ liệu và quyền riêng tư',
    body: `Phần mềm lưu trữ dữ liệu profile, cookie và cấu hình cục bộ trên máy tính của Người dùng. Nhóm phát triển không thu thập hay truyền dữ liệu cá nhân của Người dùng lên máy chủ ngoại trừ các thông tin kỹ thuật cần thiết cho việc xác thực license (Machine Code). Người dùng hoàn toàn chịu trách nhiệm bảo mật dữ liệu lưu trữ cục bộ trên thiết bị của mình.`,
  },
  {
    title: '6. Giới hạn trách nhiệm',
    body: `Phần mềm được cung cấp "nguyên trạng" (as-is). Nhóm phát triển không chịu trách nhiệm về bất kỳ thiệt hại trực tiếp, gián tiếp, ngẫu nhiên hoặc hậu quả nào phát sinh từ việc sử dụng hoặc không thể sử dụng Phần mềm, bao gồm nhưng không giới hạn ở việc mất dữ liệu, gián đoạn kinh doanh, hoặc thiệt hại do vi phạm điều khoản sử dụng của bên thứ ba.`,
  },
  {
    title: '7. Chấm dứt thỏa thuận',
    body: `Thỏa thuận này có hiệu lực từ thời điểm Người dùng tải xuống hoặc cài đặt Phần mềm. Nhóm phát triển có quyền chấm dứt thỏa thuận và thu hồi license nếu phát hiện Người dùng vi phạm bất kỳ điều khoản nào trong thỏa thuận này mà không cần thông báo trước.`,
  },
  {
    title: '8. Thay đổi điều khoản',
    body: `Nhóm phát triển có quyền cập nhật thỏa thuận này theo thời gian. Phiên bản mới nhất luôn được công bố tại trang web chính thức. Việc tiếp tục sử dụng Phần mềm sau khi thay đổi được công bố đồng nghĩa với việc Người dùng chấp nhận các điều khoản mới.`,
  },
];

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   onAgree?: () => void   — nếu có → hiện nút "Đồng ý & Tải xuống"
 *   downloadLabel?: string — nhãn nút, vd "Windows Installer"
 *   readOnly?: boolean     — chỉ đọc, không có nút agree (mặc định false)
 */
export default function EulaModal({ isOpen, onClose, onAgree, downloadLabel, readOnly = false }) {
  const bodyRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [checked, setChecked] = useState(false);

  // Reset khi mở lại
  useEffect(() => {
    if (isOpen) {
      setScrolled(false);
      setChecked(false);
      // Scroll body về đầu
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // Theo dõi scroll để unlock nút agree
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

  // Đóng khi click backdrop
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Đóng khi Escape
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
              Điều khoản sử dụng (EULA)
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
            <p className="text-xs text-amber-400">Vui lòng đọc đến cuối để kích hoạt nút đồng ý</p>
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
            Bằng cách tải xuống và cài đặt Phần mềm, bạn xác nhận đã đọc, hiểu và đồng ý với toàn bộ các điều khoản dưới đây.
            Nếu không đồng ý, vui lòng không tải xuống hoặc sử dụng Phần mềm.
          </p>

          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h3 className="text-sm font-semibold text-white mb-1.5">{s.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-line">{s.body}</p>
            </div>
          ))}

          <p className="text-slate-600 text-xs pt-2 border-t border-slate-800">
            © 2026 SEP490 Group 55 · HL-MCK Antidetect Browser · Mọi quyền được bảo lưu.
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
                Tôi đã đọc và đồng ý với toàn bộ Điều khoản sử dụng và Chính sách đạo đức của HL-MCK Antidetect Browser
              </span>
            </label>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-700/60 text-slate-400 text-sm font-medium hover:border-slate-600 hover:text-slate-300 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAgree}
                disabled={!canAgree}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-background-dark text-sm font-bold
                  hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Đồng ý &amp; Tải {downloadLabel || 'xuống'}
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
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
