"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { DEFAULTABLE_FIELDS, FIELD_DEFINITIONS, type ImportField, type ImportMapping } from "@/lib/imports/fields";
import type { DateConvention } from "@/lib/imports/normalize";
import type { ImportBatchRow, ImportRowRecord } from "@/lib/imports/server";
import type { ImportOptions } from "@/lib/imports/validate";
import type { MappingSuggestion } from "@/lib/imports/ai/assist";
import { SparklesIcon } from "lucide-react";

type Props = {
  batch: ImportBatchRow;
  rows: ImportRowRecord[];
  permittedMdas: Array<{ id: string; name: string }>;
  /** Active values for fields that can take one value for all rows. */
  defaultChoices: Partial<Record<ImportField, Array<{ id: string; name: string }>>>;
  busy: boolean;
  onApply: (mapping: ImportMapping, options: ImportOptions) => void;
  aiSuggestions: MappingSuggestion[] | null;
  aiConfigured: boolean;
  aiCallsLeft: number;
  onSuggest: () => void;
};

function samples(rows: ImportRowRecord[], header: string | undefined): string {
  if (!header) return "";
  const values: string[] = [];
  for (const row of rows) {
    const value = (row.raw[header] ?? "").trim();
    if (value && !values.includes(value)) values.push(value);
    if (values.length === 3) break;
  }
  return values.join(" · ");
}

export function MappingPanel({ batch, rows, permittedMdas, defaultChoices, busy, onApply, aiSuggestions, aiConfigured, aiCallsLeft, onSuggest }: Props) {
  const [mapping, setMapping] = useState<ImportMapping>(batch.mapping);
  const [dateConvention, setDateConvention] = useState<DateConvention | "">(batch.options.date_convention ?? "");
  const [defaultMdaId, setDefaultMdaId] = useState<string>(batch.options.default_mda_id ?? "");
  const [fieldDefaults, setFieldDefaults] = useState<Partial<Record<ImportField, string>>>(batch.options.field_defaults ?? {});

  // A server-side revision (another tab, or a sheet change) resets the form.
  useEffect(() => {
    setMapping(batch.mapping);
    setDateConvention(batch.options.date_convention ?? "");
    setDefaultMdaId(batch.options.default_mda_id ?? "");
    setFieldDefaults(batch.options.field_defaults ?? {});
  }, [batch.revision, batch.mapping, batch.options.date_convention, batch.options.default_mda_id, batch.options.field_defaults]);

  // MDA users registered under one MDA are defaulted to it by the server.
  const singleMda = permittedMdas.length === 1 ? permittedMdas[0] : null;
  const used = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);
  const needsDateConvention = rows.some((row) => row.issues.some((issue) => issue.code === "date_convention_required"));
  const definitions = FIELD_DEFINITIONS[batch.ledger_type];
  const defaultable = new Set<ImportField>(DEFAULTABLE_FIELDS[batch.ledger_type]);
  const dirty =
    JSON.stringify(fieldDefaults) !== JSON.stringify(batch.options.field_defaults ?? {}) ||
    JSON.stringify(mapping) !== JSON.stringify(batch.mapping) ||
    (dateConvention || null) !== (batch.options.date_convention ?? null) ||
    (defaultMdaId || null) !== (batch.options.default_mda_id ?? null);

  function setField(field: ImportField, header: string) {
    setMapping((current) => {
      const next = { ...current };
      if (header) next[field] = header;
      else delete next[field];
      return next;
    });
  }

  function setFieldDefault(field: ImportField, id: string) {
    setFieldDefaults((current) => {
      const next = { ...current };
      if (id) next[field] = id;
      else delete next[field];
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Map columns</CardTitle>
        <CardDescription>
          Match each field to a column in {batch.sheet_name === "CSV" ? "the file" : `sheet "${batch.sheet_name}"`} (header
          on row {batch.header_row_number}). Only exact header matches were pre-filled; check every one. Values are matched
          exactly against reference data — nothing is guessed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {aiConfigured ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy || aiCallsLeft <= 0} onClick={onSuggest}>
              <SparklesIcon aria-hidden="true" />
              {aiSuggestions ? "Ask AI again" : "Suggest mapping with AI"}
            </Button>
            {aiSuggestions?.some((s) => s.header && s.header !== mapping[s.field]) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  setMapping((current) => {
                    const next = { ...current };
                    const taken = new Set(Object.values(next));
                    for (const s of aiSuggestions ?? []) {
                      if (!s.header || next[s.field] || taken.has(s.header)) continue;
                      next[s.field] = s.header;
                      taken.add(s.header);
                    }
                    return next;
                  })
                }
              >
                Use AI suggestions for empty fields
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Sends this sheet&apos;s column names and {8} sample rows to OpenAI. Suggestions are not applied until you click
              Apply.
            </span>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {definitions.map((def) => {
            const header = mapping[def.field];
            const example = samples(rows, header);
            return (
              <Field key={def.field}>
                <FieldLabel htmlFor={`map-${def.field}`}>
                  {def.label}
                  {def.required ? <span className="text-status-rejected"> *</span> : null}
                </FieldLabel>
                <Select
                  id={`map-${def.field}`}
                  value={header ?? ""}
                  onChange={(event) => setField(def.field, event.target.value)}
                  disabled={busy}
                >
                  <option value="">— Not mapped —</option>
                  {batch.headers.map((h) => (
                    <option key={h} value={h} disabled={used.has(h) && h !== header}>
                      {h}
                    </option>
                  ))}
                </Select>
                <FieldDescription className="truncate">
                  {example ? `e.g. ${example}` : def.description ?? (def.required ? "Required." : "Optional.")}
                </FieldDescription>
                {defaultable.has(def.field) ? (
                  <Select
                    id={`default-${def.field}`}
                    aria-label={header ? `${def.label} for rows with a blank cell` : `${def.label} for all rows`}
                    value={fieldDefaults[def.field] ?? ""}
                    onChange={(event) => setFieldDefault(def.field, event.target.value)}
                    disabled={busy}
                  >
                    <option value="">
                      {header ? "Blank cells: keep those rows blocked" : "Or choose one value for all rows…"}
                    </option>
                    {(defaultChoices[def.field] ?? []).map((option) => (
                      <option key={option.id} value={option.id}>
                        {header ? `Blank cells: ${option.name}` : `All rows: ${option.name}`}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {(() => {
                  const suggestion = aiSuggestions?.find((s) => s.field === def.field);
                  if (!suggestion || (suggestion.header ?? "") === (header ?? "")) return null;
                  return (
                    <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <SparklesIcon aria-hidden="true" className="size-3 text-primary" />
                      {suggestion.header ? (
                        <>
                          AI suggests <span className="font-medium text-foreground">{suggestion.header}</span> ·{" "}
                          {Math.round(suggestion.confidence * 100)}%
                          <button
                            type="button"
                            className="font-medium text-primary underline-offset-2 hover:underline"
                            disabled={busy || (used.has(suggestion.header) && suggestion.header !== header)}
                            onClick={() => setField(def.field, suggestion.header!)}
                          >
                            Use
                          </button>
                        </>
                      ) : (
                        <>AI: no column clearly holds this</>
                      )}
                      <span className="w-full truncate" title={suggestion.reason}>
                        {suggestion.reason}
                      </span>
                    </p>
                  );
                })()}
              </Field>
            );
          })}
        </div>

        <Field className="max-w-lg">
          <FieldLabel htmlFor="default-mda">
            {mapping.mda ? "MDA for rows with a blank MDA cell" : "Which MDA do these rows belong to?"}
          </FieldLabel>
          <Select
            id="default-mda"
            value={defaultMdaId}
            onChange={(event) => setDefaultMdaId(event.target.value)}
            disabled={busy}
          >
            <option value="">{mapping.mda ? "None — keep blank-MDA rows blocked" : "Choose an MDA…"}</option>
            {permittedMdas.map((mda) => (
              <option key={mda.id} value={mda.id}>
                {mda.name}
              </option>
            ))}
          </Select>
          <FieldDescription>
            {singleMda && defaultMdaId === singleMda.id
              ? `Defaulted to ${singleMda.name}, the MDA you're registered under. `
              : null}
            {mapping.mda
              ? "Rows that name an MDA in the mapped column keep that MDA; rows naming an MDA you can't submit for stay blocked."
              : `Applies to all ${rows.length} rows. Map an MDA column instead if the file covers several MDAs.`}
          </FieldDescription>
        </Field>

        <Field className="max-w-lg">
          <FieldLabel htmlFor="date-convention">Numeric dates such as 04/05/2026 mean</FieldLabel>
          <Select
            id="date-convention"
            value={dateConvention}
            onChange={(event) => setDateConvention(event.target.value as DateConvention | "")}
            disabled={busy}
          >
            <option value="">Not chosen — keep those rows blocked</option>
            <option value="dmy">Day first: 04/05/2026 is 4 May 2026</option>
            <option value="mdy">Month first: 04/05/2026 is 5 April 2026</option>
          </Select>
          <FieldDescription>
            {needsDateConvention
              ? "Some rows use day/month numbers that can't be read without this choice."
              : "ISO dates (2026-05-04), written months and Excel date cells don't need this."}
          </FieldDescription>
        </Field>

        <div>
          <Button
            type="button"
            disabled={busy || !dirty}
            onClick={() =>
              onApply(mapping, {
                date_convention: dateConvention || null,
                default_mda_id: defaultMdaId || null,
                field_defaults: fieldDefaults,
              })
            }
          >
            {busy ? "Checking rows…" : "Apply and check rows"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
