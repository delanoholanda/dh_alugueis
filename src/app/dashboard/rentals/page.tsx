import { PageHeader } from '@/components/layout/PageHeader';
import { getRentals } from '@/actions/rentalActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getCustomers } from '@/actions/customerActions';
import { ScrollText, PlusCircle } from 'lucide-react';
import RentalsClientPage from './components/RentalsClientPage';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function RentalsPage() {
  // Fetch all necessary data on the server in parallel
  const [initialRentals, initialInventory, initialCustomers] = await Promise.all([
    getRentals(),
    getInventoryItems(),
    getCustomers(),
  ]);

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Gerenciar Aluguéis" 
        icon={ScrollText}
        description="Supervisione todos os contratos de aluguel, acompanhe status e gerencie atribuições de equipamentos."
        actions={
          <Button asChild>
            <Link href="/dashboard/rentals/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Aluguel
            </Link>
          </Button>
        }
      />
      {/* Pass all initial data to the client component for rendering and interaction */}
      <RentalsClientPage 
        initialRentals={initialRentals} 
        initialInventory={initialInventory} 
        initialCustomers={initialCustomers} 
      />
    </div>
  );
}
