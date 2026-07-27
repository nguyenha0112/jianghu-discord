# Jianghu Discord

`Jianghu Discord` la repo thiet ke va van hanh cho mot game-community tren Discord theo huong MMORPG thu nho. Repo nay dong vai tro `source of truth` cho vision, economy, progression va cac mandate he thong, dong thoi chuan bi nen tang de sau nay trien khai bang Wabbit hoac custom Discord bot.

## Cau truc repo

- [MASTER_DESIGN_DOCUMENT.md](/C:/Users/Admin/Desktop/discord_server_bot/MASTER_DESIGN_DOCUMENT.md:1): kim chi nam tong the cua project
- [mandates](/C:/Users/Admin/Desktop/discord_server_bot/mandates): cac mandate chia theo tung he thong
- [chat-bot](/C:/Users/Admin/Desktop/discord_server_bot/chat-bot): bot TTS hien tai, duoc giu rieng voi vai tro utility bot
- [game-bot](/C:/Users/Admin/Desktop/discord_server_bot/game-bot): khung game bot rieng cho economy, profession va reward loop
- `.github/workflows`: CI de kiem tra code va quet secret truoc khi merge

## Kien truc de xuat

Repo nay dang di theo 3 lop tai lieu:

1. `Design`: vision, philosophy, gameplay loop
2. `Systems`: economy, currency, profession, item, crafting, reward
3. `Implementation`: mapping sang Wabbit, Discord bot, dashboard va van hanh

Huong de xuat:

- Giu bot TTS hien tai lam utility bot.
- Tao them game bot rieng de quan ly profile, inventory, nghe nghiep, reward va audit log.
- Dung repo nay lam noi khoa luat va design truoc khi code he thong runtime.

## Huong xay dung game bot

Khuyen nghi hien tai la `tu lam rieng, nhung tham khao mau kien truc`, khong clone nguyen mot bot economy co san.

Ly do:

- economy bot public thuong nhieu casino, crime, rob, gamble va loop khong hop vision cua project
- codebase co san hay lon va kho cat bo logic lech huong
- Jianghu can source of truth nam trong mandate va config rieng

Nhung co the hoc tu:

- `discord.js` de dung wrapper chinh thong va scaffold bot hien dai
- `EconBot` de tham khao cach tach `commands`, `econ`, `storage`
- mot so template slash-command de lay handler pattern, khong lay game logic

## CI/CD va an toan secret

Repo da duoc bo sung:

- `.gitignore` de tranh commit file nhay cam va artifact local
- GitHub Actions de:
  - cai dependency trong `chat-bot`
  - chay `node --check index.js`
  - quet secret trong lich su commit va workspace bang `gitleaks`

Khuyen nghi:

- Luon dat token trong GitHub Secrets hoac file `.env` local, khong hardcode.
- Bat `push protection` va `secret scanning` trong GitHub neu repo dung goi co ho tro.
- Bao ve nhanh `master` branch bang PR rule neu sau nay co nhieu nguoi cung sua.

## Bat dau nhanh

Neu muon chay bot TTS hien tai:

```powershell
cd chat-bot
npm install
copy .env.example .env
# sua DISCORD_TOKEN trong .env
npm start
```

## Tai lieu uu tien tiep theo

Nen khoa tiep cac phan:

1. item list va currency matrix
2. profession action loop
3. reward cap va monthly eligibility
4. data schema cho game bot
