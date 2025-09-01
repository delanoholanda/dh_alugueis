
import { getRentals } from '@/actions/rentalActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { PageHeader } from '@/components/layout/PageHeader';
import { PackageSearch } from 'lucide-react';
import type { Rental, Equipment as InventoryItem } from '@/types';
import RentedItemsClientPage from './components/RentedItemsClientPage';

export interface RentedItemInfo {
  item: InventoryItem;
  rentals: Array<{
    rentalId: number;
    customerName: string;
    quantity: number;
    expectedReturnDate: string;
  }>;
  totalRented: number;
}

export default async function RentedItemsPage() {
  const [allRentals, allInventory] = await Promise.all([
    getRentals(),
    getInventoryItems(),
  ]);

  const activeRentals = allRentals.filter(r => !r.actualReturnDate);
  const rentedItemsMap = new Map<string, RentedItemInfo>();

  for (const rental of activeRentals) {
    for (const rentedEq of rental.equipment) {
      const inventoryItem = allInventory.find(inv => inv.id === rentedEq.equipmentId);
      if (!inventoryItem) continue;

      if (!rentedItemsMap.has(inventoryItem.id)) {
        rentedItemsMap.set(inventoryItem.id, {
          item: inventoryItem,
          rentals: [],
          totalRented: 0,
        });
      }

      const entry = rentedItemsMap.get(inventoryItem.id)!;
      entry.rentals.push({
        rentalId: rental.id,
        customerName: rental.customerName || 'Cliente desconhecido',
        quantity: rentedEq.quantity,
        expectedReturnDate: rental.isOpenEnded ? 'Em Aberto' : rental.expectedReturnDate,
      });
      entry.totalRented += rentedEq.quantity;
    }
  }

  const rentedItemsData = Array.from(rentedItemsMap.values());

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Itens Atualmente Alugados"
        icon={PackageSearch}
        description="Veja quais equipamentos estão em campo e em quais contratos."
      />
      <RentedItemsClientPage initialData={rentedItemsData} />
    </div>
  );
}
