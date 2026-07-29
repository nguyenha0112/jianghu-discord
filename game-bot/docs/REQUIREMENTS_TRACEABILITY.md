# Requirements Traceability

Cap nhat lan cuoi: 2026-07-29

Bang nay map `requirement khach hang` -> `trang thai trong repo` -> `buoc tiep theo`.

| Requirement | Trang thai | Hien trang | Buoc tiep theo |
| --- | --- | --- | --- |
| Player profile / wallet / inventory | Done MVP | Da co trong `game-bot` va da chuyen sang Supabase | Polish UI va giam fallback JSON |
| Dual currency `Xu` / `Ngoc` | Done foundation | Da co nen tang tien te va monthly reward flow MVP | Can balancing, sink va cap thuong |
| Profession loop | Partial strong foundation | Da co work / nghe nghiep co ban va tu tien progression | Chot danh sach nghe P0 va route progression day du |
| Gathering / crafting / shop | Partial | Da co MVP | Can balance recipe, rarity va content data |
| Transaction audit | Done MVP | Da co transaction log va admin transaction view | Them report / filter sau hon |
| Monthly reward | Done MVP | Da co workflow co ban va command admin | Can tiep tuc balance va tiep can end-user |
| Noi Tu Viet Nam | Live partial-complete | Da chay trong server, co room gamification, PvP/PvE, reward, checkpoint PvP | Can strict mode, allowlist va balancing full pass |
| Vua Tieng Viet | Live partial-complete | Da co gameplay co ban, xao toan bo ky tu, goi y tru diem, mo rong data | Can tiep tuc data curated, hint tuning va moderation tools |
| Tai Xiu | Done MVP | Da co room system, button UI, settle flow, reward co ban | Can balance kinh te va polish UI them |
| Tu tien / bi canh / phap bao / dong phu | Partial strong foundation | Da co framework va command nen | Can content data, combat progression va reward loop |
| Admin economy controls | Partial | Da co mot so command co ban | Can map quyen va command policy ro hon |
| Asset system / icon mapping | Done MVP | Da co manifest asset va banner co ban | Can mo rong art / icon sau |
| Seed / migration scripts | Partial | Supabase SQL va data dang co mot phan | Can chot seed v1 |
| Unit / integration testing | Partial good | Co CI syntax level va test script cho minigame chinh | Can them test economy / balancing / migration |
| Member / admin guide | Partial | Co README va mot so docs | Can tong hop guide theo role |
| Production acceptance | Missing | Chua co UAT checklist | Can tao checklist beta / UAT |

## Uu tien de lam tiep

### Uu tien ngay

- [x] Tai lieu hoa requirement khach hang trong repo
- [x] Tao bang traceability
- [x] Tao asset manifest
- [x] Chot monthly reward workflow MVP
- [ ] Economy balancing v1
- [ ] Reward scaling full pass cho minigame
- [ ] Them config / allowlist cho `Noi Tu strict`
- [ ] Sua schema Supabase cultivation de bo fallback JSON

### Sau do

- [ ] Test automation cho economy loop
- [ ] Test automation cho `Noi Tu` / `Vua Tieng Viet` / `Tai Xiu`
- [ ] Member guide va admin guide
- [ ] Seed data V1
- [ ] UAT checklist / production acceptance
