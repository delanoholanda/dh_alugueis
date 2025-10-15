
import { PageHeader } from '@/components/layout/PageHeader';
import { getRentals } from '@/actions/rentalActions';
import { getCustomers } from '@/actions/customerActions';
import { CalendarDays } from 'lucide-react';
import SchedulingClientPage from './components/SchedulingClientPage';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';

export default async function SchedulingPage() {
  const [rentals, customers, inventory, equipmentTypes] = await Promise.all([
    getRentals(),
    getCustomers(),
    getInventoryItems(),
    getEquipmentTypes(),
  ]);

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Calendário de Agendamentos"
        icon={CalendarDays}
        description="Visualize todos os aluguéis e agendamentos em um calendário interativo."
      />
      <SchedulingClientPage
        initialRentals={rentals}
        initialCustomers={customers}
        initialInventory={inventory}
        initialEquipmentTypes={equipmentTypes}
      />
    </div>
  );
}
