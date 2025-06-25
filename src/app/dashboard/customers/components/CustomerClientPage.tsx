
'use client';

import type { Customer, Rental } from '@/types';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { CustomerForm } from './CustomerForm';
import { createCustomer, updateCustomer, deleteCustomer, getCustomers } from '@/actions/customerActions';
import { PlusCircle, Edit, Trash2, User, Phone, Fingerprint, Home, ClipboardList, ClipboardCheck, UsersRound, History, PackageX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

const responsivenessMap: Record<Customer['responsiveness'], string> = {
  'very responsive': 'Muito Responsivo',
  'responsive': 'Responsivo',
  'not very responsive': 'Pouco Responsivo',
  'never responds': 'Nunca Responde'
};

const rentalHistoryMap: Record<Customer['rentalHistory'], string> = {
  'always on time': 'Sempre em Dia',
  'sometimes late': 'Às Vezes Atrasado',
  'often late': 'Frequentemente Atrasado',
  'always late': 'Sempre Atrasado'
};

const formatCpf = (cpf: string | null | undefined): string => {
  if (!cpf) return 'Não Informado';
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf; 
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

interface CustomerWithRentalCounts extends Customer {
  activeRentalsCount: number;
  finalizedRentalsCount: number;
}

interface CustomerClientPageProps {
  initialCustomers: Customer[];
  initialRentals: Rental[];
}

export default function CustomerClientPage({ initialCustomers, initialRentals }: CustomerClientPageProps) {
  const [customers, setCustomers] = useState<Customer[]>(() => initialCustomers.sort((a, b) => a.name.localeCompare(b.name)));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  const { toast } = useToast();

  const customersWithRentalCounts = useMemo((): CustomerWithRentalCounts[] => {
    return customers.map(customer => {
      const customerRentals = initialRentals.filter(rental => rental.customerId === customer.id);
      const activeRentalsCount = customerRentals.filter(r => !r.actualReturnDate).length;
      const finalizedRentalsCount = customerRentals.filter(r => !!r.actualReturnDate).length;
      return { ...customer, activeRentalsCount, finalizedRentalsCount };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, initialRentals]);

  const refreshCustomerList = async () => {
    const refreshedCustomers = await getCustomers();
    setCustomers(refreshedCustomers.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleFormSubmit = async (data: Omit<Customer, 'id'>) => {
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, data);
      } else {
        await createCustomer(data);
      }
      await refreshCustomerList(); 
      setIsFormOpen(false);
      setEditingCustomer(undefined);
    } catch (error) {
       toast({ 
        title: 'Erro ao Salvar Cliente', 
        description: (error as Error).message || 'Ocorreu uma falha ao salvar os dados do cliente.', 
        variant: 'destructive' 
      });
    }
  };

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  const openNewForm = () => {
    setEditingCustomer(undefined);
    setIsFormOpen(true);
  };
  
  const handleDeleteCustomer = async (customerId: string) => {
    try {
      await deleteCustomer(customerId);
      toast({ title: 'Cliente Excluído', description: 'Registro do cliente removido.', variant: 'success' });
      setCustomers(prev => prev.filter(c => c.id !== customerId).sort((a,b) => a.name.localeCompare(b.name)));
    } catch (error) {
      toast({ 
        title: 'Erro ao Excluir Cliente', 
        description: (error as Error).message || 'Ocorreu uma falha ao excluir o cliente.', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingCustomer(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Cliente
            </Button>
          </DialogTrigger>
          {isFormOpen && (
            <CustomerForm
              key={editingCustomer ? editingCustomer.id : 'new'}
              initialData={editingCustomer}
              onSubmitAction={handleFormSubmit}
              onClose={() => {setIsFormOpen(false); setEditingCustomer(undefined);}}
            />
          )}
        </Dialog>
      </div>
      
      {customersWithRentalCounts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {customersWithRentalCounts.map((customer) => (
            <Card key={customer.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-grow">
                        <CardTitle className="text-lg font-headline truncate" title={customer.name}>
                            {customer.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground space-y-0.5 mt-1">
                            <div className="flex items-center">
                                <Phone className="h-3 w-3 mr-1.5 text-muted-foreground" /> {customer.phone}
                            </div>
                            <div className="flex items-center">
                                <Fingerprint className="h-3 w-3 mr-1.5 text-muted-foreground" /> CPF: {formatCpf(customer.cpf)}
                            </div>
                        </CardDescription>
                    </div>
                     <div className="w-16 h-16 relative rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 border">
                        {customer.imageUrl ? (
                            <Image
                            src={customer.imageUrl}
                            alt={`Foto de ${customer.name}`}
                            layout="fill"
                            objectFit="cover"
                            className="p-0.5"
                            data-ai-hint="person portrait"
                            />
                        ) : (
                            <User className="w-8 h-8 text-muted-foreground opacity-50" data-ai-hint="person portrait"/>
                        )}
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm flex-grow">
                {customer.address && (
                    <div className="flex items-start">
                        <Home className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground text-xs whitespace-pre-wrap">{customer.address}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={customer.responsiveness === 'very responsive' || customer.responsiveness === 'responsive' ? 'default' : 'secondary'} className="whitespace-nowrap text-xs py-0.5 px-1.5">
                        <UsersRound className="h-3 w-3 mr-1"/> {responsivenessMap[customer.responsiveness]}
                    </Badge>
                    <Badge variant={customer.rentalHistory === 'always on time' ? 'default' : customer.rentalHistory === 'sometimes late' ? 'secondary' : 'destructive'} className="whitespace-nowrap text-xs py-0.5 px-1.5">
                       <History className="h-3 w-3 mr-1"/> {rentalHistoryMap[customer.rentalHistory]}
                    </Badge>
                </div>
                <div className="pt-2 space-y-1">
                    <div className="flex items-center text-xs">
                        <ClipboardList className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                        <span className="text-muted-foreground">Aluguéis Ativos:</span>
                        <span className="ml-1 font-medium">{customer.activeRentalsCount}</span>
                    </div>
                    <div className="flex items-center text-xs">
                        <ClipboardCheck className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                        <span className="text-muted-foreground">Aluguéis Finalizados:</span>
                        <span className="ml-1 font-medium">{customer.finalizedRentalsCount}</span>
                    </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-3 pb-3 px-4">
                <div className="flex flex-wrap items-center justify-end gap-1 w-full">
                    <Button variant="outline" size="sm" onClick={() => openEditForm(customer)} title="Editar Cliente" className="flex-1 sm:flex-none">
                        <Edit className="h-3.5 w-3.5 mr-1.5 md:mr-0 lg:mr-1.5" /> <span className="md:hidden lg:inline">Editar</span>
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50 hover:border-destructive/70 flex-1 sm:flex-none">
                            <Trash2 className="h-3.5 w-3.5 mr-1.5 md:mr-0 lg:mr-1.5" /> <span className="md:hidden lg:inline">Excluir</span>
                        </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Cliente: {customer.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente o cliente.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCustomer(customer.id)} className="bg-destructive hover:bg-destructive/90">
                            Confirmar Exclusão
                            </AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-lg col-span-full">
          <CardContent className="py-12 text-center">
            <PackageX className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum cliente encontrado.</h3>
            <p className="text-muted-foreground">Adicione novos clientes para começar a gerenciá-los aqui.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
