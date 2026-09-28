import { NextResponse, type NextRequest } from 'next/server';
import { isAuthorized } from '@/lib/basicAuth';

// Saytni login/parol bilan yopish (HTTP Basic Auth). Faqat SITE_PASSWORD berilganda yoqiladi —
// asosiy himoya Vercel Authentication bo'lsa, bu hech narsa qilmaydi.
// /api/cron/* bu yerdan o'tmaydi: Vercel Cron o'zining Authorization sarlavhasini yuboradi
// va route o'zi CRON_SECRET bilan himoyalangan.
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const username = process.env.SITE_USERNAME ?? 'admin';
  if (isAuthorized(request.headers.get('authorization'), username, password)) return NextResponse.next();

  return new NextResponse('Kirish uchun login va parol kerak', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="XAU/USD zonalar", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ['/((?!api/cron|_next/static|_next/image|favicon.ico).*)'],
};
