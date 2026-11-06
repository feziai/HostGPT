import { readFileSync, existsSync } from 'node:fs';
const path = new URL('../.env', import.meta.url);
if (existsSync(path)) {
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      let v = match[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v=v.slice(1,-1);
      process.env[match[1]]=v;
    }
  }
}
export const e = (name, def='') => process.env[name] || def;
export const configured = name => Boolean(e(name) && !e(name).startsWith('REPLACE_'));
