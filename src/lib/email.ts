'use server';

import nodemailer from 'nodemailer';

// Type for the mail options to ensure type safety.
interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string; // Optional plain text version
}

// Check if environment variables are set. In a real app, you might use a validation library like Zod.
if (!process.env.EMAIL_SERVER_HOST || !process.env.EMAIL_SERVER_PORT || !process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASS || !process.env.EMAIL_FROM_ADDRESS) {
    // Only show warning in development to avoid log spam in production if email is optional
    if (process.env.NODE_ENV !== 'production') {
        console.warn(
            "Email server environment variables are not fully set. Email functionality will be disabled. " +
            "Please check EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER, EMAIL_SERVER_PASS, and EMAIL_FROM_ADDRESS in your .env file."
        );
    }
}

// Create a reusable transporter object using the SMTP transport.
// It reads connection data from environment variables.
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT || 587),
    secure: Number(process.env.EMAIL_SERVER_PORT) === 465, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASS,
    },
});

/**
 * Sends an email using the pre-configured transporter.
 * @param {MailOptions} mailOptions - The mail options object.
 * @param {string} mailOptions.to - The recipient's email address.
 * @param {string} mailOptions.subject - The subject line of the email.
 * @param {string} mailOptions.html - The HTML body of the email.
 * @param {string} [mailOptions.text] - The plain text body of the email.
 * @returns {Promise<{ success: boolean; message: string }>} - An object indicating success or failure.
 */
export async function sendEmail({ to, subject, html, text }: MailOptions): Promise<{ success: boolean; message: string }> {
    // Check if the required variables are set before trying to send
    if (!process.env.EMAIL_SERVER_HOST || !process.env.EMAIL_FROM_ADDRESS) {
        const errorMessage = "Email service is not configured. Cannot send email.";
        console.error(errorMessage);
        return { success: false, message: errorMessage };
    }

    const mailData = {
        from: `"${process.env.EMAIL_FROM_NAME || 'DH Alugueis'}" <${process.env.EMAIL_FROM_ADDRESS}>`,
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
        return { success: false, message: `Failed to send email: ${(error as Error).message}` };
    }
}
