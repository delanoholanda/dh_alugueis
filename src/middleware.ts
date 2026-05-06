
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware para proteger as rotas do dashboard.
 * Verifica a existência do cookie de sessão antes de permitir o acesso.
 */
export function middleware(request: NextRequest) {
  const session = request.cookies.get('user_session_dhalugueis');
  const { pathname } = request.nextUrl;

  // Se o usuário tenta acessar o dashboard sem um cookie de sessão, redireciona para login
  if (pathname.startsWith('/dashboard') && !session) {
    const loginUrl = new URL('/login', request.url);
    // Opcional: Salvar a URL que ele tentou acessar para redirecionar de volta depois
    // loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Configura o middleware para rodar apenas nas rotas do dashboard
export const config = {
  matcher: ['/dashboard/:path*'],
};
