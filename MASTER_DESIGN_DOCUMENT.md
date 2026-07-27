# MASTER DESIGN DOCUMENT

## 1. Executive Summary

`Jianghu Discord` la mot game-design project duoc van hanh tren Discord, trong do bot khong chi dong vai tro cong cu tu dong hoa ma la lop runtime cho mot "MMORPG thu nho". Muc tieu cua project la bien server thanh mot bang hoi song dong, noi member co the phat trien nhan vat, theo duoi nghe nghiep, thu thap tai nguyen, che tao vat pham, tich luy bo suu tap va nhan cac phan thuong co gia tri theo thoi gian.

Project nay khong duoc thiet ke theo huong economy bot thong thuong nhu `daily -> nhan tien -> quay thuong`, ma theo huong progression game: thoi gian, lua chon, dau tu va su gan bo lau dai se tao ra gia tri.

Pham vi cua giai doan dau:

- Xay dung tam nhin va triet ly thiet ke ro rang.
- Dinh nghia cac he thong cot loi: economy, currency, rarity, profession, item, crafting, shop, reward.
- Tach biet giua lop thiet ke game va lop trien khai Discord/Wabbit.
- Chuan bi tai lieu de sau nay co the doi tu Wabbit sang custom bot, web app, hoac hybrid system ma khong phai viet lai game design.

## 2. Vision

Server huong toi viec tro thanh:

> Mot Bang Hoi Nghịch Thủy Hàn tren Discord, noi member co the trai nghiem cam giac phat trien nhan vat, lam nghe, suu tam vat pham va nhan nhung phan thuong gia tri thong qua qua trinh hoat dong lau dai thay vi chi diem danh hay quay thuong.

Tam nhin nay co 4 y nghia:

- Discord la sanh choi, khong chi la kenh chat.
- Mọi thanh vien deu co mot hanh trinh ca nhan de theo duoi.
- Gia tri den tu tien do va danh tinh, khong den tu may man don le.
- Phan thuong ngoai doi co the ton tai, nhung khong duoc pha vo can bang game.

## 3. Design Philosophy

### 3.1 Easy to Start

Nguoi moi vao server phai hieu duoc core loop trong 3 phut:

- Join va verify.
- Nhan daily dau tien.
- Chon mot nghe.
- Lam mot hanh dong co reward ro rang.
- Nhin thay mot muc tieu tiep theo gan, de hieu "neu o lai minh se con mo khoa duoc gi nua".

Khong duoc bat member doc wiki dai, hoc nhieu command, hay nho quy trinh phuc tap truoc khi choi.

### 3.2 Long-term Progression

Core progression khong duoc dung lai o `daily`.

Loop mong muon:

`Daily -> Job Action -> Material -> Craft -> Xu -> Ngoc -> Cosmetic / Ticket / Monthly Reward -> Collection -> Prestige -> Tiep tuc phat trien`

Nguoi choi phai luon thay con mot muc tieu tiep theo, ngan han va dai han song song.

### 3.3 Fair Progression

Project ap dung 4 nguyen tac:

- Khong pay to win.
- Khong donate de mua suc manh.
- Khong admin phat giau truc tiep.
- Khong de hinh thanh "giai cap giau vinh vien" khong the bat kip.

Can bang duoc tao boi luat he thong, sink, reset mem va cap nhat content, khong dua vao can thiep tay thuong xuyen cua admin.

### 3.4 Casual Friendly

Mot member chi online Discord 15-20 phut moi ngay van phai:

- choi duoc
- kiem duoc
- tien bo duoc

Project phai ton trong nhom nguoi choi it thoi gian. Hardcore player co the toi uu nhanh hon, nhung casual player khong duoc bi loai bo khoi vong choi.

### 3.5 MMORPG Feeling

Day la linh hon cua du an.

Nguoi choi phai cam thay:

> "Minh dang choi mot MMORPG thu nho."

Khong duoc de trai nghiem bien thanh:

> "Minh dang spam command trong Discord."

Cam giac MMORPG den tu:

- nghe nghiep
- cap do
- vat pham
- do hiem
- crafting
- collection
- cosmetic
- title
- role
- event
- endgame

## 4. Gameplay Pillars

Nam tru cot gameplay:

1. `Profession`: moi nguoi choi co mot huong phat trien thong qua nghe.
2. `Collection`: thu thap material, item, rarity, set va ky vat.
3. `Crafting`: bien tai nguyen thanh gia tri cao hon.
4. `Economy`: tao dong chay gia tri giua thoi gian, hanh dong, tai nguyen va phan thuong.
5. `Guild Identity`: duy tri cam giac bang hoi, danh hieu va sinh hoat cong dong.

## 5. Player Journey

Journey muc tieu:

`Join Server -> Verify -> Welcome Quest -> Daily -> Chon nghe -> Farm -> Co Xu -> Mua Tool -> Farm nhanh hon -> Co do hiem -> Co Ngoc -> Mua Cosmetic / Ticket -> Co danh hieu / role -> Tiep tuc phat trien`

Journey nay can dat duoc 3 yeu cau:

- Som co reward de tao dong luc.
- Som mo ra quyet dinh de tao dau an ca nhan.
- Luon co visible next step de giu ty le quay lai.

## 6. Economy Loop

Loop tong:

`Thoi gian -> Hoat dong -> XP -> Profession Level -> Material -> Craft -> Xu -> Ngoc -> Item -> Collection -> Title / Cosmetic / Reward -> Tiep tuc choi`

Economy loop can co:

- `sources`: daily, action, event, quest, exchange gioi han.
- `transforms`: refine, craft, combine, upgrade.
- `sinks`: shop, cosmetic, recipe, ticket, reroll, enhancement, guild contribution.
- `aspiration`: title, collection, prestige, monthly reward.

## 7. Reward Philosophy

Reward duoc chia 4 tang:

1. `Tier 1 - Xu`: dong tien co ban, de mua tool, vat pham pho thong, phi craft.
2. `Tier 2 - Item`: vat pham, nguyen lieu, consumable, tool, cosmetic part.
3. `Tier 3 - Ngoc`: tai nguyen premium trong game, han che source, dung cho phan thuong gia tri cao.
4. `Tier 4 - Monthly Reward`: muc tieu dai han, co the la the thang, nitro-like reward, qua luu niem, role dac biet.

Monthly reward khong phai dich den duy nhat. Neu khong cham toi tier 4, member van phai co nhieu thu de theo duoi:

- cosmetic
- collection
- title
- profession mastery
- level milestone
- guild status

## 8. Progression Timeline

### Ngay dau

- Join, verify, nhan onboarding.
- Nhan daily dau.
- Chon nghe dau tien.
- Thuc hien 1-3 action co ket qua ro rang.

### Tuan dau

- Co tool co ban.
- Co item dau tien co rarity.
- Hieu cach kiem Xu va material.
- Co mot muc tieu ngan han cu the.

### Thang dau

- Nghe nghiep dat cap trung binh.
- Mo khoa craft co y nghia.
- Co cosmetic hoac collection dau tien.
- Bat dau tich luy Ngoc.

### Sau 3 thang

- Co collection hoan chinh.
- Co title, role, prestige marker.
- Tham gia content endgame hoac bang hoi.
- Co ly do de tiep tuc online lau dai.

## 9. Economy Principles

Nhung dieu khong duoc xay ra:

- `Daily -> co ngay 300 Ngoc`
- `Casino / may man -> co the thang Monthly Reward`
- `Donate -> co do hiem / loi the progression`
- `Admin handout -> pha vo gia tri thi truong`

Nhung nguyen tac phai duoc giu:

- Premium currency phai kho kiem hon, nhung van tiep can duoc qua choi.
- Rare item phai co cau chuyen nguon goc va muc dich.
- Nguoi choi moi co cach bat kip mot phan nguoi cu thong qua update, reset mem, content theo mua, catch-up layer.

## 10. Discord Bot Strategy

### 10.1 Tai sao nen tach them mot bot game

Project hien co mot bot TTS nho trong [index.js](/C:/Users/Admin/Desktop/discord_server_bot/chat-bot/index.js). Bot nay phu hop cho voice utility, nhung khong nen tro thanh noi chua toan bo game logic vi:

- game state se tang nhanh ve do phuc tap
- economy can logging, anti-abuse, cooldown, transaction audit
- game commands va voice logic co vong doi khac nhau
- khi fix game hoac deploy reward, khong nen anh huong den TTS feature

Khuyen nghi:

- Giu bot TTS hien tai thanh `utility bot`.
- Tao them mot `game bot` rieng cho economy, profession, crafting, shop, reward.
- Neu can, tao them `ops bot` hoac dashboard sau nay cho admin.

### 10.2 Kien truc de xuat

`Bot 1 - Utility Bot`

- voice / TTS
- helper command don gian
- moderation nhe neu can

`Bot 2 - Jianghu Game Bot`

- slash commands va button UI
- player profile
- profession action
- inventory
- crafting
- shop
- event
- reward distribution
- anti-cheat rule
- audit log

`Shared Data Layer`

- database: PostgreSQL hoac MongoDB
- transaction log
- config versioning
- admin dashboard / JSON config / Wabbit mapping

### 10.3 Nguyen tac van hanh bot game

- Moi reward co source ro rang.
- Moi currency change phai log duoc.
- Moi command quan trong phai idempotent neu co retry.
- Moi cooldown phai luu server-side.
- Moi monthly reward phai co audit trail.

## 11. Document Architecture

Toan bo tai lieu duoc chia thanh 3 lop:

### Lop 1 - Design

Tra loi tai sao he thong ton tai:

- vision
- philosophy
- gameplay loop
- player journey

### Lop 2 - Systems

Mo ta he thong van hanh nhu the nao:

- currency
- rarity
- economy rules
- profession
- item
- crafting
- shop
- reward

### Lop 3 - Implementation

Anh xa systems sang cong cu trien khai:

- Wabbit configuration
- Discord channel / role / permission model
- custom bot command model
- database schema
- admin operation

Loi ich cua cach chia nay:

- co the doi cong nghe ma khong doi design
- giam phu thuoc vao mot bot cu the
- de maintain, onboarding va mo rong

## 12. Mandate Roadmap

Thu tu de xuat:

### Nhom 1 - Nen tang du an

- `M00_Project_Vision.md`
- `M01_Economy_Core.md`
- `M02_Currency_System.md`
- `M03_Rarity_and_Value.md`
- `M04_Server_Economy_Rules.md`

### Nhom 2 - Nghe nghiep

- `M10_Profession_Core.md`
- `M11_Fishing.md`
- `M12_Mining.md`
- `M13_Gathering.md`
- `M14_Alchemy.md`
- `M15_Archaeology.md`

### Nhom 3 - Vat pham va che tac

- `M20_Item_System.md`
- `M21_Tool_and_Consumable.md`
- `M22_Drop_Table.md`
- `M23_Crafting_Recipes.md`

### Nhom 4 - Van hanh va phan thuong

- `M30_Shop_and_Progression.md`
- `M31_Monthly_Reward.md`
- `M32_Wabbit_Implementation.md`

## 13. Next Steps

Sau bo master nay, thu tu lam viec nen la:

1. Khoa `M00 -> M04` de co luat nen.
2. Viet `M10 -> M15` de dinh hinh nghe nghiep.
3. Viet `M20 -> M23` de co vat pham va crafting.
4. Viet `M30 -> M32` de khoa van hanh, reward va implementation.
5. Sau do moi chot schema bot, dashboard va backlog ky thuat.
