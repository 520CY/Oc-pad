import { useEffect, useMemo, useState } from "react";
import { Play, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  ProfileForm,
  ProfileFormValues,
  toCreateInput,
  toProfileFormValues,
  toUpdateInput,
} from "@/components/profiles/ProfileForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Profile } from "@/types";

interface ProfileDetailProps {
  selectedProfile: Profile | null;
  creating: boolean;
  submitting: boolean;
  activating: boolean;
  onEnterCreateMode: () => void;
  onCancelCreateMode: () => void;
  onCreate: (input: ReturnType<typeof toCreateInput>) => Promise<void> | void;
  onUpdate: (id: string, input: ReturnType<typeof toUpdateInput>) => Promise<void> | void;
  onActivate: (id: string, targetPath?: string) => Promise<void> | void;
}

export function ProfileDetail({
  selectedProfile,
  creating,
  submitting,
  activating,
  onEnterCreateMode,
  onCancelCreateMode,
  onCreate,
  onUpdate,
  onActivate,
}: ProfileDetailProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ProfileFormValues>(toProfileFormValues(null));
  const [errorMessage, setErrorMessage] = useState("");

  const isEditing = Boolean(selectedProfile) && !creating;
  const canShowForm = creating || Boolean(selectedProfile);
  const selectedIsActive = Boolean(selectedProfile?.active);
  const baselineValues = useMemo(
    () => toProfileFormValues(creating ? null : selectedProfile),
    [creating, selectedProfile],
  );
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(baselineValues),
    [baselineValues, values],
  );
  const canSubmit = creating ? Boolean(values.name.trim()) : hasUnsavedChanges;

  useEffect(() => {
    if (creating) {
      setValues(toProfileFormValues(null));
      setErrorMessage("");
      return;
    }
    setValues(toProfileFormValues(selectedProfile));
    setErrorMessage("");
  }, [creating, selectedProfile]);

  const headerTitle = useMemo(() => {
    if (creating) {
      return t("profiles.detail.titleCreate");
    }
    if (selectedProfile) {
      return selectedProfile.name;
    }
    return t("profiles.detail.titleDefault");
  }, [creating, selectedProfile, t]);

  const handleSave = async () => {
    if (!values.name.trim()) {
      setErrorMessage(t("profiles.detail.nameRequired"));
      return;
    }
    setErrorMessage("");

    if (creating) {
      await onCreate(toCreateInput(values));
      return;
    }

    if (selectedProfile) {
      await onUpdate(selectedProfile.id, toUpdateInput(values));
    }
  };

  const handleActivate = async () => {
    if (!selectedProfile) {
      return;
    }
    await onActivate(selectedProfile.id, values.targetPath || undefined);
  };

  const handleReset = () => {
    setValues(toProfileFormValues(creating ? null : selectedProfile));
    setErrorMessage("");
  };

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{headerTitle}</CardTitle>
            <CardDescription>
              {creating ? t("profiles.detail.createDescription") : t("profiles.detail.editDescription")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && selectedProfile?.active ? <Badge>{t("profiles.card.active")}</Badge> : null}
            {canShowForm ? (
              <Badge
                variant={hasUnsavedChanges ? "secondary" : "outline"}
                className={
                  hasUnsavedChanges
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "text-emerald-700 dark:text-emerald-300"
                }
              >
                {hasUnsavedChanges ? t("profiles.detail.unsavedBadge") : t("profiles.detail.savedBadge")}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onEnterCreateMode}>
            <Plus className="h-3.5 w-3.5" />
            {t("profiles.detail.newProfile")}
          </Button>
          {isEditing ? (
            <Button
              type="button"
              size="sm"
              variant={selectedIsActive ? "secondary" : "default"}
              disabled={activating || selectedIsActive}
              onClick={handleActivate}
            >
              <Play className="h-3.5 w-3.5" />
              {activating
                ? t("profiles.detail.activatingCurrent")
                : selectedIsActive
                  ? t("profiles.detail.activatedCurrent")
                  : t("profiles.detail.activateCurrent")}
            </Button>
          ) : null}
          {creating ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCancelCreateMode}>
              {t("profiles.detail.cancelCreate")}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 overflow-auto p-5">
        {!canShowForm ? (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t("profiles.detail.emptyHint")}
          </div>
        ) : (
          <div className="space-y-4">
            <ProfileForm values={values} disabled={submitting} onChange={setValues} />
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">
                    {hasUnsavedChanges ? t("profiles.detail.unsavedChanges") : t("profiles.detail.savedState")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasUnsavedChanges
                      ? t("profiles.detail.unsavedVisualHint")
                      : t("profiles.detail.savedVisualHint")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={submitting || !hasUnsavedChanges}
                    onClick={handleReset}
                  >
                    {t("profiles.detail.resetDraft")}
                  </Button>
                  <Button type="button" size="sm" disabled={submitting || !canSubmit} onClick={handleSave}>
                    {submitting ? t("profiles.detail.saving") : t("common.save")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
