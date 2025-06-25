
import { RentalForm } from '../../components/RentalForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { getRentalById, updateRental, getRentals } from '@/actions/rentalActions'; // Import getRentals
import type { Rental } from '@/types';
import { ScrollText } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getCustomers } from '@/actions/customerActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';

interface EditRentalPageProps {
  params: { id: string };
}

export default async function EditRentalPage({ params }: EditRentalPageProps) {
  const rentalId = Number(params.id);
  if (isNaN(rentalId)) {
    notFound();
  }
  const rental = await getRentalById(rentalId);
  const customers = await getCustomers();
  const inventory = await getInventoryItems();
  const equipmentTypes = await getEquipmentTypes();
  const allRentals = await getRentals(); // Fetch all rentals

  if (!rental) {
    notFound();
  }

  async function handleUpdateRental(data: Partial<Omit<Rental, 'id' | 'expectedReturnDate' | 'customerName' >> & { 
    equipment?: Array<{ equipmentId: string; quantity: number; customDailyRentalRate?: number | null }>;
    value?: number;
    discountValue?: number;
  }) {
    "use server";
    // The RentalForm already formats the date to a string, so we can pass the data directly.
    // The previous logic was flawed and caused the TypeScript error.
    return updateRental(rentalId, data as any); 
  }

  return (
    <div className="container mx-auto py-2">
       <PageHeader 
        title="Editar Contrato de Aluguel" 
        icon={ScrollText}
        description={`Atualize os detalhes para o aluguel ID: ${rental.id}`}
      />
      <RentalForm
        initialData={rental}
        onSubmitAction={handleUpdateRental as any} 
        customers={customers}
        inventory={inventory}
        equipmentTypes={equipmentTypes}
        allRentals={allRentals} // Pass allRentals to the form
        formTitle="Editar Contrato de Aluguel"
        submitButtonText="Salvar Alterações"
      />
    </div>
  );
}
