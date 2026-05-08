
'use server';

import type { Purchase } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import crypto from 'crypto';
import { validateServerSession } from '@/lib/auth-utils';

export async function getPurchases(): Promise<Purchase[]> {
  await validateServerSession();
  const db = getDb();
  try {
    const stmt = db.prepare(`
      SELECT p.*, i.name as inventoryName 
      FROM purchases p
      LEFT JOIN inventory i ON p.inventoryId = i.id
      ORDER BY p.purchaseDate DESC
    `);
    const purchases = stmt.all() as any[];
    
    return purchases.map(p => ({
        ...p,
        inventoryName: p.inventoryName || 'Item Removido/Desconhecido',
        affectsStock: p.affectsStock === 1,
        batchId: p.batchId || p.id // Fallback for old records
    }));
  } catch (error) {
    console.error("Failed to fetch purchases:", error);
    return [];
  }
}

export async function createPurchase(purchaseData: Omit<Purchase, 'id' | 'inventoryName' | 'totalAmount' | 'batchId'>): Promise<Purchase> {
  await validateServerSession();
  const db = getDb();
  
  const totalAmount = (purchaseData.quantity * purchaseData.unitPrice) + (purchaseData.freightValue || 0) - (purchaseData.discountValue || 0);
  const newId = `pur_${crypto.randomBytes(8).toString('hex')}`;
  const batchId = `batch_${crypto.randomBytes(8).toString('hex')}`;
  
  const newPurchase = {
    ...purchaseData,
    id: newId,
    batchId: batchId,
    totalAmount,
    affectsStock: purchaseData.affectsStock ? 1 : 0
  };

  try {
    db.transaction(() => {
      const insertStmt = db.prepare(`
        INSERT INTO purchases (id, inventoryId, quantity, unitPrice, freightValue, discountValue, totalAmount, purchaseDate, notes, affectsStock, batchId) 
        VALUES (@id, @inventoryId, @quantity, @unitPrice, @freightValue, @discountValue, @totalAmount, @purchaseDate, @notes, @affectsStock, @batchId)
      `);
      insertStmt.run(newPurchase);

      // We update the inventory acquisition price based on the effective cost (landed cost)
      const effectiveUnitPrice = totalAmount / purchaseData.quantity;

      if (purchaseData.affectsStock) {
          const updateInventoryStmt = db.prepare(`
            UPDATE inventory 
            SET quantity = quantity + @quantity,
                unitAcquisitionPrice = @effectiveUnitPrice
            WHERE id = @inventoryId
          `);
          updateInventoryStmt.run({
            quantity: purchaseData.quantity,
            effectiveUnitPrice,
            inventoryId: purchaseData.inventoryId
          });
      } else {
          const updatePriceStmt = db.prepare(`
            UPDATE inventory 
            SET unitAcquisitionPrice = @effectiveUnitPrice
            WHERE id = @inventoryId
          `);
          updatePriceStmt.run({
            effectiveUnitPrice,
            inventoryId: purchaseData.inventoryId
          });
      }
    })();

    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/inventory/purchases');
    revalidatePath('/dashboard/financials/patrimony');
    revalidatePath('/dashboard', 'layout');

    const result = db.prepare('SELECT p.*, i.name as inventoryName FROM purchases p LEFT JOIN inventory i ON p.inventoryId = i.id WHERE p.id = ?').get(newId) as any;
    return { ...result, affectsStock: result.affectsStock === 1 };

  } catch (error) {
    console.error("Failed to create purchase:", error);
    throw new Error('Falha ao registrar compra no banco de dados.');
  }
}

export async function createBulkPurchase(data: {
    items: Array<{ inventoryId: string; quantity: number; unitPrice: number }>;
    freightValue: number;
    discountValue: number;
    purchaseDate: string;
    notes?: string;
    affectsStock: boolean;
}): Promise<{ success: boolean; count: number }> {
    await validateServerSession();
    const db = getDb();
    const batchId = `batch_${crypto.randomBytes(8).toString('hex')}`;

    const totalItemsBaseValue = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    try {
        db.transaction(() => {
            for (const item of data.items) {
                const itemLineBaseValue = item.quantity * item.unitPrice;
                
                // Proportion logic for both freight and discount
                const proportion = totalItemsBaseValue > 0 ? (itemLineBaseValue / totalItemsBaseValue) : (1 / data.items.length);
                const itemProportionalFreight = proportion * data.freightValue;
                const itemProportionalDiscount = proportion * data.discountValue;
                
                const totalLineAmount = itemLineBaseValue + itemProportionalFreight - itemProportionalDiscount;
                const effectiveUnitPrice = item.quantity > 0 ? (totalLineAmount / item.quantity) : 0;

                const newId = `pur_${crypto.randomBytes(8).toString('hex')}`;

                db.prepare(`
                    INSERT INTO purchases (id, inventoryId, quantity, unitPrice, freightValue, discountValue, totalAmount, purchaseDate, notes, affectsStock, batchId) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    newId, 
                    item.inventoryId, 
                    item.quantity, 
                    item.unitPrice, 
                    itemProportionalFreight, 
                    itemProportionalDiscount,
                    totalLineAmount, 
                    data.purchaseDate, 
                    data.notes || null, 
                    data.affectsStock ? 1 : 0,
                    batchId
                );

                if (data.affectsStock) {
                    db.prepare(`
                        UPDATE inventory 
                        SET quantity = quantity + ?,
                            unitAcquisitionPrice = ?
                        WHERE id = ?
                    `).run(item.quantity, effectiveUnitPrice, item.inventoryId);
                } else {
                    db.prepare(`
                        UPDATE inventory 
                        SET unitAcquisitionPrice = ?
                        WHERE id = ?
                    `).run(effectiveUnitPrice, item.inventoryId);
                }
            }
        })();

        revalidatePath('/dashboard/inventory');
        revalidatePath('/dashboard/inventory/purchases');
        revalidatePath('/dashboard/financials/patrimony');
        revalidatePath('/dashboard', 'layout');

        return { success: true, count: data.items.length };
    } catch (error) {
        console.error("Failed to create bulk purchase:", error);
        throw new Error('Falha ao registrar compras em lote.');
    }
}

export async function deleteBatchPurchase(batchId: string): Promise<{ success: boolean }> {
    await validateServerSession();
    const db = getDb();
    
    try {
        const batchItems = db.prepare('SELECT * FROM purchases WHERE batchId = ?').all(batchId) as any[];
        if (batchItems.length === 0) return { success: false };

        db.transaction(() => {
            for (const purchase of batchItems) {
                // 1. Reverter Estoque se necessário
                if (purchase.affectsStock === 1) {
                    db.prepare(`
                        UPDATE inventory 
                        SET quantity = MAX(0, quantity - ?)
                        WHERE id = ?
                    `).run(purchase.quantity, purchase.inventoryId);
                }

                // 2. Tentar restaurar o preço de aquisição anterior
                // Buscamos a compra anterior a esta para este item específico
                const previousPurchase = db.prepare(`
                    SELECT totalAmount, quantity FROM purchases 
                    WHERE inventoryId = ? AND batchId != ?
                    ORDER BY purchaseDate DESC, id DESC 
                    LIMIT 1
                `).get(purchase.inventoryId, batchId) as { totalAmount: number, quantity: number } | undefined;

                const priceToRestore = (previousPurchase && previousPurchase.quantity > 0) 
                    ? (previousPurchase.totalAmount / previousPurchase.quantity) 
                    : 0;
                
                db.prepare(`
                    UPDATE inventory 
                    SET unitAcquisitionPrice = ?
                    WHERE id = ?
                `).run(priceToRestore, purchase.inventoryId);

                // 3. Excluir o registro da compra
                db.prepare('DELETE FROM purchases WHERE id = ?').run(purchase.id);
            }
        })();

        revalidatePath('/dashboard/inventory');
        revalidatePath('/dashboard/inventory/purchases');
        revalidatePath('/dashboard/financials/patrimony');
        revalidatePath('/dashboard', 'layout');

        return { success: true };
    } catch (error) {
        console.error("Failed to delete batch purchase:", error);
        throw new Error(`Falha ao excluir compra: ${(error as Error).message}`);
    }
}

export async function getPatrimonySummary(): Promise<{ totalInvested: number; itemCount: number }> {
  await validateServerSession();
  const db = getDb();
  try {
    const result = db.prepare('SELECT SUM(quantity * unitAcquisitionPrice) as total, SUM(quantity) as count FROM inventory').get() as { total: number | null, count: number | null };
    return {
      totalInvested: result.total || 0,
      itemCount: result.count || 0,
    };
  } catch (error) {
    console.error("Failed to calculate patrimony summary:", error);
    return { totalInvested: 0, itemCount: 0 };
  }
}
