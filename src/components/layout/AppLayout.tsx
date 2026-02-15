import { ReactNode } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { AppPage } from "@/types";

interface AppLayoutProps {
  activePage: AppPage;
  onSelectPage: (page: AppPage) => void;
  children: ReactNode;
}

export function AppLayout({ activePage, onSelectPage, children }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/30 text-foreground">
      <Sidebar activePage={activePage} onSelectPage={onSelectPage} />
      <main className="flex-1 overflow-auto p-5 lg:p-6">
        <div className="mx-auto h-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
