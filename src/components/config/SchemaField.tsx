import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  JsonValue,
  SchemaNode,
  SchemaRoot,
  createDefaultValue,
  ensureArray,
  ensureObject,
  inferSchemaType,
  isJsonObject,
  resolveSchemaNode,
} from "@/lib/schema/normalize";

interface SchemaFieldProps {
  schema: SchemaNode;
  rootSchema: SchemaRoot;
  label: string;
  value: JsonValue | undefined;
  onChange: (nextValue: JsonValue) => void;
  disabled?: boolean;
  required?: boolean;
  depth?: number;
  removable?: boolean;
  onRemove?: () => void;
}

export function SchemaField({
  schema,
  rootSchema,
  label,
  value,
  onChange,
  disabled,
  required,
  depth = 0,
  removable,
  onRemove,
}: SchemaFieldProps) {
  const { t } = useTranslation();
  const resolvedSchema = useMemo(() => resolveSchemaNode(schema, rootSchema), [schema, rootSchema]);
  const fieldType = inferSchemaType(resolvedSchema, value);
  const description =
    typeof resolvedSchema.description === "string" && resolvedSchema.description.length > 0
      ? resolvedSchema.description
      : undefined;

  if (fieldType === "object") {
    const objectValue = ensureObject(value);
    const properties = resolvedSchema.properties ?? {};
    const requiredSet = new Set(Array.isArray(resolvedSchema.required) ? resolvedSchema.required : []);
    const knownKeys = new Set(Object.keys(properties));
    const dynamicKeys = Object.keys(objectValue).filter((key) => !knownKeys.has(key));
    const additionalSchema =
      typeof resolvedSchema.additionalProperties === "object"
        ? resolvedSchema.additionalProperties
        : resolvedSchema.additionalProperties === true
          ? {}
          : undefined;

    return (
      <div className="space-y-3 rounded-md border border-border/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-semibold">
            {label}
            {required ? " *" : ""}
          </Label>
          {removable && onRemove ? (
            <Button type="button" variant="outline" size="sm" onClick={onRemove} disabled={disabled}>
              {t("profiles.schema.remove")}
            </Button>
          ) : null}
        </div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}

        {Object.entries(properties).map(([key, childSchema]) => {
          const childValue =
            objectValue[key] !== undefined ? objectValue[key] : createDefaultValue(childSchema, rootSchema);
          return (
            <SchemaField
              key={`${label}.${key}`}
              schema={childSchema}
              rootSchema={rootSchema}
              label={key}
              value={childValue}
              required={requiredSet.has(key)}
              disabled={disabled}
              depth={depth + 1}
              onChange={(nextValue) => {
                onChange({
                  ...objectValue,
                  [key]: nextValue,
                });
              }}
            />
          );
        })}

        {additionalSchema ? (
          <AdditionalPropertiesEditor
            label={label}
            rootSchema={rootSchema}
            schema={additionalSchema}
            value={objectValue}
            dynamicKeys={dynamicKeys}
            disabled={disabled}
            onChange={onChange}
          />
        ) : null}
      </div>
    );
  }

  if (fieldType === "array") {
    const itemSchema =
      Array.isArray(resolvedSchema.items) && resolvedSchema.items.length > 0
        ? resolvedSchema.items[0]
        : (resolvedSchema.items as SchemaNode | undefined) ?? {};
    const arrayValue = ensureArray(value);

    return (
      <div className="space-y-3 rounded-md border border-border/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-semibold">
            {label}
            {required ? " *" : ""}
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onChange([...arrayValue, createDefaultValue(itemSchema, rootSchema)]);
            }}
          >
            {t("profiles.schema.addItem")}
          </Button>
        </div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}

        {arrayValue.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("profiles.schema.emptyArray")}</p>
        ) : null}

        {arrayValue.map((item, index) => (
          <SchemaField
            key={`${label}[${index}]`}
            schema={itemSchema}
            rootSchema={rootSchema}
            label={`${label}[${index}]`}
            value={item}
            disabled={disabled}
            depth={depth + 1}
            removable
            onRemove={() => {
              const next = [...arrayValue];
              next.splice(index, 1);
              onChange(next);
            }}
            onChange={(nextValue) => {
              const next = [...arrayValue];
              next[index] = nextValue;
              onChange(next);
            }}
          />
        ))}
      </div>
    );
  }

  const enumOptions = Array.isArray(resolvedSchema.enum) ? resolvedSchema.enum : undefined;
  if (enumOptions && enumOptions.length > 0) {
    const selectedIndex = Math.max(
      0,
      enumOptions.findIndex((item) => JSON.stringify(item) === JSON.stringify(value)),
    );
    return (
      <div className="space-y-2">
        <Label className="text-sm">
          {label}
          {required ? " *" : ""}
        </Label>
        <Select
          value={String(selectedIndex)}
          disabled={disabled}
          onChange={(event) => {
            const nextIndex = Number(event.target.value);
            const nextValue = enumOptions[nextIndex];
            onChange(nextValue);
          }}
        >
          {enumOptions.map((option, index) => (
            <option key={`${label}-enum-${index}`} value={String(index)}>
              {String(option)}
            </option>
          ))}
        </Select>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    );
  }

  if (fieldType === "boolean") {
    return (
      <div className="space-y-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>
            {label}
            {required ? " *" : ""}
          </span>
        </label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    );
  }

  if (fieldType === "number" || fieldType === "integer") {
    return (
      <div className="space-y-2">
        <Label className="text-sm">
          {label}
          {required ? " *" : ""}
        </Label>
        <Input
          type="number"
          value={typeof value === "number" ? String(value) : ""}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value === "") {
              onChange(0);
              return;
            }
            const raw = Number(event.target.value);
            onChange(fieldType === "integer" ? Math.trunc(raw) : raw);
          }}
        />
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    );
  }

  const textValue =
    typeof value === "string"
      ? value
      : value === null || value === undefined
        ? ""
        : isJsonObject(value) || Array.isArray(value)
          ? JSON.stringify(value)
          : String(value);
  const shouldUseTextarea = textValue.includes("\n") || label.toLowerCase().includes("prompt");

  return (
    <div className="space-y-2">
      <Label className="text-sm">
        {label}
        {required ? " *" : ""}
      </Label>
      {shouldUseTextarea ? (
        <Textarea
          value={textValue}
          disabled={disabled}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input value={textValue} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      )}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

interface AdditionalPropertiesEditorProps {
  label: string;
  rootSchema: SchemaRoot;
  schema: SchemaNode;
  value: Record<string, JsonValue>;
  dynamicKeys: string[];
  disabled?: boolean;
  onChange: (next: JsonValue) => void;
}

function AdditionalPropertiesEditor({
  label,
  rootSchema,
  schema,
  value,
  dynamicKeys,
  disabled,
  onChange,
}: AdditionalPropertiesEditorProps) {
  const { t } = useTranslation();
  const [newKey, setNewKey] = useState("");

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("profiles.schema.additionalFields")}
        </Label>
      </div>

      <div className="flex gap-2">
        <Input
          value={newKey}
          disabled={disabled}
          placeholder={t("profiles.schema.newFieldKeyPlaceholder")}
          onChange={(event) => setNewKey(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            const key = newKey.trim();
            if (!key || value[key] !== undefined) {
              return;
            }
            onChange({
              ...value,
              [key]: createDefaultValue(schema, rootSchema),
            });
            setNewKey("");
          }}
        >
          {t("profiles.schema.addField")}
        </Button>
      </div>

      {dynamicKeys.map((dynamicKey) => (
        <SchemaField
          key={`${label}.${dynamicKey}.dynamic`}
          schema={schema}
          rootSchema={rootSchema}
          label={dynamicKey}
          value={value[dynamicKey]}
          disabled={disabled}
          removable
          onRemove={() => {
            const next = { ...value };
            delete next[dynamicKey];
            onChange(next);
          }}
          onChange={(nextValue) => {
            onChange({
              ...value,
              [dynamicKey]: nextValue,
            });
          }}
        />
      ))}
    </div>
  );
}
