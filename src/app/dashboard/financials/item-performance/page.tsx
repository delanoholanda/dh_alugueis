
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

  for (const rental of paidRentals) {
    const rentalBillableDays = rental.isOpenEnded 
      ? countBillableDays(rental.rentalStartDate, rental.actualReturnDate || rental.expectedReturnDate, rental.chargeSaturdays ?? true, rental.chargeSundays ?? true)
      : rental.rentalDays || 0;
    
    // Handle freight revenue
    if (rental.freightValue && rental.freightValue > 0) {
        totalFreightRevenue += rental.freightValue;
        freightChargeCount++;
    }

    // Fuel value is now ignored for performance tracking as requested
    const fuelValue = rental.fuelValue ?? 0;

    // The base value for calculating proportions should exclude fuel
    const valueFromItemsAndFreight = rental.value - fuelValue;
    
    // Calculate total base value from items in the rental for proportion calculation
    const totalItemsValueForPeriod = rental.equipment.reduce((sum, eq) => {
        const inventoryItem = inventory.find(i => i.id === eq.equipmentId);
        const rate = eq.customDailyRentalRate ?? inventoryItem?.dailyRentalRate ?? 0;
        const days = rentalBillableDays; 
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
      
      // Calculate contribution based on value excluding fuel
      const itemRevenueContribution = (itemProportionalValue / totalItemsValueForPeriod) * (valueFromItemsAndFreight - (rental.freightValue ?? 0));
      
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
      item: { id: 'virtual_freight', name: 'Frete', imageUrl: '' },
      totalPaidDays: freightChargeCount, 
      totalRevenue: totalFreightRevenue,
    });
  }

  // Sort by highest revenue
  performanceData.sort((a, b) => b.totalRevenue - a.totalRevenue);

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Desempenho Financeiro por Item"
        icon={BarChart}
        description="Analise a receita e as diárias pagas geradas por cada item e frete. O combustível é tratado apenas como reembolso e não conta aqui."
      />
      <ItemPerformanceClientPage initialData={performanceData} />
    </div>
  );
}
