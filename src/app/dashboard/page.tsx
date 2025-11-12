
import { PageHeader } from '@/components/layout/PageHeader';
import { LayoutDashboard } from 'lucide-react';
import DashboardDisplay from './components/DashboardDisplay';
import DashboardActionTrigger from './components/DashboardActionTrigger';


export default function DashboardPage() {
  // A lógica de busca de dados foi movida para o componente do cliente (DashboardDisplay)
  // para permitir um estado de carregamento adequado e atualizações dinâmicas,
  // corrigindo a exceção do lado do cliente.
  return (
    <div className="container mx-auto py-2">
      <DashboardActionTrigger />
      <PageHeader 
        title="Visão Geral do Painel" 
        icon={LayoutDashboard} 
        description="Bem-vindo à DH Alugueis. Aqui está um resumo do seu negócio." 
      />
      <DashboardDisplay />
    </div>
  );
}
