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

---

## 📁 Cấu trúc thư mục

```text
Hanflix/
├── backend/          # RESTful API bằng Node.js (Express 5 + TypeScript + MongoDB + Cloudflare R2 + Gemini AI)
├── frontend/         # Giao diện người dùng Web App (React 19 + TypeScript + Vite 6 + Tailwind CSS v4)
└── doc/              # Tài liệu đặc tả, UI/UX audit, guidelines thiết kế Figma, dữ liệu mẫu
```

---

## 🚀 Khởi chạy dự án

### 1. Backend

Xem chi tiết tại [backend/README.md](./backend/README.md).

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

### 2. Frontend

Xem chi tiết tại [frontend/README.md](./frontend/README.md).

```powershell
cd frontend
cp .env.example .env
pnpm install
pnpm dev
```

---

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React.
- **Backend**: Express 5, TypeScript, MongoDB Atlas (Mongoose 9), Zod, JWT (HttpOnly Cookie + Rotation), Cloudflare R2 (@aws-sdk/client-s3), Google GenAI SDK.
- **Testing & Tools**: Vitest, Supertest, oxfmt.
