# Game Bot Build Strategy

## Ket luan ngan

Nen `tu lam rieng`, khong clone nguyen mot repo economy bot roi custom.

## Ly do

- Vision cua Jianghu la `MMORPG progression`, khong phai `casino economy`.
- Nhieu bot public co san tap trung vao `beg`, `crime`, `rob`, `gamble`, `bank`, `slots`.
- Clone codebase lon thuong keo theo rat nhieu logic lech huong, kho audit va kho can bang lai.

## Nen hoc gi tu repo ngoai

### Hoc kien truc, khong hoc gameplay

- tach command handler
- tach storage va business logic
- dung slash commands
- giu config data rieng khoi runtime

### Repo tham khao

- `discordjs/discord.js`
  - de lay wrapper chinh thong va huong bot hien dai
  - co nhac den `create-discord-bot` trong package list

- `DEVUCP/EconBot`
  - co cach tach `commands`, `econ`, `saveload`
  - huu ich de tham khao chia module
  - khong nen clone gameplay va persistence sang Jianghu

- `CorwinDev/Discord-Bot`
  - cho thay mot bot lon rat nhanh bi phinh to va kho giu focus domain
  - khong phu hop lam base cho game bot rieng

- `discord/discord-example-app`
  - huu ich de tham khao interactions co ban, slash command, button, select menu

## Huong ap dung cho repo nay

- Utility bot giu o `chat-bot`
- Game bot moi nam o `game-bot`
- Tai lieu design va mandate van la source of truth
- Khi MVP on dinh, doi JSON storage sang PostgreSQL hoac MongoDB
