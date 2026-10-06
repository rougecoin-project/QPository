import { createHash } from 'node:crypto';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
export const DOMAIN = 'ROUGECHAIN_QPOSITORY_V1';
export function check(ok, message) { if (!ok) throw new Error(message); }
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const cid = bytes => `sha256:${hash(bytes)}`;
export function validCid(value) { check(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), 'Malformed CID'); return value; }
export function canonical(value) {
  function normalize(v) {
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'string') { check(/^[\x20-\x7e]*$/.test(v), 'Canonical strings must be printable ASCII'); return v; }
    if (typeof v === 'number') { check(Number.isSafeInteger(v) && !Object.is(v, -0), 'Canonical numbers must be safe integers'); return v; }
    if (Array.isArray(v)) return v.map(normalize);
    check(v && Object.getPrototypeOf(v) === Object.prototype, 'Unsupported canonical value');
    const out = Object.create(null);
    for (const key of Object.keys(v).sort()) { check(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key), 'Invalid canonical field'); out[key] = normalize(v[key]); }
    return out;
  }
  return Buffer.from(JSON.stringify(normalize(value)), 'utf8');
}
export function parseCanonical(bytes) {
  const value = JSON.parse(Buffer.from(bytes).toString('utf8'));
  check(canonical(value).equals(Buffer.from(bytes)), 'Noncanonical or duplicate-key envelope');
  return value;
}
export function exact(obj, fields) { check(obj && Object.getPrototypeOf(obj) === Object.prototype && Object.keys(obj).sort().join(',') === [...fields].sort().join(','), 'Malformed proof fields'); }
export function keyHex(value, size = 1952) { check(typeof value === 'string' && new RegExp(`^[a-f0-9]{${size * 2}}$`).test(value), 'Malformed ML-DSA key'); return value; }
export function name(value) { check(typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value), 'Owner/repository names must be lowercase ASCII (1-64 characters)'); return value; }
export const fingerprint = publicKey => hash(Buffer.from(keyHex(publicKey), 'hex'));
export const repositoryId = (publicKey, repo) => `${fingerprint(publicKey)}/${name(repo)}`;
export const symbol = repoId => `QPO${hash(repoId).slice(0,24).toUpperCase()}`;
export const collectionId = (publicKey, repoId) => `col:${keyHex(publicKey).slice(0,16)}:${symbol(repoId)}`;
export function validateManifest(m) {
  exact(m, ['protocol','version','repository_id','owner','repository','owner_public_key','chain_id','head','root','bundle_cid','timestamp','sequence','previous']);
  check(m.protocol === 'qpository' && m.version === 1, 'Incompatible QPository protocol');
  name(m.owner); name(m.repository); keyHex(m.owner_public_key);
  check(m.repository_id === repositoryId(m.owner_public_key,m.repository), 'Repository identity mismatch');
  check(typeof m.chain_id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(m.chain_id), 'Invalid chain ID');
  check(typeof m.head === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(m.head), 'Invalid Git HEAD');
  check(typeof m.root === 'string' && /^[a-f0-9]{64}$/.test(m.root), 'Invalid repository root'); validCid(m.bundle_cid);
  check(typeof m.timestamp === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(m.timestamp) && new Date(m.timestamp).toISOString() === m.timestamp, 'Invalid timestamp');
  check(Number.isSafeInteger(m.sequence) && m.sequence > 0, 'Invalid sequence');
  if (m.sequence === 1) check(m.previous === null, 'Replayed initial proof'); else validCid(m.previous);
  canonical(m); return m;
}
export const signingBytes = m => Buffer.concat([Buffer.from(`${DOMAIN}\0`), canonical(validateManifest(m))]);
export function signManifest(m, wallet) {
  check(wallet.publicKey === m.owner_public_key, 'Signer mismatch'); keyHex(wallet.privateKey,4032);
  return { manifest:m, signature:Buffer.from(ml_dsa65.sign(signingBytes(m),Buffer.from(wallet.privateKey,'hex'))).toString('hex') };
}
export function verifyEnvelope(bytes, expectedKey) {
  const e = parseCanonical(bytes); exact(e,['manifest','signature']); const m = validateManifest(e.manifest);
  check(m.owner_public_key === keyHex(expectedKey), 'Unknown signer');
  check(typeof e.signature === 'string' && /^[a-f0-9]{6618}$/.test(e.signature), 'Malformed signature');
  check(ml_dsa65.verify(Buffer.from(e.signature,'hex'),signingBytes(m),Buffer.from(expectedKey,'hex')), 'Invalid ML-DSA-65 signature'); return e;
}
