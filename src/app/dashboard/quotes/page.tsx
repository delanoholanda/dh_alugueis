
import { PageHeader } from '@/components/layout/PageHeader';
import { getQuotes } from '@/actions/quoteActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getCustomers } from '@/actions/customerActions';
import { ClipboardList, PlusCircle } from 'lucide-react';
import QuotesClientPage from './components/QuotesClientPage';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function QuotesPage() {
  const [initialQuotes, initialInventory, initialCustomers] = await Promise.all([
    getQuotes(),
    getInventoryItems(),
    getCustomers(),
  ]);

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Gerenciar Orçamentos" 
        icon={ClipboardList}
        description="Crie, visualize e converta orçamentos em aluguéis."
        actions={
          <Button asChild>
            <Link href="/dashboard/quotes/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Orçamento
            </Link>
          </Button>
        }
      />
      <QuotesClientPage 
        initialQuotes={initialQuotes} 
        initialInventory={initialInventory} 
        initialCustomers={initialCustomers} 
      />
    </div>
  );
}
