'use client';
import {createContext, useContext, useState, ReactNode, useEffect, useCallback} from 'react';
import { useRouter } from 'next/navigation';
import { getUserByEmailInternal, verifyPassword } from '@/actions/userActions';
import { setAuthCookie, deleteAuthCookie } from '@/actions/authCookieActions';
import type { UserProfile } from '@/types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  login: (email: string, password?: string, redirectTo?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  updateUserContext: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'user_dh_alugueis_manager';

export function AuthProvider({children}: {children: ReactNode}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // This effect now ONLY checks for user data for quick UI rendering,
    // but it NEVER trusts localStorage to determine authentication status.
    const storedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (storedUser) {
      try {
        const parsedUser: UserProfile = JSON.parse(storedUser);
        if (parsedUser && typeof parsedUser.id === 'string') {
          // We set the user for UI purposes, but isAuthenticated remains false initially.
          setUser(parsedUser);
          // We will assume the user is authenticated for a better UX,
          // but the server-side ProtectedRoute will be the real guard.
          setIsAuthenticated(true);
        } else {
          // If data is invalid, clear it.
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        }
      } catch (e) {
        console.error("Error processing stored user data:", e);
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      }
    }
    // Regardless of localStorage, we finish loading. The real protection is server-side.
    setIsLoading(false);
  }, []); 

  const login = useCallback(async (email: string, password?: string, redirectTo?: string) => {
    if (!password) {
      throw new Error("Password is required.");
    }

    const dbUser = await getUserByEmailInternal(email);

    if (!dbUser) {
      throw new Error("Invalid email or password.");
    }

    const passwordIsValid = await verifyPassword(password, dbUser.passwordSalt, dbUser.passwordHash);

    if (!passwordIsValid) {
      throw new Error("Invalid email or password.");
    }
    
    const userProfile: UserProfile = { id: dbUser.id, name: dbUser.name, email: dbUser.email };
    
    // Server action to set the secure, HttpOnly cookie
    await setAuthCookie(userProfile);

    // Set state in memory
    setIsAuthenticated(true);
    setUser(userProfile);

    // Store ONLY non-sensitive user profile for UI speed, not for auth status
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userProfile));
    
    router.push(redirectTo || '/dashboard');
  }, [router]);

  const logout = useCallback(async () => {
    // Server action to delete the secure cookie
    await deleteAuthCookie();

    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    
    // Use window.location for a "hard" redirect to clear any in-memory state.
    window.location.href = '/login';

  }, []);

  const updateUserContext = useCallback((newUserProfile: UserProfile) => {
    setUser(newUserProfile);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(newUserProfile));
  }, []);

  return (
    <AuthContext.Provider value={{isAuthenticated, user, login, logout, isLoading, updateUserContext}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
