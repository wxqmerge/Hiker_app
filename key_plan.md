# API Key Management Plan

This is the reusable approach for Hiker, Bughouse Ladder, and future projects with environment-based API keys.

## Goal

- No hardcoded secrets in source files, batch scripts, tests, docs, logs, shell history, or browser bookmarks stored in a repository.
- No secret values passed as command-line arguments.
- Production keys should not be readable by the web-server user or random local users.
- Keys should be rotatable without editing application source files.
- Each project and each environment should use separate keys.

## Recommended Secret Locations

### Production Linux

Use two files per instance:

```text
/var/www/html/<instance>/server/.env
    Non-secret configuration: PORT, NODE_ENV, CORS_ORIGINS, DATA_DIR, etc.
    Permissions: 0640, owned by root or deploy user/admin group.

/etc/<project>/<instance>.env
    Secrets only: ADMIN_API_KEY, USER_API_KEY, etc.
    Permissions: 0640 root:<admin-group>
    Systemd loads this file through EnvironmentFile.
```

Example:

```text
/etc/hiker/sothh-app.env
/etc/hiker/ramblers-app.env
/etc/bughouse-ladder/bughouse-ladder-app.env
```

The application user does not need to read the protected file. Systemd reads it as root and injects the values into the service process environment.

Preferred permissions:

```text
/etc/<project>                    0750 root:<admin-group>
/etc/<project>/<instance>.env     0640 root:<admin-group>
```

`<admin-group>` should contain only deployment/ops users that need to rotate keys. The service account should not be in this group.

If no separate admin group is available:

```text
/etc/<project>/<instance>.env     0600 root:root
```

In that case, scripts need sudo to inspect or rotate keys.

### Local Development

Minimum acceptable:

- Use a gitignored `.env` file.
- Never use hardcoded keys in `.bat`, `.ps1`, `.sh`, tests, or committed docs.
- Use hidden prompts or local environment variables when setting keys.
- Redact local log files before leaving them on disk.

Better:

- Store local keys in Windows Credential Manager, macOS Keychain, Linux keyring, or a password manager.
- Have helper scripts retrieve secrets at runtime and inject them into the child process.
- Avoid storing local secrets in PowerShell history or user environment variables if plaintext is unacceptable.

## Key Generation

Use a strong random key:

```bash
openssl rand -hex 48
```

or:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use separate values for:

- Development
- Staging
- Production
- Each customer/group instance
- User/API-write key and admin key, when the app supports both

## Rotation Procedure

1. Generate the replacement key inside the server or a password manager.
2. Update the protected server key file:

   ```bash
   sudo bash ./deploy/secure-env.sh <admin-user>
   ```

3. Rotate the service key through the project rotation script:

   ```bash
   bash ./deploy/rotate-key-all.sh
   ```

4. The script should:
   - Write keys without echoing them to stdout.
   - Use stdin or hidden prompts, not CLI arguments.
   - Write a private report file with mode `0600`.
   - Restart each affected systemd service.
   - Verify the service is running.

5. Delete the report file after copying keys to the password manager.
6. Refresh client keys:
- PWA/localStorage keys must be re-entered or opened through a trusted config URL.
- Browser shortcut files containing keys should be regenerated and deleted after import. See **Browser Shortcut Generation**.
7. Confirm old keys are rejected:
   - Unauthenticated writes: `401`
   - Old key: `401`
   - New key: `200` or expected success

## Browser Shortcut Generation

Shortcuts or bookmarks that open an app with `?key=<secret>` still work, but they contain secrets inside the generated HTML file and inside the browser.

### Required behavior

- The script must read keys from the protected key file first.
- It may fall back to legacy `server/.env` only before migration.
- It must create its output with mode `0600`.
- It should not print key values to the terminal.
- It should be deleted with `shred -u` after browser import.
- It must be regenerated after key rotation.

### Nginx Access Logs

A config shortcut does not just store the secret in the browser: every load sends
`GET /<instance>/dist/?key=<secret>` to the server, and the default nginx `log_format`
(`$request` = full path + query string) records the live key into `access.log`.
The key plan's log redactions miss this because the logs are server-side and never
committed.

Fix on the parent-domain vhost that serves the `/<instance>/dist/` path — add
`access_log off;` to the matching location (or paste
`deploy/nginx/dist-nolog.conf`):

```nginx
location ~ ^/[a-z0-9-]+/dist/ {
    access_log off;
    # ...existing static serving directives...
}
```

Notes (verified end-to-end on chess4.us, 2026-10-21):

- **Parent domain** (the `root /var/www/html` vhost) — put this BEFORE `location /`.
  `try_files` does NOT expand captures (`/$1/...` 404s as a literal path), so use
  `rewrite ... break` to keep serving inside the no-log location:

  ```nginx
  location ~ ^/(?<app>[a-z0-9-]+)/dist/$ { access_log off; rewrite ^ /$app/dist/index.html break; }
  location ~ ^/[a-z0-9-]+/dist/ { access_log off; }
  ```

  Do not rely on `access_log off` plus the `index` fallback: the internal redirect
  re-logs through the final location.
- **Subdomain vhosts** (one server block per app) — create once
  `/etc/nginx/conf.d/nolog-key.conf`:

  ```nginx
  map $arg_key $log_without_key { default 1; "~.+" 0; }
  ```

  and per vhost add
  `access_log /var/log/nginx/access.log combined if=$log_without_key;`
  Only key-bearing requests skip the log; `X-API-Key` header traffic is fully logged.
- **Test after reload** (expect no match; from the server use `--resolve <host>:443:127.0.0.1` —
  hairpin NAT hangs on the public IP):

  ```bash
  M=T1$$; curl -sk --resolve <host>:443:127.0.0.1 "https://<host>/<instance>/dist/?key=$M"
  sleep 1; sudo grep -c "$M" /var/log/nginx/access.log || echo NOT LOGGED
  ```
- Rotation does not remove old keys from old logs. After the fix, purge rotated logs
  and truncate the current one: `sudo truncate -s 0 /var/log/nginx/access.log && sudo rm -f /var/log/nginx/access.log.*` —
  and understand **purge ≠ safe: rotate the keys afterwards.**
- Until the fix is applied, every shortcut load re-exposes the current key.
- View-only bookmarks (`/dist/` without `?key=`) are harmless; only loads of the
  key URLs leak.
- Bughouse Ladder: `deploy/verify.sh` section 19 ("Nginx Log Secrets") fails the
  deploy if readable nginx access logs contain `?key=` entries. Audit every app from
  any repo with `deploy/fix-dist-nolog.sh [--dry-run|--test|--purge-logs]`; apply each
  project's own vhost edit from within that project.

### Bughouse Ladder

After migrating keys, `deploy/create_html.sh` and `deploy/admin-urls.sh` read from:

```text
/etc/bughouse-ladder/<instance>.env
```

Run:

```bash
cd /var/www/html/<ladder-instance>
./deploy/create_html.sh
```

If the protected file is root-only:

```bash
sudo ./deploy/create_html.sh
```

Download the report:

```bash
scp user@server:~/ladder-bookmarks-*.html ~/Downloads/
```

Import it into the browser, then securely delete it:

```bash
shred -u ~/ladder-bookmarks-*.html
```

Old bookmarks must be replaced after every key rotation.

### Custom shortcut scripts

Any custom script that generates config URLs should:

1. Source the project’s protected-key helper.
2. Use the helper function to read each key.
3. Write output files with mode `0600`.
4. Avoid command-line key arguments.
5. Print only the output filename, not the secret URL.

Example pattern:

```bash
source ./deploy/ladder-env.sh

ADMIN_KEY=$(ladder_read_env_value ADMIN_API_KEY \
    "/etc/bughouse-ladder/${INSTANCE}.env" \
    "$PROJECT_DIR/server/.env")

umask 077
: > "$OUTPUT_FILE"
```

## Deployment Script Requirements

Every deployment script should:

- Prefer `/etc/<project>/<instance>.env` when present.
- Support legacy `server/.env` only as a migration fallback.
- Ensure systemd has:

  ```ini
  [Service]
  EnvironmentFile=/var/www/html/<instance>/server/.env
  EnvironmentFile=/etc/<project>/<instance>.env
  ```

- Tighten permissions when possible:

  ```bash
  chmod 640 server/.env
  chmod 640 /etc/<project>/<instance>.env
  ```

- Print only `(set)` for key presence, never the key value.
- Work with either group-readable protected files or sudo-only files.

## Audit Checks

Run these before considering a project clean:

- Search working tree for long hex secrets and `API_KEY=` assignments.
- Search Git history for known exposed keys.
- Confirm ignored files are not committed:
  - `.env`
  - local `.bat` wrappers
  - logs containing config URLs
  - bookmark files
  - coverage or generated reports
- Search PowerShell history for exposed secrets and redact it.
- Confirm nginx access logs contain no `?key=` entries, or that `access_log off` covers the dist locations serving config URLs.
- Confirm deployment scripts do not echo secrets.
- Confirm rotation reports are mode `0600`.
- Confirm production key files are not world-readable.
- Accept `0600 root:root` or `0640 root:<admin-group>` for protected key files.
- Confirm the service user cannot read the protected secret file.

### Audit execution steps — run AFTER rotation, not before

```text
1. Deploy and rotate fully (all instances on new keys).
2. Apply nginx log-leak protection (parent domain + every subdomain vhost).
3. Verify.sh check after deploy (Nginx Log Secrets section).
4. Purge old access logs (they hold pre-rotation keys).
5. Run the full audit (tree/history grep, permission checks, log scans).
6. Re-rotate if the audit finds a new leak location.
```

Rationale: auditing and rotating first, then deploying, rewrites the *new* key into
nginx `access.log` on every `?key=` shortcut load — forcing a second rotation.
Order: deploy -> rotate -> log-leak fix -> purge -> audit.

## Deployment Rollout Order

Use this order for projects with multiple instances and one shared key:

1. Push the deployment-script changes.
2. Pull and update all instances using the legacy key still in `server/.env`.
3. Run `secure-env.sh` on every instance. This preserves the current key while moving it to protected storage.
4. Log out and log back in so the administrator group takes effect.
5. Run the all-instance key rotation once.
6. Verify every service.
7. Regenerate browser shortcuts.
8. Refresh local and PWA keys.
9. Delete migration backups, bookmark files, and key reports.

Do not rotate keys until every instance has been migrated, otherwise instances still using the old location may be rejected.

## Known Deployment Noise

Some repository changes after deployment are operational artifacts, not security findings. Always inspect them before restoring files.

Expected Hiker artifacts:

- `index.html` may be modified because the deployment copies built files from `dist/` into the instance root. Do not restore it during production verification.
- `deploy/*.sh` may show mode-only changes because deployment scripts normalize permissions.
- `package-lock.json` may show npm metadata churn, such as `libc` field additions or removals, when the server’s npm version differs from the workstation.
- `assets/`, `sw.js`, `manifest.webmanifest`, and other copied build output may appear untracked.

Never run a broad `git checkout -- .` on a live instance without first inspecting the diff, because it may revert the deployed frontend.

## Current Project Status

### Hiker

Status: implementation pushed and production migration in progress as of 2026-10-21.

Completed:

- Removed hardcoded production keys from:
  - `test_dev.bat`
  - `deploy/test-ramblers-app.bat`
  - `update-api-key.bat`
- Added hidden-prompt helpers:
  - `deploy/set-local-test-keys.ps1`
  - `deploy/update-admin-key.ps1`
- Added protected production key storage:
  - `deploy/hiker-env.sh`
  - `deploy/secure-env.sh`
  - `/etc/hiker/<instance>.env`
- Updated update, verify, rotation, bookmark-generation, and comparison scripts to prefer the protected key file.
- Updated rotation scripts to write reports with mode `0600` instead of printing keys.
- Confirmed exposed keys are not present in Git history.
- Pushed implementation: `166f1c9`
- Bumped application version: `7dea2dd` (`v1.5.3`)

In progress:

- `ramblers-app` key migration completed.
- Remaining Hiker instances still need `secure-env.sh`.

Remaining:

- Run `secure-env.sh` on every remaining production instance.
- Re-login after group changes so the deployment user has `hiker-admin` membership.
- Rotate all exposed/live Hiker keys.
- Refresh PWA/browser keys after rotation.
- Delete migration backups and key reports after successful verification.
- Clean up deployment-script noise (`index.html`, lockfile metadata churn, and executable-bit changes).

### Bughouse Ladder

Completed locally:

- Redacted keys from local log files:
  - `bughouse-ladder.txt`
  - `dev-ladder.txt`
- Added helper scripts:
  - `deploy/ladder-env.sh`
  - `deploy/secure-env.sh`
  - `deploy/update-env-key.ps1`
- Updated deployment scripts to use protected `/etc/bughouse-ladder/<instance>.env` when present:
  - `update.sh`, `verify.sh`, `admin-urls.sh`, `create_html.sh`, `manage_versions.sh`, `rotate-key-all.sh`
- Updated key rotation to avoid printing keys and to write a mode-`0600` report.
- `create_html.sh` writes bookmarks with `umask 077` and instructs `shred -u` cleanup.
- Systemd templates (`deploy/instances/*/*.service`) include optional `EnvironmentFile=-/etc/bughouse-ladder/<instance>.env`.
- Nginx log-leak mitigation: `deploy/fix-dist-nolog.sh` detects all parent vhosts on the server (every app/project following the `<app>.<parent>` naming, Hiker included), inserts `access_log off;` into `/dist/` locations with backup + `nginx -t` rollback, supports `--dry-run`, `--test` (dummy-marker proof), and `--purge-logs`. `deploy/nginx/dist-nolog.conf` documents the manual fallback; `verify.sh` section 19 warns on `?key=` entries in nginx access logs.
- Documented key management in `SECURITY.md` and `deploy/README.md`.
- Audit: working tree free of secrets (only placeholders/fake test keys); PowerShell history clean; `.env.example` files carry placeholders only.
- Audit: git history contains one partial key fragment in `USER_MANUAL.md` (commits `edbc435`..`7e23fce`), removed from the current tree — covered by key rotation.

Completed 2026-10-21 (security audit + ops):

- Full security audit run (12 findings) — all fixed or documented in `SECURITY.md`
  "Known Limitations": path-traversal guards on backup endpoints, `round` bound,
  tab-injection sanitization, type-checked player-field whitelist, multer cleanup,
  express 4.22.3 (0 runtime vulnerabilities; dev-only vite/vitest advisories
  documented, `vite@8` major deferred), `ANON_HIDE_PII` opt-in, CSP snippet
  (`deploy/nginx/csp.conf`), hardening tests. `npm test`: 191 server + 952 client green.
- All changes committed and pushed (`origin/main`).
- nginx log-leak fix DEPLOYED on chess4.us: parent `mysite.conf` regex locations
  (`access_log off` + `rewrite ... break`), `/etc/nginx/conf.d/nolog-key.conf` map,
  subdomain vhosts logging with `if=$log_without_key`; marker tests confirmed no
  `?key=` logging; old access logs truncated + rotated logs deleted;
  `verify.sh` section 19 `[PASS]`.

Remaining:

- Production key rotation: `sudo bash ./deploy/secure-env.sh matt` (per instance),
  add `EnvironmentFile=-/etc/bughouse-ladder/<instance>.env` via
  `sudo systemctl edit <service>` if not present, restart, then
  `bash deploy/rotate-key-all.sh` (all 4 ladders updated via `update.sh` 2026-10-21: 4 OK, 0 failed).
- Regenerate bookmarks (`create_html.sh`, copy links, `shred -u`), refresh PWA keys,
  delete bookmark/backup copies containing old keys (history fragment included).
- Delete legacy backup files after verifying the new key works.
- Optional follow-ups: apply `deploy/nginx/csp.conf` (needs `npm run build:all`),
  schedule `vite@8` major, add `access_log ... if=$log_without_key;` to vhosts of
  other projects from within those projects.

## Standard Local Workflow

### Windows Helper Pattern

Provide a hidden-prompt local helper that updates ignored `.env` files:

```powershell
.\deploy\update-env-key.ps1
```

The helper should:

- Prompt with `Read-Host -AsSecureString`.
- Accept an environment-variable fallback for automation.
- Avoid echoing values.
- Update only gitignored local `.env` files.

### Windows Test-Script Pattern

Do not store keys in `.bat` files. Use environment variables:

```bat
if not defined PROJECT_DEV_ADMIN_API_KEY (
    echo PROJECT_DEV_ADMIN_API_KEY is not set.
    exit /b 1
)
```

Test scripts should read the variable inside PowerShell or another child process rather than receive the key as a command-line argument.

## Migration Checklist For A New Project

1. Identify every secret variable.
2. Find all plaintext copies:
   - Source files
   - Scripts
   - Logs
   - Docs
   - Shell history
   - Backups
   - Generated HTML/bookmarks
3. Replace hardcoded values with environment variables or protected files.
4. Add a project key directory:

   ```text
   /etc/<project>/
   ```

5. Add migration script:

   ```bash
   sudo bash ./deploy/secure-env.sh <admin-user>
   ```

6. Add rotation script.
7. Add hidden local key helper.
8. Update deployment, verification, URL generation, and backup scripts.
9. Protect nginx access logs against `?key=` leaks (parent-domain regex location with
   `rewrite ... break`; `/etc/nginx/conf.d/nolog-key.conf` map +
   `access_log ... if=$log_without_key;` for subdomain vhosts), test with a marker
   request, then purge old access logs.
10. Rotate exposed keys.
 11. Run the audit execution steps (audit AFTER rotation, not before).
 12. Document the key names, file paths, and rotation commands in `SECURITY.md`.

## Network-Audit Findings 2026-10-21 (outside key scope — fix in each project)

Context: rp5 firewall now defaults to deny; only LAN, tailnet, 80 and 443 reach the server.
That contains these issues from the WAN side, but LAN-side exposure and code bugs remain.

### Hiker

- FIXED: `GET /api/data/export-zip`, `GET /api/validate`, and
  `GET /api/schedule/history` now use `requireAdminKey`; key-required UI actions are disabled
  without a stored key.
- FIXED: `/api/tide-proxy` builds its NOAA request with `URL`/`URLSearchParams`.
- FIXED: the client stores keys only from `#apikey=` fragments, strips legacy `?apikey=`
  parameters without storing them, and server auth remains header-only.
- FIXED: the Express server binds `HOST` with default `127.0.0.1`.
- FIXED: CORS is disabled unless `CORS_ORIGINS` is explicitly configured; wildcard CORS never
  enables credentials.
- FIXED: deploy scripts use protected key files/prompts, fragment access URLs, mode-0600
  reports, and no key command-line arguments; generated bookmark/access URL backups are ignored.
- FIXED: nginx examples/local config deny dotfiles and non-static directories; `verify.sh`
  checks dotfile denial.
- FIXED: admin keys are verified through `GET /api/auth/verify` before the UI stores them;
  invalid keys are not saved, failed auth is delayed by 1 second by default, and verification
  failures are rate-limited.
- Deleted local `server/.env.backup_20260829_135009`; local `.env.production` already uses
  `https://`.

### Bughouse Ladder

- Ladder instances listen on ALL interfaces (verified on rp5: 29970/29971/29972 open to LAN) —
  `listen(PORT, '127.0.0.1')` in every instance.
- `server/.env` currently `NODE_ENV=development` while serving production — this SKIPS the
  fail-fast key guard (`index.ts:14-20`). Set `NODE_ENV=production`.
- `CORS_ORIGINS=*` with `credentials:true` (`index.ts:113-124`) — pin to the actual
  chess4.us origins.
- Request logger writes FULL query strings (`index.ts:73-79`) — redact `key=`/`apikey=`
  before logging (defense-in-depth behind the nginx fix).
- Admin backup endpoints validate filenames with `endsWith('.tab')` only
  (`admin.routes.ts:151,176,197` → `path.join` in `dataService.ts:472,507,526`) —
  `path.basename(filename)` before joining (auth-gated today; cheap fix).
- `server/data/backups|old|datao` (hundreds of historical `.tab` with player
  Phone/School/Room) sit INSIDE the served tree — move `DATA_DIR` outside the web root
  and deny HTTP access to whatever remains.

### Exercise

- `server/.env` has `APP_KEY=` EMPTY — auth middleware skips checks entirely
  (`index.ts:105-115`), so config/entries/images/import/delete endpoints are wide open
  to anyone who can reach :3000 (LAN today). Set a key or fail closed when unset.
- `scripts/build-static.py` embeds `APP_KEY` into shipped HTML (`var KEY = …`) —
  remove client-side key embedding; the header check is the real gate.
- SSRF in `/api/images/save`: `assertPublicUrl` resolves DNS, then `fetch()` re-resolves
  (`:92-101`, `:329`) — DNS-rebinding defeats it. Fetch via the already-validated IP.
- `listen(PORT)` → bind `127.0.0.1`; pin `CORS_ORIGINS` (currently `*`).

### simpleGraphy (static gallery)

- Serve ONLY the generated gallery output. Currently the web root also exposes:
  `.git/` (full history via git-dumper), 68 MB `.ARW` + 15 `.HEIC` originals with
  EXIF/GPS, `gallery.log` (trip names + local paths), dev/debug scripts,
  `__pycache__`, and `.exe/.dll/.pdb` build dirs.
- If the repo dir must stay put: deny `/.git/` and `/.env*` in nginx and delete
  RAW/HEIC/log files from the served tree.

### All projects (served from repos in web roots)

- `.git/` directories are downloadable wherever Apache/nginx serves the repo root.
  Preferred: serve only `dist/` (and a non-web `DATA_DIR`); else deny dotfiles globally:
  `location ~ /\. { deny all; }` (already standard nginx habit — verify each vhost has it).
