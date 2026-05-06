
'use client';
import {createContext, useContext, useState, ReactNode, useEffect, useCallback} from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/actions/userActions';
import { deleteAuthCookie, getUserProfileFromCookie } from '@/actions/authCookieActions';
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
    async function checkUserSession() {
      try {
        const userProfile = await getUserProfileFromCookie();

        if (userProfile) {
          setUser(userProfile);
          setIsAuthenticated(true);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userProfile));
        } else {
          // Se estiver em desenvolvimento e não houver cookie, 
          // usamos um usuário fictício para facilitar a visualização
          if (process.env.NODE_ENV !== 'production') {
            const devUser: UserProfile = { id: 'dev_user', name: 'Desenvolvedor', email: 'dev@dhalugueis.com' };
            setUser(devUser);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
            setUser(null);
            localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
          }
        }
      } catch (e) {
        console.error("Error checking user session:", e);
        if (process.env.NODE_ENV !== 'production') {
          setIsAuthenticated(true);
          setUser({ id: 'dev_user', name: 'Desenvolvedor', email: 'dev@dhalugueis.com' });
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    }
    checkUserSession();
  }, []);

  const login = useCallback(async (email: string, password?: string, redirectTo?: string) => {
    if (!password) {
      throw new Error("Senha é obrigatória.");
    }

    const userProfile = await loginAction(email, password);
    
    setIsAuthenticated(true);
    setUser(userProfile);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userProfile));
    
    router.push(redirectTo || '/dashboard');
  }, [router]);

  const logout = useCallback(async () => {
    await deleteAuthCookie();
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
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
