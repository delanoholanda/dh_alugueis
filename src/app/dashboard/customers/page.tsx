
import { PageHeader } from '@/components/layout/PageHeader';
import { getCustomers } from '@/actions/customerActions';
import { getRentals } from '@/actions/rentalActions'; // Importar getRentals
import CustomerClientPage from './components/CustomerClientPage';
import { Users } from 'lucide-react';
import type { Rental } from '@/types'; // Importar o tipo Rental

export default async function CustomersPage() {
  const customers = await getCustomers();
  const rentals: Rental[] = await getRentals(); // Buscar aluguéis

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Gerenciamento de Clientes" 
        icon={Users}
        description="Visualize, adicione e gerencie seu banco de dados de clientes."
      />
      <CustomerClientPage initialCustomers={customers} initialRentals={rentals} /> {/* Passar aluguéis */}
    </div>
  );
}
