# User Gameplay Test Checklist

Cap nhat lan cuoi: 2026-07-30

## Muc tieu

Tai lieu nay dung de test bot theo goc nhin nguoi choi that:

- vao phong va hieu cach choi nhanh
- bam nut, nhap lenh, nhan thuong khong bi loi
- 2 nguoi cung choi van on dinh
- khong bi "ung dung khong phan hoi"
- thong bao hien thi de doc, dung tieng Viet

## Cach danh dau

- `[ ]` chua test
- `[x]` dat
- `[!]` co van de can sua

---

## 1. Kiem tra truoc khi test

- [ ] Bot online trong server
- [ ] Slash command hien day du
- [ ] Room da tao dung game
- [ ] Tai khoan test co du Xu de choi
- [ ] Supabase dang ket noi on dinh
- [ ] Sau khi redeploy, room van con ton tai

Ghi chu:

```text
Ngay gio test:
Nguoi test:
Branch/commit:
Server:
Kenh:
```

---

## 2. Test chung cho moi game

### 2.1 Hieu luat nhanh

- [ ] Vao phong, doc 1 tin huong dan la hieu cach choi
- [ ] Ten nut, ten lenh, mo ta de doc
- [ ] Khong co loi font, loi dau tieng Viet, ky tu rac
- [ ] Khong co thong bao thua hoac trung lap gay roi

### 2.2 Lenh co ban

- [ ] `!play` hoat dong dung
- [ ] `!help` hoac `!huongdan` hoat dong dung
- [ ] `!trangthai` hoat dong dung
- [ ] `!stop` hoat dong dung
- [ ] Lenh sai cu phap se duoc bot nhac lenh dung

### 2.3 Interaction / nut bam

- [ ] Bam nut khong bi "Ung dung khong phan hoi"
- [ ] Bam 1 lan khong bi nhan 2 lan
- [ ] Bam nhanh 2-3 lan khong lam vo state
- [ ] Bam nut xong bang trang thai duoc cap nhat
- [ ] Neu khong du dieu kien, bot bao loi ro rang

### 2.4 Da nguoi choi

- [ ] 2 nguoi choi cung luc khong vo van
- [ ] 2 nguoi gui lenh lien tiep khong crash
- [ ] 2 nguoi bam nut lien tiep khong hong keo/van
- [ ] Reward, diem, Xu vao dung nguoi
- [ ] Nguoi khong co quyen khong chen vao luot cua nguoi khac neu game co turn

### 2.5 Kinh te

- [ ] Tru Xu dung luc dat cuoc
- [ ] Hoan Xu dung luc huy van
- [ ] Cong Xu dung luc thang
- [ ] Khong bi tru/cong 2 lan
- [ ] `!me`, vi, profile hien dung so du sau game

---

## 3. Kich ban test theo nguoi dung

### 3.1 Nguoi moi vao choi lan dau

- [ ] Vao dung phong game va nhin ten phong la hieu choi game gi
- [ ] Doc 1 thong bao ghim/huong dan la biet cach bat dau
- [ ] Tu minh go `!play` hoac thao tac nut ma khong can hoi them
- [ ] Neu go sai lenh, bot nhac lai lenh dung de hieu

### 3.2 Nguoi choi da quen game

- [ ] Co the vao phong va choi lien tuc khong bi roi mach
- [ ] Chuyen van moi nhanh, khong can thao tac thua
- [ ] Tin nhan bot khong qua nhieu den muc lam troi chat

### 3.3 Admin / nguoi quan ly

- [ ] Tao phong thanh cong
- [ ] Bat game dung phong
- [ ] Dung game, reset game, xem trang thai de hieu
- [ ] Sau redeploy khong phai tao lai phong thu cong

---

## 4. Noi Tu PvP

### Tao va mo van

- [ ] Tao phong noi tu PvP thanh cong
- [ ] `!play` mo van moi
- [ ] Tu mo dau khong qua kho
- [ ] Tu mo dau co random, khong lap 1 cum lien tuc

### Luat choi

- [ ] Cum dung duoc tick
- [ ] Cum sai bi danh dau X
- [ ] Cum lap trong vong cam bi tu choi dung
- [ ] Bot bao con bao nhieu luot moi duoc dung lai
- [ ] 2 nguoi cung noi lien tiep khong vo state

### End game

- [ ] Thang/thua/chot thuong dung
- [ ] Bang diem cap nhat dung
- [ ] Ket thuc van khong bi treo session cu

Ghi chu loi:

```text
```

---

## 5. Noi Tu PvE

### Bot doi dap

- [ ] `!play` mo dung van PvE
- [ ] Bot noi tiep duoc cum hop ly
- [ ] Bot khong lap lai 1 cum qua som
- [ ] Bot khong noi cum vo nghia ro rang

### Tranh loi game

- [ ] Nguoi choi nhap dung duoc tick
- [ ] Nguoi choi nhap sai bi X
- [ ] Lenh `!stop`, `!trangthai`, `!help` khong bi tinh la dap an
- [ ] Neu bot het tu hop ly thi xu ly van hop ly

Ghi chu loi:

```text
```

---

## 6. Vua Tieng Viet

### De bai

- [ ] `!play` tao cau hoi moi
- [ ] Cau hoi khong lap lai qua som
- [ ] Mau dap an dung so tieng/so cum
- [ ] Xao chu du kho nhung van giai duoc
- [ ] Goi y hien dung va co tru diem neu thiet ke co tru

### Choi nhieu nguoi

- [ ] 2 nguoi tra loi gan cung luc khong vo session
- [ ] Nguoi dung dau tien dung se duoc tinh diem
- [ ] Cau tra loi sai khong lam hong cau hoi

### Thuong

- [ ] Cong diem/Xu dung nguoi
- [ ] Ranking cap nhat dung

Ghi chu loi:

```text
```

---

## 7. Tai Xiu

### Tao keo

- [ ] `!play` mo keo moi
- [ ] Bang cuoc hien dung
- [ ] Nut Tai/Xiu/Chan/Le/So hien dung
- [ ] Nhap modal khong bi "Ung dung khong phan hoi"

### Dat cuoc

- [ ] 1 nguoi dat 1 cua thanh cong
- [ ] 1 nguoi dat nhieu cua thanh cong
- [ ] 2 nguoi dat cung luc khong hong bang cuoc
- [ ] So du tru dung ngay khi dat
- [ ] Khong bi dat 2 lan khi bam nhanh

### Chot keo

- [ ] Het gio bot tu lac
- [ ] Bam nut `Chot keo` hoat dong
- [ ] `!chot` hoat dong
- [ ] Ket qua xuc xac dung
- [ ] Tinh lai/lo dung

### Can test spam

- [ ] 1 nguoi mo modal roi bam lai lien tuc
- [ ] 2 nguoi cung bam cung 1 nut trong 1-2 giay
- [ ] Bam `Xem luot` lien tuc khong treo

Ghi chu loi:

```text
```

---

## 8. Bau Cua

### Tao keo

- [ ] `!play` mo keo moi
- [ ] 6 nut con vat hien dung
- [ ] Mo ta tren bang cuoc de hieu

### Dat cuoc

- [ ] Chon 1 con vat va nhap tien thanh cong
- [ ] 1 nguoi dat nhieu con vat thanh cong
- [ ] 2 nguoi dat cung luc khong vo keo
- [ ] Modal nhap tien khong bi timeout

### Lac keo

- [ ] Het gio bot tu lac
- [ ] Bam `Chot keo` hoat dong
- [ ] Ket qua 3 linh vat hien dung
- [ ] Tinh tien tra thuong dung

### Can test spam

- [ ] 1 nguoi spam bam con vat lien tuc
- [ ] 2 nguoi mo modal gan nhu cung luc
- [ ] Sau khi ket thuc, bam lai nut cu phai bi chan dung

Ghi chu loi:

```text
```

---

## 9. Xi Dach

### Mo van

- [ ] `!play` hien bang chon muc cuoc
- [ ] Bam cac muc cuoc co san hoat dong
- [ ] Nut `Nhap cuoc` hoat dong
- [ ] Khong bi "Ung dung khong phan hoi"

### Trong van

- [ ] Nut `Rut` hoat dong
- [ ] Nut `Dung` hoat dong
- [ ] Nut `Xem luot` hoat dong
- [ ] Nguoi khac bam nut se bi chan dung
- [ ] Sau moi luot, trang thai ban cap nhat dung

### Hien thi la bai

- [ ] Bai de nhin tren Discord desktop
- [ ] Bai de nhin tren mobile
- [ ] Khong vo nen, khong rach khung, khong loi font
- [ ] Bai nha cai up/ngua dung logic

### Tinh ket qua

- [ ] Quac > 21 xu ly dung
- [ ] Hoa dung
- [ ] Ngu linh dung
- [ ] Cong/tru/hoan Xu dung

Ghi chu loi:

```text
```

---

## 10. Kiem tra sau khi redeploy

- [ ] Room cu van con
- [ ] Profile, Xu, Ngoc van con
- [ ] Bot nhan lenh ngay sau khi online
- [ ] Khong bi mat ranking
- [ ] Khong bi reset session cu bat thuong

---

## 11. Muc danh gia cuoi

### Muc on dinh

- [ ] Dat de demo
- [ ] Dat de mo test cong dong nho
- [ ] Dat de dua production server

### Loi nghiem trong

- [ ] Khong co loi mat Xu
- [ ] Khong co loi nhan doi thuong
- [ ] Khong co loi session treo khong stop duoc
- [ ] Khong co loi nut bam timeout lien tuc

### Tong ket

```text
Game test:
So case dat:
So case loi:
3 loi uu tien cao nhat:
1.
2.
3.

Danh gia chung:
```
