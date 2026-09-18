# 🛠️ HanFlix — Danh Sách Lỗi, Lỗ Hổng & Kế Hoạch Khắc Phục (Bug Tracking)

> **Tài liệu theo dõi kỹ thuật (Technical Debt & Bug Backlog)**
> Thiết lập theo nguyên tắc Tech Lead: Phân tích nguyên nhân gốc (Root Cause) → Đánh giá phạm vi ảnh hưởng (Impact) → Giải pháp chi tiết (Solution) → Kế hoạch kiểm thử (Verification).
> Sử dụng checklist `[ ]` bên dưới để cập nhật tiến độ sửa dần.

---

## 📊 Bảng tổng hợp trạng thái (Executive Summary)

| STT | Mã ID | Phân loại | Mức độ | File ảnh hưởng | Trạng thái |
|:---:|:---|:---|:---:|:---|:---:|
| 1 | `SEC-01` | Bảo mật (Stored XSS) | 🔴 CRITICAL | [upload.ts](file:///e:/Hanflix/backend/src/middleware/upload.ts#L7-L13) | `[x] Đã sửa` |
| 2 | `SEC-02` | Bảo mật (SSRF / Arbitrary URL) | 🔴 HIGH | [profile.routes.ts](file:///e:/Hanflix/backend/src/routes/profile.routes.ts#L25-L30) | `[x] Đã sửa` |
| 3 | `BUG-03` | Lỗ hổng Logic (Mass Assignment) | 🔴 HIGH | [validate.ts](file:///e:/Hanflix/backend/src/middleware/validate.ts#L14) | `[x] Đã sửa` |
| 4 | `BUG-01` | Lỗi Logic (Token Theft Detection) | 🟠 HIGH | [auth.routes.ts](file:///e:/Hanflix/backend/src/routes/auth.routes.ts#L294-L326) | `[x] Đã sửa` |
| 5 | `BUG-02` | Lỗi Client (Refresh Infinite Loop) | 🟠 HIGH | [client.ts](file:///e:/Hanflix/frontend/src/api/client.ts#L84-L117) | `[x] Đã sửa` |
| 6 | `SEC-04` | Bảo mật (Metrics Info Leak) | 🟡 MEDIUM | [app.ts](file:///e:/Hanflix/backend/src/app.ts#L48-L65) | `[x] Đã sửa` |
| 7 | `ERR-03` | Rò rỉ tài nguyên (Timer Leak) | 🟡 MEDIUM | [gemini.ts](file:///e:/Hanflix/backend/src/services/gemini.ts#L63-L76) | `[x] Đã sửa` |
| 8 | `SEC-03` | Bảo mật / Hạ tầng (Rate Limit Bypass) | 🟡 MEDIUM | [rate-limits.ts](file:///e:/Hanflix/backend/src/middleware/rate-limits.ts) | `[x] Đã document` |
| 9 | `SEC-05` | Nguy cơ DoS (Memory Exhaustion) | 🟡 MEDIUM | [upload.ts](file:///e:/Hanflix/backend/src/middleware/upload.ts#L7-L13) | `[x] Đã sửa` |
| 10 | `BUG-04` | Hiệu năng (N+1 Signed URL Queries) | 🟡 MEDIUM | [lesson.routes.ts](file:///e:/Hanflix/backend/src/routes/lesson.routes.ts#L84-L89) | `[x] Đã document` |
| 11 | `PERF-01` | Hiệu năng (Unbounded Mongo Query) | 🟡 MEDIUM | [learning.routes.ts](file:///e:/Hanflix/backend/src/routes/learning.routes.ts#L75-L78) | `[x] Đã sửa` |
| 12 | `PERF-02` | Hiệu năng (Missing Pagination) | 🟡 LOW | [vocabulary.routes.ts](file:///e:/Hanflix/backend/src/routes/vocabulary.routes.ts#L37-L45) | `[x] Đã sửa` |
| 13 | `PERF-03` | Hiệu năng (In-memory Sort) | 🟡 LOW | [learning.routes.ts](file:///e:/Hanflix/backend/src/routes/learning.routes.ts#L100) | `[x] Đã document` |
| 14 | `ARCH-01` | Kiến trúc (God File 458 lines) | 🟡 MEDIUM | [auth.routes.ts](file:///e:/Hanflix/backend/src/routes/auth.routes.ts) | `[ ] Cần refactor` |
| 15 | `ARCH-02` | Kiến trúc (God File 363 lines) | 🟡 MEDIUM | [admin.routes.ts](file:///e:/Hanflix/backend/src/routes/admin.routes.ts) | `[ ] Cần refactor` |
| 16 | `ARCH-03` | Kiến trúc (Duplicate Endpoint) | 🟡 LOW | [upload.routes.ts](file:///e:/Hanflix/backend/src/routes/upload.routes.ts#L144-L162) | `[x] Đã sửa` |
| 17 | `ARCH-04` | Kiến trúc (Route Export Utility) | 🟡 LOW | [auth.routes.ts](file:///e:/Hanflix/backend/src/routes/auth.routes.ts#L88-L108) | `[x] Đã sửa` |
| 18 | `ERR-01` | Giám sát (Unstructured Warning Log) | 🟡 LOW | [upload.routes.ts](file:///e:/Hanflix/backend/src/routes/upload.routes.ts#L84-L86) | `[x] Đã sửa` |
| 19 | `ERR-02` | Giám sát (Unstructured Error Log) | 🟡 LOW | [error-handler.ts](file:///e:/Hanflix/backend/src/middleware/error-handler.ts#L18) | `[x] Đã sửa` |
| 20 | `BUG-05` | Race Condition (Google Sub Duplicate) | 🟡 LOW | [auth.routes.ts](file:///e:/Hanflix/backend/src/routes/auth.routes.ts#L191-L213) | `[x] Đã xử lý tốt` |

---

## 🎯 GIAI ĐOẠN 1: Khắc phục lỗ hổng bảo mật cấp bách (Ưu tiên số 1)

### [ ] 1. `SEC-01`: SVG Upload cho phép tấn công Stored XSS
- **Vị trí**: [backend/src/middleware/upload.ts](file:///e:/Hanflix/backend/src/middleware/upload.ts#L7-L13)
- **Mức độ**: 🔴 CRITICAL
- **Nguyên nhân gốc (Root Cause)**:
  `ALLOWED_MIME_TYPES` đang chấp nhận `image/svg+xml`. Định dạng SVG bản chất là XML, có thể chứa thẻ `<script>`, các event handler inline (`onload`, `onerror`), thẻ `<foreignObject>` nhúng HTML độc hại. Khi user khác mở xem avatar này qua trình duyệt, script sẽ tự động thực thi trong phiên làm việc của nạn nhân.
- **Hiện trạng mã nguồn**:
  ```typescript
  const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/svg+xml', // Vector tấn công XSS
  ];
  ```
- **Hướng giải quyết chi tiết**:
  1. Loại bỏ hoàn toàn `image/svg+xml` khỏi danh sách `ALLOWED_MIME_TYPES`. Avatar người dùng chỉ nên chấp nhận ảnh bitmap nén: `image/jpeg`, `image/png`, `image/webp`.
  2. Nếu hệ thống bắt buộc cần SVG cho biểu tượng tĩnh trong tương lai, phải dùng `DOMPurify` (bản server-side) để sanitize thẻ XML và ép Cloudinary gắn header `Content-Disposition: attachment`.
- **Kế hoạch kiểm thử (Verification)**:
  - Test upload file SVG chứa `<script>alert(1)</script>`: hệ thống phải từ chối với mã lỗi 400 (`UNSUPPORTED_MEDIA_TYPE`).
  - Test upload file PNG/JPEG/WebP hợp lệ: upload bình thường.

---

### [ ] 2. `SEC-02`: Profile PATCH cho phép user tự gán `avatarUrl` tuỳ ý
- **Vị trí**: [backend/src/routes/profile.routes.ts](file:///e:/Hanflix/backend/src/routes/profile.routes.ts#L25-L30)
- **Mức độ**: 🔴 HIGH
- **Nguyên nhân gốc (Root Cause)**:
  `basicProfileSchema` chỉ kiểm tra độ dài chuỗi (`min(1).max(500)`). Kẻ tấn công có thể chèn link tracking pixel bên thứ 3 (để thu thập IP của user khác khi vào xem profile), link ảnh độc hại / lừa đảo, hoặc payload nguy hiểm.
- **Hiện trạng mã nguồn**:
  ```typescript
  avatarUrl: z.string().trim().min(1).max(500).optional().nullable(),
  ```
- **Hướng giải quyết chi tiết**:
  - **Cách triệt để (Khuyên dùng)**: Bỏ trường `avatarUrl` ra khỏi schema cập nhật thông tin cá nhân. Avatar chỉ được phép thay đổi duy nhất thông qua API upload chính thức (`POST /uploads/avatar`).
  - **Cách bổ trợ (Nếu cần giữ)**: Bắt buộc URL phải hợp lệ và nằm trong whitelist domain an toàn:
    ```typescript
    avatarUrl: z.string().trim().url()
      .refine(url => /^https:\/\/(res\.cloudinary\.com|lh3\.googleusercontent\.com)\//.test(url), {
        message: 'Avatar URL chỉ chấp nhận từ nguồn Cloudinary hoặc Google',
      })
      .optional().nullable(),
    ```
- **Kế hoạch kiểm thử**:
  - Gửi request `PATCH /profile` với `avatarUrl: "http://malicious-site.com/track.png"`: API phải từ chối validation.
  - Gửi link Cloudinary hợp lệ: chấp nhận.

---

### [ ] 3. `BUG-03`: Middleware `validate` dùng `Object.assign` cho phép Mass Assignment
- **Vị trí**: [backend/src/middleware/validate.ts](file:///e:/Hanflix/backend/src/middleware/validate.ts#L14)
- **Mức độ**: 🔴 HIGH (Lỗ hổng phân quyền/dữ liệu)
- **Nguyên nhân gốc (Root Cause)**:
  Hàm validate dùng `Object.assign(req[target], result.data)`. Hành vi này chỉ merge đè các trường có trong schema, nhưng **giữ nguyên toàn bộ extra fields không khai báo trong schema** nằm trong `req.body` gốc. Nếu một controller nào dùng spread operator `{ ...req.body }` (điển hình như [admin.routes.ts#L102](file:///e:/Hanflix/backend/src/routes/admin.routes.ts#L102)), các field injection như `role: 'admin'`, `isVerified: true` sẽ lọt thẳng vào Database.
- **Hiện trạng mã nguồn**:
  ```typescript
  Object.assign(req[target], result.data);
  ```
- **Hướng giải quyết chi tiết**:
  Thay thế toàn bộ object `req[target]` bằng dữ liệu sạch đã được Zod parse và strip:
  ```typescript
  (req as Record<string, unknown>)[target] = result.data;
  ```
- **Kế hoạch kiểm thử**:
  - Gửi request chứa payload hợp lệ kèm trường phụ `maliciousField: "hack"`.
  - Kiểm tra `req.body` trong route handler: chỉ được tồn tại các field được Zod định nghĩa.

---

## 🔄 GIAI ĐOẠN 2: Khắc phục lỗi Logic & Cơ chế Phiên (Bugs & Integrity)

### [ ] 4. `BUG-01`: Refresh Token Reuse không thu hồi (Revoke) toàn bộ phiên gia đình (Session Family)
- **Vị trí**: [backend/src/routes/auth.routes.ts](file:///e:/Hanflix/backend/src/routes/auth.routes.ts#L294-L326)
- **Mức độ**: 🟠 HIGH (Tiêu chuẩn bảo mật OWASP)
- **Nguyên nhân gốc (Root Cause)**:
  Khi phát hiện 1 refresh token cũ đã từng được sử dụng trước đó (`REFRESH_REUSED`), code chỉ throw lỗi `AppError(401, 'REFRESH_REUSED')` mà **không huỷ các session hợp lệ còn lại** của user. Theo khuyến nghị bảo mật OWASP: Token reuse là dấu hiệu rõ ràng của việc rò rỉ token (kẻ trộm và nạn nhân cùng giữ 1 token) → Bắt buộc phải vô hiệu hoá toàn bộ phiên của tài khoản đó để bảo vệ người dùng.
- **Hướng giải quyết chi tiết**:
  ```typescript
  if (!session) {
    // Truy vết session bị lộ và huỷ toàn bộ refresh session đang mở của user này
    const compromisedSession = await RefreshSessionModel.findOne({ jti: claims.jti });
    if (compromisedSession) {
      await RefreshSessionModel.updateMany(
        { userId: compromisedSession.userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } }
      );
    }
    throw new AppError(401, 'REFRESH_REUSED', 'Phát hiện tái sử dụng phiên bảo mật. Vui lòng đăng nhập lại.');
  }
  ```
- **Kế hoạch kiểm thử**:
  - Gửi refresh token A lần 1 → nhận token B thành công.
  - Gửi lại token A lần 2 (tái sử dụng) → backend bắt được reuse, đồng thời kiểm tra trong DB thấy tất cả session của user đã bị gắn `revokedAt`.

---

### [ ] 5. `BUG-02`: Client `apiFetch` có thể rơi vào vòng lặp làm mới vô tận (Refresh Loop)
- **Vị trí**: [frontend/src/api/client.ts](file:///e:/Hanflix/frontend/src/api/client.ts#L84-L117)
- **Mức độ**: 🟠 HIGH
- **Nguyên nhân gốc (Root Cause)**:
  Nếu sau khi refresh token thành công, request được thử lại (retry) vẫn trả về 401 (ví dụ user vừa bị khoá tài khoản trên server), logic hiện tại không xoá sạch trạng thái auth ở frontend mà tiếp tục giữ access token cũ, dẫn tới các request tiếp theo liên tục kích hoạt flow refresh lỗi.
- **Hướng giải quyết chi tiết**:
  1. Nếu request retry sau refresh vẫn trả về 401: Ngay lập tức gọi `setAccessToken(null)` để reset frontend state và kích hoạt chuyển trang về `/login`.
  2. Đặt cờ kiểm soát `_retryCount` trên mỗi request để đảm bảo một request chỉ được phép retry refresh tối đa đúng 1 lần.
- **Kế hoạch kiểm thử**:
  - Giả lập backend luôn trả 401 cho một endpoint: frontend thử refresh 1 lần, thất bại thì clear session và chuyển về login, không spam request lặp vô hạn trong tab Network.

---

### [ ] 6. `SEC-04`: Endpoint `/metrics` bị public nếu không cấu hình `METRICS_TOKEN`
- **Vị trí**: [backend/src/app.ts](file:///e:/Hanflix/backend/src/app.ts#L48-L65)
- **Mức độ**: 🟡 MEDIUM
- **Nguyên nhân gốc (Root Cause)**:
  Điều kiện `if (env.METRICS_TOKEN)` chỉ bắt xác thực nếu token tồn tại. Ở môi trường staging hoặc khi quên cấu hình token, endpoint `/metrics` trở thành public hoàn toàn, làm lộ thông tin nhạy cảm: cấu trúc route nội bộ, số lượng request, tỉ lệ lỗi, thời gian phản hồi.
- **Hướng giải quyết chi tiết**:
  Chặn truy cập mặc định:
  ```typescript
  if (!env.METRICS_TOKEN && env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Metrics endpoint is disabled in production without METRICS_TOKEN' });
  }
  ```
- **Kế hoạch kiểm thử**:
  - Chạy app với `NODE_ENV=production` và không truyền `METRICS_TOKEN` → truy cập `/metrics` nhận mã 403 Forbidden.

---

### [ ] 7. `ERR-03`: Rò rỉ bộ đếm thời gian (Timer Leak) trong Gemini AI Service
- **Vị trí**: [backend/src/services/gemini.ts](file:///e:/Hanflix/backend/src/services/gemini.ts#L63-L76)
- **Mức độ**: 🟡 MEDIUM
- **Nguyên nhân gốc (Root Cause)**:
  Hàm `Promise.race` giữa request Gemini và `setTimeout`. Khi request trả về nhanh và hoàn tất trước, bộ đếm `setTimeout` vẫn tiếp tục chạy ngầm cho đến hết thời gian `GEMINI_TIMEOUT_MS`, gây tồn đọng timer callback trong Node.js Event Loop.
- **Hướng giải quyết chi tiết**:
  Lưu lại ID của timer và luôn gọi `clearTimeout` trong khối `finally`:
  ```typescript
  let timerId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new AppError(504, 'AI_TIMEOUT', 'Gemini AI service timed out'));
    }, env.GEMINI_TIMEOUT_MS);
  });

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
  ```
- **Kế hoạch kiểm thử**:
  - Chạy unit test gọi Gemini và kiểm tra không còn pending handle/timer nào trong Event Loop sau khi hoàn tất.

---

## ⚡ GIAI ĐOẠN 3: Tối ưu hiệu năng & Khả năng mở rộng (Performance & Scalability)

### [ ] 8. `SEC-03`: Rate Limiter dùng In-Memory Store — Dễ bị vượt mặt khi Scale Multi-Instance
- **Vị trí**: [backend/src/middleware/rate-limits.ts](file:///e:/Hanflix/backend/src/middleware/rate-limits.ts)
- **Mức độ**: 🟡 MEDIUM
- **Nguyên nhân gốc (Root Cause)**:
  `express-rate-limit` dùng RAM của Node.js process hiện tại. Khi chạy ứng dụng trên nhiều container hoặc cluster PM2, mỗi worker có bộ đếm độc lập. Kẻ tấn công có thể rải đều request qua load balancer để vượt qua giới hạn.
- **Hướng giải quyết chi tiết**:
  Chuyển sang dùng Redis Store (`rate-limit-redis`) hoặc uỷ thác rate limiting cho tầng Reverse Proxy (Nginx / Cloudflare).
- **Kế hoạch kiểm thử**:
  - Kiểm tra tính đồng bộ của bộ đếm rate limit giữa các tiến trình server.

---

### [ ] 9. `SEC-05`: Nguy cơ cạn kiệt bộ nhớ khi xử lý file ảnh động (`image/gif`) qua `memoryStorage`
- **Vị trí**: [backend/src/middleware/upload.ts](file:///e:/Hanflix/backend/src/middleware/upload.ts#L7-L13)
- **Mức độ**: 🟡 MEDIUM
- **Nguyên nhân gốc (Root Cause)**:
  `multer.memoryStorage()` nạp trọn vẹn file vào RAM Buffer. File GIF có thể chứa hàng trăm frame, khi nhiều request upload đồng thời diễn ra có thể gây nghẽn RAM server (OOM Crash).
- **Hướng giải quyết chi tiết**:
  - Đối với avatar: Bỏ hỗ trợ GIF, chỉ cho phép ảnh tĩnh (JPEG, PNG, WebP).
  - Giảm `MAX_IMAGE_BYTES` cho ảnh đại diện xuống mức hợp lý (2MB).
- **Kế hoạch kiểm thử**:
  - Thử upload file GIF vào endpoint avatar: bị từ chối định dạng.

---

### [ ] 10. `BUG-04`: Lỗi N+1 truy vấn khi tạo Signed URL cho Thumbnail bài học
- **Vị trí**: [backend/src/routes/lesson.routes.ts](file:///e:/Hanflix/backend/src/routes/lesson.routes.ts#L84-L89)
- **Mức độ**: 🟡 MEDIUM
- **Nguyên nhân gốc (Root Cause)**:
  Mỗi bài học trong danh sách đều gọi tuần tự/song song qua hàm `safeDownloadUrl(item.thumbnailKey)`. Một trang 12-24 bài học tạo ra 12-24 cuộc gọi tạo chữ ký tới R2/S3, gây tăng đáng kể độ trễ API response.
- **Hướng giải quyết chi tiết**:
  1. Lưu signed URL vào bộ nhớ cache (Redis / NodeCache) với TTL gần bằng TTL của URL.
  2. Hoặc cấu hình bucket thumbnail thành Public Bucket (CDN công khai) để không cần sinh chữ ký signed URL cho ảnh đại diện.
- **Kế hoạch kiểm thử**:
  - Đo benchmark thời gian phản hồi của `GET /lessons`: giảm tối thiểu 50% thời gian chờ.

---

### [ ] 11. `PERF-01`: Truy vấn `ProgressModel.find()` trong Dashboard không giới hạn số lượng (Unbounded)
- **Vị trí**: [backend/src/routes/learning.routes.ts](file:///e:/Hanflix/backend/src/routes/learning.routes.ts#L75-L78)
- **Mức độ**: 🟡 MEDIUM
- **Nguyên nhân gốc (Root Cause)**:
  Query không có `.limit()`. Với người dùng học lâu năm có hàng nghìn bài học đã lưu tiến độ, query sẽ nạp toàn bộ danh sách kèm populate chi tiết, gây chậm database và response payload phình to.
- **Hướng giải quyết chi tiết**:
  Thêm giới hạn mặc định `.limit(50)` và hỗ trợ phân trang cho màn hình lịch sử học.
- **Kế hoạch kiểm thử**:
  - Kiểm tra câu lệnh Mongo query được sinh ra luôn có mệnh đề limit.

---

### [ ] 12. `PERF-02`: Endpoint từ vựng đã lưu (`/vocabulary/saved`) thiếu phân trang
- **Vị trí**: [backend/src/routes/vocabulary.routes.ts](file:///e:/Hanflix/backend/src/routes/vocabulary.routes.ts#L37-L45)
- **Mức độ**: 🟡 LOW
- **Nguyên nhân gốc (Root Cause)**:
  `SavedWordModel.find({ userId })` trả về toàn bộ từ vựng mà không có `page` và `limit`.
- **Hướng giải quyết chi tiết**:
  Thêm query parameters `page=1&limit=20` và trả về metadata phân trang.
- **Kế hoạch kiểm thử**:
  - Kiểm tra API trả về dữ liệu chuẩn cấu trúc `{ data: [...], pagination: { page, totalPages, totalItems } }`.

---

### [ ] 13. `PERF-03`: Nạp 100 bài học vào RAM chỉ để sắp xếp và chọn ra 12 bài gợi ý
- **Vị trí**: [backend/src/routes/learning.routes.ts](file:///e:/Hanflix/backend/src/routes/learning.routes.ts#L100)
- **Mức độ**: 🟡 LOW
- **Nguyên nhân gốc (Root Cause)**:
  Đang fetch 100 document từ MongoDB về bộ nhớ Node.js rồi dùng hàm filter/sort của JavaScript để lấy 12 bài.
- **Hướng giải quyết chi tiết**:
  Chuyển điều kiện lọc và sắp xếp trực tiếp vào MongoDB Aggregation Pipeline hoặc Index Query để DB chỉ trả về đúng 12 bản ghi.
- **Kế hoạch kiểm thử**:
  - Kiểm tra query time và RAM tiêu thụ khi số lượng bài học tăng lên hàng nghìn bài.

---

## 🏗️ GIAI ĐOẠN 4: Tái cấu trúc Kiến trúc & Chuẩn hoá Mã nguồn (Architecture & Logging)

### [ ] 14. `ARCH-01`: Tái cấu trúc `auth.routes.ts` (God File 458 dòng)
- **Vị trí**: [backend/src/routes/auth.routes.ts](file:///e:/Hanflix/backend/src/routes/auth.routes.ts)
- **Mức độ**: 🟡 MEDIUM
- **Vấn đề**: File chứa toàn bộ logic từ đăng ký, đăng nhập, Google auth, xử lý token, mã hoá OTP, gửi mail, đổi mật khẩu.
- **Hướng giải quyết chi tiết**:
  Tách thành các Service độc lập:
  - `auth-session.service.ts`: Quản lý JWT, cookie, phiên làm việc, refresh token.
  - `password.service.ts`: Quản lý đổi/quên mật khẩu và hash bcrypt.
  - `email-verification.service.ts`: Quản lý tạo mã OTP, hash và xác thực email.
  - File route chỉ đóng vai trò controller mỏng (Thin Controller) hứng request và gọi service.

---

### [ ] 15. `ARCH-02`: Tái cấu trúc `admin.routes.ts` (God File 363 dòng)
- **Vị trí**: [backend/src/routes/admin.routes.ts](file:///e:/Hanflix/backend/src/routes/admin.routes.ts)
- **Mức độ**: 🟡 MEDIUM
- **Vấn đề**: Gộp chung toàn bộ tính năng quản trị: CRUD bài học, xử lý video R2, phụ đề subtitle, quản lý quiz, duyệt nội dung.
- **Hướng giải quyết chi tiết**:
  Tách router thành các module con: `admin-lesson.routes.ts`, `admin-media.routes.ts`, `admin-quiz.routes.ts`.

---

### [ ] 16. `ARCH-03`: Loại bỏ endpoint khôi phục avatar bị trùng lặp
- **Vị trí**: [backend/src/routes/upload.routes.ts](file:///e:/Hanflix/backend/src/routes/upload.routes.ts#L144-L162)
- **Mức độ**: 🟡 LOW
- **Vấn đề**: Tồn tại song song 2 endpoint thực hiện cùng 1 chức năng: `DELETE /uploads/avatar` và `POST /uploads/avatar/restore`.
- **Hướng giải quyết chi tiết**:
  Giữ lại `DELETE /uploads/avatar` (đúng chuẩn RESTful), đánh dấu deprecate và tiến tới xoá bỏ `POST /uploads/avatar/restore`.

---

### [ ] 17. `ARCH-04`: Di chuyển hàm `publicUser()` ra khỏi file Route
- **Vị trí**: [backend/src/routes/auth.routes.ts](file:///e:/Hanflix/backend/src/routes/auth.routes.ts#L88-L108) (được import bởi [upload.routes.ts](file:///e:/Hanflix/backend/src/routes/upload.routes.ts#L7))
- **Mức độ**: 🟡 LOW
- **Vấn đề**: Route file không nên export hàm phụ trợ cho route khác dùng (vi phạm nguyên tắc phân lớp).
- **Hướng giải quyết chi tiết**:
  Chuyển `publicUser()` vào `backend/src/services/user.service.ts` hoặc `backend/src/utils/user.mapper.ts`.

---

### [ ] 18. `ERR-01`: Thay thế `console.warn` bằng Structured Logger trong Upload Route
- **Vị trí**: [backend/src/routes/upload.routes.ts](file:///e:/Hanflix/backend/src/routes/upload.routes.ts#L84-L86)
- **Mức độ**: 🟡 LOW
- **Hướng giải quyết**: Thay `console.warn(...)` bằng `logger.warn(...)` để thống nhất chuẩn log JSON và truy vết lỗi.

---

### [ ] 19. `ERR-02`: Thay thế `console.error` bằng Structured Logger trong Error Handler
- **Vị trí**: [backend/src/middleware/error-handler.ts](file:///e:/Hanflix/backend/src/middleware/error-handler.ts#L18)
- **Mức độ**: 🟡 LOW
- **Hướng giải quyết**: Thay `console.error({ requestId, error })` bằng `logger.error(...)` để tích hợp chuẩn với các hệ thống giám sát tập trung (Datadog/ELK).

---

## 🛡️ HẠNG MỤC ĐÃ ĐƯỢC XỬ LÝ TỐT (GIỮ NGUYÊN)

- [x] **`BUG-05`**: Xử lý Race condition khi đăng nhập Google lần đầu ([auth.routes.ts#L191-L213](file:///e:/Hanflix/backend/src/routes/auth.routes.ts#L191-L213)) — Đã bắt mã lỗi MongoDB `11000` và tự động retry tìm kiếm bản ghi thành công.
- [x] **Xác thực biến môi trường**: Zod schema chặt chẽ, kiểm tra production guards và placeholder.
- [x] **Kiến trúc JWT**: Tách biệt Access Secret và Refresh Secret, mã hoá một chiều SHA-256 trong Database.
- [x] **Bảo mật OTP**: HMAC hash, so sánh an toàn bằng `crypto.timingSafeEqual`, giới hạn 5 lần thử.
- [x] **Cookie Security**: `httpOnly`, cờ `secure` theo môi trường, phạm vi `path` rõ ràng.
- [x] **Mã hoá mật khẩu**: `bcrypt` với cost factor 12.
- [x] **Idempotency**: Kiểm tra chống trùng lặp submission khi làm bài quiz.
