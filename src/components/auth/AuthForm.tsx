
'use client';

import { useState, type FormEvent, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import type { CompanyDetails } from '@/types';
import { getCompanySettings } from '@/actions/settingsActions';

interface AuthFormProps {
  mode: 'login'; // Único modo suportado agora é login
  onSubmit: (email: string, password?: string) => Promise<void>;
  initialAppName?: string; 
}

const DEFAULT_COMPANY_LOGO = '/dh-alugueis-logo.png';
const DEFAULT_APP_NAME = "DH Alugueis";

export function AuthForm({ mode, onSubmit, initialAppName = DEFAULT_APP_NAME }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLogo, setCurrentLogo] = useState<string>(DEFAULT_COMPANY_LOGO);
  const [dynamicAppName, setDynamicAppName] = useState<string>(initialAppName);

  useEffect(() => {
    const loadDisplaySettings = async () => {
      try {
        const settings = await getCompanySettings();
        if (settings.companyLogoUrl) {
          setCurrentLogo(settings.companyLogoUrl);
        }
        if (settings.companyName) {
          setDynamicAppName(settings.companyName);
        }
      } catch (error) {
        console.error("Failed to load company settings for login page:", error);
        setCurrentLogo(DEFAULT_COMPANY_LOGO);
        setDynamicAppName(initialAppName);
      }
    };
    loadDisplaySettings();
  }, [initialAppName]);


  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onSubmit(email, password);
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl bg-black text-gray-200 border-neutral-700">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto inline-block h-[85px] w-[150px] relative">
            <Image 
              src={currentLogo} 
              alt={`${dynamicAppName} Logo`}
              layout="fill"
              objectFit="contain"
              priority
              key={currentLogo} 
            />
          </div>
          <CardTitle className="text-3xl font-headline text-primary">{dynamicAppName}</CardTitle>
          <CardDescription className="text-gray-400">
            Bem-vindo! Faça login para gerenciar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-200">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-neutral-800 border-neutral-600 text-gray-50 placeholder:text-neutral-400 focus-visible:ring-primary focus-visible:border-primary text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-200">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-neutral-800 border-neutral-600 text-gray-50 placeholder:text-neutral-400 focus-visible:ring-primary focus-visible:border-primary text-base pr-10"
                />
                 <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="sr-only">
                    {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  </span>
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : 'Entrar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
           <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {dynamicAppName}. Todos os direitos reservados.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
