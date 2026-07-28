# Client Requirements Summary

Cap nhat lan cuoi: 2026-07-28
Nguon goc: `Discord_Bot_Nghich_Thuy_Han_Project_Requirements_v0.1.docx`

## 1. Tong quan

Tai lieu khach hang dinh nghia day la mot `Discord community economy & game bot` lay cam hung tu he sinh thai `Nghich Thuy Han`, chay cho mot bang hoi khoang `80 thanh vien`.

Muc tieu khong phai la mot bot daily don gian, ma la:

- tang tuong tac cong dong
- tao economy ao co chieu sau
- tao vong lap nghe nghiep, thu thap, che tao va phan thuong
- duy tri dong luc dai han thong qua `Xu`, `Ngoc`, `Item`, `Monthly Reward`
- bo sung mini game `Noi Tu Viet Nam`

Tai lieu nhan manh:

- `Xu` va `Ngoc` la tien ao noi bo
- khong co nap tien
- khong quy doi thanh tien mat
- `The Thang` la qua duoc admin xet va trao thu cong theo chu ky

## 2. Cac tru cot requirement

### 2.1 Economy core

He thong can co:

- `Xu` la dong tien co ban
- `Ngoc` la dong tien premium trong game
- inventory, item rarity, chest, crafting material
- shop va reward loop
- cong cu admin de quan ly economy va user data

### 2.2 Progression

Nguoi choi can co:

- daily / activity rewards
- nghe nghiep
- gathering loop
- crafting loop
- reward theo thang
- progression lau dai thay vi chi quay thuong

### 2.3 Mini games

Doc hien tai xac nhan mini game `Noi Tu Viet Nam` nam trong pham vi v1, va de xuat:

- che do `strict`
- uu tien cum `2-4 am tiet`
- co `admin allowlist`

### 2.4 Operations

Can co:

- quyen admin / manager ro rang
- seed data
- migration script
- test plan
- integration test voi Discord staging guild
- runbook su co
- guide cho admin va member

## 3. Y nghia doi voi codebase hien tai

Tai lieu nay xac nhan huong di hien tai cua repo la dung:

- `game-bot` la runtime chinh cho gameplay
- progression va economy phai duoc tach thanh he thong ro rang
- mini game la mot phan trong ecosystem, khong phai toan bo san pham
- can co lop tai lieu va tracker de map requirement -> implementation

No cung xac nhan rang du an nay da vuot khoi muc `Discord economy bot` thong thuong va can duoc quan ly nhu mot `game systems project`.

## 4. Phan loai muc do uu tien

### P0 - Bat buoc cho v1 alpha / beta

- player profile, wallet, inventory
- `Xu` / `Ngoc` foundation
- nghe nghiep co ban va work loop
- item + crafting + shop MVP
- transaction audit co ban
- `Noi Tu Viet Nam` on-server, chay on dinh
- ranking / reward loop cho game
- admin command co ban de xem va kiem tra economy
- Supabase persistence

### P1 - Nen co truoc production

- monthly reward workflow
- rule / policy ro rang cho gift / trade / ngoc sink
- traceability giua design doc, requirement doc va code
- test automation ro hon cho economy va minigame
- asset / icon manifest

### P2 - Mo rong sau khi on dinh

- them nghe nghiep / progression sau
- dashboard admin
- seasonal balancing
- gift / trade co gioi han
- mo rong mini game khac

## 5. Cac diem khach hang da ngam dinh hoac de xuat

- `Ngoc` baseline: khong het han, nhung can co sink
- `Trade item`: de xuat tat trong MVP, hoac chi gift item pho thong sau beta
- `Monthly reward`: can cong thuc cham dua tren activity + bot usage
- `Nối Từ`: de xuat strict va co admin allowlist
- hosting / SLA: de dev de xuat sau khi chot stack

## 6. Asset va hinh anh khach hang gui

Nhung asset da gui kem:

- `Ruong Qua Tang.png`: asset dang chest / reward box
- `NGHE NGHIEP NAU AN.png`: icon nghe nau an
- `DAN LO THIEP.png`: item dang scroll / recipe / voucher, can xac nhan ten hien thi chinh thuc

De xuat:

- luu tat ca asset da duyet vao `game-bot/assets/client/`
- tao manifest ten file -> item id / profession id / reward id

## 7. Cac van de can owner chot

- ten chinh thuc cua mot so item / icon
- cong thuc xet `1-2 the thang`
- pham vi monthly reward workflow trong bot
- co su dung icon / asset hien tai cho production hay khong
- chuan tu dien va muc do strict cho `Noi Tu`
- danh sach nghe nghiep P0 chinh thuc

## 8. De xuat tiep theo cho repo

1. Dung tai lieu nay lam `north star` cho giai doan alpha.
2. Tao bang traceability requirement -> implementation -> test.
3. Chot danh sach `P0` va `P1` ngay trong repo.
4. Chi mo rong gameplay khi requirement P0 da ro va co tracker.
