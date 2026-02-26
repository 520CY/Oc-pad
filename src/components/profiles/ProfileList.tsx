import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProfileCard } from "@/components/profiles/ProfileCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Profile } from "@/types";

interface ProfileListProps {
  profiles: Profile[];
  loading: boolean;
  selectedProfileId: string | null;
  activatingProfileId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProfileList({
  profiles,
  loading,
  selectedProfileId,
  activatingProfileId,
  onSelect,
  onCreate,
  onActivate,
  onDelete,
}: ProfileListProps) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");

  const filteredProfiles = useMemo(() => {
    if (!keyword.trim()) {
      return profiles;
    }
    const normalized = keyword.toLowerCase();
    return profiles.filter((profile) => {
      const inName = profile.name.toLowerCase().includes(normalized);
      const inDesc = profile.description.toLowerCase().includes(normalized);
      const inTags = profile.tags.some((tag) => tag.toLowerCase().includes(normalized));
      return inName || inDesc || inTags;
    });
  }, [keyword, profiles]);

  return (
    <Card className="flex h-[40vh] min-h-0 flex-col xl:h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{t("profiles.list.title")}</CardTitle>
          <Button type="button" size="sm" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" />
            {t("profiles.list.new")}
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("profiles.list.searchPlaceholder")}
            className="pl-8"
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("profiles.list.count", { count: profiles.length })}</p>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-auto pt-0">
        {loading ? <p className="text-sm text-muted-foreground">{t("profiles.list.loading")}</p> : null}
        {!loading && filteredProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("profiles.list.empty")}</p>
        ) : null}

        {filteredProfiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            selected={selectedProfileId === profile.id}
            activating={activatingProfileId === profile.id}
            onSelect={onSelect}
            onActivate={onActivate}
            onDelete={onDelete}
          />
        ))}
      </CardContent>
    </Card>
  );
}
