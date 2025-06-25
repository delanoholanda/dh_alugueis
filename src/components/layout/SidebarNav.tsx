
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ScrollText,
  Warehouse,
  CircleDollarSign,
  Settings,
  LogOut,
  Users,
  MessageCircleQuestion,
  Tags as TagsIcon, 
  Users2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'; 
import { useState, useEffect } from 'react';
import { DynamicLucideIcon, getIcon } from '@/lib/lucide-icons'; 
import type { EquipmentType } from '@/types'; 
import { getEquipmentTypes } from '@/actions/equipmentTypeActions'; 


interface NavItem {
  href: string;
  label: string;
  iconName: string; 
  subItems?: NavItem[];
  isSettingItem?: boolean; 
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Painel', iconName: 'LayoutDashboard' },
  { href: '/dashboard/rentals', label: 'Aluguéis', iconName: 'ScrollText' },
  { 
    href: '/dashboard/inventory', 
    label: 'Inventário Geral', 
    iconName: 'Warehouse', 
  },
  { href: '/dashboard/customers', label: 'Clientes', iconName: 'Users' },
  { href: '/dashboard/financials', label: 'Financeiro', iconName: 'CircleDollarSign' },
  { href: '/dashboard/notifications', label: 'IA Notificações', iconName: 'MessageCircleQuestion' },
];

const settingsNavItems: NavItem[] = [
  { href: '/dashboard/settings', label: 'Geral Empresa', iconName: 'Settings', isSettingItem: true },
  { href: '/dashboard/settings/equipment-types', label: 'Tipos de Equip.', iconName: 'Tags', isSettingItem: true },
  { href: '/dashboard/settings/users', label: 'Gerenciar Usuários', iconName: 'Users2', isSettingItem: true },
];


const COMPANY_LOGO_STORAGE_KEY = 'dhAlugueisCompanyLogo';
const DEFAULT_COMPANY_LOGO = '/dh-alugueis-logo.png';

export function SidebarNav() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { open, toggleSidebar, isMobile, state, setOpenMobile } = useSidebar(); // Added setOpenMobile
  const [currentLogo, setCurrentLogo] = useState<string>(DEFAULT_COMPANY_LOGO);
  const [dynamicNavItems, setDynamicNavItems] = useState<NavItem[]>(mainNavItems);

  useEffect(() => {
    const storedLogo = localStorage.getItem(COMPANY_LOGO_STORAGE_KEY);
    if (storedLogo) {
      setCurrentLogo(storedLogo);
    } else {
      setCurrentLogo(DEFAULT_COMPANY_LOGO);
    }
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === COMPANY_LOGO_STORAGE_KEY) {
        setCurrentLogo(event.newValue || DEFAULT_COMPANY_LOGO);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    async function fetchAndSetEquipmentTypes() {
      try {
        const fetchedTypes: EquipmentType[] = await getEquipmentTypes();
        const inventoryNavIndex = mainNavItems.findIndex(item => item.href === '/dashboard/inventory');
        
        if (inventoryNavIndex !== -1) {
          const inventorySubItems: NavItem[] = fetchedTypes.map(type => {
            let hrefSegment = type.id.replace('type_', '');
            // Garante que o link para "Plataforma" seja sempre "platforms" (plural)
            if (type.name.toLowerCase() === 'plataforma') {
              hrefSegment = 'platforms';
            }
            return {
              href: `/dashboard/inventory/${hrefSegment}`, 
              label: type.name,
              iconName: type.iconName || 'Package',
            };
          });

          const updatedNavItems = [...mainNavItems];
          updatedNavItems[inventoryNavIndex] = {
            ...updatedNavItems[inventoryNavIndex],
            subItems: inventorySubItems
          };
          setDynamicNavItems(updatedNavItems);
        }
      } catch (error) {
        console.error("Failed to fetch equipment types for sidebar:", error);
        setDynamicNavItems(mainNavItems); 
      }
    }
    fetchAndSetEquipmentTypes();
  }, []);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <>
    <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Link href="/dashboard" className="inline-block group-data-[collapsible=icon]:hidden bg-black p-1 rounded-sm h-[80px] w-[200px] relative" onClick={handleLinkClick}>
            <Image 
              src={currentLogo} 
              alt="DH Alugueis Logo" 
              layout="fill" 
              objectFit="contain"
              priority
              key={currentLogo}
            />
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {dynamicNavItems.map((item) => {
            const IconComp = getIcon(item.iconName);
            return (
              <SidebarMenuItem key={item.href} className="relative">
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href || (item.subItems && pathname.startsWith(item.href) && item.href !== '/dashboard/inventory') || (item.href === '/dashboard/inventory' && pathname.startsWith('/dashboard/inventory'))}
                  tooltip={{children: item.label, className: "bg-primary text-primary-foreground"}}
                >
                  <Link href={item.href} onClick={handleLinkClick}>
                    <IconComp className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
                {item.subItems && (
                  <SidebarMenuSub className={cn("group-data-[collapsible=icon]:hidden", (pathname.startsWith(item.href)) ? "flex" : "hidden")}>
                    {item.subItems.map((subItem) => {
                      const SubIconComp = getIcon(subItem.iconName);
                      return (
                        <SidebarMenuSubItem key={subItem.href}>
                          <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                            <Link href={subItem.href} onClick={handleLinkClick}>
                              <SubIconComp className="h-4 w-4 mr-1" />
                              <span>{subItem.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 mt-auto border-t border-sidebar-border">
        <SidebarMenu>
           <SidebarMenuItem className="relative">
             <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/dashboard/settings')}
                tooltip={{children: "Configurações", className: "bg-primary text-primary-foreground"}}
              >
                <Link href="/dashboard/settings" onClick={handleLinkClick}>
                  <DynamicLucideIcon iconName="Settings" className="h-5 w-5" />
                  <span>Configurações</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuSub className={cn("group-data-[collapsible=icon]:hidden", (pathname.startsWith('/dashboard/settings')) ? "flex" : "hidden")}>
                  {settingsNavItems.map((subItem) => {
                     const SubIconComp = getIcon(subItem.iconName);
                     return (
                        <SidebarMenuSubItem key={subItem.href}>
                        <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                            <Link href={subItem.href} onClick={handleLinkClick}>
                            <SubIconComp className="h-4 w-4 mr-1" />
                            <span>{subItem.label}</span>
                            </Link>
                        </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                     );
                    })}
                </SidebarMenuSub>
           </SidebarMenuItem>
        </SidebarMenu>
        
        <div className="flex flex-col gap-2 group-data-[collapsible=icon]:items-center mt-2">
          <SidebarMenuButton
            variant="default"
            className="w-full justify-start bg-destructive/20 text-destructive-foreground hover:bg-destructive/30 group-data-[collapsible=icon]:bg-transparent"
            onClick={() => {
              logout();
              handleLinkClick(); // Also close sidebar on logout if mobile
            }}
            tooltip={{children: "Sair", className: "bg-destructive text-destructive-foreground"}}
            >
            <LogOut className="h-5 w-5 text-destructive group-data-[collapsible=icon]:text-sidebar-foreground" />
            <span className="group-data-[collapsible=icon]:hidden text-destructive">Sair</span>
          </SidebarMenuButton>
          {user && (
            <div className="text-xs text-sidebar-foreground/70 mt-2 group-data-[collapsible=icon]:hidden">
              Logado como {user.name}
            </div>
          )}
        </div>
      </SidebarFooter>
    </>
  );
}
