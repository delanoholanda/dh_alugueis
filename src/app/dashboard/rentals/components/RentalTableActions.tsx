
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit, CalendarPlus, Eye, FileText, Calculator, MoreHorizontal, Trash2, DollarSign } from 'lucide-react';
import type { Rental, Equipment as InventoryEquipment } from '@/types';
import { ExtendRentalDialog } from './ExtendRentalDialog';
import { CalculateAndCloseDialog } from './CalculateAndCloseDialog';
import { useToast } from '@/hooks/use-toast';
import { deleteRental } from '@/actions/rentalActions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import FinalizeRentalButton from './FinalizeRentalButton';
import { MarkAsPaidDialog } from './MarkAsPaidDialog';


interface RentalTableActionsProps {
  rental: Rental;
  inventory: InventoryEquipment[];
  onActionSuccess: () => Promise<void>;
}

export function RentalTableActions({ rental, inventory, onActionSuccess }: RentalTableActionsProps) {
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false);
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaidDialogOpen, setIsPaidDialogOpen] = useState(false);
  const { toast } = useToast();

  const isPayable = (rental.paymentStatus === 'pending' || rental.paymentStatus === 'overdue') && !rental.isOpenEnded;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
        await deleteRental(rental.id);
        toast({ title: 'Aluguel Excluído', description: `O aluguel ID ${rental.id} foi removido com sucesso.`, variant: 'success' });
        await onActionSuccess();
    } catch (error) {
        toast({ title: 'Erro ao Excluir', description: (error as Error).message, variant: 'destructive' });
    } finally {
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Abrir menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/rentals/${rental.id}/details`}>
              <Eye className="mr-2 h-4 w-4" />
              Ver Detalhes
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
             <Link href={`/dashboard/rentals/${rental.id}/receipt`}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar Contrato
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild disabled={!!rental.actualReturnDate}>
            <Link href={`/dashboard/rentals/${rental.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
           <DropdownMenuItem onSelect={() => setIsPaidDialogOpen(true)} disabled={!isPayable}>
              <DollarSign className="mr-2 h-4 w-4 text-green-600" />
              Registrar Pagamento
            </DropdownMenuItem>
          {!rental.isOpenEnded && (
             <DropdownMenuItem onSelect={() => setIsExtendDialogOpen(true)} disabled={!!rental.actualReturnDate}>
                <CalendarPlus className="mr-2 h-4 w-4" />
                Prorrogar
            </DropdownMenuItem>
          )}
          {rental.isOpenEnded && (
             <DropdownMenuItem onSelect={() => setIsCalculateDialogOpen(true)} disabled={!!rental.actualReturnDate}>
                <Calculator className="mr-2 h-4 w-4" />
                Fechar Contrato
            </DropdownMenuItem>
          )}
           <DropdownMenuItem asChild>
             <FinalizeRentalButton 
                rental={rental}
                isFinalized={!!rental.actualReturnDate}
                onFinalized={onActionSuccess}
                buttonProps={{ 
                    variant: "ghost", 
                    className: "w-full justify-start font-normal h-auto p-1.5 relative select-none items-center rounded-sm text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                }}
             />
           </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
       {isPayable && (
        <MarkAsPaidDialog
            rental={rental}
            isOpen={isPaidDialogOpen}
            onOpenChange={setIsPaidDialogOpen}
            onSuccess={onActionSuccess}
        />
       )}
      {isExtendDialogOpen && (
        <ExtendRentalDialog
          rental={rental}
          isOpen={isExtendDialogOpen}
          onOpenChange={setIsExtendDialogOpen}
          inventory={inventory}
          onExtensionSuccess={onActionSuccess}
        />
      )}

      {isCalculateDialogOpen && rental.isOpenEnded && (
        <CalculateAndCloseDialog
          rental={rental}
          isOpen={isCalculateDialogOpen}
          onOpenChange={setIsCalculateDialogOpen}
          onSuccess={onActionSuccess}
        />
      )}

       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Aluguel ID: {rental.id}?</AlertDialogTitle>
                    <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o contrato de aluguel e todos os seus dados associados.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
