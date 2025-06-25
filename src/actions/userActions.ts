
'use server';

import type { User, UserWithPasswordHash, UserProfile } from '@/types';
import { getDb } from '@/lib/database';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';

async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const hashToCompare = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hashToCompare === storedHash;
}

export async function createUser(userData: Omit<User, 'id'> & { password?: string }): Promise<UserProfile> {
  const db = getDb();
  if (!userData.password || userData.password.length < 6) {
    throw new Error('Password is required and must be at least 6 characters long.');
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(userData.email);
  if (existingUser) {
    throw new Error('User with this email already exists.');
  }

  const newId = `user_${crypto.randomBytes(8).toString('hex')}`;
  const { salt, hash } = await hashPassword(userData.password);

  const newUserForDb = {
    id: newId,
    name: userData.name,
    email: userData.email,
    passwordHash: hash,
    passwordSalt: salt,
  };

  try {
    const stmt = db.prepare('INSERT INTO users (id, name, email, passwordHash, passwordSalt) VALUES (@id, @name, @email, @passwordHash, @passwordSalt)');
    stmt.run(newUserForDb);
    revalidatePath('/dashboard/settings/users');
    return { id: newId, name: userData.name, email: userData.email };
  } catch (error) {
    console.error("Failed to create user:", error);
    throw new Error('Failed to create user in database.');
  }
}

export async function getUsers(): Promise<User[]> {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT id, name, email FROM users ORDER BY name ASC');
    const users = stmt.all() as User[];
    return users;
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return [];
  }
}

export async function getUserById(id: string): Promise<User | undefined> {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT id, name, email FROM users WHERE id = ?');
    const user = stmt.get(id) as User | undefined;
    return user;
  } catch (error) {
    console.error(`Failed to fetch user with id ${id}:`, error);
    return undefined;
  }
}

export async function getUserByEmailInternal(email: string): Promise<UserWithPasswordHash | undefined> {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT id, name, email, passwordHash, passwordSalt FROM users WHERE email = ?');
    const user = stmt.get(email) as UserWithPasswordHash | undefined;
    return user;
  } catch (error) {
    console.error(`Failed to fetch user with email ${email}:`, error);
    return undefined;
  }
}

export async function updateUser(id: string, userData: Partial<Omit<User, 'id'>> & { password?: string }): Promise<UserProfile | null> {
  const db = getDb();
  try {
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserWithPasswordHash | undefined;
    if (!currentUser) {
        throw new Error("User not found.");
    }
    
    let newPasswordHash = currentUser.passwordHash;
    let newPasswordSalt = currentUser.passwordSalt;

    if (userData.password) {
      if (userData.password.length < 6) {
        throw new Error('New password must be at least 6 characters long.');
      }
      const { salt, hash } = await hashPassword(userData.password);
      newPasswordHash = hash;
      newPasswordSalt = salt;
    }
    
    if (userData.email && userData.email !== currentUser.email) {
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(userData.email, id);
        if (existingUser) {
            throw new Error('This email address is already in use by another user.');
        }
    }

    const updatedUserForDb = {
      id: id,
      name: userData.name || currentUser.name,
      email: userData.email || currentUser.email,
      passwordHash: newPasswordHash,
      passwordSalt: newPasswordSalt,
    };

    const stmt = db.prepare('UPDATE users SET name = @name, email = @email, passwordHash = @passwordHash, passwordSalt = @passwordSalt WHERE id = @id');
    stmt.run(updatedUserForDb);
    revalidatePath('/dashboard/settings/users');
    return { id: id, name: updatedUserForDb.name, email: updatedUserForDb.email };
  } catch (error) {
    console.error(`Failed to update user with id ${id}:`, error);
    if (error instanceof Error) throw error;
    throw new Error('Failed to update user in database.');
  }
}

export async function deleteUser(id: string): Promise<{ success: boolean }> {
  const db = getDb();
  try {
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const result = countStmt.get() as { count: number };
    if (result.count <= 1) {
      throw new Error('Cannot delete the last user.');
    }

    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const deleteResult = stmt.run(id);
    revalidatePath('/dashboard/settings/users');
    return { success: deleteResult.changes > 0 };
  } catch (error) {
    console.error(`Failed to delete user with id ${id}:`, error);
    if (error instanceof Error) throw error;
    throw new Error('Failed to delete user from database.');
  }
}
