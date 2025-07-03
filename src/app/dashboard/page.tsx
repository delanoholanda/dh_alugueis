
import { PageHeader } from '@/components/layout/PageHeader';
import { getRentals } from '@/actions/rentalActions';
import { getFinancialSummary, getExpenses } from '@/actions/financialActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { getCustomers } from '@/actions/customerActions';
import { getEquipmentTypes } from '@/actions/equipmentTypeActions';
import type { Rental, Expense, Equipment, Customer, EquipmentType } from '@/types';
import { LayoutDashboard } from 'lucide-react';
import DashboardDisplay from './components/DashboardDisplay';
import { format, parseISO, startOfMonth, eachMonthOfInterval, parse, isToday, isPast, addDays, isBefore, startOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL, countBillableDays } from '@/lib/utils';
import DashboardActionTrigger from './components/DashboardActionTrigger';


// Helper functions for data aggregation
const aggregateMonthlyFinancials = (rentals: Rental[], expenses: Expense[]) => {
  const monthlyData: { [key: string]: { revenue: number, expenses: number } } = {};

  const getMonthYearKey = (dateStr: string) => {
    try {
        const date = parseISO(dateStr);
        return format(date, 'MMM/yy', { locale: ptBR });
    } catch (e) {
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

const aggregateEquipmentItemActivity = (inventory: Equipment[], rentals: Rental[]) => {
  const activityData: { name: string; total: number; rented: number; available: number }[] = [];
  const rentedQuantitiesMap: Record<string, number> = {};

  rentals.filter(r => !r.actualReturnDate).forEach(rental => {
    rental.equipment.forEach(eqEntry => {
      rentedQuantitiesMap[eqEntry.equipmentId] = (rentedQuantitiesMap[eqEntry.equipmentId] || 0) + eqEntry.quantity;
    });
  });

  inventory.forEach(item => {
    const totalQuantity = item.quantity;
    const rentedQuantity = rentedQuantitiesMap[item.id] || 0;
    const availableQuantity = Math.max(0, totalQuantity - rentedQuantity);
    activityData.push({ name: item.name, total: totalQuantity, rented: rentedQuantity, available: availableQuantity });
  });

  return activityData.filter(d => d.total > 0); 
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


export default async function DashboardPage() {
  const [rentals, summary, expenses, inventoryItems, customersData, equipmentTypes] = await Promise.all([
    getRentals(),
    getFinancialSummary(),
    getExpenses(),
    getInventoryItems(),
    getCustomers(),
    getEquipmentTypes(),
  ]);

  const today = startOfDay(new Date());
  const upcomingCutoff = addDays(today, 8);
  const upcomingReturns = rentals.filter(rental => !rental.actualReturnDate && !rental.isOpenEnded && isBefore(parseISO(rental.expectedReturnDate), upcomingCutoff))
                                .sort((a, b) => parseISO(a.expectedReturnDate).getTime() - parseISO(b.expectedReturnDate).getTime());

  const pendingPaymentRentals = rentals
    .filter(rental => !!rental.actualReturnDate && (rental.paymentStatus === 'pending' || rental.paymentStatus === 'overdue'))
    .sort((a, b) => parseISO(a.actualReturnDate!).getTime() - parseISO(b.actualReturnDate!).getTime());

  let totalContractValue = 0;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  rentals.forEach(rental => {
    if (rental.isOpenEnded && !rental.actualReturnDate) {
      totalContractValue += countBillableDays(rental.rentalStartDate, todayStr, rental.chargeSaturdays ?? true, rental.chargeSundays ?? true) * rental.value;
    } else {
      totalContractValue += rental.value;
    }
  });
  
  const activeRentals = rentals.filter(r => !r.actualReturnDate || r.paymentStatus !== 'paid');

  // Calculate daily revenue only from rentals that are actually generating revenue today
  const revenueGeneratingRentals = rentals.filter(rental => {
    if (rental.actualReturnDate) {
      return false; // Not generating revenue if returned
    }
    if (rental.isOpenEnded) {
      return true; // Is generating revenue if open-ended and not returned
    }
    // Is generating revenue if it's fixed-term, not returned, and today is within the rental period
    return isWithinInterval(today, { 
      start: parseISO(rental.rentalStartDate), 
      end: parseISO(rental.expectedReturnDate) 
    });
  });

  let dailyRevenueFromActiveRentals = 0;
  revenueGeneratingRentals.forEach(rental => {
    if (rental.isOpenEnded) {
      dailyRevenueFromActiveRentals += rental.value; // 'value' is the daily rate for open-ended
    } else {
      let rentalDailyRateSum = 0;
      rental.equipment.forEach(eq => {
        const itemDetail = inventoryItems.find(inv => inv.id === eq.equipmentId);
        rentalDailyRateSum += (eq.customDailyRentalRate ?? itemDetail?.dailyRentalRate ?? 0) * eq.quantity;
      });
      dailyRevenueFromActiveRentals += rentalDailyRateSum;
    }
  });


  const aggregatedMonthly = aggregateMonthlyFinancials(rentals, expenses);
  let expensesTrendText: string | null = null;
  let expensesTrendColor = 'text-muted-foreground';
  if (aggregatedMonthly.length >= 2) {
    const et = calculateTrendPercentage(aggregatedMonthly[aggregatedMonthly.length - 1].expenses, aggregatedMonthly[aggregatedMonthly.length - 2].expenses);
    expensesTrendText = et ? `${et} vs. último mês` : 'dados insuficientes';
    expensesTrendColor = determineTrendColor(et, 'expense');
  } else {
    expensesTrendText = 'dados mensais insuficientes';
  }

  const overviewCardsData = [
    { title: 'Receita (Paga / Contratos)', value: `${formatToBRL(summary.totalRevenue)} / ${formatToBRL(totalContractValue)}`, iconName: 'TrendingUp', trendText: 'Total pago vs. valor de todos os contratos.', trendColorClass: 'text-muted-foreground' },
    { title: 'Despesas Totais', value: formatToBRL(summary.totalExpenses), iconName: 'TrendingDown', trendText: expensesTrendText, trendColorClass: expensesTrendColor },
    { title: 'Aluguéis Ativos', value: `${activeRentals.length} contrato(s)`, iconName: 'Package', trendText: `Gerando ${formatToBRL(dailyRevenueFromActiveRentals)} / dia`, trendColorClass: dailyRevenueFromActiveRentals > 0 ? 'text-green-500' : 'text-muted-foreground' },
    { title: 'Total de Clientes', value: customersData.length.toString(), iconName: 'Users', trendText: null },
  ];

  const equipmentActivityChartData = aggregateEquipmentItemActivity(inventoryItems, rentals);
  const mostRentedTypesData = aggregateMostRentedTypes(rentals, inventoryItems, equipmentTypes);

  return (
    <div className="container mx-auto py-2">
      <DashboardActionTrigger />
      <PageHeader title="Visão Geral do Painel" icon={LayoutDashboard} description="Bem-vindo à DH Alugueis. Aqui está um resumo do seu negócio." />
      <DashboardDisplay
        overviewCards={overviewCardsData}
        upcomingReturns={upcomingReturns}
        pendingPaymentRentals={pendingPaymentRentals}
        customers={customersData}
        monthlyLineChartData={aggregatedMonthly}
        equipmentActivityChartData={equipmentActivityChartData}
        mostRentedTypesData={mostRentedTypesData}
      />
    </div>
  );
}
