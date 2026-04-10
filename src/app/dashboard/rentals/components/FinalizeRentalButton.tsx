
'use client';

import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
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
import { CheckSquare, Loader2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { finalizeRental as finalizeRentalAction, unfinalizeRental as unfinalizeRentalAction } from '@/actions/rentalActions';
import type { Rental } from '@/types';
import { cn } from '@/lib/utils';

interface FinalizeRentalButtonProps {
  rental: Rental;
  isFinalized: boolean;
  onFinalized: () => Promise<void>; 
  buttonProps?: ButtonProps;
}

export default function FinalizeRentalButton({ rental, isFinalized, onFinalized, buttonProps }: FinalizeRentalButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAction = async () => {
    setIsLoading(true);
    try {
      if (isFinalized) {
        await unfinalizeRentalAction(rental.id);
        toast({
          title: 'Status Revertido',
          description: 'O aluguel foi marcado como ativo novamente.',
          variant: 'success',
        });
      } else {
        await finalizeRentalAction(rental.id);
        toast({
          title: 'Aluguel Finalizado',
          description: `O aluguel ID ${rental.id} foi marcado como devolvido.`,
          variant: 'success',
        });
      }
      setIsDialogOpen(false);
      await onFinalized(); 
    } catch (error) {
      toast({
        title: 'Erro na Ação',
        description: (error as Error).message || 'Não foi possível completar a ação.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const defaultButtonProps: ButtonProps = {
    variant: "outline",
    title: isFinalized ? "Reverter devolução (voltar para Ativo)" : "Finalizar Aluguel (Marcar como Devolvido)",
    className: isFinalized 
        ? "text-orange-600 border-orange-600/50 hover:bg-orange-600/10" 
        : "text-green-600 border-green-600/50 hover:bg-green-600/10 hover:text-green-700",
    ...buttonProps, 
  };

  const isDisabled = !isFinalized && !!rental.isOpenEnded;
  const getButtonTitle = () => {
    if (isDisabled) return "Calcule e feche o contrato primeiro";
    return defaultButtonProps.title;
  }

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          {...defaultButtonProps}
          title={getButtonTitle()} 
          disabled={isDisabled}
          className={cn(defaultButtonProps.className, isDisabled && "opacity-50 cursor-not-allowed")}
        >
          {isFinalized ? (
              <><RotateCcw className="h-4 w-4 mr-2" /> Reverter Devolução</>
          ) : (
              <><CheckSquare className="h-4 w-4 mr-2" /> Marcar como Devolvido</>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
              {isFinalized ? 'Reverter Devolução?' : `Finalizar Aluguel ID: ${rental.id}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isFinalized 
                ? 'Deseja remover a data de retorno efetiva? O aluguel voltará para a lista de contratos "Ativos".'
                : 'Esta ação definirá a data de devolução efetiva como hoje. Isso indica que os itens foram retornados fisicamente. Deseja continuar?'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleAction} 
            disabled={isLoading} 
            className={isFinalized ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isFinalized ? 'Confirmar Reversão' : 'Confirmar Devolução'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
