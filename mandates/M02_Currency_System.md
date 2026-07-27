# M02 Currency System

## Muc dich

Dinh nghia cac loai currency, vai tro cua chung va cach chuyen doi giua cac tang gia tri.

## Currency Layers

### Xu

Dong tien co ban cua server.

Dung de:

- mua tool co ban
- tra phi craft
- mua vat pham pho thong
- giao dich voi shop he thong

Source:

- daily
- profession action
- ban item pho thong
- quest / event co ban

### Ngoc

Premium currency trong game, nhung van phai earnable.

Dung de:

- cosmetic dac biet
- ticket reward
- monthly ladder
- item prestige

Source:

- achievement
- collection milestone
- item exchange co dieu kien
- event dai han
- craft / convert cap cao

### Ticket / Token su kien

Currency theo mua hoac event.

Dung de:

- doi phan thuong event
- leaderboard event
- season pass nhe neu can

## Conversion Principles

- Khong cho doi truc tiep vo han `Xu -> Ngoc`.
- Neu co exchange, phai thong qua item, collection, recipe hoac weekly cap.
- Currency tang cao phai co friction de bao toan gia tri.

## Balance Rules

- Xu phai de kiem nhung de tieu.
- Ngoc phai kho kiem hon nhung khong bi khoa hoan toan voi casual.
- Event token phai het han hoac reset theo mua de tranh ton dong vo nghia.

## Anti-Inflation Measures

- dynamic shop sinks
- high-tier crafting cost
- rotating cosmetics
- capped exchange routes
- event-only demand spikes
