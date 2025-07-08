
'use server';

import crypto from 'crypto';
import { getDb } from '@/lib/database';
import { sendEmail } from '@/lib/email';
import { getCompanySettings } from './settingsActions';
import type { Rental, NotificationLog } from '@/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCustomerById } from './customerActions';
import { revalidatePath } from 'next/cache';

// This is the function the automatic trigger will call
export async function sendTodaysReturnReminders(): Promise<void> {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Only run automatic check once per day to avoid spamming.
  // We look for a successful run (either 'success' or 'no_reminders_needed')
  const existingLog = db.prepare("SELECT id FROM notification_logs WHERE date(sentAt) = ? AND triggerType = 'automatic' AND (status = 'success' OR status = 'no_reminders_needed')").get(today);

  if (existingLog) {
    console.log(`[Notifications] Automatic reminder check for ${today} has already run successfully. Skipping.`);
    return;
  }
  
  await runReminderCheck({ triggerType: 'automatic' });
}

// This is the function the manual button will call
export async function resendTodaysReturnReminders(): Promise<NotificationLog> {
  return runReminderCheck({ triggerType: 'manual', forceResend: true });
}

async function runReminderCheck({ triggerType, forceResend = false }: {
  triggerType: 'automatic' | 'manual',
  forceResend?: boolean
}): Promise<NotificationLog> {
  const db = getDb();
  const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
  const sentAt = new Date().toISOString();

  const createLog = (logData: Omit<NotificationLog, 'id' | 'sentAt'>): NotificationLog => {
    const finalLog: NotificationLog = { id: logId, sentAt, ...logData };
    try {
      db.prepare(
        'INSERT INTO notification_logs (id, sentAt, status, recipient, subject, errorDetails, triggerType) VALUES (@id, @sentAt, @status, @recipient, @subject, @errorDetails, @triggerType)'
      ).run(finalLog);
    } catch(e) {
        console.error("CRITICAL: FAILED TO WRITE NOTIFICATION LOG", e);
    }
    revalidatePath('/dashboard/notifications/history');
    return finalLog;
  };
  
  try {
    const companySettings = await getCompanySettings();
    if (!companySettings.email) {
      throw new Error('O email da empresa não está configurado nas Configurações Gerais.');
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    
    let query = `
      SELECT * FROM rentals 
      WHERE expectedReturnDate = ? 
      AND actualReturnDate IS NULL 
    `;

    // For automatic check, ensure we haven't notified today. Manual resend ignores this.
    if (!forceResend) {
      query += ` AND (returnNotificationSent IS NULL OR returnNotificationSent != ?)`;
    }

    const stmt = db.prepare(query);
    const dueRentals = forceResend 
        ? (stmt.all(today) as Rental[]) 
        : (stmt.all(today, today) as Rental[]);

    if (dueRentals.length === 0) {
      return createLog({
        status: 'no_reminders_needed',
        recipient: companySettings.email,
        subject: 'Nenhum Lembrete de Devolução Hoje',
        errorDetails: null,
        triggerType: triggerType
      });
    }

    const rentalsWithCustomers = await Promise.all(dueRentals.map(async (rental) => {
        const customer = await getCustomerById(rental.customerId);
        return { ...rental, customer };
    }));

    const subject = `Lembrete de Devolução: ${dueRentals.length} aluguel(eis) vence(m) hoje - ${format(new Date(), 'dd/MM/yyyy')}`;
    const html = `
      <h1>Olá, ${companySettings.responsibleName || companySettings.companyName}!</h1>
      <p>Este é um lembrete automático sobre os seguintes contratos de aluguel que têm a devolução esperada para hoje, <strong>${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</strong>:</p>
      <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: sans-serif; border-color: #ddd;">
        <thead style="background-color: #f2f2f2;">
          <tr>
            <th style="padding: 8px; text-align: left;">ID do Contrato</th>
            <th style="padding: 8px; text-align: left;">Cliente</th>
            <th style="padding: 8px; text-align: left;">Telefone</th>
            <th style="padding: 8px; text-align: left;">Itens</th>
          </tr>
        </thead>
        <tbody>
          ${rentalsWithCustomers.map(rwc => `
            <tr>
              <td style="padding: 8px;">#${rwc.id.toString().padStart(4, '0')}</td>
              <td style="padding: 8px;">${rwc.customer?.name || rwc.customerName}</td>
              <td style="padding: 8px;">${rwc.customer?.phone || 'N/A'}</td>
              <td style="padding: 8px;">${rwc.equipment.map(eq => `${eq.quantity}x ${eq.name}`).join('<br>')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <br>
      <p>Por favor, entre em contato com os clientes para coordenar a devolução dos equipamentos.</p>
      <br>
      <p>Atenciosamente,<br><strong>Sistema de Gerenciamento ${companySettings.companyName}</strong></p>
    `;

    const emailResult = await sendEmail({
      to: companySettings.email,
      subject: subject,
      html: html,
    });

    if (!emailResult.success) {
        throw new Error(`Falha no envio do email de lembrete: ${emailResult.message}`);
    }

    const updateStmt = db.prepare('UPDATE rentals SET returnNotificationSent = ? WHERE id = ?');
    const updateTransaction = db.transaction((rentalsToUpdate) => {
        for (const rental of rentalsToUpdate) {
            updateStmt.run(today, rental.id);
        }
    });
    updateTransaction(dueRentals);

    return createLog({
        status: 'success',
        recipient: companySettings.email,
        subject: subject,
        errorDetails: null,
        triggerType: triggerType
    });

  } catch (error) {
    return createLog({
        status: 'failed',
        recipient: (await getCompanySettings()).email || 'N/A',
        subject: 'Falha ao Enviar Lembretes de Devolução',
        errorDetails: (error as Error).message,
        triggerType: triggerType
    });
  }
}

export async function getNotificationLogs(): Promise<NotificationLog[]> {
    const db = getDb();
    try {
        const stmt = db.prepare('SELECT * FROM notification_logs ORDER BY sentAt DESC LIMIT 50');
        return stmt.all() as NotificationLog[];
    } catch (error) {
        console.error("Failed to fetch notification logs:", error);
        return [];
    }
}
