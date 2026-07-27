# Discord Vietnamese TTS Bot

Bot đơn giản cho Discord: join/leave voice channel và đọc tin nhắn tiếng Việt từ kênh text.

Setup nhanh:

1. Cài Node.js (v16+).
2. Cài ffmpeg (bắt buộc để chuyển đổi audio). Đảm bảo `ffmpeg` nằm trong PATH.
3. Clone repo và cài dependencies:

```bash
npm install
```

4. Tạo file `.env` dựa trên `.env.example` và đặt `DISCORD_TOKEN` của bot.

5. Chạy bot:

```bash
npm start
```

Commands:
- `!join` — bot sẽ join voice channel của bạn và bắt đầu đọc tin nhắn ở kênh text hiện tại.
- `!leave` — rời voice channel.
- `!tts <nội dung>` — cho bot đọc nội dung ngay lập tức.

Ghi chú:
- Bot dùng `google-tts-api` với ngôn ngữ `vi` để tạo audio mp3, và `ffmpeg` để transcode sang PCM cho Discord.
- Đảm bảo bot có quyền `Connect` và `Speak` trong voice channel, và quyền đọc gửi tin nhắn trong text channel.
