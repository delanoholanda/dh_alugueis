
'use client';

import type { User } from '@/types';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { UserForm } from './UserForm';
import { createUser, updateUser, deleteUser, getUsers as refreshUserListAction } from '@/actions/userActions';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth'; // Para verificar o usuário logado

export default function UserClientPage({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(() => initialUsers.sort((a, b) => a.name.localeCompare(b.name)));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const { toast } = useToast();
  const { user: loggedInUser } = useAuth(); // Para verificar se o usuário logado está sendo excluído

  const refreshUsers = async () => {
    const refreshedUsers = await refreshUserListAction();
    setUsers(refreshedUsers.sort((a,b) => a.name.localeCompare(b.name)));
  }

  const handleFormSubmit = async (data: Omit<User, 'id'> & { password?: string }) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, data);
      } else {
        await createUser(data);
      }
      await refreshUsers();
      setIsFormOpen(false);
      setEditingUser(undefined);
    } catch (error) {
       toast({
        title: 'Erro ao Salvar Usuário',
        description: (error as Error).message || 'Não foi possível salvar o usuário.',
        variant: 'destructive',
      });
    }
  };

  const openEditForm = (user: User) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const openNewForm = () => {
    setEditingUser(undefined);
    setIsFormOpen(true);
  };
  
  const handleDeleteUser = async (userId: string) => {
    if (userId === loggedInUser?.id) {
      toast({ title: 'Ação Inválida', description: 'Você não pode excluir sua própria conta.', variant: 'destructive' });
      return;
    }
    if (users.length <= 1) {
       toast({ title: 'Ação Inválida', description: 'Não é possível excluir o último usuário.', variant: 'destructive' });
      return;
    }
    try {
      await deleteUser(userId);
      toast({ title: 'Usuário Excluído', description: 'O usuário foi removido com sucesso.', variant: 'success' });
      await refreshUsers();
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message || 'Falha ao excluir usuário.', variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingUser(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Usuário
            </Button>
          </DialogTrigger>
          {isFormOpen && (
            <UserForm
              key={editingUser ? editingUser.id : 'new'}
              initialData={editingUser}
              onSubmitAction={handleFormSubmit}
              onClose={() => {setIsFormOpen(false); setEditingUser(undefined);}}
            />
          )}
        </Dialog>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditForm(user)} title="Editar Usuário">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Excluir Usuário" 
                                disabled={user.id === loggedInUser?.id || users.length <= 1}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Usuário: {user.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg">Nenhum usuário encontrado.</p>
              <p>Adicione usuários para gerenciar o acesso.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
