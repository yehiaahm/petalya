// Prints fresh random values for the Railway variables. Nothing is written to disk.
//   npm run secrets
import { randomBytes } from 'node:crypto';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const password = Array.from(randomBytes(18), (b) => alphabet[b % alphabet.length]).join('');

console.log('Paste these into Railway → your service → Variables:\n');
console.log('SESSION_SECRET=' + randomBytes(48).toString('hex'));
console.log('ADMIN_PASSWORD=' + password);
console.log('\nADMIN_PASSWORD is the first admin login; change it later from Admin → Settings → Security.');
