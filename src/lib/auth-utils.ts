
'use server';

import { cookies } from 'next/headers';
import { getDb } from '@/lib/database';
import type { UserProfile } from '@/types';

const AUTH_COOKIE_NAME = 'user_session_dhalugueis';

/**
 * Valida a sessão do usuário no lado do servidor.
 * Em produção: rigorosa. Em desenvolvimento: flexível com fallback.
 */
export async function validateServerSession(): Promise<UserProfile> {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME);

  if (!sessionCookie?.value) {
    if (!isProduction) {
      console.log('[Auth Utils] Dev mode: Session cookie not found, using dev fallback.');
      return { id: 'dev_user', name: 'Desenvolvedor', email: 'dev@dhalugueis.com' };
    }
    throw new Error('Acesso não autorizado: Você precisa estar logado para realizar esta ação.');
  }

  try {
    const user = JSON.parse(sessionCookie.value) as UserProfile;

    if (!user || !user.id || !user.email) {
      throw new Error('Sessão inválida.');
    }

    const db = getDb();
    const dbUser = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id);

    if (!dbUser) {
      if (!isProduction) return user;
      cookieStore.delete(AUTH_COOKIE_NAME);
      throw new Error('Sessão inválida: Usuário não encontrado.');
    }

    return user;

  } catch (error) {
    if (!isProduction) {
        return { id: 'dev_user', name: 'Desenvolvedor', email: 'dev@dhalugueis.com' };
    }
    console.error('[validateServerSession] Erro de validação de sessão:', error);
    throw new Error('Sessão inválida ou expirada. Por favor, faça login novamente.');
  }
}
