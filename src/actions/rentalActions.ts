
'use server';

import type { Rental, PaymentMethod, Equipment as InventoryEquipment, RentalPhoto, Payment } from '@/types';
import { revalidatePath } from 'next/cache';
import { getCustomerById } from './customerActions';
import { getInventoryItemById } from './inventoryActions';
import { getDb } from '@/lib/database';
import crypto from 'crypto';
import { saveFile, deleteFile } from '@/lib/file-storage';
import { addDays, format, parseISO, getDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { countBillableDays, findNthBillableDay } from '@/lib/utils';
import { validateServerSession } from '@/lib/auth-utils';


export async function getRentals(): Promise<Rental[]> {
  await validateServerSession();
  const db = getDb();
  try {
    const rentalRows = db.prepare(`
      SELECT r.*, 
             json_group_array(json_object('equipmentId', re.equipmentId, 'quantity', re.quantity, 'name', re.name, 'customDailyRentalRate', re.customDailyRentalRate)) as equipmentJson,
             (SELECT json_group_array(json_object('id', rp.id, 'imageUrl', rp.imageUrl, 'photoType', rp.photoType, 'uploadedAt', rp.uploadedAt)) FROM rental_photos rp WHERE rp.rentalId = r.id) as photosJson,
             (SELECT json_group_array(json_object('id', p.id, 'amount', p.amount, 'paymentDate', p.paymentDate, 'paymentMethod', p.paymentMethod, 'isPartial', p.isPartial)) FROM payments p WHERE p.rentalId = r.id) as paymentsJson
      FROM rentals r
      LEFT JOIN rental_equipment re ON r.id = re.rentalId
      GROUP BY r.id
      ORDER BY r.rentalStartDate DESC
    `).all() as Array<any>;

    return rentalRows.map(row => ({
      ...row,
      equipment: row.equipmentJson ? JSON.parse(row.equipmentJson).filter((eq: any) => eq.equipmentId !== null) : [],
      photos: row.photosJson ? JSON.parse(row.photosJson).filter((ph: any) => ph && ph.id !== null) : [],
      payments: row.paymentsJson ? JSON.parse(row.paymentsJson).filter((p: any) => p && p.id !== null) : [],
      actualReturnDate: row.actualReturnDate || null, 
      paymentDate: row.paymentDate || null, 
      notes: row.notes || null,
      deliveryAddress: row.deliveryAddress || 'A definir', 
      isOpenEnded: row.isOpenEnded === 1,
      chargeSaturdays: row.chargeSaturdays !== 0,
      chargeSundays: row.chargeSundays !== 0,
      returnNotificationSent: row.returnNotificationSent || null,
      fuelValue: row.fuelValue ?? 0,
      deliveredWithFullTank: row.deliveredWithFullTank === 1,
    }));
  } catch (error) {
    console.error("Failed to fetch rentals:", error);
    return [];
  }
}

export async function getRentalById(id: number): Promise<Rental | undefined> {
  await validateServerSession();
  const db = getDb();
  try {
    const row = db.prepare(`
      SELECT r.*, 
             json_group_array(json_object('equipmentId', re.equipmentId, 'quantity', re.quantity, 'name', re.name, 'customDailyRentalRate', re.customDailyRentalRate)) as equipmentJson,
             (SELECT json_group_array(json_object('id', rp.id, 'imageUrl', rp.imageUrl, 'photoType', rp.photoType, 'uploadedAt', rp.uploadedAt)) FROM rental_photos rp WHERE rp.rentalId = r.id) as photosJson,
             (SELECT json_group_array(json_object('id', p.id, 'amount', p.amount, 'paymentDate', p.paymentDate, 'paymentMethod', p.paymentMethod, 'isPartial', p.isPartial)) FROM payments p WHERE p.rentalId = r.id) as paymentsJson
      FROM rentals r
      LEFT JOIN rental_equipment re ON r.id = re.rentalId
      WHERE r.id = ?
      GROUP BY r.id
    `).get(id) as any;

    if (!row) return undefined;
    return {
      ...row,
      equipment: row.equipmentJson ? JSON.parse(row.equipmentJson).filter((eq: any) => eq.equipmentId !== null) : [],
      photos: row.photosJson ? JSON.parse(row.photosJson).filter((ph: any) => ph && ph.id !== null) : [],
      payments: row.paymentsJson ? JSON.parse(row.paymentsJson).filter((p: any) => p && p.id !== null) : [],
      actualReturnDate: row.actualReturnDate || null,
      paymentDate: row.paymentDate || null,
      notes: row.notes || null,
      deliveryAddress: row.deliveryAddress || 'A definir', 
      isOpenEnded: row.isOpenEnded === 1,
      chargeSaturdays: row.chargeSaturdays !== 0,
      chargeSundays: row.chargeSundays !== 0,
      returnNotificationSent: row.returnNotificationSent || null,
      fuelValue: row.fuelValue ?? 0,
      deliveredWithFullTank: row.deliveredWithFullTank === 1,
    };
  } catch (error) {
    console.error(`Failed to fetch rental with id ${id}:`, error);
    return undefined;
  }
}

export async function createRental(
  rentalData: Omit<Rental, 'id' | 'expectedReturnDate' | 'customerName' | 'payments'> & {
    equipment: Array<{ equipmentId: string; quantity: number; name?:string; customDailyRentalRate?: number | null }>;
  }
): Promise<Rental> {
  await validateServerSession();
  const db = getDb();
  
  const customer = await getCustomerById(rentalData.customerId);
  
  let finalRentalStartDateString: string;
  try {
    finalRentalStartDateString = format(parseISO(rentalData.rentalStartDate), 'yyyy-MM-dd');
  } catch (e) {
    console.error(`[SERVER ACTION - createRental] Invalid rentalStartDate format during creation: ${rentalData.rentalStartDate}`, e);
    throw new Error(`Formato inválido para Data de Início do Aluguel: ${rentalData.rentalStartDate}`);
  }

  const startDateForCalc = parseISO(finalRentalStartDateString);
  
  let expectedReturnDateString = finalRentalStartDateString;
  if (!rentalData.isOpenEnded) {
      const calculatedExpectedReturnDate = findNthBillableDay(
          startDateForCalc,
          rentalData.rentalDays,
          rentalData.chargeSaturdays ?? true,
          rentalData.chargeSundays ?? true
      );
      expectedReturnDateString = format(calculatedExpectedReturnDate, 'yyyy-MM-dd');
  }


  let formattedPaymentDate: string | undefined = undefined;
  if (rentalData.paymentDate) {
    try {
      formattedPaymentDate = format(parseISO(rentalData.paymentDate), 'yyyy-MM-dd');
    } catch (e) {
      console.warn(`[SERVER ACTION - createRental] Invalid paymentDate format during creation: ${rentalData.paymentDate}. It will be stored as undefined.`, e);
      formattedPaymentDate = undefined;
    }
  }

  const newRentalForDbBase = {
    customerId: rentalData.customerId,
    customerName: customer?.name || 'Cliente Desconhecido',
    rentalStartDate: finalRentalStartDateString,
    rentalDays: rentalData.rentalDays,
    expectedReturnDate: expectedReturnDateString,
    value: rentalData.value,
    paymentStatus: rentalData.paymentStatus,
    paymentMethod: rentalData.paymentMethod ?? 'nao_definido',
    chargeSaturdays: rentalData.chargeSaturdays ? 1 : 0,
    chargeSundays: rentalData.chargeSundays ? 1 : 0,
    isOpenEnded: rentalData.isOpenEnded ? 1 : 0,
    freightValue: rentalData.freightValue ?? 0,
    discountValue: rentalData.discountValue ?? 0,
    fuelValue: rentalData.fuelValue ?? 0,
    deliveredWithFullTank: rentalData.deliveredWithFullTank ? 1 : 0,
    paymentDate: formattedPaymentDate,
    notes: rentalData.notes ?? null,
    actualReturnDate: rentalData.actualReturnDate ?? null,
    deliveryAddress: rentalData.deliveryAddress && rentalData.deliveryAddress.trim() !== '' ? rentalData.deliveryAddress : 'A definir',
    returnNotificationSent: null,
  };
  
  const { equipment } = rentalData;
  const rentalFieldsToInsert = newRentalForDbBase;

  const insertRentalStmt = db.prepare(`
    INSERT INTO rentals (customerId, customerName, rentalStartDate, rentalDays, expectedReturnDate, actualReturnDate, freightValue, discountValue, fuelValue, deliveredWithFullTank, value, paymentStatus, paymentMethod, paymentDate, notes, deliveryAddress, isOpenEnded, chargeSaturdays, chargeSundays, returnNotificationSent)
    VALUES (@customerId, @customerName, @rentalStartDate, @rentalDays, @expectedReturnDate, @actualReturnDate, @freightValue, @discountValue, @fuelValue, @deliveredWithFullTank, @value, @paymentStatus, @paymentMethod, @paymentDate, @notes, @deliveryAddress, @isOpenEnded, @chargeSaturdays, @chargeSundays, @returnNotificationSent)
  `);

  const insertRentalEquipmentStmt = db.prepare(`
    INSERT INTO rental_equipment (rentalId, equipmentId, quantity, name, customDailyRentalRate)
    VALUES (@rentalId, @equipmentId, @quantity, @name, @customDailyRentalRate)
  `);

  const getEquipmentNameStmt = db.prepare('SELECT name FROM inventory WHERE id = ?');

  try {
    let insertedRentalId: number | bigint = -1;
    db.transaction(() => {
      const info = insertRentalStmt.run(rentalFieldsToInsert);
      insertedRentalId = info.lastInsertRowid;
      for (const eq of equipment) {
        let equipmentName = eq.name;
        if (!equipmentName) {
          const inventoryItem = getEquipmentNameStmt.get(eq.equipmentId) as { name: string } | undefined;
          equipmentName = inventoryItem?.name || 'Equipamento Desconhecido';
        }
        insertRentalEquipmentStmt.run({
          rentalId: insertedRentalId,
          equipmentId: eq.equipmentId,
          quantity: eq.quantity,
          name: equipmentName,
          customDailyRentalRate: eq.customDailyRentalRate
        });
      }
    })();
    revalidatePath('/dashboard/rentals');
    revalidatePath('/dashboard', 'layout'); 
    
    const finalNewRental: Rental = {
      ...newRentalForDbBase,
      id: Number(insertedRentalId),
      isOpenEnded: newRentalForDbBase.isOpenEnded === 1,
      chargeSaturdays: newRentalForDbBase.chargeSaturdays === 1,
      chargeSundays: newRentalForDbBase.chargeSundays === 1, 
      deliveredWithFullTank: newRentalForDbBase.deliveredWithFullTank === 1,
      equipment: equipment.map(eq => { 
          let equipmentName = eq.name;
          if (!equipmentName) {
            const inventoryItem = getEquipmentNameStmt.get(eq.equipmentId) as { name: string } | undefined;
            equipmentName = inventoryItem?.name || 'Equipamento Desconhecido';
          }
          return {...eq, name: equipmentName};
      })
    };
    return finalNewRental; 
  } catch (error) {
    console.error("====== DETAILED RENTAL CREATION FAILURE ======");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Raw Error Object:", error); 
    if (error instanceof Error) {
        console.error("Error Name:", error.name, "Error Message:", error.message, "Error Stack:", error.stack);
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        console.error("SQLite Error Code:", (error as { code: string }).code);
    }
    console.error("Data for rentalFieldsToInsert:", JSON.stringify(rentalFieldsToInsert, null, 2));
    console.error("Data for equipment loop:", JSON.stringify(equipment, null, 2));
    console.error("==============================================");
    throw new Error('Failed to create rental in database. Check server logs.');
  }
}

export async function updateRental(
  id: number, 
  rentalData: Partial<Omit<Rental, 'id' | 'expectedReturnDate' | 'customerName' | 'payments' >> & {
    equipment?: Array<{ equipmentId: string; quantity: number; name?:string; customDailyRentalRate?: number | null }>;
  }
): Promise<Rental | null> {
  await validateServerSession();
  const db = getDb();
  
  const existingRental = await getRentalById(id);
  if (!existingRental) return null;

  let updatedRentalData = { ...existingRental, ...rentalData };

  if (rentalData.customerId) {
    const customer = await getCustomerById(rentalData.customerId);
    updatedRentalData.customerName = customer?.name || 'Cliente Desconhecido';
  }
  
  let currentStartDateString = existingRental.rentalStartDate;
  if (rentalData.rentalStartDate) {
    try {
      currentStartDateString = format(parseISO(rentalData.rentalStartDate), 'yyyy-MM-dd');
      updatedRentalData.rentalStartDate = currentStartDateString;
    } catch (e) {
      console.error(`[SERVER ACTION - updateRental] Invalid rentalStartDate format: ${rentalData.rentalStartDate}`, e);
      throw new Error(`Formato inválido para Data de Início do Aluguel: ${rentalData.rentalStartDate}`);
    }
  }

  const isOpenEnded = typeof rentalData.isOpenEnded === 'boolean' ? rentalData.isOpenEnded : existingRental.isOpenEnded;
  const currentRentalDays = typeof rentalData.rentalDays === 'number' ? rentalData.rentalDays : existingRental.rentalDays;
  const chargeSaturdays = typeof rentalData.chargeSaturdays === 'boolean' ? rentalData.chargeSaturdays : (existingRental.chargeSaturdays ?? true);
  const chargeSundays = typeof rentalData.chargeSundays === 'boolean' ? rentalData.chargeSundays : (existingRental.chargeSundays ?? true);

  if (isOpenEnded) {
    updatedRentalData.expectedReturnDate = currentStartDateString;
  } else {
    // Always recalculate for fixed-term rentals to ensure consistency
    const startDateObjForCalc = parseISO(currentStartDateString);
    const calculatedExpectedReturnDate = findNthBillableDay(
        startDateObjForCalc, 
        currentRentalDays, 
        chargeSaturdays, 
        chargeSundays
    );
    updatedRentalData.expectedReturnDate = format(calculatedExpectedReturnDate, 'yyyy-MM-dd');
  }

  if (rentalData.hasOwnProperty('paymentDate')) {
    const paymentDateValue = rentalData.paymentDate;
    if (typeof paymentDateValue === 'string' && paymentDateValue.trim() !== '') {
        try {
            updatedRentalData.paymentDate = format(parseISO(paymentDateValue), 'yyyy-MM-dd');
        } catch {
            console.warn(`[SERVER ACTION - updateRental] Invalid paymentDate string during update: ${paymentDateValue}. Storing as undefined.`);
            updatedRentalData.paymentDate = undefined;
        }
    } else { 
      updatedRentalData.paymentDate = undefined;
    }
  }

  if (rentalData.hasOwnProperty('actualReturnDate')) {
    const actualReturnDateValue = rentalData.actualReturnDate;
     if (typeof actualReturnDateValue === 'string' && actualReturnDateValue.trim() !== '') {
        try {
            updatedRentalData.actualReturnDate = format(parseISO(actualReturnDateValue), 'yyyy-MM-dd');
        } catch {
            console.warn(`[SERVER ACTION - updateRental] Invalid actualReturnDate string during update: ${actualReturnDateValue}. Storing as undefined.`);
            updatedRentalData.actualReturnDate = undefined;
        }
    } else { 
      updatedRentalData.actualReturnDate = undefined;
    }
  }
  
  if (rentalData.hasOwnProperty('deliveryAddress')) {
    updatedRentalData.deliveryAddress = rentalData.deliveryAddress && rentalData.deliveryAddress.trim() !== '' ? rentalData.deliveryAddress : 'A definir';
  } else {
    updatedRentalData.deliveryAddress = existingRental.deliveryAddress || 'A definir';
  }

  const { equipment, ...rentalFieldsToUpdateBase } = {
    ...updatedRentalData,
    rentalDays: currentRentalDays,
    freightValue: updatedRentalData.freightValue ?? existingRental.freightValue ?? 0,
    discountValue: updatedRentalData.discountValue ?? existingRental.discountValue ?? 0,
    fuelValue: updatedRentalData.fuelValue ?? existingRental.fuelValue ?? 0,
    deliveredWithFullTank: typeof updatedRentalData.deliveredWithFullTank === 'boolean' ? (updatedRentalData.deliveredWithFullTank ? 1 : 0) : (existingRental.deliveredWithFullTank ? 1 : 0),
    paymentMethod: updatedRentalData.paymentMethod ?? existingRental.paymentMethod ?? 'nao_definido',
    notes: updatedRentalData.notes ?? existingRental.notes ?? null,
    actualReturnDate: updatedRentalData.actualReturnDate ?? existingRental.actualReturnDate ?? null,
    isOpenEnded: isOpenEnded ? 1 : 0,
    chargeSaturdays: chargeSaturdays ? 1 : 0,
    chargeSundays: chargeSundays ? 1 : 0,
    returnNotificationSent: updatedRentalData.returnNotificationSent ?? existingRental.returnNotificationSent ?? null,
  };
  
  const rentalFieldsToUpdate = { ...rentalFieldsToUpdateBase, id: id };


  const updateRentalStmt = db.prepare(`
    UPDATE rentals SET 
      customerId = @customerId, customerName = @customerName, rentalStartDate = @rentalStartDate, rentalDays = @rentalDays, 
      expectedReturnDate = @expectedReturnDate, actualReturnDate = @actualReturnDate, freightValue = @freightValue, discountValue = @discountValue,
      fuelValue = @fuelValue, deliveredWithFullTank = @deliveredWithFullTank, value = @value, paymentStatus = @paymentStatus, 
      paymentMethod = @paymentMethod, paymentDate = @paymentDate, notes = @notes,
      deliveryAddress = @deliveryAddress, isOpenEnded = @isOpenEnded, chargeSaturdays = @chargeSaturdays, chargeSundays = @chargeSundays,
      returnNotificationSent = @returnNotificationSent
    WHERE id = @id
  `);

  const deleteRentalEquipmentStmt = db.prepare('DELETE FROM rental_equipment WHERE rentalId = ?');
  const insertRentalEquipmentStmt = db.prepare(`
    INSERT INTO rental_equipment (rentalId, equipmentId, quantity, name, customDailyRentalRate)
    VALUES (@rentalId, @equipmentId, @quantity, @name, @customDailyRentalRate)
  `);
  const getEquipmentNameStmt = db.prepare('SELECT name FROM inventory WHERE id = ?');
  
  try {
    db.transaction(() => {
      updateRentalStmt.run(rentalFieldsToUpdate);
      if (equipment) {
        deleteRentalEquipmentStmt.run(id);
        for (const eq of equipment) {
           let equipmentName = eq.name;
           if (!equipmentName) {
             const inventoryItem = getEquipmentNameStmt.get(eq.equipmentId) as { name: string } | undefined;
             equipmentName = inventoryItem?.name || 'Equipamento Desconhecido';
           }
           insertRentalEquipmentStmt.run({
            rentalId: id,
            equipmentId: eq.equipmentId,
            quantity: eq.quantity,
            name: equipmentName,
            customDailyRentalRate: eq.customDailyRentalRate
          });
        }
      }
    })();
    revalidatePath('/dashboard/rentals');
    revalidatePath(`/dashboard/rentals/${id}`);
    revalidatePath(`/dashboard/rentals/${id}/details`);
    revalidatePath(`/dashboard/rentals/${id}/receipt`);
    revalidatePath('/dashboard', 'layout');
    const finalUpdatedRental = await getRentalById(id);
    return finalUpdatedRental || null;
  } catch (error) {
    console.error("====== DETAILED RENTAL UPDATE FAILURE ======");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Raw Error Object:", error);
    if (error instanceof Error) {
      console.error("Error Name:", error.name, "Error Message:", error.message, "Error Stack:", error.stack);
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        console.error("SQLite Error Code:", (error as { code: string }).code);
    }
    console.error("Data for rentalFieldsToUpdate:", JSON.stringify(rentalFieldsToUpdate, null, 2));
    if (equipment) {
      console.error("Data for equipment loop:", JSON.stringify(equipment, null, 2));
    }
    console.error("==============================================");
    throw new Error('Failed to update rental in database. Check server logs.');
  }
}

export async function deleteRental(id: number): Promise<{ success: boolean }> { 
  await validateServerSession();
  const db = getDb();
  
  const getPhotosStmt = db.prepare('SELECT imageUrl FROM rental_photos WHERE rentalId = ?');
  const photos = getPhotosStmt.all(id) as { imageUrl: string }[];
  for (const photo of photos) {
    if (photo.imageUrl) {
        await deleteFile(photo.imageUrl);
    }
  }

  const deletePhotosStmt = db.prepare('DELETE FROM rental_photos WHERE rentalId = ?');
  const deleteEquipmentStmt = db.prepare('DELETE FROM rental_equipment WHERE rentalId = ?');
  const deleteRentalStmt = db.prepare('DELETE FROM rentals WHERE id = ?');
  const deletePaymentsStmt = db.prepare('DELETE FROM payments WHERE rentalId = ?');
  
  try {
    db.transaction(() => {
        deletePaymentsStmt.run(id);
        deletePhotosStmt.run(id);
        deleteEquipmentStmt.run(id);
        deleteRentalStmt.run(id);
    })();
    
    revalidatePath('/dashboard/rentals');
    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (error) {
    console.error(`Failed to delete rental with id ${id}:`, error);
    return { success: false };
  }
}

function isNonBillableWeekend(date: Date, chargeSaturdays: boolean, chargeSundays: boolean): boolean {
    const dayOfWeek = getDay(date); // Sunday is 0, Saturday is 6
    if (dayOfWeek === 6 && !chargeSaturdays) {
        return true;
    }
    if (dayOfWeek === 0 && !chargeSundays) {
        return true;
    }
    return false;
}

export async function extendRental(
  rentalId: number,
  options: {
    type: 'fixed' | 'open_ended';
    additionalDays?: number;
    chargeSaturdays: boolean;
    chargeSundays: boolean;
  }
): Promise<Rental | null> {
  await validateServerSession();
  const db = getDb();
  const existingRental = await getRentalById(rentalId);

  if (!existingRental) {
    console.error(`extendRental: Rental with id ${rentalId} not found.`);
    return null;
  }

  if (existingRental.isOpenEnded) {
    console.error(`extendRental: Cannot extend an open-ended rental (ID: ${rentalId}).`);
    throw new Error('Não é possível prorrogar um aluguel que já está em aberto.');
  }

  // 1. Find the actual start date of the extension by skipping non-billable weekend days.
  let newRentalStartDateObj = addDays(parseISO(existingRental.expectedReturnDate), 1);
  while (isNonBillableWeekend(newRentalStartDateObj, options.chargeSaturdays, options.chargeSundays)) {
    newRentalStartDateObj = addDays(newRentalStartDateObj, 1);
  }

  // 2. Calculate daily rate and prepare equipment list for the new rental.
  let dailyRateSum = 0;
  const equipmentForNewRental: Array<{ equipmentId: string; quantity: number; name?: string; customDailyRentalRate?: number | null }> = [];
  for (const eqEntry of existingRental.equipment) {
    let rateToUse = eqEntry.customDailyRentalRate;
    if (rateToUse === undefined || rateToUse === null) {
      const itemDetails = await getInventoryItemById(eqEntry.equipmentId);
      rateToUse = itemDetails?.dailyRentalRate ?? 0;
    }
    dailyRateSum += eqEntry.quantity * rateToUse;
    equipmentForNewRental.push({
      equipmentId: eqEntry.equipmentId,
      quantity: eqEntry.quantity,
      name: eqEntry.name,
      customDailyRentalRate: eqEntry.customDailyRentalRate,
    });
  }

  // --- Type-Specific Logic ---
  let newRentalData: Omit<Rental, 'id' | 'expectedReturnDate' | 'customerName' | 'payments'> & { equipment: any[] };

  const baseRentalData = {
    customerId: existingRental.customerId,
    rentalStartDate: format(newRentalStartDateObj, 'yyyy-MM-dd'),
    equipment: equipmentForNewRental,
    paymentStatus: 'pending' as const,
    paymentMethod: existingRental.paymentMethod || 'pix',
    freightValue: 0, 
    fuelValue: 0, 
    deliveredWithFullTank: false, 
    discountValue: 0,
    notes: `Prorrogação do aluguel ID: ${rentalId}. Período anterior: ${format(parseISO(existingRental.rentalStartDate), 'dd/MM/yy', { locale: ptBR })} a ${format(parseISO(existingRental.expectedReturnDate), 'dd/MM/yy', { locale: ptBR })}.`,
    deliveryAddress: existingRental.deliveryAddress || 'A definir',
    chargeSaturdays: options.chargeSaturdays,
    chargeSundays: options.chargeSundays,
  };

  if (options.type === 'open_ended') {
    newRentalData = {
      ...baseRentalData,
      rentalDays: 0, 
      value: dailyRateSum, 
      isOpenEnded: true,
    };
  } else { 
    const additionalDays = options.additionalDays ?? 1;
    if (additionalDays <= 0) throw new Error("Additional days must be positive for a fixed extension.");
    
    const newRentalValue = dailyRateSum * additionalDays;

    newRentalData = {
      ...baseRentalData,
      rentalDays: additionalDays,
      value: newRentalValue,
      isOpenEnded: false,
    };
  }

  try {
    const newRental = await createRental(newRentalData);
    
    // CRITICAL: Mark the original rental as physically returned/finalized to avoid inventory conflict.
    // The items are now contractually covered by the new extension rental.
    db.prepare('UPDATE rentals SET actualReturnDate = ? WHERE id = ?').run(existingRental.expectedReturnDate, rentalId);
    
    revalidatePath('/dashboard/rentals');
    revalidatePath('/dashboard', 'layout');
    return newRental;
  } catch (error) {
    console.error(`Failed to create extension rental for original ID ${rentalId}:`, error);
    return null;
  }
}


export async function calculateAndCloseOpenEndedRental(id: number): Promise<Rental | null> {
  await validateServerSession();
  const db = getDb();
  const existingRental = await getRentalById(id);

  if (!existingRental) {
    throw new Error(`Aluguel com ID ${id} não encontrado.`);
  }
  if (!existingRental.isOpenEnded) {
    throw new Error(`Aluguel com ID ${id} não é um contrato em aberto.`);
  }

  const today = new Date();
  const formattedToday = format(today, 'yyyy-MM-dd');
  
  const billableDays = countBillableDays(
    existingRental.rentalStartDate,
    formattedToday,
    existingRental.chargeSaturdays ?? true,
    existingRental.chargeSundays ?? true
  );

  const finalValue = billableDays * existingRental.value;

  const updatePayload = {
    value: finalValue,
    rentalDays: billableDays,
    isOpenEnded: 0, 
    expectedReturnDate: formattedToday,
    paymentStatus: 'pending',
    id: id,
  };

  const stmt = db.prepare(`
    UPDATE rentals SET
      value = @value,
      rentalDays = @rentalDays,
      isOpenEnded = @isOpenEnded,
      expectedReturnDate = @expectedReturnDate,
      paymentStatus = @paymentStatus
    WHERE id = @id
  `);

  try {
    stmt.run(updatePayload);
    revalidatePath('/dashboard/rentals');
    revalidatePath('/dashboard', 'layout');
    revalidatePath(`/dashboard/rentals/${id}/details`);
    const updatedRental = await getRentalById(id);
    return updatedRental || null;
  } catch (error) {
    console.error(`Falha ao fechar o aluguel em aberto ID ${id}:`, error);
    throw new Error(`Falha ao fechar o aluguel em aberto ${id}.`);
  }
}

export async function finalizeRental(id: number): Promise<Rental | null> {
  await validateServerSession();
  const db = getDb();
  const existingRental = await getRentalById(id);

  if (!existingRental) {
    throw new Error(`Aluguel com ID ${id} não encontrado.`);
  }

  if (existingRental.actualReturnDate) {
    console.warn(`finalizeRental: Rental with id ${id} is already finalized.`);
    return existingRental; 
  }

  if (existingRental.isOpenEnded) {
      throw new Error('Não é possível finalizar um aluguel em aberto. Primeiro, calcule e feche o contrato para faturamento.');
  }

  const today = new Date();
  const formattedActualReturnDate = format(today, 'yyyy-MM-dd');
  
  try {
    const updateStmt = db.prepare('UPDATE rentals SET actualReturnDate = ? WHERE id = ?');
    updateStmt.run(formattedActualReturnDate, id);
    
    revalidatePath('/dashboard/rentals');
    revalidatePath('/dashboard', 'layout'); 
    revalidatePath(`/dashboard/rentals/${id}/details`);
    console.log(`Rental ${id} marked as returned with date ${formattedActualReturnDate}.`);
    
    const updatedRental = await getRentalById(id);
    return updatedRental || null;
  } catch (error) {
    console.error(`Failed to mark rental as returned with id ${id}:`, error);
    throw new Error(`Falha ao marcar o aluguel ${id} como devolvido.`);
  }
}

export async function unfinalizeRental(id: number): Promise<Rental | null> {
  await validateServerSession();
  const db = getDb();
  try {
    const updateStmt = db.prepare('UPDATE rentals SET actualReturnDate = NULL WHERE id = ?');
    updateStmt.run(id);
    
    revalidatePath('/dashboard/rentals');
    revalidatePath('/dashboard', 'layout'); 
    revalidatePath(`/dashboard/rentals/${id}/details`);
    
    const updatedRental = await getRentalById(id);
    return updatedRental || null;
  } catch (error) {
    console.error(`Failed to unfinalize rental with id ${id}:`, error);
    throw new Error('Falha ao reverter status de devolução.');
  }
}

export async function addRentalPhoto(rentalId: number, imageDataUrl: string, photoType: 'delivery' | 'return'): Promise<RentalPhoto> {
  await validateServerSession();
  const db = getDb();

  const imageUrl = await saveFile(imageDataUrl, 'rentals');

  const newId = `rpho_${crypto.randomBytes(8).toString('hex')}`;
  const newPhoto: RentalPhoto = {
    id: newId,
    rentalId,
    imageUrl, 
    photoType,
    uploadedAt: new Date().toISOString(),
  };

  try {
    const stmt = db.prepare('INSERT INTO rental_photos (id, rentalId, imageUrl, photoType, uploadedAt) VALUES (@id, @rentalId, @imageUrl, @photoType, @uploadedAt)');
    stmt.run(newPhoto);
    revalidatePath(`/dashboard/rentals/${rentalId}/details`);
    return newPhoto;
  } catch (error) {
    await deleteFile(imageUrl);
    console.error("Failed to add rental photo:", error);
    throw new Error('Failed to add photo to database.');
  }
}

export async function deleteRentalPhoto(photoId: string): Promise<{ success: boolean }> {
  await validateServerSession();
  const db = getDb();
  try {
    const getPhotoStmt = db.prepare('SELECT rentalId, imageUrl FROM rental_photos WHERE id = ?');
    const photo = getPhotoStmt.get(photoId) as { rentalId: number; imageUrl: string } | undefined;

    if (!photo) {
      throw new Error("Photo not found.");
    }

    await deleteFile(photo.imageUrl);

    const stmt = db.prepare('DELETE FROM rental_photos WHERE id = ?');
    const result = stmt.run(photoId);
    
    if (result.changes > 0 && photo) {
      revalidatePath(`/dashboard/rentals/${photo.rentalId}/details`);
    }
    return { success: result.changes > 0 };
  } catch (error) {
    console.error(`Failed to delete rental photo with id ${photoId}:`, error);
    throw new Error('Failed to delete photo from database.');
  }
}

export async function addPayment(
  rentalId: number,
  paymentData: Omit<Payment, 'id' | 'rentalId'>
): Promise<Rental | null> {
  await validateServerSession();
  const db = getDb();
  
  const paymentId = `pay_${crypto.randomBytes(8).toString('hex')}`;
  const newPayment: Payment = {
    id: paymentId,
    rentalId,
    ...paymentData,
  };

  const transaction = db.transaction(() => {
    const rentalRow = db.prepare('SELECT * FROM rentals WHERE id = ?').get(rentalId) as (Rental | undefined);
    if (!rentalRow) {
      throw new Error(`Aluguel com ID ${rentalId} não encontrado.`);
    }

    const existingPayments = db.prepare('SELECT * FROM payments WHERE rentalId = ?').all(rentalId) as Payment[];

    const insertPaymentStmt = db.prepare(
      'INSERT INTO payments (id, rentalId, amount, paymentDate, paymentMethod, isPartial) VALUES (@id, @rentalId, @amount, @paymentDate, @paymentMethod, @isPartial)'
    );
    insertPaymentStmt.run({ ...newPayment, isPartial: newPayment.isPartial ? 1 : 0 });

    const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0) + newPayment.amount;
    const remainingValue = rentalRow.value - totalPaid;
    
    const isNowFullyPaid = remainingValue < 0.01;
    let newPaymentStatus: Rental['paymentStatus'] = rentalRow.paymentStatus;
    
    if (isNowFullyPaid) {
        newPaymentStatus = 'paid';
    } else if (totalPaid > 0) {
        newPaymentStatus = 'pending';
    }
    
    const newPaymentDateForRental = isNowFullyPaid ? newPayment.paymentDate : rentalRow.paymentDate;

    const updateRentalStmt = db.prepare(
      'UPDATE rentals SET paymentStatus = @paymentStatus, paymentDate = @paymentDate, paymentMethod = @paymentMethod WHERE id = @id'
    );
    updateRentalStmt.run({
      id: rentalId,
      paymentStatus: newPaymentStatus,
      paymentDate: newPaymentDateForRental,
      paymentMethod: paymentData.paymentMethod, 
    });
  });

  try {
    transaction();
    
    revalidatePath(`/dashboard/rentals/${rentalId}/details`);
    revalidatePath('/dashboard/rentals');
    revalidatePath('/dashboard');
    
    const finalUpdatedRental = await getRentalById(rentalId);
    return finalUpdatedRental || null;

  } catch (error) {
    console.error(`Falha ao adicionar pagamento para o aluguel ${rentalId}:`, error);
    throw new Error(`Falha ao registrar pagamento no banco de dados. Detalhes: ${(error as Error).message}`);
  }
}
