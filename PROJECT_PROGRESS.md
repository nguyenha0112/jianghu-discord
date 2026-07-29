# Project Progress

Cap nhat lan cuoi: 2026-07-29

## Design Documents

- [x] Master design document
- [x] Mandate nhom nen tang
- [x] Mandate nhom nghe nghiep
- [x] Mandate nhom item va crafting
- [x] Mandate nhom reward va implementation

## Repository Foundation

- [x] Khoi tao git repo va ket noi GitHub remote
- [x] Them README tong quan
- [x] Them CI co syntax check va secret scan
- [x] Them push guard cho file nhay cam
- [x] Them `WORKFLOW.md`
- [x] Them repo-local skill `jianghu-project-workflow`

## Utility Bot

- [x] Dua `chat-bot` vao repo
- [x] Sua dependency `chat-bot` de CI cai duoc
- [ ] Test voice flow end-to-end tren Discord

## Game Bot Core

- [x] Tao `game-bot` rieng
- [x] Login local thanh cong voi bot token
- [x] Slash command foundation
- [x] Player profile va storage JSON
- [x] Daily reward
- [x] Profession selection
- [x] Work loop
- [x] Inventory
- [x] Wallet
- [x] Sell item de doi Xu
- [x] Transaction log MVP
- [x] Noi tu MVP
- [x] Noi tu PvP / PvE live
- [x] Tai Xiu room system MVP
- [x] Vua Tieng Viet MVP
- [x] Chuyen Xu giua player

## Currency and Progression

- [x] Xu va Ngoc foundation
- [x] Player level va player XP
- [x] Tong hop thong ke kinh te co ban
- [x] Shop MVP
- [x] Crafting MVP
- [x] Tu tien foundation
- [x] Bi canh / dong phu / phap bao foundation
- [x] Currency sink balancing v1
- [ ] Reward scaling / anti-farm balancing v1

## Discord Runtime

- [x] Dang ky guild slash commands
- [x] Test lenh `ping`
- [x] Test lenh `daily`
- [x] Test lenh `work`
- [x] Test lenh `sell`
- [x] Test lenh `shop`
- [x] Test lenh `craft`
- [x] Test `wordchain:test`
- [x] Test `vttv:test`
- [x] Test `taixiu:test`

## Current Priority

- [x] Shop va crafting MVP
- [x] Admin economy log command
- [x] Noi tu reward balancing phase 1
- [x] Noi tu PvP checkpoint reward phase 1
- [x] Ket noi Supabase project
- [x] Test ket noi Supabase thanh cong
- [x] Chuyen player va transaction storage sang Supabase
- [x] Chuyen inventory/runtime hoan toan sang Supabase that
- [x] Game hoa phong noi tu
- [x] Tai lieu hoa requirement khach hang vao repo
- [x] Tao bang traceability requirement -> implementation
- [x] Asset manifest cho icon / item / profession
- [x] Monthly reward workflow MVP
- [x] Workflow.md + repo-local skill de khoa quy trinh lam viec
- [x] Level up announcement cho `daily` va `work`
- [x] Embed cute/icon cho reward slash command co ban

## Next Priority

- [ ] Economy balancing v1
- [ ] Reward scaling full pass cho Noi Tu / VTTV / Tai Xiu
- [ ] Supabase schema fix cho cultivation columns de bo fallback JSON
- [ ] Tool progression
- [ ] Recipe balance
- [ ] Noi Tu strict config / allowlist
- [ ] Vua Tieng Viet mo rong data curated medium / hard
- [ ] Daily / weekly quest system
- [ ] Admin controls / moderation tools cho minigame

## Priority Order

1. Economy balancing v1
2. Reward scaling full pass cho Noi Tu / VTTV / Tai Xiu
3. Tool progression + recipe balance
4. Noi Tu strict config / allowlist
5. Vua Tieng Viet mo rong data curated medium / hard
6. Daily / weekly quest system
7. Admin controls / moderation tools cho minigame
8. Supabase schema fix cho cultivation columns de bo fallback JSON

## Later Priority

- [ ] Seed data V1
- [ ] Production UAT checklist
- [ ] Member guide va admin guide
- [ ] Branch / PR production release flow docs
