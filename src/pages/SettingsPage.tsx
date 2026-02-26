import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AccentTheme, ThemeMode } from "@/types";

interface SettingsPageProps {
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
  onThemeModeChange: (mode: ThemeMode) => void;
  onAccentThemeChange: (theme: AccentTheme) => void;
}

export function SettingsPage({
  themeMode,
  accentTheme,
  onThemeModeChange,
  onAccentThemeChange,
}: SettingsPageProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = normalizeLanguage(i18n.language);
  const modeLabel = t(`settingsPage.themeMode.${themeMode}`);
  const accentLabel = t(`settingsPage.accentTheme.${accentTheme}`);
  const accentOptions: AccentTheme[] = ["violet", "teal", "amber", "rose", "cyan", "lime"];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("settingsPage.title")}</CardTitle>
          <CardDescription>{t("settingsPage.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <Label htmlFor="language-select">{t("settingsPage.languageLabel")}</Label>
            <Select
              id="language-select"
              value={currentLanguage}
              onChange={(event) => {
                void i18n.changeLanguage(event.target.value);
              }}
            >
              <option value="zh-CN">{t("settingsPage.language.zh-CN")}</option>
              <option value="zh-TW">{t("settingsPage.language.zh-TW")}</option>
              <option value="en">{t("settingsPage.language.en")}</option>
            </Select>
            <p className="text-xs text-muted-foreground">{t("settingsPage.languageHelp")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme-mode-select">{t("settingsPage.themeModeLabel")}</Label>
            <Select
              id="theme-mode-select"
              value={themeMode}
              onChange={(event) => onThemeModeChange(event.target.value as ThemeMode)}
            >
              <option value="system">{t("settingsPage.themeMode.system")}</option>
              <option value="light">{t("settingsPage.themeMode.light")}</option>
              <option value="dark">{t("settingsPage.themeMode.dark")}</option>
            </Select>
            <p className="text-xs text-muted-foreground">{t("settingsPage.themeModeHelp")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accent-theme-select">{t("settingsPage.accentThemeLabel")}</Label>
            <Select
              id="accent-theme-select"
              value={accentTheme}
              onChange={(event) => onAccentThemeChange(event.target.value as AccentTheme)}
            >
              {accentOptions.map((option) => (
                <option key={option} value={option}>
                  {t(`settingsPage.accentTheme.${option}`)}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{t("settingsPage.accentThemeHelp")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {accentOptions.map((option) => (
                <button
                  key={`accent-${option}`}
                  type="button"
                  className="rounded-md border border-border bg-card p-2 text-left transition-colors hover:border-primary/55"
                  onClick={() => onAccentThemeChange(option)}
                >
                  <div
                    className="mb-1 h-5 rounded"
                    style={getAccentSwatch(option)}
                  />
                  <p className="text-xs font-medium">{t(`settingsPage.accentTheme.${option}`)}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settingsPage.previewTitle")}</CardTitle>
          <CardDescription>{t("settingsPage.previewDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-5 text-sm">
          <div key={`${themeMode}-${accentTheme}`} className="space-y-3">
            <div className="rounded-lg border border-primary/35 bg-primary/10 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-primary">{t("settingsPage.previewPrimary")}</p>
                  <p className="mt-1 text-muted-foreground">{t("settingsPage.previewSecondary")}</p>
                </div>
                <Badge>{accentLabel}</Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("settingsPage.previewLiveState", { mode: modeLabel, accent: accentLabel })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm">
                  {t("settingsPage.previewPrimaryButton")}
                </Button>
                <Button type="button" size="sm" variant="outline">
                  {t("settingsPage.previewOutlineButton")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border border-border p-2">
                <div className="mb-1 h-6 rounded bg-primary" />
                <p className="text-muted-foreground">{t("settingsPage.previewSwatchPrimary")}</p>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="mb-1 h-6 rounded bg-accent" />
                <p className="text-muted-foreground">{t("settingsPage.previewSwatchAccent")}</p>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="mb-1 h-6 rounded bg-ring/60" />
                <p className="text-muted-foreground">{t("settingsPage.previewSwatchRing")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getAccentSwatch(theme: AccentTheme): { background: string } {
  if (theme === "teal") {
    return { background: "linear-gradient(90deg, #14b8a6, #0ea5a0)" };
  }
  if (theme === "amber") {
    return { background: "linear-gradient(90deg, #f59e0b, #eab308)" };
  }
  if (theme === "rose") {
    return { background: "linear-gradient(90deg, #f43f5e, #e11d48)" };
  }
  if (theme === "cyan") {
    return { background: "linear-gradient(90deg, #06b6d4, #0891b2)" };
  }
  if (theme === "lime") {
    return { background: "linear-gradient(90deg, #84cc16, #65a30d)" };
  }
  return { background: "linear-gradient(90deg, #7c3aed, #6d28d9)" };
}

function normalizeLanguage(language: string): "zh-CN" | "zh-TW" | "en" {
  if (language.startsWith("zh-TW")) {
    return "zh-TW";
  }
  if (language.startsWith("en")) {
    return "en";
  }
  return "zh-CN";
}
