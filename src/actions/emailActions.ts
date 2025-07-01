'use server';

import { sendEmail } from '@/lib/email';
import { getCompanySettings } from './settingsActions';

export async function sendTestEmail(): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await getCompanySettings();
    const recipientEmail = settings.email;

    if (!recipientEmail) {
      throw new Error('O email da empresa não está configurado nas Configurações Gerais.');
    }

    const subject = 'Teste de Envio de Email - DH Alugueis';
    const html = `
      <h1>Olá!</h1>
      <p>Este é um email de teste enviado a partir do seu sistema de gerenciamento DH Alugueis.</p>
      <p>Se você recebeu esta mensagem, a configuração do seu servidor SMTP está funcionando corretamente.</p>
      <br>
      <p>Atenciosamente,</p>
      <p>Equipe DH Alugueis</p>
    `;

    const result = await sendEmail({
      to: recipientEmail,
      subject: subject,
      html: html,
    });

    if (!result.success) {
        // Re-throw the error from sendEmail to be caught below
        throw new Error(result.message);
    }

    return { success: true, message: `Email de teste enviado com sucesso para ${recipientEmail}.` };

  } catch (error) {
    console.error("Failed to send test email:", error);
    return { success: false, message: (error as Error).message };
  }
}
