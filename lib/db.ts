import { PrismaClient } from "@prisma/client";

// Single Prisma client per process; survives Next.js dev HMR via globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Several routes do real work inside one interactive transaction — re-running risk and
    // routing, rewriting approval steps, planning a split. Against a local socket that is a
    // few milliseconds; against a hosted database each round trip costs far more, and Prisma's
    // 5s default aborts the transaction mid-flight. The work is unchanged, so the ceiling is
    // what has to move.
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
