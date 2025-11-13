
'use client';

import type { Rental, Equipment as InventoryEquipment, Customer } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isToday, isPast, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL, getPaymentStatusVariant, paymentStatusMap, cn, countBillableDays } from '@/lib/utils';
import { RentalTableActions } from './RentalTableActions';
import { CircleAlert, Infinity as InfinityIcon, ChevronDown, Package, HandCoins } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface RentalTableProps {
  rentals: Rental[];
  inventory: InventoryEquipment[];
  customers: Customer[];
  onActionSuccess: () => Promise<void>;
}

export function RentalTable({ rentals, inventory, customers, onActionSuccess }: RentalTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const toggleRow = (rentalId: number) => {
    setExpandedRow(prev => (prev === rentalId ? null : rentalId));
  };

  const getFirstName = (fullName?: string) => {
    if (!fullName) return '';
    return fullName.split(' ')[0];
  };
  
  const getDailyIncome = (rental: Rental) => {
    if (rental.isOpenEnded) {
        return rental.value; // For open-ended, the value IS the daily rate
    }
    let dailyRevenue = 0;
    rental.equipment.forEach(eqEntry => {
        const inventoryItem = inventory.find(inv => inv.id === eqEntry.equipmentId);
        let rateToUse = eqEntry.customDailyRentalRate;
        if (rateToUse === undefined || rateToUse === null) {
            rateToUse = inventoryItem?.dailyRentalRate ?? 0;
        }
        dailyRevenue += (rateToUse * eqEntry.quantity);
    });
    return dailyRevenue;
  };

  const getStatusInfo = (rental: Rental) => {
      const isPhysicallyReturned = !!rental.actualReturnDate;
      const isPaymentPending = rental.paymentStatus === 'pending' || rental.paymentStatus === 'overdue';

      if (isPhysicallyReturned && isPaymentPending) {
        return { 
            badge: <Badge variant="secondary" className="border-orange-500/50 text-xs whitespace-nowrap ml-2"><HandCoins className="h-3 w-3 mr-1"/>Aguard. Pagamento</Badge>,
            dateClass: 'text-muted-foreground', 
            suffix: '' 
        };
      }
      
      if (isPhysicallyReturned) return { badge: null, dateClass: '', suffix: '' };

      if(rental.isOpenEnded) {
          return {
              badge: <Badge variant="secondary" className="border-blue-500/50 text-xs whitespace-nowrap ml-2"><InfinityIcon className="h-3 w-3 mr-1"/>Em Aberto</Badge>,
              dateClass: 'text-blue-500',
              suffix: ''
          }
      }

      const expectedReturnDateObj = parseISO(rental.expectedReturnDate);
      const today = startOfDay(new Date());

      if (isPast(expectedReturnDateObj) && !isToday(expectedReturnDateObj)) {
        return { 
            badge: <Badge variant="destructive" className="text-xs whitespace-nowrap ml-2"><CircleAlert className="h-3 w-3 mr-1"/>Atrasado</Badge>,
            dateClass: 'text-destructive font-semibold', 
            suffix: ' (Atrasado)' 
        };
      }
      if (isToday(expectedReturnDateObj)) {
        return { 
            badge: null,
            dateClass: 'text-orange-500 dark:text-orange-400 font-semibold', 
            suffix: ' (Hoje)' 
        };
      }

      return { badge: null, dateClass: '', suffix: '' };
  };

  const getValueDisplay = (rental: Rental) => {
      if (rental.isOpenEnded && !rental.actualReturnDate) {
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const billableDays = countBillableDays(
              rental.rentalStartDate,
              todayStr,
              rental.chargeSaturdays ?? true,
              rental.chargeSundays ?? true
          );
          // For open-ended, rental.value is the daily rate.
          const accumulatedValue = billableDays * getDailyIncome(rental);
          return (
            <div className="text-right">
              <span className="font-mono">{formatToBRL(accumulatedValue)}</span>
              <p className="text-[10px] text-muted-foreground -mt-1">Acumulado</p>
            </div>
          );
      }
      return <span className="font-mono">{formatToBRL(rental.value)}</span>;
  }
  
  const getDaysDisplay = (rental: Rental) => {
    if (rental.isOpenEnded) {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const billableDays = countBillableDays(
            rental.rentalStartDate,
            todayStr,
            rental.chargeSaturdays ?? true,
            rental.chargeSundays ?? true
        );
        return (
            <div className="text-center">
                <span className="font-semibold">{billableDays}</span>
                <p className="text-[10px] text-muted-foreground -mt-1">(Corridos)</p>
            </div>
        );
    }
    return <span className="font-semibold">{rental.rentalDays}</span>
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Retorno Prev.</TableHead>
                <TableHead className="text-center">Duração</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Renda/Dia</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentals.map((rental) => {
                const customer = customers.find(c => c.id === rental.customerId);
                const { badge, dateClass, suffix } = getStatusInfo(rental);
                const isExpanded = expandedRow === rental.id;
                return (
                  <React.Fragment key={rental.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggleRow(rental.id)}>
                      <TableCell className="p-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={customer?.imageUrl || undefined} alt={customer?.name} />
                            <AvatarFallback>{customer ? getFirstName(customer.name).charAt(0) : 'C'}</AvatarFallback>
                          </Avatar>
                          <div className="flex items-center">
                              <span className="font-medium truncate">{getFirstName(rental.customerName)}</span>
                              {badge}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{format(parseISO(rental.rentalStartDate), 'dd/MM/yy')}</TableCell>
                      <TableCell className={cn(dateClass)}>
                          {rental.isOpenEnded ? <span className="text-blue-500">Em Aberto</span> : format(parseISO(rental.expectedReturnDate), 'dd/MM/yy')}
                          {suffix}
                      </TableCell>
                      <TableCell className="text-center">{getDaysDisplay(rental)}</TableCell>
                      <TableCell className="text-right">{getValueDisplay(rental)}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{formatToBRL(getDailyIncome(rental))}</TableCell>
                      <TableCell className="text-center">{rental.equipment.reduce((acc, eq) => acc + eq.quantity, 0)}</TableCell>
                      <TableCell>
                        <Badge variant={getPaymentStatusVariant(rental.paymentStatus)}>
                          {paymentStatusMap[rental.paymentStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                         <RentalTableActions rental={rental} inventory={inventory} onActionSuccess={onActionSuccess} />
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                        <TableRow>
                            <TableCell colSpan={10} className="p-0">
                                <div className="bg-muted/50 p-4">
                                    <h4 className="font-semibold text-sm mb-2 flex items-center"><Package className="h-4 w-4 mr-2" /> Itens do Aluguel</h4>
                                    <ul className="list-disc list-inside space-y-1 pl-4 text-sm text-muted-foreground">
                                        {rental.equipment.map((eq, index) => <li key={index}>{eq.quantity}x {eq.name}</li>)}
                                    </ul>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
