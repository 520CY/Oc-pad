import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfileStore } from "@/stores/profileStore";

export function PathPage() {
  const { t } = useTranslation();
  const fetchProfiles = useProfileStore((state) => state.fetchProfiles);
  const [projectRoot, setProjectRoot] = useState("");
  const [globalConfigDir, setGlobalConfigDir] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPathSettings() {
      setLoading(true);
      setErrorMessage("");
      try {
        const [configDir, currentProjectRoot] = await Promise.all([
          invoke<string>("get_default_config_dir"),
          invoke<string | null>("get_project_root"),
        ]);
        if (cancelled) {
          return;
        }
        setGlobalConfigDir(configDir);
        setProjectRoot(currentProjectRoot ?? "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(extractErrorMessage(error, t("pathPage.errorUnknown")));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPathSettings();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const saveProjectRoot = async () => {
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await invoke("set_project_root", {
        path: projectRoot.trim() || null,
      });
      await invoke("bootstrap_system_config");
      await fetchProfiles();
      setSuccessMessage(t("pathPage.savedAndSynced"));
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, t("pathPage.errorUnknown")));
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await invoke("bootstrap_system_config");
      await fetchProfiles();
      setSuccessMessage(t("pathPage.syncedNow"));
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, t("pathPage.errorUnknown")));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("pathPage.title")}</CardTitle>
          <CardDescription>{t("pathPage.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-root-input">{t("pathPage.projectRootLabel")}</Label>
            <Input
              id="project-root-input"
              value={projectRoot}
              disabled={loading || saving}
              placeholder={t("pathPage.projectRootPlaceholder")}
              onChange={(event) => setProjectRoot(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("pathPage.projectRootHelp")}</p>
          </div>

          <div className="space-y-2">
            <Label>{t("pathPage.globalDirLabel")}</Label>
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
              {globalConfigDir || "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveProjectRoot} disabled={loading || saving}>
              {saving ? t("pathPage.saving") : t("pathPage.saveAndSync")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading || syncing}
              onClick={syncNow}
            >
              {syncing ? t("pathPage.syncing") : t("pathPage.syncNow")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading || saving}
              onClick={() => setProjectRoot("")}
            >
              {t("pathPage.clearProjectRoot")}
            </Button>
          </div>

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{successMessage}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return fallback;
}
