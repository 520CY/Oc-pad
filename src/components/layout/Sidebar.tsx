import { FolderKanban, PanelLeftClose, PanelLeftOpen, Route, Settings, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AppPage } from "@/types";

interface SidebarProps {
  activePage: AppPage;
  onSelectPage: (page: AppPage) => void;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{ key: AppPage; i18nKey: string; icon: typeof FolderKanban }> = [
  { key: "profiles", i18nKey: "sidebar.profiles", icon: FolderKanban },
  { key: "path", i18nKey: "sidebar.path", icon: Route },
  { key: "settings", i18nKey: "sidebar.settings", icon: Settings },
];

export function Sidebar({
  activePage,
  onSelectPage,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-full w-[264px] flex-col border-r border-sidebar-border bg-sidebar/95 px-3 py-4 shadow-lg backdrop-blur transition-all duration-300 md:static md:z-auto md:translate-x-0 md:shadow-none",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed && "md:w-[84px]",
      )}
    >
      <div className={cn("mb-4 flex items-center justify-between", collapsed && "md:justify-center")}>
        <div className={cn("min-w-0 px-2", collapsed && "md:hidden")}>
          <h1 className="truncate text-lg font-semibold">{t("app.title")}</h1>
          <p className="truncate text-xs text-muted-foreground">{t("app.subtitle")}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="hidden md:inline-flex"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="md:hidden"
            onClick={onCloseMobile}
            aria-label={t("sidebar.closeMobile")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <nav className="space-y-1">
        <TooltipProvider delayDuration={0}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.key;
            const button = (
              <Button
                variant="ghost"
                className={cn(
                  "w-full rounded-lg transition-colors",
                  collapsed ? "justify-center px-0" : "justify-start gap-2",
                  isActive &&
                    "bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--ring))] hover:bg-primary/90",
                )}
                onClick={() => onSelectPage(item.key)}
              >
                <Icon className="h-4 w-4" />
                {!collapsed ? t(item.i18nKey) : null}
              </Button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {t(item.i18nKey)}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.key}>{button}</div>;
          })}
        </TooltipProvider>
      </nav>
    </aside>
  );
}
