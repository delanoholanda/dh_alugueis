
'use client';

import { useEffect } from 'react';
import { sendTodaysReturnReminders } from '@/actions/rentalNotificationActions';

export default function DashboardActionTrigger() {
  useEffect(() => {
    // This is a "fire-and-forget" call. We don't need to handle the response on the client.
    // The action will run on the server to check for and send reminders.
    sendTodaysReturnReminders().catch(console.error);
  }, []);

  return null; // This component renders nothing to the UI.
}
