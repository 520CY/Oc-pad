import { ReactNode, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { AppPage } from "@/types";

interface AppLayoutProps {
  activePage: AppPage;
  onSelectPage: (page: AppPage) => void;
  children: ReactNode;
}

export function AppLayout({ activePage, onSelectPage, children }: AppLayoutProps) {
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/30 text-foreground">
      {mobileSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden"
          aria-label={t("sidebar.closeMobile")}
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <Sidebar
        activePage={activePage}
        onSelectPage={(page) => {
          onSelectPage(page);
          setMobileSidebarOpen(false);
        }}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 lg:p-6">
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/55 px-2.5 py-2 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="md:hidden"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>

          </div>
          {mobileSidebarOpen ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="mx-auto h-full w-full max-w-[1600px] overflow-auto">{children}</div>
      </main>
    </div>
  );
}
