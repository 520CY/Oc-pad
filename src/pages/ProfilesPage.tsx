import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ProfileDetail } from "@/components/profiles/ProfileDetail";
import { ProfileList } from "@/components/profiles/ProfileList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProfileStore } from "@/stores/profileStore";

export function ProfilesPage() {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [pendingDeleteProfileId, setPendingDeleteProfileId] = useState<string | null>(null);
  const {
    profiles,
    selectedProfileId,
    loading,
    submitting,
    activatingProfileId,
    errorMessage,
    fetchProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    activateProfile,
    selectProfile,
    clearError,
  } = useProfileStore();

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) || null,
    [profiles, selectedProfileId],
  );
  const pendingDeleteProfile = useMemo(
    () => profiles.find((profile) => profile.id === pendingDeleteProfileId) || null,
    [pendingDeleteProfileId, profiles],
  );

  useEffect(() => {
    if (pendingDeleteProfileId && !pendingDeleteProfile) {
      setPendingDeleteProfileId(null);
    }
  }, [pendingDeleteProfile, pendingDeleteProfileId]);

  const handleCreate = async (input: Parameters<typeof createProfile>[0]) => {
    const created = await createProfile(input);
    if (created) {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string, input: Parameters<typeof updateProfile>[1]) => {
    await updateProfile(id, input);
  };

  const handleActivate = async (id: string, targetPath?: string) => {
    await activateProfile(id, targetPath);
  };

  const handleDeleteRequest = (id: string) => {
    setPendingDeleteProfileId(id);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteProfileId) {
      return;
    }
    await deleteProfile(pendingDeleteProfileId);
    setPendingDeleteProfileId(null);
    if (creating) {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {errorMessage ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center justify-between gap-3 p-3 text-sm text-destructive">
            <span>{errorMessage}</span>
            <button
              type="button"
              className="rounded border border-destructive/60 px-2 py-0.5 text-xs"
              onClick={clearError}
            >
              {t("common.close")}
            </button>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <ProfileList
          profiles={profiles}
          loading={loading}
          selectedProfileId={selectedProfileId}
          activatingProfileId={activatingProfileId}
          onSelect={(id) => {
            selectProfile(id);
            setCreating(false);
          }}
          onCreate={() => {
            setCreating(true);
            selectProfile(null);
          }}
          onActivate={(id) => handleActivate(id)}
          onDelete={handleDeleteRequest}
        />
        <ProfileDetail
          selectedProfile={selectedProfile}
          creating={creating}
          submitting={submitting}
          activating={Boolean(selectedProfile && activatingProfileId === selectedProfile.id)}
          onEnterCreateMode={() => {
            setCreating(true);
            selectProfile(null);
          }}
          onCancelCreateMode={() => setCreating(false)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onActivate={handleActivate}
        />
      </div>

      {pendingDeleteProfile ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingDeleteProfileId(null)}
        >
          <Card
            className="w-full max-w-md border-amber-500/40"
            onClick={(event) => event.stopPropagation()}
          >
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1">
                <p className="text-base font-semibold">{t("profiles.detail.deleteConfirmTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("profiles.detail.deleteConfirmInline", { name: pendingDeleteProfile.name })}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setPendingDeleteProfileId(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void confirmDelete();
                  }}
                >
                  {t("profiles.detail.confirmDeleteAction")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
