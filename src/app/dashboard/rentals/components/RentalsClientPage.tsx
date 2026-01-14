

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getRentals as fetchRentalsAction } from '@/actions/rentalActions';
import { getInventoryItems as fetchInventoryItemsAction } from '@/actions/inventoryActions';
import { getCustomers as fetchCustomersAction } from '@/actions/customerActions';
import type { Rental, Equipment as InventoryEquipment, PaymentStatus, Customer } from '@/types';
import { Filter, RotateCcw, PackageX, LayoutGrid, List, FileText, Eraser, Calendar as CalendarIcon, ListChecks } from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RentalCard } from './RentalCard';
import { RentalTable } from './RentalTable';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, countBillableDays, formatToBRL } from '@/lib/utils';


type RentalStatusFilter = 'all' | 'active' | 'finalized';
type PaymentStatusFilterType = 'all' | PaymentStatus;
type ViewMode = 'cards' | 'table';

interface GroupedRentals {
  customer: Customer;
  rentals: Rental[];
  totalValue: number;
}


interface RentalsClientPageProps {
  initialRentals: Rental[];
  initialInventory: InventoryEquipment[];
  initialCustomers: Customer[];
}

export default function RentalsClientPage({ initialRentals, initialInventory, initialCustomers }: RentalsClientPageProps) {
  const [allRentals, setAllRentals] = useState<Rental[]>(initialRentals);
  const [inventoryItems, setInventoryItems] = useState<InventoryEquipment[]>(initialInventory);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [filteredRentals, setFilteredRentals] = useState<Rental[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [rentalStatusFilter, setRentalStatusFilter] = useState<RentalStatusFilter>('active');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  
  const [selectedRentals, setSelectedRentals] = useState<Record<string, number[]>>({});
  const [closingDates, setClosingDates] = useState<Record<string, Date | undefined>>({});

  const handleRentalSelection = (customerId: string, rentalId: number) => {
    setSelectedRentals(prev => {
      const currentSelection = prev[customerId] || [];
      const newSelection = currentSelection.includes(rentalId)
        ? currentSelection.filter(id => id !== rentalId)
        : [...currentSelection, rentalId];
      
      // If selection is cleared, also clear the date for that customer
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

  const handleSelectAllPayable = (customerId: string, payableIds: number[]) => {
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


  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rentalsData, inventoryData, customersData] = await Promise.all([
        fetchRentalsAction(),
        fetchInventoryItemsAction(),
        fetchCustomersAction()
      ]);
      setAllRentals(rentalsData);
      setInventoryItems(inventoryData);
      setCustomers(customersData);
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let currentFiltered = [...allRentals];

    if (searchTerm) {
      currentFiltered = currentFiltered.filter(rental =>
        rental.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rental.id.toString().includes(searchTerm)
      );
    }

    if (rentalStatusFilter !== 'all') {
      currentFiltered = currentFiltered.filter(rental => {
        const isFullyFinalized = !!rental.actualReturnDate && rental.paymentStatus === 'paid';
        if (rentalStatusFilter === 'active') return !isFullyFinalized;
        if (rentalStatusFilter === 'finalized') return isFullyFinalized;
        return true;
      });
    }

    if (paymentStatusFilter !== 'all') {
      currentFiltered = currentFiltered.filter(rental => rental.paymentStatus === paymentStatusFilter);
    }
    
    currentFiltered.sort((a, b) => {
        const isFullyFinalized = (rental: Rental) => !!rental.actualReturnDate && rental.paymentStatus === 'paid';

        const finalA = isFullyFinalized(a);
        const finalB = isFullyFinalized(b);

        if (finalA !== finalB) {
            return finalA ? 1 : -1;
        }
        
        if (finalA && finalB && b.actualReturnDate && a.actualReturnDate) {
            return parseISO(b.actualReturnDate).getTime() - parseISO(a.actualReturnDate).getTime();
        }

        const getPriorityScore = (rental: Rental) => {
            if (!!rental.actualReturnDate && rental.paymentStatus !== 'paid') return 6;
            if (!rental.actualReturnDate && !rental.isOpenEnded && isPast(parseISO(rental.expectedReturnDate)) && !isToday(parseISO(rental.expectedReturnDate))) return 1;
            if (!rental.actualReturnDate && !rental.isOpenEnded && isToday(parseISO(rental.expectedReturnDate))) return 2;
            if (rental.isOpenEnded && !rental.actualReturnDate) return 3; 
            return 4;
        };

        const scoreA = getPriorityScore(a);
        const scoreB = getPriorityScore(b);

        if (scoreA !== scoreB) {
            return scoreA - scoreB;
        }

        if (scoreA === 1 || scoreA === 2) {
            return parseISO(a.expectedReturnDate).getTime() - parseISO(b.expectedReturnDate).getTime();
        }
        return parseISO(b.rentalStartDate).getTime() - parseISO(a.rentalStartDate).getTime();
    });


    setFilteredRentals(currentFiltered);
  }, [searchTerm, rentalStatusFilter, paymentStatusFilter, allRentals]);

  const resetFilters = () => {
    setSearchTerm('');
    setRentalStatusFilter('active');
    setPaymentStatusFilter('all');
  };
  
   const groupedRentals = useMemo((): GroupedRentals[] => {
    if (viewMode !== 'cards') return [];

    const customerMap = new Map<string, { customer: Customer; rentals: Rental[]; totalValue: number }>();

    for (const rental of filteredRentals) {
        const customer = customers.find(c => c.id === rental.customerId);
        if (!customer) continue;

        if (!customerMap.has(customer.id)) {
            customerMap.set(customer.id, { customer, rentals: [], totalValue: 0 });
        }
        
        const group = customerMap.get(customer.id)!;
        group.rentals.push(rental);

        if (rental.isOpenEnded && !rental.actualReturnDate) {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const billableDays = countBillableDays(rental.rentalStartDate, todayStr, rental.chargeSaturdays ?? true, rental.chargeSundays ?? true);
            const dailyRate = rental.value; // For open-ended, value is daily rate
            group.totalValue += (billableDays * dailyRate) + (rental.freightValue ?? 0) - (rental.discountValue ?? 0);
        } else {
            group.totalValue += rental.value;
        }
    }
    
    return Array.from(customerMap.values()).sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  }, [filteredRentals, customers, viewMode]);

  return (
    <>
      <Card className="mb-6 shadow-md">
        <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="text-lg flex items-center"><Filter className="mr-2 h-5 w-5 text-primary"/> Filtros e Visualização</CardTitle>
                 <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(value: string) => { if (value) setViewMode(value as ViewMode)}}
                    aria-label="Visualização"
                    >
                    <ToggleGroupItem value="cards" aria-label="Visualizar em cards">
                        <LayoutGrid className="h-4 w-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="table" aria-label="Visualizar em tabela">
                        <List className="h-4 w-4" />
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
                <label htmlFor="search-customer" className="text-sm font-medium text-muted-foreground">ID ou Cliente</label>
                <Input
                id="search-customer"
                placeholder="Buscar por ID ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="space-y-1">
                <label htmlFor="filter-rental-status" className="text-sm font-medium text-muted-foreground">Status do Aluguel</label>
                <Select value={rentalStatusFilter} onValueChange={(value) => setRentalStatusFilter(value as RentalStatusFilter)}>
                <SelectTrigger id="filter-rental-status">
                    <SelectValue placeholder="Status do Aluguel" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos (Não Finalizados)</SelectItem>
                    <SelectItem value="finalized">Finalizados</SelectItem>
                </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <label htmlFor="filter-payment-status" className="text-sm font-medium text-muted-foreground">Status do Pagamento</label>
                <Select value={paymentStatusFilter} onValueChange={(value) => setPaymentStatusFilter(value as PaymentStatusFilterType)}>
                <SelectTrigger id="filter-payment-status">
                    <SelectValue placeholder="Status do Pagamento" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Atrasado</SelectItem>
                </SelectContent>
                </Select>
            </div>
            <Button onClick={resetFilters} variant="outline" className="self-end">
                <RotateCcw className="mr-2 h-4 w-4" /> Limpar Filtros
            </Button>
        </CardContent>
      </Card>

      <div className="mb-4 text-sm text-muted-foreground">
          Exibindo {filteredRentals.length} de {allRentals.length} aluguéis.
      </div>
      
      {viewMode === 'cards' && (
        <>
            {filteredRentals.length > 0 ? (
                <Accordion type="multiple" className="w-full space-y-4">
                  {groupedRentals.map(({ customer, rentals: customerRentals, totalValue }) => {
                    const customerSelectedRentals = selectedRentals[customer.id] || [];
                    const hasOpenEndedSelected = customerSelectedRentals.some(id => customerRentals.find(r => r.id === id)?.isOpenEnded);
                    const closeUntilDate = closingDates[customer.id];
                    const payableRentalIds = customerRentals.filter(r => r.paymentStatus === 'pending' || r.paymentStatus === 'overdue').map(r => r.id);

                    return (
                        <AccordionItem value={`customer-${customer.id}`} key={customer.id} className="border-none">
                        <AccordionTrigger className="p-3 w-full hover:no-underline border rounded-lg bg-card shadow-md data-[state=open]:rounded-b-none data-[state=open]:border-b-0 data-[state=open]:shadow-lg">
                            <div className="flex justify-between items-center w-full">
                                <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={customer.imageUrl || undefined} alt={customer.name} />
                                    <AvatarFallback>{customer.name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold text-left">{customer.name}</p>
                                    <p className="text-xs text-muted-foreground text-left">{customerRentals.length} contrato(s) filtrado(s)</p>
                                </div>
                                </div>
                                <div className="hidden sm:block text-right">
                                    <p className="text-xs text-muted-foreground">Valor Total em Aberto</p>
                                    <p className="font-bold text-primary text-lg">{formatToBRL(totalValue)}</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="border border-t-0 rounded-b-lg p-4 bg-card">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {customerRentals.map((rental) => (
                                    <div key={rental.id} className="relative group">
                                        <div className="absolute top-2 left-2 z-10">
                                            <Checkbox
                                                id={`rental-select-${rental.id}`}
                                                checked={customerSelectedRentals.includes(rental.id)}
                                                onCheckedChange={() => handleRentalSelection(customer.id, rental.id)}
                                                className="bg-background/80"
                                            />
                                        </div>
                                        <RentalCard rental={rental} inventory={inventoryItems} customers={customers} onActionSuccess={refreshData} />
                                    </div>
                                ))}
                                </div>
                                {(customerSelectedRentals.length > 0 || payableRentalIds.length > 0) && (
                                    <div className="pt-4 border-t space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => handleSelectAllPayable(customer.id, payableRentalIds)} disabled={payableRentalIds.length === 0}>
                                                <ListChecks className="mr-2 h-4 w-4"/> Sel. Pendentes ({payableRentalIds.length})
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => handleClearSelection(customer.id)} disabled={customerSelectedRentals.length === 0}>
                                                <Eraser className="mr-2 h-4 w-4"/> Limpar Seleção ({customerSelectedRentals.length})
                                            </Button>
                                        </div>

                                        {customerSelectedRentals.length > 0 && (
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                                                {hasOpenEndedSelected && (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn("w-full sm:w-auto justify-start text-left font-normal", !closeUntilDate && "text-muted-foreground")}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {closeUntilDate ? format(closeUntilDate, "PPP", { locale: ptBR }) : <span>Fechar em aberto até...</span>}
                                                        </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0">
                                                        <Calendar mode="single" selected={closeUntilDate} onSelect={(date) => handleDateChange(customer.id, date)} initialFocus />
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                                <Button asChild className="w-full sm:w-auto">
                                                    <Link href={`/dashboard/customers/${customer.id}/consolidated-receipt?rental_ids=${customerSelectedRentals.join(',')}${closeUntilDate ? `&close_until=${format(closeUntilDate, 'yyyy-MM-dd')}`: ''}`}>
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        Gerar Contrato Consolidado
                                                    </Link>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                        </AccordionItem>
                    );
                })}
                </Accordion>
            ) : (
                <Card className="shadow-lg col-span-full">
                    <CardContent className="py-12 text-center">
                        <PackageX className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum aluguel encontrado.</h3>
                        <p className="text-muted-foreground">
                        {allRentals.length === 0 
                            ? "Nenhum aluguel foi registrado ainda. Adicione um novo aluguel para começar." 
                            : "Tente ajustar os filtros ou adicione um novo contrato de aluguel."}
                        </p>
                        {allRentals.length > 0 && (
                            <Button onClick={resetFilters} variant="outline" className="mt-4">
                                <RotateCcw className="mr-2 h-4 w-4" /> Limpar Filtros
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}
        </>
      )}

      {viewMode === 'table' && (
         <RentalTable 
            rentals={filteredRentals} 
            inventory={inventoryItems} 
            customers={customers} 
            onActionSuccess={refreshData}
         />
      )}

    </>
  );
}
