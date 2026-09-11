import { next } from '@vercel/functions';

// 홈페이지(/)만 잠급니다. 전체 사이트를 잠그려면 matcher를 '/(.*)' 로 바꾸세요.
// 260911 by dykim css 파일도 인증관련 모드 차단되어 문제가 발생함을 AI 내용 확인하고 css 파일 제외한 나머지만 보안에 세팅하도록 변경 // matcher ~~~ 부분
export const config = {
    matcher: ['/((?!styles/|img/|favicon|apple-touch-icon|manifest).*)'], 
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
