# Jianghu Game Bot

Day la bot game rieng cho `Jianghu Discord`. No duoc tach khoi utility bot de giu design sach, de test, de mo rong va de audit economy de dang hon.

## Muc tieu cua MVP

- slash commands thay vi prefix spam
- player profile
- daily claim
- profession selection
- work loop co cooldown
- inventory va wallet co luu tru
- sell loop de doi item thanh Xu
- transaction log cho kinh te MVP
- shop MVP de tao currency sink
- crafting MVP de tao vong bien doi tai nguyen

## Kien truc

- `src/commands`: slash command handlers
- `src/config`: game design data nhu profession, item, rarity
- `src/services`: logic nghiep vu
- `src/storage`: luu state MVP bang JSON file

## Ghi chu

Storage hien tai dung JSON file de khoi dong nhanh. Day la tam thoi cho MVP local va test guild. Khi economy bat dau co user that, nen chuyen sang PostgreSQL hoac MongoDB va them transaction log day du.
