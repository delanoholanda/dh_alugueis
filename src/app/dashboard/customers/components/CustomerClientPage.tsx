
'use client';

import type { Customer, Rental } from '@/types';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CustomerForm } from './CustomerForm';
import { createCustomer, updateCustomer, deleteCustomer, getCustomers } from '@/actions/customerActions';
import { PlusCircle, Edit, Trash2, User, Phone, Fingerprint, Home, UsersRound, History, PackageX, FileText, AlertTriangle, Calendar as CalendarIcon, ListChecks, Eraser, ScrollText, DollarSign } from 'lucide-react';
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
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


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

const formatDocument = (docType?: 'cpf' | 'cnpj', docNumber?: string | null): string => {
  if (!docNumber) return 'Não Informado';
  const digits = docNumber.replace(/\D/g, "");
  
  if (docType === 'cpf') {
    if (digits.length !== 11) return docNumber;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
  
  if (docType === 'cnpj') {
    if (digits.length !== 14) return docNumber;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }

  return docNumber; // Fallback
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
  const [closingDates, setClosingDates] = useState<Record<string, Date | undefined>>({});

  const activeRentalsByCustomer = useMemo(() => {
    const map: Record<string, Rental[]> = {};
    for (const customer of customers) {
      map[customer.id] = initialRentals.filter(rental => {
        // A rental is considered "active" for this view if it belongs to the customer AND
        // it's not fully finalized (either items not returned OR payment is not 'paid').
        const isNotFinalized = !rental.actualReturnDate || rental.paymentStatus !== 'paid';
        return rental.customerId === customer.id && isNotFinalized;
      }).sort((a,b) => parseISO(a.rentalStartDate).getTime() - parseISO(b.rentalStartDate).getTime());
    }
    return map;
  }, [customers, initialRentals]);

  // Calcula estatísticas históricas por cliente
  const allTimeStatsByCustomer = useMemo(() => {
    const map: Record<string, { count: number; totalPaid: number }> = {};
    for (const customer of customers) {
      const customerRentals = initialRentals.filter(r => r.customerId === customer.id);
      const totalPaid = customerRentals.reduce((sum, rental) => {
        const rentalPaid = rental.payments?.reduce((pSum, p) => pSum + p.amount, 0) ?? 0;
        return sum + rentalPaid;
      }, 0);
      map[customer.id] = {
        count: customerRentals.length,
        totalPaid: totalPaid
      };
    }
    return map;
  }, [customers, initialRentals]);
  
  const handleRentalSelection = (customerId: string, rentalId: number) => {
    setSelectedRentals(prev => {
      const currentSelection = prev[customerId] || [];
      const newSelection = currentSelection.includes(rentalId)
        ? currentSelection.filter(id => id !== rentalId)
        : [...currentSelection, rentalId];
      
      if (newSelection.length === 0) {
        setClosingDates(currentDates => {
          const newDates = {...currentDates};
          delete newDates[customerId];
          return newDates;
        });
      }

      return { ...prev, [customerId]: newSelection };
    });
  };

  const handleSelectAllPayable = (customerId: string) => {
    // Selects only rentals that have a pending payment status from the active ones
    const payableIds = (activeRentalsByCustomer[customerId] || [])
      .filter(r => (r.paymentStatus === 'pending' || r.paymentStatus === 'overdue'))
      .map(r => r.id);
    setSelectedRentals(prev => ({ ...prev, [customerId]: payableIds }));
  };

  const handleClearSelection = (customerId: string) => {
    setSelectedRentals(prev => ({ ...prev, [customerId]: [] }));
    setClosingDates(currentDates => {
        const newDates = {...currentDates};
        delete newDates[customerId];
        return newDates;
    });
  };


  const handleDateChange = (customerId: string, date: Date | undefined) => {
    setClosingDates(prev => ({ ...prev, [customerId]: date }));
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
            const customerActiveRentals = activeRentalsByCustomer[customer.id] || [];
            const stats = allTimeStatsByCustomer[customer.id] || { count: 0, totalPaid: 0 };
            const customerSelectedRentals = selectedRentals[customer.id] || [];
            const hasOpenEndedSelected = customerSelectedRentals.some(id => 
                activeRentalsByCustomer[customer.id]?.find(r => r.id === id)?.isOpenEnded
            );
            const closeUntilDate = closingDates[customer.id];
            
            return (
            <Card key={customer.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-grow min-w-0">
                        <CardTitle className="text-lg font-headline truncate" title={customer.name}>
                            {customer.name}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                            <div className="flex items-center">
                                <Phone className="h-3 w-3 mr-1.5 text-muted-foreground" /> {customer.phone}
                            </div>
                            <div className="flex items-center">
                                <Fingerprint className="h-3 w-3 mr-1.5 text-muted-foreground" />
                                <span className="font-semibold uppercase">{customer.documentType || 'CPF'}:&nbsp;</span>
                                <span className={cn(!customer.documentNumber && "text-destructive font-semibold")}>
                                    {formatDocument(customer.documentType, customer.documentNumber)}
                                </span>
                            </div>
                        </div>
                    </div>
                     <Dialog>
                        <DialogTrigger asChild>
                             <div className="w-16 h-16 relative rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 border cursor-pointer group">
                                {customer.imageUrl ? (
                                    <Image
                                    src={customer.imageUrl}
                                    alt={`Foto de ${customer.name}`}
                                    layout="fill"
                                    objectFit="cover"
                                    className="p-0.5 group-hover:scale-110 transition-transform duration-300"
                                    data-ai-hint="person portrait"
                                    />
                                ) : (
                                    <User className="w-8 h-8 text-muted-foreground opacity-50" data-ai-hint="person portrait"/>
                                )}
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="sr-only">Foto de ${'customer.name'}</DialogTitle>
                            </DialogHeader>
                            <div className="relative w-full aspect-square">
                                 <Image
                                    src={customer.imageUrl || '/placeholder.png'}
                                    alt={`Foto de ${customer.name}`}
                                    layout="fill"
                                    objectFit="contain"
                                    className="rounded-md"
                                />
                            </div>
                        </DialogContent>
                     </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm flex-grow">
                 {/* Estatísticas Históricas */}
                 <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="flex flex-col p-2 bg-muted/40 rounded-md border border-border/50">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center mb-1">
                            <ScrollText className="h-2.5 w-2.5 mr-1 text-primary" /> Aluguéis
                        </span>
                        <span className="text-sm font-bold text-foreground leading-none">{stats.count}</span>
                    </div>
                    <div className="flex flex-col p-2 bg-muted/40 rounded-md border border-border/50">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center mb-1">
                            <DollarSign className="h-2.5 w-2.5 mr-1 text-green-600" /> Total Pago
                        </span>
                        <span className="text-sm font-bold text-green-700 leading-none">{formatToBRL(stats.totalPaid)}</span>
                    </div>
                </div>

                 <div className="flex items-start">
                    <Home className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    {customer.address ? (
                        <span className="text-muted-foreground text-xs whitespace-pre-wrap">{customer.address}</span>
                    ) : (
                        <span className="text-destructive font-semibold text-xs">Não Informado</span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={customer.responsiveness === 'very responsive' || customer.responsiveness === 'responsive' ? 'default' : 'secondary'} className="whitespace-nowrap text-[10px] py-0 px-1.5">
                        <UsersRound className="h-3 w-3 mr-1"/> {responsivenessMap[customer.responsiveness]}
                    </Badge>
                    <Badge variant={customer.rentalHistory === 'always on time' ? 'default' : customer.rentalHistory === 'sometimes late' ? 'secondary' : 'destructive'} className="whitespace-nowrap text-[10px] py-0 px-1.5">
                       <History className="h-3 w-3 mr-1"/> {rentalHistoryMap[customer.rentalHistory]}
                    </Badge>
                </div>
                
                {customerActiveRentals.length > 0 && (
                    <div className="pt-2">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="rentals" className="border-t">
                                <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2">
                                    {customerActiveRentals.length} Contrato(s) Ativo(s)
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 space-y-2">
                                    <div className="flex gap-2 mb-2">
                                        <Button variant="outline" size="sm" onClick={() => handleSelectAllPayable(customer.id)} disabled={customerActiveRentals.filter(r => r.paymentStatus !== 'paid').length === 0}>
                                            <ListChecks className="mr-2 h-4 w-4"/>
                                            Sel. Pendentes
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleClearSelection(customer.id)} disabled={customerSelectedRentals.length === 0}>
                                             <Eraser className="mr-2 h-4 w-4"/>
                                            Limpar
                                        </Button>
                                    </div>
                                    {customerActiveRentals.map(rental => (
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
                                                    <Badge variant={getPaymentStatusVariant(rental.paymentStatus)} className="capitalize text-[10px]">
                                                        {paymentStatusMap[rental.paymentStatus]}
                                                    </Badge>
                                                </div>
                                            </label>
                                        </div>
                                    ))}
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
                    <div className="pt-2 border-t space-y-2">
                        {hasOpenEndedSelected && (
                             <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !closeUntilDate && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {closeUntilDate ? format(closeUntilDate, "PPP", { locale: ptBR }) : <span>Fechar em aberto até...</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={closeUntilDate}
                                    onSelect={(date) => handleDateChange(customer.id, date)}
                                    initialFocus
                                  />
                                </PopoverContent>
                            </Popover>
                        )}
                        <Button asChild className="w-full">
                            <Link href={`/dashboard/customers/${customer.id}/consolidated-receipt?rental_ids=${customerSelectedRentals.join(',')}${closeUntilDate ? `&close_until=${format(closeUntilDate, 'yyyy-MM-dd')}`: ''}`}>
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
