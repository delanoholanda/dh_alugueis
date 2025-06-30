
'use server';

import type { Expense } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import crypto from 'crypto';

export async function getExpenses(): Promise<Expense[]> {
  const db = getDb();
  try {
    // Join with expense_categories to get categoryName
    const stmt = db.prepare(`
      SELECT e.*, ec.name as categoryName 
      FROM expenses e
      JOIN expense_categories ec ON e.categoryId = ec.id
      ORDER BY e.date DESC
    `);
    const expenses = stmt.all() as Expense[];
    return expenses;
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return [];
  }
}

async function getExpenseById(id: string): Promise<Expense | undefined> {
  const db = getDb();
  try {
    const stmt = db.prepare(`
        SELECT e.*, ec.name as categoryName 
        FROM expenses e
        JOIN expense_categories ec ON e.categoryId = ec.id
        WHERE e.id = ?
    `);
    const expense = stmt.get(id) as Expense | undefined;
    return expense;
  } catch (error) {
    console.error(`Failed to fetch expense with id ${id}:`, error);
    return undefined;
  }
}

export async function createExpense(expenseData: Omit<Expense, 'id' | 'categoryName'>): Promise<Expense> {
  const db = getDb();
  const newId = `exp_${crypto.randomBytes(8).toString('hex')}`;
  const newExpense: Omit<Expense, 'categoryName'> = { ...expenseData, id: newId };

  try {
    const stmt = db.prepare('INSERT INTO expenses (id, date, description, amount, categoryId) VALUES (@id, @date, @description, @amount, @categoryId)');
    stmt.run(newExpense);
    revalidatePath('/dashboard/financials');
    revalidatePath('/dashboard', 'layout');
    
    const createdExpense = await getExpenseById(newId);
    if (!createdExpense) {
        throw new Error('Failed to retrieve created expense after insert.');
    }
    return createdExpense;
  } catch (error) {
    console.error("Failed to create expense:", error);
    throw new Error('Failed to create expense in database.');
  }
}

export async function updateExpense(id: string, expenseData: Partial<Omit<Expense, 'id' | 'categoryName'>>): Promise<Expense | null> {
  const db = getDb();
  try {
    const getExpenseStmt = db.prepare('SELECT * FROM expenses WHERE id = ?');
    const existingExpense = getExpenseStmt.get(id) as Omit<Expense, 'categoryName'> | undefined;
    if (!existingExpense) {
      return null;
    }

    const updatedExpenseForDb = { ...existingExpense, ...expenseData };

    const stmt = db.prepare('UPDATE expenses SET date = @date, description = @description, amount = @amount, categoryId = @categoryId WHERE id = @id');
    stmt.run(updatedExpenseForDb);

    revalidatePath('/dashboard/financials');
    revalidatePath('/dashboard', 'layout');

    const updatedExpense = await getExpenseById(id);
    return updatedExpense || null;
  } catch (error) {
    console.error(`Failed to update expense with id ${id}:`, error);
    throw new Error('Failed to update expense in database.');
  }
}

export async function deleteExpense(id: string): Promise<{ success: boolean }> {
  const db = getDb();
  try {
    const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
    const result = stmt.run(id);
    revalidatePath('/dashboard/financials');
    revalidatePath('/dashboard', 'layout');
    return { success: result.changes > 0 };
  } catch (error) {
    console.error(`Failed to delete expense with id ${id}:`, error);
    return { success: false };
  }
}

export async function getFinancialSummary(): Promise<{ totalRevenue: number; totalExpenses: number; netProfit: number }> {
  const db = getDb();
  try {
    const revenueResult = db.prepare("SELECT SUM(value) as total FROM rentals WHERE paymentStatus = 'paid'").get() as { total: number | null };
    const totalRevenue = revenueResult.total || 0;

    const expensesResult = db.prepare('SELECT SUM(amount) as total FROM expenses').get() as { total: number | null };
    const totalExpenses = expensesResult.total || 0;
    
    const netProfit = totalRevenue - totalExpenses;

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
    };
  } catch (error) {
    console.error("Failed to calculate financial summary:", error);
    return { totalRevenue: 0, totalExpenses: 0, netProfit: 0 }; 
  }
}
