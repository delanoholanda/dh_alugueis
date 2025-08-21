
'use server';

import { getDb } from '@/lib/database';
import fs from 'fs';
import path from 'path';
import { format as formatTz, toZonedTime } from 'date-fns-tz';
import { differenceInDays, parseISO } from 'date-fns';


const dataDirectory = path.join(process.cwd(), 'data');
const backupsDirectory = path.join(dataDirectory, 'backups');
const DB_FILE_NAME = 'dhalugueis.db';
const TIME_ZONE = 'America/Sao_Paulo'; // Using a consistent timezone

/**
 * Ensures the backups directory exists.
 */
async function ensureBackupsDir() {
    try {
        await fs.promises.mkdir(backupsDirectory, { recursive: true });
    } catch (error) {
        console.error('[Backup Action] Failed to create backups directory:', error);
    }
}

/**
 * Creates a manual backup of the database.
 */
export async function backupDatabase(): Promise<{ success: boolean; message: string; filePath?: string }> {
  const db = getDb();
  await ensureBackupsDir();
  
  try {
    const now = toZonedTime(new Date(), TIME_ZONE);
    const timestamp = formatTz(now, 'yyyy-MM-dd_HH-mm-ss', { timeZone: TIME_ZONE });
    const backupFileName = `backup-${timestamp}.db`;
    const backupFilePath = path.join(backupsDirectory, backupFileName);
    
    console.log(`[DB Action] Starting manual backup to ${backupFilePath}`);

    await db.backup(backupFilePath);

    console.log(`[DB Action] Manual backup completed successfully to ${backupFilePath}`);
    
    const userFriendlyPath = path.join('data', 'backups', backupFileName);

    return {
      success: true,
      message: `Backup do banco de dados criado com sucesso em: ${userFriendlyPath}`,
      filePath: userFriendlyPath,
    };
  } catch (error) {
    console.error('[DB Action] Failed to create manual database backup:', error);
    return {
      success: false,
      message: `Falha ao criar o backup do banco de dados: ${(error as Error).message}`,
    };
  }
}

/**
 * This function is intended to be called by an automatic trigger, such as a component
 * that runs on a key page load (e.g., the dashboard).
 */
export async function runAutomatedBackup(): Promise<void> {
    const now = toZonedTime(new Date(), TIME_ZONE);
    const dayOfWeek = Number(formatTz(now, 'i', { timeZone: TIME_ZONE })); // Monday=1, ..., Thursday=4, ..., Sunday=7

    // --- 1. Check if it's Thursday ---
    if (dayOfWeek !== 4) {
        // console.log(`[Auto Backup] Not Thursday. Skipping.`);
        return;
    }

    await ensureBackupsDir();
    
    try {
        // --- 2. Check if a backup was already made this week ---
        const existingBackups = await fs.promises.readdir(backupsDirectory);
        if (existingBackups.length > 0) {
            const sortedBackups = existingBackups.sort().reverse();
            const lastBackupTimestamp = sortedBackups[0].replace('backup-', '').replace('.db', '');
            const lastBackupDate = parseISO(`${lastBackupTimestamp.split('_')[0]}T${lastBackupTimestamp.split('_')[1].replace(/-/g, ':')}`);
            
            if (differenceInDays(now, lastBackupDate) < 6) {
                console.log(`[Auto Backup] A backup has already been created in the last 6 days (${sortedBackups[0]}). Skipping.`);
                return;
            }
        }
        
        console.log("[Auto Backup] It's Thursday and no recent backup found. Starting automated backup process...");

        // --- 3. Manage backup rotation (keep last 5) ---
        const allBackups = (await fs.promises.readdir(backupsDirectory))
            .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
            .sort(); // Sorts oldest to newest

        if (allBackups.length >= 5) {
            const backupsToDelete = allBackups.slice(0, allBackups.length - 4); // Keep 4, new one makes 5
            console.log(`[Auto Backup] Rotating backups. Deleting ${backupsToDelete.length} oldest backup(s).`);
            for (const backupFile of backupsToDelete) {
                await fs.promises.unlink(path.join(backupsDirectory, backupFile));
                console.log(`[Auto Backup] Deleted old backup: ${backupFile}`);
            }
        }

        // --- 4. Create the new backup ---
        const backupResult = await backupDatabase();
        if (backupResult.success) {
            console.log(`[Auto Backup] Successfully created new automated backup: ${backupResult.filePath}`);
        } else {
            console.error(`[Auto Backup] Failed to create automated backup: ${backupResult.message}`);
        }

    } catch (error) {
        console.error('[Auto Backup] An unexpected error occurred during the automated backup process:', error);
    }
}
