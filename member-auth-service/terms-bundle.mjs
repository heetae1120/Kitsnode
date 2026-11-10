import {createHash} from 'node:crypto';

// The digest is pinned independently in Worker configuration, and the existing
// DB consent gate enforces immutable text for each version.
export function verifyBundledTerms(bundle, version, expectedHash) {
  if (!bundle || typeof bundle.text !== 'string' || !bundle.text.trim() || typeof version !== 'string' || !version.trim() || bundle.version !== version || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error('Invalid bundled terms');
  if (Buffer.byteLength(bundle.text, 'utf8') > 1024 * 1024) throw new Error('Terms too large');
  const actual = createHash('sha256').update(bundle.text, 'utf8').digest('hex');
  if (actual !== expectedHash) throw new Error('Terms digest mismatch');
  return bundle.text;
}
