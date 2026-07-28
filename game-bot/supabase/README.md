# Supabase Setup

## Mục tiêu

Đây là schema Supabase cho `game-bot`. Hiện bot vẫn có lớp fallback JSON để tránh bị chặn khi schema chưa cập nhật, nhưng để hệ `tu luyện / đột phá / linh căn / động phủ` chạy đồng bộ thì bạn nên áp dụng đủ cả schema gốc và migration mới.

## Cách dùng

1. Mở Supabase project của bạn.
2. Vào `SQL Editor`.
3. Chạy file [schema.sql](/C:/Users/Admin/Desktop/discord_server_bot/game-bot/supabase/schema.sql:1) nếu project còn trống.
4. Sau đó chạy migration [2026-07-28_add_cultivation_columns.sql](/C:/Users/Admin/Desktop/discord_server_bot/game-bot/supabase/2026-07-28_add_cultivation_columns.sql:1).
5. Nếu bạn đang dùng bản tu tiên mới hơn, chạy tiếp [APPLY_THIS_FOR_TU_TIEN.sql](/C:/Users/Admin/Desktop/discord_server_bot/game-bot/supabase/APPLY_THIS_FOR_TU_TIEN.sql:1).
6. Cập nhật `.env` local với:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - hoặc tốt hơn là key server-side phù hợp nếu bạn tách môi trường sau này
7. Chạy:

```powershell
cd game-bot
npm install
npm run db:test
```

## Trạng thái schema hiện tại

Sau migration ngày `July 28, 2026`, bảng `players` cần có thêm:

- `cultivation_realm text not null default 'pham_nhan'`
- `cultivation_realm_index integer not null default 0`
- `cultivation_spirit_root text not null default 'thuy'`
- `cultivation_dwelling_level integer not null default 1`

Các cột này dùng cho:

- cảnh giới hiện tại
- giới hạn cấp đạo tu theo cảnh giới
- lệnh `/dotpha`
- lệnh `/tutien`
- lệnh `/dongphu`
- hệ linh căn và bonus theo đạo tu
- hệ động phủ và bonus farm

## Ghi chú bảo mật

- Publishable key có thể dùng để khởi tạo client, nhưng với bot server-side thì về sau nên đổi sang key backend phù hợp hơn.
- Supabase khuyến nghị bật RLS cho các bảng lộ qua Data API và không expose key quyền cao ra client public.
- Hiện tại schema chỉ mở quyền đầy đủ cho `service_role`, phù hợp với hướng backend bot.

## Nếu chưa chạy migration

Nếu bạn chưa chạy migration `2026-07-28_add_cultivation_columns.sql` và `APPLY_THIS_FOR_TU_TIEN.sql`, bot vẫn sẽ chạy nhờ fallback JSON local, nhưng:

- dữ liệu `cảnh giới / đột phá / linh căn / động phủ` sẽ không lưu đúng trên Supabase
- log sẽ xuất hiện cảnh báo thiếu cột mới trong bảng `players`
- dữ liệu sẽ bị lệch giữa local và remote
