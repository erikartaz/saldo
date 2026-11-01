# Deploy di Saldo con Portainer

Questa guida usa lo stack Git di Portainer: Portainer clona il repository, costruisce l'immagine dal `Dockerfile` e avvia il container con `docker-compose.yml`.

## Cosa viene creato

- **Immagine multi-stage**: Node compila il frontend, Python installa le dipendenze con `uv`, il runtime finale contiene solo l'essenziale.
- **Utente non-root** (`uid 10001`).
- **Volume nominato** `saldo_data` montato su `/app/backend/data`: contiene `saldo.db` e l'eventuale `.secret`.
- **Healthcheck** su `/api/health`.
- **Riavvio automatico** con `restart: unless-stopped`.
- **Porta** `8000` pubblicata sull'host, raggiungibile dal Caddy esterno (LXC o container separato).

## Prerequisiti

- Portainer con un ambiente Docker funzionante.
- Repository GitHub accessibile da Portainer (pubblico oppure con credenziali Git configurate).
- Porta host libera (default `8000`).
- Facoltativo: Caddy o un altro reverse proxy per HTTPS.

## 1. Crea lo stack da Git

In Portainer:

1. **Stacks → Add stack → Repository**.
2. Repository URL: `https://github.com/erikartaz/saldo.git`.
3. Branch: `main`.
4. Compose path: `docker-compose.yml`.
5. Se il repository è privato, configura le credenziali Git di Portainer.
6. Aggiungi le variabili d'ambiente (sezione successiva).
7. **Deploy the stack**.

Portainer costruirà l'immagine e avvierà il container. Il primo build può richiedere qualche minuto.

## 2. Variabili d'ambiente

| Variabile | Default | Note |
| --- | --- | --- |
| `SALDO_JWT_SECRET` | vuota | Consigliata in produzione. Se vuota, viene generato un segreto persistente nel volume. |
| `SALDO_ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | Durata sessione: 7 giorni. |
| `SALDO_PORT` | `8000` | Porta pubblicata sull'host. |
| `SALDO_BIND_IP` | `0.0.0.0` | Interfaccia di ascolto. Se Caddy è sullo stesso host puoi usare `127.0.0.1`. |
| `TZ` | `Europe/Rome` | Fuso orario usato da date, mesi e ricorrenze. |

Genera un segreto con:

```powershell
uv run python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Incollalo in Portainer come valore di `SALDO_JWT_SECRET`. Non inserirlo nel repository.

## 3. Primo accesso

Apri:

```text
http://IP-DEL-SERVER:8000
```

Se hai bindato su `127.0.0.1`, l'app non è raggiungibile direttamente dalla rete: usa Caddy o un tunnel SSH.

Al primo accesso crea l'account. Poi aggiungi conti e movimenti.

## 4. Caddy esterno

Caddy è già presente nel tuo homelab e non fa parte di questo stack. Saldo pubblica la porta `8000` sull'host Docker: Caddy deve raggiungerla e fare da reverse proxy.

Se Caddy è un LXC/container separato:

```caddyfile
saldo.example.com {
    reverse_proxy http://IP-DELL-HOST-DOCKER:8000
}
```

Nell'esempio [Caddyfile.example](Caddyfile.example) sostituisci `127.0.0.1` con l'IP LAN dell'host Docker. Il Caddyfile vero e proprio resta nel tuo container Caddy.

Suggerimenti:

- limita la porta `8000` con il firewall all'IP di Caddy;
- non pubblicare la porta `8000` su Internet;
- HTTPS, certificati e redirect restano gestiti da Caddy;
- se in futuro Caddy girerà sullo stesso host Docker, puoi impostare `SALDO_BIND_IP=127.0.0.1` e usare `reverse_proxy 127.0.0.1:8000`.

Evita di pubblicare la porta 8000 su Internet senza proxy: SQLite e il login non sono pensati per l'esposizione diretta.

## 5. Aggiornamenti

Dopo un push su `main`:

- in Portainer apri lo stack e usa **Pull and redeploy** (ricostruisce l'immagine);
- oppure configura **GitOps updates** / webhook, se la tua versione di Portainer lo supporta.

Il volume `saldo_data` non viene toccato dal redeploy: i dati restano.

## 6. Backup e ripristino

Ferma il container prima di un backup a caldo di SQLite.

Backup del volume (Linux/macOS):

```bash
docker run --rm \
  -v saldo_data:/data:ro \
  -v "$PWD":/backup \
  alpine sh -c 'tar czf /backup/saldo-backup.tgz -C /data .'
```

Ripristino:

```bash
docker run --rm \
  -v saldo_data:/data \
  -v "$PWD":/backup \
  alpine sh -c 'rm -rf /data/* && tar xzf /backup/saldo-backup.tgz -C /data'
```

Su Portainer puoi anche usare il browser dei volumi. Conserva anche il segreto JWT (`.env` o `.secret`): senza di esso i dati restano, ma le sessioni vengono invalidate.

## 7. Note importanti

- **Una sola replica**: SQLite non va condiviso tra più container. Non usare `deploy.replicas` maggiore di 1.
- **Volume nominato**: evita bind mount su rete SMB/NFS; SQLite ha bisogno di un filesystem locale affidabile.
- **Permessi**: se usi un bind mount, la cartella host deve essere scrivibile dall'UID `10001`.
- **Segreto**: cambiare `SALDO_JWT_SECRET` disconnette tutti i browser; non rigenerarlo a ogni deploy.
- **Log**: `docker logs saldo` oppure la vista Logs di Portainer.
- **Health**: lo stato del container deve diventare `healthy`; in caso contrario controlla i log.

## 8. Verifica rapida

```bash
curl http://127.0.0.1:8000/api/health
# {"status":"ok","app":"Saldo","version":"1.0.0"}
```

Se risponde ma la pagina è vuota, controlla che il build del frontend sia andato a buon fine nei log di Portainer.
