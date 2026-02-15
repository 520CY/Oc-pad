import { FolderKanban, Route, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppPage } from "@/types";

interface SidebarProps {
  activePage: AppPage;
  onSelectPage: (page: AppPage) => void;
}

const NAV_ITEMS: Array<{ key: AppPage; i18nKey: string; icon: typeof FolderKanban }> = [
  { key: "profiles", i18nKey: "sidebar.profiles", icon: FolderKanban },
  { key: "path", i18nKey: "sidebar.path", icon: Route },
  { key: "settings", i18nKey: "sidebar.settings", icon: Settings },
];

export function Sidebar({ activePage, onSelectPage }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="flex h-full w-[260px] flex-col border-r border-border bg-sidebar/95 px-4 py-5 backdrop-blur">
      <div className="mb-6 px-2">
        <h1 className="text-lg font-semibold">{t("app.title")}</h1>
        <p className="text-xs text-muted-foreground">{t("app.subtitle")}</p>
      </div>

      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.key}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 rounded-lg transition-colors",
                activePage === item.key && "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              onClick={() => onSelectPage(item.key)}
            >
              <Icon className="h-4 w-4" />
              {t(item.i18nKey)}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
