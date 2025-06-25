
'use server';

import type { ExpenseCategory } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import crypto from 'crypto';

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT * FROM expense_categories ORDER BY name ASC');
    const categories = stmt.all() as ExpenseCategory[];
    return categories;
  } catch (error) {
    console.error("Failed to fetch expense categories:", error);
    return []; 
  }
}

export async function createExpenseCategory(name: string, iconName?: string): Promise<ExpenseCategory> {
  const db = getDb();
  const newId = `expcat_${crypto.randomBytes(6).toString('hex')}`;
  // For now, default icon, can be expanded later
  const newCategory: ExpenseCategory = { id: newId, name, iconName: iconName || 'Tag' }; 

  try {
    const stmt = db.prepare('INSERT INTO expense_categories (id, name, iconName) VALUES (@id, @name, @iconName)');
    stmt.run(newCategory);
    revalidatePath('/dashboard/financials'); // Revalidate financials page where form might be
    return newCategory;
  } catch (error) {
    console.error("Failed to create expense category:", error);
    throw new Error('Failed to create expense category in database.');
  }
}

// Optional: updateExpenseCategory - can be added later if full CRUD is needed
/*
export async function updateExpenseCategory(id: string, name: string, iconName?: string): Promise<ExpenseCategory | null> {
  const db = getDb();
  try {
    const stmt = db.prepare('UPDATE expense_categories SET name = @name, iconName = @iconName WHERE id = @id');
    const result = stmt.run({ name, iconName: iconName || 'Tag', id });

    if (result.changes === 0) return null;

    revalidatePath('/dashboard/financials');
    const updatedCategory = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id) as ExpenseCategory;
    return updatedCategory;
  } catch (error) {
    console.error(`Failed to update expense category with id ${id}:`, error);
    throw new Error('Failed to update expense category in database.');
  }
}
*/

// Optional: deleteExpenseCategory - can be added later if full CRUD is needed
/*
export async function deleteExpenseCategory(id: string): Promise<{ success: boolean }> {
  const db = getDb();
  try {
    // Consider checking if category is in use by any expenses before deleting
    const checkStmt = db.prepare('SELECT COUNT(*) as count FROM expenses WHERE categoryId = ?');
    const usage = checkStmt.get(id) as { count: number };
    if (usage.count > 0) {
      throw new Error('Cannot delete expense category: It is currently in use by expenses.');
    }

    const stmt = db.prepare('DELETE FROM expense_categories WHERE id = ?');
    const result = stmt.run(id);
    revalidatePath('/dashboard/financials');
    return { success: result.changes > 0 };
  } catch (error) {
    console.error(`Failed to delete expense category with id ${id}:`, error);
    if (error instanceof Error && error.message.includes('in use by expenses')) {
        throw error; 
    }
    return { success: false };
  }
}
*/
