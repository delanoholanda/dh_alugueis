
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
    // A validação da sessão agora depende principalmente do cookie, mas usamos o localStorage
    // para uma rápida recuperação dos dados do usuário na interface sem precisar de uma nova chamada ao servidor.
    const storedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (storedUser) {
      try {
        const parsedUser: UserProfile = JSON.parse(storedUser);
        // Assumimos que, se o usuário está no localStorage, o cookie de sessão HTTP-Only existe.
        // A validação real acontecerá no servidor.
        if (parsedUser && typeof parsedUser.id === 'string') {
          setIsAuthenticated(true);
          setUser(parsedUser);
        } else {
          throw new Error('Stored user data is invalid.');
        }
      } catch (e) {
        console.error("Error processing stored user data:", e);
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        setIsAuthenticated(false);
        setUser(null);
        // Também devemos garantir que o cookie seja limpo se os dados locais estiverem corrompidos.
        deleteAuthCookie();
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
    
    // Server action to set the secure, HttpOnly cookie
    await setAuthCookie(userProfile);

    setIsAuthenticated(true);
    setUser(userProfile);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userProfile));
    
    router.push(redirectTo || '/dashboard');
  }, [router]);

  const logout = useCallback(async () => {
    // Server action to delete the secure cookie
    await deleteAuthCookie();

    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    
    // Usamos window.location para um redirecionamento "hard" que limpa qualquer estado em memória.
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
