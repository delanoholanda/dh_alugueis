
'use client';

import { useEffect } from 'react';
import { runAutomatedBackup } from '@/actions/databaseActions';
import { sendTodaysReturnReminders } from '@/actions/rentalNotificationActions';

export default function DashboardActionTrigger() {
  useEffect(() => {
    // This is a "fire-and-forget" call. We don't need to handle the response on the client.
    // The action will run on the server to check for and execute background tasks.
    
    // Check for and send return reminders.
    sendTodaysReturnReminders().catch(console.error);

    // Check if an automated backup needs to be run.
    runAutomatedBackup().catch(console.error);

  }, []);

  return null; // This component renders nothing to the UI.
}
