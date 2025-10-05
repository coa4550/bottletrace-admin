import { NextResponse } from 'next/server';
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|health).*)'] };
export function middleware(req) {
  const basicAuth = req.headers.get('authorization');
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    return new NextResponse('Admin auth not configured', { status: 500 });
  }
  if (basicAuth) {
    const val = basicAuth.split(' ')[1];
    const [u, p] = Buffer.from(val, 'base64').toString().split(':');
    if (u === user && p === pass) return NextResponse.next();
  }
  return new NextResponse('Auth required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' } });
}
