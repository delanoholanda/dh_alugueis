
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware para proteger as rotas do dashboard.
 * Em produção, verifica a existência do cookie de sessão.
 * Em desenvolvimento, permite o acesso para facilitar a prototipagem.
 */
export function middleware(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production';
  const session = request.cookies.get('user_session_dhalugueis');
  const { pathname } = request.nextUrl;

  // Em produção, se o usuário tenta acessar o dashboard sem um cookie de sessão, redireciona para login
  if (isProduction && pathname.startsWith('/dashboard') && !session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Configura o middleware para rodar apenas nas rotas do dashboard
export const config = {
  matcher: ['/dashboard/:path*'],
};
