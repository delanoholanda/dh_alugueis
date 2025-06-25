'use client';

import { useState } from 'react';
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
import { updateRental } from '@/actions/rentalActions';
import type { Rental } from '@/types';
import { Loader2, CalendarIcon, DollarSign, CreditCard, Landmark } from 'lucide-react';
import { formatToBRL } from '@/lib/utils';

const markAsPaidSchema = z.object({
  paymentDate: z.date({ required_error: "A data do pagamento é obrigatória." }),
  paymentMethod: z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'nao_definido']),
});

type MarkAsPaidFormValues = z.infer<typeof markAsPaidSchema>;

interface MarkAsPaidDialogProps {
  rental: Rental;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

export function MarkAsPaidDialog({ rental, isOpen, onOpenChange, onSuccess }: MarkAsPaidDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<MarkAsPaidFormValues>({
    resolver: zodResolver(markAsPaidSchema),
    defaultValues: {
      paymentDate: new Date(),
      paymentMethod: rental.paymentMethod || 'pix',
    },
  });

  const handleSubmit = async (data: MarkAsPaidFormValues) => {
    setIsLoading(true);
    try {
      const result = await updateRental(rental.id, {
        paymentStatus: 'paid',
        paymentDate: format(data.paymentDate, 'yyyy-MM-dd'),
        paymentMethod: data.paymentMethod,
      });

      if (result) {
        toast({
          title: 'Pagamento Registrado',
          description: `O aluguel ID ${rental.id} foi marcado como pago.`,
          variant: 'success',
        });
        await onSuccess();
        onOpenChange(false);
      } else {
        throw new Error("Falha ao atualizar o aluguel.");
      }
    } catch (error) {
      toast({ title: 'Erro', description: `Ocorreu um erro: ${(error as Error).message}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5 text-primary" /> Marcar como Pago (ID: {rental.id})
          </DialogTitle>
           <DialogDescription>
            Confirme os detalhes do pagamento para o valor de {formatToBRL(rental.value)}.
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
                      <FormLabel>Forma de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
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

                 <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirmar Pagamento
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
