# Tài Liệu Hệ Thống Dữ Liệu Từ Vựng HSK 3.0 HanFlix

Tài liệu này đặc tả toàn diện kiến trúc, nguồn dữ liệu, quy trình chuẩn hóa, chiến lược lưu trữ MongoDB Atlas, cách vận hành pipeline và API cho hệ thống Từ vựng tiếng Trung của **HanFlix**.

---

## 1. Nguồn Dữ Liệu & Bản Quyền (Datasets & Licenses)

Hệ thống kết hợp dữ liệu từ 2 nguồn mã nguồn mở uy tín theo chuẩn HSK 3.0:

### 1. `krmanik/HSK-3.0`
- **Repository**: [https://github.com/krmanik/HSK-3.0](https://github.com/krmanik/HSK-3.0)
- **Mục đích**: Nguồn chính (primary authority) để xác định danh mục từ vựng, cấp độ HSK chuẩn 3.0 (HSK 1 đến HSK 7–9), và nghĩa tiếng Anh (English definitions).
- **Căn cứ chuẩn**: Dựa trên đề cương chuẩn hóa của Bộ Giáo dục Trung Quốc (MOE 2021/2025):
  - *http://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202103/W020210329527301787356.pdf*
  - *https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲1219.pdf*
- **Giấy phép**: Public domain / Open Educational Dataset.

### 2. `ivankra/hsk30`
- **Repository**: [https://github.com/ivankra/hsk30](https://github.com/ivankra/hsk30)
- **Mục đích**: Nguồn đối chiếu và bổ sung phồn thể (`traditional`), loại từ (`partOfSpeech`), biến thể (`variants`), và mã số phiên âm CEDICT (`pinyinNumbered`).
- **Giấy phép**: MIT License (Copyright (c) 2023 Ivan Krasilnikov, Shawky, Pleco Inc.).

---

## 2. Quy Tắc Cấp Độ HSK (HSK Level Strategy)

- **Cấp độ chính thức**:
  - `1`: HSK 1 (550 từ)
  - `2`: HSK 2 (872 từ)
  - `3`: HSK 3 (1.050 từ)
  - `4`: HSK 4 (1.112 từ)
  - `5`: HSK 5 (1.174 từ)
  - `6`: HSK 6 (1.260 từ)
  - `"7-9"`: HSK 7–9 (6.350 từ)
- **Tổng cộng**: **12.368** từ vựng đã được chuẩn hóa.
- **Quy tắc nghiêm ngặt**:
  - Tuyệt đối không coi HSK 0 là cấp độ chính thức (nếu có bài học cho người mới bắt đầu thì phân loại là `Starter` / `Beginner`, không gán `hskLevel: 0`).
  - HSK 7–9 không tự ý phân tách thành 7, 8, 9 do chuẩn khảo thí 3.0 gộp chung một dải từ vựng cao cấp.

---

## 3. Đặc Tả Schema Mongoose / MongoDB Atlas

Model: `VocabularyModel` (`backend/src/models/vocabulary.model.ts`)

```typescript
{
  simplified: string;          // Chữ Hán giản thể (bắt buộc, index: true)
  traditional?: string;        // Chữ Hán phồn thể
  pinyin: string;              // Pinyin có dấu thanh điệu (bắt buộc, index: true)
  pinyinNumbered?: string;      // Pinyin dạng số CEDICT (vd: ai4)

  meanings: {
    vi: string[];              // Mảng nghĩa tiếng Việt (không lưu gộp 1 chuỗi)
    en: string[];              // Mảng nghĩa tiếng Anh (tách mảng)
  };

  hskLevel: 1 | 2 | 3 | 4 | 5 | 6 | '7-9'; // Validate enum nghiêm ngặt

  partOfSpeech: string[];      // Loại từ: động từ, danh từ, tính từ, phó từ...
  variants: string[];          // Các dạng chữ viết thay thế hoặc cách đọc phụ
  examples: [                  // Ví dụ câu minh họa
    {
      chinese: string;
      pinyin?: string;
      vietnamese?: string;
      english?: string;
    }
  ];

  frequency?: number;          // Tần suất sử dụng
  tags: string[];              // Nhãn chủ đề (food, travel, daily, shopping, business, entertainment)
  source: [                    // Lưu vết nguồn gốc dữ liệu
    {
      name: string;            // 'krmanik/HSK-3.0' | 'ivankra/hsk30' | 'Admin'
      sourceId?: string;       // vd: L1-0001
    }
  ];

  status: 'published' | 'draft' | 'pending_review';
  createdAt: Date;
  updatedAt: Date;
}
```

### Chỉ mục (MongoDB Indexes)
1. **Compound Unique Index**: `{ simplified: 1, pinyin: 1 }`
   - Đảm bảo tính **idempotent**: script seed hay import chạy 1 lần hay 100 lần đều không sinh bản ghi trùng.
   - Hỗ trợ từ đa âm đa nghĩa (cùng 1 chữ Hán nhưng có cách đọc pinyin khác nhau thì lưu thành các bản ghi độc lập hợp lệ).
2. **Compound Filter Indexes**:
   - `{ hskLevel: 1, status: 1 }`: Tối ưu tìm kiếm và duyệt danh mục theo cấp độ.
   - `{ status: 1, simplified: 1 }`: Tối ưu lọc từ đã xuất bản.
   - `{ pinyin: 1 }`, `{ tags: 1 }`.

---

## 4. Cơ Chế Khử Trùng Lặp (Deduplication Strategy)

Chuẩn hóa khóa duy nhất (Normalized Key):
```typescript
function makeNormalizedKey(simplified: string, pinyin: string): string {
  return `${simplified.trim()}:${normalizePinyin(pinyin)}`;
}
```
Trong đó `normalizePinyin` chuẩn hóa chữ thường, loại bỏ khoảng trắng thừa, và đưa về định dạng NFC Unicode.

---

## 5. Kiến Trúc Pipeline Dữ Liệu (Data Pipeline)

Quy trình dữ liệu:
```text
Raw HSK Dataset (GitHub krmanik + ivankra)
        ↓
download-hsk-data.ts  (lưu vào data/hsk/raw/)
        ↓
normalize-hsk-data.ts (chuẩn hóa, phân loại tags, khử duplicate)
        ↓
data/hsk/hsk-vocabulary.json (bộ dữ liệu offline 12.368 records)
        ↓
validate-vocabulary.ts (kiểm định 100% bằng Zod Schema)
        ↓
seed-vocabulary.ts (nạp idempotent vào MongoDB Atlas)
```

> [!IMPORTANT]
> **Tính độc lập khi chạy Production**:
> Khi ứng dụng khởi chạy trên Production, backend **đọc trực tiếp từ MongoDB Atlas**. Hệ thống tuyệt đối không fetch trực tiếp từ GitHub khi server khởi động để tránh downtime do sự cố mạng hoặc GitHub API rate limit.

---

## 6. Các Lệnh Điều Hành (Commands)

Được cấu hình sẵn trong `backend/package.json`:

```bash
# 1. Tải bộ dữ liệu thô từ GitHub về local cache
npm run vocab:download

# 2. Chuẩn hóa dữ liệu và xuất ra file data/hsk/hsk-vocabulary.json
npm run vocab:normalize

# 3. Kiểm định chất lượng toàn bộ dữ liệu bằng Zod
npm run vocab:validate

# 4. Nạp dữ liệu vào MongoDB Atlas (Idempotent: an toàn chạy nhiều lần)
npm run vocab:seed
```

### Kết quả seed hiển thị chuẩn:
```text
HSK Vocabulary Import

Source records: 12368
Valid records: 12368
Inserted: 12368 (hoặc 0 nếu đã seed)
Updated: 0
Skipped: 0 (hoặc 12368 nếu chạy lại)
Duplicates: 0
Invalid: 0

Completed successfully.
```

---

## 7. Tra Cứu Phụ Đề Hàng Loạt (Bulk Lookup Service)

Tích hợp với tính năng phụ đề phim của HanFlix:
```typescript
// backend/src/services/vocabulary.service.ts
await vocabularyService.findVocabularyByWords(["我", "很", "喜欢", "看", "电影"]);
```
Sử dụng toán tử `$in` của MongoDB trong **1 truy vấn duy nhất**, loại bỏ hoàn toàn tình trạng gửi hàng chục truy vấn đơn lẻ lặp lồng trong vòng lặp khi phân tích phụ đề.

---

## 8. Hướng Dẫn Bổ Sung Nghĩa Tiếng Việt & AI

1. Mặc định các từ chưa có nghĩa tiếng Việt sẽ có `meanings.vi: []` và trạng thái `published` dựa trên `meanings.en`.
2. Khi Admin bổ sung nghĩa tiếng Việt thủ công qua trang Admin hoặc import file CSV có cột tiếng Việt, hệ thống sẽ tự động gộp vào `meanings.vi`.
3. Nếu sử dụng AI sinh nghĩa tự động (Gemini / Claude):
   - Đánh dấu trạng thái `status: 'pending_review'`.
   - Admin vào trang **Quản trị > Kho Từ vựng HSK**, lọc trạng thái **Chờ duyệt (Pending)** để kiểm tra và bấm xuất bản (Publish).

---

## 9. API Endpoints

### Public Endpoints
- `GET /api/v1/vocabulary`: Danh mục từ vựng công khai (`page`, `limit`, `hskLevel`, `search`, `tag`, `sort`).
- `GET /api/v1/vocabulary/:id`: Chi tiết 1 từ vựng.
- `GET /api/v1/vocabulary/saved`: Sổ tay từ vựng của học viên (cần auth).
- `GET /api/v1/vocabulary/due`: Danh sách từ cần ôn tập SRS hôm nay (cần auth).
- `POST /api/v1/vocabulary`: Lưu từ vào sổ tay (cần auth).
- `POST /api/v1/vocabulary/:wordId/review`: Chấm điểm SRS (cần auth).

### Admin Endpoints (Yêu cầu `requireAuth` + `requireAdmin`)
- `GET /api/v1/admin/vocabulary/stats`: Thống kê tổng số từ, số từ theo từng cấp HSK 1..6 và 7-9.
- `GET /api/v1/admin/vocabulary`: Danh sách đầy đủ cho quản trị viên kèm bộ lọc nâng cao.
- `POST /api/v1/admin/vocabulary`: Thêm mới từ vựng thủ công.
- `PATCH /api/v1/admin/vocabulary/:id`: Sửa từ vựng, đổi trạng thái publish / draft.
- `DELETE /api/v1/admin/vocabulary/:id`: Xóa từ vựng.
- `POST /api/v1/admin/vocabulary/import`: Nhập hàng loạt file CSV hoặc JSON:
  - `mode: 'preview'`: Trả về báo cáo kiểm tra (hợp lệ, không hợp lệ, trùng lặp, từ mới) trước khi thực thi.
  - `mode: 'commit'`: Xác nhận ghi vào database với chiến lược `skip_existing`, `update_existing`, hoặc `insert_only`.
