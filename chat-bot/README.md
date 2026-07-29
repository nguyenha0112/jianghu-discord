# Chat Bot

Bot chat/TTS chạy riêng cho server Discord.

## Render

Nếu deploy riêng `chat-bot`:

- `Root Directory`: `chat-bot`
- `Build Command`: `npm install`
- `Start Command`: `npm start`

Nếu deploy cả `chat-bot` và `game-bot` chung một service ở repo root:

- `Root Directory`: để trống
- `Build Command`: `npm install`
- `Start Command`: `npm start`

Khi chạy kiểu chung một service, launcher ở repo root sẽ:

- đọc `DISCORD_TOKEN_1`, `DISCORD_CLIENT_ID_1` cho `chat-bot`
- đọc `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` cho `game-bot`

## Env tối thiểu cho chat-bot

```env
DISCORD_TOKEN_1=YOUR_CHAT_BOT_TOKEN
DISCORD_CLIENT_ID_1=YOUR_CHAT_BOT_CLIENT_ID
PREFIX=!
TTS_CACHE_ITEMS=100
TTS_COOLDOWN_MS=120000
TTS_HOSTS=https://translate.google.com,https://translate.google.com.vn
```
