# Security Notes

## Muc tieu

Tranh push nham token, key va file nhay cam vao repo.

## Quy tac

- Khong commit file `.env` that.
- Khong commit bot token, webhook URL, private key, service credentials.
- Neu can chia se cau hinh, tao `*.example` file.
- Secret thuc te phai nam o:
  - local `.env`
  - GitHub Secrets
  - secret manager sau nay

## Workflow dang co

- `.gitignore` bo qua file env va artifact local
- `CI` quet secret bang `gitleaks`
- `Push Guard` fail PR neu phat hien file nhay cam pho bien

## De xuat them tren GitHub

- bat branch protection cho `master`
- bat secret scanning neu kha dung
- bat push protection neu GitHub plan ho tro
