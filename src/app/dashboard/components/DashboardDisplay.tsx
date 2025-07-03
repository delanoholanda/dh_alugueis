
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart as BarChartIcon, Users, Package, LineChart as LucideLineChart, CalendarClock, PieChart as PieChartIcon, HandCoins } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart as RechartsLineChart, BarChart as RechartsBarChart, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import type { Rental, Customer, EquipmentType } from '@/types';
import { format, parseISO, isToday, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL, cn, getPaymentStatusVariant, paymentStatusMap } from '@/lib/utils';
import type { ChartConfig } from "@/components/ui/chart";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { DynamicLucideIcon } from '@/lib/lucide-icons';
import { Badge } from '@/components/ui/badge';

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

interface DashboardDisplayProps {
  overviewCards: OverviewCardData[];
  upcomingReturns: Rental[];
  pendingPaymentRentals: Rental[];
  customers: Customer[];
  monthlyLineChartData: MonthlyFinancialData[];
  equipmentActivityChartData: EquipmentItemActivityData[];
  mostRentedTypesData: MostRentedTypeData[];
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

export default function DashboardDisplay({
  overviewCards,
  upcomingReturns,
  pendingPaymentRentals,
  customers,
  monthlyLineChartData,
  equipmentActivityChartData,
  mostRentedTypesData
}: DashboardDisplayProps) {

  const pieChartConfig = useMemo(() => {
    return mostRentedTypesData.reduce((acc, entry) => {
        acc[entry.name] = { label: entry.name, color: entry.fill };
        return acc;
    }, {} as ChartConfig);
  }, [mostRentedTypesData]);

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
                    <CardTitle className="font-headline flex items-center">
                        <CalendarClock className="h-6 w-6 mr-2 text-primary" />
                        Próximas Devoluções (Atrasadas e Futuras)
                    </CardTitle>
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

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline flex items-center">
                        <HandCoins className="h-6 w-6 mr-2 text-primary" />
                        Pagamentos Pendentes (Itens Devolvidos)
                    </CardTitle>
                    <CardDescription>Aluguéis que já foram finalizados mas aguardam o pagamento.</CardDescription>
                </CardHeader>
                <CardContent>
                    {pendingPaymentRentals.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full space-y-2">
                            {pendingPaymentRentals.map(rental => {
                                const customer = customers.find(c => c.id === rental.customerId);
                                const returnDate = rental.actualReturnDate ? parseISO(rental.actualReturnDate) : null;
                                return (
                                    <AccordionItem value={`item-pending-${rental.id}`} key={`pending-${rental.id}`} className="border rounded-md hover:bg-muted/50 transition-colors">
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
                                                <div className="text-sm font-bold text-destructive whitespace-nowrap self-start sm:self-center mt-1 sm:mt-0">
                                                    Valor: {formatToBRL(rental.value)}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="pl-16 pr-4 pb-3 pt-2 text-sm space-y-1">
                                                <p className="text-muted-foreground">
                                                    Devolvido em: <span className="font-medium text-foreground">{returnDate ? format(returnDate, 'PP', { locale: ptBR }) : 'N/A'}</span>
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-muted-foreground">Status do Pagamento:</p>
                                                    <Badge variant={getPaymentStatusVariant(rental.paymentStatus)} className="capitalize">
                                                        {paymentStatusMap[rental.paymentStatus]}
                                                    </Badge>
                                                </div>
                                                <Button asChild variant="link" size="sm" className="p-0 h-auto mt-2">
                                                   <Link href={`/dashboard/rentals/${rental.id}/details`}>Ver detalhes e marcar como pago</Link>
                                                </Button>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum pagamento pendente para itens já devolvidos.</p>
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
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <PieChartIcon className="h-6 w-6 mr-2 text-primary" />
              Tipos de Equipamento Mais Alugados
            </CardTitle>
            <CardDescription>Distribuição dos tipos de equipamentos mais populares em aluguéis (baseado na quantidade de itens).</CardDescription>
          </CardHeader>
          <CardContent>
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
    </>
  );
}
