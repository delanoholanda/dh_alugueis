
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CheckSquare, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { finalizeRental as finalizeRentalAction } from '@/actions/rentalActions';
import type { Rental } from '@/types';

interface FinalizeRentalButtonProps {
  rental: Rental;
  isFinalized: boolean;
  onFinalized: () => Promise<void>; 
}

export default function FinalizeRentalButton({ rental, isFinalized, onFinalized }: FinalizeRentalButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleFinalize = async () => {
    setIsLoading(true);
    try {
      await finalizeRentalAction(rental.id);
      toast({
        title: 'Aluguel Finalizado',
        description: `O aluguel ID ${rental.id} foi marcado como devolvido.`,
        variant: 'success',
      });
      setIsDialogOpen(false);
      await onFinalized(); 
    } catch (error) {
      toast({
        title: 'Erro ao Finalizar',
        description: (error as Error).message || 'Não foi possível finalizar o aluguel.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFinalized) {
    return (
      <Button variant="outline" title="Aluguel já finalizado (devolvido)" disabled>
        <CheckSquare className="h-4 w-4 mr-2 text-green-500" /> Itens Devolvidos
      </Button>
    );
  }

  const isDisabled = !!rental.isOpenEnded;
  const getTitle = () => {
    if (rental.isOpenEnded) return "Calcule e feche o contrato primeiro";
    return "Finalizar Aluguel (Marcar como Devolvido)";
  }

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          title={getTitle()} 
          disabled={isDisabled}
          className="text-green-600 border-green-600/50 hover:bg-green-600/10 hover:text-green-700"
        >
          <CheckSquare className="h-4 w-4 mr-2" /> Marcar como Devolvido
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar Aluguel ID: {rental.id}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação definirá a data de devolução efetiva como hoje. Isso indica que os itens foram retornados fisicamente. O status de pagamento não será alterado. Deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleFinalize} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar Devolução
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
