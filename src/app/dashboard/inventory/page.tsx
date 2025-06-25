
import { PageHeader } from '@/components/layout/PageHeader';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getRentals } from '@/actions/rentalActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';
import InventoryClientPage from './components/InventoryClientPage';
import { Warehouse } from 'lucide-react';
import type { Rental, Equipment, EquipmentType } from '@/types';

export default async function InventoryPage() {
  const items: Equipment[] = await getInventoryItems();
  const rentals: Rental[] = await getRentals();
  const equipmentTypes: EquipmentType[] = await getEquipmentTypes();

  const rentedQuantities: Record<string, number> = {};

  rentals.forEach(rental => {
    if (!rental.actualReturnDate) {
      rental.equipment.forEach(eqEntry => {
        rentedQuantities[eqEntry.equipmentId] = (rentedQuantities[eqEntry.equipmentId] || 0) + eqEntry.quantity;
      });
    }
  });

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Inventário de Equipamentos"
        icon={Warehouse}
        description="Gerencie todos os seus equipamentos de aluguel, acompanhe quantidades e status."
      />
      <InventoryClientPage
        initialItems={items}
        rentedQuantities={rentedQuantities}
        initialEquipmentTypes={equipmentTypes}
      />
    </div>
  );
}

    