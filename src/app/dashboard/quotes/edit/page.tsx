
import { QuoteForm } from '../../components/QuoteForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { getQuoteById, updateQuote } from '@/actions/quoteActions';
import type { Quote } from '@/types';
import { ClipboardList } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getCustomers } from '@/actions/customerActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';

interface EditQuotePageProps {
  params: { id: string };
}

export default async function EditQuotePage({ params }: EditQuotePageProps) {
  const quoteId = Number(params.id);
  if (isNaN(quoteId)) {
    notFound();
  }

  const [quote, customers, inventory, equipmentTypes] = await Promise.all([
    getQuoteById(quoteId),
    getCustomers(),
    getInventoryItems(),
    getEquipmentTypes(),
  ]);

  if (!quote) {
    notFound();
  }

  async function handleUpdateQuote(data: Partial<Omit<Quote, 'id' | 'quoteDate'>>) {
    "use server";
    return updateQuote(quoteId, data);
  }

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Editar Orçamento" 
        icon={ClipboardList}
        description={`Atualize os detalhes para o orçamento ID: ${quote.id}`}
      />
      <QuoteForm
        initialData={quote}
        onSubmitAction={handleUpdateQuote as any} 
        customers={customers}
        inventory={inventory}
        equipmentTypes={equipmentTypes}
        formTitle="Editar Orçamento"
        submitButtonText="Salvar Alterações"
      />
    </div>
  );
}
