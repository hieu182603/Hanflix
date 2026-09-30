# Rà soát luồng Free → Premium — 30/09/2026

## Quyền truy cập theo yêu cầu khách hàng

| Chức năng | Free / hết hạn | Premium 1, 3, 12 tháng |
| --- | --- | --- |
| Video | 5 video mẫu đã xuất bản | Toàn bộ video đã xuất bản |
| Phụ đề Hán – Pinyin – Việt | Có trên video mẫu | Có |
| Tra từ cơ bản trong video | Có, dùng dữ liệu từ vựng của phụ đề | Có |
| Lưu từ, sổ từ vựng, flashcard | Yêu cầu nâng cấp | Có |
| Quiz, bài luyện tập, luyện thi | Yêu cầu nâng cấp | Có |
| AI, đề xuất cá nhân hóa | Yêu cầu nâng cấp | Có |
| Dashboard tiến độ, lịch sử, lộ trình | Yêu cầu nâng cấp | Có |
| Kho ngữ pháp | Yêu cầu nâng cấp | Có |
| Trang giá, lịch sử thanh toán, tiếp tục đơn hàng | Có | Có |

Chọn 5 video mẫu đầu tiên theo `_id` trong các bài đã xuất bản, loại podcast. Bộ lọc `sample=true` dùng đúng cùng tập ID với kiểm tra quyền phát video và phụ đề. Cần có ít nhất 3–5 video phù hợp trong dữ liệu triển khai; bộ kiểm thử không xác minh số video hiện có trên production. Việc ghi hoạt động xem video mẫu và streak cơ bản vẫn được giữ; các màn hình thống kê tiến độ chi tiết yêu cầu Premium. Dữ liệu đã học không bị xóa khi hết hạn.

## Bảng giá

| Gói | Giá mặc định | Quy đổi | Tiết kiệm so với mua từng tháng |
| --- | ---: | ---: | ---: |
| 1 tháng – Cơ bản | 99.000đ | Khoảng 3.300đ/ngày | — |
| 3 tháng – Được yêu thích nhất | 249.000đ | 83.000đ/tháng | 48.000đ (~16%) |
| 1 năm – Tiết kiệm | 699.000đ | 58.250đ/tháng | 489.000đ (~41%) |

Gói 3 tháng có viền, nền, nút và badge nổi bật. Cả ba gói có cùng tám quyền lợi. Giá hiển thị và tạo đơn lấy từ API; giữ khả năng quản trị giá, không tự ghi đè giá đã cấu hình trong database. Cần đối chiếu cấu hình giá đang mở bán khi nghiệm thu production.

## Sai lệch đã sửa

- Trang giá trước đó nhấn mạnh gói năm, chỉ liệt kê năm nhóm quyền lợi và có lời quảng cáo vượt nội dung yêu cầu. Đã hiển thị đúng tám quyền lợi và làm nổi bật gói quý.
- API ngữ pháp, danh mục từ vựng, lưu từ, đường dẫn sổ từ vựng cũ, tiến độ/lịch sử/lộ trình và đề xuất chưa áp dụng Premium đồng đều. Đã bổ sung kiểm tra phía server và màn hình/nút dẫn sang `/premium`.
- Tra từ trên video mẫu gọi API giải thích AI, khiến Free không sử dụng được. Đã hiển thị nghĩa/pinyin cơ bản từ phụ đề; thao tác lưu và luyện tập vẫn yêu cầu nâng cấp.
- Đăng nhập từ trang giá đưa người dùng về feed. Đã giữ đường quay lại Premium, thanh toán và các bước chuyển giữa đăng nhập/đăng ký/quên mật khẩu.
- Khảo sát có thể mở từ thông tin tài khoản cache chưa được xác thực và che thao tác nâng cấp. Đã chờ khôi phục phiên trước khi quyết định mở khảo sát.
- Giao diện có thể giữ nội dung trong cache sau khi hết hạn. Đã tách cache video/phụ đề theo quyền và đóng các tính năng Premium tại thời điểm hết hạn; backend tiếp tục kiểm tra quyền hiện tại từ database.
- Danh mục video công khai không trả lời bài hát và nội dung chương podcast.

## Thanh toán và sau nâng cấp

1. Người dùng chọn gói đang mở bán; chưa đăng nhập thì đăng nhập và quay lại Premium.
2. Tạo đơn theo gói/giá được backend xác thực; gửi lại cùng yêu cầu sử dụng cùng khóa chống trùng.
3. Mở cổng payOS để chuyển khoản. Chỉ quét QR hoặc thêm `status=PAID` vào URL không kích hoạt Premium.
4. Backend kiểm tra chữ ký webhook, đối soát đơn/tổng tiền/trạng thái với payOS; thiếu tiền, đang chờ, hủy hoặc lỗi kết nối không cấp quyền.
5. Khi đã xác nhận đủ tiền, ghi biên nhận và hạn Premium nguyên tử. Thông báo lặp không cộng hạn hai lần; mua thêm nối tiếp hạn đang còn, tài khoản hết hạn tính từ thời điểm xác nhận.
6. Giao diện lấy lại subscription sau thanh toán, khi quay lại tab và định kỳ. Các tính năng mở khóa theo quyền đã xác nhận; hết hạn trở về Free.

## Bổ sung quy tắc HSK

Theo yêu cầu mới, quyền video của học viên Free/Premium chỉ áp dụng cho HSK hiện tại trong hồ sơ. Năm video mẫu được chọn trong HSK này; Premium không mở video khác HSK. Chi tiết và kết quả kiểm thử bổ sung: [hsk-video-access.md](./hsk-video-access.md).

## Kết quả kiểm chứng

- Toàn bộ backend: 403 test đạt trong lần chạy tổng; 21 test có điều kiện môi trường được bỏ qua. Nhóm bổ sung kiểm tra API Premium, bộ lọc video mẫu và playback: 31 test đạt.
- Toàn bộ frontend: 119 test đạt trong lần chạy tổng; sau các chỉnh sửa cuối, 42 test liên quan quyền, thanh toán, AI, phiên đăng nhập, API và ngôn ngữ đạt.
- MongoDB riêng tại máy local: 3 test tích hợp đạt, gồm tạo đơn đồng thời, kích hoạt thủ công lặp, webhook lặp đồng thời với gia hạn. Database test đã được bộ kiểm thử dọn và tiến trình MongoDB tạm đã dừng.
- Playwright Chromium: 8/8 kịch bản đạt, gồm Free → thanh toán → mở khóa → hết hạn, quay lại trang giá sau đăng nhập, khôi phục đơn, cấp gói admin, bảng giá desktop/mobile và phát video mẫu với tra từ cơ bản. Video fixture là clip đen 30 giây để kiểm tra media thực sự nạp được trong trình duyệt.
- Typecheck backend/frontend và build frontend đạt. Build còn cảnh báo kích thước bundle lớn từ cấu trúc hiện có.

Các kiểm thử giả lập payOS, không chuyển tiền thật. Chưa xác nhận giao dịch ngân hàng, webhook công khai, danh mục video hoặc cấu hình giá trên production; chưa triển khai thay đổi.
