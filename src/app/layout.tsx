
import type { Metadata, ResolvingMetadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/use-auth';
import { Toaster } from "@/components/ui/toaster";
import { getCompanySettings } from '@/actions/settingsActions';

export async function generateMetadata(
  {},
  parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    const settings = await getCompanySettings();
    const companyName = settings.companyName || 'DH Alugueis';
    const previousIcons = (await parent).icons || {}

    // Use company logo for favicon if available and it's a real URL, otherwise keep existing/default
    const faviconUrl = settings.companyLogoUrl && !settings.companyLogoUrl.startsWith('data:') 
      ? settings.companyLogoUrl 
      : '/icon.png';

    return {
      title: `${companyName} - Gerenciador`,
      description: 'Sistema de Gerenciamento de Aluguéis',
      icons: {
        ...previousIcons,
        icon: faviconUrl,
      },
    };
  } catch (error) {
    console.error("Falha ao gerar metadados dinâmicos:", error);
    // Fallback metadata in case of error
    return {
      title: 'DH Alugueis - Gerenciador',
      description: 'Sistema de Gerenciamento de Aluguéis',
      icons: {
        icon: '/icon.png',
      },
    };
  }
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Code+Pro:ital,wght@0,200..0,900;1,200..1,900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
