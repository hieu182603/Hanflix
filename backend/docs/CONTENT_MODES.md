# Phụ đề theo loại nội dung

Luồng hiện tại: chọn loại → tạo nháp → presign/PUT/confirm R2 → worker xử lý → biên tập phụ đề → xuất bản → player theo loại nội dung.

| Loại | Đầu vào | Xử lý phụ đề | Giới hạn mặc định |
| --- | --- | --- | --- |
| Bài học | MP4, WebM | ASR tiếng Trung, tách câu, pinyin, dịch Việt, từ vựng, quiz | 10 phút |
| Bài hát | MP4, WebM, MP3, M4A, WAV | LRC hoặc ASR, căn thời gian karaoke, pinyin, dịch Việt, từ vựng | 10 phút |
| Podcast | MP4, WebM, MP3, M4A, WAV | ASR, tách câu dài, pinyin, dịch Việt, từ vựng, chapter | 90 phút |
| Drama | MP4, WebM | ASR phân biệt người nói, tách câu, pinyin, dịch Việt, từ vựng | 10 phút |

Podcast dùng `VIDEO_MAX_DURATION_PODCAST_SECONDS`, tối đa cấu hình 21600 giây. Giới hạn upload do `MAX_VIDEO_BYTES` quyết định; FFprobe còn áp dụng trần 200 MiB cho tệp nguồn. Audio được chuyển thành WAV mono 16 kHz trước khi nhận diện. Thời lượng thực được giữ nguyên, không bị cắt về 300 giây.

## Dùng và sửa nội dung

- Bài hát: nhập LRC dạng `[00:12.00]你好`. Hỗ trợ timestamp lặp, offset và gộp dòng cùng thời điểm. Văn bản không có timestamp bị từ chối để tránh thay lời người dùng bằng kết quả ASR khác. Nếu không cung cấp LRC thì nhận diện tự động; không nhận diện được sẽ báo lỗi để bổ sung LRC và thử lại.
- Với LRC hợp lệ, ASR thất bại vẫn giữ được phụ đề theo dòng. Thời gian từng ký tự chưa khớp được có thể nội suy, nên cần nghe và duyệt; đây không phải forced alignment đảm bảo chính xác từng âm tiết.
- Màn xử lý lỗi cho phép đổi loại nội dung và bổ sung LRC trước khi thử lại. Chỉ sửa nguồn khi bài còn nháp hoặc xử lý thất bại; không thay nguồn giữa một job đang chạy.
- Podcast có chapter tự động, nhảy đến chương và bố cục mục lục dưới player trên màn hình nhỏ. Gemini không khả dụng thì dùng các phần chia đều có tiêu đề “Phần N”. Đây là phương án dự phòng, không phải phân tích chủ đề bằng AI.
- Drama lưu speaker ID cùng cue. Admin có thể sửa tên/màu nhân vật trong phần thông tin bài học. Speaker ID biểu thị người nói được nhận diện, không tự xác định danh tính nhân vật hay cảm xúc.
- Khi lưu phụ đề, speaker/chapter được giữ lại. Karaoke timing chỉ giữ khi lời và mốc thời gian dòng không đổi; sửa lời hoặc mốc sẽ bỏ timing cũ để tránh lệch.
- Song/podcast/drama không bắt buộc quiz. Bài học thông thường vẫn bắt buộc quiz. Backend từ chối nộp bài trên quiz rỗng.
- Phụ đề podcast hỗ trợ tới 10000 cue; endpoint lưu phụ đề có giới hạn JSON 8 MiB và yêu cầu admin. Các endpoint thông thường vẫn giữ giới hạn 1 MiB.

## Các lỗi đã sửa trong phần thay đổi chưa commit

- Ba pipeline mới bị chặn ở bước commit vì gửi quiz rỗng; frontend cũng gọi lưu quiz rỗng trước khi xuất bản.
- Podcast bị chặn ở FFprobe 600 giây, schema 300 giây và commit cắt thời lượng về 300 giây.
- ASR lỗi bị nuốt hoặc tạo lời mẫu; lời thủ công bị thay bằng transcript ASR.
- Pipeline mới bỏ qua thumbnail và liên kết từ vựng; metadata chapter/nhân vật được ghi trước lease guard.
- Lưu phụ đề làm mất karaoke/speaker/chapter; PATCH metadata có thể áp default contentMode/goalTags.
- Matching karaoke tái sử dụng ASR word, không tách Hán tự và sinh timing vượt cue.
- Các player thiếu pause/seek/resume callbacks; podcast mute không đổi media; drama slider bị bật về vị trí cũ; phím Space toàn trang cản nhập ghi chú; podcast tràn màn hình nhỏ.
- Script test cũ import đường dẫn không tồn tại và tạo dữ liệu DB nhưng không chạy pipeline; migration thiếu kết nối MongoDB.

## Kiểm chứng và giới hạn

Các regression test mock provider/DB kiểm tra pipeline, lease cancellation, optional quiz, upload audio, PATCH không mất mode, lưu metadata phụ đề và timing. Các test Chromium upload mock API/R2; test player phát WAV thật trong trình duyệt, kiểm tra tua và mobile. `verify-content-media.ts` dùng FFmpeg/FFprobe thật với audio 601 giây để kiểm tra giới hạn theo loại và tách WAV.

Lệnh chạy lại từ thư mục tương ứng:

```powershell
# backend
npm run typecheck
npx vitest run --maxWorkers=2
npx tsx scripts/test-song-pipeline.ts
npx tsx scripts/verify-content-media.ts
npm run build

# frontend
npm run typecheck
npx vitest run --maxWorkers=2 --minWorkers=1
npx playwright test e2e/connected-api.spec.ts --grep "admin upload" --workers=1
npx playwright test e2e/content-mode-players.spec.ts --workers=1
npm run build
```

Chưa chứng minh chất lượng nhận diện/dịch trên video thật qua Azure/Gemini, upload R2 thật hoặc transaction MongoDB thật trong đợt sửa này. Dữ liệu cũ đã sai không được tự động sửa bằng migration. Cần khởi động lại API/worker sau khi cập nhật, rồi xử lý lại các bài lỗi từ admin.

Tham chiếu hợp đồng diarization: [Microsoft Fast Transcription](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/fast-transcription-create).
