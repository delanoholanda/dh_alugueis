
'use server';

import { getRentals } from '@/actions/rentalActions';
import { getExpenses } from '@/actions/financialActions';
import { PageHeader } from '@/components/layout/PageHeader';
import StatementClientPage from './components/StatementClientPage';
import type { Rental, Expense } from '@/types';
import { Banknote, FileText } from 'lucide-react';
import { parseISO } from 'date-fns';

export interface Transaction {
  date: Date;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  referenceId: string | number;
}

export default async function FinancialStatementPage() {
  const [rentals, expenses] = await Promise.all([
    getRentals(),
    getExpenses()
  ]);

  const incomeTransactions: Transaction[] = rentals
    .filter((r): r is Rental & { paymentDate: string } => r.paymentStatus === 'paid' && !!r.paymentDate)
    .map(r => ({
      date: parseISO(r.paymentDate),
      description: `Recebimento Aluguel #${r.id.toString().padStart(4, '0')} - ${r.customerName}`,
      type: 'income',
      amount: r.value,
      referenceId: r.id
    }));

  const expenseTransactions: Transaction[] = expenses.map(e => ({
    date: parseISO(e.date),
    description: e.description,
    type: 'expense',
    amount: e.amount,
    referenceId: e.id
  }));

  const allTransactions = [...incomeTransactions, ...expenseTransactions].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Extrato Financeiro Detalhado"
        icon={FileText}
        description="Visualize todas as entradas e saídas em ordem cronológica com filtros avançados."
      />
      <StatementClientPage initialTransactions={allTransactions} />
    </div>
  );
}
