
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

  const incomeTransactions: Transaction[] = rentals.flatMap(r => 
    (r.payments || []).map(p => ({
      date: parseISO(p.paymentDate),
      description: `Pagamento Aluguel #${r.id.toString().padStart(4, '0')} - ${r.customerName}`,
      type: 'income',
      amount: p.amount,
      referenceId: p.id
    }))
  );

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
        title="Extrato Financeiro"
        icon={FileText}
        description="Visualize todas as entradas e saídas em ordem cronológica com filtros de data."
      />
      <StatementClientPage initialTransactions={allTransactions} />
    </div>
  );
}
