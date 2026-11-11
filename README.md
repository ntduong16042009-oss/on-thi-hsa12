# HSA MASTER 2.0 — Sản Phẩm Học Tập Số Môn Ngữ Văn

Nền tảng luyện tập, thi thử và đánh giá năng lực môn Ngữ văn — Lớp 12A03, Trường THPT Yên Lãng (Năm học 2026–2027).

---

## Đã tối ưu hóa 100% để Deploy lên Vercel & Chạy Local

Bộ mã nguồn đã được chuẩn hóa hoàn toàn để tránh các lỗi `npm install` (`ETARGET`, `ERESOLVE`, xung đột `bun.lock`):
- **`package.json`**: Đã gỡ bỏ các gói nội bộ không tồn tại trên public npm (`@google/genai@^2.4.0`, `vite@^8.3.0`, `typescript@^7.0.2`, ...) và chuyển sang dải phiên bản chuẩn tương thích 100% với `registry.npmjs.org` trên Vercel.
- **`.npmrc`**: Tự động bật `legacy-peer-deps=true` giúp `npm install` không bao giờ báo lỗi xung đột peer dependencies (`ERESOLVE`).
- **`vercel.json`**: Cấu hình sẵn `framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"` và SPA Rewrites giúp tải lại trang (F5) trên Vercel không bị lỗi `404 NOT_FOUND`.
- **Đã xóa `bun.lock`**: Ngăn Vercel tự động đọc lockfile nội bộ gây lỗi tải gói.

---

## Hướng dẫn Deploy lên Vercel

### Cách 1: Deploy qua GitHub / GitLab (Khuyên dùng)
1. Đẩy toàn bộ thư mục code này lên kho lưu trữ GitHub của bạn:
   ```bash
   git init
   git add .
   git commit -m "Deploy HSA MASTER 2.0 to Vercel"
   git branch -M main
   git remote add origin <URL_REPO_GITHUB_CUA_BAN>
   git push -u origin main
   ```
2. Truy cập [vercel.com/new](https://vercel.com/new) và chọn **Import** kho lưu trữ vừa đẩy lên.
3. Vercel sẽ tự động nhận diện cấu hình từ `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install --legacy-peer-deps`
4. Nhấn **Deploy** và đợi khoảng 30–45 giây để hoàn tất.

### Cách 2: Chạy thử trên máy cá nhân (Local)
Nếu trước đó bạn từng tải bản cũ có file `package-lock.json` hoặc `bun.lock` bị lỗi, hãy xóa chúng trước khi cài đặt:
```bash
rm -rf node_modules package-lock.json bun.lock
npm install
npm run build
npm run preview
```

