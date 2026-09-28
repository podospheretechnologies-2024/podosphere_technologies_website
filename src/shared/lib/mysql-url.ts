/**
 * Prisma CLI needs a `mysql://` URL; the MariaDB driver (which also speaks MySQL) wants `mariadb://`.
 * MySQL 8 uses caching_sha2_password, which needs public-key retrieval on non-TLS local connections.
 * Shared by the app (prisma.ts) and the seed script, so it has no server-only import.
 */
export function mysqlDriverUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl.replace(/^mysql:/, 'mariadb:'));
  if (!url.searchParams.has('allowPublicKeyRetrieval')) {
    url.searchParams.set('allowPublicKeyRetrieval', 'true');
  }
  return url.toString();
}
