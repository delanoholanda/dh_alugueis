
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { calculateAndCloseOpenEndedRental } from '@/actions/rentalActions';
import type { Rental } from '@/types';
import { Loader2, Calculator, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL, countBillableDays } from '@/lib/utils';

interface CalculateAndCloseDialogProps {
  rental: Rental;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

export function CalculateAndCloseDialog({ rental, isOpen, onOpenChange, onSuccess }: CalculateAndCloseDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [accumulatedValue, setAccumulatedValue] = useState(0);
  const [accumulatedDays, setAccumulatedDays] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && rental.isOpenEnded) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const billableDays = countBillableDays(
        rental.rentalStartDate,
        today,
        rental.chargeSaturdays ?? true,
        rental.chargeSundays ?? true
      );
      setAccumulatedDays(billableDays);
      setAccumulatedValue(billableDays * rental.value); // For open-ended, rental.value is the daily rate
    }
  }, [isOpen, rental]);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const result = await calculateAndCloseOpenEndedRental(rental.id);
      if (result) {
        toast({
          title: 'Contrato Fechado para Faturamento',
          description: `O valor final do aluguel ID ${rental.id} foi calculado e está pendente de pagamento.`,
          variant: 'success',
        });
        await onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      toast({ title: 'Erro', description: `Ocorreu um erro: ${(error as Error).message}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!rental.isOpenEnded) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Calculator className="mr-2 h-5 w-5 text-primary" /> Fechar Contrato em Aberto
          </DialogTitle>
          <DialogDescription>
            Calcular o valor final para o aluguel ID: {rental.id}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <p>Esta ação irá calcular o valor total devido até hoje e converter este contrato para um aluguel com valor e data final definidos, com status de pagamento "Pendente".</p>
            <div className="p-3 border rounded-md bg-muted/50 mt-2">
                <p><strong>Cliente:</strong> {rental.customerName}</p>
                <p><strong>Data de Início:</strong> {format(parseISO(rental.rentalStartDate), 'P', { locale: ptBR })}</p>
                <p><strong>Dias Cobráveis (até hoje):</strong> {accumulatedDays}</p>
                <p className="font-bold"><strong>Valor Final a ser Cobrado:</strong> {formatToBRL(accumulatedValue)}</p>
            </div>
            <div className="p-3 border border-orange-400 bg-orange-50 text-orange-800 rounded-md text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>O contrato continuará na lista de "Ativos" até que o equipamento seja fisicamente devolvido.</span>
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading} className="bg-primary hover:bg-primary/90">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
            Confirmar e Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
