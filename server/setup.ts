import { createInterface } from 'node:readline/promises';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { loadConfig, saveConfig, DATA_DIR } from './config.js';
import { hashPin } from './auth.js';
import { initPush } from './push.js';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const cfg = loadConfig();

console.log('\nPocket Claude setup\n───────────────────');

while (true) {
  const pin = (await rl.question(cfg.pin ? 'New PIN (6–12 digits, blank keeps current): ' : 'Choose a PIN (6–12 digits): ')).trim();
  if (!pin && cfg.pin) break;
  if (!/^\d{6,12}$/.test(pin)) {
    console.log('  PIN must be 6–12 digits.');
    continue;
  }
  const again = (await rl.question('Confirm PIN: ')).trim();
  if (again !== pin) {
    console.log('  PINs did not match.');
    continue;
  }
  cfg.pin = hashPin(pin);
  cfg.tokens = []; // changing the PIN signs out every phone
  break;
}

const expand = (p: string) => resolve(p.replace(/^~(?=$|\/)/, homedir()));
while (true) {
  const dir = (await rl.question(`Default folder for new sessions [${cfg.defaultDir}]: `)).trim();
  if (!dir) break;
  const full = expand(dir);
  if (existsSync(full) && statSync(full).isDirectory()) {
    cfg.defaultDir = full;
    break;
  }
  console.log(`  ${full} is not a folder.`);
}

saveConfig();
initPush();
rl.close();
console.log(`\nSaved to ${DATA_DIR}/config.json`);
console.log('Next:  npm run build && npm start\n');
