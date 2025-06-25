
'use client';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogin = async (email: string, password?: string) => {
    if (!password) {
      // This should ideally be caught by form validation in AuthForm,
      // but as a safeguard:
      throw new Error("Senha é obrigatória para login.");
    }
    await login(email, password); 
  };

  if (isLoading || (!isLoading && isAuthenticated)) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return <AuthForm mode="login" onSubmit={handleLogin} initialAppName="DH Alugueis" />;
}
