# Muse Video Pipeline Web — bản khởi đầu triển khai

Đây là web dashboard có đăng nhập quản trị, SQLite lưu dữ liệu phía server, quản lý nhãn tài khoản/proxy (host và port בלבד) và theo dõi thủ công tiến độ dự án. Có thể truy cập từ xa sau khi triển khai trên máy chủ hỗ trợ Node.js và HTTPS.

## Triển khai
1. Đưa thư mục này lên host Node.js (Render, Railway, VPS hoặc nền tảng tương tự).
2. Bảo đảm volume/thư mục dữ liệu bền vững được gắn vào `DATA_DIR` (ví dụ `/data`) để SQLite không mất sau deploy/restart.
3. Thiết lập biến môi trường:
   - `APP_PASSWORD`: mật khẩu quản trị mạnh, tối thiểu 14 ký tự.
   - `SESSION_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự.
   - `DATA_DIR`: thư mục dữ liệu bền vững, nếu host hỗ trợ.
   - `PORT`: host thường tự cấp.
4. Cài dependencies bằng `npm install`, chạy `npm start`, bật HTTPS ở reverse proxy/host.
5. Kiểm tra `/health`.

Tạo `SESSION_SECRET` bằng `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## Quan trọng — chưa phải tích hợp Muse hoàn chỉnh
- Web có thể lưu cấu hình nhãn tài khoản, host/port proxy không nhạy cảm, dự án và tiến độ theo dõi.
- Web không lưu mật khẩu Muse, cookie/session token hoặc mật khẩu SOCKS5.
- Trình duyệt web thông thường không thể định tuyến traffic tới `muse.ai` qua SOCKS5 tùy ý, không thể tạo profile trình duyệt độc lập đáng tin cậy và không thể tự đăng nhập Muse.
- Nút cập nhật tiến độ là theo dõi thủ công; nó không gọi pipeline render hiện tại, không tự phát hiện hết token, không chuyển phiên và không tiếp tục render.
- Để nối với Video Pipeline gốc cần triển khai server/actions gốc cùng cơ sở dữ liệu/worker và thiết kế adapter chính thức của Muse. Nếu Muse không cung cấp API/tích hợp hỗ trợ render, web app không thể tự thực hiện chức năng đó một cách đáng tin cậy.
- Bản này dùng cookie phiên trong bộ nhớ; restart server sẽ đăng xuất người dùng. Dữ liệu dự án được lưu SQLite bền vững nếu `DATA_DIR` là persistent volume.
- Trước khi public, bật HTTPS, bảo vệ quyền truy cập, sao lưu DB và kiểm tra chính sách lưu trữ dữ liệu của host.

## Local test
Node.js 20+, `npm install`, set environment variables, then `npm start`.

## Deploy nhanh trên Render (không cần cài app trên máy người dùng)
1. Tạo repository Git riêng tư và tải các file trong thư mục này lên GitHub.
2. Vào https://render.com/ → New → Blueprint, kết nối repository và chọn `render.yaml`.
3. Khi Render hỏi `APP_PASSWORD`, đặt mật khẩu mạnh riêng (tối thiểu 14 ký tự). `SESSION_SECRET` được Render tự sinh.
4. Chọn deploy. Khi trạng thái Live, mở URL HTTPS Render cung cấp.
5. Sao lưu dữ liệu: SQLite nằm trong persistent disk `/var/data/pipeline-web.sqlite`.

Gói có `Dockerfile` và `render.yaml` để hỗ trợ deploy, nhưng mình không thể tạo URL công khai thay bạn nếu chưa được kết nối/ủy quyền tài khoản hosting và repository.


## Windows Agent (experimental)
See `windows-agent/README-VI.txt`. Set `AGENT_TOKEN` in Render and in the agent `.env`. The first version opens Muse and attempts to fill a recognizable prompt field but intentionally does not click an unverified Generate button.
