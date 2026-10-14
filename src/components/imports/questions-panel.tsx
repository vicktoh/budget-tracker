"use client";

import { useEffect, useMemo, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { FIELD_DEFINITIONS } from "@/lib/imports/fields";
import type { ValueQuestionView } from "@/lib/imports/ai/actions";
import type { LedgerType } from "@/lib/imports/fields";

const DECLINE = "__decline__";

type Props = {
  ledger: LedgerType;
  questions: ValueQuestionView[];
  aiConfigured: boolean;
  aiCallsLeft: number;
  busy: boolean;
  onAnswer: (answers: Array<{ field: string; source_text: string; ref_id: string | null }>) => void;
  onSuggest: () => void;
};

function initialChoice(q: ValueQuestionView): string {
  if (q.answer === null) return DECLINE;
  if (q.answer) return q.answer;
  return "";
}

/**
 * "What does this value mean?" questions for values that didn't match the
 * reference lists exactly. One answer applies to every row with that value;
 * nothing is saved until the user presses Save, and AI suggestions are only
 * pre-selected when the user asks for them.
 */
export function QuestionsPanel({ ledger, questions, aiConfigured, aiCallsLeft, busy, onAnswer, onSuggest }: Props) {
  const [choices, setChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    setChoices(Object.fromEntries(questions.map((q) => [q.key, initialChoice(q)])));
  }, [questions]);

  const labelFor = (field: string) => FIELD_DEFINITIONS[ledger].find((d) => d.field === field)?.label ?? field;
  const open = questions.filter((q) => q.answer === undefined).length;
  const changed = useMemo(
    () => questions.filter((q) => (choices[q.key] ?? "") !== initialChoice(q) && (choices[q.key] ?? "") !== ""),
    [choices, questions],
  );
  const hasUnusedSuggestions = questions.some((q) => q.suggestion?.candidate_id && !choices[q.key]);

  if (!questions.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Questions about values</CardTitle>
        <CardDescription>
          These values didn&apos;t exactly match a configured value, so their rows are blocked. Tell us what each one means
          and the answer applies to every row with that exact text. {open ? `${open} unanswered.` : "All answered."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {aiConfigured ? (
            <Button type="button" variant="outline" size="sm" disabled={busy || !open || aiCallsLeft <= 0} onClick={onSuggest}>
              <SparklesIcon aria-hidden="true" />
              Suggest answers with AI
            </Button>
          ) : null}
          {hasUnusedSuggestions ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                setChoices((current) => {
                  const next = { ...current };
                  for (const q of questions) {
                    if (!next[q.key] && q.suggestion?.candidate_id) next[q.key] = q.suggestion.candidate_id;
                  }
                  return next;
                })
              }
            >
              Pre-fill AI suggestions
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            AI suggestions send only the unmatched values and the list of valid names to OpenAI. You still confirm each one.
          </span>
        </div>

        <ul className="flex flex-col divide-y rounded-lg border">
          {questions.map((q) => {
            const choice = choices[q.key] ?? "";
            const suggested = q.suggestion?.candidate_id ? q.options.find((o) => o.id === q.suggestion!.candidate_id) : null;
            return (
              <li key={q.key} className="flex flex-col gap-2 p-3 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm">
                    <span className="text-muted-foreground">{labelFor(q.field)}:</span>{" "}
                    <span className="font-medium">&ldquo;{q.source_text}&rdquo;</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      ({q.rows} {q.rows === 1 ? "row" : "rows"})
                    </span>
                  </span>
                  {q.suggestion ? (
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="outline" className="gap-1">
                        <SparklesIcon aria-hidden="true" className="size-3" />
                        {suggested ? `AI: ${suggested.name} · ${Math.round(q.suggestion.confidence * 100)}%` : "AI: no clear match"}
                      </Badge>
                      <span>{q.suggestion.reason}</span>
                    </span>
                  ) : null}
                  {q.answer !== undefined ? (
                    <span className="text-xs text-status-approved">
                      {q.answer === null ? "Answered: leave blocked" : `Answered: ${q.options.find((o) => o.id === q.answer)?.name ?? "saved"}`}
                    </span>
                  ) : null}
                </div>
                <Select
                  aria-label={`Meaning of ${q.source_text}`}
                  className="w-full md:w-72"
                  value={choice}
                  disabled={busy}
                  onChange={(event) => setChoices((current) => ({ ...current, [q.key]: event.target.value }))}
                >
                  <option value="">Choose what this means…</option>
                  {q.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                  <option value={DECLINE}>None of these — keep rows blocked</option>
                </Select>
              </li>
            );
          })}
        </ul>

        <div>
          <Button
            type="button"
            disabled={busy || !changed.length}
            onClick={() =>
              onAnswer(
                changed.map((q) => ({
                  field: q.field,
                  source_text: q.source_text,
                  ref_id: choices[q.key] === DECLINE ? null : choices[q.key],
                })),
              )
            }
          >
            {busy ? "Re-checking rows…" : `Save ${changed.length || ""} ${changed.length === 1 ? "answer" : "answers"} and re-check`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
