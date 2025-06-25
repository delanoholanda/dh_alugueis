
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Edit, CalendarPlus, Eye, FileText, Calculator } from 'lucide-react'; 
import type { Rental, Equipment as InventoryEquipment } from '@/types';
import DeleteRentalButton from './DeleteRentalButton';
import { ExtendRentalDialog } from './ExtendRentalDialog';
import FinalizeRentalButton from './FinalizeRentalButton';
import { CalculateAndCloseDialog } from './CalculateAndCloseDialog';

interface RentalActionsCellProps {
  rental: Rental;
  inventory: InventoryEquipment[];
  onActionSuccess: () => Promise<void>; 
}

export function RentalActionsCell({ rental, inventory, onActionSuccess }: RentalActionsCellProps) {
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false);
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-end gap-1 w-full">
      <Button variant="ghost" size="icon" asChild title="Ver Detalhes do Aluguel">
        <Link href={`/dashboard/rentals/${rental.id}/details`}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" asChild title="Editar Aluguel" disabled={!!rental.actualReturnDate}>
        <Link href={`/dashboard/rentals/${rental.id}/edit`}>
          <Edit className="h-4 w-4" />
        </Link>
      </Button>
       <Button variant="ghost" size="icon" asChild title="Gerar Contrato">
        <Link href={`/dashboard/rentals/${rental.id}/receipt`}>
          <FileText className="h-4 w-4 text-blue-500" />
        </Link>
      </Button>

      {!rental.isOpenEnded && (
          <Button
              variant="ghost"
              size="icon"
              title="Prorrogar Aluguel"
              onClick={() => setIsExtendDialogOpen(true)}
              disabled={!!rental.actualReturnDate}
          >
              <CalendarPlus className="h-4 w-4 text-primary" />
          </Button>
      )}

      {rental.isOpenEnded && (
          <Button
              variant="ghost"
              size="icon"
              title="Calcular e Fechar Contrato"
              onClick={() => setIsCalculateDialogOpen(true)}
              disabled={!!rental.actualReturnDate}
          >
              <Calculator className="h-4 w-4 text-orange-500" />
          </Button>
      )}
      
      <FinalizeRentalButton 
        rental={rental} 
        isFinalized={!!rental.actualReturnDate} 
        onFinalized={onActionSuccess} 
      />
      <DeleteRentalButton rentalId={rental.id} onDeleted={onActionSuccess} />

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
    </div>
  );
}
