
import { QuoteForm } from '../components/QuoteForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { createQuote } from '@/actions/quoteActions';
import type { Quote } from '@/types';
import { ClipboardList } from 'lucide-react';
import { getCustomers } from '@/actions/customerActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';

export default async function NewQuotePage() {
  
  const customers = await getCustomers();
  const inventory = await getInventoryItems();
  const equipmentTypes = await getEquipmentTypes();
  
  async function handleCreateQuote(data: Omit<Quote, 'id' | 'expectedReturnDate' | 'customerName' | 'status' | 'quoteDate'> & { 
    equipment: Array<{ equipmentId: string; quantity: number; customDailyRentalRate?: number | null }>;
  }) {
    "use server";
    return createQuote(data);
  }

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Criar Novo Orçamento" 
        icon={ClipboardList}
        description="Preencha os detalhes para gerar um novo orçamento."
      />
      <QuoteForm
        onSubmitAction={handleCreateQuote as any} 
        customers={customers}
        inventory={inventory}
        equipmentTypes={equipmentTypes}
        formTitle="Novo Orçamento"
        submitButtonText="Criar Orçamento"
      />
    </div>
  );
}
