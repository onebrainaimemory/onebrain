# Encryption at Rest

## Current Status

| Layer                        | Status                   | Notes                              |
| ---------------------------- | ------------------------ | ---------------------------------- |
| TLS in transit               | Enabled                  | Caddy auto-HTTPS for all endpoints |
| At-rest encryption           | Infrastructure-dependent | See options below                  |
| Application-level encryption | Not yet implemented      | Consider for PII fields            |

## Option 1: Encrypted Docker Volumes (Recommended for Hetzner)

The simplest approach for self-hosted deployments. The host filesystem is encrypted,
so all Docker volumes (including PostgreSQL data) are encrypted transparently.

### Setup on Hetzner VPS

Hetzner Cloud servers support LUKS full-disk encryption during provisioning:

1. Enable encryption when creating the server via Hetzner Cloud Console or API.
2. All data written to disk — including Docker volumes — is encrypted at rest.
3. No application or database configuration changes required.

### Manual LUKS Setup (Existing Servers)

```bash
# Create an encrypted partition for Docker data
cryptsetup luksFormat /dev/sdb
cryptsetup luksOpen /dev/sdb encrypted-data
mkfs.ext4 /dev/mapper/encrypted-data
mount /dev/mapper/encrypted-data /var/lib/docker

# Add to /etc/crypttab for persistence
echo "encrypted-data /dev/sdb none luks" >> /etc/crypttab
```

This ensures all Docker volumes, including PostgreSQL data directories, are
encrypted without any database-level changes.

## Option 2: PostgreSQL Transparent Data Encryption (TDE)

PostgreSQL does not natively support TDE in the community edition.
Available approaches:

### pg_tde Extension (PostgreSQL 17+)

The `pg_tde` extension from Percona provides TDE for PostgreSQL:

```sql
-- Install the extension
CREATE EXTENSION pg_tde;

-- Configure a key provider
SELECT pg_tde_add_key_provider_file(
  'local-key-provider',
  '/etc/postgresql/tde-keys/'
);

-- Set the principal key
SELECT pg_tde_set_principal_key(
  'onebrain-principal-key',
  'local-key-provider'
);

-- Create tables with encryption
CREATE TABLE sensitive_data (
  id UUID PRIMARY KEY,
  content TEXT
) USING tde_heap;
```

**Limitations:**

- Requires PostgreSQL 17+ with the pg_tde extension compiled
- Not available in the standard `postgres:16-alpine` Docker image
- Adds operational complexity for key management

### pgcrypto (Column-Level Encryption)

For encrypting specific sensitive columns without TDE:

```sql
CREATE EXTENSION pgcrypto;

-- Encrypt on insert
INSERT INTO user_data (email_encrypted)
VALUES (pgp_sym_encrypt('user@example.com', current_setting('app.encryption_key')));

-- Decrypt on read
SELECT pgp_sym_decrypt(email_encrypted::bytea, current_setting('app.encryption_key'))
FROM user_data;
```

**Trade-offs:**

- Granular control over what is encrypted
- Cannot index encrypted columns (no WHERE clause filtering)
- Application must manage encryption/decryption logic

## Option 3: Application-Level Encryption

Encrypt sensitive fields before writing to the database:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(ciphertext: string): string {
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, 16);
  const tag = data.subarray(16, 32);
  const encrypted = data.subarray(32);
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

**Trade-offs:**

- Full control, works with any PostgreSQL version
- Encrypted data cannot be queried or indexed
- Key rotation requires re-encrypting all data

## Recommendation for OneBrain

1. **Immediate**: Use encrypted Docker volumes via Hetzner LUKS (Option 1).
   This provides at-rest encryption with zero application changes.

2. **Future**: Consider application-level encryption (Option 3) for
   high-sensitivity PII fields (email, display name) if regulatory
   requirements demand field-level encryption beyond volume encryption.

3. **Avoid** pgcrypto column-level encryption unless specific columns need
   independent encryption keys, as it complicates queries significantly.
