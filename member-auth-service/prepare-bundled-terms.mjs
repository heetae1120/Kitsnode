import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const [source, version, destination] = process.argv.slice(2);
if (!source || !version || !destination || !/^[A-Za-z0-9._-]{1,100}$/.test(version)) throw new Error('Usage: node prepare-bundled-terms.mjs <terms.txt> <version> <output.mjs>');
const bytes = await readFile(source);
if (!bytes.length || bytes.length > 1024 * 1024) throw new Error('Invalid document size');
const text = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
if (!text.trim()) throw new Error('Empty terms');
const digest = createHash('sha256').update(text, 'utf8').digest('hex');
await writeFile(destination, `// Generated reviewed terms; review before deployment.\nexport default ${JSON.stringify({version,text})};\n`, {flag:'wx'});
console.log(`MEMBER_TERMS_VERSION=${version}\nMEMBER_TERMS_SHA256=${digest}`);
