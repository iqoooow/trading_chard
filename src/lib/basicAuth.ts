import { timingSafeEqual } from 'node:crypto';

// Doimiy vaqtda solishtirish — javob vaqtidan parolni taxmin qilib bo'lmasin
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// "Authorization: Basic base64(login:parol)" sarlavhasini tekshiradi
export function isAuthorized(header: string | null, username: string, password: string): boolean {
  if (!header?.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator === -1) return false;
  // Ikkalasi ham tekshiriladi (qisqa tutashuvsiz) — qaysi biri xato ekani vaqtdan bilinmasin
  const userOk = safeEqual(decoded.slice(0, separator), username);
  const passOk = safeEqual(decoded.slice(separator + 1), password);
  return userOk && passOk;
}
