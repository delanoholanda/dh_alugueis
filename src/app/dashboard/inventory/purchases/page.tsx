
import { PageHeader } from '@/components/layout/PageHeader';
import { getPurchases } from '@/actions/purchaseActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import PurchaseClientPage from './components/PurchaseClientPage';
import { ShoppingCart } from 'lucide-react';

export default async function PurchasesPage() {
  const [purchases, inventory] = await Promise.all([
    getPurchases(),
    getInventoryItems(),
  ]);

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Entrada de Materiais" 
        icon={ShoppingCart}
        description="Registre a compra de novos equipamentos para atualizar seu estoque e patrimônio."
      />
      <PurchaseClientPage initialPurchases={purchases} inventory={inventory} />
    </div>
  );
}
