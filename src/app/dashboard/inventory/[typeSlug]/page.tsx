
import { PageHeader } from '@/components/layout/PageHeader';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getRentals } from '@/actions/rentalActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';
import InventoryClientPage from '../components/InventoryClientPage';
import type { Rental, Equipment, EquipmentType } from '@/types';
import { notFound } from 'next/navigation';
import { getIcon } from '@/lib/lucide-icons';

interface DynamicInventoryPageProps {
  params: { typeSlug: string };
}

async function getTargetTypeBySlug(slug: string, allTypes: EquipmentType[]): Promise<EquipmentType | undefined> {
  const normalizedSlug = slug.toLowerCase();

  // Caso 1: O slug "platforms" (plural) é especial e deve corresponder ao tipo "Plataforma"
  if (normalizedSlug === 'platforms') {
    return allTypes.find(type => type.name.toLowerCase() === 'plataforma');
  }

  // Caso 2: O slug corresponde à parte do ID após "type_"
  // Ex: slug "scaffolding" deve corresponder ao tipo com ID "type_scaffolding"
  const typeByIdMatch = allTypes.find(type => type.id.toLowerCase() === `type_${normalizedSlug}`);
  if (typeByIdMatch) {
    return typeByIdMatch;
  }
  
  // Caso 3: O slug corresponde ao nome do tipo normalizado (substituindo espaços por hífens, etc.)
  // Isso pode ser útil se a SidebarNav gerar slugs baseados em nomes amigáveis no futuro.
  // Por agora, a SidebarNav gera slugs baseados em IDs.
  const typeByNameMatch = allTypes.find(type => 
    type.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') === normalizedSlug
  );
  if (typeByNameMatch) {
    return typeByNameMatch;
  }

  return undefined; // Se não encontrar por nenhuma das lógicas
}


export default async function DynamicInventoryTypePage({ params }: DynamicInventoryPageProps) {
  const { typeSlug } = params;

  const allEquipmentTypes: EquipmentType[] = await getEquipmentTypes();
  const targetType = await getTargetTypeBySlug(typeSlug, allEquipmentTypes);

  if (!targetType) {
    console.warn(`[DynamicInventoryTypePage] Tipo não encontrado para o slug: ${typeSlug}`);
    notFound();
  }

  const allItems: Equipment[] = await getInventoryItems();
  const allRentals: Rental[] = await getRentals();

  const items = allItems.filter(item => item.typeId === targetType.id);

  const rentedQuantities: Record<string, number> = {};
  allRentals.forEach(rental => {
    if (!rental.actualReturnDate) { // Considera apenas aluguéis ativos
      rental.equipment.forEach(eqEntry => {
        rentedQuantities[eqEntry.equipmentId] = (rentedQuantities[eqEntry.equipmentId] || 0) + eqEntry.quantity;
      });
    }
  });

  const PageIcon = getIcon(targetType.iconName);

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title={`Inventário de ${targetType.name}`}
        icon={PageIcon}
        description={`Visualizando todos os equipamentos do tipo "${targetType.name}".`}
      />
      <InventoryClientPage
        initialItems={items}
        rentedQuantities={rentedQuantities}
        initialEquipmentTypes={allEquipmentTypes} // Passar todos os tipos para o form de item, se necessário
      />
    </div>
  );
}

