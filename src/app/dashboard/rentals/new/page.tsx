
import { RentalForm } from '../components/RentalForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { createRental, getRentals } from '@/actions/rentalActions'; // Import getRentals
import type { Rental } from '@/types';
import { ScrollText } from 'lucide-react';
import { getCustomers } from '@/actions/customerActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';


export default async function NewRentalPage() {
  
  const customers = await getCustomers();
  const inventory = await getInventoryItems();
  const equipmentTypes = await getEquipmentTypes();
  const allRentals = await getRentals(); // Fetch all rentals

  async function handleCreateRental(data: Omit<Rental, 'id' | 'expectedReturnDate' | 'customerName'> & { 
    equipment: Array<{ equipmentId: string; quantity: number; customDailyRentalRate?: number | null }>;
  }) {
    "use server"; 
    // The `RentalForm` component already processes the `rentalStartDate` into a string.
    // The data object can be passed directly to the server action.
    return createRental(data);
  }

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Criar Novo Aluguel" 
        icon={ScrollText}
        description="Preencha os detalhes para registrar um novo contrato de aluguel."
      />
      <RentalForm
        onSubmitAction={handleCreateRental as any} 
        customers={customers}
        inventory={inventory}
        equipmentTypes={equipmentTypes}
        allRentals={allRentals} // Pass allRentals to the form
        formTitle="Novo Contrato de Aluguel"
        submitButtonText="Criar Aluguel"
      />
    </div>
  );
}
