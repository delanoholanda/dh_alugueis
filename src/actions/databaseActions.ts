'use server';

import { getDb } from '@/lib/database';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns-tz';

const dataDirectory = path.join(process.cwd(), 'data');
const backupsDirectory = path.join(dataDirectory, 'backups');
const DB_FILE_NAME = 'dhalugueis.db';

export async function backupDatabase(): Promise<{ success: boolean; message: string; filePath?: string }> {
  const db = getDb();
  
  try {
    // Garante que o diretório de backups exista
    if (!fs.existsSync(backupsDirectory)) {
      fs.mkdirSync(backupsDirectory, { recursive: true });
    }

    // Formata a data e hora atual para incluir no nome do arquivo
    const now = new Date();
    const timestamp = format(now, 'yyyy-MM-dd_HH-mm-ss', { timeZone: 'America/Sao_Paulo' });
    const backupFileName = `backup-${timestamp}.db`;
    const backupFilePath = path.join(backupsDirectory, backupFileName);
    
    console.log(`[DB Action] Starting backup to ${backupFilePath}`);

    // O método backup do better-sqlite3 é a forma segura de fazer um backup online.
    // Ele lida com o lock do banco de dados e o checkpoint do WAL automaticamente.
    await db.backup(backupFilePath);

    console.log(`[DB Action] Database backup completed successfully to ${backupFilePath}`);
    
    // Retorna o caminho relativo à pasta /data para fácil identificação pelo usuário
    const userFriendlyPath = path.join('data', 'backups', backupFileName);

    return {
      success: true,
      message: `Backup do banco de dados criado com sucesso em: ${userFriendlyPath}`,
      filePath: userFriendlyPath,
    };
  } catch (error) {
    console.error('[DB Action] Failed to create database backup:', error);
    return {
      success: false,
      message: `Falha ao criar o backup do banco de dados: ${(error as Error).message}`,
    };
  }
}