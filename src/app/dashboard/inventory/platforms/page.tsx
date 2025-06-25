
import { PageHeader } from '@/components/layout/PageHeader';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getRentals } from '@/actions/rentalActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';
import InventoryClientPage from '../components/InventoryClientPage';
import { LayoutPanelTop } from 'lucide-react';
import type { Rental, Equipment, EquipmentType } from '@/types';

const TARGET_TYPE_NAME = "Plataforma"; // Corresponde ao nome do tipo "Plataforma"

async function getTargetTypeId(allTypes: EquipmentType[]): Promise<string | undefined> {
  const foundType = allTypes.find(type => type.name.toLowerCase() === TARGET_TYPE_NAME.toLowerCase());
  return foundType?.id;
}

export default async function PlatformsInventoryPage() {
  const allItems: Equipment[] = await getInventoryItems();
  const allRentals: Rental[] = await getRentals();
  const allEquipmentTypes: EquipmentType[] = await getEquipmentTypes();

  const targetTypeId = await getTargetTypeId(allEquipmentTypes);
  const items = allItems.filter(item => item.typeId === targetTypeId);

  const rentedQuantities: Record<string, number> = {};
  allRentals.forEach(rental => {
    if (!rental.actualReturnDate) { // Consider only active rentals
      rental.equipment.forEach(eqEntry => {
        rentedQuantities[eqEntry.equipmentId] = (rentedQuantities[eqEntry.equipmentId] || 0) + eqEntry.quantity;
      });
    }
  });

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Inventário de Plataformas"
        icon={LayoutPanelTop}
        description={`Visualizando todos os equipamentos do tipo "${TARGET_TYPE_NAME}".`}
      />
      <InventoryClientPage
        initialItems={items}
        rentedQuantities={rentedQuantities}
        initialEquipmentTypes={allEquipmentTypes}
      />
    </div>
  );
}

