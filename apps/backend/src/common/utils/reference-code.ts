import type { PrismaClient } from '@prisma/client';

type PrismaTransactionClient = Parameters<
  Parameters<PrismaClient['$transaction']>[0]
>[0];

// Stable advisory lock keys — one per entity type to serialize reference code generation.
const ADVISORY_LOCK_RFQ = 100001;
const ADVISORY_LOCK_QUOTE = 100002;
const ADVISORY_LOCK_ORDER = 100003;

/**
 * Uses pg_advisory_xact_lock to serialize reference code generation.
 * MAX(CAST(SUBSTRING(... FROM 5) AS INTEGER)) finds the highest numeric suffix
 * without relying on lexicographic ordering, which breaks once the sequence
 * grows beyond 5 digits (e.g. 100000 sorts before 99999 as a string).
 */

export async function generateRfqReferenceCode(
  tx: PrismaTransactionClient,
): Promise<string> {
  const db = tx as PrismaClient;
  await db.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_RFQ})`;

  const rows = await db.$queryRaw<
    { max_seq: number | null }[]
  >`SELECT MAX(CAST(SUBSTRING("referenceCode" FROM 5) AS INTEGER)) AS max_seq FROM "RFQ" WHERE "referenceCode" IS NOT NULL AND "referenceCode" ~ '^RFQ-[0-9]+$'`;

  const nextNumber = Number(rows[0]?.max_seq ?? 0) + 1;
  return `RFQ-${String(nextNumber).padStart(5, '0')}`;
}

export async function generateQuoteReferenceCode(
  tx: PrismaTransactionClient,
): Promise<string> {
  const db = tx as PrismaClient;
  await db.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_QUOTE})`;

  const rows = await db.$queryRaw<
    { max_seq: number | null }[]
  >`SELECT MAX(CAST(SUBSTRING("referenceCode" FROM 5) AS INTEGER)) AS max_seq FROM "Quote" WHERE "referenceCode" IS NOT NULL AND "referenceCode" ~ '^QUO-[0-9]+$'`;

  const nextNumber = Number(rows[0]?.max_seq ?? 0) + 1;
  return `QUO-${String(nextNumber).padStart(5, '0')}`;
}

export async function generateOrderReferenceCode(
  tx: PrismaTransactionClient,
): Promise<string> {
  const db = tx as PrismaClient;
  await db.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_ORDER})`;

  const rows = await db.$queryRaw<
    { max_seq: number | null }[]
  >`SELECT MAX(CAST(SUBSTRING("referenceCode" FROM 5) AS INTEGER)) AS max_seq FROM "Order" WHERE "referenceCode" IS NOT NULL AND "referenceCode" ~ '^ORD-[0-9]+$'`;

  const nextNumber = Number(rows[0]?.max_seq ?? 0) + 1;
  return `ORD-${String(nextNumber).padStart(5, '0')}`;
}
