# Word Chain Flow QA

Ngày cập nhật: 2026-07-27

## Mục tiêu

Tài liệu này dùng để chặn kiểu làm việc:

- sửa một bug rồi phát sinh hai bug mới
- restart bot khi chưa test đủ flow
- kiểm tra logic nhưng quên kiểm tra trải nghiệm người chơi

Mỗi lần sửa hệ thống nối từ phải đi qua đủ 4 lớp:

1. Flow review
2. Customer review
3. Tester review
4. Bug hunter review

Chỉ khi qua đủ 4 lớp mới được:

- push bản sửa
- restart bot local
- báo người dùng test trên Discord

## Flow chuẩn

### Flow 1: Tạo phòng

1. Quản lý dùng `/noitu-tao-phong`
2. Chọn `pvp` hoặc `pve`
3. Bot xác nhận phòng đã bật
4. Bot gửi hướng dẫn ngắn trong phòng
5. Topic phòng phản ánh đúng lệnh đang dùng

Kỳ vọng:

- Không cần tạo lại phòng sau mỗi lần restart
- Chỉ cần tạo phòng một lần, dữ liệu phòng được giữ lại

### Flow 2: Mở ván mới

Người chơi có 3 cách hợp lệ:

1. Gõ `!batdau`
2. Gõ `!play` khi phòng đang trống
3. Gõ thẳng một cụm 2 tiếng hợp lệ khi chưa có ván

Kỳ vọng:

- Bot trả lời ngắn, rõ, tiếng Việt có dấu
- Bot hiển thị từ hiện tại và chế độ chơi
- Không được phản hồi bằng chuỗi lỗi mã hóa

### Flow 3: Khi ván đang chạy

1. Người chơi gửi cụm hợp lệ
2. Bot đánh dấu `✅`
3. Nếu sai, bot đánh dấu `❌`
4. Nếu là `pve`, bot nối lại bằng một cụm tự nhiên
5. Nếu là `pvp`, bot không chen lời nếu chưa cần

Kỳ vọng:

- Tin nhắn bắt đầu bằng `!` không được tính là câu trả lời
- Tin nhắn chat linh tinh không được làm hỏng state
- Không tự dưng có 2 bot cùng phản hồi

### Flow 4: Kết thúc ván

Có 3 trường hợp:

1. Người chơi dùng `!stop`
2. Hết đường nối
3. Hết 60 giây không có câu trả lời hợp lệ

Kỳ vọng:

- `!stop` nghĩa là kết thúc ván, không phải tạm dừng mơ hồ
- Timeout không được spam vô hạn
- Sau timeout phải rõ ràng: kết thúc ván và chờ `!play`
- Không được để flow nửa dừng nửa chạy

## Customer Review

Đóng vai người chơi bình thường.

### Câu hỏi bắt buộc

1. Tôi vào phòng lần đầu có hiểu cách chơi trong 10 giây không?
2. Tôi có biết lúc nào dùng `!play`, `!stop`, `!help` không?
3. Tin nhắn bot có ngắn gọn, dễ đọc, không quá kỹ thuật không?
4. Từ bot nối có quen tai không?
5. Nếu tôi gõ sai, tôi có hiểu mình sai vì sao không?

### Nếu câu trả lời là “không”

Không được restart bot.

## Tester Review

### Case bắt buộc

- Tạo phòng `pvp`
- Tạo phòng `pve`
- `!batdau` khi phòng trống
- `!play` khi phòng trống
- `!play` khi ván đang chạy
- `!stop` khi ván đang chạy
- `!stop` khi phòng không có ván
- `!help`
- `!abc`
- Người chơi gửi cụm đúng
- Người chơi gửi cụm sai
- Người chơi gửi cụm không có trong từ điển
- Người chơi gửi cụm đã dùng gần đây
- Người chơi gửi cụm sai token đầu
- Timeout 60 giây
- Cảnh báo còn 20 giây
- Cảnh báo còn 10 giây
- PvE hết đường nối
- PvP hết đường nối

### Tiêu chí pass

- Không crash
- Không treo state
- Không sinh nhiều timer
- Không bị lặp message
- Không bị lỗi mã hóa tiếng Việt

## Bug Hunter Review

### Các lỗi phải nghĩ trước

- Có hơn 1 process bot đang chạy
- Timer cũ chưa clear
- Timeout tự lặp vô hạn
- Tin nhắn `!command` bị tính như câu chơi
- `!play` mở ván chồng lên ván đang chạy
- `!stop` không kết thúc session thật
- Session xóa rồi nhưng timer vẫn sống
- Text hiển thị bị lỗi UTF-8
- Từ điển có cụm quá gượng hoặc quá vô nghĩa
- Bot chọn lại đúng seed cũ liên tục

### Luật chặn release

Chỉ cần 1 lỗi trong nhóm trên còn tồn tại:

- không push
- không restart
- không báo user test

## Test Gate

Trước mỗi lần restart bot, phải xác nhận:

- `node --check src/services/word-chain-service.js`
- `node --check src/scripts/test-word-chain-modes.js`
- chạy test local các case chính
- kiểm tra chỉ còn 1 process bot
- kiểm tra ít nhất 3 message user-facing không lỗi mã hóa

## Đã đạt

- Lõi `!play`, `!batdau`, `!stop`, `!help` đã được tách riêng khỏi câu trả lời thường
- Tin nhắn bắt đầu bằng `!` không còn được xem là câu nối từ
- Timeout đổi sang 60 giây
- Có nhắc ở mốc 20 giây và 10 giây
- Timeout kết thúc ván thay vì tự lặp vô hạn
- Topic phòng và phần hướng dẫn phòng đã đổi sang flow mới
- File dữ liệu từ vựng riêng đã được dọn lại theo hướng tự nhiên hơn
- Bài test local các flow chính đã pass:
  - PvP mở ván và nối đúng
  - PvE mở ván và bot nối lại
  - Timeout kết thúc session sạch
  - `!abc` trả hướng dẫn thay vì bị tính là câu chơi
  - `!play` khi phòng trống mở ván mới
  - `!stop` kết thúc ván hiện tại
  - Tin nhắn bắt đầu bằng `!` không bị tính là câu nối từ

## Chưa đạt

- Chưa restart lại bot local sau bản sửa mới
- Chưa xác nhận trực tiếp trên phòng test Discord sau khi sửa
- Bộ từ vẫn cần tiếp tục mở rộng thêm theo ngữ cảnh tự nhiên

## Definition Of Done

Một bản sửa nối từ chỉ được coi là xong khi:

- flow đúng
- text đúng
- từ điển đủ ổn để không quá gượng
- không có timer spam
- không có duplicate bot process
- local pass
- restart xong bot vẫn đúng như local
