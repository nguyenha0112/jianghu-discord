# Supabase Setup

## Muc tieu

Day la schema Supabase v1 cho `game-bot`. Hien tai bot van dang dung JSON storage de chay nhanh, nhung schema nay da san sang de chuyen sang Postgres khi can.

## Cach dung

1. Mo Supabase project cua ban.
2. Vao `SQL Editor`.
3. Chay file [schema.sql](/C:/Users/Admin/Desktop/discord_server_bot/game-bot/supabase/schema.sql:1).
4. Cap nhat `.env` local voi:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
5. Chay:

```powershell
cd game-bot
npm install
npm run db:test
```

## Ghi chu bao mat

- Publishable key co the dung de khoi tao client, nhung voi bot server-side thi ve sau nen doi sang `service_role` key rieng.
- Supabase docs khuyen bat RLS cho cac bang lo qua Data API, va khong expose service role key ra client public.
- Hien tai schema moi mo quyen cho `service_role`, an toan hon cho huong backend bot.
