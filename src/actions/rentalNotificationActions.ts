
'use server';

import crypto from 'crypto';
import { getDb } from '@/lib/database';
import { sendEmail } from '@/lib/email';
import { getCompanySettings } from './settingsActions';
import type { Rental, NotificationLog } from '@/types';
import { format } from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { getCustomerById } from './customerActions';
import { revalidatePath } from 'next/cache';
import { validateServerSession } from '@/lib/auth-utils';

const TIME_ZONE = 'America/Fortaleza';

function getTodayInFortaleza(): string {
  const now = new Date();
  const zonedDate = toZonedTime(now, TIME_ZONE);
  return formatTz(zonedDate, 'yyyy-MM-dd', { timeZone: TIME_ZONE });
}

// This is the function the automatic trigger will call
export async function sendTodaysReturnReminders(): Promise<void> {
  // This is a background task. The initial check is done in the component
  // to ensure a logged-in user is triggering it, but the action itself
  // doesn't need to re-validate.
  
  const db = getDb();
  const today = getTodayInFortaleza();
  
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
  await validateServerSession();
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

    const today = getTodayInFortaleza();
    
    let query = `
      SELECT r.*,
             json_group_array(json_object('equipmentId', re.equipmentId, 'quantity', re.quantity, 'name', re.name, 'customDailyRentalRate', re.customDailyRentalRate)) as equipmentJson
      FROM rentals r
      LEFT JOIN rental_equipment re ON r.id = re.rentalId
      WHERE r.expectedReturnDate = ? 
      AND r.actualReturnDate IS NULL
    `;

    // For automatic check, ensure we haven't notified today. Manual resend ignores this.
    if (!forceResend) {
      query += ` AND (r.returnNotificationSent IS NULL OR r.returnNotificationSent != ?)`;
    }
    
    query += ` GROUP BY r.id`;

    const stmt = db.prepare(query);
    const params = forceResend ? [today] : [today, today];
    const dueRentalRows = stmt.all(...params) as any[];
    
    const dueRentals: Rental[] = dueRentalRows.map(row => ({
      ...row,
      equipment: row.equipmentJson ? JSON.parse(row.equipmentJson).filter((eq: any) => eq.equipmentId !== null) : [],
      photos: [], // Photos not needed for this email
      actualReturnDate: row.actualReturnDate || null, 
      paymentDate: row.paymentDate || null, 
      notes: row.notes || null,
      deliveryAddress: row.deliveryAddress || 'A definir', 
      isOpenEnded: row.isOpenEnded === 1,
      chargeSaturdays: row.chargeSaturdays !== 0,
      chargeSundays: row.chargeSundays !== 0,
      returnNotificationSent: row.returnNotificationSent || null,
    }));


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

    const subject = `Lembrete de Devolução: ${dueRentals.length} aluguel(eis) vence(m) hoje - ${format(toZonedTime(new Date(), TIME_ZONE), 'dd/MM/yyyy', { locale: ptBR })}`;
    const html = `
      <h1>Olá, ${companySettings.responsibleName || companySettings.companyName}!</h1>
      <p>Este é um lembrete automático sobre os seguintes contratos de aluguel que têm a devolução esperada para hoje, <strong>${format(toZonedTime(new Date(), TIME_ZONE), 'dd/MM/yyyy', { locale: ptBR })}</strong>:</p>
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
    // await validateServerSession(); // Removed for read-only operation
    const db = getDb();
    try {
        const stmt = db.prepare('SELECT * FROM notification_logs ORDER BY sentAt DESC LIMIT 50');
        return stmt.all() as NotificationLog[];
    } catch (error) {
        console.error("Failed to fetch notification logs:", error);
        return [];
    }
}
