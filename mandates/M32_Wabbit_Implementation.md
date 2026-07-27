# M32 Wabbit Implementation

## Muc dich

Anh xa design document sang lop trien khai tren Discord va cac cong cu bot.

## Implementation Layers

### Layer A - Game Design Source of Truth

Tai lieu trong repo nay la nguon dung cho:

- vision
- rules
- balance
- reward policy

### Layer B - System Configuration

Dung cho:

- item list
- currency rules
- recipe list
- cooldown values
- shop rotation

### Layer C - Runtime Execution

Co the duoc thuc thi boi:

- WabbitBot
- custom Discord bot
- dashboard admin

## Recommendation: Tao them mot bot game rieng

### Vi sao

Bot TTS hien tai trong [chat-bot/index.js](/C:/Users/Admin/Desktop/discord_server_bot/chat-bot/index.js) co muc tieu utility, khong phu hop de gánh:

- transaction economy
- inventory
- reward audit
- minigame / event
- anti-abuse

### Architecture de xuat

`Game Bot Modules`

- command router
- player profile service
- inventory service
- profession service
- crafting service
- shop service
- reward service
- logging / audit service
- admin tools

`Data`

- `players`
- `wallets`
- `inventories`
- `transactions`
- `profession_progress`
- `recipes`
- `reward_claims`

### Discord Feature De xuat

- slash commands thay cho prefix spam
- button / select menu cho action loop
- embed profile / inventory / shop
- log channel rieng cho reward va economy alerts

## Wabbit Mapping Strategy

Neu truoc mat dung Wabbit:

- Wabbit xu ly phan command / config nhanh
- Repo nay giu rules va mandate
- Moi cau hinh Wabbit phai tham chieu lai mandate lien quan

Neu sau nay custom bot:

- giu nguyen design va rules
- thay lop runtime
- co the dung chung database va admin model moi

## Operational Checklist

- moi command reward co cooldown
- moi giao dich co log
- moi item / currency co id on dinh
- moi event co cap reward
- moi quyen admin reward bi han che
