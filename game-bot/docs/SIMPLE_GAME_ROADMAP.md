# Kế hoạch hệ thống game đơn giản và đa dạng

Cập nhật: 2026-09-21

## Mục tiêu

Bot ưu tiên trò chơi hiểu trong dưới một phút, mở bằng `!play`, có nút bấm khi phù hợp và dùng chung một ví Xu. Mỗi game phải tách phòng, có giới hạn thưởng, log giao dịch và test luồng người dùng trước khi phát hành.

## Phạm vi production gọn

Giữ lại:

- Hồ sơ, cấp nhân vật, ví Xu/Ngọc và kho đồ.
- Daily, nghề nghiệp đơn giản, shop, bán đồ và crafting.
- Nối Từ, Vua Tiếng Việt, Tài Xỉu, Bầu Cua và Xì Dách.
- Một lệnh `/admin` để cấu hình phòng và công cụ quản trị.

Tạm ẩn:

- Tu tiên, đột phá, động phủ, pháp bảo và bí cảnh.
- Code và dữ liệu cũ vẫn được giữ để không mất tiến độ và có thể khôi phục.
- Nghề nghiệp dùng cấp độc lập từ 1 đến 50, không yêu cầu đột phá.

## Nguyên tắc thêm game

Mỗi game mới phải có cùng cấu trúc:

1. Room store lưu bằng Supabase và có hàng chờ phục hồi.
2. Service xử lý trạng thái, cooldown và chống xử lý trùng interaction.
3. Giao diện `!play`, nút bấm và `!huongdan`; hạn chế thêm slash command riêng.
4. Reward policy có mức cược/thưởng tối thiểu, tối đa và giới hạn theo ngày.
5. Transaction log ghi đầy đủ thay đổi Xu, XP và vật phẩm.
6. Test bao phủ hai người thao tác đồng thời, bấm nút hai lần, restart giữa ván và Supabase tạm mất kết nối.

## Danh sách game đề xuất

### P0 - Oẳn Tù Tì đối kháng

- Hai người tham gia bằng nút, chọn kín Búa/Kéo/Bao.
- Ván nhanh 20 giây, dễ hiểu, không cần bộ dữ liệu lớn.
- Thưởng nhỏ cho người thắng; hòa thì hoàn cược.

### P0 - Quiz nhanh

- Bot đưa câu hỏi và bốn nút đáp án trong 20 giây.
- Chủ đề: tiếng Việt, Nghịch Thủy Hàn, kiến thức vui và server.
- Bộ câu hỏi có file candidate/review giống Vua Tiếng Việt.

### P1 - Phản xạ nhanh

- Bot mở sự kiện ngẫu nhiên; người đầu tiên bấm đúng nút nhận điểm.
- Có cooldown phòng và giới hạn thưởng ngày để tránh farm.
- Không phụ thuộc từ điển, phù hợp phòng chat đông.

### P1 - Đoán hình/emoji

- Một chuỗi emoji hoặc hình pixel gợi ý đồ vật, địa danh hay thành ngữ.
- Dùng bộ câu hỏi đã duyệt, hỗ trợ gợi ý đổi lấy giảm thưởng.

### P2 - Bingo cộng đồng

- Người chơi nhận bảng 3x3; bot quay số theo nhịp.
- Một ván dài hơn, dùng cho event server thay vì farm hằng ngày.

## Thứ tự triển khai

### Giai đoạn 1 - Dọn nền

- [x] Ẩn năm command tu tiên khỏi production.
- [x] Đổi nghề nghiệp thành progression độc lập, tối đa cấp 50.
- [x] Giữ dữ liệu cũ và feature flag `ENABLE_CULTIVATION_SYSTEM`.
- [ ] Chuẩn hóa `/admin` thành danh sách game và thao tác tạo/xóa phòng.
- [ ] Tạo cấu hình reward cap dùng chung cho mọi game.

### Giai đoạn 2 - Game nhẹ

- [x] Xây Oẳn Tù Tì PvP.
- [ ] Xây Quiz nhanh và công cụ duyệt câu hỏi.
- [ ] Thêm ranking theo mùa, không xóa thành tích tổng.

### Giai đoạn 3 - Vận hành

- [ ] Dashboard trạng thái phòng, số người chơi và lỗi gần nhất.
- [ ] Báo cáo Xu sinh ra/tiêu đi theo ngày.
- [ ] Cảnh báo game có tỷ lệ lỗi hoặc payout bất thường.
- [ ] UAT checklist cho mobile, desktop và nhiều người chơi đồng thời.

## Tiêu chí phát hành một game

- Không cần nhập ID nội bộ để chơi.
- Người mới nhìn topic phòng biết cách bắt đầu.
- Không trả lời interaction quá ba giây.
- Không trả thưởng hai lần khi bấm nút lặp.
- Restart bot không làm mất tiền hoặc kẹt ván.
- Tất cả nội dung người dùng nhìn thấy là tiếng Việt có dấu.
- Có test tự động và hướng dẫn quản trị trước khi bật production.
