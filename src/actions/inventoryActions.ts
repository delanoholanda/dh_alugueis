
'use server';

import type { Equipment } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import crypto from 'crypto';
import { saveFile, deleteFile } from '@/lib/file-storage';
import { validateServerSession } from '@/lib/auth-utils';

export async function getInventoryItems(): Promise<Equipment[]> {
  await validateServerSession();
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT * FROM inventory ORDER BY name ASC');
    const items = stmt.all() as any[];
    return items.map(item => ({
      ...item,
      forRental: item.forRental === 1 || item.forRental === null // Treat null as true for legacy data
    }));
  } catch (error) {
    console.error("Failed to fetch inventory items:", error);
    return [];
  }
}

export async function getInventoryItemById(id: string): Promise<Equipment | undefined> {
  await validateServerSession();
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT * FROM inventory WHERE id = ?');
    const item = stmt.get(id) as any;
    if (!item) return undefined;
    return {
      ...item,
      forRental: item.forRental === 1 || item.forRental === null
    };
  } catch (error) {
    console.error(`Failed to fetch inventory item with id ${id}:`, error);
    return undefined;
  }
}

export async function createInventoryItem(itemData: Omit<Equipment, 'id'>): Promise<Equipment> {
  await validateServerSession();
  const db = getDb();
  let savedImageUrl: string | undefined = itemData.imageUrl;

  if (itemData.imageUrl && itemData.imageUrl.startsWith('data:image/')) {
    savedImageUrl = await saveFile(itemData.imageUrl, 'inventory');
  }

  const newId = `eq_${crypto.randomBytes(8).toString('hex')}`;
  const newItem: Equipment = { 
    ...itemData, 
    id: newId,
    imageUrl: savedImageUrl || '',
    forRental: itemData.forRental ?? true // Ensure default true
  };

  try {
    const stmt = db.prepare('INSERT INTO inventory (id, name, typeId, quantity, status, imageUrl, dailyRentalRate, unitAcquisitionPrice, forRental) VALUES (@id, @name, @typeId, @quantity, @status, @imageUrl, @dailyRentalRate, @unitAcquisitionPrice, @forRental)');
    stmt.run({
        ...newItem,
        forRental: newItem.forRental ? 1 : 0
    });
    revalidatePath('/dashboard/inventory', 'layout');
    revalidatePath('/dashboard', 'layout');
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
  await validateServerSession();
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

    const stmt = db.prepare('UPDATE inventory SET name = @name, typeId = @typeId, quantity = @quantity, status = @status, imageUrl = @imageUrl, dailyRentalRate = @dailyRentalRate, unitAcquisitionPrice = @unitAcquisitionPrice, forRental = @forRental WHERE id = @id');
    stmt.run({
        ...updatedItemForDb,
        forRental: updatedItemForDb.forRental ? 1 : 0
    });
    revalidatePath('/dashboard/inventory', 'layout');
    revalidatePath(`/dashboard/inventory/${id}`);
    revalidatePath('/dashboard', 'layout');
    return updatedItemForDb;
  } catch (error) {
    console.error(`Failed to update inventory item with id ${id}:`, error);
    throw new Error('Failed to update inventory item in database.');
  }
}

export async function deleteInventoryItem(id: string): Promise<{ success: boolean; archived?: boolean; message?: string }> {
  await validateServerSession();
  const db = getDb();
  try {
    const itemToDelete = await getInventoryItemById(id);
    if (!itemToDelete) return { success: false, message: 'Item não encontrado.' };

    const isUsedInRentals = db.prepare('SELECT 1 FROM rental_equipment WHERE equipmentId = ? LIMIT 1').get(id);
    const isUsedInPurchases = db.prepare('SELECT 1 FROM purchases WHERE inventoryId = ? LIMIT 1').get(id);
    const isUsedInQuotes = db.prepare('SELECT 1 FROM quote_equipment WHERE equipmentId = ? LIMIT 1').get(id);

    if (isUsedInRentals || isUsedInPurchases || isUsedInQuotes) {
      const stmt = db.prepare('UPDATE inventory SET quantity = 0, forRental = 0 WHERE id = ?');
      stmt.run(id);
      revalidatePath('/dashboard/inventory', 'layout');
      revalidatePath('/dashboard', 'layout');
      return { 
        success: true, 
        archived: true, 
        message: 'O item possui histórico de aluguéis/compras e foi arquivado/desativado do estoque ativo.' 
      };
    } else {
      if (itemToDelete.imageUrl && itemToDelete.imageUrl.startsWith('/uploads/')) {
        await deleteFile(itemToDelete.imageUrl);
      }
      const stmt = db.prepare('DELETE FROM inventory WHERE id = ?');
      const result = stmt.run(id);
      revalidatePath('/dashboard/inventory', 'layout');
      revalidatePath('/dashboard', 'layout');
      return { success: result.changes > 0, message: 'Item excluído com sucesso.' };
    }
  } catch (error) {
    console.error(`Failed to delete inventory item with id ${id}:`, error);
    throw new Error(`Falha ao excluir item: ${(error as Error).message}`); 
  }
}
