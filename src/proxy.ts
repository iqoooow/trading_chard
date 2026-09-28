import { NextResponse, type NextRequest } from 'next/server';
import { isAuthorized } from '@/lib/basicAuth';

// Saytni login/parol bilan yopish (HTTP Basic Auth) — saytning yagona himoyasi.
// Production'da SITE_PASSWORD bo'lmasa sayt umuman ochilmaydi (o'zgaruvchi unutilsa ham
// jimgina ochiq qolmasin). Lokal dev'da parol ixtiyoriy.
// /api/cron/* bu yerdan o'tmaydi: Vercel Cron o'zining Authorization sarlavhasini yuboradi
// va route o'zi CRON_SECRET bilan himoyalangan.
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return new NextResponse('Sayt yopiq: SITE_PASSWORD sozlanmagan', { status: 503 });
  }

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
