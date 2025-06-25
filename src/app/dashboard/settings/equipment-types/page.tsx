
import { PageHeader } from '@/components/layout/PageHeader';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';
import EquipmentTypeClientPage from './components/EquipmentTypeClientPage';
import { Tags } from 'lucide-react';

export default async function EquipmentTypesPage() {
  const equipmentTypes = await getEquipmentTypes();

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Gerenciamento de Tipos de Equipamento" 
        icon={Tags}
        description="Adicione, edite ou remova os tipos de equipamentos disponíveis para o inventário."
      />
      <EquipmentTypeClientPage initialEquipmentTypes={equipmentTypes} />
    </div>
  );
}
