import { next } from '@vercel/functions';

// 홈페이지(/)만 잠급니다. 전체 사이트를 잠그려면 matcher를 '/(.*)' 로 바꾸세요.
export const config = {
  matcher: '/',
};

export default function middleware(request) {
  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, pass] = atob(encoded).split(':');
      if (user === process.env.SITE_USER && pass === process.env.SITE_PASS) {
        return next();
      }
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}
