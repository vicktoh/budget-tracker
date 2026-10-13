import Link from "next/link";
import { CheckCircle2Icon } from "lucide-react";
import { ledgerLabel } from "@/components/imports/import-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { decimalToKobo, formatKobo } from "@/lib/imports/normalize";
import type { ImportReceipt } from "@/lib/imports/server";

/** What the database actually committed — never a client-side estimate. */
export function ReceiptPanel({ receipt }: { receipt: ImportReceipt }) {
  const entryPath = receipt.ledger_type === "funding" ? "funding" : "expenditure";
  const notInserted = receipt.not_inserted;
  return (
    <Card className="border-status-approved/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2Icon aria-hidden="true" className="size-5 text-status-approved" />
          Inserted {receipt.inserted_count} {ledgerLabel(receipt.ledger_type).toLowerCase()} totalling{" "}
          {formatKobo(decimalToKobo(receipt.inserted_total))}
        </CardTitle>
        <CardDescription>
          Committed {new Date(receipt.committed_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}.
          Not inserted: {notInserted.blocked} blocked, {notInserted.duplicate} skipped, {notInserted.excluded} excluded — all
          listed in the issue report. Viewers can now review and comment on these entries in the{" "}
          <Link className="underline" href="/entries">
            entry register
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source row</TableHead>
              <TableHead>Entry ID</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipt.entries.map((entry) => (
              <TableRow key={entry.entry_id}>
                <TableCell className="tabular-nums">{entry.source_row_number}</TableCell>
                <TableCell>
                  <Link className="font-medium hover:underline" href={`/entries/${entryPath}/${entry.entry_id}`}>
                    {entry.public_id ?? entry.entry_id}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatKobo(decimalToKobo(String(entry.amount)))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
