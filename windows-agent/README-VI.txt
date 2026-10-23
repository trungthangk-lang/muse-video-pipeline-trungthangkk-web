MUSE VIDEO PIPELINE — WINDOWS AGENT (BẢN THỬ NGHIỆM)

MỤC ĐÍCH
- Máy tính Windows chủ động kết nối HTTPS đến website Render.
- Website gửi prompt đến agent; agent mở Chrome/Chromium với hồ sơ riêng để giữ phiên đăng nhập Muse trên chính máy đó.
- Bản đầu này KHÔNG tự bấm nút tạo video. Nó thử điền prompt nếu nhận diện được ô nhập rõ ràng; bạn phải kiểm tra và gửi thủ công. Cần xác minh giao diện Muse thực tế trước khi tự động hóa nút Generate.

CÀI ĐẶT
1. Cài Node.js 20 LTS trở lên trên Windows.
2. Sao chép .env.example thành .env.
3. Mở .env, đặt RENDER_URL và AGENT_TOKEN. AGENT_TOKEN phải trùng với biến môi trường AGENT_TOKEN trên Render và dài ít nhất 32 ký tự ngẫu nhiên.
4. Mở Terminal/Command Prompt tại thư mục này và chạy:
   npm install
   npx playwright install chromium
   npm start
5. Cửa sổ Muse sẽ mở khi agent nhận công việc. Đăng nhập thủ công nếu cần.

TRÊN RENDER
- Vào Dashboard > dịch vụ web > Environment.
- Thêm AGENT_TOKEN với một chuỗi ngẫu nhiên dài tối thiểu 32 ký tự; dùng cùng giá trị trong .env trên Windows.
- Lưu thay đổi và chờ deploy hoàn tất.
- Nếu AGENT_TOKEN chưa được cấu hình, API agent trả lỗi xác thực.

CÁCH DÙNG
1. Chạy agent trên máy tính cần dùng để tạo video; để cửa sổ terminal và agent hoạt động.
2. Mở website Render, đăng nhập dashboard.
3. Dán prompt trong khu vực File prompt & nội dung.
4. Bấm “Gửi prompt tới máy tính”.
5. Agent nhận công việc, mở Muse và báo trạng thái trong khu vực Kết nối máy tính Windows.

BẢO MẬT
- Không chia sẻ .env, AGENT_TOKEN, thư mục muse-chrome-profile hoặc dữ liệu cookie.
- Dùng mật khẩu dashboard mạnh và thay các bí mật từng bị lộ.
- Chỉ chạy agent trên máy bạn tin cậy. Website dashboard hiện vẫn dùng cơ chế đăng nhập hiện có.
- Agent chỉ gọi API HTTPS đi ra ngoài; không mở cổng điều khiển Chrome trên Internet.

GIỚI HẠN
- Chưa kiểm chứng selector của giao diện Muse; vì vậy agent không tự bấm nút tạo video.
- Trạng thái “needs_login” hiện mang nghĩa cần người dùng kiểm tra/hoàn tất bước trên trình duyệt, không khẳng định đã tạo video.
- Đừng triển khai hàng loạt trước khi kiểm tra một prompt thử nghiệm.
