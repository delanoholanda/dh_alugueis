
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart as BarChartIcon, Users, Package, LineChart as LucideLineChart, LayoutDashboard, TrendingDown, TrendingUp, PieChart, CalendarClock } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart as RechartsLineChart, BarChart as RechartsBarChart, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { getRentals } from '@/actions/rentalActions';
import { getFinancialSummary, getExpenses } from '@/actions/financialActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getCustomers } from '@/actions/customerActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';
import type { Rental, Expense, Equipment, Customer, EquipmentType } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval, parse, isToday, isPast, addDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL, countBillableDays, cn } from '@/lib/utils';
import type { ChartConfig } from "@/components/ui/chart";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';

interface MonthlyFinancialData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface EquipmentItemActivityData {
  name: string; // Equipment Item Name
  total: number;
  rented: number;
  available: number;
}

interface MostRentedTypeData {
    name: string;
    value: number;
    fill: string;
}

const aggregateMonthlyFinancials = (rentals: Rental[], expenses: Expense[]): MonthlyFinancialData[] => {
  const monthlyData: { [key: string]: { revenue: number, expenses: number } } = {};

  const getMonthYearKey = (dateStr: string) => {
    try {
        const date = parseISO(dateStr);
        return format(date, 'MMM/yy', { locale: ptBR });
    } catch (e) {
        console.warn(`Could not parse date for key generation: ${dateStr}`, e);
        return 'invalid_date'; 
    }
  };


  if (rentals.length === 0 && expenses.length === 0) {
    const today = new Date();
    const lastSixMonths = eachMonthOfInterval({
      start: startOfMonth(new Date(today.getFullYear(), today.getMonth() - 5, 1)),
      end: startOfMonth(today)
    });
    lastSixMonths.forEach(monthDate => {
      const monthYear = format(monthDate, 'MMM/yy', { locale: ptBR });
      monthlyData[monthYear] = { revenue: 0, expenses: 0 };
    });
  } else {
      rentals.filter(r => r.paymentStatus === 'paid' && r.paymentDate).forEach(rental => {
        const paymentMonthYear = getMonthYearKey(rental.paymentDate!);
        if (paymentMonthYear === 'invalid_date') return;
        if (!monthlyData[paymentMonthYear]) monthlyData[paymentMonthYear] = { revenue: 0, expenses: 0 };
        monthlyData[paymentMonthYear].revenue += rental.value;
      });

      expenses.forEach(expense => {
        const expenseMonthYear = getMonthYearKey(expense.date);
        if (expenseMonthYear === 'invalid_date') return;
        if (!monthlyData[expenseMonthYear]) monthlyData[expenseMonthYear] = { revenue: 0, expenses: 0 };
        monthlyData[expenseMonthYear].expenses += expense.amount;
      });
  }


  return Object.entries(monthlyData)
    .map(([month, values]) => ({
      month,
      revenue: values.revenue,
      expenses: values.expenses,
      profit: values.revenue - values.expenses,
    }))
    .sort((a, b) => {
      const dateA = parse(a.month, 'MMM/yy', new Date(), { locale: ptBR });
      const dateB = parse(b.month, 'MMM/yy', new Date(), { locale: ptBR });
      return dateA.getTime() - dateB.getTime();
    })
    .slice(-12); 
};

const aggregateEquipmentItemActivity = (inventory: Equipment[], rentals: Rental[]): EquipmentItemActivityData[] => {
  const activityData: EquipmentItemActivityData[] = [];

  const rentedQuantitiesMap: Record<string, number> = {};
  rentals
    .filter(r => !r.actualReturnDate) 
    .forEach(rental => {
      rental.equipment.forEach(eqEntry => {
        rentedQuantitiesMap[eqEntry.equipmentId] = (rentedQuantitiesMap[eqEntry.equipmentId] || 0) + eqEntry.quantity;
      });
    });

  inventory.forEach(item => {
    const totalQuantity = item.quantity;
    const rentedQuantity = rentedQuantitiesMap[item.id] || 0;
    const availableQuantity = Math.max(0, totalQuantity - rentedQuantity);

    activityData.push({
      name: item.name, 
      total: totalQuantity,
      rented: rentedQuantity,
      available: availableQuantity,
    });
  });

  return activityData.filter(d => d.total > 0); 
};

const PIE_CHART_COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--chart-1) / 0.7)',
    'hsl(var(--chart-2) / 0.7)',
];

const aggregateMostRentedTypes = (rentals: Rental[], inventory: Equipment[], types: EquipmentType[]): MostRentedTypeData[] => {
    const typeCounts: Record<string, number> = {};
    const inventoryMap = new Map(inventory.map(item => [item.id, item.typeId]));
    const typeNameMap = new Map(types.map(type => [type.id, type.name]));

    rentals.forEach(rental => {
        rental.equipment.forEach(eq => {
            const typeId = inventoryMap.get(eq.equipmentId);
            if (typeId) {
                // Conta cada item individualmente dentro de um aluguel
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


const chartConfigLine = {
  revenue: { label: "Receita", color: "hsl(var(--chart-1))" },
  expenses: { label: "Despesas", color: "hsl(var(--chart-2))" },
  profit: { label: "Lucro", color: "hsl(var(--chart-3))" }
} satisfies import("@/components/ui/chart").ChartConfig;

const chartConfigBar = {
  rented: {label: "Alugado", color: "hsl(var(--chart-1))"},
  available: {label: "Disponível", color: "hsl(var(--chart-2))"}
} satisfies import("@/components/ui/chart").ChartConfig;

const CustomTooltipContentFormatter = (value: any, name: any, props: any) => {
  const numericValue = Number(value);
  if (isNaN(numericValue)) {
    return null;
  }
  const color = props.color || props.payload?.fill || props.stroke || 'hsl(var(--muted-foreground))';
  const formattedValue = `R$ ${numericValue.toFixed(2).replace('.', ',')}`;
  const displayName = String(name);
  
  return (
    <div
      key={displayName}
      className="flex w-full items-center gap-2"
    >
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <div className="flex flex-1 justify-between">
        <span className="text-muted-foreground">{displayName}</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formattedValue}
        </span>
      </div>
    </div>
  );
};

interface OverviewCardData {
  title: string;
  value: string;
  icon: React.ElementType;
  trendText?: string | null;
  trendColorClass?: string;
  isLoading?: boolean;
}

const initialOverviewCardsData: OverviewCardData[] = [
  { title: 'Receita (Paga / Contratos)', value: 'R$ 0,00 / R$ 0,00', icon: TrendingUp, isLoading: true, trendText: null, trendColorClass: 'text-muted-foreground' },
  { title: 'Despesas Totais', value: 'R$ 0,00', icon: TrendingDown, isLoading: true, trendText: null, trendColorClass: 'text-muted-foreground' },
  { title: 'Aluguéis Ativos', value: '0 contratos', icon: Package, trendText: 'Gerando R$ 0,00 / dia', trendColorClass: 'text-muted-foreground', isLoading: true },
  { title: 'Total de Clientes', value: '0', icon: Users, isLoading: true, trendText: null },
];

function calculateTrendPercentage(current?: number, previous?: number): string | null {
  if (current === undefined || previous === undefined) {
    return null; 
  }
   if (previous === 0) {
    if (current === 0) return "0.0%";
    return current > 0 ? '+∞%' : '-∞%';
  }
   if (current === 0 && previous !==0) { // Current is zero, previous was not
     const percentageChangeSpecial = ((current - previous) / previous) * 100;
     return `${percentageChangeSpecial.toFixed(1)}%`;
  }

  const percentageChange = ((current - previous) / previous) * 100;
  if (Math.abs(percentageChange) < 0.01 && percentageChange !== 0) return "≈0.0%";
  if (percentageChange === 0) return "0.0%";

  const sign = percentageChange > 0 ? '+' : '';
  return `${sign}${percentageChange.toFixed(1)}%`;
}

function determineTrendColor(trend: string | null, type: 'revenue' | 'expense'): string {
  if (!trend || trend.includes('∞') || trend.includes('≈') || trend === "0.0%") return 'text-muted-foreground';
  const value = parseFloat(trend.replace('%', ''));

  if (type === 'expense') { // Lower is better for expenses
    return value < 0 ? 'text-green-500' : 'text-red-500';
  } else { // Higher is better for revenue
    return value > 0 ? 'text-green-500' : 'text-red-500';
  }
}


export default function DashboardPage() {
  const [overviewCards, setOverviewCards] = useState<OverviewCardData[]>(initialOverviewCardsData);
  const [monthlyLineChartData, setMonthlyLineChartData] = useState<MonthlyFinancialData[]>([]);
  const [equipmentActivityChartData, setEquipmentActivityChartData] = useState<EquipmentItemActivityData[]>([]);
  const [mostRentedTypesData, setMostRentedTypesData] = useState<MostRentedTypeData[]>([]);
  const [upcomingReturns, setUpcomingReturns] = useState<Rental[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const pieChartConfig = useMemo(() => {
    return mostRentedTypesData.reduce((acc, entry) => {
        acc[entry.name] = { label: entry.name, color: entry.fill };
        return acc;
    }, {} as ChartConfig);
  }, [mostRentedTypesData]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [
          rentals, 
          summary, 
          expenses, 
          inventoryItems, 
          customersData,
          equipmentTypes
        ] = await Promise.all([
          getRentals(),
          getFinancialSummary(),
          getExpenses(),
          getInventoryItems(),
          getCustomers(),
          getEquipmentTypes(),
        ]);
        
        setCustomers(customersData);

        // Upcoming Returns Logic
        const today = startOfDay(new Date());
        const upcomingCutoff = addDays(today, 8); // To include the next 7 days
        const upcoming = rentals
          .filter(
            (rental) =>
              !rental.actualReturnDate &&
              !rental.isOpenEnded &&
              isBefore(parseISO(rental.expectedReturnDate), upcomingCutoff)
          )
          .sort((a, b) => parseISO(a.expectedReturnDate).getTime() - parseISO(b.expectedReturnDate).getTime());
        setUpcomingReturns(upcoming);

        
        let totalContractValue = 0;
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        rentals.forEach(rental => {
            if (rental.isOpenEnded && !rental.actualReturnDate) {
                const billableDays = countBillableDays(
                    rental.rentalStartDate,
                    todayStr,
                    rental.chargeSaturdays ?? true,
                    rental.chargeSundays ?? true
                );
                totalContractValue += billableDays * rental.value;
            } else {
                totalContractValue += rental.value;
            }
        });
        
        const totalPaidValue = summary.totalRevenue;
        
        const activeRentals = rentals.filter(r => !r.actualReturnDate);
        let dailyRevenueFromActiveRentals = 0;
        
        activeRentals.forEach(rental => {
            if (rental.isOpenEnded) {
                dailyRevenueFromActiveRentals += rental.value;
            } else {
                let rentalDailyRateSum = 0;
                rental.equipment.forEach(eq => {
                    const itemDetail = inventoryItems.find(inv => inv.id === eq.equipmentId);
                    const rateToUse = eq.customDailyRentalRate ?? itemDetail?.dailyRentalRate ?? 0;
                    rentalDailyRateSum += rateToUse * eq.quantity;
                });
                dailyRevenueFromActiveRentals += rentalDailyRateSum;
            }
        });
        
        const aggregatedMonthly = aggregateMonthlyFinancials(rentals, expenses);
        setMonthlyLineChartData(aggregatedMonthly);
        
        let expensesTrendText: string | null = null;
        let expensesTrendColor = 'text-muted-foreground';

        if (aggregatedMonthly.length >= 2) {
          const currentMonthFinancials = aggregatedMonthly[aggregatedMonthly.length - 1];
          const prevMonthFinancials = aggregatedMonthly[aggregatedMonthly.length - 2];
          
          const et = calculateTrendPercentage(currentMonthFinancials.expenses, prevMonthFinancials.expenses);
          expensesTrendText = et ? `${et} vs. último mês` : 'dados insuficientes';
          expensesTrendColor = determineTrendColor(et, 'expense');
        } else {
          expensesTrendText = 'dados mensais insuficientes';
        }

        setOverviewCards([
          { 
            title: 'Receita (Paga / Contratos)', 
            value: `${formatToBRL(totalPaidValue)} / ${formatToBRL(totalContractValue)}`, 
            icon: TrendingUp, 
            isLoading: false, 
            trendText: 'Total pago vs. valor de todos os contratos.', 
            trendColorClass: 'text-muted-foreground' 
          },
          { title: 'Despesas Totais', value: formatToBRL(summary.totalExpenses), icon: TrendingDown, isLoading: false, trendText: expensesTrendText, trendColorClass: expensesTrendColor },
          { title: 'Aluguéis Ativos', value: `${activeRentals.length} contrato(s)`, icon: Package, trendText: `Gerando ${formatToBRL(dailyRevenueFromActiveRentals)} / dia`, trendColorClass: dailyRevenueFromActiveRentals > 0 ? 'text-green-500' : 'text-muted-foreground', isLoading: false },
          { title: 'Total de Clientes', value: customersData.length.toString(), icon: Users, isLoading: false, trendText: null },
        ]);
        
        setEquipmentActivityChartData(aggregateEquipmentItemActivity(inventoryItems, rentals));
        setMostRentedTypesData(aggregateMostRentedTypes(rentals, inventoryItems, equipmentTypes));

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setOverviewCards(prev => prev.map(card => ({ ...card, value: 'Erro', isLoading: false, trendText: '', trendColorClass: 'text-red-500' })));
        setMonthlyLineChartData([]);
        setEquipmentActivityChartData([]);
        setMostRentedTypesData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="container mx-auto py-2">
      <PageHeader title="Visão Geral do Painel" icon={LayoutDashboard} description="Bem-vindo à DH Alugueis. Aqui está um resumo do seu negócio."/>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {overviewCards.map((item) => (
          <Card key={item.title} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
              {item.isLoading ? <Skeleton className="h-5 w-5 rounded-md" /> : <item.icon className="h-5 w-5 text-primary" />}
            </CardHeader>
            <CardContent>
              {item.isLoading ? (
                <>
                  <Skeleton className="h-8 w-3/4 mb-1 rounded-md" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </>
              ) : (
                <>
                  <div className="text-xl font-bold text-foreground">{item.value}</div>
                  {item.trendText && <p className={`text-xs ${item.trendColorClass || 'text-muted-foreground'} mt-1`}>{item.trendText}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

       <div className="grid grid-cols-1 gap-6 mb-8">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline flex items-center">
                        <CalendarClock className="h-6 w-6 mr-2 text-primary" />
                        Próximas Devoluções (Incluindo Atrasadas)
                    </CardTitle>
                    <CardDescription>Aluguéis com devolução esperada para os próximos 7 dias ou que já estão atrasados.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : upcomingReturns.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full space-y-2">
                            {upcomingReturns.map(rental => {
                                const customer = customers.find(c => c.id === rental.customerId);
                                const returnDate = parseISO(rental.expectedReturnDate);
                                const isOverdue = isPast(returnDate) && !isToday(returnDate);
                                const isDueToday = isToday(returnDate);
                                return (
                                    <AccordionItem value={`item-${rental.id}`} key={rental.id} className="border rounded-md hover:bg-muted/50 transition-colors">
                                        <AccordionTrigger className="p-3 w-full hover:no-underline [&[data-state=open]]:border-b">
                                           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full text-left">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={customer?.imageUrl || undefined} alt={customer?.name || 'Avatar'} />
                                                        <AvatarFallback>{customer ? customer.name.charAt(0).toUpperCase() : 'C'}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-semibold">{rental.customerName}</p>
                                                        <p className="text-xs text-muted-foreground">Contrato ID: {String(rental.id).padStart(4, '0')}</p>
                                                    </div>
                                                </div>
                                                <div className={cn("text-sm font-medium whitespace-nowrap self-start sm:self-center mt-1 sm:mt-0", isOverdue && "text-destructive", isDueToday && "text-orange-500")}>
                                                    Devolução: {format(returnDate, 'PP', { locale: ptBR })}
                                                    {isOverdue && ' (Atrasado)'}
                                                    {isDueToday && ' (Hoje)'}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="pl-16 pr-4 pb-3 pt-2 text-sm">
                                                <h4 className="font-semibold mb-2">Itens a serem devolvidos:</h4>
                                                {rental.equipment.length > 0 ? (
                                                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                                        {rental.equipment.map((eq, index) => (
                                                            <li key={index}>
                                                                {eq.quantity}x {eq.name || 'Equipamento desconhecido'}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-muted-foreground italic">Nenhum item listado neste aluguel.</p>
                                                )}
                                                <Button asChild variant="link" size="sm" className="p-0 h-auto mt-2">
                                                   <Link href={`/dashboard/rentals/${rental.id}/details`}>Ver detalhes completos do contrato</Link>
                                                </Button>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma devolução prevista para os próximos 7 dias.</p>
                    )}
                </CardContent>
            </Card>
        </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <BarChartIcon className="h-6 w-6 mr-2 text-primary" />
              Atividade por Item de Equipamento
            </CardTitle>
            <CardDescription>Quantidade total, alugada e disponível para cada item individual no inventário.</CardDescription>
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-[300px] w-full" /> : (
               <ChartContainer config={chartConfigBar} className="h-[350px] w-full">
                <RechartsBarChart data={equipmentActivityChartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                  <XAxis type="number" dataKey="total" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `${value} un.`} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={8} 
                    width={180} 
                    interval={0}
                    tickFormatter={(value, index) => {
                        const dataPoint = equipmentActivityChartData[index];
                        if (!dataPoint) return value;
                        return `${value} (${dataPoint.rented}/${dataPoint.total})`;
                    }}
                   />
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="rented" stackId="a" fill="var(--color-rented)" radius={[0, 4, 4, 0]} name="Alugado" />
                  <Bar dataKey="available" stackId="a" fill="var(--color-available)" radius={[0, 4, 4, 0]} name="Disponível" />
                </RechartsBarChart>
              </ChartContainer>
             )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <PieChart className="h-6 w-6 mr-2 text-primary" />
              Tipos de Equipamento Mais Alugados
            </CardTitle>
            <CardDescription>Distribuição dos tipos de equipamentos mais populares em aluguéis (baseado na quantidade de itens).</CardDescription>
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-[300px] w-full" /> : (
                <ChartContainer config={pieChartConfig} className="h-[350px] w-full">
                    <RechartsPieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideIndicator />} />
                        <Pie data={mostRentedTypesData} dataKey="value" nameKey="name" innerRadius={60}>
                             {mostRentedTypesData.map((entry) => (
                                <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </RechartsPieChart>
                </ChartContainer>
             )}
          </CardContent>
        </Card>
        
        <Card className="shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <LucideLineChart className="h-6 w-6 mr-2 text-primary" />
              Finanças Mensais
            </CardTitle>
             <CardDescription>Receita (de aluguéis com pagamento registrado no mês), Despesas e Lucro nos últimos meses.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[300px] w-full" /> : (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
