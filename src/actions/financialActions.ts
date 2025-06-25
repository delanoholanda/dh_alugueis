
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

export async function createExpense(expenseData: Omit<Expense, 'id' | 'categoryName'>): Promise<Expense> {
  const db = getDb();
  const newId = `exp_${crypto.randomBytes(8).toString('hex')}`;
  // categoryName is not stored, it's derived from categoryId via join
  const newExpense: Omit<Expense, 'categoryName'> = { ...expenseData, id: newId };

  try {
    // Insert categoryId instead of category (enum string)
    const stmt = db.prepare('INSERT INTO expenses (id, date, description, amount, categoryId) VALUES (@id, @date, @description, @amount, @categoryId)');
    stmt.run(newExpense);
    revalidatePath('/dashboard/financials');
    // To return the full Expense object with categoryName, we'd need to fetch it or find it from existing categories
    // For simplicity, we'll return what was inserted. The list will refresh with categoryName anyway.
    const createdExpense = db.prepare(`
        SELECT e.*, ec.name as categoryName 
        FROM expenses e
        JOIN expense_categories ec ON e.categoryId = ec.id
        WHERE e.id = ?
    `).get(newId) as Expense;
    return createdExpense;

  } catch (error) {
    console.error("Failed to create expense:", error);
    throw new Error('Failed to create expense in database.');
  }
}

export async function deleteExpense(id: string): Promise<{ success: boolean }> {
  const db = getDb();
  try {
    const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
    const result = stmt.run(id);
    revalidatePath('/dashboard/financials');
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
