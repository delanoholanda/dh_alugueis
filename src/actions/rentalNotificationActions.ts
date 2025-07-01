
'use server';

import { getDb } from '@/lib/database';
import { sendEmail } from '@/lib/email';
import { getCompanySettings } from './settingsActions';
import type { Rental, Customer } from '@/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCustomerById } from './customerActions';

export async function sendTodaysReturnReminders(): Promise<{ success: boolean; message: string; sentCount: number }> {
  try {
    const db = getDb();
    const today = format(new Date(), 'yyyy-MM-dd');

    // Find rentals due today that haven't been notified today and are not yet returned.
    const stmt = db.prepare(`
      SELECT * FROM rentals 
      WHERE expectedReturnDate = ? 
      AND actualReturnDate IS NULL 
      AND (returnNotificationSent IS NULL OR returnNotificationSent != ?)
    `);
    
    const dueRentals = stmt.all(today, today) as Rental[];

    if (dueRentals.length === 0) {
      return { success: true, message: 'No reminders to send today.', sentCount: 0 };
    }

    const companySettings = await getCompanySettings();
    if (!companySettings.email) {
      console.warn('Cannot send return reminders: Company email is not configured.');
      return { success: false, message: 'Company email not configured.', sentCount: 0 };
    }

    // Fetch customer details for all rentals in parallel
    const rentalsWithCustomers = await Promise.all(dueRentals.map(async (rental) => {
        const customer = await getCustomerById(rental.customerId);
        return { ...rental, customer };
    }));

    // Compose a single summary email
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

    // If email sending was successful, update the notification status for all relevant rentals
    const updateStmt = db.prepare('UPDATE rentals SET returnNotificationSent = ? WHERE id = ?');
    const updateTransaction = db.transaction((rentalsToUpdate) => {
        for (const rental of rentalsToUpdate) {
            updateStmt.run(today, rental.id);
        }
    });
    updateTransaction(dueRentals);
    
    console.log(`Successfully sent return reminders for ${dueRentals.length} rentals.`);
    return { success: true, message: `Reminder email sent for ${dueRentals.length} rentals.`, sentCount: dueRentals.length };

  } catch (error) {
    console.error("Failed to send return reminders:", error);
    return { success: false, message: (error as Error).message, sentCount: 0 };
  }
}
