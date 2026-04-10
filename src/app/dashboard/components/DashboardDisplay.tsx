
'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart as BarChartIcon, Users, Package, LineChart as LucideLineChart, CalendarClock, PieChart as PieChartIcon, HandCoins, CheckSquare, FileText, Eye, DollarSign, TrendingUp, TrendingDown, Warehouse, CheckCircle2 } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart as RechartsLineChart, BarChart as RechartsBarChart, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import type { Rental, Customer, Equipment, Expense, EquipmentType, Payment } from '@/types';
import { format, parseISO, isToday, isPast, isBefore, startOfDay, addDays, eachMonthOfInterval, startOfMonth, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL, cn, getPaymentStatusVariant, paymentStatusMap, countBillableDays } from '@/lib/utils';
import type { ChartConfig } from "@/components/ui/chart";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { DynamicLucideIcon } from '@/lib/lucide-icons';
import { Badge } from '@/components/ui/badge';
import { MarkAsPaidDialog } from '@/app/dashboard/rentals/components/MarkAsPaidDialog';
import FinalizeRentalButton from '@/app/dashboard/rentals/components/FinalizeRentalButton';
import { getRentals } from '@/actions/rentalActions';
import { getCustomers } from '@/actions/customerActions';
import { getFinancialSummary, getExpenses } from '@/actions/financialActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';
import { Skeleton } from '@/components/ui/skeleton';
import { RentalTableActions } from '@/app/dashboard/rentals/components/RentalTableActions';
import { BulkPaymentDialog } from './BulkPaymentDialog';

interface MonthlyFinancialData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface EquipmentItemActivityData {
  name: string;
  total: number;
  rented: number;
  available: number;
}

interface MostRentedTypeData {
    name: string;
    value: number;
    fill: string;
}

interface OverviewCardData {
  title: string;
  value: string;
  iconName: string;
  trendText?: string | null;
  trendColorClass?: string;
}

export interface GroupedPendingPayment {
  customerId: string;
  customerName: string;
  customerImageUrl?: string;
  totalPendingValue: number;
  rentals: Rental[];
}


// --- Helper Functions for Data Aggregation ---

const aggregateMonthlyFinancials = (rentals: Rental[], expenses: Expense[]) => {
  const monthlyData: { [key: string]: { revenue: number, expenses: number, profit: number } } = {};

  const getMonthYearKey = (dateStr: string) => {
    try {
        const date = parseISO(dateStr); 
        return format(date, 'MMM/yy', { locale: ptBR });
    } catch (e) {
        return 'invalid_date'; 
    }
  };
  
  const allPayments = rentals.flatMap(r => 
    (r.payments || []).map(p => {
        // Calculate fuel ratio for this specific payment based on the parent rental
        const fuelValue = r.fuelValue || 0;
        const totalContractValue = r.value || 1; // Avoid division by zero
        const fuelRatio = fuelValue / totalContractValue;
        return { ...p, adjustedAmount: p.amount * (1 - fuelRatio) };
    })
  );

  if (allPayments.length === 0 && expenses.length === 0) {
    const today = new Date();
    const lastSixMonths = eachMonthOfInterval({
      start: startOfMonth(new Date(today.getFullYear(), today.getMonth() - 5, 1)),
      end: startOfMonth(today)
    });
    lastSixMonths.forEach(monthDate => {
      const monthYear = format(monthDate, 'MMM/yy', { locale: ptBR });
      monthlyData[monthYear] = { revenue: 0, expenses: 0, profit: 0 };
    });
  } else {
      allPayments.forEach(payment => {
        const paymentMonthYear = getMonthYearKey(payment.paymentDate);
        if (paymentMonthYear === 'invalid_date') return;
        if (!monthlyData[paymentMonthYear]) monthlyData[paymentMonthYear] = { revenue: 0, expenses: 0, profit: 0 };
        // Use adjustedAmount which excludes fuel
        monthlyData[paymentMonthYear].revenue += payment.adjustedAmount;
      });

      expenses.forEach(expense => {
        const expenseMonthYear = getMonthYearKey(expense.date);
        if (expenseMonthYear === 'invalid_date') return;
        if (!monthlyData[expenseMonthYear]) monthlyData[expenseMonthYear] = { revenue: 0, expenses: 0, profit: 0 };
        monthlyData[expenseMonthYear].expenses += expense.amount;
      });
  }
  
  Object.keys(monthlyData).forEach(key => {
    monthlyData[key].profit = monthlyData[key].revenue - monthlyData[key].expenses;
  });

  return Object.entries(monthlyData)
    .map(([month, values]) => ({ month, ...values }))
    .sort((a, b) => parse(a.month, 'MMM/yy', new Date(), { locale: ptBR }).getTime() - parse(b.month, 'MMM/yy', new Date(), { locale: ptBR }).getTime())
    .slice(-12); 
};

const aggregateEquipmentItemActivity = (inventory: Equipment[], rentals: Rental[]) => {
  const rentedQuantitiesMap: Record<string, number> = {};

  rentals.filter(r => !r.actualReturnDate).forEach(rental => {
    rental.equipment.forEach(eqEntry => {
      rentedQuantitiesMap[eqEntry.equipmentId] = (rentedQuantitiesMap[eqEntry.equipmentId] || 0) + eqEntry.quantity;
    });
  });

  return inventory
    .map(item => ({
      name: item.name,
      total: item.quantity,
      rented: rentedQuantitiesMap[item.id] || 0,
      available: Math.max(0, item.quantity - (rentedQuantitiesMap[item.id] || 0)),
    }))
    .filter(d => d.total > 0);
};

const PIE_CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-1) / 0.7)', 'hsl(var(--chart-2) / 0.7)'];
const aggregateMostRentedTypes = (rentals: Rental[], inventory: Equipment[], types: EquipmentType[]) => {
    const typeCounts: Record<string, number> = {};
    const inventoryMap = new Map(inventory.map(item => [item.id, item.typeId]));
    const typeNameMap = new Map(types.map(type => [type.id, type.name]));

    rentals.forEach(rental => {
      rental.equipment.forEach(eq => {
        const typeId = inventoryMap.get(eq.equipmentId);
        if (typeId) {
          typeCounts[typeId] = (typeCounts[typeId] || 0) + eq.quantity;
        }
      });
    });

    return Object.entries(typeCounts)
        .map(([typeId, count], index) => ({
            name: typeNameMap.get(typeId) || 'Desconhecido',
            value: count,
            fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value);
};

function calculateTrendPercentage(current?: number, previous?: number): string | null {
  if (current === undefined || previous === undefined) return null;
  if (previous === 0) return current > 0 ? '+∞%' : current === 0 ? '0.0%' : '-∞%';
  
  if (current === 0 && previous !== 0) {
    const percentageChangeSpecial = ((current - previous) / previous) * 100;
    return `${percentageChangeSpecial.toFixed(1)}%`;
  }
  
  const percentageChange = ((current - previous) / previous) * 100;
  if (Math.abs(percentageChange) < 0.01 && percentageChange !== 0) return "≈0.0%";
  if (percentageChange === 0) return "0.0%";
  return `${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(1)}%`;
}


function determineTrendColor(trend: string | null, type: 'revenue' | 'expense'): string {
  if (!trend || trend.includes('∞') || trend.includes('≈') || trend === "0.0%") return 'text-muted-foreground';
  const value = parseFloat(trend.replace('%', ''));
  return type === 'expense' ? (value < 0 ? 'text-green-500' : 'text-red-500') : (value > 0 ? 'text-green-500' : 'text-red-500');
}


const chartConfigLine = {
  revenue: { label: "Receita", color: "hsl(var(--chart-1))" },
  expenses: { label: "Despesas", color: "hsl(var(--chart-2))" },
  profit: { label: "Lucro", color: "hsl(var(--chart-3))" }
} satisfies import("@/components/ui/chart").ChartConfig;

const chartConfigBar = {
  rented: {label: "Alugado", color: "hsl(var(--chart-1))"},
  available: {label: "Disponível", color: "hsl(var(--chart-2))"}
} satisfies import("@/components/ui/chart").ChartConfig;


export default function DashboardDisplay() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<Equipment[]>([]);
  const [overviewCards, setOverviewCards] = useState<OverviewCardData[]>([]);
  const [monthlyLineChartData, setMonthlyLineChartData] = useState<MonthlyFinancialData[]>([]);
  const [equipmentActivityChartData, setEquipmentActivityChartData] = useState<EquipmentItemActivityData[]>([]);
  const [mostRentedTypesData, setMostRentedTypesData] = useState<MostRentedTypeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRentalForPayment, setSelectedRentalForPayment] = useState<Rental | null>(null);
  const [selectedGroupForBulkPayment, setSelectedGroupForBulkPayment] = useState<GroupedPendingPayment | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [
            rentalsData,
            summaryData,
            expensesData,
            inventoryItemsData,
            customersData,
            equipmentTypesData,
        ] = await Promise.all([
            getRentals(),
            getFinancialSummary(),
            getExpenses(),
            getInventoryItems(),
            getCustomers(),
            getEquipmentTypes(),
        ]);

        setRentals(rentalsData);
        setCustomers(customersData);
        setInventory(inventoryItemsData);

        // Process data for charts and cards
        const aggregatedMonthly = aggregateMonthlyFinancials(rentalsData, expensesData);
        setMonthlyLineChartData(aggregatedMonthly);
        
        const equipmentActivity = aggregateEquipmentItemActivity(inventoryItemsData, rentalsData);
        setEquipmentActivityChartData(equipmentActivity);

        const rentedTypes = aggregateMostRentedTypes(rentalsData, inventoryItemsData, equipmentTypesData);
        setMostRentedTypesData(rentedTypes);

        let totalContractValueExcludingFuel = 0;
        let dailyActiveRevenue = 0;
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        rentalsData.forEach(rental => {
            let currentRentalValue: number;
            if (rental.isOpenEnded && !rental.actualReturnDate) {
                const billableDays = countBillableDays(rental.rentalStartDate, todayStr, rental.chargeSaturdays ?? true, rental.chargeSundays ?? true);
                currentRentalValue = billableDays * rental.value; // For open-ended, rental.value is the daily rate.
            } else {
                currentRentalValue = rental.value;
            }
            
            // Subtract fuel from contract value for overview purposes
            const contractExcludingFuel = currentRentalValue - (rental.fuelValue || 0);
            totalContractValueExcludingFuel += contractExcludingFuel;

            if (!rental.actualReturnDate) {
              rental.equipment.forEach(eq => {
                const itemDetails = inventoryItemsData.find(inv => inv.id === eq.equipmentId);
                const rate = eq.customDailyRentalRate ?? itemDetails?.dailyRentalRate ?? 0;
                dailyActiveRevenue += eq.quantity * rate;
              });
            }
        });
        
        const activeRentalsCount = rentalsData.filter(r => !r.actualReturnDate).length;
        
        let expensesTrendText: string | null = null;
        let expensesTrendColor = 'text-muted-foreground';
        if (aggregatedMonthly.length >= 2) {
            const et = calculateTrendPercentage(aggregatedMonthly[aggregatedMonthly.length - 1].expenses, aggregatedMonthly[aggregatedMonthly.length - 2].expenses);
            expensesTrendText = et ? `${et} vs. último mês` : 'dados insuficientes';
            expensesTrendColor = determineTrendColor(et, 'expense');
        } else {
            expensesTrendText = 'dados mensais insuficientes';
        }
        
        setOverviewCards([
            { title: 'Receita (Paga / Contratos)', value: `${formatToBRL(summaryData.totalRevenue)} / ${formatToBRL(totalContractValueExcludingFuel)}`, iconName: 'TrendingUp', trendText: 'Exclui valor de combustível.', trendColorClass: 'text-muted-foreground' },
            { title: 'Despesas Totais', value: formatToBRL(summaryData.totalExpenses), iconName: 'TrendingDown', trendText: expensesTrendText, trendColorClass: expensesTrendColor },
            { title: 'Aluguéis Ativos', value: `${activeRentalsCount} contrato(s)`, iconName: 'Warehouse', trendText: `Gerando ${formatToBRL(dailyActiveRevenue)} / dia`, trendColorClass: 'text-green-500' },
            { title: 'Total de Clientes', value: customersData.length.toString(), iconName: 'Users', trendText: null },
        ]);

    } catch (error) {
        console.error("Failed to load dashboard data:", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleActionSuccess = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const { upcomingReturns, groupedPendingPayments } = useMemo(() => {
    const today = startOfDay(new Date());
    const upcomingCutoff = addDays(today, 8);

    const returns = rentals
      .filter(rental => !rental.actualReturnDate && !rental.isOpenEnded && isBefore(parseISO(rental.expectedReturnDate), upcomingCutoff))
      .sort((a, b) => parseISO(a.expectedReturnDate).getTime() - parseISO(b.expectedReturnDate).getTime());

    const customerMap: { [key: string]: GroupedPendingPayment } = {};
    const pending: GroupedPendingPayment[] = [];

    rentals
      .filter(rental => !!rental.actualReturnDate && (rental.paymentStatus === 'pending' || rental.paymentStatus === 'overdue'))
      .forEach(rental => {
          const totalPaid = rental.payments?.reduce((acc, p) => acc + p.amount, 0) ?? 0;
          const pendingValue = rental.value - totalPaid;
          
          // Skip if effectively paid (avoids precision issues showing R$ 0,00)
          if (pendingValue < 0.005) return;

          if (!customerMap[rental.customerId]) {
              const customer = customers.find(c => c.id === rental.customerId);
              customerMap[rental.customerId] = {
                  customerId: rental.customerId,
                  customerName: rental.customerName || 'Cliente Desconhecido',
                  customerImageUrl: customer?.imageUrl,
                  totalPendingValue: 0,
                  rentals: []
              };
              pending.push(customerMap[rental.customerId]);
          }
          
          customerMap[rental.customerId].totalPendingValue += pendingValue;
          customerMap[rental.customerId].rentals.push(rental);
      });

    pending.sort((a,b) => b.totalPendingValue - a.totalPendingValue);

    return { upcomingReturns: returns, groupedPendingPayments: pending };

  }, [rentals, customers]);

  const pieChartConfig = useMemo(() => {
    return mostRentedTypesData.reduce((acc, entry) => {
        acc[entry.name] = { label: entry.name, color: entry.fill };
        return acc;
    }, {} as ChartConfig);
  }, [mostRentedTypesData]);

  const totalPendingSum = useMemo(() => {
    return groupedPendingPayments.reduce((sum, group) => sum + group.totalPendingValue, 0);
  }, [groupedPendingPayments]);

  if (isLoading) {
    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-[120px] w-full" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <Skeleton className="h-[300px] w-full" />
                <Skeleton className="h-[300px] w-full" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-[400px] w-full" />
                <Skeleton className="h-[400px] w-full" />
                <Skeleton className="h-[400px] w-full lg:col-span-2" />
            </div>
        </div>
    );
  }

  const getFirstName = (fullName?: string) => {
    if (!fullName) return '';
    return fullName.split(' ')[0];
  };

  const CustomTooltipContentFormatter = (value: any, name: any, props: any) => {
    const numericValue = Number(value);
    if (isNaN(numericValue)) return null;
    const color = props.color || props.payload?.fill || props.stroke || 'hsl(var(--muted-foreground))';
    const formattedValue = `R$ ${numericValue.toFixed(2).replace('.', ',')}`;
    return (
        <div key={name} className="flex w-full items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
            <div className="flex flex-1 justify-between">
                <span className="text-muted-foreground">{name}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">{formattedValue}</span>
            </div>
        </div>
    );
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {overviewCards.map((item, index) => (
          <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
              <DynamicLucideIcon iconName={item.iconName} className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold text-foreground">{item.value}</div>
                {item.trendText && <p className={`text-xs ${item.trendColorClass || 'text-muted-foreground'} mt-1`}>{item.trendText}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline flex items-center"><CalendarClock className="h-6 w-6 mr-2 text-primary" /> Próximas Devoluções (Atrasadas e Futuras)</CardTitle>
                    <CardDescription>Aluguéis que ainda não foram devolvidos e estão atrasados ou com devolução nos próximos 7 dias.</CardDescription>
                </CardHeader>
                <CardContent>
                    {upcomingReturns.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full space-y-2">
                            {upcomingReturns.map(rental => {
                                const customer = customers.find(c => c.id === rental.customerId);
                                const returnDate = parseISO(rental.expectedReturnDate);
                                const isOverdue = isPast(returnDate) && !isToday(returnDate);
                                const isDueToday = isToday(returnDate);
                                const isPayable = rental.paymentStatus !== 'paid' && !rental.isOpenEnded;

                                return (
                                    <AccordionItem value={`item-${rental.id}`} key={rental.id} className="border rounded-md hover:bg-muted/50 transition-colors">
                                        <AccordionTrigger className="p-3 w-full hover:no-underline [&[data-state=open]]:border-b">
                                           <div className="flex items-center gap-3 w-full text-left">
                                                <Avatar className="h-10 w-10"><AvatarImage src={customer?.imageUrl || undefined} alt={customer?.name || 'Avatar'} /><AvatarFallback>{customer ? getFirstName(customer.name).charAt(0).toUpperCase() : 'C'}</AvatarFallback></Avatar>
                                                <div className="flex-grow">
                                                    <p className="font-semibold">{getFirstName(rental.customerName)}</p>
                                                    <div className={cn("text-sm font-medium", isOverdue && "text-destructive", isDueToday && "text-orange-500")}>
                                                        Devolução: {format(returnDate, 'PP', { locale: ptBR })}
                                                        {isOverdue && ' (Atrasado)'}
                                                        {isDueToday && ' (Hoje)'}
                                                    </div>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="pl-16 pr-4 pb-3 pt-2 text-sm space-y-3">
                                                <div>
                                                  <h4 className="font-semibold mb-2">Itens a serem devolvidos:</h4>
                                                  {rental.equipment.length > 0 ? (
                                                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                                          {rental.equipment.map((eq, index) => <li key={index}>{eq.quantity}x {eq.name || 'Equipamento desconhecido'}</li>)}
                                                      </ul>
                                                  ) : <p className="text-muted-foreground italic">Nenhum item listado.</p>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                                                    <FinalizeRentalButton rental={rental} isFinalized={!!rental.actualReturnDate} onFinalized={handleActionSuccess} buttonProps={{ variant: "outline", size: "sm", className: "text-green-600 border-green-600/50 hover:bg-green-600/10 hover:text-green-700" }} />
                                                    {isPayable && <Button variant="outline" size="sm" onClick={() => setSelectedRentalForPayment(rental)}><DollarSign className="mr-2 h-4 w-4 text-green-600" />Registrar Pagamento</Button>}
                                                    <Button asChild variant="outline" size="sm"><Link href={`/dashboard/rentals/${rental.id}/details`}><Eye className="mr-2 h-4 w-4" /> Ver detalhes</Link></Button>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhuma devolução prevista para os próximos 7 dias.</p>}
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline flex items-center"><HandCoins className="h-6 w-6 mr-2 text-primary" />Pagamentos Pendentes (Itens Devolvidos)</CardTitle>
                    <CardDescription>
                        Aluguéis finalizados que aguardam pagamento. 
                        {totalPendingSum > 0 && <span className="font-bold text-foreground"> Total: {formatToBRL(totalPendingSum)}</span>}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {groupedPendingPayments.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full space-y-2">
                            {groupedPendingPayments.map(group => (
                                <AccordionItem value={`group-${group.customerId}`} key={group.customerId} className="border rounded-md hover:bg-muted/50 transition-colors">
                                    <AccordionTrigger className="p-3 w-full hover:no-underline [&[data-state=open]]:border-b">
                                        <div className="flex items-center gap-3 w-full text-left">
                                            <Avatar className="h-10 w-10"><AvatarImage src={group.customerImageUrl || undefined} alt={group.customerName} /><AvatarFallback>{group.customerName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                                            <div className="flex-grow">
                                                <p className="font-semibold">{group.customerName}</p>
                                                <div className="text-sm font-bold text-destructive">Dívida Total: {formatToBRL(group.totalPendingValue)}</div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="pl-4 pr-4 pb-3 pt-2 text-sm space-y-3">
                                            <div className="space-y-2">
                                                {group.rentals.map(rental => {
                                                    const pendingValue = Math.max(0, rental.value - (rental.payments?.reduce((acc,p)=>acc+p.amount,0) ?? 0));
                                                    return(
                                                        <div key={rental.id} className="flex flex-wrap items-center justify-between gap-2 p-2 border-b last:border-b-0">
                                                            <div>
                                                                <p className="text-muted-foreground text-xs">Contrato ID: {rental.id}</p>
                                                                <p className="font-semibold text-destructive">Pendente: {formatToBRL(pendingValue)}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <RentalTableActions rental={rental} inventory={inventory} onActionSuccess={handleActionSuccess} />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <div className="flex justify-end pt-2 gap-2 flex-wrap">
                                                <Button variant="outline" size="sm" onClick={() => setSelectedGroupForBulkPayment(group)}>
                                                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> Quitar Tudo
                                                </Button>
                                                <Button asChild size="sm"><Link href={`/dashboard/customers/${group.customerId}/consolidated-receipt?rental_ids=${group.rentals.map(r => r.id).join(',')}`}><FileText className="h-4 w-4 mr-2" />Gerar Recibo Consolidado</Link></Button>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum pagamento pendente para itens já devolvidos.</p>}
                </CardContent>
            </Card>
        </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><BarChartIcon className="h-6 w-6 mr-2 text-primary" />Atividade por Item de Equipamento</CardTitle>
            <CardDescription>Quantidade total, alugada e disponível para cada item individual no inventário.</CardDescription>
          </CardHeader>
          <CardContent>
               <ChartContainer config={chartConfigBar} className="h-[350px] w-full">
                <RechartsBarChart data={equipmentActivityChartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                  <XAxis type="number" dataKey="total" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `${value} un.`} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tickMargin={8} width={180} interval={0} tickFormatter={(value, index) => `${equipmentActivityChartData[index]?.name} (${equipmentActivityChartData[index]?.rented}/${equipmentActivityChartData[index]?.total})`}/>
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="rented" stackId="a" fill="var(--color-rented)" radius={[0, 4, 4, 0]} name="Alugado" />
                  <Bar dataKey="available" stackId="a" fill="var(--color-available)" radius={[0, 4, 4, 0]} name="Disponível" />
                </RechartsBarChart>
              </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><PieChartIcon className="h-6 w-6 mr-2 text-primary" />Tipos de Equipamento Mais Alugados</CardTitle>
            <CardDescription>Distribuição dos tipos de equipamentos mais populares em aluguéis (baseado na quantidade de itens).</CardDescription>
          </CardHeader>
          <CardContent>
                <ChartContainer config={pieChartConfig} className="h-[350px] w-full">
                    <RechartsPieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideIndicator />} />
                        <Pie data={mostRentedTypesData} dataKey="value" nameKey="name" innerRadius={60}>{mostRentedTypesData.map(entry => <Cell key={`cell-${entry.name}`} fill={entry.fill} />)}</Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </RechartsPieChart>
                </ChartContainer>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><LucideLineChart className="h-6 w-6 mr-2 text-primary" />Finanças Mensais</CardTitle>
             <CardDescription>Receita (exclui combustível), Despesas e Lucro nos últimos meses.</CardDescription>
          </CardHeader>
          <CardContent>
              <ChartContainer config={chartConfigLine} className="h-[350px] w-full">
                <RechartsLineChart data={monthlyLineChartData} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} interval={monthlyLineChartData.length > 6 ? 'preserveEnd' : 0} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `R$${value / 1000}k`} />
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" formatter={CustomTooltipContentFormatter}/>} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={true} name="Receita" />
                  <Line type="monotone" dataKey="expenses" stroke="var(--color-expenses)" strokeWidth={2} dot={true} name="Despesas" />
                  <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" strokeWidth={2} dot={true} name="Lucro" />
                </RechartsLineChart>
              </ChartContainer>
          </CardContent>
        </Card>
      </div>
      {selectedRentalForPayment && (
        <MarkAsPaidDialog rental={selectedRentalForPayment} isOpen={!!selectedRentalForPayment} onOpenChange={(open) => !open && setSelectedRentalForPayment(null)} onSuccess={handleActionSuccess} />
      )}
      {selectedGroupForBulkPayment && (
        <BulkPaymentDialog
            customerName={selectedGroupForBulkPayment.customerName}
            totalPendingValue={selectedGroupForBulkPayment.totalPendingValue}
            rentals={selectedGroupForBulkPayment.rentals}
            isOpen={!!selectedGroupForBulkPayment}
            onOpenChange={(open) => !open && setSelectedGroupForBulkPayment(null)}
            onSuccess={handleActionSuccess}
        />
      )}
    </>
  );
}
