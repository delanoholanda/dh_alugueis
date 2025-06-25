
'use server';

import type { Customer } from '@/types';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/database';
import crypto from 'crypto';

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
  const newId = `cust_${crypto.randomBytes(8).toString('hex')}`;
  const newCustomer: Customer = { 
    ...customerData, 
    id: newId,
    cpf: customerData.cpf || null,
    imageUrl: customerData.imageUrl || undefined
  };

  try {
    const stmt = db.prepare('INSERT INTO customers (id, name, phone, address, cpf, imageUrl, responsiveness, rentalHistory) VALUES (@id, @name, @phone, @address, @cpf, @imageUrl, @responsiveness, @rentalHistory)');
    stmt.run(newCustomer);
    revalidatePath('/dashboard/customers');
    return newCustomer;
  } catch (error) {
    console.error("Failed to create customer:", error);
    throw new Error('Failed to create customer in database.');
  }
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<Customer | null> {
  const db = getDb();
  try {
    const existingCustomer = await getCustomerById(id);
    if (!existingCustomer) return null;

    const updatedCustomerData: Customer = { 
      ...existingCustomer, 
      ...customerData,
      id: existingCustomer.id, // Ensure id is explicitly carried over
      name: customerData.name ?? existingCustomer.name,
      phone: customerData.phone ?? existingCustomer.phone,
      address: customerData.address !== undefined ? customerData.address : existingCustomer.address,
      cpf: customerData.cpf !== undefined ? (customerData.cpf || null) : existingCustomer.cpf,
      imageUrl: customerData.imageUrl !== undefined ? customerData.imageUrl : existingCustomer.imageUrl,
      responsiveness: customerData.responsiveness ?? existingCustomer.responsiveness,
      rentalHistory: customerData.rentalHistory ?? existingCustomer.rentalHistory,
    };


    const stmt = db.prepare('UPDATE customers SET name = @name, phone = @phone, address = @address, cpf = @cpf, imageUrl = @imageUrl, responsiveness = @responsiveness, rentalHistory = @rentalHistory WHERE id = @id');
    stmt.run(updatedCustomerData);
    revalidatePath('/dashboard/customers');
    const updatedCustomer = await getCustomerById(id); // Fetch the fully updated customer
    return updatedCustomer || null;
  } catch (error) {
    console.error(`Failed to update customer with id ${id}:`, error);
    throw new Error('Failed to update customer in database.');
  }
}

export async function deleteCustomer(id: string): Promise<{ success: boolean }> {
  const db = getDb();
  try {
    // Verificar se o cliente possui algum aluguel associado
    const rentalCheckStmt = db.prepare('SELECT COUNT(*) as count FROM rentals WHERE customerId = ?');
    const rentalUsage = rentalCheckStmt.get(id) as { count: number };

    if (rentalUsage.count > 0) {
      throw new Error('Não é possível excluir o cliente: Existem contratos de aluguel associados a este cliente.');
    }

    const stmt = db.prepare('DELETE FROM customers WHERE id = ?');
    const result = stmt.run(id);
    revalidatePath('/dashboard/customers');
    return { success: result.changes > 0 };
  } catch (error) {
    console.error(`Failed to delete customer with id ${id}:`, error);
    // Repassar o erro para ser tratado pela interface do usuário
    if (error instanceof Error) {
        throw error;
    }
    // Fallback para erros não instanciados de Error
    throw new Error('Falha ao excluir cliente do banco de dados.');
  }
}
