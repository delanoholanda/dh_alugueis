
'use client';

import type { Rental, Equipment as InventoryEquipment, Customer } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RentalTableActions } from './RentalTableActions';
import { format, parseISO, isToday, isPast, startOfDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL, cn, countBillableDays, getPaymentStatusVariant, paymentStatusMap } from '@/lib/utils';
import { CalendarDays, DollarSign, Package, CircleAlert, CircleCheck, TrendingUp, Infinity as InfinityIcon, HandCoins } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState } from 'react';
import { MarkAsPaidDialog } from './MarkAsPaidDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface RentalCardProps {
  rental: Rental;
  inventory: InventoryEquipment[];
  customers: Customer[];
  onActionSuccess: () => Promise<void>;
}

export function RentalCard({ rental, inventory, customers, onActionSuccess }: RentalCardProps) {
  const [isPaidDialogOpen, setIsPaidDialogOpen] = useState(false);

  const expectedReturnDateObj = parseISO(rental.expectedReturnDate);
  const today = startOfDay(new Date());
  let returnDateColorClass = 'text-muted-foreground';
  let returnDateSuffix = '';

  const customer = customers.find((c) => c.id === rental.customerId);
  
  const isPhysicallyReturned = !!rental.actualReturnDate;
  const isPaid = rental.paymentStatus === 'paid';
  const isFullyFinalized = isPhysicallyReturned && isPaid;

  const isPaymentPending = rental.paymentStatus === 'pending' || rental.paymentStatus === 'overdue';

  if (!isPhysicallyReturned && !rental.isOpenEnded) {
    if (isPast(expectedReturnDateObj) && !isToday(expectedReturnDateObj)) {
      returnDateColorClass = 'text-destructive font-semibold';
      returnDateSuffix = ' (Atrasado)';
    } else if (isToday(expectedReturnDateObj)) {
      returnDateColorClass = 'text-orange-500 dark:text-orange-400 font-semibold';
      returnDateSuffix = ' (Devolve Hoje)';
    }
  }

  const isPayable = isPaymentPending && !rental.isOpenEnded;

  let cardBorderColor = 'border-border';
  if (isFullyFinalized) {
    cardBorderColor = 'border-green-500/30';
  } else if (isPhysicallyReturned && isPaymentPending) {
    cardBorderColor = 'border-orange-500/40';
  } else if (rental.isOpenEnded && !isPhysicallyReturned) {
    cardBorderColor = 'border-blue-500/30';
  } else if (returnDateSuffix.includes('Atrasado')) {
    cardBorderColor = 'border-destructive/30';
  } else if (returnDateSuffix.includes('Hoje')) {
    cardBorderColor = 'border-orange-500/30';
  }
  
  let dailyRevenue = 0;
  if (!isFullyFinalized) {
    if (rental.isOpenEnded) {
        dailyRevenue = rental.value; // In open-ended, the value IS the daily rate
    } else {
        rental.equipment.forEach(eqEntry => {
            const inventoryItem = inventory.find(inv => inv.id === eqEntry.equipmentId);
            let rateToUse = eqEntry.customDailyRentalRate;
            if (rateToUse === undefined || rateToUse === null) {
                rateToUse = inventoryItem?.dailyRentalRate ?? 0;
            }
            dailyRevenue += (rateToUse * eqEntry.quantity);
        });
    }
  }

  let currentAccumulated = 0;
  if (rental.isOpenEnded && !isPhysicallyReturned) {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const billableDays = countBillableDays(
      rental.rentalStartDate,
      todayStr,
      rental.chargeSaturdays ?? true,
      rental.chargeSundays ?? true
    );
    currentAccumulated = billableDays * rental.value; // rental.value is the daily rate
  }
  
  const handleBadgeClick = () => {
    if (isPayable) {
        setIsPaidDialogOpen(true);
    }
  }

  // Corrigido: adicionado +1 para que o dia de início já conte como dia 1
  const daysDisplay = rental.isOpenEnded 
    ? `${differenceInDays(new Date(), parseISO(rental.rentalStartDate)) + 1} dias corridos` 
    : `${rental.rentalDays} dias contratados`;

  return (
    <>
      <Card className={cn("flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300", cardBorderColor)}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-3 flex-grow min-w-0">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={customer?.imageUrl || undefined} alt={customer?.name || 'Avatar do cliente'} />
                      <AvatarFallback>{customer ? customer.name.charAt(0).toUpperCase() : 'C'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                      <CardTitle className="text-lg font-headline truncate" title={rental.customerName}>
                          {rental.customerName || 'Cliente não especificado'}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                          Aluguel ID: {rental.id.toString().padStart(4, '0')}
                      </CardDescription>
                  </div>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 gap-1">
                  {isFullyFinalized && <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs whitespace-nowrap"><CircleCheck className="h-3 w-3 mr-1"/>Finalizado</Badge>}
                  {isPhysicallyReturned && isPaymentPending && <Badge variant="secondary" className="border-orange-500/50 text-xs whitespace-nowrap ml-2"><HandCoins className="h-3 w-3 mr-1"/>Aguard. Pagamento</Badge>}
                  {rental.isOpenEnded && !isPhysicallyReturned && <Badge variant="secondary" className="border-blue-500/50 text-xs whitespace-nowrap ml-2"><InfinityIcon className="h-3 w-3 mr-1"/>Em Aberto</Badge>}
                  {!isPhysicallyReturned && !rental.isOpenEnded && returnDateSuffix.includes('Atrasado') && <Badge variant="destructive" className="text-xs whitespace-nowrap"><CircleAlert className="h-3 w-3 mr-1"/>Atrasado</Badge>}
              </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm flex-grow">
          <div className="flex items-center">
            <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-muted-foreground">Início:</span>
            <span className="ml-1 font-medium">{format(parseISO(rental.rentalStartDate), 'dd/MM/yy', { locale: ptBR })}</span>
          </div>
          <div className="flex items-center">
            <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-muted-foreground">Retorno Exp.:</span>
            {rental.isOpenEnded 
             ? <span className="ml-1 font-medium text-blue-500">Em Aberto</span>
             : <span className={cn("ml-1 font-medium", returnDateColorClass)}>{format(expectedReturnDateObj, 'dd/MM/yy', { locale: ptBR })}</span>
            }
          </div>
          <div className="flex items-center">
            <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-muted-foreground">Duração:</span>
            <span className="ml-1 font-medium">{daysDisplay}</span>
          </div>

          <div className="flex items-center">
            <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-muted-foreground">{rental.isOpenEnded ? "Valor Diária:" : "Valor Contrato:"}</span>
            <span className="ml-1 font-medium">{formatToBRL(rental.value)}</span>
          </div>
          
          {rental.isOpenEnded && !isPhysicallyReturned && (
              <div className="flex items-center text-blue-600 dark:text-blue-400">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  <span className="text-muted-foreground">Acumulado (hoje):</span>
                  <span className="ml-1 font-semibold">{formatToBRL(currentAccumulated)}</span>
              </div>
          )}

          {!rental.isOpenEnded && !isFullyFinalized && dailyRevenue > 0 && (
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
              <span className="text-muted-foreground">Renda Diária Est.:</span>
              <span className="ml-1 font-medium text-green-600">{formatToBRL(dailyRevenue)}</span>
            </div>
          )}

           <div className="pt-2">
            <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider flex items-center"><Package className="h-3 w-3 mr-1" /> Itens Alugados</p>
            <div className="border rounded-md overflow-hidden bg-background/50">
                <table className="w-full text-[10px] text-left border-collapse">
                    <thead className="bg-muted/50 border-b">
                        <tr>
                            <th className="px-2 py-1 font-semibold">Item</th>
                            <th className="px-2 py-1 font-semibold text-center">Qtd</th>
                            <th className="px-2 py-1 font-semibold text-right">Diária</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rental.equipment.map((eq, i) => {
                            const inventoryItem = inventory.find(inv => inv.id === eq.equipmentId);
                            const rateToUse = eq.customDailyRentalRate ?? inventoryItem?.dailyRentalRate ?? 0;
                            return (
                                <tr key={i} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-2 py-1 truncate max-w-[100px]" title={eq.name}>{eq.name}</td>
                                    <td className="px-2 py-1 text-center font-medium">{eq.quantity}</td>
                                    <td className="px-2 py-1 text-right font-mono">{formatToBRL(rateToUse)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          </div>
          
          <div className="flex items-center pt-1">
            <Badge 
              variant={getPaymentStatusVariant(rental.paymentStatus)} 
              className={cn("capitalize text-xs py-0.5 px-2", isPayable && "cursor-pointer hover:opacity-80 transition-opacity")}
              onClick={handleBadgeClick}
              title={isPayable ? "Clique para marcar como pago" : ""}
            >
              {paymentStatusMap[rental.paymentStatus]}
            </Badge>
            {rental.paymentStatus === 'paid' && rental.paymentDate && (
              <span className="text-xs text-muted-foreground ml-2">
                em {format(parseISO(rental.paymentDate), 'dd/MM/yy')}
              </span>
            )}
          </div>

        </CardContent>
        <CardFooter className="border-t pt-3 pb-3 px-4">
          <RentalTableActions rental={rental} inventory={inventory} onActionSuccess={onActionSuccess} />
        </CardFooter>
      </Card>

      {isPayable && (
          <MarkAsPaidDialog
            rental={rental}
            isOpen={isPaidDialogOpen}
            onOpenChange={setIsPaidDialogOpen}
            onSuccess={onActionSuccess}
          />
      )}
    </>
  );
}
