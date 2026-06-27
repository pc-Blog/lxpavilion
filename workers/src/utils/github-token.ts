/**
 * GitHub App Installation Token 获取
 *
 * 流程：Private Key (PKCS#1 PEM) → RS256 JWT → Installation Token
 * 缓存 token 直到过期前 5 分钟，避免每次请求都重新生成。
 */

import type { Env } from "../types";

/* ── PEM → DER ── */

interface PemResult {
  der: Uint8Array;
  isPkcs1: boolean;
}

function pemToDer(pem: string): Uint8Array {
  const normalized = pem.replace(/\r\n?/g, "\n").trim();
  const match = normalized.match(/-----BEGIN[^-]+-----([\s\S]+?)-----END[^-]+-----/);
  if (!match) throw new Error("Invalid PEM format: cannot find key content");
  const b64 = match[1].replace(/\s/g, "");
  return base64Decode(b64);
}

/* ── 手动 base64 解码（替代 atob，兼容性更好） ── */

function base64Decode(str: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = str.replace(/=+$/, "");
  const len = clean.length;
  const bytes: number[] = [];
  for (let i = 0; i < len; i += 4) {
    const remain = len - i;
    const a = chars.indexOf(clean[i]);
    const b = remain > 1 ? chars.indexOf(clean[i + 1]) : -1;
    const c = remain > 2 ? chars.indexOf(clean[i + 2]) : -1;
    const d = remain > 3 ? chars.indexOf(clean[i + 3]) : -1;
    if (a < 0 || b < 0) break;
    bytes.push((a << 2) | (b >> 4));
    if (c < 0) break;
    bytes.push(((b & 0x0f) << 4) | (c >> 2));
    if (d < 0) break;
    bytes.push(((c & 0x03) << 6) | d);
  }
  return new Uint8Array(bytes);
}

/* ── DER 编码工具 ── */

type DerTag = "INTEGER" | "OCTET STRING" | "SEQUENCE";

const TAG_BYTE: Record<DerTag, number> = {
  INTEGER: 0x02,
  "OCTET STRING": 0x04,
  SEQUENCE: 0x30,
};

function derEncode(tag: DerTag, content: Uint8Array): Uint8Array {
  const t = TAG_BYTE[tag];
  const len = content.length;

  // DER 长度编码
  let lenBytes: Uint8Array;
  if (len < 0x80) {
    lenBytes = new Uint8Array([len]);
  } else {
    const hex = len.toString(16);
    const n = Math.ceil(hex.length / 2);
    lenBytes = new Uint8Array(n + 1);
    lenBytes[0] = 0x80 | n;
    const padded = hex.padStart(n * 2, "0");
    for (let i = 0; i < n; i++) {
      lenBytes[i + 1] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
    }
  }

  const buf = new Uint8Array(1 + lenBytes.length + len);
  buf[0] = t;
  buf.set(lenBytes, 1);
  buf.set(content, 1 + lenBytes.length);
  return buf;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const r = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    r.set(a, off);
    off += a.length;
  }
  return r;
}

/**
 * 将 PKCS#1 RSA 私钥 DER 包装为 PKCS#8 格式。
 *
 * PrivateKeyInfo ::= SEQUENCE {
 *   version                 INTEGER (0),
 *   privateKeyAlgorithm     SEQUENCE { OID rsaEncryption, NULL },
 *   privateKey              OCTET STRING { pkcs1Der }
 * }
 */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  // rsaEncryption OID 1.2.840.113549.1.1.1 + NULL
  const algoId = new Uint8Array([
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  ]);

  const version = derEncode("INTEGER", new Uint8Array([0x00]));
  const octetStr = derEncode("OCTET STRING", pkcs1);
  const inner = concat(version, algoId, octetStr);
  return derEncode("SEQUENCE", inner);
}

/* ── Base64URL ── */

function base64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/* ── 导入私钥 ── */

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToDer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/* ── Token 缓存 ── */

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * 获取 GitHub App Installation Token。
 *
 * 1. 用 App 私钥签发 RS256 JWT（10 分钟有效）
 * 2. 用 JWT 换取 Installation Token（1 小时有效）
 * 3. 缓存到过期前 5 分钟
 */
export async function getInstallationToken(env: Env): Promise<string> {
  // 缓存命中且剩余 > 5 分钟
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60_000) {
    return cachedToken.token;
  }

  // ── 签发 JWT ──
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 600, iss: env.GITHUB_APP_ID };

  const b64h = base64Url(new TextEncoder().encode(JSON.stringify(header)));
  const b64p = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const message = `${b64h}.${b64p}`;

  const key = await importPrivateKey(env.GITHUB_APP_PRIVATE_KEY);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(message),
  );

  const jwt = `${message}.${base64Url(sig)}`;

  // ── 换取 Installation Token ──
  const resp = await fetch(
    `https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "blog-worker/1.0",
      },
    },
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub App auth failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { token: string; expires_at: string };

  cachedToken = {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime(),
  };

  return data.token;
}
