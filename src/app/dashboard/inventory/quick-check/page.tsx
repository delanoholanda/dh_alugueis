
import { getInventoryItems } from '@/actions/inventoryActions';
import { getRentals } from '@/actions/rentalActions';
import { PageHeader } from '@/components/layout/PageHeader';
import { ClipboardCheck } from 'lucide-react';
import QuickCheckClient from './components/QuickCheckClient';

export default async function QuickCheckPage() {
  const [inventory, rentals] = await Promise.all([
    getInventoryItems(),
    getRentals(),
  ]);

  const rentedQuantities: Record<string, number> = {};
  rentals.forEach(rental => {
    if (!rental.actualReturnDate) {
      rental.equipment.forEach(eq => {
        rentedQuantities[eq.equipmentId] = (rentedQuantities[eq.equipmentId] || 0) + eq.quantity;
      });
    }
  });

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Conferência de Estoque"
        icon={ClipboardCheck}
        description="Visualização simplificada e rápida para contagem física de itens."
      />
      <QuickCheckClient 
        inventory={inventory} 
        rentedQuantities={rentedQuantities} 
      />
    </div>
  );
}
