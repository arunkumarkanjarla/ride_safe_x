# Restore Asterisk config on a lab host

## 1. Backup the target first

```bash
sudo tar -czf /root/asterisk-before-restore-$(date +%Y%m%d).tgz /etc/asterisk
```

## 2. Copy configs

```bash
# from extracted pack
sudo rsync -a etc_asterisk/ /etc/asterisk/
# recreate TLS keys on the lab box (do not copy prod private keys)
```

## 3. Fix secrets for the lab

Edit AMI/ARI/ODBC passwords to match the lab Postgres and FastAPI `.env` (`ASTERISK_AMI_*`).

## 4. Reload Asterisk

```bash
sudo asterisk -rx "core reload"
sudo asterisk -rx "module reload res_pjsip.so"
sudo asterisk -rx "dialplan reload"
sudo asterisk -rx "manager reload"
```

Validate:

```bash
sudo asterisk -rx "pjsip show endpoints"
sudo asterisk -rx "queue show"
sudo asterisk -rx "dialplan show japit-pre-router"
```

## 5. Point the app at this PBX

In FastAPI `.env`:

```env
ASTERISK_AMI_HOST=...
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USERNAME=...
ASTERISK_AMI_SECRET=...
```

Restart FastAPI (venv or Docker leader).

## Warning

Do **not** apply this tree blindly over an unrelated production PBX. Japit contexts and ODBC assume the Japit Postgres schema and dual-ODBC layout described in milestone 7.
