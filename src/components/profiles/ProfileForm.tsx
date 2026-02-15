import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { JsonObject, JsonValue, parseConfigText, stringifyConfigObject } from "@/lib/schema/normalize";
import { cn } from "@/lib/utils";
import { CreateProfileInput, Profile, UpdateProfileInput } from "@/types";

export interface ProfileFormValues {
  name: string;
  description: string;
  tagsText: string;
  opencodeConfigObject: JsonObject;
  ohmyocEnabled: boolean;
  ohmyocConfigObject: JsonObject;
  targetPath: string;
  statsEnabled: boolean;
}

interface ProfileFormProps {
  values: ProfileFormValues;
  disabled?: boolean;
  onChange: (nextValues: ProfileFormValues) => void;
}

type PreviewTab = "opencode" | "ohmy";
type CoreMode = "sisyphus" | "hephaestus" | "prometheus" | "atlas";

const CORE_MODES: CoreMode[] = ["sisyphus", "hephaestus", "prometheus", "atlas"];
const MODE_VARIANT_KEY: Record<CoreMode, "variant" | "variants"> = {
  sisyphus: "variants",
  hephaestus: "variants",
  prometheus: "variants",
  atlas: "variant",
};
const MODE_DEFAULT_VARIANT: Record<CoreMode, string> = {
  sisyphus: "medium",
  hephaestus: "medium",
  prometheus: "xhigh",
  atlas: "medium",
};
const FIELD_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function ProfileForm({ values, disabled, onChange }: ProfileFormProps) {
  const { t } = useTranslation();
  const [selectedProviderKey, setSelectedProviderKey] = useState("openai");
  const [newProviderKey, setNewProviderKey] = useState("");
  const [newModelId, setNewModelId] = useState("");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("opencode");
  const [copiedPreviewTab, setCopiedPreviewTab] = useState<PreviewTab | null>(null);
  const [previewDrafts, setPreviewDrafts] = useState<Record<PreviewTab, string>>({
    opencode: "",
    ohmy: "",
  });
  const [previewDirty, setPreviewDirty] = useState<Record<PreviewTab, boolean>>({
    opencode: false,
    ohmy: false,
  });
  const [previewErrors, setPreviewErrors] = useState<Partial<Record<PreviewTab, string>>>({});
  const [collapsedModes, setCollapsedModes] = useState<Record<CoreMode, boolean>>({
    sisyphus: false,
    hephaestus: true,
    prometheus: true,
    atlas: true,
  });

  const onFieldChange =
    (field: keyof ProfileFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const rawValue = event.target.value;
      onChange({
        ...values,
        [field]: rawValue,
      });
    };

  const providerKeys = useMemo(() => getProviderKeys(values.opencodeConfigObject), [values.opencodeConfigObject]);
  const modelCandidates = useMemo(
    () => collectLinkedModels(values.opencodeConfigObject),
    [values.opencodeConfigObject],
  );
  const preferredModel = useMemo(
    () => getPreferredModel(values.opencodeConfigObject, modelCandidates),
    [modelCandidates, values.opencodeConfigObject],
  );
  const providerView = useMemo(
    () => getProviderView(values.opencodeConfigObject, selectedProviderKey),
    [selectedProviderKey, values.opencodeConfigObject],
  );
  const providerModelIds = useMemo(() => Object.keys(providerView.models), [providerView.models]);
  const modelSelectOptions = useMemo(
    () => uniqueStrings([...modelCandidates, ...providerModelIds]),
    [modelCandidates, providerModelIds],
  );
  const opencodePreview = useMemo(
    () => formatPreviewJson(values.opencodeConfigObject),
    [values.opencodeConfigObject],
  );
  const ohmyPreview = useMemo(() => {
    if (!values.ohmyocEnabled) {
      return formatPreviewJson({});
    }
    const synced = syncOhmyCoreModes(values.ohmyocConfigObject, modelCandidates, preferredModel, true);
    return formatPreviewJson(synced);
  }, [modelCandidates, preferredModel, values.ohmyocConfigObject, values.ohmyocEnabled]);
  const previewDisabled = disabled || (previewTab === "ohmy" && !values.ohmyocEnabled);

  useEffect(() => {
    setPreviewDrafts((current) => {
      let changed = false;
      const next = { ...current };
      if (!previewDirty.opencode && current.opencode !== opencodePreview) {
        next.opencode = opencodePreview;
        changed = true;
      }
      if (!previewDirty.ohmy && current.ohmy !== ohmyPreview) {
        next.ohmy = ohmyPreview;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [ohmyPreview, opencodePreview, previewDirty.ohmy, previewDirty.opencode]);

  useEffect(() => {
    if (providerKeys.length === 0) {
      return;
    }
    if (!providerKeys.includes(selectedProviderKey)) {
      setSelectedProviderKey(providerKeys[0]);
    }
  }, [providerKeys, selectedProviderKey]);

  useEffect(() => {
    if (!values.ohmyocEnabled) {
      return;
    }
    const synced = syncOhmyCoreModes(values.ohmyocConfigObject, modelCandidates, preferredModel, true);
    if (jsonEquals(synced, values.ohmyocConfigObject)) {
      return;
    }
    onChange({
      ...values,
      ohmyocConfigObject: synced,
    });
  }, [
    modelCandidates,
    onChange,
    preferredModel,
    values,
    values.ohmyocConfigObject,
    values.ohmyocEnabled,
  ]);

  const updateOpencode = (mutator: (draft: JsonObject) => void) => {
    const nextOpencode = cloneJsonObject(values.opencodeConfigObject);
    mutator(nextOpencode);

    const nextCandidates = collectLinkedModels(nextOpencode);
    const nextPreferredModel = getPreferredModel(nextOpencode, nextCandidates);
    const nextOhmy = values.ohmyocEnabled
      ? syncOhmyCoreModes(values.ohmyocConfigObject, nextCandidates, nextPreferredModel, true)
      : values.ohmyocConfigObject;

    onChange({
      ...values,
      opencodeConfigObject: nextOpencode,
      ohmyocConfigObject: nextOhmy,
    });
  };

  const updateOhmy = (mutator: (draft: JsonObject) => void) => {
    const nextOhmy = cloneJsonObject(values.ohmyocConfigObject);
    mutator(nextOhmy);

    onChange({
      ...values,
      ohmyocConfigObject: syncOhmyCoreModes(nextOhmy, modelCandidates, preferredModel, true),
    });
  };

  const onToggleStats = () => {
    onChange({
      ...values,
      statsEnabled: !values.statsEnabled,
    });
  };

  const onToggleOhmy = () => {
    const enabled = !values.ohmyocEnabled;
    if (!enabled) {
      onChange({
        ...values,
        ohmyocEnabled: false,
      });
      return;
    }

    onChange({
      ...values,
      ohmyocEnabled: true,
      ohmyocConfigObject: syncOhmyCoreModes(
        values.ohmyocConfigObject,
        modelCandidates,
        preferredModel,
        true,
      ),
    });
  };

  const copyCurrentPreview = async () => {
    const currentText = previewDrafts[previewTab] ?? (previewTab === "opencode" ? opencodePreview : ohmyPreview);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentText);
        setCopiedPreviewTab(previewTab);
        window.setTimeout(() => {
          setCopiedPreviewTab((value) => (value === previewTab ? null : value));
        }, 1400);
      }
    } catch {
      // ignore copy failures to keep editing flow smooth
    }
  };

  const handlePreviewDraftChange = (tab: PreviewTab, text: string) => {
    setPreviewDrafts((current) => ({
      ...current,
      [tab]: text,
    }));
    setPreviewDirty((current) => ({
      ...current,
      [tab]: true,
    }));
    setPreviewErrors((current) => {
      if (!current[tab]) {
        return current;
      }
      const next = { ...current };
      delete next[tab];
      return next;
    });
  };

  const resetPreviewDraft = (tab: PreviewTab) => {
    const source = tab === "opencode" ? opencodePreview : ohmyPreview;
    setPreviewDrafts((current) => ({
      ...current,
      [tab]: source,
    }));
    setPreviewDirty((current) => ({
      ...current,
      [tab]: false,
    }));
    setPreviewErrors((current) => {
      if (!current[tab]) {
        return current;
      }
      const next = { ...current };
      delete next[tab];
      return next;
    });
  };

  const formatPreviewDraft = (tab: PreviewTab) => {
    const currentText = previewDrafts[tab];
    try {
      const parsed = JSON.parse(currentText);
      if (!isObjectValue(parsed as JsonValue)) {
        setPreviewErrors((current) => ({
          ...current,
          [tab]: t("profiles.form.previewRootObject"),
        }));
        return;
      }
      handlePreviewDraftChange(tab, formatPreviewJson(parsed as JsonObject));
    } catch {
      setPreviewErrors((current) => ({
        ...current,
        [tab]: t("profiles.form.previewInvalidJson"),
      }));
    }
  };

  const applyPreviewDraft = (tab: PreviewTab) => {
    if (tab === "ohmy" && !values.ohmyocEnabled) {
      return;
    }

    try {
      const parsed = JSON.parse(previewDrafts[tab]);
      if (!isObjectValue(parsed as JsonValue)) {
        setPreviewErrors((current) => ({
          ...current,
          [tab]: t("profiles.form.previewRootObject"),
        }));
        return;
      }

      const parsedObject = parsed as JsonObject;
      if (tab === "opencode") {
        const nextCandidates = collectLinkedModels(parsedObject);
        const nextPreferredModel = getPreferredModel(parsedObject, nextCandidates);
        const nextOhmy = values.ohmyocEnabled
          ? syncOhmyCoreModes(values.ohmyocConfigObject, nextCandidates, nextPreferredModel, true)
          : values.ohmyocConfigObject;

        onChange({
          ...values,
          opencodeConfigObject: parsedObject,
          ohmyocConfigObject: nextOhmy,
        });
      } else {
        onChange({
          ...values,
          ohmyocConfigObject: syncOhmyCoreModes(parsedObject, modelCandidates, preferredModel, true),
        });
      }

      setPreviewDirty((current) => ({
        ...current,
        [tab]: false,
      }));
      setPreviewErrors((current) => {
        if (!current[tab]) {
          return current;
        }
        const next = { ...current };
        delete next[tab];
        return next;
      });
    } catch {
      setPreviewErrors((current) => ({
        ...current,
        [tab]: t("profiles.form.previewInvalidJson"),
      }));
    }
  };

  const handleAddProvider = () => {
    const providerKey = newProviderKey.trim();
    if (!providerKey) {
      return;
    }
    updateOpencode((draft) => {
      ensureProvider(draft, providerKey);
    });
    setSelectedProviderKey(providerKey);
    setNewProviderKey("");
  };

  const handleAddModel = () => {
    const modelId = newModelId.trim();
    if (!modelId) {
      return;
    }
    updateOpencode((draft) => {
      const provider = ensureProvider(draft, selectedProviderKey);
      const models = ensureObjectField(provider, "models");
      if (!isObjectValue(models[modelId])) {
        models[modelId] = { name: modelId };
      }
    });
    setNewModelId("");
  };

  const handleRemoveModel = (modelId: string) => {
    updateOpencode((draft) => {
      const provider = ensureProvider(draft, selectedProviderKey);
      const models = ensureObjectField(provider, "models");
      delete models[modelId];
    });
  };

  const defaultModel = readString(values.opencodeConfigObject.model);
  const smallModel = readString(values.opencodeConfigObject.small_model);

  return (
    <div className="space-y-5 pb-2">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="profile-name" className={FIELD_LABEL_CLASS}>
            {t("profiles.form.name")}
          </Label>
          <Input
            id="profile-name"
            value={values.name}
            onChange={onFieldChange("name")}
            disabled={disabled}
            placeholder={t("profiles.form.namePlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-target-path" className={FIELD_LABEL_CLASS}>
            {t("profiles.form.targetPath")}
          </Label>
          <Input
            id="profile-target-path"
            value={values.targetPath}
            onChange={onFieldChange("targetPath")}
            disabled={disabled}
            placeholder={t("profiles.form.targetPathPlaceholder")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-description" className={FIELD_LABEL_CLASS}>
          {t("profiles.form.description")}
        </Label>
        <Textarea
          id="profile-description"
          value={values.description}
          onChange={onFieldChange("description")}
          disabled={disabled}
          rows={2}
          placeholder={t("profiles.form.descriptionPlaceholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-tags" className={FIELD_LABEL_CLASS}>
          {t("profiles.form.tags")}
        </Label>
        <Input
          id="profile-tags"
          value={values.tagsText}
          onChange={onFieldChange("tagsText")}
          disabled={disabled}
          placeholder={t("profiles.form.tagsPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={values.ohmyocEnabled ? "default" : "outline"}
            disabled={disabled}
            onClick={onToggleOhmy}
          >
            {values.ohmyocEnabled ? <Check className="h-3.5 w-3.5" /> : null}
            {t("profiles.form.enableOhMy")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={values.statsEnabled ? "default" : "outline"}
            disabled={disabled}
            onClick={onToggleStats}
          >
            {values.statsEnabled ? <Check className="h-3.5 w-3.5" /> : null}
            {t("profiles.form.enableStats")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("profiles.form.toggleHelp")}</p>
      </div>

      <section className="space-y-4 rounded-xl border border-border/80 bg-card/40 p-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("profiles.form.opencodeCoreTitle")}</h4>
          <p className="text-xs text-muted-foreground">{t("profiles.form.opencodeCoreHelp")}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-background px-2 py-0.5">
              {t("profiles.form.providerCount", { count: providerKeys.length })}
            </span>
            <span className="rounded-full border border-border bg-background px-2 py-0.5">
              {t("profiles.form.modelCandidateCount", { count: modelSelectOptions.length })}
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-border/70 bg-background/70 p-3.5">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("profiles.form.providerSwitchTitle")}
              </p>
              <p className="text-xs text-muted-foreground">{t("profiles.form.providerSwitchHelp")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="provider-select" className={FIELD_LABEL_CLASS} title={t("profiles.form.providerHelp")}>
                {t("profiles.form.provider")}
              </Label>
              <Select
                id="provider-select"
                value={selectedProviderKey}
                disabled={disabled || providerKeys.length === 0}
                onChange={(event) => setSelectedProviderKey(event.target.value)}
              >
                {providerKeys.map((providerKey) => (
                  <option key={providerKey} value={providerKey}>
                    {providerKey}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">{t("profiles.form.providerHelp")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="provider-endpoint" className={FIELD_LABEL_CLASS}>
                {t("profiles.form.endpoint")}
              </Label>
              <Input
                id="provider-endpoint"
                value={readString(providerView.options.baseURL)}
                disabled={disabled}
                placeholder={t("profiles.form.endpointPlaceholder")}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  updateOpencode((draft) => {
                    const provider = ensureProvider(draft, selectedProviderKey);
                    const options = ensureObjectField(provider, "options");
                    setMaybeStringField(options, "baseURL", nextValue);
                  });
                }}
              />
              <p className="text-xs text-muted-foreground">{t("profiles.form.endpointHelp")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="provider-api-key" className={FIELD_LABEL_CLASS}>
                {t("profiles.form.apiKey")}
              </Label>
              <Input
                id="provider-api-key"
                type="password"
                autoComplete="off"
                value={readString(providerView.options.apiKey)}
                disabled={disabled}
                placeholder={t("profiles.form.apiKeyPlaceholder")}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  updateOpencode((draft) => {
                    const provider = ensureProvider(draft, selectedProviderKey);
                    const options = ensureObjectField(provider, "options");
                    setMaybeStringField(options, "apiKey", nextValue);
                  });
                }}
              />
              <p className="text-xs text-muted-foreground">{t("profiles.form.apiKeyHelp")}</p>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border/70 bg-background/70 p-3.5">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("profiles.form.providerManageTitle")}
              </p>
              <p className="text-xs text-muted-foreground">{t("profiles.form.providerManageHelp")}</p>
            </div>

            <div className="space-y-1.5">
              <Label className={FIELD_LABEL_CLASS}>{t("profiles.form.addProvider")}</Label>
              <div className="flex gap-2">
                <Input
                  value={newProviderKey}
                  disabled={disabled}
                  placeholder={t("profiles.form.providerPlaceholder")}
                  onChange={(event) => setNewProviderKey(event.target.value)}
                />
                <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={handleAddProvider}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("profiles.form.addProvider")}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="default-model" className={FIELD_LABEL_CLASS}>
                {t("profiles.form.defaultModel")}
              </Label>
              <Select
                id="default-model"
                value={defaultModel}
                disabled={disabled || modelSelectOptions.length === 0}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  updateOpencode((draft) => setMaybeStringField(draft, "model", nextValue));
                }}
              >
                <option value="">{t("profiles.form.selectModelPlaceholder")}</option>
                {modelSelectOptions.map((modelId) => (
                  <option key={modelId} value={modelId}>
                    {modelId}
                  </option>
                ))}
              </Select>
              {modelSelectOptions.length === 0 ? (
                <Input
                  value={defaultModel}
                  disabled={disabled}
                  placeholder={t("profiles.form.defaultModelPlaceholder")}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    updateOpencode((draft) => setMaybeStringField(draft, "model", nextValue));
                  }}
                />
              ) : null}
              <p className="text-xs text-muted-foreground">{t("profiles.form.defaultModelHelp")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="small-model" className={FIELD_LABEL_CLASS}>
                {t("profiles.form.smallModel")}
              </Label>
              <Select
                id="small-model"
                value={smallModel}
                disabled={disabled}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  updateOpencode((draft) => setMaybeStringField(draft, "small_model", nextValue));
                }}
              >
                <option value="">{t("common.none")}</option>
                {modelSelectOptions.map((modelId) => (
                  <option key={`small-${modelId}`} value={modelId}>
                    {modelId}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">{t("profiles.form.smallModelHelp")}</p>
            </div>

            <div className="space-y-2">
              <Label className={FIELD_LABEL_CLASS}>{t("profiles.form.modelCatalog")}</Label>
              <p className="text-xs text-muted-foreground">{t("profiles.form.modelCatalogHelp")}</p>
              {providerModelIds.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("profiles.form.noModels")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {providerModelIds.map((modelId) => (
                    <div
                      key={modelId}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
                    >
                      <span>{modelId}</span>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => handleRemoveModel(modelId)}
                        aria-label={t("profiles.form.removeModel")}
                        disabled={disabled}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newModelId}
                  disabled={disabled}
                  placeholder={t("profiles.form.newModelPlaceholder")}
                  onChange={(event) => setNewModelId(event.target.value)}
                />
                <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={handleAddModel}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("profiles.form.addModel")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {values.ohmyocEnabled ? (
        <section className="space-y-4 rounded-xl border border-border/80 bg-card/40 p-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">{t("profiles.form.ohmyCoreTitle")}</h4>
            <p className="text-xs text-muted-foreground">{t("profiles.form.ohmyCoreHelp")}</p>
          </div>

          <div className="space-y-3">
            {CORE_MODES.map((mode) => {
              const modeConfig = getModeConfig(values.ohmyocConfigObject, mode, preferredModel);
              const modeModel = readString(modeConfig.model);
              const modeVariant = getModeVariant(modeConfig, mode);
              const modeTemperature = readNumber(modeConfig.temperature);
              const modeModelOptions = uniqueStrings([modeModel, preferredModel, ...modelSelectOptions]);
              const variantLabel = modeVariant || MODE_DEFAULT_VARIANT[mode];
              const isCollapsed = collapsedModes[mode];
              const temperatureLabel =
                modeTemperature === undefined ? t("common.none") : String(modeTemperature);

              return (
                <div
                  key={mode}
                  className={cn(
                    "space-y-3 rounded-lg border bg-background/90 p-3.5 shadow-sm",
                    getModeCardClass(mode),
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">{t(`profiles.form.modeLabels.${mode}`)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`profiles.form.modeDescriptions.${mode}`)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {variantLabel}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setCollapsedModes((current) => ({
                            ...current,
                            [mode]: !current[mode],
                          }));
                        }}
                      >
                        {isCollapsed ? t("profiles.form.expandMode") : t("profiles.form.collapseMode")}
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            isCollapsed ? "rotate-0" : "rotate-180",
                          )}
                        />
                      </Button>
                    </div>
                  </div>
                  {isCollapsed ? (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{t("profiles.form.modeSummaryModel", { model: modeModel || t("common.none") })}</Badge>
                      <Badge variant="secondary">
                        {t("profiles.form.modeSummaryVariant", { variant: variantLabel || t("common.none") })}
                      </Badge>
                      <Badge variant="secondary">
                        {t("profiles.form.modeSummaryTemperature", { temperature: temperatureLabel })}
                      </Badge>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className={FIELD_LABEL_CLASS}>{t("profiles.form.modeModel")}</Label>
                        <Select
                          value={modeModel}
                          disabled={disabled || modeModelOptions.length === 0}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            updateOhmy((draft) => {
                              const modeDraft = ensureModeDraft(draft, mode);
                              setMaybeStringField(modeDraft, "model", nextValue);
                            });
                          }}
                        >
                          <option value="">{t("profiles.form.selectModelPlaceholder")}</option>
                          {modeModelOptions.map((modelId) => (
                            <option key={`${mode}-${modelId}`} value={modelId}>
                              {modelId}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className={FIELD_LABEL_CLASS}>{t("profiles.form.modeVariant")}</Label>
                        <Input
                          value={modeVariant}
                          disabled={disabled}
                          placeholder={t("profiles.form.modeVariantPlaceholder")}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            updateOhmy((draft) => {
                              const modeDraft = ensureModeDraft(draft, mode);
                              setModeVariant(modeDraft, mode, nextValue);
                            });
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className={FIELD_LABEL_CLASS}>{t("profiles.form.modeTemperature")}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={modeTemperature === undefined ? "" : String(modeTemperature)}
                          disabled={disabled}
                          placeholder={t("profiles.form.modeTemperaturePlaceholder")}
                          onChange={(event) => {
                            const rawValue = event.target.value;
                            updateOhmy((draft) => {
                              const modeDraft = ensureModeDraft(draft, mode);
                              if (!rawValue.trim()) {
                                delete modeDraft.temperature;
                                return;
                              }
                              const parsed = Number(rawValue);
                              if (Number.isFinite(parsed)) {
                                modeDraft.temperature = parsed;
                              }
                            });
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-border/80 bg-card/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">{t("profiles.form.previewTitle")}</h4>
            <p className="text-xs text-muted-foreground">{t("profiles.form.previewDescription")}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={copyCurrentPreview}>
            <Copy className="h-3.5 w-3.5" />
            {copiedPreviewTab === previewTab
              ? t("profiles.form.copied")
              : t("profiles.form.copyPreview")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={previewTab === "opencode" ? "default" : "outline"}
            onClick={() => setPreviewTab("opencode")}
          >
            {t("profiles.form.previewOpencode")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={previewTab === "ohmy" ? "default" : "outline"}
            onClick={() => setPreviewTab("ohmy")}
          >
            {t("profiles.form.previewOhmy")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={previewDirty[previewTab] ? "secondary" : "outline"} className="text-[11px]">
            {previewDirty[previewTab]
              ? t("profiles.form.previewDraftDirty")
              : t("profiles.form.previewDraftSynced")}
          </Badge>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={previewDisabled}
              onClick={() => formatPreviewDraft(previewTab)}
            >
              {t("profiles.form.previewFormat")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={previewDisabled || !previewDirty[previewTab]}
              onClick={() => resetPreviewDraft(previewTab)}
            >
              {t("profiles.form.previewReset")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={previewDisabled || !previewDirty[previewTab]}
              onClick={() => applyPreviewDraft(previewTab)}
            >
              {t("profiles.form.previewApply")}
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-border bg-muted/25 p-2">
          <Textarea
            value={previewDrafts[previewTab]}
            disabled={previewDisabled}
            onChange={(event) => handlePreviewDraftChange(previewTab, event.target.value)}
            className="min-h-[340px] resize-y border-0 bg-transparent font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
            spellCheck={false}
          />
        </div>
        {previewErrors[previewTab] ? (
          <p className="text-xs text-destructive">{previewErrors[previewTab]}</p>
        ) : null}
        {!values.ohmyocEnabled && previewTab === "ohmy" ? (
          <p className="text-xs text-muted-foreground">{t("profiles.form.disabledOhmyHint")}</p>
        ) : null}
      </section>
    </div>
  );
}

export function toProfileFormValues(profile?: Profile | null): ProfileFormValues {
  if (!profile) {
    return {
      name: "",
      description: "",
      tagsText: "",
      opencodeConfigObject: createDefaultOpencodeConfig(),
      ohmyocEnabled: false,
      ohmyocConfigObject: createDefaultOhmyConfig(),
      targetPath: "",
      statsEnabled: false,
    };
  }
  return {
    name: profile.name,
    description: profile.description,
    tagsText: profile.tags.join(", "),
    opencodeConfigObject: parseConfigText(profile.opencodeConfig, createDefaultOpencodeConfig()),
    ohmyocEnabled: profile.ohmyocEnabled,
    ohmyocConfigObject: parseConfigText(profile.ohmyocConfig || "{}", createDefaultOhmyConfig()),
    targetPath: profile.targetPath,
    statsEnabled: profile.statsEnabled,
  };
}

export function toCreateInput(values: ProfileFormValues): CreateProfileInput {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    tags: parseTags(values.tagsText),
    opencodeConfig: stringifyConfigObject(values.opencodeConfigObject),
    ohmyocEnabled: values.ohmyocEnabled,
    ohmyocConfig: stringifyConfigObject(values.ohmyocConfigObject),
    targetPath: values.targetPath.trim(),
    statsEnabled: values.statsEnabled,
  };
}

export function toUpdateInput(values: ProfileFormValues): UpdateProfileInput {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    tags: parseTags(values.tagsText),
    opencodeConfig: stringifyConfigObject(values.opencodeConfigObject),
    ohmyocEnabled: values.ohmyocEnabled,
    ohmyocConfig: stringifyConfigObject(values.ohmyocConfigObject),
    targetPath: values.targetPath.trim(),
    statsEnabled: values.statsEnabled,
  };
}

function parseTags(tagsText: string): string[] {
  if (!tagsText.trim()) {
    return [];
  }
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function createDefaultOpencodeConfig(): JsonObject {
  return {
    $schema: "https://opencode.ai/config.json",
    provider: {
      openai: {
        options: {
          baseURL: "",
          apiKey: "",
        },
        models: {},
      },
    },
    model: "",
    small_model: "",
  };
}

function createDefaultOhmyConfig(): JsonObject {
  return {
    $schema:
      "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
    agents: {},
  };
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function jsonEquals(left: JsonObject, right: JsonObject): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getProviderKeys(opencodeConfig: JsonObject): string[] {
  const provider = asObject(opencodeConfig.provider);
  const keys = Object.keys(provider);
  return keys.length > 0 ? keys : ["openai"];
}

function collectLinkedModels(opencodeConfig: JsonObject): string[] {
  const collected = new Set<string>();
  const topLevelModel = readString(opencodeConfig.model);
  const smallModel = readString(opencodeConfig.small_model);
  if (topLevelModel) {
    collected.add(topLevelModel);
  }
  if (smallModel) {
    collected.add(smallModel);
  }

  const provider = asObject(opencodeConfig.provider);
  for (const providerValue of Object.values(provider)) {
    const providerEntry = asObject(providerValue);
    const models = asObject(providerEntry.models);
    for (const [modelId, modelNode] of Object.entries(models)) {
      if (modelId.trim()) {
        collected.add(modelId);
      }
      const modelName = readString(asObject(modelNode).name);
      if (modelName) {
        collected.add(modelName);
      }
    }
  }

  return Array.from(collected);
}

function getPreferredModel(opencodeConfig: JsonObject, candidates: string[]): string {
  const preferred = readString(opencodeConfig.model);
  if (preferred) {
    return preferred;
  }
  return candidates[0] ?? "";
}

function getProviderView(opencodeConfig: JsonObject, providerKey: string): {
  options: JsonObject;
  models: JsonObject;
} {
  const provider = asObject(opencodeConfig.provider);
  const providerEntry = asObject(provider[providerKey]);
  return {
    options: asObject(providerEntry.options),
    models: asObject(providerEntry.models),
  };
}

function ensureProvider(opencodeConfig: JsonObject, providerKey: string): JsonObject {
  const provider = ensureObjectField(opencodeConfig, "provider");
  const providerEntry = ensureObjectField(provider, providerKey);
  ensureObjectField(providerEntry, "options");
  ensureObjectField(providerEntry, "models");
  return providerEntry;
}

function syncOhmyCoreModes(
  ohmyConfig: JsonObject,
  candidates: string[],
  preferredModel: string,
  createMissing: boolean,
): JsonObject {
  const next = cloneJsonObject(ohmyConfig);
  const agents = ensureObjectField(next, "agents");
  const fallbackModel = preferredModel || candidates[0] || "";

  for (const mode of CORE_MODES) {
    const exists = isObjectValue(agents[mode]);
    if (!exists && !createMissing) {
      continue;
    }

    const modeDraft = ensureModeDraft(next, mode);
    const currentModel = readString(modeDraft.model);
    const shouldReplace = !currentModel || (candidates.length > 0 && !candidates.includes(currentModel));
    if (shouldReplace) {
      setMaybeStringField(modeDraft, "model", fallbackModel);
    }

    const variantKey = MODE_VARIANT_KEY[mode];
    const variantValue = readString(modeDraft[variantKey]);
    if (!variantValue) {
      modeDraft[variantKey] = MODE_DEFAULT_VARIANT[mode];
    }
  }

  return next;
}

function getModeConfig(ohmyConfig: JsonObject, mode: CoreMode, preferredModel: string): JsonObject {
  const agents = asObject(ohmyConfig.agents);
  const modeConfig = asObject(agents[mode]);
  if (!readString(modeConfig.model) && preferredModel) {
    return {
      ...modeConfig,
      model: preferredModel,
    };
  }
  return modeConfig;
}

function ensureModeDraft(ohmyConfig: JsonObject, mode: CoreMode): JsonObject {
  const agents = ensureObjectField(ohmyConfig, "agents");
  return ensureObjectField(agents, mode);
}

function getModeVariant(modeConfig: JsonObject, mode: CoreMode): string {
  const primary = MODE_VARIANT_KEY[mode];
  const secondary = primary === "variant" ? "variants" : "variant";
  return readString(modeConfig[primary]) || readString(modeConfig[secondary]);
}

function setModeVariant(modeConfig: JsonObject, mode: CoreMode, rawValue: string) {
  const primary = MODE_VARIANT_KEY[mode];
  const secondary = primary === "variant" ? "variants" : "variant";
  delete modeConfig[secondary];
  setMaybeStringField(modeConfig, primary, rawValue);
}

function setMaybeStringField(target: JsonObject, key: string, rawValue: string) {
  const value = rawValue.trim();
  if (!value) {
    delete target[key];
    return;
  }
  target[key] = value;
}

function asObject(value: JsonValue | undefined): JsonObject {
  return isObjectValue(value) ? value : {};
}

function ensureObjectField(target: JsonObject, key: string): JsonObject {
  const current = target[key];
  if (isObjectValue(current)) {
    return current;
  }
  const created: JsonObject = {};
  target[key] = created;
  return created;
}

function isObjectValue(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function uniqueStrings(values: string[]): string[] {
  const merged = values.filter((value) => value.trim().length > 0);
  return Array.from(new Set(merged));
}

function formatPreviewJson(value: JsonObject): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function getModeCardClass(mode: CoreMode): string {
  if (mode === "prometheus") {
    return "border-amber-500/35 bg-amber-500/[0.03]";
  }
  if (mode === "hephaestus") {
    return "border-orange-500/30 bg-orange-500/[0.03]";
  }
  if (mode === "atlas") {
    return "border-cyan-500/30 bg-cyan-500/[0.03]";
  }
  return "border-indigo-500/30 bg-indigo-500/[0.03]";
}
