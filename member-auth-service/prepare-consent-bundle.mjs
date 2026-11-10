import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [termsPath,termsVersion,privacyPath,privacyVersion,destination] = process.argv.slice(2);
if (!termsPath || !privacyPath || !destination || ![termsVersion,privacyVersion].every(v=>typeof v==='string' && /^[A-Za-z0-9._-]{1,100}$/.test(v))) throw new Error('Usage: node prepare-consent-bundle.mjs <terms.txt> <terms-version> <privacy.txt> <privacy-version> <output.mjs>');
async function document(path,version){
 const bytes=await readFile(path);
 if (!bytes.length || bytes.length>1024*1024) throw new Error('Invalid document size');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if (!text.trim()) throw new Error('Empty document');
 return {version,text};
}
const terms=await document(termsPath,termsVersion),privacy=await document(privacyPath,privacyVersion);
const digest=d=>createHash('sha256').update(d.text,'utf8').digest('hex');
await writeFile(destination,`// Generated reviewed documents; review before release.\nexport default ${JSON.stringify({terms,privacy})};\n`,{flag:'wx'});
console.log(`MEMBER_TERMS_VERSION=${terms.version}\nMEMBER_TERMS_SHA256=${digest(terms)}\nMEMBER_PRIVACY_VERSION=${privacy.version}\nMEMBER_PRIVACY_SHA256=${digest(privacy)}`);
