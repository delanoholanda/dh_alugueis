
'use server';

import type { Customer } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import crypto from 'crypto';
import { saveFile, deleteFile } from '@/lib/file-storage';

export async function getCustomers(): Promise<Customer[]> {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT id, name, phone, address, cpf, imageUrl, responsiveness, rentalHistory FROM customers ORDER BY name ASC');
    const customers = stmt.all() as Customer[];
    return customers;
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return [];
  }
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT id, name, phone, address, cpf, imageUrl, responsiveness, rentalHistory FROM customers WHERE id = ?');
    const customer = stmt.get(id) as Customer | undefined;
    return customer;
  } catch (error) {
    console.error(`Failed to fetch customer with id ${id}:`, error);
    return undefined;
  }
}

export async function createCustomer(customerData: Omit<Customer, 'id'>): Promise<Customer> {
  const db = getDb();
  let savedImageUrl: string | undefined = customerData.imageUrl;
  
  if (customerData.imageUrl && customerData.imageUrl.startsWith('data:image/')) {
    savedImageUrl = await saveFile(customerData.imageUrl, 'customers');
  }

  const newId = `cust_${crypto.randomBytes(8).toString('hex')}`;
  const newCustomer: Customer = { 
    ...customerData, 
    id: newId,
    cpf: customerData.cpf || null,
    imageUrl: savedImageUrl || ''
  };

  try {
    const stmt = db.prepare('INSERT INTO customers (id, name, phone, address, cpf, imageUrl, responsiveness, rentalHistory) VALUES (@id, @name, @phone, @address, @cpf, @imageUrl, @responsiveness, @rentalHistory)');
    stmt.run(newCustomer);
    revalidatePath('/dashboard/customers');
    return newCustomer;
  } catch (error) {
    if (savedImageUrl && savedImageUrl.startsWith('/uploads/')) {
      await deleteFile(savedImageUrl);
    }
    console.error("Failed to create customer:", error);
    throw new Error('Failed to create customer in database.');
  }
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<Customer | null> {
  const db = getDb();
  try {
    const existingCustomer = await getCustomerById(id);
    if (!existingCustomer) return null;

    const finalUpdateData: Partial<Customer> = { ...customerData };

    if (customerData.imageUrl && customerData.imageUrl.startsWith('data:image/')) {
        if (existingCustomer.imageUrl && existingCustomer.imageUrl.startsWith('/uploads/')) {
            await deleteFile(existingCustomer.imageUrl);
        }
        finalUpdateData.imageUrl = await saveFile(customerData.imageUrl, 'customers');
    } else if (customerData.imageUrl === '') {
        if (existingCustomer.imageUrl && existingCustomer.imageUrl.startsWith('/uploads/')) {
            await deleteFile(existingCustomer.imageUrl);
        }
        finalUpdateData.imageUrl = '';
    }

    const updatedCustomerForDb = { ...existingCustomer, ...finalUpdateData };

    const stmt = db.prepare('UPDATE customers SET name = @name, phone = @phone, address = @address, cpf = @cpf, imageUrl = @imageUrl, responsiveness = @responsiveness, rentalHistory = @rentalHistory WHERE id = @id');
    stmt.run(updatedCustomerForDb);
    revalidatePath('/dashboard/customers');
    const updatedCustomer = await getCustomerById(id);
    return updatedCustomer || null;
  } catch (error) {
    console.error(`Failed to update customer with id ${id}:`, error);
    throw new Error('Failed to update customer in database.');
  }
}

export async function deleteCustomer(id: string): Promise<{ success: boolean }> {
  const db = getDb();
  try {
    const rentalCheckStmt = db.prepare('SELECT COUNT(*) as count FROM rentals WHERE customerId = ?');
    const rentalUsage = rentalCheckStmt.get(id) as { count: number };

    if (rentalUsage.count > 0) {
      throw new Error('Não é possível excluir o cliente: Existem contratos de aluguel associados a este cliente.');
    }

    const customerToDelete = await getCustomerById(id);
    if(customerToDelete?.imageUrl) {
        await deleteFile(customerToDelete.imageUrl);
    }

    const stmt = db.prepare('DELETE FROM customers WHERE id = ?');
    const result = stmt.run(id);
    revalidatePath('/dashboard/customers');
    return { success: result.changes > 0 };
  } catch (error) {
    console.error(`Failed to delete customer with id ${id}:`, error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error('Falha ao excluir cliente do banco de dados.');
  }
}
