
import { PageHeader } from '@/components/layout/PageHeader';
import { getUsers } from '@/actions/userActions';
import UserClientPage from './components/UserClientPage';
import { Users2 } from 'lucide-react';

export default async function ManageUsersPage() {
  const users = await getUsers();

  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Gerenciamento de Usuários" 
        icon={Users2}
        description="Adicione, edite ou remova usuários do sistema."
      />
      <UserClientPage initialUsers={users} />
    </div>
  );
}
