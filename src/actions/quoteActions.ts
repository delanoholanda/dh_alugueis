
'use server';

import type { Quote, Rental } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import { getCustomerById } from './customerActions';
import { createRental, getRentals } from './rentalActions';
import { format, parseISO, startOfDay, endOfDay, eachDayOfInterval, isWithinInterval, addDays } from 'date-fns';
import { findNthBillableDay } from '@/lib/utils';
import { getInventoryItems } from './inventoryActions';
import { validateServerSession } from '@/lib/auth-utils';


export async function getQuotes(): Promise<Quote[]> {
  await validateServerSession();
  const db = getDb();
  let quotes: Quote[] = [];
  try {
    const quoteRows = db.prepare(`
      SELECT * FROM quotes
      ORDER BY quoteDate DESC
    `).all() as Array<any>;

    if (quoteRows.length === 0) {
      return [];
    }

    const equipmentByQuoteId = new Map<number, any[]>();
    const quoteIds = quoteRows.map(r => r.id);

    if(quoteIds.length > 0) {
        const quoteEquipmentRows = db.prepare(`
            SELECT * FROM quote_equipment WHERE quoteId IN (${quoteIds.map(() => '?').join(',')})
        `).all(...quoteIds) as Array<{quoteId: number; equipmentId: string; quantity: number; name?: string; customDailyRentalRate?: number | null}>;

        for (const eq of quoteEquipmentRows) {
            if (!equipmentByQuoteId.has(eq.quoteId)) {
                equipmentByQuoteId.set(eq.quoteId, []);
            }
            equipmentByQuoteId.get(eq.quoteId)!.push(eq);
        }
    }
    
    quotes = quoteRows.map(row => ({
      ...row,
      chargeSaturdays: row.chargeSaturdays !== 0,
      chargeSundays: row.chargeSundays !== 0,
      equipment: equipmentByQuoteId.get(row.id) || [],
    }));

    return quotes;

  } catch (error) {
    console.error("Failed to fetch quotes:", error);
    return [];
  }
}

export async function getQuoteById(id: number): Promise<Quote | undefined> {
  await validateServerSession();
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as any;
    if (!row) return undefined;

    const equipmentRows = db.prepare('SELECT * FROM quote_equipment WHERE quoteId = ?').all(id) as any[];

    return {
      ...row,
      chargeSaturdays: row.chargeSaturdays !== 0,
      chargeSundays: row.chargeSundays !== 0,
      equipment: equipmentRows || [],
    };
  } catch (error) {
    console.error(`Failed to fetch quote with id ${id}:`, error);
    return undefined;
  }
}


export async function createQuote(
  quoteData: Omit<Quote, 'id' | 'expectedReturnDate' | 'customerName' | 'status' | 'quoteDate'> & {
    equipment: Array<{ equipmentId: string; quantity: number; name?:string; customDailyRentalRate?: number | null }>;
  }
): Promise<Quote> {
  await validateServerSession();
  const db = getDb();
  
  const customer = await getCustomerById(quoteData.customerId);
  const customerName = customer?.name || 'Cliente Desconhecido';
  const quoteDate = new Date().toISOString().split('T')[0];

  let finalRentalStartDateString: string;
  try {
    finalRentalStartDateString = format(parseISO(quoteData.rentalStartDate as any), 'yyyy-MM-dd');
  } catch (e) {
    console.error(`[SERVER ACTION - createQuote] Invalid rentalStartDate format: ${quoteData.rentalStartDate}`, e);
    throw new Error(`Formato inválido para Data de Início: ${quoteData.rentalStartDate}`);
  }
  
  const startDateForCalc = parseISO(finalRentalStartDateString);
  const calculatedExpectedReturnDate = findNthBillableDay(
      startDateForCalc,
      quoteData.rentalDays,
      quoteData.chargeSaturdays ?? true,
      quoteData.chargeSundays ?? true
  );
  const expectedReturnDateString = format(calculatedExpectedReturnDate, 'yyyy-MM-dd');

  const newQuoteForDb = {
    customerId: quoteData.customerId,
    customerName: customerName,
    quoteDate: quoteDate,
    rentalStartDate: finalRentalStartDateString,
    rentalDays: quoteData.rentalDays,
    expectedReturnDate: expectedReturnDateString,
    value: quoteData.value,
    freightValue: quoteData.freightValue ?? 0,
    discountValue: quoteData.discountValue ?? 0,
    notes: quoteData.notes ?? null,
    deliveryAddress: quoteData.deliveryAddress && quoteData.deliveryAddress.trim() !== '' ? quoteData.deliveryAddress : 'A definir',
    chargeSaturdays: (quoteData.chargeSaturdays ?? true) ? 1 : 0,
    chargeSundays: (quoteData.chargeSundays ?? true) ? 1 : 0,
    status: 'pending', // Always pending on creation
  };

  const insertQuoteStmt = db.prepare(`
    INSERT INTO quotes (customerId, customerName, quoteDate, rentalStartDate, rentalDays, expectedReturnDate, freightValue, discountValue, value, notes, deliveryAddress, chargeSaturdays, chargeSundays, status)
    VALUES (@customerId, @customerName, @quoteDate, @rentalStartDate, @rentalDays, @expectedReturnDate, @freightValue, @discountValue, @value, @notes, @deliveryAddress, @chargeSaturdays, @chargeSundays, @status)
  `);

  const insertQuoteEquipmentStmt = db.prepare(`
    INSERT INTO quote_equipment (quoteId, equipmentId, quantity, name, customDailyRentalRate)
    VALUES (@quoteId, @equipmentId, @quantity, @name, @customDailyRentalRate)
  `);
  
  const getEquipmentNameStmt = db.prepare('SELECT name FROM inventory WHERE id = ?');

  try {
    let insertedQuoteId: number | bigint = -1;
    db.transaction(() => {
      const info = insertQuoteStmt.run(newQuoteForDb);
      insertedQuoteId = info.lastInsertRowid;
      for (const eq of quoteData.equipment) {
        let equipmentName = eq.name;
        if (!equipmentName) {
          const inventoryItem = getEquipmentNameStmt.get(eq.equipmentId) as { name: string } | undefined;
          equipmentName = inventoryItem?.name || 'Equipamento Desconhecido';
        }
        insertQuoteEquipmentStmt.run({
          quoteId: insertedQuoteId,
          equipmentId: eq.equipmentId,
          quantity: eq.quantity,
          name: equipmentName,
          customDailyRentalRate: eq.customDailyRentalRate
        });
      }
    })();
    revalidatePath('/dashboard/quotes');
    revalidatePath('/dashboard', 'layout'); 
    
    const finalNewQuote: Quote = {
      ...newQuoteForDb,
      id: Number(insertedQuoteId),
      chargeSaturdays: newQuoteForDb.chargeSaturdays === 1,
      chargeSundays: newQuoteForDb.chargeSundays === 1,
      status: 'pending',
      equipment: quoteData.equipment.map(eq => {
          let equipmentName = eq.name;
          if (!equipmentName) {
            const inventoryItem = getEquipmentNameStmt.get(eq.equipmentId) as { name: string } | undefined;
            equipmentName = inventoryItem?.name || 'Equipamento Desconhecido';
          }
          return {...eq, name: equipmentName};
      })
    };
    return finalNewQuote; 
  } catch (error) {
    console.error("Failed to create quote in database:", error);
    throw new Error(`Failed to create quote in database. Details: ${(error as Error).message}`);
  }
}

export async function updateQuote(id: number, quoteData: Partial<Omit<Quote, 'id' | 'quoteDate'>>): Promise<Quote | null> {
    await validateServerSession();
    const db = getDb();
    const existingQuote = await getQuoteById(id);
    if (!existingQuote) {
        throw new Error('Orçamento não encontrado.');
    }

    const customer = await getCustomerById(quoteData.customerId || existingQuote.customerId);
    const customerName = customer?.name || existingQuote.customerName || 'Cliente Desconhecido';

    const startDate = quoteData.rentalStartDate ? parseISO(quoteData.rentalStartDate as any) : parseISO(existingQuote.rentalStartDate);
    const rentalDays = quoteData.rentalDays ?? existingQuote.rentalDays;
    const chargeSaturdays = quoteData.chargeSaturdays ?? existingQuote.chargeSaturdays ?? true;
    const chargeSundays = quoteData.chargeSundays ?? existingQuote.chargeSundays ?? true;
    const expectedReturnDate = findNthBillableDay(startDate, rentalDays, chargeSaturdays, chargeSundays);

    const updatedQuoteForDb = {
        id: id,
        customerId: quoteData.customerId || existingQuote.customerId,
        customerName: customerName,
        rentalStartDate: quoteData.rentalStartDate ? format(startDate, 'yyyy-MM-dd') : existingQuote.rentalStartDate,
        rentalDays: rentalDays,
        expectedReturnDate: format(expectedReturnDate, 'yyyy-MM-dd'),
        value: quoteData.value ?? existingQuote.value,
        freightValue: quoteData.freightValue ?? existingQuote.freightValue ?? 0,
        discountValue: quoteData.discountValue ?? existingQuote.discountValue ?? 0,
        notes: quoteData.notes ?? existingQuote.notes,
        deliveryAddress: (quoteData.deliveryAddress && quoteData.deliveryAddress.trim() !== '') ? quoteData.deliveryAddress : existingQuote.deliveryAddress,
        chargeSaturdays: chargeSaturdays ? 1 : 0,
        chargeSundays: chargeSundays ? 1 : 0,
        status: quoteData.status || existingQuote.status,
    };

    const updateStmt = db.prepare(`
        UPDATE quotes SET
        customerId = @customerId, customerName = @customerName, rentalStartDate = @rentalStartDate, rentalDays = @rentalDays,
        expectedReturnDate = @expectedReturnDate, value = @value, freightValue = @freightValue, discountValue = @discountValue,
        notes = @notes, deliveryAddress = @deliveryAddress, chargeSaturdays = @chargeSaturdays, chargeSundays = @chargeSundays, status = @status
        WHERE id = @id
    `);

    const deleteEquipmentStmt = db.prepare('DELETE FROM quote_equipment WHERE quoteId = ?');
    const insertEquipmentStmt = db.prepare('INSERT INTO quote_equipment (quoteId, equipmentId, quantity, name, customDailyRentalRate) VALUES (?, ?, ?, ?, ?)');

    try {
        db.transaction(() => {
            updateStmt.run(updatedQuoteForDb);
            if (quoteData.equipment) {
                deleteEquipmentStmt.run(id);
                for (const eq of quoteData.equipment) {
                    insertEquipmentStmt.run(id, eq.equipmentId, eq.quantity, eq.name, eq.customDailyRentalRate);
                }
            }
        })();
        revalidatePath('/dashboard/quotes');
        return (await getQuoteById(id)) || null;
    } catch (error) {
        console.error(`Failed to update quote with id ${id}:`, error);
        throw new Error('Falha ao atualizar o orçamento no banco de dados.');
    }
}

export async function deleteQuote(id: number): Promise<{ success: boolean }> {
    await validateServerSession();
    const db = getDb();
    const deleteEquipmentStmt = db.prepare('DELETE FROM quote_equipment WHERE quoteId = ?');
    const deleteQuoteStmt = db.prepare('DELETE FROM quotes WHERE id = ?');

    try {
        db.transaction(() => {
            deleteEquipmentStmt.run(id);
            const result = deleteQuoteStmt.run(id);
            if (result.changes === 0) {
                throw new Error('Orçamento não encontrado para exclusão.');
            }
        })();
        revalidatePath('/dashboard/quotes');
        return { success: true };
    } catch (error) {
        console.error(`Failed to delete quote with id ${id}:`, error);
        throw error;
    }
}

export async function convertQuoteToRental(quoteId: number): Promise<Rental> {
    await validateServerSession();
    const quote = await getQuoteById(quoteId);
    if (!quote) {
        throw new Error('Orçamento não encontrado.');
    }
    if (quote.status === 'converted') {
        throw new Error('Este orçamento já foi convertido em aluguel.');
    }

    const inventoryItems = await getInventoryItems();
    const allActiveRentals = await getRentals();

    // 1. Robust Availability Check for the period
    const startDate = startOfDay(parseISO(quote.rentalStartDate));
    const endDate = endOfDay(parseISO(quote.expectedReturnDate));
    const requestedInterval = { start: startDate, end: endDate };
    const daysToCheck = eachDayOfInterval(requestedInterval);
    
    const usageOnEachDay = new Map<string, Map<string, number>>();
    for (const day of daysToCheck) {
        usageOnEachDay.set(format(day, 'yyyy-MM-dd'), new Map<string, number>());
    }

    for (const rental of allActiveRentals) {
        // Ignorar contratos devolvidos
        if (rental.actualReturnDate) continue;

        const rStart = startOfDay(parseISO(rental.rentalStartDate));
        const rEnd = rental.isOpenEnded 
            ? addDays(new Date(), 365) // Projeta 1 ano se em aberto
            : endOfDay(parseISO(rental.expectedReturnDate));
        
        const rentalInterval = { start: rStart, end: rEnd };

        for (const day of daysToCheck) {
            if (isWithinInterval(day, rentalInterval)) {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayMap = usageOnEachDay.get(dayKey)!;
                for (const eq of rental.equipment) {
                    dayMap.set(eq.equipmentId, (dayMap.get(eq.equipmentId) || 0) + eq.quantity);
                }
            }
        }
    }

    // 2. Validate against Inventory
    for (const item of quote.equipment) {
        const inventoryItem = inventoryItems.find(inv => inv.id === item.equipmentId);
        if (!inventoryItem) continue;

        const baseAvailable = inventoryItem.status === 'rented' ? 0 : inventoryItem.quantity;
        
        for (const [dayKey, dayMap] of usageOnEachDay) {
            const alreadyRented = dayMap.get(item.equipmentId) || 0;
            const availableAtDay = Math.max(0, baseAvailable - alreadyRented);
            
            if (item.quantity > availableAtDay) {
                throw new Error(`Equipamento "${item.name}" não tem estoque suficiente para o dia ${format(parseISO(dayKey), 'dd/MM')}. Disponível: ${availableAtDay}, Solicitado: ${item.quantity}.`);
            }
        }
    }

    const rentalData = {
        customerId: quote.customerId,
        equipment: quote.equipment.map(eq => ({
            equipmentId: eq.equipmentId,
            quantity: eq.quantity,
            name: eq.name,
            customDailyRentalRate: eq.customDailyRentalRate
        })),
        rentalStartDate: quote.rentalStartDate,
        rentalDays: quote.rentalDays,
        value: quote.value,
        freightValue: quote.freightValue ?? 0,
        discountValue: quote.discountValue ?? 0,
        notes: quote.notes,
        deliveryAddress: quote.deliveryAddress,
        chargeSaturdays: quote.chargeSaturdays ?? true,
        chargeSundays: quote.chargeSundays ?? true,
        paymentStatus: 'pending' as const,
        paymentMethod: 'nao_definido' as const,
        isOpenEnded: false,
    };

    const db = getDb();
    
    try {
        const newRental = await createRental(rentalData);

        if (!newRental) {
            throw new Error('Falha ao criar o aluguel a partir do orçamento.');
        }

        // Marcar orçamento como convertido APÓS sucesso da criação do aluguel
        db.prepare('UPDATE quotes SET status = ? WHERE id = ?').run('converted', quoteId);
        
        revalidatePath('/dashboard/quotes');
        revalidatePath('/dashboard/rentals');
        revalidatePath('/dashboard', 'layout');
        return newRental;

    } catch (error) {
        console.error('Error converting quote to rental:', error);
        throw error;
    }
}
