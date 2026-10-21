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
- Confirm deployment scripts do not echo secrets.
- Confirm rotation reports are mode `0600`.
- Confirm production key files are not group/world readable.
- Confirm the service user cannot read the protected secret file.

## Current Project Status

### Hiker

Completed locally:

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

Remaining:

- Commit and push these changes.
- Run `secure-env.sh` on every production instance.
- Rotate all exposed/live Hiker keys.
- Delete migration backups and key reports after successful verification.

### Bughouse Ladder

Completed locally:

- Redacted keys from local log files:
  - `bughouse-ladder.txt`
  - `dev-ladder.txt`
- Added helper scripts:
  - `deploy/ladder-env.sh`
  - `deploy/secure-env.sh`
  - `deploy/update-env-key.ps1`
- Updated deployment scripts to use protected `/etc/bughouse-ladder/<instance>.env` when present.
- Updated key rotation to avoid printing keys and to write a mode-`0600` report.

Remaining:

- Commit and push these changes.
- Run migration on the production server.
- Rotate the currently exposed key.
- Delete legacy backup files after verifying the new key works.

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
9. Rotate exposed keys.
10. Document the key names, file paths, and rotation commands in `SECURITY.md`.
