"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { FIELD_DEFINITIONS, type ImportField, type ImportMapping } from "@/lib/imports/fields";
import type { DateConvention } from "@/lib/imports/normalize";
import type { ImportBatchRow, ImportRowRecord } from "@/lib/imports/server";
import type { ImportOptions } from "@/lib/imports/validate";

type Props = {
  batch: ImportBatchRow;
  rows: ImportRowRecord[];
  permittedMdas: Array<{ id: string; name: string }>;
  busy: boolean;
  onApply: (mapping: ImportMapping, options: ImportOptions) => void;
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

export function MappingPanel({ batch, rows, permittedMdas, busy, onApply }: Props) {
  const [mapping, setMapping] = useState<ImportMapping>(batch.mapping);
  const [dateConvention, setDateConvention] = useState<DateConvention | "">(batch.options.date_convention ?? "");
  const [defaultMdaId, setDefaultMdaId] = useState<string>(batch.options.default_mda_id ?? "");

  // A server-side revision (another tab, or a sheet change) resets the form.
  useEffect(() => {
    setMapping(batch.mapping);
    setDateConvention(batch.options.date_convention ?? "");
    setDefaultMdaId(batch.options.default_mda_id ?? "");
  }, [batch.revision, batch.mapping, batch.options.date_convention, batch.options.default_mda_id]);

  // MDA users registered under one MDA are defaulted to it by the server.
  const singleMda = permittedMdas.length === 1 ? permittedMdas[0] : null;
  const used = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);
  const needsDateConvention = rows.some((row) => row.issues.some((issue) => issue.code === "date_convention_required"));
  const definitions = FIELD_DEFINITIONS[batch.ledger_type];
  const dirty =
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
