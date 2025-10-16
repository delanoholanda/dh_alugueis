
'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Settings as SettingsIcon, UserCircle, Bell, Image as ImageIconLucide, Building, FileText, Eye, EyeOff, Save, Mail, Send, Loader2, Signature, DatabaseBackup, Landmark, Upload, AlertTriangle, History, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import type { CompanyDetails, UserProfile } from '@/types';
import { updateUser } from '@/actions/userActions';
import { getCompanySettings, updateCompanySettings } from '@/actions/settingsActions';
import { sendTestEmail } from '@/actions/emailActions';
import { backupDatabase, restoreDatabaseFromPath, getBackupFiles, restoreDatabase } from '@/actions/databaseActions';


export default function SettingsPage() {
  const { user, updateUserContext } = useAuth();
  const { toast } = useToast();
  
  // State for the profile form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // State for preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false); 
  
  // State for company details form (managed with useState)
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails>({
    companyName: '',
    responsibleName: '',
    phone: '',
    address: '',
    email: '',
    pixKey: '',
    pixHolderName: '',
    pixBankIconUrl: '',
    contractTermsAndConditions: '',
    contractFooterText: '',
    companyLogoUrl: '',
    contractLogoUrl: '',
    signatureImageUrl: '',
  });
  const [isSavingCompanyDetails, setIsSavingCompanyDetails] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupFiles, setBackupFiles] = useState<string[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string>('');


  // Load all settings on component mount
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
    
    // Theme setup
    const isDarkModePreferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setDarkMode(savedTheme === 'dark');
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setDarkMode(isDarkModePreferred);
      document.documentElement.classList.toggle('dark', isDarkModePreferred);
    }

    const loadInitialData = async () => {
      try {
        const [settings, backups] = await Promise.all([
            getCompanySettings(),
            getBackupFiles()
        ]);
        setCompanyDetails(settings);
        setBackupFiles(backups);
        if (backups.length > 0) {
            setSelectedBackup(backups[0]);
        }
      } catch (error) {
        console.error("Failed to load initial settings data:", error);
        toast({
          title: "Erro ao Carregar Dados",
          description: "Não foi possível buscar as configurações da empresa ou a lista de backups.",
          variant: "destructive"
        })
      }
    };
    loadInitialData();
  }, [user, toast]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    if (!user) {
        toast({ title: "Erro", description: "Usuário não conectado.", variant: "destructive" });
        setIsUpdatingProfile(false);
        return;
    }
    
    const updateData: Partial<Omit<UserProfile, 'id'>> & { password?: string } = {};

    if (name !== user.name) updateData.name = name;
    if (email !== user.email) updateData.email = email;
    if (password) {
        if (password.length < 6) {
            toast({ title: "Erro", description: "A nova senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
            setIsUpdatingProfile(false);
            return;
        }
        updateData.password = password;
    }
    
    if (Object.keys(updateData).length === 0) {
        toast({ title: "Nenhuma Alteração", description: "Nenhuma informação foi alterada.", variant: "default" });
        setIsUpdatingProfile(false);
        return;
    }

    try {
        const updatedUser = await updateUser(user.id, updateData);
        if (updatedUser) {
            updateUserContext(updatedUser);
            toast({
                title: "Perfil Atualizado",
                description: "Suas informações de perfil foram atualizadas com sucesso.",
                variant: 'success',
            });
            setPassword('');
        }
    } catch (error) {
        toast({
            title: "Erro ao Atualizar Perfil",
            description: (error as Error).message,
            variant: 'destructive',
        });
    } finally {
        setIsUpdatingProfile(false);
    }
  };

  const toggleDarkMode = (checked: boolean) => {
    setDarkMode(checked);
    document.documentElement.classList.toggle('dark', checked);
    localStorage.setItem('theme', checked ? 'dark' : 'light');
    toast({
      title: "Tema Alterado",
      description: `Tema definido para ${checked ? 'Modo Escuro' : 'Modo Claro'}.`,
      variant: 'success',
    });
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>, type: 'company' | 'contract' | 'signature' | 'pixBank') => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { 
        toast({
          title: 'Arquivo Muito Grande',
          description: 'Por favor, selecione uma imagem menor que 2MB.',
          variant: 'destructive',
        });
        event.target.value = ''; 
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        let keyToUpdate: keyof CompanyDetails;
        switch (type) {
            case 'company': keyToUpdate = 'companyLogoUrl'; break;
            case 'contract': keyToUpdate = 'contractLogoUrl'; break;
            case 'signature': keyToUpdate = 'signatureImageUrl'; break;
            case 'pixBank': keyToUpdate = 'pixBankIconUrl'; break;
            default: return;
        }

        setCompanyDetails(prev => ({
          ...prev,
          [keyToUpdate]: result,
        }));
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    }
  };
  
  const handleCompanyDetailsInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompanyDetails(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCompanyDetailsSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingCompanyDetails(true);
    try {
        await updateCompanySettings(companyDetails);
        toast({
            title: 'Informações da Empresa Atualizadas',
            description: 'Os dados da sua empresa foram salvos com sucesso.',
            variant: 'success',
        });
    } catch (error) {
        toast({ title: "Erro ao Salvar", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsSavingCompanyDetails(false);
    }
  };

  const handleSendTestEmail = async () => {
      setIsSendingTestEmail(true);
      toast({
        title: 'Enviando Email de Teste...',
        description: 'Aguarde enquanto nos comunicamos com seu servidor de email.',
      });

      const result = await sendTestEmail();

      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: result.message,
          variant: 'success',
        });
      } else {
        toast({
          title: 'Falha no Envio',
          description: result.message,
          variant: 'destructive',
        });
      }
      setIsSendingTestEmail(false);
    };

    const handleBackupDatabase = async () => {
        setIsBackingUp(true);
        try {
            const result = await backupDatabase();
            if (result.success) {
                toast({
                    title: "Backup Criado!",
                    description: result.message,
                    duration: 9000,
                    variant: "success"
                });
                // Refresh backup list
                const backups = await getBackupFiles();
                setBackupFiles(backups);
                if (backups.length > 0 && !selectedBackup) {
                    setSelectedBackup(backups[0]);
                }
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            toast({
                title: "Erro no Backup",
                description: (error as Error).message,
                variant: "destructive"
            });
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleRestoreFromPath = async () => {
        if (!selectedBackup) {
            toast({
                title: "Nenhum Backup Selecionado",
                description: "Por favor, selecione um arquivo de backup da lista para restaurar.",
                variant: "destructive",
            });
            return;
        }
        setIsRestoring(true);
        try {
            const result = await restoreDatabaseFromPath(selectedBackup);
            if (result.success) {
                toast({
                    title: "Restauração Concluída",
                    description: result.message,
                    duration: 10000, // Show for 10 seconds
                    variant: 'success'
                });
            } else {
                 throw new Error(result.message);
            }
        } catch (error) {
            toast({ title: "Erro na Restauração", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsRestoring(false);
        }
    };
    
    const handleRestoreFromUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.db')) {
            toast({ title: "Arquivo Inválido", description: "Por favor, selecione um arquivo .db", variant: "destructive" });
            return;
        }

        setIsRestoring(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const base64String = (reader.result as string).split(',')[1];
            try {
                const result = await restoreDatabase(base64String);
                if (result.success) {
                    toast({
                        title: "Restauração Concluída",
                        description: result.message,
                        duration: 10000,
                        variant: 'success'
                    });
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                 toast({ title: "Erro na Restauração", description: (error as Error).message, variant: "destructive" });
            } finally {
                setIsRestoring(false);
            }
        };
        reader.onerror = () => {
             toast({ title: "Erro de Leitura", description: "Falha ao ler o arquivo de backup.", variant: "destructive" });
             setIsRestoring(false);
        };
    };

  return (
    <>
      <div className="container mx-auto py-2">
        <PageHeader 
          title="Configurações" 
          icon={SettingsIcon}
          description="Gerencie seu perfil, preferências e configurações do aplicativo."
        />

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {/* Profile Card */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><UserCircle className="mr-2 h-5 w-5 text-primary"/> Informações do Perfil</CardTitle>
              <CardDescription>Atualize seus dados pessoais.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu Nome" />
                </div>
                <div>
                  <Label htmlFor="email">Endereço de Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
                </div>
                <div>
                  <Label htmlFor="password">Nova Senha (Opcional)</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deixe em branco para manter a atual" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent" onClick={() => setShowPassword((prev) => !prev)} tabIndex={-1}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</span>
                      </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full sm:w-auto" disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? 'Salvando...' : 'Salvar Alterações do Perfil'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Company and Contract Details Card */}
          <Card className="shadow-lg xl:col-span-2">
            <form onSubmit={handleCompanyDetailsSave}>
                <CardHeader>
                  <CardTitle className="font-headline flex items-center"><Building className="mr-2 h-5 w-5 text-primary"/> Detalhes da Empresa e Contratos</CardTitle>
                  <CardDescription>Edite os dados da sua empresa, PIX, e personalizações para contratos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* TEXT FIELDS SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="companyName">Nome da Empresa</Label>
                        <Input id="companyName" name="companyName" value={companyDetails.companyName} onChange={handleCompanyDetailsInputChange} placeholder="Nome da sua Empresa" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="responsibleName">Nome do Responsável</Label>
                        <Input id="responsibleName" name="responsibleName" value={companyDetails.responsibleName} onChange={handleCompanyDetailsInputChange} placeholder="Nome do Responsável" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Telefone da Empresa</Label>
                        <Input id="phone" name="phone" value={companyDetails.phone} onChange={handleCompanyDetailsInputChange} placeholder="Telefone para contato" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email">Email da Empresa</Label>
                        <Input id="email" name="email" type="email" value={companyDetails.email} onChange={handleCompanyDetailsInputChange} placeholder="Email para contato" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="address">Endereço da Empresa</Label>
                      <Input id="address" name="address" value={companyDetails.address} onChange={handleCompanyDetailsInputChange} placeholder="Rua, Número, Bairro, Cidade, Estado" />
                      <p className="text-sm text-muted-foreground">Ex: Rua Exemplo, 123, Centro, Sua Cidade, SC</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="pixKey">Chave PIX</Label>
                          <Input id="pixKey" name="pixKey" value={companyDetails.pixKey} onChange={handleCompanyDetailsInputChange} placeholder="Sua chave PIX" />
                          <p className="text-sm text-muted-foreground">CPF/CNPJ, Telefone, Email ou Chave Aleatória.</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pixHolderName">Nome do Titular do PIX</Label>
                          <Input id="pixHolderName" name="pixHolderName" value={companyDetails.pixHolderName} onChange={handleCompanyDetailsInputChange} placeholder="Nome que aparece no PIX" />
                          <p className="text-sm text-muted-foreground">Nome completo do titular da chave.</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Ícone do Banco do PIX</Label>
                      <div className="flex flex-col items-start space-y-2 mt-1">
                            <div className="w-16 h-16 relative rounded-md overflow-hidden border bg-muted flex items-center justify-center p-1">
                                {companyDetails.pixBankIconUrl ? <Image src={companyDetails.pixBankIconUrl} alt="Pré-visualização do Ícone do Banco" layout="fill" objectFit="contain" key={companyDetails.pixBankIconUrl} data-ai-hint="bank icon"/> : <Landmark className="w-8 h-8 text-muted-foreground" data-ai-hint="bank icon placeholder"/>}
                            </div>
                            <Input name="pixBankIconUrl" placeholder="Cole a URL da imagem aqui" value={companyDetails.pixBankIconUrl || ''} onChange={handleCompanyDetailsInputChange} />
                            <Input id="pixBankIconUpload" type="file" accept="image/*" onChange={(e) => handleImageChange(e, 'pixBank')} className="w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                        </div>
                    </div>
                    
                    {/* LOGOS SECTION */}
                    <div className="pt-6 border-t">
                        <h3 className="text-lg font-medium flex items-center mb-4"><ImageIconLucide className="mr-2 h-5 w-5 text-primary"/>Logos da Empresa</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Logo Geral (Login, etc.)</Label>
                                <div className="flex flex-col items-center space-y-2 mt-1">
                                    <div className="w-40 h-20 relative rounded-md overflow-hidden border bg-muted flex items-center justify-center p-1">
                                        {companyDetails.companyLogoUrl ? (<Image src={companyDetails.companyLogoUrl} alt="Pré-visualização Logo Empresa" layout="fill" objectFit="contain" key={companyDetails.companyLogoUrl} data-ai-hint="company logo"/>) : (<ImageIconLucide className="w-10 h-10 text-muted-foreground" data-ai-hint="logo placeholder"/>)}
                                    </div>
                                    <Input name="companyLogoUrl" placeholder="Cole a URL da imagem aqui" value={companyDetails.companyLogoUrl || ''} onChange={handleCompanyDetailsInputChange} />
                                    <Input id="companyLogoUpload" type="file" accept="image/*" onChange={(e) => handleImageChange(e, 'company')} className="w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Logo Específica do Contrato</Label>
                                <div className="flex flex-col items-center space-y-2 mt-1">
                                    <div className="w-40 h-20 relative rounded-md overflow-hidden border bg-muted flex items-center justify-center p-1">
                                        {companyDetails.contractLogoUrl ? (<Image src={companyDetails.contractLogoUrl} alt="Pré-visualização Logo Contrato" layout="fill" objectFit="contain" key={companyDetails.contractLogoUrl} data-ai-hint="contract logo"/>) : (<ImageIconLucide className="w-10 h-10 text-muted-foreground" data-ai-hint="logo placeholder"/>)}
                                    </div>
                                    <Input name="contractLogoUrl" placeholder="Cole a URL da imagem aqui" value={companyDetails.contractLogoUrl || ''} onChange={handleCompanyDetailsInputChange} />
                                    <Input id="contractLogoUpload" type="file" accept="image/*" onChange={(e) => handleImageChange(e, 'contract')} className="w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                                </div>
                                <p className="text-xs text-muted-foreground text-center mt-1">Se vazio, a logo geral será usada.</p>
                            </div>
                        </div>
                    </div>

                    {/* CONTRACT TEXTS SECTION */}
                    <div className="pt-6 border-t">
                      <h3 className="text-lg font-medium flex items-center mb-4"><FileText className="mr-2 h-5 w-5 text-primary"/>Personalização de Contratos</h3>
                      <div className="space-y-1.5">
                        <Label htmlFor="contractTermsAndConditions">Termos e Condições do Contrato</Label>
                        <Textarea id="contractTermsAndConditions" name="contractTermsAndConditions" placeholder="Insira os termos e condições aqui..." value={companyDetails.contractTermsAndConditions || ''} onChange={handleCompanyDetailsInputChange} rows={5}/>
                      </div>
                      <div className="space-y-1.5 mt-4">
                        <Label htmlFor="contractFooterText">Texto do Rodapé do Contrato</Label>
                        <Input id="contractFooterText" name="contractFooterText" placeholder="Ex: Obrigado pela preferência!" value={companyDetails.contractFooterText || ''} onChange={handleCompanyDetailsInputChange} />
                      </div>
                      <div className="space-y-1.5 mt-4">
                          <Label htmlFor="signatureImageUpload">Assinatura Digital (Imagem)</Label>
                          <div className="flex flex-col items-start space-y-2 mt-1">
                              <div className="w-64 h-24 relative rounded-md overflow-hidden border bg-muted flex items-center justify-center p-1">
                                  {companyDetails.signatureImageUrl ? (<Image src={companyDetails.signatureImageUrl} alt="Pré-visualização da Assinatura" layout="fill" objectFit="contain" key={companyDetails.signatureImageUrl} data-ai-hint="signature"/>) : (<Signature className="w-10 h-10 text-muted-foreground" data-ai-hint="signature placeholder"/>)}
                              </div>
                              <Input name="signatureImageUrl" placeholder="Cole a URL da imagem aqui" value={companyDetails.signatureImageUrl || ''} onChange={handleCompanyDetailsInputChange} />
                              <Input id="signatureImageUpload" type="file" accept="image/png, image/webp" onChange={(e) => handleImageChange(e, 'signature')} className="w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                              <p className="text-xs text-muted-foreground">Envie uma imagem com fundo transparente (PNG) para melhores resultados.</p>
                          </div>
                      </div>
                    </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full sm:w-auto" disabled={isSavingCompanyDetails}>
                        {isSavingCompanyDetails ? "Salvando..." : "Salvar Dados da Empresa e Contratos"}
                    </Button>
                </CardFooter>
              </form>
          </Card>

          {/* Preferences Cards */}
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline flex items-center"><Bell className="mr-2 h-5 w-5 text-primary"/> Preferências de Notificação</CardTitle>
                <CardDescription>Controle como você recebe notificações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications" className="text-base">Notificações por Email</Label>
                    <p className="text-sm text-muted-foreground">Receba atualizações importantes por email.</p>
                  </div>
                  <Switch id="email-notifications" checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor="whatsapp-notifications" className="text-base">Lembretes por WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">Ative/desative lembretes de WhatsApp via IA.</p>
                  </div>
                  <Switch id="whatsapp-notifications" />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full sm:w-auto" onClick={() => toast({title: "Preferências Salvas", description: "Configurações de notificação (mock) salvas.", variant: 'success'})}>
                  Salvar Preferências de Notificação
                </Button>
              </CardFooter>
            </Card>
            
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline flex items-center">
                  <SettingsIcon className="mr-2 h-5 w-5 text-primary"/> Preferências de Tema
                </CardTitle>
                <CardDescription>Personalize a aparência do aplicativo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor="dark-mode" className="text-base">Modo Escuro</Label>
                    <p className="text-sm text-muted-foreground">Alterne entre temas claro e escuro.</p>
                  </div>
                  <Switch id="dark-mode" checked={darkMode} onCheckedChange={toggleDarkMode} />
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="font-headline flex items-center">
                    <Mail className="mr-2 h-5 w-5 text-primary"/> Teste de Email
                  </CardTitle>
                  <CardDescription>Verifique se suas configurações de servidor SMTP estão corretas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Clique no botão abaixo para enviar um email de teste para o endereço configurado para sua empresa: <span className="font-semibold text-foreground">{companyDetails.email}</span>.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSendTestEmail} className="w-full sm:w-auto" disabled={isSendingTestEmail}>
                    {isSendingTestEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                    {isSendingTestEmail ? 'Enviando...' : 'Enviar Email de Teste'}
                  </Button>
                </CardFooter>
              </Card>

              <Card className="shadow-lg">
                  <CardHeader>
                      <CardTitle className="font-headline flex items-center">
                          <DatabaseBackup className="mr-2 h-5 w-5 text-primary"/> Backup e Restauração
                      </CardTitle>
                      <CardDescription>Crie backups ou restaure seu banco de dados.</CardDescription>
                  </CardHeader>
                   <CardContent>
                      <Tabs defaultValue="restore-server">
                          <div className="py-4 border-b">
                                <Label>Backup</Label>
                                <p className="text-sm text-muted-foreground mb-2">
                                    Crie uma cópia de segurança. O arquivo será salvo na pasta `data/backups` do servidor.
                                </p>
                                <Button onClick={handleBackupDatabase} className="w-full sm:w-auto" disabled={isBackingUp}>
                                    {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />}
                                    {isBackingUp ? 'Criando Backup...' : 'Criar Novo Backup'}
                                </Button>
                          </div>
                          <div className="mt-4 border-b pb-4">
                              <Label>Restaurar Banco de Dados</Label>
                               <div className="mt-2 p-3 border-l-4 border-destructive bg-destructive/10 text-red-800 dark:text-red-200">
                                <h4 className="font-bold flex items-center"><AlertTriangle className="mr-2 h-4 w-4"/>Atenção!</h4>
                                <p className="text-xs">Esta ação substituirá **todos** os dados atuais. Após a restauração, **reinicie o servidor ou o container Docker** para aplicar as mudanças.</p>
                              </div>
                          </div>
                          <TabsList className="grid w-full grid-cols-2 mt-4">
                              <TabsTrigger value="restore-server">Restaurar do Servidor</TabsTrigger>
                              <TabsTrigger value="restore-upload">Fazer Upload</TabsTrigger>
                          </TabsList>
                          <TabsContent value="restore-server" className="mt-4">
                               <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  Selecione um backup da lista abaixo para restaurar ou baixar.
                                </p>
                                <Select value={selectedBackup} onValueChange={setSelectedBackup} disabled={backupFiles.length === 0}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione um backup..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {backupFiles.length > 0 ? (
                                            backupFiles.map(file => (
                                                <SelectItem key={file} value={file}>
                                                    <div className="flex items-center gap-2">
                                                        <History className="h-4 w-4 text-muted-foreground" />
                                                        <span>{file}</span>
                                                    </div>
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum backup encontrado.</div>
                                        )}
                                    </SelectContent>
                                </Select>
                                <div className="flex flex-wrap gap-2">
                                  <Button onClick={handleRestoreFromPath} className="flex-1 sm:flex-auto" disabled={!selectedBackup || isRestoring}>
                                      {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                      Restaurar
                                  </Button>
                                  <Button asChild variant="outline" className="flex-1 sm:flex-auto" disabled={!selectedBackup}>
                                    <a href={selectedBackup ? `/api/backups/download?filename=${selectedBackup}` : '#'} download>
                                      <Download className="mr-2 h-4 w-4" />
                                      Baixar
                                    </a>
                                  </Button>
                                </div>
                              </div>
                          </TabsContent>
                           <TabsContent value="restore-upload" className="mt-4">
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  Faça o upload de um arquivo `.db` do seu computador.
                                </p>
                                <Input 
                                  id="db-upload" 
                                  type="file" 
                                  accept=".db" 
                                  onChange={handleRestoreFromUpload} 
                                  disabled={isRestoring}
                                  className="file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                />
                              </div>
                          </TabsContent>
                      </Tabs>
                   </CardContent>
              </Card>
          </div>
        </div>
      </div>
    </>
  );
}
