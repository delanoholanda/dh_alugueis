
'use client';

import { useEffect } from 'react';
import { runAutomatedBackup } from '@/actions/databaseActions';
import { sendTodaysReturnReminders } from '@/actions/rentalNotificationActions';
import { useAuth } from '@/hooks/use-auth';

export default function DashboardActionTrigger() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Only run these background tasks if the user is authenticated.
    // This prevents them from running on login screens or during session validation.
    if (isAuthenticated) {
      // This is a "fire-and-forget" call. We don't need to handle the response on the client.
      // The action will run on the server to check for and execute background tasks.
      
      // Check for and send return reminders.
      sendTodaysReturnReminders().catch(console.error);

      // Check if an automated backup needs to be run.
      runAutomatedBackup().catch(console.error);
    }
  }, [isAuthenticated]);

  return null; // This component renders nothing to the UI.
}
