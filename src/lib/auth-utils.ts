
'use server';

import { cookies } from 'next/headers';
import { getDb } from '@/lib/database';
import type { UserProfile } from '@/types';

// Nome do cookie que armazena a sessão
const AUTH_COOKIE_NAME = 'user_session_dhalugueis';

/**
 * Valida a sessão do usuário no lado do servidor.
 * Esta função deve ser chamada no início de cada Server Action que modifica dados.
 * Ela verifica o cookie de sessão, decodifica-o e confirma se o usuário existe no banco de dados.
 *
 * @returns {Promise<UserProfile>} O perfil do usuário autenticado.
 * @throws {Error} Se o usuário não estiver autenticado ou a sessão for inválida.
 */
export async function validateServerSession(): Promise<UserProfile> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME);

  if (!sessionCookie?.value) {
    throw new Error('Acesso não autorizado: Você precisa estar logado para realizar esta ação.');
  }

  try {
    // Em um sistema de produção real com JWT, aqui você decodificaria e verificaria o token.
    // Para este sistema, estamos decodificando o objeto de usuário que foi salvo no cookie.
    const user = JSON.parse(sessionCookie.value) as UserProfile;

    if (!user || !user.id || !user.email) {
      throw new Error('Sessão inválida.');
    }

    // Como uma verificação extra de segurança, confirmamos que o ID do usuário da sessão
    // realmente existe no banco de dados. Isso previne que um cookie antigo de um usuário deletado
    // continue sendo válido.
    const db = getDb();
    const dbUser = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id);

    if (!dbUser) {
      // Se o usuário não existe mais, invalidamos o cookie e lançamos um erro.
      cookieStore.delete(AUTH_COOKIE_NAME);
      throw new Error('Sessão inválida: Usuário não encontrado.');
    }

    // Retorna o perfil do usuário se tudo estiver correto.
    return user;

  } catch (error) {
    console.error('[validateServerSession] Erro de validação de sessão:', error);
    // Limpa o cookie em caso de qualquer erro de parsing ou validação.
    cookieStore.delete(AUTH_COOKIE_NAME);
    throw new Error('Sessão inválida ou expirada. Por favor, faça login novamente.');
  }
}
