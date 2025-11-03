
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
        // A função getUserProfileFromCookie é uma Server Action que lê o cookie HttpOnly
        const userProfile = await getUserProfileFromCookie();

        if (userProfile) {
          setUser(userProfile);
          setIsAuthenticated(true);
          // Atualiza o localStorage para consistência da UI
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userProfile));
        } else {
          // Garante que o estado local esteja limpo se não houver sessão válida
          setIsAuthenticated(false);
          setUser(null);
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        }
      } catch (e) {
        console.error("Error checking user session:", e);
        setIsAuthenticated(false);
        setUser(null);
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
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
    
    // Server action to set the secure, HttpOnly cookie is now inside loginAction

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
