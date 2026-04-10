
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addPayment, updateRental } from '@/actions/rentalActions';
import type { Rental } from '@/types';
import { Loader2, CalendarIcon, DollarSign, CreditCard, Landmark, CheckCircle2 } from 'lucide-react';
import { formatToBRL } from '@/lib/utils';

const bulkPaymentSchema = z.object({
  paymentDate: z.date({ required_error: "A data do pagamento é obrigatória." }),
  paymentMethod: z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'nao_definido']),
});

type BulkPaymentFormValues = z.infer<typeof bulkPaymentSchema>;

interface BulkPaymentDialogProps {
  customerName: string;
  totalPendingValue: number;
  rentals: Rental[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

export function BulkPaymentDialog({ customerName, totalPendingValue, rentals, isOpen, onOpenChange, onSuccess }: BulkPaymentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<BulkPaymentFormValues>({
    resolver: zodResolver(bulkPaymentSchema),
    defaultValues: {
      paymentDate: new Date(),
      paymentMethod: 'pix',
    },
  });

  useEffect(() => {
    if (isOpen) {
        form.reset({
            paymentDate: new Date(),
            paymentMethod: 'pix',
        });
    }
  }, [isOpen, form]);

  const handleSubmit = async (data: BulkPaymentFormValues) => {
    setIsLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process rentals sequentially to avoid DB lock issues and ensure clean updates
      for (const rental of rentals) {
        const totalPaid = rental.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
        const remaining = rental.value - totalPaid;

        try {
            if (remaining > 0.005) { // Needs actual payment
                await addPayment(rental.id, {
                    amount: remaining,
                    paymentDate: format(data.paymentDate, 'yyyy-MM-dd'),
                    paymentMethod: data.paymentMethod,
                    isPartial: false,
                });
            } else {
                // It's effectively paid but status was still pending/overdue
                await updateRental(rental.id, {
                    paymentStatus: 'paid',
                    paymentDate: format(data.paymentDate, 'yyyy-MM-dd'),
                    paymentMethod: data.paymentMethod
                });
            }
            successCount++;
        } catch (err) {
            console.error(`Failed to process rental ${rental.id}:`, err);
            failCount++;
        }
      }

      if (failCount === 0) {
          toast({
            title: 'Pagamentos Registrados',
            description: `Todos os ${successCount} contratos de "${customerName}" foram quitados com sucesso.`,
            variant: 'success',
          });
      } else {
          toast({
            title: 'Processamento Parcial',
            description: `${successCount} contratos quitados, ${failCount} falharam. Verifique os registros.`,
            variant: 'destructive',
          });
      }

      await onSuccess();
      onOpenChange(false);

    } catch (error) {
      toast({ title: 'Erro Crítico', description: `Ocorreu um erro no processamento: ${(error as Error).message}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[95vw] rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <CheckCircle2 className="mr-2 h-6 w-6 text-primary" /> Quitar Todos os Débitos
          </DialogTitle>
           <DialogDescription className="text-base mt-2">
            Registrar o pagamento total de <span className="font-bold text-foreground">{formatToBRL(totalPendingValue)}</span> para <strong>{customerName}</strong> referente a {rentals.length} contrato(s).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
                <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Data do Pagamento</FormLabel>
                        <Popover modal={true}>
                        <PopoverTrigger asChild>
                            <FormControl>
                                <Button type="button" variant={"outline"} className={`w-full pl-3 text-left font-normal h-11 ${!field.value && "text-muted-foreground"}`}>
                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                            initialFocus
                            locale={ptBR}
                            />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Forma de Pagamento para todos</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger className="h-11">
                            <SelectValue placeholder="Selecione a forma de pagamento" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="pix"><div className="flex items-center"><Landmark className="mr-2 h-4 w-4" />PIX</div></SelectItem>
                        <SelectItem value="dinheiro"><div className="flex items-center"><DollarSign className="mr-2 h-4 w-4" />Dinheiro</div></SelectItem>
                        <SelectItem value="cartao_credito"><div className="flex items-center"><CreditCard className="mr-2 h-4 w-4" />Cartão de Crédito</div></SelectItem>
                        <SelectItem value="cartao_debito"><div className="flex items-center"><CreditCard className="mr-2 h-4 w-4" />Cartão de Débito</div></SelectItem>
                        <SelectItem value="nao_definido">Não Definido</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" className="w-full sm:w-auto h-11" disabled={isLoading}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isLoading} className="w-full sm:flex-1 h-auto py-3 bg-primary hover:bg-primary/90">
                        {isLoading ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                        )}
                        <span className="whitespace-normal text-left">
                            Confirmar Pagamento de {formatToBRL(totalPendingValue)}
                        </span>
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
