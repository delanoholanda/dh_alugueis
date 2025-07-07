
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { format, subDays, startOfMonth, endOfMonth, startOfYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import type { Transaction } from '../page';
import { formatToBRL, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Scale, DollarSign, Calendar } from 'lucide-react';

export default function StatementClientPage({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const { filteredTransactions, summary, startingBalance, endingBalance } = useMemo(() => {
    // First, calculate the balance of all transactions *before* the start of the selected range.
    const startOfRange = dateRange?.from ? dateRange.from : new Date(0);
    const initialBalance = initialTransactions
      .filter(t => t.date < startOfRange)
      .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

    // Filter transactions to be within the selected date range.
    const filtered = initialTransactions.filter(t => {
      if (!dateRange?.from) return true; // Show all if no start date
      const endOfRange = dateRange.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : new Date();
      return t.date >= dateRange.from && t.date <= endOfRange;
    });

    // Calculate summary cards based on the *filtered* transactions.
    const periodSummary = {
      totalIncome: filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
      totalExpense: filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
      netResult: 0, // Will be calculated below
    };
    periodSummary.netResult = periodSummary.totalIncome - periodSummary.totalExpense;
    
    // Calculate final running balance
    const finalBalance = initialBalance + periodSummary.netResult;

    return {
      filteredTransactions: filtered,
      summary: periodSummary,
      startingBalance: initialBalance,
      endingBalance: finalBalance
    };
  }, [initialTransactions, dateRange]);
  
  const runningBalanceMap = useMemo(() => {
    let currentBalance = startingBalance;
    const balanceMap = new Map<string | number, number>();
    // We need to iterate over the filtered list in chronological order to calculate running balance correctly
    const chronologicalTransactions = [...filteredTransactions].reverse(); 
    for(const t of chronologicalTransactions) {
      currentBalance += (t.type === 'income' ? t.amount : -t.amount);
      balanceMap.set(t.referenceId, currentBalance);
    }
    return balanceMap;
  }, [filteredTransactions, startingBalance]);

  const setPresetRange = (preset: 'last7' | 'last30' | 'thisMonth' | 'lastMonth') => {
    const today = new Date();
    let from: Date, to: Date = today;
    switch(preset) {
      case 'last7':
        from = subDays(today, 6);
        break;
      case 'last30':
        from = subDays(today, 29);
        break;
      case 'thisMonth':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case 'lastMonth':
        from = startOfMonth(subDays(startOfMonth(today), 1));
        to = endOfMonth(from);
        break;
    }
    setDateRange({ from, to });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Filtrar por Período</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPresetRange('last7')}>Últimos 7 Dias</Button>
            <Button variant="outline" onClick={() => setPresetRange('last30')}>Últimos 30 Dias</Button>
            <Button variant="outline" onClick={() => setPresetRange('thisMonth')}>Este Mês</Button>
            <Button variant="outline" onClick={() => setPresetRange('lastMonth')}>Mês Passado</Button>
          </div>
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entradas no Período</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatToBRL(summary.totalIncome)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saídas no Período</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatToBRL(summary.totalExpense)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resultado do Período</CardTitle>
            <Scale className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", summary.netResult >= 0 ? 'text-green-600' : 'text-red-600')}>{formatToBRL(summary.netResult)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Final Total</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatToBRL(endingBalance)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
          <CardDescription>
            {dateRange?.from ? `Mostrando transações de ${format(dateRange.from, 'PPP', { locale: ptBR })} a ${format(dateRange.to || new Date(), 'PPP', { locale: ptBR })}.` : "Mostrando todas as transações."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">Nenhuma transação encontrada para o período selecionado.</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredTransactions.map(transaction => (
                      <TableRow key={transaction.referenceId}>
                        <TableCell className="font-medium whitespace-nowrap">{format(transaction.date, 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell className="text-center">
                          {transaction.type === 'income' 
                            ? <span className="text-green-600 font-semibold">Entrada</span>
                            : <span className="text-red-600 font-semibold">Saída</span>
                          }
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", transaction.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                          {transaction.type === 'income' ? '+' : '-'} {formatToBRL(transaction.amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatToBRL(runningBalanceMap.get(transaction.referenceId) ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
                        <TableCell colSpan={4} className="text-right">Saldo Inicial do Período</TableCell>
                        <TableCell className="text-right font-mono">{formatToBRL(startingBalance)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
