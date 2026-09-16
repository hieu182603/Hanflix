# HanFlix 🎬🇨🇳

> Nền tảng học tiếng Trung qua phim ảnh và video ngắn theo phong cách Netflix (Hán ngữ + Netflix).

---

## 📌 Tổng quan dự án

HanFlix kết hợp trải nghiệm xem phim/video giải trí với phương pháp học ngôn ngữ chủ động:
- **Phụ đề song ngữ thông minh**: Hỗ trợ 3 tầng phụ đề (Chữ Hán giản thể/phồn thể, Pinyin, Tiếng Việt). Tra từ vựng trực tiếp theo ngữ cảnh ngữ pháp.
- **Hệ thống ôn tập SRS (Spaced Repetition System)**: Lưu từ vựng, tự động lên lịch ôn tập thông minh bằng thuật toán lặp lại ngắt quãng.
- **Trắc nghiệm & Đánh giá sau video**: Idempotent post-video quiz, tính tỉ lệ hoàn thành bài học (chính sách xem liên tục >= 90%).
- **Tích hợp Google Gemini AI**: Giải thích cấu trúc ngữ pháp và sắc thái từ vựng theo ngữ cảnh bài học; hỗ trợ gợi ý nội dung học tập cá nhân hoá.
- **Quản lý học liệu & Media**: Lưu trữ video qua Cloudflare R2 với presigned URL, quy trình kiểm duyệt bài học chặt chẽ.

