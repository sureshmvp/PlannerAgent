# Azure AD User Creation Guide

## 🎯 Quick Start

To create users in Azure AD, simply run:

```bash
npm run create-users-mcp
```

The script automatically:
- ✅ Loads user structure from `users.json`
- ✅ Merges credentials from `users.credentials.json`
- ✅ Creates users in Azure AD
- ✅ Skips users that already exist

---

## 📁 File Structure

### 1. `users.json` (Public - Safe for Git)
Contains user structure with **hidden** sensitive information.

**Key Features:**
- All `userPrincipalName`: `***HIDDEN***`
- All `password`: `***HIDDEN***`
- Includes Azure AD metadata and field documentation
- Safe to commit to version control

### 2. `users.credentials.json` (Private - Git Ignored)
Contains **actual** email addresses and passwords.

**Security:**
- 🔒 Added to `.gitignore`
- 🔒 Never committed to git
- 🔒 Maps users to real credentials via `displayName`

---

## 🔄 How It Works

### Automatic Credential Merging

The `create-users-mcp` script performs these steps:

1. **Load users.json**
   ```typescript
   // Loads 15 users with structure but hidden credentials
   ```

2. **Load users.credentials.json**
   ```typescript
   // Loads actual emails and passwords
   ```

3. **Merge by displayName**
   ```typescript
   // Matches users by displayName and replaces ***HIDDEN*** values
   const merged = users.map(user => {
     const cred = credentials.find(c => c.displayName === user.displayName);
     if (cred && user.userPrincipalName === "***HIDDEN***") {
       user.userPrincipalName = cred.userPrincipalName;
       user.passwordProfile.password = cred.password;
     }
     return user;
   });
   ```

4. **Validate**
   ```typescript
   // Ensures no ***HIDDEN*** values remain
   // Validates email format
   // Checks required fields
   ```

5. **Create in Azure AD**
   ```typescript
   // Uses Microsoft Graph MCP to create users
   // Handles duplicates gracefully
   ```

---

## 🎬 Example Output

```bash
$ npm run create-users-mcp

  ╭──────────────────────────────────────────────────╮
  │  Azure AD Bulk User Creation via MCP              │
  │  Transport: stdio  |  Protocol: JSON-RPC 2.0      │
  ╰──────────────────────────────────────────────────╯

  📂 Loaded 15 user(s) from: users.json
  🔐 Loaded credentials from: users.credentials.json
  ✅ All user definitions are valid

  🔌 Connecting to MCP Server (stdio)...
  ✅ Connected — using REAL MCP protocol

  [1/15] Tom Baker <tom.baker@workasaservice.ai>
           ✅ Created  (ID: abc123...)
  [2/15] Kate Baker <kate.baker@workasaservice.ai>
           ✅ Created  (ID: def456...)

  ┌─────────────────────────────────────────────┐
  │  ✅ Created : 15                            │
  │  ⏭️  Skipped : 0                             │
  │  ❌ Failed  : 0                             │
  │  📊 Total   : 15                            │
  └─────────────────────────────────────────────┘
```

---

## 🔧 Azure AD Field Requirements

### Required Fields (Must Have)
When creating users in Azure AD via Microsoft Graph API:

- ✅ `displayName` - Full name
- ✅ `userPrincipalName` - Email address (must include @)
- ✅ `mailNickname` - Email alias
- ✅ `accountEnabled` - true/false
- ✅ `passwordProfile.password` - Initial password
- ✅ `passwordProfile.forceChangePasswordNextSignIn` - Recommended: true

### Optional Fields (Supported)
These fields enhance user profiles:

- ✅ `givenName` - First name
- ✅ `surname` - Last name
- ✅ `jobTitle` - Job title
- ✅ `department` - Department name
- ✅ `usageLocation` - Required if assigning licenses (e.g., "US")

### Post-Creation Only ⚠️

**Groups Field:**
The `groups` field in `users.json` is **metadata only**. Azure AD does not support assigning groups during user creation.

**Workflow:**
1. Create the user first
2. Then assign to groups using:
   ```
   POST /groups/{group-id}/members/$ref
   ```

---

## 🔐 Security Best Practices

1. **Credential File Security**
   - Never commit `users.credentials.json`
   - Rotate passwords regularly
   - Limit access to authorized personnel only

2. **Password Requirements**
   - Minimum 8 characters
   - Contains 3 of 4: uppercase, lowercase, numbers, symbols
   - Set `forceChangePasswordNextSignIn: true` for initial passwords

3. **Production Deployments**
   - Use Azure Key Vault for credential storage
   - Use environment variables
   - Implement proper access controls

---

## 📝 File Synchronization

When adding or modifying users:

1. **Update users.json**
   - Add/modify user structure
   - Keep credentials as `***HIDDEN***`
   - Commit to git ✅

2. **Update users.credentials.json**
   - Add/modify actual credentials
   - Ensure `displayName` matches users.json
   - Do NOT commit 🔒

3. **Run Creation Script**
   ```bash
   npm run create-users-mcp
   ```

---

## ❓ Troubleshooting

### Error: "userPrincipalName is still hidden"

**Cause:** `users.credentials.json` doesn't exist or is missing entries.

**Solution:**
1. Verify `users.credentials.json` exists in project root
2. Check that all users have matching `displayName` in both files
3. Ensure JSON is valid (no syntax errors)

### Error: "userPrincipalName must be a valid email"

**Cause:** Email format is invalid or still shows `***HIDDEN***`.

**Solution:**
- Check credentials file has proper email format with @
- Verify displayName matching is working

### Error: "Failed to create user"

**Cause:** Various Azure AD issues (permissions, duplicate, conflict).

**Solution:**
- Check Azure AD permissions (User.ReadWrite.All)
- Verify user doesn't already exist
- Check if domain is verified in Azure AD

### Info: "Already exists — skipped"

**This is normal!** The script checks if users exist before creating them. Users that already exist are safely skipped.

---

## 📚 Advanced Usage

### Custom users.json Location

```bash
npm run create-users-mcp path/to/custom-users.json
```

The script will still look for `users.credentials.json` in the project root.

### Manual Credential Merge (For Custom Scripts)

```typescript
import fs from 'fs';
import path from 'path';

// Load both files
const usersData = JSON.parse(fs.readFileSync('users.json', 'utf8'));
const credsData = JSON.parse(fs.readFileSync('users.credentials.json', 'utf8'));

// Merge
const merged = usersData.users.map(user => {
  const cred = credsData.credentials.find(c => c.displayName === user.displayName);
  return {
    ...user,
    userPrincipalName: cred?.userPrincipalName || user.userPrincipalName,
    passwordProfile: {
      ...user.passwordProfile,
      password: cred?.password || user.passwordProfile?.password
    }
  };
});

console.log('Merged users:', merged);
```

---

## 🎓 Related Documentation

- [Azure AD User Creation API](https://learn.microsoft.com/en-us/graph/api/user-post-users)
- [Password Policies](https://learn.microsoft.com/en-us/azure/active-directory/authentication/concept-sspr-policy)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview)
