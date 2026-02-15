import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  applyTheme,
  getStoredAccentTheme,
  getStoredThemeMode,
  observeSystemThemeChange,
  persistAccentTheme,
  persistThemeMode,
} from "@/lib/theme";
import { PathPage } from "@/pages/PathPage";
import { ProfilesPage } from "@/pages/ProfilesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AccentTheme, AppPage, ThemeMode } from "@/types";

function App() {
  const { t } = useTranslation();
  const [activePage, setActivePage] = useState<AppPage>("profiles");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(() => getStoredAccentTheme());
  const [startupReady, setStartupReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(themeMode, accentTheme);
    persistThemeMode(themeMode);
    persistAccentTheme(accentTheme);
  }, [accentTheme, themeMode]);

  useEffect(() => {
    if (themeMode !== "system") {
      return () => {};
    }
    return observeSystemThemeChange(() => applyTheme(themeMode, accentTheme));
  }, [accentTheme, themeMode]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setStartupReady(false);
      setStartupError(null);
      try {
        await invoke("bootstrap_system_config");
        if (!cancelled) {
          setStartupReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setStartupError(extractErrorMessage(error));
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const pageContent = useMemo(() => {
    if (activePage === "path") {
      return <PathPage />;
    }
    if (activePage === "settings") {
      return (
        <SettingsPage
          themeMode={themeMode}
          accentTheme={accentTheme}
          onThemeModeChange={setThemeMode}
          onAccentThemeChange={setAccentTheme}
        />
      );
    }
    return <ProfilesPage />;
  }, [accentTheme, activePage, themeMode]);

  if (startupError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{t("app.startupErrorTitle")}</CardTitle>
            <CardDescription>{t("app.startupErrorDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {startupError}
            </p>
            <Button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
            >
              {t("app.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!startupReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{t("app.startupLoadingTitle")}</CardTitle>
            <CardDescription>{t("app.startupLoadingDescription")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AppLayout activePage={activePage} onSelectPage={setActivePage}>
      {pageContent}
    </AppLayout>
  );
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "bootstrap failed";
}

export default App;
