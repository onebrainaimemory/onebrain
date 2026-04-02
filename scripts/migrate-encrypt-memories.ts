#!/usr/bin/env tsx
/**
 * Migration script: Encrypt existing unencrypted memory items.
 *
 * Processes memories in batches, encrypting title and body fields
 * using per-tenant HKDF-derived keys.
 *
 * Usage:
 *   MEMORY_ENCRYPTION_KEY=<hex> DATABASE_URL=<url> npx tsx scripts/migrate-encrypt-memories.ts
 *
 * Options:
 *   --dry-run    Show what would be encrypted without making changes
 *   --batch=N    Batch size (default: 100)
 */
import { PrismaClient } from '@onebrain/db';
import {
  encryptMemoryField,
  isMemoryEncryptionEnabled,
  isMemoryEncrypted,
} from '../apps/api/src/lib/memory-encryption.js';

const BATCH_SIZE = parseInt(
  process.argv.find((a) => a.startsWith('--batch='))?.split('=')[1] ?? '100',
  10,
);
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (!isMemoryEncryptionEnabled()) {
    console.error('ERROR: MEMORY_ENCRYPTION_KEY not configured or invalid (need 64 hex chars)');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const total = await prisma.memoryItem.count({
      where: { isEncrypted: false, deletedAt: null },
    });

    console.info(`Found ${total} unencrypted memories to process.`);
    if (DRY_RUN) console.info('DRY RUN — no changes will be made.');

    let processed = 0;
    let cursor: string | undefined;

    while (processed < total) {
      const batch = await prisma.memoryItem.findMany({
        where: { isEncrypted: false, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          userId: true,
          title: true,
          body: true,
        },
      });

      if (batch.length === 0) break;

      for (const item of batch) {
        if (isMemoryEncrypted(item.title) && isMemoryEncrypted(item.body)) {
          // Already encrypted — just update the flag
          if (!DRY_RUN) {
            await prisma.memoryItem.update({
              where: { id: item.id },
              data: { isEncrypted: true },
            });
          }
          processed++;
          continue;
        }

        const encTitle = encryptMemoryField(item.userId, item.title);
        const encBody = encryptMemoryField(item.userId, item.body);

        if (!DRY_RUN) {
          await prisma.memoryItem.update({
            where: { id: item.id },
            data: {
              title: encTitle,
              body: encBody,
              isEncrypted: true,
            },
          });
        }

        processed++;
      }

      cursor = batch[batch.length - 1]?.id;
      console.info(`Processed ${processed}/${total} memories...`);
    }

    console.info(`Done. ${processed} memories ${DRY_RUN ? 'would be' : 'were'} encrypted.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
