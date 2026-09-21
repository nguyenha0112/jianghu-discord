# Checklist phát hành game

Cập nhật: 2026-09-21

## Quy ước trạng thái

- `[x]` Đã có test và đạt.
- `[ ]` Chưa đạt, không được xem là hoàn thiện.
- `[~]` Có một phần nhưng cần bổ sung test hoặc vận hành thực tế.

## Checklist bắt buộc cho mọi game

### Trải nghiệm người dùng

- [ ] Người mới hiểu cách chơi trong một phút.
- [ ] `!play` mở game hoặc bảng chọn, không yêu cầu nhập ID nội bộ.
- [ ] Ưu tiên nút bấm; lệnh chữ chỉ là phương án phụ.
- [ ] Tất cả nội dung hiển thị là tiếng Việt có dấu.
- [ ] Nút cũ bị vô hiệu hóa hoặc trả lời rõ khi ván đã kết thúc.
- [ ] Người khác không thể điều khiển ván cá nhân.

### Hình ảnh

- [ ] Dùng PNG cho ảnh tổng hợp gửi Discord.
- [ ] Kích thước tối đa 1200×675; mục tiêu 900×420 cho bàn game ngang.
- [ ] Asset giữ đúng tỷ lệ, không kéo méo hoặc vượt vùng chứa.
- [ ] Nội dung dài được xuống dòng và giới hạn số dòng.
- [ ] Có script preview và test kích thước ảnh.
- [ ] Đã xem trực quan trên giao diện sáng/tối và mobile.

### Gameplay và interaction

- [ ] Interaction được `deferReply` hoặc `deferUpdate` trước tác vụ dài.
- [ ] Bấm hai lần không xử lý thưởng hai lần.
- [ ] Hai người thao tác cùng lúc không làm hỏng state.
- [ ] Có timeout/dọn ván treo và hoàn cược chính xác.
- [ ] Restart bot không giữ nút chết hoặc làm mất tiền.

### Dữ liệu và kinh tế

- [ ] Room config lưu Supabase và tự phục hồi sau lỗi mạng.
- [ ] Giao dịch có `_syncId` chống ghi trùng.
- [ ] Có giới hạn thưởng/cược theo ván và theo ngày.
- [ ] Ranking tách thành tích mùa và thành tích tổng.
- [ ] Mọi thay đổi Xu/XP/vật phẩm đều có transaction log.
- [ ] Schema/version dữ liệu được khai báo trong `game-catalog.json` hoặc migration.

### Kiểm thử và vận hành

- [ ] Có flow test cho đường thắng, thua, hòa và hủy.
- [ ] Có test người không phải chủ ván bấm nút.
- [ ] Có test Supabase lỗi rồi phục hồi.
- [ ] Có log đủ để tìm guild, channel, user và game.
- [ ] Health check phản ánh game service và dependency.
- [ ] Đã test trên môi trường staging trước production.

## Trạng thái hiện tại

| Game | Luồng cơ bản | Nút bấm | Ảnh chuẩn | Chống thao tác sai | Phục hồi ván sau restart | Reward cap | Kết luận |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nối Từ | [x] | Không áp dụng | [~] | [x] | [ ] | [~] | Beta |
| Vua Tiếng Việt | [x] | [~] | [~] | [x] | [ ] | [~] | Beta |
| Tài Xỉu | [x] | [x] | [~] | [~] | [ ] | [x] | Beta |
| Bầu Cua | [x] | [x] | [~] | [~] | [ ] | [x] | Beta |
| Xì Dách | [x] | [x] | [x] PNG 900×420 | [x] chủ ván + khóa channel | [~] khôi phục ván đang chơi | [x] | Beta tốt |
| Oẳn Tù Tì | [x] | [x] | Không bắt buộc | [x] khóa channel | [x] khôi phục lobby/lựa chọn | [x] 10 thắng/ngày | Beta |
| Quiz Nhanh | [x] | [x] | Không bắt buộc | [x] khóa channel + một lượt/người | [x] giữ hạn giờ | [x] 15 thắng/ngày | Beta |

## Kiểm tra Xì Dách đã đạt trong bản hiện tại

- [x] Dùng bộ 52 ảnh lá bài thật trong `assets/cards`.
- [x] Render PNG 900×420 thay cho SVG nhúng ảnh.
- [x] Năm lá nằm gọn trong vùng người chơi.
- [x] Nội dung kết quả tự xuống dòng và không tràn bảng.
- [x] Font tiếng Việt hiển thị đúng trong ảnh preview.
- [x] Nút Rút, Dừng, Xem lượt và Nhập cược có dấu.
- [x] Test flow xác nhận đúng định dạng và kích thước PNG.
- [x] Lưu session đang chơi trong cấu hình phòng để tiếp tục sau restart.
- [x] Khóa xử lý theo channel để chống hai interaction đồng thời.
- [x] Khóa bước mở ván để hai lệnh `!play` đồng thời chỉ trừ tiền một lần.
- [ ] Bảo đảm settlement đúng một lần nếu process chết đúng giữa lúc trả thưởng.
