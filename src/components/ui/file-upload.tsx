import { UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type FileUploadProps = {
  id: string;
  label: string;
  description?: string;
  className?: string;
};

export function FileUpload({ id, label, description, className }: FileUploadProps) {
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <label
        className={cn(
          "focus-ring flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card p-5 text-center hover:bg-muted/40",
        )}
        htmlFor={id}
      >
        <UploadIcon aria-hidden="true" />
        <span className="text-sm font-medium">Choose supporting files</span>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </label>
      <Input id={id} className="sr-only" multiple type="file" />
    </Field>
  );
}
