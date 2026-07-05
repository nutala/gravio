// Import directly from the generated client to bypass any cached re-export
// in the @prisma/client package wrapper.
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion: string | undefined
}

/// Bump this when the Prisma schema changes to force a new client instance
/// (the global singleton would otherwise keep the old field definitions).
const SCHEMA_VERSION = 'v5-rebuild-user-cat'

// Always create a fresh client in dev when the version bumps, and disconnect
// any previous instance to release its connection.
if (globalForPrisma.prisma && globalForPrisma.prismaSchemaVersion !== SCHEMA_VERSION) {
  globalForPrisma.prisma.$disconnect().catch(() => {})
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaSchemaVersion = SCHEMA_VERSION
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

globalForPrisma.prisma = db
globalForPrisma.prismaSchemaVersion = SCHEMA_VERSION