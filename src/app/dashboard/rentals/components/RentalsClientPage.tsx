
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getRentals as fetchRentalsAction } from '@/actions/rentalActions';
import { getInventoryItems as fetchInventoryItemsAction } from '@/actions/inventoryActions';
import { getCustomers as fetchCustomersAction } from '@/actions/customerActions';
import type { Rental, Equipment as InventoryEquipment, PaymentStatus, Customer } from '@/types';
import { Filter, RotateCcw, PackageX } from 'lucide-react';
import { parseISO, isPast, isToday } from 'date-fns';
import { RentalCard } from './RentalCard';

type RentalStatusFilter = 'all' | 'active' | 'finalized';
type PaymentStatusFilterType = 'all' | PaymentStatus;

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
  const [isLoading, setIsLoading] = useState(false); // Used for refresh, not initial load.

  const [searchTerm, setSearchTerm] = useState('');
  const [rentalStatusFilter, setRentalStatusFilter] = useState<RentalStatusFilter>('active');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilterType>('all');

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
            return finalA ? 1 : -1; // Finalized items go to the bottom
        }
        
        // If both are finalized, sort by return date (most recent first)
        if (finalA && finalB) {
            return parseISO(b.actualReturnDate!).getTime() - parseISO(a.actualReturnDate!).getTime();
        }

        // --- Both are active/pending attention ---
        const getPriorityScore = (rental: Rental) => {
            if (!rental.actualReturnDate && !rental.isOpenEnded && isPast(parseISO(rental.expectedReturnDate)) && !isToday(parseISO(rental.expectedReturnDate))) return 1; // Overdue
            if (!!rental.actualReturnDate && rental.paymentStatus !== 'paid') return 2; // Returned, pending payment
            if (!rental.actualReturnDate && !rental.isOpenEnded && isToday(parseISO(rental.expectedReturnDate))) return 3; // Due today
            if (rental.isOpenEnded && !rental.actualReturnDate) return 4; // Open-ended
            return 5; // Other active
        };

        const scoreA = getPriorityScore(a);
        const scoreB = getPriorityScore(b);

        if (scoreA !== scoreB) {
            return scoreA - scoreB;
        }

        // Fallback sort for items with the same priority
        if (scoreA === 1 || scoreA === 3) {
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
  
  return (
    <>
      <Card className="mb-6 shadow-md">
        <CardHeader>
            <CardTitle className="text-lg flex items-center"><Filter className="mr-2 h-5 w-5 text-primary"/> Filtros</CardTitle>
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
                    <SelectItem value="active">Ativos</SelectItem>
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

      {filteredRentals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRentals.map((rental) => (
            <RentalCard key={rental.id} rental={rental} inventory={inventoryItems} customers={customers} onActionSuccess={refreshData} />
          ))}
        </div>
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
  );
}
