
'use server';

import type { Equipment } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import crypto from 'crypto';
import { saveFile, deleteFile } from '@/lib/file-storage';

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
  let savedImageUrl: string | undefined = itemData.imageUrl;

  if (itemData.imageUrl && itemData.imageUrl.startsWith('data:image/')) {
    savedImageUrl = await saveFile(itemData.imageUrl, 'inventory');
  }

  const newId = `eq_${crypto.randomBytes(8).toString('hex')}`;
  const newItem: Equipment = { 
    ...itemData, 
    id: newId,
    imageUrl: savedImageUrl || ''
  };

  try {
    const stmt = db.prepare('INSERT INTO inventory (id, name, typeId, quantity, status, imageUrl, dailyRentalRate) VALUES (@id, @name, @typeId, @quantity, @status, @imageUrl, @dailyRentalRate)');
    stmt.run(newItem);
    revalidatePath('/dashboard/inventory');
    return newItem;
  } catch (error) {
     if (savedImageUrl && savedImageUrl.startsWith('/uploads/')) {
      await deleteFile(savedImageUrl);
    }
    console.error("Failed to create inventory item:", error);
    throw new Error('Failed to create inventory item in database.');
  }
}

export async function updateInventoryItem(id: string, itemData: Partial<Omit<Equipment, 'id'>>): Promise<Equipment | null> {
  const db = getDb();
  try {
    const existingItem = await getInventoryItemById(id);
    if (!existingItem) return null;

    const finalUpdateData: Partial<Equipment> = { ...itemData };

    if (itemData.imageUrl && itemData.imageUrl.startsWith('data:image/')) {
        if (existingItem.imageUrl && existingItem.imageUrl.startsWith('/uploads/')) {
            await deleteFile(existingItem.imageUrl);
        }
        finalUpdateData.imageUrl = await saveFile(itemData.imageUrl, 'inventory');
    } else if (itemData.imageUrl === '') {
        if (existingItem.imageUrl && existingItem.imageUrl.startsWith('/uploads/')) {
            await deleteFile(existingItem.imageUrl);
        }
        finalUpdateData.imageUrl = '';
    }

    const updatedItemForDb = { ...existingItem, ...finalUpdateData };

    const stmt = db.prepare('UPDATE inventory SET name = @name, typeId = @typeId, quantity = @quantity, status = @status, imageUrl = @imageUrl, dailyRentalRate = @dailyRentalRate WHERE id = @id');
    stmt.run(updatedItemForDb);
    revalidatePath('/dashboard/inventory');
    revalidatePath(`/dashboard/inventory/${id}`);
    return updatedItemForDb;
  } catch (error) {
    console.error(`Failed to update inventory item with id ${id}:`, error);
    throw new Error('Failed to update inventory item in database.');
  }
}

export async function deleteInventoryItem(id: string): Promise<{ success: boolean }> {
  const db = getDb();
  try {
    const itemToDelete = await getInventoryItemById(id);
    if(itemToDelete?.imageUrl) {
        await deleteFile(itemToDelete.imageUrl);
    }

    const stmt = db.prepare('DELETE FROM inventory WHERE id = ?');
    const result = stmt.run(id);
    revalidatePath('/dashboard/inventory');
    return { success: result.changes > 0 };
  } catch (error) {
    console.error(`Failed to delete inventory item with id ${id}:`, error);
    throw error; 
  }
}
