import { FileTextIcon, UploadIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FileUploadProps = {
  id: string;
  label: string;
  description?: string;
  accept?: string;
  className?: string;
  disabled?: boolean;
  error?: string | null;
  multiple?: boolean;
  selectedFile?: File | null;
  onChange?: (files: FileList | null) => void;
  onClear?: () => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
  id,
  label,
  description,
  accept,
  className,
  disabled,
  error,
  multiple,
  selectedFile,
  onChange,
  onClear,
}: FileUploadProps) {
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <label
        className={cn(
          "focus-ring flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card p-5 text-center transition-colors hover:bg-muted/40",
          error && "border-status-rejected bg-status-rejected-bg/30",
          disabled && "cursor-not-allowed opacity-60",
        )}
        htmlFor={id}
        aria-disabled={disabled || undefined}
      >
        {selectedFile ? (
          <>
            <FileTextIcon aria-hidden="true" className="size-5 text-status-approved" />
            <span className="max-w-full truncate text-sm font-medium">
              {selectedFile.name}
            </span>
            <FieldDescription>
              {selectedFile.type || "Unknown type"} · {formatFileSize(selectedFile.size)}
            </FieldDescription>
          </>
        ) : (
          <>
            <UploadIcon aria-hidden="true" className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">Choose supporting file</span>
            {description ? <FieldDescription>{description}</FieldDescription> : null}
          </>
        )}
      </label>
      {selectedFile && onClear ? (
        <Button
          disabled={disabled}
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={onClear}
        >
          <XIcon aria-hidden="true" data-icon="inline-start" />
          Remove file
        </Button>
      ) : null}
      {error ? (
        <FieldDescription className="text-status-rejected">
          {error}
        </FieldDescription>
      ) : null}
      <Input
        id={id}
        accept={accept}
        className="sr-only"
        disabled={disabled}
        multiple={multiple}
        type="file"
        onChange={(event) => onChange?.(event.target.files)}
      />
    </Field>
  );
}
