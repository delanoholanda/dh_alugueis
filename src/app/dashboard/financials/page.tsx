
'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getExpenses, getFinancialSummary } from '@/actions/financialActions';
import { getExpenseCategories } 
from '@/actions/expenseCategoryActions';
import { getRentals } from '@/actions/rentalActions';
import type { Expense, Rental, ExpenseCategory } from '@/types'; 
import { CircleDollarSign, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Line, LineChart as RechartsLineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import FinancialsClientPart from './components/FinancialsClientPart';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';


const chartConfig = {
  revenue: { label: "Receita", color: "hsl(var(--chart-1))" },
  expenses: { label: "Despesas", color: "hsl(var(--chart-2))" },
  profit: { label: "Lucro", color: "hsl(var(--chart-3))" },
} satisfies import("@/components/ui/chart").ChartConfig;

type FinancialSummaryType = { totalRevenue: number; totalExpenses: number; netProfit: number };
type MonthlyDataType = { name: string; revenue: number; expenses: number; profit: number };


const aggregateFinancialData = (rentals: Rental[], expenses: Expense[]): MonthlyDataType[] => {
  const monthlyData: { [key: string]: { revenue: number, expenses: number, profit: number } } = {};

  const getMonthYear = (dateStr: string) => {
    try {
        const date = parseISO(dateStr); 
        return format(date, 'MMM yyyy', { locale: ptBR });
    } catch(e) {
        console.warn("Invalid date string for getMonthYear in financials page:", dateStr, e);
        return "Data Inválida";
    }
  };

  if (rentals.length === 0 && expenses.length === 0) {
    const today = new Date();
    // Generate for the last 6 months including the current one
    const lastSixMonthsInterval = {
      start: startOfMonth(new Date(today.getFullYear(), today.getMonth() - 5, 1)),
      end: startOfMonth(today)
    };
    const monthsToDisplay = eachMonthOfInterval(lastSixMonthsInterval);
    
    monthsToDisplay.forEach(monthDate => {
      const monthYearKey = format(monthDate, 'MMM yyyy', { locale: ptBR });
      monthlyData[monthYearKey] = { revenue: 0, expenses: 0, profit: 0 };
    });

  } else {
    rentals.filter(r => r.paymentStatus === 'paid' && r.paymentDate).forEach(rental => {
      const dateToUse = rental.paymentDate!; // Already filtered for paymentDate presence
      const monthYear = getMonthYear(dateToUse);
      if (monthYear === "Data Inválida") return;
      if (!monthlyData[monthYear]) monthlyData[monthYear] = { revenue: 0, expenses: 0, profit: 0 };
      monthlyData[monthYear].revenue += rental.value;
    });

    expenses.forEach(expense => {
      const monthYear = getMonthYear(expense.date);
      if (monthYear === "Data Inválida") return;
      if (!monthlyData[monthYear]) monthlyData[monthYear] = { revenue: 0, expenses: 0, profit: 0 };
      monthlyData[monthYear].expenses += expense.amount;
    });
  }
  
  Object.keys(monthlyData).forEach(key => {
    monthlyData[key].profit = monthlyData[key].revenue - monthlyData[key].expenses;
  });

  return Object.entries(monthlyData)
    .map(([name, values]) => ({ name, ...values }))
    .sort((a, b) => {
      const [aMonthStr, aYearStr] = a.name.split(' ');
      const [bMonthStr, bYearStr] = b.name.split(' ');
      
      const monthToNum = (monthStr: string) => {
        // Ensure locale consistency if 'MMM' format is strictly ptBR for month names
        const monthsPt = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        return monthsPt.indexOf(monthStr.toLowerCase().replace('.','')); // remove dot if present (e.g. 'fev.')
      }

      const aYear = parseInt(aYearStr);
      const bYear = parseInt(bYearStr);
      
      const aMonth = monthToNum(aMonthStr);
      const bMonth = monthToNum(bMonthStr);

      if (aYear !== bYear) {
        return aYear - bYear;
      }
      return aMonth - bMonth;
    });
};

function calculateTrendPercentage(current?: number, previous?: number): string | null {
  if (current === undefined || previous === undefined) {
    return null; 
  }
  if (previous === 0) {
    if (current === 0) return "0.0%";
    return current > 0 ? '+∞%' : '-∞%';
  }
  if (current === 0 && previous !==0) {
     const percentageChangeSpecial = ((current - previous) / previous) * 100;
     return `${percentageChangeSpecial.toFixed(1)}%`;
  }

  const percentageChange = ((current - previous) / previous) * 100;
  if (Math.abs(percentageChange) < 0.01 && percentageChange !== 0) return "≈0.0%";
  if (percentageChange === 0) return "0.0%";

  const sign = percentageChange > 0 ? '+' : '';
  return `${sign}${percentageChange.toFixed(1)}%`;
}

function getTrendColor(trend: string | null, type: 'revenue' | 'expense' | 'profit'): string {
  if (!trend || trend.includes('∞') || trend.includes('≈') || trend === "0.0%") return 'text-muted-foreground';
  const value = parseFloat(trend.replace('%', ''));

  if (type === 'expense') { 
    return value < 0 ? 'text-green-500' : 'text-red-500';
  } else { 
    return value > 0 ? 'text-green-500' : 'text-red-500';
  }
}


export default function FinancialsPage() {
  const [expensesData, setExpensesData] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [summaryData, setSummaryData] = useState<FinancialSummaryType | null>(null);
  const [chartData, setChartData] = useState<MonthlyDataType[]>([]);
  const [loading, setLoading] = useState(true);

  const [revenueTrend, setRevenueTrend] = useState<string | null>(null);
  const [expensesTrend, setExpensesTrend] = useState<string | null>(null);
  const [profitTrend, setProfitTrend] = useState<string | null>(null);

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

  const fetchAllFinancialData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedExpenses, fetchedRentals, fetchedSummary, fetchedExpenseCategories] = await Promise.all([
        getExpenses(),
        getRentals(),
        getFinancialSummary(),
        getExpenseCategories(),
      ]);

      setExpensesData(fetchedExpenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setExpenseCategories(fetchedExpenseCategories);
      setSummaryData(fetchedSummary);
      const aggregatedData = aggregateFinancialData(fetchedRentals, fetchedExpenses);
      setChartData(aggregatedData);

      if (aggregatedData.length >= 2) {
        const currentMonthData = aggregatedData[aggregatedData.length - 1];
        const prevMonthData = aggregatedData[aggregatedData.length - 2];
        setRevenueTrend(calculateTrendPercentage(currentMonthData.revenue, prevMonthData.revenue));
        setExpensesTrend(calculateTrendPercentage(currentMonthData.expenses, prevMonthData.expenses));
        setProfitTrend(calculateTrendPercentage(currentMonthData.profit, prevMonthData.profit));
      } else {
        setRevenueTrend(null);
        setExpensesTrend(null);
        setProfitTrend(null);
      }

    } catch (error) {
      console.error("Falha ao carregar dados financeiros:", error);
      setSummaryData(null); 
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllFinancialData();
  }, [fetchAllFinancialData]);

  if (loading) {
    return (
      <div className="container mx-auto py-2">
        <PageHeader 
          title="Controle Financeiro" 
          icon={CircleDollarSign}
          description="Acompanhe suas receitas, despesas e lucratividade geral."
        />
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {[1, 2, 3].map(i => (
            <Card key={i} className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-5 w-3/5" /> <Skeleton className="h-5 w-5" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/2 mb-2" />
                <Skeleton className="h-4 w-4/5" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline"><Skeleton className="h-7 w-1/2" /></CardTitle>
            <CardDescription><Skeleton className="h-4 w-3/4" /></CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
        <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <Skeleton className="h-7 w-1/3" />
                <Skeleton className="h-10 w-32" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-20 w-full" />
            </CardContent>
        </Card>
      </div>
    );
  }

  if (!summaryData) {
     return (
      <div className="container mx-auto py-2">
        <PageHeader 
          title="Controle Financeiro" 
          icon={CircleDollarSign}
          description="Acompanhe suas receitas, despesas e lucratividade geral."
        />
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Falha ao carregar o resumo financeiro. Por favor, tente atualizar a página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const revenueTrendColor = getTrendColor(revenueTrend, 'revenue');
  const expensesTrendColor = getTrendColor(expensesTrend, 'expense');
  const profitTrendColor = getTrendColor(profitTrend, 'profit');


  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Controle Financeiro" 
        icon={CircleDollarSign}
        description="Acompanhe suas receitas, despesas e lucratividade geral."
      />

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita Total</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">R$ {summaryData.totalRevenue.toFixed(2).replace('.',',')}</div>
            <p className={`text-xs ${revenueTrendColor}`}>
              {revenueTrend ? `${revenueTrend} do último mês` : 'dados mensais insuficientes'}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas Totais</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">R$ {summaryData.totalExpenses.toFixed(2).replace('.',',')}</div>
            <p className={`text-xs ${expensesTrendColor}`}>
               {expensesTrend ? `${expensesTrend} do último mês` : 'dados mensais insuficientes'}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lucro Líquido</CardTitle>
            <Scale className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">R$ {summaryData.netProfit.toFixed(2).replace('.',',')}</div>
             <p className={`text-xs ${profitTrendColor}`}>
                {profitTrend ? `${profitTrend} do último mês` : 'dados mensais insuficientes'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Visão Geral Financeira Mensal</CardTitle>
          <CardDescription>Receita, Despesas e Lucro ao longo do tempo. Receita é contabilizada no mês do pagamento.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[350px] w-full">
            <RechartsLineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `R$${value}`}/>
              <ChartTooltip content={<ChartTooltipContent indicator="dot" formatter={CustomTooltipContentFormatter} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Receita" />
              <Line type="monotone" dataKey="expenses" stroke="var(--color-expenses)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Despesas"/>
              <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Lucro"/>
            </RechartsLineChart>
          </ChartContainer>
        </CardContent>
      </Card>
      
      <FinancialsClientPart 
        initialExpenses={expensesData} 
        initialExpenseCategories={expenseCategories} 
        onDataShouldRefresh={fetchAllFinancialData} // Pass the refresh function
      />

    </div>
  );
}

    

    

    
