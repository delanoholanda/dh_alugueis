
'use client';
import {createContext, useContext, useState, ReactNode, useEffect, useCallback} from 'react';
import { useRouter } from 'next/navigation';
import { getUserByEmailInternal, verifyPassword } from '@/actions/userActions';
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

export function AuthProvider({children}: {children: ReactNode}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedAuth = localStorage.getItem('isAuthenticated_dh_alugueis_manager');
    const storedUser = localStorage.getItem('user_dh_alugueis_manager');
    if (storedAuth === 'true' && storedUser) {
      try {
        const parsedUser: UserProfile = JSON.parse(storedUser);
        if (parsedUser && typeof parsedUser.id === 'string' && typeof parsedUser.name === 'string' && typeof parsedUser.email === 'string') {
          setIsAuthenticated(true);
          setUser(parsedUser);
        } else {
          throw new Error('Stored user data is invalid.');
        }
      } catch (e) {
        console.error("Error processing stored user data:", e);
        localStorage.removeItem('isAuthenticated_dh_alugueis_manager');
        localStorage.removeItem('user_dh_alugueis_manager');
        setIsAuthenticated(false);
        setUser(null);
      }
    }
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
    setIsAuthenticated(true);
    setUser(userProfile);
    localStorage.setItem('isAuthenticated_dh_alugueis_manager', 'true');
    localStorage.setItem('user_dh_alugueis_manager', JSON.stringify(userProfile));
    
    router.push(redirectTo || '/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('isAuthenticated_dh_alugueis_manager');
    localStorage.removeItem('user_dh_alugueis_manager');
    router.push('/login');
  }, [router]);

  const updateUserContext = useCallback((newUserProfile: UserProfile) => {
    setUser(newUserProfile);
    localStorage.setItem('user_dh_alugueis_manager', JSON.stringify(newUserProfile));
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
