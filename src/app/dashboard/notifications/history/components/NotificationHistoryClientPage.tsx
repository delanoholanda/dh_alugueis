
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { resendTodaysReturnReminders, getNotificationLogs } from '@/actions/rentalNotificationActions';
import type { NotificationLog } from '@/types';
import { Send, Loader2, CheckCircle2, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


function getStatusVariant(status: NotificationLog['status']): 'success' | 'destructive' | 'secondary' {
    switch (status) {
        case 'success': return 'success';
        case 'failed': return 'destructive';
        case 'no_reminders_needed': return 'secondary';
        default: return 'secondary';
    }
}

function getStatusText(status: NotificationLog['status']): string {
    switch (status) {
        case 'success': return 'Enviado com Sucesso';
        case 'failed': return 'Falha no Envio';
        case 'no_reminders_needed': return 'Sem Lembretes';
        default: return 'Desconhecido';
    }
}

function getStatusIcon(status: NotificationLog['status']): React.ElementType {
    switch (status) {
        case 'success': return CheckCircle2;
        case 'failed': return AlertTriangle;
        case 'no_reminders_needed': return Info;
        default: return Info;
    }
}


export default function NotificationHistoryClientPage({ initialLogs }: { initialLogs: NotificationLog[] }) {
  const [logs, setLogs] = useState<NotificationLog[]>(initialLogs);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleManualSend = async () => {
    setIsLoading(true);
    toast({ title: 'Enviando lembretes...', description: 'A verificação manual foi iniciada.' });
    try {
      const result = await resendTodaysReturnReminders();
      const updatedLogs = await getNotificationLogs();
      setLogs(updatedLogs);

      if (result.status === 'success') {
        toast({ title: 'Sucesso!', description: 'Email de lembrete enviado.', variant: 'success' });
      } else if (result.status === 'no_reminders_needed') {
        toast({ title: 'Nenhum lembrete necessário', description: 'Não há aluguéis vencendo hoje para notificar.', variant: 'default' });
      } else { // failed
        toast({ title: 'Falha no envio', description: `Ocorreu um erro: ${result.errorDetails}`, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro inesperado', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    const updatedLogs = await getNotificationLogs();
    setLogs(updatedLogs);
    setIsLoading(false);
    toast({ title: 'Lista atualizada', description: 'O histórico de notificações foi atualizado.' });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <CardTitle className="font-headline">Registros de Envio</CardTitle>
          <CardDescription>Últimos 50 eventos de notificação. As verificações automáticas ocorrem uma vez por dia.</CardDescription>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button onClick={handleManualSend} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Verificar e Enviar Manualmente
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Gatilho</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const StatusIcon = getStatusIcon(log.status);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {format(parseISO(log.sentAt), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                         <Badge variant={getStatusVariant(log.status)} className="capitalize">
                            <StatusIcon className="mr-1.5 h-3.5 w-3.5"/>
                           {getStatusText(log.status)}
                         </Badge>
                      </TableCell>
                       <TableCell className="capitalize hidden md:table-cell">{log.triggerType}</TableCell>
                      <TableCell>
                        {log.status === 'failed' && log.errorDetails ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-destructive truncate max-w-xs cursor-help">{log.errorDetails}</p>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-md">{log.errorDetails}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <p className="text-muted-foreground">{log.subject || 'N/A'}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Destinatário: {log.recipient || 'N/A'}</p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg">Nenhum registro de notificação encontrado.</p>
            <p>O sistema registrará as tentativas de envio aqui.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
