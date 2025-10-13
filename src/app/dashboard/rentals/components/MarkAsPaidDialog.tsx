'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addPayment } from '@/actions/rentalActions';
import type { Rental } from '@/types';
import { Loader2, CalendarIcon, DollarSign, CreditCard, Landmark } from 'lucide-react';
import { formatToBRL, parseFromBRL } from '@/lib/utils';

const paymentSchema = z.object({
  paymentDate: z.date({ required_error: "A data do pagamento é obrigatória." }),
  paymentMethod: z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'nao_definido']),
  amount: z.coerce.number({invalid_type_error: "Valor deve ser um número."}).positive("Valor do pagamento deve ser maior que zero."),
  isPartial: z.boolean().default(false),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface MarkAsPaidDialogProps {
  rental: Rental;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

export function MarkAsPaidDialog({ rental, isOpen, onOpenChange, onSuccess }: MarkAsPaidDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  
  const totalPaid = rental.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const remainingValue = rental.value - totalPaid;

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentDate: new Date(),
      paymentMethod: rental.paymentMethod || 'pix',
      amount: remainingValue > 0 ? remainingValue : 0,
      isPartial: false,
    },
  });

  useEffect(() => {
    if (isOpen) {
        const newRemainingValue = rental.value - (rental.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0);
        const initialAmount = newRemainingValue > 0 ? newRemainingValue : 0;
        form.reset({
            paymentDate: new Date(),
            paymentMethod: rental.paymentMethod || 'pix',
            amount: initialAmount,
            isPartial: false,
        });
    }
  }, [isOpen, rental, form]);


  const watchedAmount = form.watch("amount");

  useEffect(() => {
    // Automatically check/uncheck "isPartial" based on the amount
    if (watchedAmount < remainingValue) {
      form.setValue('isPartial', true);
    } else {
      form.setValue('isPartial', false);
    }
  }, [watchedAmount, remainingValue, form]);


  const handleSubmit = async (data: PaymentFormValues) => {
    setIsLoading(true);
    try {
      const result = await addPayment(rental.id, {
        amount: data.amount,
        paymentDate: format(data.paymentDate, 'yyyy-MM-dd'),
        paymentMethod: data.paymentMethod,
        isPartial: data.isPartial,
      });

      if (result) {
        toast({
          title: 'Pagamento Registrado',
          description: `O pagamento para o aluguel ID ${rental.id} foi registrado.`,
          variant: 'success',
        });
        await onSuccess();
        onOpenChange(false);
      } else {
        throw new Error("Falha ao registrar o pagamento.");
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
            <DollarSign className="mr-2 h-5 w-5 text-primary" /> Registrar Pagamento (ID: {rental.id})
          </DialogTitle>
           <DialogDescription>
            Valor total do contrato: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rental.value)}. 
            Valor pendente: <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingValue)}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
                
                 <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Valor do Pagamento</FormLabel>
                        <FormControl>
                          <Input
                              type={isAmountFocused ? 'number' : 'text'}
                              placeholder="R$ 0,00"
                              value={isAmountFocused ? field.value : formatToBRL(field.value)}
                              onFocus={() => setIsAmountFocused(true)}
                              onBlur={() => setIsAmountFocused(false)}
                              onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '') {
                                      field.onChange(0);
                                  } else {
                                      const numericValue = parseFloat(value);
                                      if (!isNaN(numericValue)) {
                                          field.onChange(numericValue);
                                      }
                                  }
                              }}
                              step="0.01"
                          />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="isPartial"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={watchedAmount < remainingValue} // Auto-check if amount is less
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                        <FormLabel>
                            Registrar como pagamento parcial?
                        </FormLabel>
                        <FormMessage />
                        </div>
                    </FormItem>
                    )}
                />

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
                    <Button type="submit" disabled={isLoading || form.getValues('amount') <= 0}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Registrar Pagamento
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
