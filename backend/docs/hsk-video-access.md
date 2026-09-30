# Nghiệm thu quyền xem video theo HSK

Yêu cầu: “HSK nào thì chỉ được xem video của HSK đấy”.

## Quy tắc đã triển khai

- Cấp được phép xem lấy từ `learningProfile.currentHsk` trong database ở mỗi yêu cầu đã đăng nhập. Không lấy từ query URL, HSK mục tiêu hoặc thông tin tự khai trong token.
- Khớp chính xác: học viên HSK 3 chỉ xem video HSK 3; HSK 1, 2 và 4–9 đều bị chặn. Áp dụng cho cả Free và Premium.
- Free được xem tối đa 5 video mẫu đã xuất bản thuộc HSK hiện tại. Premium xem toàn bộ video đã xuất bản thuộc HSK hiện tại. Cần có đủ video mẫu trong từng HSK để đáp ứng số lượng mẫu mong muốn; code không tạo nội dung giả.
- Chưa có HSK hợp lệ: yêu cầu cập nhật hồ sơ, không tự cấp HSK 3. HSK hợp lệ nằm trong khoảng 1–9.
- Lộ trình, gợi ý thường/AI, danh sách bài học và mục tiếp tục học dùng cùng cấp hiện tại. Hoàn thành chặng không tự mở video cấp kế tiếp. Giữ lịch sử và tiến độ cũ.
- Truy cập trực tiếp video, phụ đề, chương podcast, quiz, tiến độ và ngữ cảnh AI của bài khác HSK bị kiểm tra phía server.
- Sai HSK trả `403 HSK_LEVEL_MISMATCH`; thiếu hồ sơ trả `403 HSK_PROFILE_REQUIRED`. Giao diện giải thích và dẫn đến video đúng HSK/cập nhật hồ sơ. Nâng cấp Premium không giải quyết lỗi sai HSK.
- Sau khi lưu hồ sơ thành công, giao diện lấy lại hồ sơ từ server, đổi khóa cache và gỡ video không còn phù hợp. Mỗi lần mở trang xem đều xác thực lại quyền trước khi gắn player. Không lưu dữ liệu video/phụ đề/quiz vào cache lâu dài của trình duyệt.

## Phạm vi và cách diễn giải

HSK ở đây là **HSK hiện tại của hồ sơ**, không phải gói HSK đã mua: hệ thống hiện có ba gói Premium khác thời hạn, không có quyền mua theo HSK. Học viên vẫn được đổi HSK qua khảo sát/cài đặt hiện có; sau khi lưu, quyền áp dụng theo cấp mới. Nếu khách muốn HSK chỉ do quản trị viên hoặc bài kiểm tra cấp, cần quy tắc nghiệp vụ riêng cho việc đổi hồ sơ.

Admin giữ quyền xem trước mọi cấp để quản lý nội dung. Khách chưa đăng nhập giữ luồng video mẫu công khai hiện có vì chưa có hồ sơ HSK.

Kiểm tra quyền chặn API cấp dữ liệu/URL phát mới. URL ký của kho lưu trữ đã cấp trước đó vẫn chịu thời hạn hiệu lực của kho, không bị thu hồi tức thì bởi thay đổi hồ sơ.

## Kiểm chứng local

- Backend: lần chạy toàn bộ có 430 test đạt, 21 test cần điều kiện môi trường bị bỏ qua. Sau bổ sung ca hoàn thành lộ trình, nhóm HSK/lộ trình có 29 test đạt.
- Frontend: 128 test đạt.
- Typecheck backend/frontend và build frontend đạt. Build còn cảnh báo bundle lớn và chú thích trong thư viện Zod.
- Playwright Chromium: 12/12 kịch bản đạt (4 HSK, 8 hồi quy Free/Premium/thanh toán). Bao gồm đổi query HSK, xem đúng/sai HSK với Free và Premium, đổi HSK khi video đang mở, tải lại trang sau khi video bị đổi HSK.
- API trong kiểm thử dùng dữ liệu giả lập; video fixture thực được nạp trong trình duyệt. Chưa nghiệm thu danh mục nội dung hoặc tài khoản trên production; chưa triển khai.

## Checklist dữ liệu khi nghiệm thu

1. Tài khoản học viên có `currentHsk` hợp lệ và video đã xuất bản có HSK đúng.
2. Mỗi HSK phục vụ Free có 3–5 video mẫu phù hợp (bộ chọn lấy tối đa 5 video thường, không lấy podcast).
3. Dùng tài khoản Free/Premium cùng HSK để kiểm tra danh sách, URL trực tiếp và thông báo sai cấp.
4. Đổi HSK qua hồ sơ, xác nhận video cấp cũ bị chặn và danh sách chuyển sang cấp mới.
