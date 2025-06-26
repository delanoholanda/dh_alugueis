
'use server';

import type { Rental, PaymentMethod, Equipment as InventoryEquipment, RentalPhoto } from '@/types';
import { revalidatePath } from 'next/cache';
import { getCustomerById } from './customerActions';
import { getInventoryItemById } from './inventoryActions';
import { getDb } from '@/lib/database';
import crypto from 'crypto';
import { saveFile, deleteFile } from '@/lib/file-storage';
import { addDays, format, parseISO, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const countBillableDaysOnServer = (startDateStr: string, endDateStr: string, chargeSaturdays: boolean, chargeSundays: boolean): number => {
    try {
        const startDate = parseISO(startDateStr);
        const endDate = parseISO(endDateStr);
        if (startDate > endDate) return 0;

        const interval = { start: startDate, end: endDate };
        const daysInInterval = eachDayOfInterval(interval);
        
        let billableDays = 0;
        for (const day of daysInInterval) {
            const dayOfWeek = getDay(day); // 0=Sun, 6=Sat
            if (dayOfWeek === 6 && !chargeSaturdays) continue;
            if (dayOfWeek === 0 && !chargeSundays) continue;
            billableDays++;
        }
        return billableDays;
    } catch (e) {
      console.error("Error in countBillableDaysOnServer:", e);
      return 0;
    }
};


export async function getRentals(): Promise<Rental[]> {
  const db = getDb();
  try {
    const rentalRows = db.prepare(`
      SELECT r.*, 
             json_group_array(json_object('equipmentId', re.equipmentId, 'quantity', re.quantity, 'name', re.name, 'customDailyRentalRate', re.customDailyRentalRate)) as equipmentJson,
             (SELECT json_group_array(json_object('id', rp.id, 'imageUrl', rp.imageUrl, 'photoType', rp.photoType, 'uploadedAt', rp.uploadedAt)) FROM rental_photos rp WHERE rp.rentalId = r.id) as photosJson
      FROM rentals r
      LEFT JOIN rental_equipment re ON r.id = re.rentalId
      GROUP BY r.id
      ORDER BY r.rentalStartDate DESC
    `).all() as Array<any>;

    return rentalRows.map(row => ({
      ...row,
      equipment: row.equipmentJson ? JSON.parse(row.equipmentJson).filter((eq: any) => eq.equipmentId !== null) : [],
      photos: row.photosJson ? JSON.parse(row.photosJson).filter((ph: any) => ph && ph.id !== null) : [],
      actualReturnDate: row.actualReturnDate || null, 
      paymentDate: row.paymentDate || null, 
      notes: row.notes || null,
      deliveryAddress: row.deliveryAddress || 'A definir', 
      isOpenEnded: row.isOpenEnded === 1,
      chargeSaturdays: row.chargeSaturdays === 1,
      chargeSundays: row.chargeSundays === 1,
    }));
  } catch (error) {
    console.error("Failed to fetch rentals:", error);
    return [];
  }
}

export async function getRentalById(id: number): Promise<Rental | undefined> {
  const db = getDb();
  try {
    const row = db.prepare(`
      SELECT r.*, 
             json_group_array(json_object('equipmentId', re.equipmentId, 'quantity', re.quantity, 'name', re.name, 'customDailyRentalRate', re.customDailyRentalRate)) as equipmentJson,
             (SELECT json_group_array(json_object('id', rp.id, 'imageUrl', rp.imageUrl, 'photoType', rp.photoType, 'uploadedAt', rp.uploadedAt)) FROM rental_photos rp WHERE rp.rentalId = r.id) as photosJson
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
      actualReturnDate: row.actualReturnDate || null,
      paymentDate: row.paymentDate || null,
      notes: row.notes || null,
      deliveryAddress: row.deliveryAddress || 'A definir', 
      isOpenEnded: row.isOpenEnded === 1,
      chargeSaturdays: row.chargeSaturdays === 1,
      chargeSundays: row.chargeSundays === 1,
    };
  } catch (error) {
    console.error(`Failed to fetch rental with id ${id}:`, error);
    return undefined;
  }
}

export async function createRental(
  rentalData: Omit<Rental, 'id' | 'expectedReturnDate' | 'customerName'> & {
    equipment: Array<{ equipmentId: string; quantity: number; name?:string; customDailyRentalRate?: number | null }>;
  }
): Promise<Rental> {
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
      const daysForCalculation = rentalData.rentalDays >= 1 ? rentalData.rentalDays - 1 : 0;
      const calculatedExpectedReturnDate = addDays(startDateForCalc, daysForCalculation);
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
    paymentDate: formattedPaymentDate,
    notes: rentalData.notes ?? null,
    actualReturnDate: rentalData.actualReturnDate ?? null,
    deliveryAddress: rentalData.deliveryAddress && rentalData.deliveryAddress.trim() !== '' ? rentalData.deliveryAddress : 'A definir',
  };
  
  const { equipment } = rentalData;
  const rentalFieldsToInsert = newRentalForDbBase;

  const insertRentalStmt = db.prepare(`
    INSERT INTO rentals (customerId, customerName, rentalStartDate, rentalDays, expectedReturnDate, actualReturnDate, freightValue, discountValue, value, paymentStatus, paymentMethod, paymentDate, notes, deliveryAddress, isOpenEnded, chargeSaturdays, chargeSundays)
    VALUES (@customerId, @customerName, @rentalStartDate, @rentalDays, @expectedReturnDate, @actualReturnDate, @freightValue, @discountValue, @value, @paymentStatus, @paymentMethod, @paymentDate, @notes, @deliveryAddress, @isOpenEnded, @chargeSaturdays, @chargeSundays)
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
    revalidatePath('/dashboard/inventory'); 
    
    const finalNewRental: Rental = {
      ...newRentalForDbBase,
      id: Number(insertedRentalId),
      isOpenEnded: newRentalForDbBase.isOpenEnded === 1,
      chargeSaturdays: newRentalForDbBase.chargeSaturdays === 1,
      chargeSundays: newRentalForDbBase.chargeSundays === 1, 
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
  rentalData: Partial<Omit<Rental, 'id' | 'expectedReturnDate' | 'customerName' >> & {
    equipment?: Array<{ equipmentId: string; quantity: number; name?:string; customDailyRentalRate?: number | null }>;
  }
): Promise<Rental | null> {
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

  const isOpenEnded = rentalData.isOpenEnded ?? existingRental.isOpenEnded;
  let currentRentalDays = existingRental.rentalDays;
  if (rentalData.rentalDays !== undefined) {
    currentRentalDays = rentalData.rentalDays;
  }
  
  if (isOpenEnded) {
    updatedRentalData.expectedReturnDate = currentStartDateString;
  } else if (rentalData.rentalStartDate || rentalData.rentalDays !== undefined) {
      const startDateObjForCalc = parseISO(currentStartDateString);
      const daysForCalculation = currentRentalDays >= 1 ? currentRentalDays - 1 : 0;
      const calculatedExpectedReturnDate = addDays(startDateObjForCalc, daysForCalculation);
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
    freightValue: updatedRentalData.freightValue ?? existingRental.freightValue ?? 0,
    discountValue: updatedRentalData.discountValue ?? existingRental.discountValue ?? 0,
    paymentMethod: updatedRentalData.paymentMethod ?? existingRental.paymentMethod ?? 'nao_definido',
    notes: updatedRentalData.notes ?? existingRental.notes ?? null,
    actualReturnDate: updatedRentalData.actualReturnDate ?? existingRental.actualReturnDate ?? null,
    isOpenEnded: isOpenEnded ? 1 : 0,
    chargeSaturdays: (rentalData.chargeSaturdays ?? existingRental.chargeSaturdays) ? 1 : 0,
    chargeSundays: (rentalData.chargeSundays ?? existingRental.chargeSundays) ? 1 : 0,
  };
  
  const rentalFieldsToUpdate = { ...rentalFieldsToUpdateBase, id: id };


  const updateRentalStmt = db.prepare(`
    UPDATE rentals SET 
      customerId = @customerId, customerName = @customerName, rentalStartDate = @rentalStartDate, rentalDays = @rentalDays, 
      expectedReturnDate = @expectedReturnDate, actualReturnDate = @actualReturnDate, freightValue = @freightValue, discountValue = @discountValue,
      value = @value, paymentStatus = @paymentStatus, paymentMethod = @paymentMethod, paymentDate = @paymentDate, notes = @notes,
      deliveryAddress = @deliveryAddress, isOpenEnded = @isOpenEnded, chargeSaturdays = @chargeSaturdays, chargeSundays = @chargeSundays
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
    revalidatePath('/dashboard/inventory');
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
  const db = getDb();
  
  // First, get all photo URLs for this rental to delete the files
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
  
  try {
    db.transaction(() => {
        deletePhotosStmt.run(id);
        deleteEquipmentStmt.run(id);
        deleteRentalStmt.run(id);
    })();
    
    revalidatePath('/dashboard/rentals');
    revalidatePath('/dashboard/inventory');
    return { success: true };
  } catch (error) {
    console.error(`Failed to delete rental with id ${id}:`, error);
    return { success: false };
  }
}

export async function extendRental(
  rentalId: number, 
  additionalDays: number,
  chargeSaturdays: boolean,
  chargeSundays: boolean
): Promise<Rental | null> { 
  const existingRental = await getRentalById(rentalId);

  if (!existingRental) {
    console.error(`extendRental: Rental with id ${rentalId} not found.`);
    return null;
  }
  
  if (existingRental.isOpenEnded) {
    console.error(`extendRental: Cannot extend an open-ended rental (ID: ${rentalId}).`);
    throw new Error('Não é possível prorrogar um aluguel que já está em aberto.');
  }

  const originalExpectedReturnDate = parseISO(existingRental.expectedReturnDate);
  const newRentalStartDateObj = addDays(originalExpectedReturnDate, 1);
  const newRentalEndDateObj = addDays(newRentalStartDateObj, additionalDays - 1);
  
  const newRentalStartDate = format(newRentalStartDateObj, 'yyyy-MM-dd');
  const newRentalEndDate = format(newRentalEndDateObj, 'yyyy-MM-dd');
  
  const billableDaysForExtension = countBillableDaysOnServer(
    newRentalStartDate,
    newRentalEndDate,
    chargeSaturdays,
    chargeSundays
  );

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
      customDailyRentalRate: eqEntry.customDailyRentalRate 
    });
  }

  const newRentalValue = dailyRateSum * billableDaysForExtension;

  const newRentalData: Omit<Rental, 'id' | 'expectedReturnDate' | 'customerName'> & {
    equipment: Array<{ equipmentId: string; quantity: number; name?: string; customDailyRentalRate?: number | null }>;
  } = {
    customerId: existingRental.customerId,
    rentalStartDate: newRentalStartDate, 
    rentalDays: additionalDays,
    equipment: equipmentForNewRental,
    value: newRentalValue,
    paymentStatus: 'pending', 
    paymentMethod: existingRental.paymentMethod || 'pix', 
    freightValue: 0, 
    discountValue: 0, 
    notes: `Extensão do aluguel ID: ${rentalId}. Período original de ${format(parseISO(existingRental.rentalStartDate), 'dd/MM/yyyy', { locale: ptBR })} a ${format(originalExpectedReturnDate, 'dd/MM/yyyy', { locale: ptBR })}.`,
    deliveryAddress: existingRental.deliveryAddress || 'A definir',
    isOpenEnded: false,
    chargeSaturdays: chargeSaturdays,
    chargeSundays: chargeSundays,
  };

  try {
    const newRental = await createRental(newRentalData);
    revalidatePath('/dashboard/rentals');
    revalidatePath('/dashboard/inventory');
    return newRental;
  } catch (error) {
    console.error(`Failed to create extension rental for original ID ${rentalId}:`, error);
    return null; 
  }
}


export async function calculateAndCloseOpenEndedRental(id: number): Promise<Rental | null> {
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
  
  const billableDays = countBillableDaysOnServer(
    existingRental.rentalStartDate,
    formattedToday,
    existingRental.chargeSaturdays ?? true,
    existingRental.chargeSundays ?? true
  );

  // For open-ended rentals, `value` stores the daily rate.
  const finalValue = billableDays * existingRental.value;

  const updatePayload = {
    value: finalValue,
    rentalDays: billableDays,
    isOpenEnded: 0, // false
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
    revalidatePath(`/dashboard/rentals/${id}/details`);
    const updatedRental = await getRentalById(id);
    return updatedRental || null;
  } catch (error) {
    console.error(`Falha ao fechar o aluguel em aberto ID ${id}:`, error);
    throw new Error(`Falha ao fechar o aluguel em aberto ${id}.`);
  }
}

export async function finalizeRental(id: number): Promise<Rental | null> {
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

  if (existingRental.paymentStatus !== 'paid') {
      throw new Error('Não é possível finalizar um aluguel com pagamento pendente ou em atraso.');
  }

  const today = new Date();
  const formattedActualReturnDate = format(today, 'yyyy-MM-dd');
  
  try {
    // This action now only marks the physical return of items.
    const updatedRental = await updateRental(id, { actualReturnDate: formattedActualReturnDate });
    if (updatedRental) {
      revalidatePath('/dashboard/rentals');
      revalidatePath('/dashboard/inventory'); 
      console.log(`Rental ${id} marked as returned with date ${formattedActualReturnDate}.`);
    }
    return updatedRental;
  } catch (error) {
    console.error(`Failed to mark rental as returned with id ${id}:`, error);
    throw new Error(`Falha ao marcar o aluguel ${id} como devolvido.`);
  }
}

export async function addRentalPhoto(rentalId: number, imageDataUrl: string, photoType: 'delivery' | 'return'): Promise<RentalPhoto> {
  const db = getDb();

  // Save the file and get the public URL
  const imageUrl = await saveFile(imageDataUrl, 'rentals');

  const newId = `rpho_${crypto.randomBytes(8).toString('hex')}`;
  const newPhoto: RentalPhoto = {
    id: newId,
    rentalId,
    imageUrl, // Store the public path
    photoType,
    uploadedAt: new Date().toISOString(),
  };

  try {
    const stmt = db.prepare('INSERT INTO rental_photos (id, rentalId, imageUrl, photoType, uploadedAt) VALUES (@id, @rentalId, @imageUrl, @photoType, @uploadedAt)');
    stmt.run(newPhoto);
    revalidatePath(`/dashboard/rentals/${rentalId}/details`);
    return newPhoto;
  } catch (error) {
    // If DB insert fails, try to delete the file we just saved
    await deleteFile(imageUrl);
    console.error("Failed to add rental photo:", error);
    throw new Error('Failed to add photo to database.');
  }
}

export async function deleteRentalPhoto(photoId: string): Promise<{ success: boolean }> {
  const db = getDb();
  try {
    const getPhotoStmt = db.prepare('SELECT rentalId, imageUrl FROM rental_photos WHERE id = ?');
    const photo = getPhotoStmt.get(photoId) as { rentalId: number; imageUrl: string } | undefined;

    if (!photo) {
      throw new Error("Photo not found.");
    }

    // Delete the file from the filesystem first
    await deleteFile(photo.imageUrl);

    // Then delete the record from the database
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
