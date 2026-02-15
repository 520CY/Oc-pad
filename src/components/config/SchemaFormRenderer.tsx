import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { SchemaField } from "@/components/config/SchemaField";
import { Separator } from "@/components/ui/separator";
import {
  JsonObject,
  SchemaRoot,
  ensureObject,
  inferSchemaType,
  resolveSchemaNode,
} from "@/lib/schema/normalize";

interface SchemaFormRendererProps {
  title: string;
  description?: string;
  schema: SchemaRoot;
  value: JsonObject;
  disabled?: boolean;
  onChange: (nextValue: JsonObject) => void;
}

export function SchemaFormRenderer({
  title,
  description,
  schema,
  value,
  disabled,
  onChange,
}: SchemaFormRendererProps) {
  const { t } = useTranslation();
  const resolvedRoot = useMemo(() => resolveSchemaNode(schema, schema), [schema]);
  const rootType = inferSchemaType(resolvedRoot, value);
  const fallbackValue = ensureObject(value);

  if (rootType !== "object") {
    return (
      <div className="space-y-3 rounded-md border border-border p-4">
        <h4 className="text-sm font-semibold">{title}</h4>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        <p className="text-sm text-muted-foreground">{t("profiles.schema.invalidRootSchema")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Separator />
      <SchemaField
        schema={resolvedRoot}
        rootSchema={schema}
        label={title}
        value={fallbackValue}
        disabled={disabled}
        onChange={(nextValue) => onChange(ensureObject(nextValue))}
      />
    </div>
  );
}
