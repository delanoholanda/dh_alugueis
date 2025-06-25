
'use server';

import type { EquipmentType } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import crypto from 'crypto';


export async function getEquipmentTypes(): Promise<EquipmentType[]> {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT * FROM equipment_types ORDER BY name ASC');
    const types = stmt.all() as EquipmentType[];
    return types;
  } catch (error) {
    console.error("Failed to fetch equipment types:", error);
    return []; 
  }
}

export async function createEquipmentType(name: string, iconName?: string): Promise<EquipmentType> {
  const db = getDb();
  const newId = `type_${crypto.randomBytes(6).toString('hex')}`;
  const newType: EquipmentType = { id: newId, name, iconName: iconName || 'Package' };

  try {
    const stmt = db.prepare('INSERT INTO equipment_types (id, name, iconName) VALUES (@id, @name, @iconName)');
    stmt.run(newType);
    revalidatePath('/dashboard/settings/equipment-types');
    revalidatePath('/dashboard/inventory');
    return newType;
  } catch (error) {
    console.error("Failed to create equipment type:", error);
    throw new Error('Failed to create equipment type in database.');
  }
}

export async function updateEquipmentType(id: string, name: string, iconName?: string): Promise<EquipmentType | null> {
  const db = getDb();
  try {
    const stmt = db.prepare('UPDATE equipment_types SET name = @name, iconName = @iconName WHERE id = @id');
    const result = stmt.run({ name, iconName: iconName || 'Package', id });

    if (result.changes === 0) return null;

    revalidatePath('/dashboard/settings/equipment-types');
    revalidatePath('/dashboard/inventory');
    const updatedType = db.prepare('SELECT * FROM equipment_types WHERE id = ?').get(id) as EquipmentType;
    return updatedType;
  } catch (error) {
    console.error(`Failed to update equipment type with id ${id}:`, error);
    throw new Error('Failed to update equipment type in database.');
  }
}

export async function deleteEquipmentType(id: string): Promise<{ success: boolean }> {
  const db = getDb();
  try {
    const checkStmt = db.prepare('SELECT COUNT(*) as count FROM inventory WHERE typeId = ?');
    const usage = checkStmt.get(id) as { count: number };
    if (usage.count > 0) {
      throw new Error('Cannot delete equipment type: It is currently in use by inventory items.');
    }

    const stmt = db.prepare('DELETE FROM equipment_types WHERE id = ?');
    const result = stmt.run(id);
    revalidatePath('/dashboard/settings/equipment-types');
    revalidatePath('/dashboard/inventory');
    return { success: result.changes > 0 };
  } catch (error) {
    console.error(`Failed to delete equipment type with id ${id}:`, error);
    if (error instanceof Error && error.message.includes('in use by inventory items')) {
        throw error; 
    }
    return { success: false };
  }
}
