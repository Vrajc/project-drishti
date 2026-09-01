import crypto from 'crypto';

// Camera stream credentials have to be replayed to the device, so they cannot be
// hashed the way a user password is - they must be recoverable. They are encrypted
// at rest with AES-256-GCM under a key held only in the environment.
//
// If CAMERA_CREDENTIAL_KEY is not configured we refuse to store a credential at all.
// Writing it in plaintext "for now" would be a silent downgrade that nobody would
// notice until it mattered.

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export class CredentialKeyMissingError extends Error {
  constructor() {
    super(
      'CAMERA_CREDENTIAL_KEY is not configured, so camera credentials cannot be ' +
        'encrypted. Set a 32-byte hex or base64 key in the environment, or register ' +
        'the camera without a password.'
    );
    this.name = 'CredentialKeyMissingError';
  }
}

function loadKey(): Buffer | null {
  const raw = process.env.CAMERA_CREDENTIAL_KEY;
  if (!raw) return null;

  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');

  if (key.length !== 32) {
    throw new Error(
      `CAMERA_CREDENTIAL_KEY must decode to 32 bytes, got ${key.length}. ` +
        'Generate one with: openssl rand -hex 32'
    );
  }

  return key;
}

export function isCredentialEncryptionConfigured(): boolean {
  return loadKey() !== null;
}

/** Returns `iv:tag:ciphertext`, all base64. Throws if no key is configured. */
export function encryptCredential(plaintext: string): string {
  const key = loadKey();
  if (!key) throw new CredentialKeyMissingError();

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/**
 * Only the stream workers need this. It throws rather than returning a partial
 * result, so a caller can never mistake a failed decrypt for an empty password.
 */
export function decryptCredential(stored: string): string {
  const key = loadKey();
  if (!key) throw new CredentialKeyMissingError();

  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Stored credential is not in the expected iv:tag:ciphertext form');
  }

  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
