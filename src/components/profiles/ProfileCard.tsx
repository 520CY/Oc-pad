import { Clock3, MapPin, Play, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Profile } from "@/types";

interface ProfileCardProps {
  profile: Profile;
  selected: boolean;
  activating: boolean;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProfileCard({
  profile,
  selected,
  activating,
  onSelect,
  onActivate,
  onDelete,
}: ProfileCardProps) {
  const { t } = useTranslation();
  const isActive = profile.active;
  const isBusy = activating;
  const activateDisabled = isBusy || isActive;

  return (
    <Card
      className={cn(
        "cursor-pointer border transition-all duration-200 hover:border-primary/50",
        selected && "border-primary shadow-sm",
        isActive && "border-l-4 border-l-primary bg-primary/5 pl-[calc(1rem-3px)]",
      )}
      onClick={() => onSelect(profile.id)}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("truncate text-sm font-semibold", isActive && "text-primary")}>
              {profile.name}
            </p>
            {profile.description ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{profile.description}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("profiles.card.noDescription")}</p>
            )}
          </div>
          {isActive ? (
            <Badge variant="default" className="shadow-none">
              {t("profiles.card.active")}
            </Badge>
          ) : null}
        </div>

        {profile.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {profile.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="bg-background/50">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{profile.targetPath || t("profiles.card.defaultPath")}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            <span>{profile.lastActivatedAt || t("profiles.card.neverActivated")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            variant={isActive ? "secondary" : "default"}
            disabled={activateDisabled}
            onClick={(event) => {
              event.stopPropagation();
              onActivate(profile.id);
            }}
          >
            <Play className="h-3.5 w-3.5" />
            {isBusy
              ? t("profiles.card.activating")
              : isActive
                ? t("profiles.card.activated")
                : t("profiles.card.activate")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(profile.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
