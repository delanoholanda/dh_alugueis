
'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Filter, RotateCcw, PackageX } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

import type { Rental, PaymentStatus } from '@/types';
import { formatToBRL, getPaymentStatusVariant, paymentStatusMap, countBillableDays } from '@/lib/utils';

type PaymentStatusFilter = 'all' | PaymentStatus;

export default function ContractsClientPage({ initialRentals }: { initialRentals: Rental[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatusFilter>('all');

  const filteredRentals = useMemo(() => {
    let rentals = [...initialRentals];

    // Filter by search term
    if (searchTerm) {
      rentals = rentals.filter(r =>
        r.id.toString().includes(searchTerm) ||
        r.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by payment status
    if (paymentFilter !== 'all') {
      rentals = rentals.filter(r => r.paymentStatus === paymentFilter);
    }

    return rentals;
  }, [initialRentals, searchTerm, paymentFilter]);

  const resetFilters = () => {
    setSearchTerm('');
    setPaymentFilter('all');
  };

  const calculateItemsSubtotal = (rental: Rental): number => {
     if (rental.isOpenEnded && !rental.actualReturnDate) {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const billableDays = countBillableDays(rental.rentalStartDate, todayStr, rental.chargeSaturdays ?? true, rental.chargeSundays ?? true);
        return rental.equipment.reduce((sum, eq) => {
            const dailyRate = eq.customDailyRentalRate ?? 0; 
            return sum + (dailyRate * eq.quantity * billableDays);
        }, 0);
    }
    return rental.equipment.reduce((sum, eq) => {
      const dailyRate = eq.customDailyRentalRate ?? 0;
      return sum + (dailyRate * eq.quantity * (rental.rentalDays || 0));
    }, 0);
  };
  
  const getProjectedValue = (rental: Rental) => {
      if (!rental.isOpenEnded || rental.actualReturnDate) {
          return rental.value;
      }
      const itemsProjectedValue = calculateItemsSubtotal(rental);
      return (itemsProjectedValue) + (rental.freightValue ?? 0) + (rental.fuelValue ?? 0) - (rental.discountValue ?? 0);
  }
  
  const totals = useMemo(() => {
    return filteredRentals.reduce(
      (acc, rental) => {
        const totalPaid = rental.payments?.reduce((pSum, p) => pSum + p.amount, 0) ?? 0;
        const itemsSubtotal = calculateItemsSubtotal(rental);
        const contractValue = getProjectedValue(rental);
        const pendingValue = contractValue - totalPaid;

        acc.itemsSubtotal += itemsSubtotal;
        acc.freightValue += rental.freightValue ?? 0;
        acc.contractValue += contractValue;
        acc.totalPaid += totalPaid;
        acc.pendingValue += pendingValue;
        
        return acc;
      },
      {
        itemsSubtotal: 0,
        freightValue: 0,
        contractValue: 0,
        totalPaid: 0,
        pendingValue: 0,
      }
    );
  }, [filteredRentals]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" /> Filtros e Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Buscar por ID do contrato ou nome do cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:max-w-sm"
          />
          <Select value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as PaymentStatusFilter)}>
            <SelectTrigger className="md:w-[180px]">
              <SelectValue placeholder="Status do Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="overdue">Atrasado</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={resetFilters} variant="outline" className="md:ml-auto">
            <RotateCcw className="mr-2 h-4 w-4" /> Limpar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Contratos</CardTitle>
          <CardDescription>
            Exibindo {filteredRentals.length} de {initialRentals.length} contratos. Contratos "em aberto" têm o valor projetado para hoje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status Pag.</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Frete</TableHead>
                  <TableHead className="text-right">Total Contrato</TableHead>
                  <TableHead className="text-right">Pago / Pendente</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRentals.length > 0 ? (
                  filteredRentals.map((rental) => {
                    const totalPaid = rental.payments?.reduce((acc, p) => acc + p.amount, 0) ?? 0;
                    const itemsSubtotal = calculateItemsSubtotal(rental);
                    const contractValue = getProjectedValue(rental);
                    const pendingValue = contractValue - totalPaid;

                    return (
                      <TableRow key={rental.id}>
                        <TableCell className="font-mono">#{String(rental.id).padStart(4, '0')}</TableCell>
                        <TableCell className="font-medium">{rental.customerName}</TableCell>
                        <TableCell>
                          <Badge variant={getPaymentStatusVariant(rental.paymentStatus)}>
                            {paymentStatusMap[rental.paymentStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatToBRL(itemsSubtotal)}</TableCell>
                        <TableCell className="text-right font-mono">{formatToBRL(rental.freightValue ?? 0)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatToBRL(contractValue)}</TableCell>
                        <TableCell className="text-right font-mono">
                          <p className="text-green-600">{formatToBRL(totalPaid)}</p>
                          <p className="text-red-600">-{formatToBRL(pendingValue)}</p>
                        </TableCell>
                        <TableCell className="text-center">
                           <Button asChild variant="ghost" size="icon" title="Ver detalhes do aluguel">
                                <Link href={`/dashboard/rentals/${rental.id}/details`}>
                                    <Eye className="h-4 w-4" />
                                </Link>
                            </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <PackageX className="h-8 w-8" />
                        Nenhum contrato encontrado.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right font-mono">{formatToBRL(totals.itemsSubtotal)}</TableCell>
                    <TableCell className="text-right font-mono">{formatToBRL(totals.freightValue)}</TableCell>
                    <TableCell className="text-right font-mono">{formatToBRL(totals.contractValue)}</TableCell>
                    <TableCell className="text-right font-mono">
                         <p className="text-green-600">{formatToBRL(totals.totalPaid)}</p>
                         <p className="text-red-600">-{formatToBRL(totals.pendingValue)}</p>
                    </TableCell>
                    <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
