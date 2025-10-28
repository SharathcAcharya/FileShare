/**
 * Crypto Manager
 * Handles end-to-end encryption using X25519 + ChaCha20-Poly1305
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface EncryptedChunk {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export class CryptoManager {
  private keypair: KeyPair | null = null;
  private sharedSecret: Uint8Array | null = null;
  private encryptionKey: Uint8Array | null = null;

  /**
   * Generate ephemeral X25519 keypair
   */
  generateKeyPair(): KeyPair {
    this.keypair = nacl.box.keyPair();
    return {
      publicKey: this.keypair.publicKey,
      secretKey: this.keypair.secretKey,
    };
  }

  /**
   * Get current keypair
   */
  getKeyPair(): KeyPair | null {
    return this.keypair;
  }

  /**
   * Derive shared secret using ECDH
   */
  deriveSharedSecret(peerPublicKey: Uint8Array): Uint8Array {
    if (!this.keypair) {
      throw new Error('Keypair not generated');
    }

    // Perform X25519 key exchange
    this.sharedSecret = nacl.box.before(peerPublicKey, this.keypair.secretKey);
    return this.sharedSecret;
  }

  /**
   * Derive encryption key using HKDF-SHA256
   */
  async deriveEncryptionKey(
    sharedSecret: Uint8Array,
    salt: string,
    info: string = 'FileShare-v1-ChaCha20'
  ): Promise<Uint8Array> {
    // Import shared secret as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );

    // Derive key using HKDF
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode(salt),
        info: new TextEncoder().encode(info),
      },
      keyMaterial,
      256 // 32 bytes
    );

    this.encryptionKey = new Uint8Array(derivedBits);
    return this.encryptionKey;
  }

  /**
   * Encrypt chunk using ChaCha20-Poly1305
   */
  encryptChunk(
    chunk: Uint8Array,
    fileId: string,
    chunkIndex: number
  ): EncryptedChunk {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not derived');
    }

    // Generate nonce from fileId + chunkIndex (deterministic but unique)
    const nonce = this.generateNonce(fileId, chunkIndex);

    // Encrypt using secret box (ChaCha20-Poly1305)
    const ciphertext = nacl.secretbox(chunk, nonce, this.encryptionKey);

    return {
      ciphertext,
      nonce,
    };
  }

  /**
   * Decrypt chunk using ChaCha20-Poly1305
   */
  decryptChunk(
    ciphertext: Uint8Array,
    fileId: string,
    chunkIndex: number
  ): Uint8Array | null {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not derived');
    }

    // Regenerate nonce
    const nonce = this.generateNonce(fileId, chunkIndex);

    // Decrypt
    const plaintext = nacl.secretbox.open(ciphertext, nonce, this.encryptionKey);

    if (!plaintext) {
      throw new Error('Decryption failed - authentication tag mismatch');
    }

    return plaintext;
  }

  /**
   * Generate deterministic nonce from fileId and chunkIndex
   */
  private generateNonce(fileId: string, chunkIndex: number): Uint8Array {
    // Combine fileId + chunkIndex
    const data = `${fileId}-${chunkIndex}`;
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);

    // Hash to get 24 bytes for nonce
    return this.hashToBytes(dataBytes, 24);
  }

  /**
   * Hash data to fixed-length bytes
   */
  private hashToBytes(data: Uint8Array, length: number): Uint8Array {
    // Use SHA-256 and take first `length` bytes
    const hash = nacl.hash(data);
    return hash.slice(0, length);
  }

  /**
   * Compute fingerprint for verification
   */
  getFingerprint(publicKeyA: Uint8Array, publicKeyB: Uint8Array): {
    hex: string;
    emoji: string;
  } {
    // Combine both public keys (order-independent)
    const combined =
      publicKeyA < publicKeyB
        ? new Uint8Array([...publicKeyA, ...publicKeyB])
        : new Uint8Array([...publicKeyB, ...publicKeyA]);

    // Hash combined keys
    const hash = nacl.hash(combined);

    // Take first 32 bytes (256 bits)
    const fingerprint = hash.slice(0, 32);

    // Convert to hex
    const hex = Array.from(fingerprint)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Convert to emoji (6 emojis from first 6 bytes)
    const emojis = [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐨',
      '🐯',
      '🦁',
      '🐮',
      '🐷',
      '🐸',
      '🐵',
      '🐔',
      '🐧',
      '🐦',
      '🐤',
      '🦆',
      '🦅',
      '🦉',
      '🦇',
      '🐺',
      '🐗',
      '🐴',
      '🦄',
      '🐝',
      '🐛',
      '🦋',
      '🐌',
      '🐞',
      '🐜',
      '🕷',
      '🦂',
      '🐢',
      '🐍',
      '🦎',
      '🦖',
      '🦕',
      '🐙',
      '🦑',
      '🦀',
      '🦞',
      '🦐',
      '🐠',
      '🐟',
      '🐡',
      '🐬',
      '🦈',
      '🐳',
      '🐋',
      '🌸',
      '🌺',
      '🌻',
      '🌹',
      '🌷',
      '🌵',
      '🌲',
      '🌳',
      '🌴',
      '🎄',
      '🍀',
      '🍁',
      '🍂',
      '🍃',
      '🌾',
      '🌿',
      '☘',
      '🍇',
      '🍈',
      '🍉',
      '🍊',
      '🍋',
      '🍌',
      '🍍',
      '🥭',
      '🍎',
      '🍏',
      '🍐',
      '🍑',
      '🍒',
      '🍓',
      '🥝',
      '🍅',
      '🥥',
      '🥑',
      '🍆',
      '🥔',
      '🥕',
      '🌽',
      '🌶',
      '🥒',
      '🥬',
      '🥦',
      '🍄',
      '🥜',
      '🌰',
      '🍞',
      '🥐',
      '🥖',
      '🥨',
      '🥯',
      '🥞',
      '🧀',
      '🍖',
      '🍗',
      '🥩',
      '🥓',
      '🍔',
      '🍟',
      '🍕',
      '🌭',
      '🥪',
      '🌮',
      '🌯',
      '🥙',
      '🥚',
      '🍳',
      '🥘',
      '🍲',
      '🥣',
      '🥗',
      '🍿',
      '🧂',
      '🥫',
      '🍱',
      '🍘',
      '🍙',
      '🍚',
      '🍛',
      '🍜',
      '🍝',
      '🍠',
      '🍢',
      '🍣',
      '🍤',
      '🍥',
      '🥮',
      '🍡',
      '🥟',
      '🥠',
      '🥡',
      '🦀',
      '🦞',
      '🦐',
      '🦑',
      '🍦',
      '🍧',
      '🍨',
      '🍩',
      '🍪',
      '🎂',
      '🍰',
      '🧁',
      '🥧',
      '🍫',
      '🍬',
      '🍭',
      '🍮',
      '🍯',
      '🍼',
      '🥛',
      '☕',
      '🍵',
      '🍶',
      '🍾',
      '🍷',
      '🍸',
      '🍹',
      '🍺',
      '🍻',
      '🥂',
      '🥃',
      '🥤',
      '🥢',
      '🍽',
      '🍴',
      '🥄',
      '🔪',
      '🏺',
      '⚽',
      '🏀',
      '🏈',
      '⚾',
      '🥎',
      '🎾',
      '🏐',
      '🏉',
      '🥏',
      '🎱',
      '🏓',
      '🏸',
      '🏒',
      '🏑',
      '🥍',
      '🏏',
      '🥅',
      '⛳',
      '🏹',
      '🎣',
      '🥊',
      '🥋',
      '🎽',
      '⛸',
      '🥌',
      '🛷',
      '🎿',
      '⛷',
      '🏂',
      '🏋',
      '🤼',
      '🤸',
      '🤺',
      '⛹',
      '🤾',
      '🏌',
      '🏇',
      '🧘',
      '🏊',
      '🤽',
      '🚣',
      '🧗',
      '🚴',
      '🚵',
      '🎪',
      '🎭',
      '🎨',
      '🎬',
      '🎤',
      '🎧',
      '🎼',
      '🎹',
      '🥁',
      '🎷',
      '🎺',
      '🎸',
      '🎻',
      '🎲',
      '🎯',
      '🎳',
      '🎮',
      '🎰',
    ];

    const emojiStr = fingerprint
      .slice(0, 6)
      .map((byte) => emojis[byte % emojis.length])
      .join('');

    return {
      hex,
      emoji: emojiStr,
    };
  }

  /**
   * Export public key as base64
   */
  exportPublicKey(): string {
    if (!this.keypair) {
      throw new Error('Keypair not generated');
    }
    return encodeBase64(this.keypair.publicKey);
  }

  /**
   * Import public key from base64
   */
  importPublicKey(base64: string): Uint8Array {
    return decodeBase64(base64);
  }

  /**
   * Clear all keys (for security)
   */
  clearKeys(): void {
    if (this.keypair) {
      this.keypair.secretKey.fill(0);
      this.keypair = null;
    }
    if (this.sharedSecret) {
      this.sharedSecret.fill(0);
      this.sharedSecret = null;
    }
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
      this.encryptionKey = null;
    }
  }
}
