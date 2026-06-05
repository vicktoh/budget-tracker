import { SaveIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function EntryFoundationRoute({ type }: { type: "funding" | "expenditure" }) {
  const isFunding = type === "funding";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        description={
          isFunding
            ? "Form foundation for Funding Entries with controlled fields and traceability."
            : "Form foundation for Expenditure Entries with PHC, payment, voucher, and AOP sections."
        }
        title={isFunding ? "Funding Entry" : "Expenditure Entry"}
      />
      <Card>
        <CardHeader>
          <CardTitle>Entry details</CardTitle>
          <CardDescription>
            Phase 3 will connect these fields to active Reference Data and validation rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="transaction-date">Transaction date</FieldLabel>
                <Input id="transaction-date" type="date" />
              </Field>
              <Field>
                <FieldLabel htmlFor="mda">MDA</FieldLabel>
                <Select id="mda">
                  <option>Select assigned MDA</option>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="programme-area">Programme Area</FieldLabel>
                <Select id="programme-area">
                  <option>Select Programme Area</option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="amount">Money Amount</FieldLabel>
                <Input id="amount" inputMode="decimal" placeholder="0.00" />
              </Field>
              <Field>
                <FieldLabel htmlFor="reference">
                  {isFunding ? "Reference Number" : "Voucher Reference Number"}
                </FieldLabel>
                <Input id="reference" placeholder={isFunding ? "REF-2026-001" : "VCH-2026-001"} />
              </Field>
              <Field>
                <FieldLabel htmlFor="status">Entry Status</FieldLabel>
                <Select id="status" disabled>
                  <option>Pending</option>
                </Select>
                <FieldDescription>New submissions enter the pending queue.</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
              <Textarea id="remarks" placeholder="Required when an Other Option is selected." />
            </Field>
            <FileUpload
              description="Voucher, receipt, approval letter, release memo, or other supporting files."
              id="attachments"
              label="Entry Attachments"
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="button">
            <SaveIcon aria-hidden="true" data-icon="inline-start" />
            Save draft foundation
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
