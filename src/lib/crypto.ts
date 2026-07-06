/**
 * Cryptography layer — all real, using the browser-native Web Crypto API.
 *
 *  • Passwords are verified with PBKDF2-SHA-256 (210k iterations) against a
 *    stored verifier + per-user salt. The password itself is never persisted.
 *  • Sensitive card fields (number, CVV, secure notes) are encrypted with
 *    AES-GCM-256. The AES key is derived from the user's master password via
 *    PBKDF2 and held only in memory for the length of the unlocked session.
 *
 * This mirrors the "encrypt at rest with a master key, never store CVV in
 * plaintext" guidance: nothing sensitive ever touches disk unencrypted.
 */

import type { EncryptedBlob } from '@/types';

const enc = new TextEncoder();
const dec = new TextDecoder();

const PBKDF2_ITERATIONS = 210_000;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function randomSalt(bytes = 16): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function deriveBits(password: string, salt: string, length: number): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    length,
  );
}

/** Password verifier (256-bit). Compared in constant time on login. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  return toBase64(await deriveBits(password, salt, 256));
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * Derive a Key-Encryption-Key (KEK) from a secret (password or recovery key)
 * plus salt. The KEK never encrypts data directly — it only wraps/unwraps the
 * random Data-Encryption-Key (see below). This is what lets us rotate the
 * password or recover with a recovery key without re-encrypting anything.
 */
export async function deriveKEK(secret: string, salt: string): Promise<CryptoKey> {
  const bits = await deriveBits(secret, salt, 256);
  return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Backwards-compatible alias (the app calls the unwrapped data key the "master key"). */
export const deriveMasterKey = deriveKEK;

/** Generate a fresh random Data-Encryption-Key — the key that actually encrypts card fields. */
export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** Encrypt (wrap) the data key with a KEK, producing a storable blob. */
export async function wrapKey(kek: CryptoKey, dataKey: CryptoKey): Promise<EncryptedBlob> {
  const raw = await crypto.subtle.exportKey('raw', dataKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw);
  return { iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

/** Decrypt (unwrap) the data key with a KEK. Throws if the KEK is wrong. */
export async function unwrapKey(kek: CryptoKey, blob: EncryptedBlob): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(blob.iv) },
    kek,
    fromBase64(blob.ciphertext),
  );
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

// Unambiguous alphabet (no 0/O/1/I) for a human-transcribable recovery key.
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A ~100-bit recovery key, grouped for readability: ABCD-EFGH-JKLM-NPQR-STUV */
export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += RECOVERY_ALPHABET[bytes[i] % 32];
  return s.replace(/(.{4})(?=.)/g, '$1-');
}

export function normalizeRecoveryKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export async function encryptField(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  );
  return { iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

export async function decryptField(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ciphertext),
  );
  return dec.decode(plaintext);
}

/** Format a decrypted card number as grouped digits: 4589 → •••• •••• •••• 4589 */
export function maskCardNumber(last4: string): string {
  return `•••• •••• •••• ${last4}`;
}

export function groupCardNumber(full: string): string {
  return full
    .replace(/\D/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim();
}
