# HanFlix Frontend

Giao diện HanFlix được xây dựng bằng React 19, TypeScript, Vite và Tailwind CSS v4.

## Yêu cầu

- Node.js 22
- pnpm 10

## Chạy local

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Ứng dụng mặc định chạy tại `http://localhost:5173` và trỏ API đến
`http://localhost:4000/api/v1`.

## Lệnh chính

```bash
pnpm dev          # Chạy môi trường phát triển
pnpm typecheck    # Kiểm tra TypeScript
pnpm build        # Tạo production build trong dist/
pnpm preview      # Xem production build
pnpm format       # Định dạng mã nguồn
pnpm check        # Chạy typecheck và production build
```

## Cấu trúc

```text
src/
  components/     Các màn hình và thành phần giao diện
  data/           Kiểu dữ liệu và dữ liệu demo
  App.tsx         Luồng màn hình và trạng thái demo
  index.css       Tailwind và style toàn cục
  main.tsx        Điểm khởi động React
```

## Panda AI Pet

Panda tương tác được tích hợp một lần trong ứng dụng học viên. Xem hướng dẫn xử lý asset, state API và trang kiểm thử tại [docs/panda-pet.md](./docs/panda-pet.md). Chạy `pnpm dev` rồi mở `/dev/panda` để kiểm tra từng trạng thái.

Hiện tại phần giao diện dùng dữ liệu demo trong `src/data/hanflixData.ts`. Khi nối
backend, dùng `import.meta.env.VITE_API_BASE_URL` làm URL gốc cho API.
