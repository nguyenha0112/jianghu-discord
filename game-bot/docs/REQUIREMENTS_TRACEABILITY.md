# Requirements Traceability

Cap nhat lan cuoi: 2026-07-28

Bang nay map `requirement khach hang` -> `trang thai trong repo` -> `buoc tiep theo`.

| Requirement | Trang thai | Hien trang | Buoc tiep theo |
| --- | --- | --- | --- |
| Player profile / wallet / inventory | Done MVP | Da co trong `game-bot` va da chuyen sang Supabase | Them test va polish UI message |
| Dual currency `Xu` / `Ngoc` | Done foundation | Da co nen tang tien te | Can balancing, sink va monthly flow |
| Profession loop | Partial | Da co work / nghe nghiep co ban va tu tien progression | Chot danh sach nghe P0 va route progression |
| Gathering / crafting / shop | Partial | Da co MVP | Can balance recipe, rarity va content data |
| Transaction audit | Done MVP | Da co transaction log | Them admin report sau hon |
| Monthly reward | Missing workflow | Moi co dinh huong design | Can tai lieu hoa va code workflow xet thuong |
| Nối Từ Việt Nam | Partial but live | Da chay trong server, co room gamification va reward | Can tiep tuc polish strict mode, data va admin allowlist |
| Vua Tieng Viet | Partial | Da co gameplay co ban | Can mo rong data, hint va moderation tools |
| Admin economy controls | Partial | Da co mot so command co ban | Can map quyen va command policy ro hon |
| Asset system / icon mapping | Missing | Moi co asset roi rac | Can tao manifest asset |
| Seed / migration scripts | Partial | Supabase SQL va data dang co mot phan | Can chot seed v1 |
| Unit / integration testing | Partial | Co CI syntax level | Can them test cho economy va minigame |
| Member / admin guide | Partial | Co README va mot so docs | Can tong hop guide theo role |
| Production acceptance | Missing | Chua co UAT checklist | Can tao checklist beta / UAT |

## Uu tien de lam tiep

### Uu tien ngay

- [x] Tai lieu hoa requirement khach hang trong repo
- [x] Tao bang traceability
- [ ] Tao asset manifest
- [ ] Chot monthly reward workflow MVP
- [ ] Them config / allowlist cho `Noi Tu strict`

### Sau do

- [ ] Test automation cho economy loop
- [ ] Test automation cho `Noi Tu` / `Vua Tieng Viet`
- [ ] Member guide va admin guide
- [ ] Seed data V1
