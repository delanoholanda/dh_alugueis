
'use server';

import { cookies } from 'next/headers';
import type { UserProfile } from '@/types';

const AUTH_COOKIE_NAME = 'user_session_dhalugueis';
// 7 dias de validade para o cookie
const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7; 

/**
 * Cria um cookie de sessão seguro e HttpOnly para o usuário.
 * Este cookie será usado para validar o usuário em Server Actions.
 */
export async function setAuthCookie(user: UserProfile) {
  const cookieStore = cookies();
  
  cookieStore.set(AUTH_COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true, // Impede o acesso via JavaScript no cliente
    secure: process.env.NODE_ENV === 'production', // Use secure em produção (HTTPS)
    maxAge: ONE_WEEK_IN_SECONDS, // Tempo de vida do cookie
    path: '/', // Disponível em toda a aplicação
    sameSite: 'lax', // Proteção contra ataques CSRF
  });
}

/**
 * Deleta o cookie de sessão do usuário, efetivamente fazendo o logout.
 */
export async function deleteAuthCookie() {
  const cookieStore = cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

/**
 * Obtém o perfil do usuário do cookie de sessão.
 * Esta função apenas lê o cookie e não executa validações no banco de dados.
 * Retorna null se o cookie não existir ou for inválido.
 */
export async function getUserProfileFromCookie(): Promise<UserProfile | null> {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME);

    if (!sessionCookie?.value) {
        return null;
    }

    try {
        const user = JSON.parse(sessionCookie.value) as UserProfile;
        if (!user || !user.id || !user.email) {
            return null;
        }
        return user;
    } catch (error) {
        console.error('[auth-cookie] Error parsing session cookie:', error);
        return null;
    }
}
