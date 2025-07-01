
'use server';

import nodemailer from 'nodemailer';

// Type for the mail options to ensure type safety.
interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string; // Optional plain text version
}

/**
 * Sends an email using a dynamically created transporter.
 * This ensures the latest environment variables are always used.
 * @param {MailOptions} mailOptions - The mail options object.
 * @returns {Promise<{ success: boolean; message: string }>} - An object indicating success or failure.
 */
export async function sendEmail({ to, subject, html, text }: MailOptions): Promise<{ success: boolean; message: string }> {
    // Check for all required environment variables on every call
    const requiredVars = [
        'EMAIL_SERVER_HOST',
        'EMAIL_SERVER_PORT',
        'EMAIL_SERVER_USER',
        'EMAIL_SERVER_PASS',
        'EMAIL_FROM_ADDRESS'
    ];
    
    const missingVars = requiredVars.filter(v => !(process.env as any)[v]);

    if (missingVars.length > 0) {
        const errorMessage = `Serviço de email não configurado. Variáveis de ambiente faltando: ${missingVars.join(', ')}. Verifique seu arquivo .env e reinicie o servidor.`;
        console.error(errorMessage);
        return { success: false, message: errorMessage };
    }
    
    // Create the transporter inside the function to use the latest env vars
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        secure: Number(process.env.EMAIL_SERVER_PORT) === 465, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASS,
        },
    });

    const mailData = {
        from: `"${process.env.EMAIL_FROM_NAME || 'DH Alugueis'}" <${process.env.EMAIL_FROM_ADDRESS!}>`,
        to: to,
        subject: subject,
        html: html,
        text: text || html.replace(/<[^>]*>?/gm, ''), // Basic conversion from HTML to text if not provided
    };

    try {
        await transporter.sendMail(mailData);
        console.log(`Email sent successfully to ${to}`);
        return { success: true, message: 'Email sent successfully.' };
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        
        // Provide more specific, user-friendly error messages for common issues
        const nodemailerError = error as Error & { code?: string; responseCode?: number; command?: string };
        let friendlyMessage = `Falha ao enviar email: ${nodemailerError.message}`;

        if (nodemailerError.code === 'EAUTH' || nodemailerError.responseCode === 535) {
            friendlyMessage = 'Falha na autenticação. Verifique se EMAIL_SERVER_USER e EMAIL_SERVER_PASS estão corretos.';
        } else if (nodemailerError.code === 'ECONNRESET' || nodemailerError.code === 'ECONNREFUSED') {
            friendlyMessage = 'Conexão recusada pelo servidor. Verifique se EMAIL_SERVER_HOST e EMAIL_SERVER_PORT estão corretos.';
        } else if (nodemailerError.command === 'CONN') {
            friendlyMessage = 'Não foi possível conectar ao servidor de email. Verifique as configurações de host e porta.';
        }
        
        return { success: false, message: friendlyMessage };
    }
}
