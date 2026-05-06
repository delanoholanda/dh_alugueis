
'use server';

import type { ExpenseCategory } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import crypto from 'crypto';
import { validateServerSession } from '@/lib/auth-utils';

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  await validateServerSession();
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
  await validateServerSession();
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
