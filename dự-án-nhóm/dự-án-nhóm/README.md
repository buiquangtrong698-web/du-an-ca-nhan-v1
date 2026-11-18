# Orange Team

## Chạy website có đăng nhập

Mở PowerShell tại thư mục dự án rồi chạy:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload
```

Sau đó mở <http://127.0.0.1:8000>. Không mở các tệp HTML trực tiếp bằng `file://`: khi chạy qua máy chủ, khách chưa đăng nhập sẽ được chuyển tới trang đăng nhập; sau khi đăng nhập, họ mới truy cập được các trang hiện có.

Tài khoản mới cần tên đăng nhập gồm 3-32 chữ cái, chữ số hoặc dấu gạch dưới và mật khẩu dài ít nhất 10 ký tự. Mật khẩu được băm trước khi lưu.

Mỗi tài khoản có quyền `user` hoặc `admin`; đăng ký luôn tạo quyền `user` (không nhận quyền từ dữ liệu gửi lên). Quyền hiện được hiển thị trong trang Tài khoản. Khi cập nhật dự án, cột quyền được thêm cho database cũ và tài khoản cũ nhận quyền `user`.

## Quyền chỉnh sửa nội dung

Chỉ tài khoản có quyền `admin` mới được thêm hoặc sửa quy định, thành viên và thông báo. Tài khoản `user` bấm các nút này sẽ nhận thông báo không có quyền. Để cấp quyền admin trong SQLite, mở `backend/orange_team.db` bằng DB Browser for SQLite và chạy:

```sql
UPDATE users SET role = 'admin' WHERE username = 'TEN_DANG_NHAP';
```

Quy định và thành viên vẫn lưu trong `localStorage` của trình duyệt. Thông báo thủ công đã tạo từ phiên bản cũ vẫn nằm trong `localStorage` của máy đã tạo chúng.

Thông báo mới tạo thủ công và thông báo tự động khi có tài khoản đăng ký hoặc bài đăng diễn đàn được lưu trong SQLite, không tự xóa. Trang hiển thị 30 thông báo mỗi lần; chọn “Tải thêm thông báo cũ” để xem lịch sử, còn số đếm phản ánh tổng số. Khi trang đang mở, thông báo mới được kiểm tra mỗi 15 giây.

Bản thân bài đăng diễn đàn vẫn lưu trong `localStorage`, vì vậy các máy khác hiện chỉ nhận được thông báo, chưa xem được nội dung bài đăng.

## Cấu hình database

Ứng dụng đọc `DATABASE_URL` từ `backend/.env` (tệp này không đưa lên Git). Cấu hình MySQL mẫu:

```text
mysql+pymysql://USER:PASSWORD@localhost:3306/orange_team
```

Thay `USER` và `PASSWORD` bằng thông tin của bạn, đồng thời bảo đảm MySQL đang chạy và database `orange_team` đã được tạo. `backend/.env.example` có các mẫu cấu hình, không chứa thông tin đăng nhập thật. Có thể dùng SQLite thay thế bằng `DATABASE_URL=sqlite:///orange_team.db`. Đặt `AUTH_COOKIE_SECURE=true` khi website chạy qua HTTPS. Không đưa thông tin kết nối thật lên Git.

## Kiểm thử

```powershell
python -m unittest discover -s tests
```
