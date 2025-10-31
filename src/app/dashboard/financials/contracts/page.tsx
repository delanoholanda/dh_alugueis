
import { PageHeader } from '@/components/layout/PageHeader';
import { getRentals } from '@/actions/rentalActions';
import { Handshake } from 'lucide-react';
import type { Rental } from '@/types';
import ContractsClientPage from './components/ContractsClientPage';


export default async function FinancialContractsPage() {
  const allRentals: Rental[] = await getRentals();

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Relatório Financeiro de Contratos"
        icon={Handshake}
        description="Analise o status de pagamento de todos os seus contratos de aluguel."
      />
      <ContractsClientPage initialRentals={allRentals} />
    </div>
  );
}
