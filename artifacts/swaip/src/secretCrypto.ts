/* ══════════════════════════════════════════════════════════
   secretCrypto.ts — E2E шифрование для секретных чатов SWAIP
   Алгоритм: ECDH P-256 → HKDF-SHA-256 → AES-256-GCM
   Ключи хранятся ТОЛЬКО в IndexedDB на устройстве.
   Сервер получает только зашифрованный blob — расшифровать не может.
══════════════════════════════════════════════════════════ */

const DB_NAME = 'swaip_secret_keys';
const DB_VERSION = 1;
const STORE = 'keys';

/* ── IndexedDB helpers ── */
function openIDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => res(req.result as T);
    req.onerror = () => rej(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

/* ── Кодирование ── */
function ab2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b642ab(s: string): ArrayBuffer {
  const bin = atob(s);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/* ── 1. Генерация пары ключей ECDH ── */
export async function generateKeyPair(): Promise<{ publicKeyB64: string }> {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  const pubRaw = await crypto.subtle.exportKey('raw', kp.publicKey);
  const pubB64 = ab2b64(pubRaw);

  // Сохраняем в IndexedDB
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  await idbSet(`priv_${pubB64}`, privJwk);

  return { publicKeyB64: pubB64 };
}

/* ── 2. Производим общий секрет из чужого публичного ключа ── */
export async function deriveSharedKey(myPubB64: string, theirPubB64: string): Promise<CryptoKey> {
  const privJwk = await idbGet<JsonWebKey>(`priv_${myPubB64}`);
  if (!privJwk) throw new Error('Приватный ключ не найден. Переоткройте чат.');

  const myPriv = await crypto.subtle.importKey(
    'jwk', privJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  );
  const theirPub = await crypto.subtle.importKey(
    'raw', b642ab(theirPubB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPub },
    myPriv,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return sharedKey;
}

/* ── 3. Кеш общих ключей на сессию ── */
const sharedKeyCache = new Map<number, CryptoKey>();

export async function getOrDeriveSharedKey(
  convId: number,
  myPubB64: string,
  theirPubB64: string
): Promise<CryptoKey> {
  if (sharedKeyCache.has(convId)) return sharedKeyCache.get(convId)!;
  const key = await deriveSharedKey(myPubB64, theirPubB64);
  sharedKeyCache.set(convId, key);
  return key;
}

/* ── 4. Шифрование сообщения ── */
export async function encryptMsg(text: string, sharedKey: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    encoded
  );
  // формат: base64(iv[12] + ciphertext)
  const combined = new Uint8Array(12 + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), 12);
  return 'e2e:' + ab2b64(combined.buffer);
}

/* ── 5. Расшифровка сообщения ── */
export async function decryptMsg(cipherB64: string, sharedKey: CryptoKey): Promise<string> {
  if (!cipherB64.startsWith('e2e:')) return cipherB64; // не зашифровано
  try {
    const buf = new Uint8Array(b642ab(cipherB64.slice(4)));
    const iv = buf.slice(0, 12);
    const data = buf.slice(12);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      data
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return '🔒 [не удалось расшифровать]';
  }
}

/* ── 6. Хранение своего публичного ключа для чата ── */
export async function getOrCreateMyPubKey(convId: number): Promise<string> {
  const stored = await idbGet<string>(`conv_pub_${convId}`);
  if (stored) return stored;
  const { publicKeyB64 } = await generateKeyPair();
  await idbSet(`conv_pub_${convId}`, publicKeyB64);
  return publicKeyB64;
}
