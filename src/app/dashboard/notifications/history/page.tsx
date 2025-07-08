
import { PageHeader } from '@/components/layout/PageHeader';
import { getNotificationLogs } from '@/actions/rentalNotificationActions';
import NotificationHistoryClientPage from './components/NotificationHistoryClientPage';
import { MailCheck } from 'lucide-react';

export default async function NotificationHistoryPage() {
    const logs = await getNotificationLogs();

    return (
        <div className="container mx-auto py-2">
            <PageHeader 
                title="Histórico de Notificações" 
                icon={MailCheck}
                description="Veja o registro de todos os lembretes de devolução enviados pelo sistema."
            />
            <NotificationHistoryClientPage initialLogs={logs} />
        </div>
    );
}
