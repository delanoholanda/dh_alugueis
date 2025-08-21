
'use server';

import { getDb } from '@/lib/database';

export async function forceDbCheckpoint(): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    // PRAGMA wal_checkpoint(TRUNCATE) tenta comitar as transações e, se bem-sucedido,
    // apaga o arquivo -wal, deixando o .db principal totalmente atualizado.
    // É a melhor opção para criar um estado consistente para backup.
    db.pragma('wal_checkpoint(TRUNCATE)');
    console.log('[DB Action] Manual WAL checkpoint (TRUNCATE) forced successfully.');
    return {
      success: true,
      message: 'O banco de dados foi sincronizado com sucesso. O arquivo .db está pronto para backup.',
    };
  } catch (error) {
    console.error('[DB Action] Failed to force WAL checkpoint:', error);
    return {
      success: false,
      message: `Falha ao forçar a sincronização do banco de dados: ${(error as Error).message}`,
    };
  }
}
