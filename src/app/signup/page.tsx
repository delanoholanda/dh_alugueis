
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPageDisabled() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona para a página de login, pois o cadastro público foi desativado.
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p>Redirecionando...</p>
    </div>
  );
}