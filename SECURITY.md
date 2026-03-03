# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public GitHub issue. Instead, contact the maintainers privately so the issue can be addressed before public disclosure.

---

## Credential and Secrets Management

### What must never be committed

- Real email addresses of employees or customers
- Plaintext passwords or password hashes tied to real accounts
- API keys, tokens, or connection strings (Azure, OpenAI, etc.)
- Azure service principal secrets (`AZURE_CLIENT_SECRET`)
- Azure DevOps Personal Access Tokens (`AZURE_DEVOPS_PAT`)
- Any `.env` file containing real values

### Safe local development setup

1. Copy the example user file and customize it for local testing only:
   ```bash
   cp users.json.example users.json
   ```
   `users.json` is listed in `.gitignore` and will **not** be committed.

2. Set real credentials only in environment variables (never in JSON files):
   ```bash
   export AZURE_TENANT_ID=<your-tenant-id>
   export AZURE_CLIENT_ID=<your-client-id>
   export AZURE_CLIENT_SECRET=<your-secret>
   export AZURE_DEVOPS_ORG_URL=https://dev.azure.com/<your-org>
   export AZURE_DEVOPS_PAT=<your-pat>
   ```
   Or store them in a local `.env` file (which is also in `.gitignore`).

3. Use only `example.com` or clearly fictitious email addresses in any committed JSON files.

---

## If Credentials Were Previously Committed

If sensitive data (passwords, tokens, real email addresses) was committed to git history, treat those credentials as **compromised** and rotate them immediately:

1. **Rotate secrets right away**
   - Regenerate the Azure service principal secret in the Azure Portal.
   - Revoke and reissue the Azure DevOps PAT.
   - Reset any user accounts whose passwords were committed.

2. **Purge secrets from git history** using one of these tools:
   - [`git filter-repo`](https://github.com/newren/git-filter-repo) (recommended):
     ```bash
     pip install git-filter-repo
     git filter-repo --path users.json --invert-paths
     ```
   - [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/):
     ```bash
     java -jar bfg.jar --delete-files users.json
     git reflog expire --expire=now --all
     git gc --prune=now --aggressive
     git push --force --all
     ```

3. **Notify all collaborators** to re-clone the repository after the history rewrite, as their local copies will contain the old history.

4. **Enable GitHub secret scanning** on the repository (Settings → Security → Secret scanning) to receive automatic alerts for future accidental credential commits.

---

## GitHub Secret Scanning

This repository uses GitHub's secret scanning to detect accidentally committed credentials. If an alert is triggered:

1. Rotate the exposed secret immediately.
2. Resolve the alert in the GitHub Security tab once the secret is no longer valid.
3. If needed, purge the secret from git history as described above.

---

## CI Secret Detection

A GitHub Actions workflow (`.github/workflows/secret-scan.yml`) runs on every pull request to detect common secret patterns in JSON files. Pull requests that introduce secrets will fail the check and must be remediated before merging.
