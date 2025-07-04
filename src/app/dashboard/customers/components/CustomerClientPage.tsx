'use client';

import type { Customer, Rental } from '@/types';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { CustomerForm } from './CustomerForm';
import { createCustomer, updateCustomer, deleteCustomer, getCustomers } from '@/actions/customerActions';
import { PlusCircle, Edit, Trash2, User, Phone, Fingerprint, Home, UsersRound, History, PackageX, FileText, AlertTriangle } from 'lucide-react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, formatToBRL, getPaymentStatusVariant, paymentStatusMap } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface CustomerClientPageProps {
  initialCustomers: Customer[];
  initialRentals: Rental[];
}

export default function CustomerClientPage({ initialCustomers, initialRentals }: CustomerClientPageProps) {
  const [customers, setCustomers] = useState<Customer[]>(() => initialCustomers.sort((a, b) => a.name.localeCompare(b.name)));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  const { toast } = useToast();
  const [selectedRentals, setSelectedRentals] = useState<Record<string, number[]>>({});

  const payableRentalsByCustomer = useMemo(() => {
    const map: Record<string, Rental[]> = {};
    for (const customer of customers) {
      map[customer.id] = initialRentals.filter(
        rental => rental.customerId === customer.id && rental.paymentStatus !== 'paid'
      ).sort((a,b) => parseISO(a.rentalStartDate).getTime() - parseISO(b.rentalStartDate).getTime());
    }
    return map;
  }, [customers, initialRentals]);
  
  const handleRentalSelection = (customerId: string, rentalId: number) => {
    setSelectedRentals(prev => {
      const currentSelection = prev[customerId] || [];
      const newSelection = currentSelection.includes(rentalId)
        ? currentSelection.filter(id => id !== rentalId)
        : [...currentSelection, rentalId];
      return { ...prev, [customerId]: newSelection };
    });
  };

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
      
      {customers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {customers.map((customer) => {
            const customerPayableRentals = payableRentalsByCustomer[customer.id] || [];
            const customerSelectedRentals = selectedRentals[customer.id] || [];
            const hasOpenEndedSelected = customerSelectedRentals.some(id => 
                customerPayableRentals.find(r => r.id === id)?.isOpenEnded
            );

            return (
            <Card key={customer.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-grow min-w-0">
                        <CardTitle className="text-lg font-headline truncate" title={customer.name}>
                            {customer.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground space-y-0.5 mt-1">
                            <div className="flex items-center">
                                <Phone className="h-3 w-3 mr-1.5 text-muted-foreground" /> {customer.phone}
                            </div>
                            <div className="flex items-center">
                                <Fingerprint className="h-3 w-3 mr-1.5 text-muted-foreground" />
                                <span>CPF:&nbsp;</span>
                                <span className={cn(!customer.cpf && "text-destructive font-semibold")}>
                                    {formatCpf(customer.cpf)}
                                </span>
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
                 <div className="flex items-start">
                    <Home className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    {customer.address ? (
                        <span className="text-muted-foreground text-xs whitespace-pre-wrap">{customer.address}</span>
                    ) : (
                        <span className="text-destructive font-semibold text-xs">Não Informado</span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={customer.responsiveness === 'very responsive' || customer.responsiveness === 'responsive' ? 'default' : 'secondary'} className="whitespace-nowrap text-xs py-0.5 px-1.5">
                        <UsersRound className="h-3 w-3 mr-1"/> {responsivenessMap[customer.responsiveness]}
                    </Badge>
                    <Badge variant={customer.rentalHistory === 'always on time' ? 'default' : customer.rentalHistory === 'sometimes late' ? 'secondary' : 'destructive'} className="whitespace-nowrap text-xs py-0.5 px-1.5">
                       <History className="h-3 w-3 mr-1"/> {rentalHistoryMap[customer.rentalHistory]}
                    </Badge>
                </div>
                
                {customerPayableRentals.length > 0 && (
                    <div className="pt-2">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="rentals" className="border-t">
                                <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2">
                                    {customerPayableRentals.length} Aluguéis com Pagamento Pendente
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 space-y-2">
                                    {customerPayableRentals.map(rental => (
                                        <div key={rental.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50">
                                            <Checkbox
                                                id={`rental-${customer.id}-${rental.id}`}
                                                checked={customerSelectedRentals.includes(rental.id)}
                                                onCheckedChange={() => handleRentalSelection(customer.id, rental.id)}
                                            />
                                            <label htmlFor={`rental-${customer.id}-${rental.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-grow cursor-pointer">
                                                <div className='flex justify-between items-center'>
                                                    <div>
                                                        <p>ID: {rental.id.toString().padStart(4,'0')} - {format(parseISO(rental.rentalStartDate), 'dd/MM/yy')}</p>
                                                        <p className='text-xs font-normal text-muted-foreground'>
                                                            {rental.isOpenEnded ? 'Em Aberto (diária)' : 'Valor do Contrato'}: {formatToBRL(rental.value)}
                                                        </p>
                                                    </div>
                                                    <Badge variant={getPaymentStatusVariant(rental.paymentStatus)} className="capitalize text-xs">
                                                        {paymentStatusMap[rental.paymentStatus]}
                                                    </Badge>
                                                </div>
                                            </label>
                                        </div>
                                    ))}
                                    {hasOpenEndedSelected && (
                                        <div className="flex items-start text-xs p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                                            <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                                            <span>Contratos "Em Aberto" devem ser fechados individualmente antes de gerar um contrato consolidado.</span>
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-3 pb-3 px-4 flex-col items-stretch space-y-2">
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
                 {customerSelectedRentals.length > 0 && (
                    <div className="pt-2 border-t">
                        <Button asChild className="w-full" disabled={hasOpenEndedSelected}>
                            <Link href={`/dashboard/customers/${customer.id}/consolidated-receipt?rental_ids=${customerSelectedRentals.join(',')}`}>
                                <FileText className="h-4 w-4 mr-2" />
                                Gerar Contrato Consolidado ({customerSelectedRentals.length})
                            </Link>
                        </Button>
                    </div>
                )}
              </CardFooter>
            </Card>
          )})}
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
