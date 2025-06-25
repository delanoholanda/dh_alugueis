'use server';

/**
 * @fileOverview A flow to determine whether to send a WhatsApp notification to remind a customer about an upcoming return.
 *
 * - determineWhatsappNotification - A function that determines if a WhatsApp notification should be sent.
 * - DetermineWhatsappNotificationInput - The input type for the determineWhatsappNotification function.
 * - DetermineWhatsappNotificationOutput - The return type for the determineWhatsappNotification function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetermineWhatsappNotificationInputSchema = z.object({
  rentalStartDate: z.string().describe('The start date of the rental agreement (YYYY-MM-DD).'),
  rentalDays: z.number().describe('The number of days the rental agreement is for.'),
  expectedReturnDate: z.string().describe('The expected return date of the rental (YYYY-MM-DD).'),
  customerResponsiveness: z
    .string()
    .describe(
      'A description of the customer responsiveness. Examples: very responsive, not very responsive, never responds.'
    ),
  customerRentalHistory: z
    .string()
    .describe('A description of the customer rental history. Examples: always on time, sometimes late, always late.'),
  whatsAppKeys: z.string().describe('whatsapp API keys'),
});
export type DetermineWhatsappNotificationInput = z.infer<
  typeof DetermineWhatsappNotificationInputSchema
>;

const DetermineWhatsappNotificationOutputSchema = z.object({
  shouldSendNotification: z
    .boolean()
    .describe(
      'Whether or not a WhatsApp notification should be sent to remind the customer about the upcoming return.'
    ),
  reason: z.string().describe('The reason for the determination.'),
});
export type DetermineWhatsappNotificationOutput = z.infer<
  typeof DetermineWhatsappNotificationOutputSchema
>;

export async function determineWhatsappNotification(
  input: DetermineWhatsappNotificationInput
): Promise<DetermineWhatsappNotificationOutput> {
  return determineWhatsappNotificationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'determineWhatsappNotificationPrompt',
  input: {schema: DetermineWhatsappNotificationInputSchema},
  output: {schema: DetermineWhatsappNotificationOutputSchema},
  prompt: `You are an expert rental manager.

You will use the provided information to determine whether a WhatsApp notification should be sent to the customer to remind them about their upcoming return.
Consider the customer's past responsiveness and rental history to avoid unnecessary messages.

Rental Start Date: {{{rentalStartDate}}}
Rental Days: {{{rentalDays}}}
Expected Return Date: {{{expectedReturnDate}}}
Customer Responsiveness: {{{customerResponsiveness}}}
Customer Rental History: {{{customerRentalHistory}}}

Based on this information, determine whether a WhatsApp notification should be sent.
Set the shouldSendNotification output field appropriately, and provide a clear reason for your determination.

Whatsapp API keys: {{{whatsAppKeys}}}

Format output as JSON.
`,
});

const determineWhatsappNotificationFlow = ai.defineFlow(
  {
    name: 'determineWhatsappNotificationFlow',
    inputSchema: DetermineWhatsappNotificationInputSchema,
    outputSchema: DetermineWhatsappNotificationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
