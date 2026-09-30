# Kho đề HSK

Chạy `npm run seed:exams` tại `backend`, dùng cấu hình MongoDB hiện có trong `.env`.
Script upsert theo `code`, không xóa đề khác, không reset `attemptCount` hay lịch sử.
Chạy lại sẽ thay nội dung sáu mã mẫu; không chạy seed trên kho đã thay các mã này bằng đề chính thức.
`npm run db:indexes` cũng tạo index Exam và ExamAttempt, gồm index chống nộp trùng.

| Mã | Cấp | Số câu | Thang điểm |
| --- | --- | --- | --- |
| H11001 | 1 | 4 | 200 |
| H21001 | 2 | 4 | 200 |
| H31001 | 3 | 15 | 300 |
| H41001 | 4 | 6 | 300 |
| H51001 | 5 | 6 | 300 |
| H61001 | 6 | 6 | 300 |

Seed là `mini_test` rút gọn, không phải bản đề CTI chính thức. HSK 3 giữ 15 câu từ giao diện cũ,
bỏ audio demo không liên quan và ID bài học minh họa. HSK 1–2 có pinyin cho câu hỏi, hội thoại và lựa chọn.
Khi chưa có audio, giao diện dùng Web Speech Synthesis, chất lượng giọng đọc tùy trình duyệt.
Bài viết hỗ trợ đáp án cố định, không đánh giá bài luận/tóm tắt tự do theo rubric HSK 5–6.
Điểm luyện tập = tỷ lệ đúng trong mỗi kỹ năng × 100, làm tròn từng kỹ năng rồi cộng tổng;
không phải quy trình quy đổi điểm CTI.

## API

Response thành công bọc trong `{ "data": ... }`. Prefix mặc định `/api/v1`.

- `GET /exams?level=3&category=mini_test`: metadata đề đã công bố, không có sections.
- `GET /exams/:id`: ObjectId hoặc code; không có đáp án, lời giải, bản dịch, ngữ pháp hay gợi ý bài học.
  Pinyin script cấp 3–6 chỉ trả sau nộp bài vì dữ liệu cũ có thể chứa từ cần điền.
- `POST /exams/:id/submit`: Bearer token bắt buộc. Body `{ "answers": { "q1": "A" }, "timeSpentSeconds": 60 }`.
  Header `Idempotency-Key` tùy chọn (1–100 ký tự chữ/số/gạch ngang/gạch dưới).
  Mỗi lần làm mới dùng key mới; retry giữ key cũ. Server trả snapshot của lần nộp đầu tiên.
  Response gồm exam, questionResults (question, userAns, isCorrect), điểm từng kỹ năng,
  tổng điểm, pass/fail, ID bài làm. Không nhận điểm do client gửi.
- `GET /exams/my-history?page=1&limit=20`: Bearer token; lịch sử của tài khoản hiện tại, mới nhất trước.
  Trả `{ items, page, limit, total }`, tối đa 100 kết quả/trang.
- `GET /exams/my-history/:attemptId`: Bearer token; mở snapshot kết quả của chính tài khoản đó.
- `POST /admin/exams/import`: Bearer token admin; JSON một đề hoặc mảng tối đa 50 đề.
  Gửi tệp JSON bằng `curl --data-binary @exams.json` với Content-Type application/json.
  Upsert theo code; attemptCount, ID và timestamps từ payload không được nhập.
  `isPublished: false` ẩn đề. Request hiện giới hạn 1 MB; chia bộ lớn thành các request nhỏ.

## Import nội dung

Xem `src/data/exam-seeds.ts`, `src/data/hsk3-exam.ts` và `src/services/exam-validation.ts`.
Question ID (chữ, số, `_`, `-`) và order phải duy nhất, skill khớp section, số câu khớp thực tế.
Một section mỗi kỹ năng; mỗi kỹ năng 100 điểm. `full_mock` cần đủ kỹ năng của cấp độ.
`single_choice`: đáp án là chữ cái A/B/... hoặc nguyên văn option.
`true_false`: True/False hoặc một trong hai option tùy chỉnh.
`sentence_ordering`: bỏ khoảng trắng khi so sánh.
`fill_in_blank`: có options thì chấm trắc nghiệm; không có thì so sánh chuỗi chuẩn hóa Unicode và trim.
Không chấp nhận chuỗi đoán nhiều đáp án bằng prefix/substring.

Để nhập đề CTI được phép sử dụng, chuyển nội dung sang schema này và cung cấp URL HTTP(S) cho audio/ảnh.
API nhận JSON có cấu trúc, không tự OCR PDF, trích audio hay chấm bài luận tự do.

## Lưu bài và bảo mật

Frontend chỉ giữ danh mục ngoại tuyến, không đóng gói ngân hàng đáp án. Mất kết nối thì không bắt đầu
hoặc chấm bài local. Bài đang làm được lưu theo tài khoản; nộp thất bại giữ payload và key để thử lại.
Chỉ ID kết quả gần nhất được lưu local, nội dung review tải từ API. Làm lại luôn tải bản đề công khai mới.
MongoDB lưu snapshot nên kết quả cũ không đổi khi admin import lại đề.
Counter đối soát từ attempt đã lưu bằng `$max`, retry sửa lỗi cập nhật counter mà không tạo attempt trùng.
Không yêu cầu replica set/transaction.

## Hoạt động học và streak

`ExamAttempt` đã lưu là nguồn dữ liệu cho hoạt động thi, không ghi tăng bộ đếm lần thứ hai khi nộp. Ngày học tính theo `submittedAt` tại `Asia/Ho_Chi_Minh`; cần ít nhất một câu trả lời không rỗng. Bài trắng vẫn có trong lịch sử thi nhưng không tăng thời gian hoạt động hoặc streak. Unique index `(userId, submissionKey)` bảo đảm thử lại hoặc nộp đồng thời chỉ tính một lần, kể cả thử lại sang ngày khác.

`/learning/streak`, dashboard và bảng xếp hạng cùng tính ngày thi. `/learning/activity` trả thêm `examAttempts` và `examStudySeconds`; tổng thời gian hoạt động gồm video và bài thi. `/learning/history` bổ sung thống kê thi; trang Lịch sử học có mục xem từng kết quả từ API đã kiểm tra chủ sở hữu. Kết quả cũ được tính trực tiếp, không cần backfill. Nộp thành công phát sự kiện làm mới hoạt động trên frontend.

## Đáp án sắp xếp câu và audio

Câu `sentence_ordering` hỗ trợ `acceptedAnswers` (tối đa 20 đáp án thay thế do biên tập viên duyệt). Ví dụ `correctAnswer: "姐姐比我汉语说得流利"`, `acceptedAnswers: ["姐姐汉语说得比我流利"]`. Trường này được lưu ẩn như đáp án chính, chỉ dùng khi chấm/review. Import lại mã đề để áp dụng đáp án mới cho các lần thi tiếp theo; kết quả cũ giữ snapshot.

Trong lúc làm bài, UI không hiện hội thoại của phần Nghe hoặc bản dịch. Các nội dung này hiển thị ở phần xem lại sau khi nộp. Bài mẫu dùng giọng tổng hợp vẫn cần script để phát âm ở trình duyệt; đây không phải cơ chế chống truy cập script qua DevTools. Nút nghe lại dừng nguồn hiện tại rồi phát trực tiếp từ đầu.

Kiểm thử tích hợp với MongoDB cục bộ, dùng database tạm riêng và tự dọn sau test:

```powershell
$env:EXAM_TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017'
npm test -- src/services/exam-activity.integration.test.ts
```

Chặn F12 và đồng hồ local phục vụ trải nghiệm luyện tập; thời gian chưa được server xác thực.
API chưa có phiên bắt đầu thi do server ký hoặc giám sát kỳ thi chính thức.

## Kiểm tra

```sh
# backend
npm run typecheck
npm test -- src/services/exam.service.test.ts src/routes/exam.routes.test.ts
npm run seed:exams

# frontend
npm run typecheck
npm test -- src/components/exam/ExamRunner.test.tsx
```
