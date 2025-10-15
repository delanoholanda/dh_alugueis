'use server';

import { determineWhatsappNotification, type DetermineWhatsappNotificationInput, type DetermineWhatsappNotificationOutput } from '@/ai/flows/determine-whatsapp-notification';

export async function getWhatsAppNotificationDecision(
  input: DetermineWhatsappNotificationInput
): Promise<DetermineWhatsappNotificationOutput> {
  try {
    const result = await determineWhatsappNotification(input);
    return result;
  } catch (error) {
    console.error("Error in GenAI flow:", error);
    return {
      shouldSendNotification: false,
      reason: `Error determining notification: ${(error as Error).message}. Defaulting to no notification.`,
    };
  }
}
