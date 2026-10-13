import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 pb-5 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 max-w-3xl flex-col gap-1">
        <h1 className="break-words text-xl font-bold tracking-normal md:text-2xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div> : null}
    </div>
  );
}
