
'use client';

import { useState, useEffect as useReactEffect } from 'react'; // Renamed to avoid conflict with custom hook
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getWhatsAppNotificationDecision } from '@/actions/notificationActions';
import type { DetermineWhatsappNotificationInput, DetermineWhatsappNotificationOutput } from '@/ai/flows/determine-whatsapp-notification';
import { CalendarIcon, MessageCircleQuestion, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const notificationFormSchema = z.object({
  rentalStartDate: z.date({ required_error: "Data de início do aluguel é obrigatória." }),
  rentalDays: z.coerce.number().min(1, "Dias de aluguel deve ser no mínimo 1"),
  expectedReturnDate: z.date({ required_error: "Data de retorno esperada é obrigatória." }),
  customerResponsiveness: z.enum(['very responsive', 'responsive', 'not very responsive', 'never responds']),
  customerRentalHistory: z.enum(['always on time', 'sometimes late', 'often late', 'always late']),
  whatsAppKeys: z.string().min(10, "Chaves da API do WhatsApp parecem muito curtas.").describe("Suas chaves da API do WhatsApp Business."),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

export default function NotificationsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<DetermineWhatsappNotificationOutput | null>(null);

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      rentalStartDate: new Date(),
      rentalDays: 7,
      // Initialize expectedReturnDate based on corrected logic
      expectedReturnDate: addDays(new Date(), 7 - 1), 
      customerResponsiveness: 'responsive',
      customerRentalHistory: 'always on time',
      whatsAppKeys: '',
    },
  });

  const rentalStartDate = form.watch("rentalStartDate");
  const rentalDays = form.watch("rentalDays");

  useReactEffect(() => {
    if (rentalStartDate && rentalDays >= 1) { // Ensure rentalDays is at least 1
      const daysForCalculation = rentalDays -1;
      const newExpectedReturnDate = addDays(rentalStartDate, daysForCalculation);
      form.setValue("expectedReturnDate", newExpectedReturnDate, { shouldValidate: true });
    }
  }, [rentalStartDate, rentalDays, form.setValue]);


  const onSubmit = async (data: NotificationFormValues) => {
    setIsLoading(true);
    setAiResponse(null);
    const inputForAI: DetermineWhatsappNotificationInput = {
      ...data,
      rentalStartDate: format(data.rentalStartDate, 'yyyy-MM-dd'),
      expectedReturnDate: format(data.expectedReturnDate, 'yyyy-MM-dd'),
    };

    try {
      const result = await getWhatsAppNotificationDecision(inputForAI);
      setAiResponse(result);
      toast({
        title: 'Decisão da IA Recebida',
        description: result.shouldSendNotification ? 'IA recomenda enviar uma notificação.' : 'IA recomenda NÃO enviar uma notificação.',
        variant: result.shouldSendNotification ? 'success' : 'default',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Falha ao obter decisão da IA. ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="IA de Notificação WhatsApp" 
        icon={MessageCircleQuestion}
        description="Configure e teste a IA para determinar lembretes de devolução de aluguel via WhatsApp."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Testar Decisão da IA</CardTitle>
            <CardDescription>Insira os detalhes do aluguel e do cliente para ver se a IA recomenda enviar uma notificação via WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="whatsAppKeys"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chaves da API do WhatsApp</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Insira suas chaves da API do WhatsApp" {...field} className="font-code"/>
                      </FormControl>
                      <FormDescription>Essas chaves são necessárias para o modelo de IA.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="rentalStartDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Data de Início do Aluguel</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant={"outline"} className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}>
                                {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR}/>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="rentalDays"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Dias de Aluguel</FormLabel>
                        <FormControl><Input type="number" placeholder="ex: 7" {...field} min="1"/></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                  control={form.control}
                  name="expectedReturnDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data de Retorno Esperada (Auto-calculada)</FormLabel>
                       <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant={"outline"} className={`w-full pl-3 text-left font-normal bg-muted/50 ${!field.value && "text-muted-foreground"}`} disabled>
                                {field.value ? format(field.value, "PPP", { locale: ptBR }) : _('Escolha uma data')}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                        </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerResponsiveness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsividade do Cliente</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="very responsive">Muito Responsivo</SelectItem>
                          <SelectItem value="responsive">Responsivo</SelectItem>
                          <SelectItem value="not very responsive">Pouco Responsivo</SelectItem>
                          <SelectItem value="never responds">Nunca Responde</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerRentalHistory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Histórico de Aluguel do Cliente</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="always on time">Sempre em Dia</SelectItem>
                          <SelectItem value="sometimes late">Às Vezes Atrasado</SelectItem>
                          <SelectItem value="often late">Frequentemente Atrasado</SelectItem>
                          <SelectItem value="always late">Sempre Atrasado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Obtendo Decisão da IA...' : <><Send className="mr-2 h-4 w-4" /> Obter Decisão da IA</>}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Recomendação da IA</CardTitle>
             <CardDescription>A sugestão da IA com base nos dados fornecidos aparecerá aqui.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[200px] flex items-center justify-center">
            {isLoading && <p className="text-muted-foreground">Aguardando resposta da IA...</p>}
            {!isLoading && !aiResponse && <p className="text-muted-foreground">Envie o formulário para obter uma recomendação da IA.</p>}
            {aiResponse && (
              <div className="space-y-4 text-center p-4 rounded-lg border-2"
                   style={{ borderColor: aiResponse.shouldSendNotification ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}>
                {aiResponse.shouldSendNotification ? (
                  <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
                ) : (
                  <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
                )}
                <h3 className={`text-xl font-semibold ${aiResponse.shouldSendNotification ? 'text-success' : 'text-destructive'}`}>
                  {aiResponse.shouldSendNotification ? 'Enviar Notificação: SIM' : 'Enviar Notificação: NÃO'}
                </h3>
                <p className="text-sm text-foreground">
                  <strong>Motivo:</strong> {aiResponse.reason}
                </p>
              </div>
            )}
          </CardContent>
           <CardFooter>
            <p className="text-xs text-muted-foreground">
              Nota: Esta determinação da IA é uma sugestão. O envio real da mensagem do WhatsApp não está implementado nesta demonstração.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
