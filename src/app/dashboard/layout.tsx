
'use client';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SidebarNav } from '@/components/layout/SidebarNav';
// Button, Menu, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger
// are no longer manually used here for the main mobile nav as Sidebar component handles it.
import { SidebarProvider, Sidebar, SidebarTrigger as UiSidebarTrigger, SidebarInset, SidebarRail } from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <SidebarProvider defaultOpen={true}>
        {/* The Sidebar component will render SidebarNav.
            On mobile, Sidebar itself will render a Sheet containing SidebarNav.
            The UiSidebarTrigger below will control this Sheet. */}
        <Sidebar variant="sidebar" collapsible="icon" className="border-r border-sidebar-border">
          <SidebarNav />
        </Sidebar>
        <SidebarRail /> {/* For desktop collapsible="icon" variant resizing */}
        <SidebarInset>
          {/* This header is part of the main content area (SidebarInset)
              and is only visible on mobile (md:hidden).
              It contains the trigger for the mobile sidebar. */}
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4 md:hidden">
            {/* UiSidebarTrigger from @/components/ui/sidebar will toggle the Sheet rendered by the main Sidebar component on mobile */}
            <UiSidebarTrigger />
            {/* You can add other mobile header elements here, like a logo or user menu */}
          </header>
          <main className="flex-1 p-4 md:p-6 bg-background min-h-screen">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
