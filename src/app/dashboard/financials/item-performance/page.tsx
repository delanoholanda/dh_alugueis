

'use server';

import { getRentals } from '@/actions/rentalActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { PageHeader } from '@/components/layout/PageHeader';
import { BarChart, DollarSign, Truck, Fuel } from 'lucide-react';
import type { Rental, Equipment as InventoryItem } from '@/types';
import ItemPerformanceClientPage from './components/ItemPerformanceClientPage';
import { countBillableDays } from '@/lib/utils';

export interface ItemPerformanceData {
  item: Partial<InventoryItem> & { id: string, name: string }; // Making item more flexible for virtual items
  totalPaidDays: number; // For items, it's days. For freight/fuel, it's "times charged".
  totalRevenue: number;
}

export default async function ItemPerformancePage() {
  const [rentals, inventory] = await Promise.all([
    getRentals(),
    getInventoryItems(),
  ]);

  const paidRentals = rentals.filter(r => r.paymentStatus === 'paid');
  const performanceMap = new Map<string, { totalPaidDays: number; totalRevenue: number }>();
  
  let totalFreightRevenue = 0;
  let freightChargeCount = 0;
  let totalFuelRevenue = 0;
  let fuelChargeCount = 0;

  for (const rental of paidRentals) {
    const rentalBillableDays = rental.isOpenEnded 
      ? countBillableDays(rental.rentalStartDate, rental.actualReturnDate || rental.expectedReturnDate, rental.chargeSaturdays ?? true, rental.chargeSundays ?? true)
      : rental.rentalDays || 0;
    
    // Handle freight revenue
    if (rental.freightValue && rental.freightValue > 0) {
        totalFreightRevenue += rental.freightValue;
        freightChargeCount++;
    }

    // Handle fuel revenue
    if (rental.fuelValue && rental.fuelValue > 0) {
        totalFuelRevenue += rental.fuelValue;
        fuelChargeCount++;
    }

    const valueFromItemsAndDiscount = rental.value - (rental.freightValue ?? 0) - (rental.fuelValue ?? 0);
    
    // Calculate total base value from items in the rental for proportion calculation
    const totalItemsValueForPeriod = rental.equipment.reduce((sum, eq) => {
        const inventoryItem = inventory.find(i => i.id === eq.equipmentId);
        const rate = eq.customDailyRentalRate ?? inventoryItem?.dailyRentalRate ?? 0;
        const days = rentalBillableDays; // Use the same billable days for this calculation
        return sum + (rate * eq.quantity * days);
    }, 0);
    
    if (totalItemsValueForPeriod <= 0) continue;

    for (const eq of rental.equipment) {
      if (!performanceMap.has(eq.equipmentId)) {
        performanceMap.set(eq.equipmentId, { totalPaidDays: 0, totalRevenue: 0 });
      }

      const inventoryItem = inventory.find(i => i.id === eq.equipmentId);
      const rate = eq.customDailyRentalRate ?? inventoryItem?.dailyRentalRate ?? 0;
      const days = rentalBillableDays;
      
      const itemProportionalValue = (rate * eq.quantity * days);
      const itemRevenueContribution = (itemProportionalValue / totalItemsValueForPeriod) * valueFromItemsAndDiscount;
      
      const entry = performanceMap.get(eq.equipmentId)!;
      entry.totalPaidDays += (days * eq.quantity);
      entry.totalRevenue += itemRevenueContribution;
    }
  }

  const performanceData: ItemPerformanceData[] = inventory
    .map(item => {
      const data = performanceMap.get(item.id);
      return {
        item,
        totalPaidDays: data?.totalPaidDays || 0,
        totalRevenue: data?.totalRevenue || 0,
      };
    })
    .filter(data => data.totalRevenue > 0);

  // Add Freight as a virtual item if it generated revenue
  if (totalFreightRevenue > 0) {
    performanceData.push({
      item: { id: 'virtual_freight', name: 'Frete', imageUrl: '' }, // Treat as a virtual item
      totalPaidDays: freightChargeCount, // Represents "times charged"
      totalRevenue: totalFreightRevenue,
    });
  }
  
  // Add Fuel as a virtual item if it generated revenue
  if (totalFuelRevenue > 0) {
    performanceData.push({
      item: { id: 'virtual_fuel', name: 'Combustível', imageUrl: '' },
      totalPaidDays: fuelChargeCount,
      totalRevenue: totalFuelRevenue,
    });
  }

  // Sort by highest revenue
  performanceData.sort((a, b) => b.totalRevenue - a.totalRevenue);

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Desempenho Financeiro por Item"
        icon={BarChart}
        description="Analise a receita e as diárias pagas geradas por cada item, frete e outros serviços do seu inventário."
      />
      <ItemPerformanceClientPage initialData={performanceData} />
    </div>
  );
}


