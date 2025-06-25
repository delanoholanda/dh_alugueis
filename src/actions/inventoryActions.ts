
'use server';

import type { Equipment } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import crypto from 'crypto';

export async function getInventoryItems(): Promise<Equipment[]> {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT * FROM inventory ORDER BY name ASC');
    const items = stmt.all() as Equipment[];
    return items;
  } catch (error) {
    console.error("Failed to fetch inventory items:", error);
    return [];
  }
}

export async function getInventoryItemById(id: string): Promise<Equipment | undefined> {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT * FROM inventory WHERE id = ?');
    const item = stmt.get(id) as Equipment | undefined;
    return item;
  } catch (error) {
    console.error(`Failed to fetch inventory item with id ${id}:`, error);
    return undefined;
  }
}

export async function createInventoryItem(itemData: Omit<Equipment, 'id'>): Promise<Equipment> {
  const db = getDb();
  const newId = `eq_${crypto.randomBytes(8).toString('hex')}`;
  const newItem: Equipment = { ...itemData, id: newId };

  try {
    const stmt = db.prepare('INSERT INTO inventory (id, name, typeId, quantity, status, imageUrl, dailyRentalRate) VALUES (@id, @name, @typeId, @quantity, @status, @imageUrl, @dailyRentalRate)');
    stmt.run(newItem);
    revalidatePath('/dashboard/inventory');
    return newItem;
  } catch (error) {
    console.error("Failed to create inventory item:", error);
    throw new Error('Failed to create inventory item in database.');
  }
}

export async function updateInventoryItem(id: string, itemData: Partial<Omit<Equipment, 'id'>>): Promise<Equipment | null> {
  const db = getDb();
  try {
    const existingItem = await getInventoryItemById(id);
    if (!existingItem) return null;

    const updatedItem = { ...existingItem, ...itemData };

    const stmt = db.prepare('UPDATE inventory SET name = @name, typeId = @typeId, quantity = @quantity, status = @status, imageUrl = @imageUrl, dailyRentalRate = @dailyRentalRate WHERE id = @id');
    stmt.run(updatedItem);
    revalidatePath('/dashboard/inventory');
    revalidatePath(`/dashboard/inventory/${id}`);
    return updatedItem;
  } catch (error) {
    console.error(`Failed to update inventory item with id ${id}:`, error);
    throw new Error('Failed to update inventory item in database.');
  }
}

export async function deleteInventoryItem(id: string): Promise<{ success: boolean }> {
  const db = getDb();
  try {
    const stmt = db.prepare('DELETE FROM inventory WHERE id = ?');
    const result = stmt.run(id);
    revalidatePath('/dashboard/inventory');
    return { success: result.changes > 0 };
  } catch (error) {
    console.error(`Failed to delete inventory item with id ${id}:`, error);
    throw error; 
  }
}
