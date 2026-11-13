// Lag SHA-256-hash av et passord til config.ts (users[].passwordHash).
// Bruk:  node scripts/hash-password.mjs "MittNyePassord"
import { createHash } from 'node:crypto';

const pw = process.argv[2];
if (!pw) {
  console.error('Bruk: node scripts/hash-password.mjs "passord"');
  process.exit(1);
}
console.log(createHash('sha256').update(pw, 'utf8').digest('hex'));
