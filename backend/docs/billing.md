# Thanh toán Premium và kích hoạt thủ công

## Luồng học viên

- `/premium` lấy giá, gói đang mở bán và quyền lợi từ API. Lỗi tải không dùng giá mặc định để tạo đơn.
- Checkout lưu `Idempotency-Key` theo tài khoản/gói/giá trong phiên trình duyệt. Thử lại hoặc đóng/mở hộp thanh toán tiếp tục cùng yêu cầu chưa hoàn tất.
- Trang payOS cung cấp VietQR thật. QR của một URL không phải mã chuyển khoản ngân hàng.
- `/premium/payment?orderCode=...` tra cứu đơn thuộc tài khoản đang đăng nhập. Các tham số `status`, `cancel`, `code` trên URL không cấp quyền Premium.
- Webhook được SDK xác minh chữ ký; backend đối soát trạng thái và tổng tiền qua payOS trước khi cấp gói. Webhook lặp lại không gia hạn hai lần.
- Ngày hết hạn và biên nhận được cập nhật nguyên tử trên user. Mua thêm cộng tiếp thời gian còn lại, hết hạn thì tính từ khi xác nhận.
- Lịch sử thanh toán dùng được cả với tài khoản Free; bấm mã đơn để mở lại, tiếp tục hoặc đối soát.
- Giao diện cập nhật quyền Premium sau thanh toán, khi quay lại tab hoặc mỗi phút khi tab đang mở. Backend luôn kiểm tra quyền hiện tại trong database.

## Admin kích hoạt gói

Vào **Admin → Người dùng → Chi tiết học viên → Kích hoạt gói Premium**:

1. Chọn gói 1, 3 hoặc 12 tháng từ cấu hình gói.
2. Nhập lý do, bấm **Kích hoạt gói cho người dùng**.
3. Xem hạn mới và mục **Lịch sử kích hoạt thủ công**.

Chỉ admin được gọi API; chỉ cấp cho học viên đang hoạt động. Có thể cấp gói đang tạm ẩn khỏi bảng giá. Gói thủ công cộng tiếp hạn hiện tại, ghi admin/lý do/thời điểm/thời hạn, không tạo đơn payOS và không tăng doanh thu. Gửi lại cùng khóa và cùng nội dung không cấp trùng, kể cả khi đồng thời có thanh toán.

- `POST /api/v1/admin/billing/users/:userId/activate`
  - Header `Idempotency-Key`: UUID, giữ nguyên khi thử lại yêu cầu chưa rõ kết quả.
  - Body: `{ "planCode": "monthly", "reason": "Tặng gói hỗ trợ" }`.
- `GET /api/v1/admin/billing/users/:userId/grants`: hạn hiện tại và 20 lần cấp thủ công gần nhất. Toàn bộ biên nhận vẫn lưu trên user.

## Cấu hình triển khai

- `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`: cấu hình trên backend.
- `APP_PUBLIC_URL`: origin frontend công khai.
- `PAYOS_RETURN_URL` và `PAYOS_CANCEL_URL`: để trống để dùng `/premium/payment` trên `APP_PUBLIC_URL`, hoặc đặt URL HTTPS của trang đó.
- Webhook trong kênh payOS: `https://<backend-host>/api/v1/billing/webhook` (đổi prefix nếu có cấu hình).
- Khởi động backend tạo indexes và gói mặc định; không xóa giá admin đã sửa. Khôi phục mặc định tăng revision để ngăn ghi đè từ form cũ.
- SPA hosting cần trả `index.html` cho đường dẫn `/premium/payment` khi truy cập trực tiếp.

Tài liệu giao thức: [API payOS](https://payos.vn/docs/api/), [Return URL](https://payos.vn/docs/du-lieu-tra-ve/return-url/).

## Kiểm thử

Backend:

```powershell
npm test -- src/services/billing.test.ts src/services/admin-premium.test.ts src/routes/billing.routes.test.ts
```

MongoDB thật, chỉ chạy với server kiểm thử local. Bộ kiểm thử tự tạo database tên riêng và xóa database đó khi kết thúc; không dùng database ứng dụng:

```powershell
$env:BILLING_TEST_MONGODB_URI = 'mongodb://127.0.0.1:27029'
npm test -- src/services/billing.integration.test.ts
```

Frontend:

```powershell
npm test
npx playwright test e2e/billing-flow.spec.ts --workers=1
npm run typecheck
npm run build
```

Các test tự động giả lập phản hồi payOS; kiểm thử MongoDB dùng các thao tác ghi và unique indexes thật. Chúng không tạo giao dịch ngân hàng hoặc xác nhận webhook công khai trên môi trường triển khai.

### Lịch sử thanh toán của học viên

`GET /billing/orders` nhận `page`, `limit`, `status` (`ALL`, `PAID`, `PENDING`, `OTHER`) và `search` (tối đa 100 ký tự). Tìm kiếm theo tên gói hoặc một phần mã đơn, hỗ trợ tiền tố `#`; ký tự regex được coi là văn bản thông thường. Bộ lọc áp dụng trước khi phân trang, `total` là số đơn khớp bộ lọc.

Phản hồi có thêm `summary`: `totalOrders`, `paidOrders`, `pendingOrders`, `otherOrders`, `totalSpent`. Các số này luôn tính trên toàn bộ lịch sử của tài khoản đã đăng nhập, không phụ thuộc trang hay từ khóa. `totalSpent` chỉ cộng đơn `PAID`; nhóm chờ gồm `CREATING`, `PENDING`, `PROCESSING`. Nhóm khác chứa các trạng thái còn lại, bao gồm `UNDERPAID`.
