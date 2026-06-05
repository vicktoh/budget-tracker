import { DownloadIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function ExportAction({
  children = "Export",
  ...props
}: ButtonProps) {
  return (
    <Button type="button" variant="outline" {...props}>
      <DownloadIcon aria-hidden="true" data-icon="inline-start" />
      {children}
    </Button>
  );
}
