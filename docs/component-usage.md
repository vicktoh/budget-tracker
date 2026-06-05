# Component Usage Rules

These rules turn `DESIGN.md` into day-to-day shadcn-style conventions for the
Kano Health Finance Tracker scaffold. They apply to every feature shipped in
Phases 3 and later.

## Color & tokens

- Use semantic Tailwind classes (`bg-background`, `text-foreground`,
  `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`,
  `text-status-pending` …). Never use raw hex values or arbitrary HSL.
- Status badges always use `pending`, `approved`, `processed`, `rejected`
  via `StatusBadge`. Data Quality Warnings are amber (warning), not red.
- Charts use the `chart-1..chart-5` token sequence (green, teal, brown,
  amber, slate). Do not introduce new chart colors.

## Layout & spacing

- Page layouts begin with `<PageHeader>` and the active workflow — never a
  hero or marketing block.
- Use `gap-*` for stack/inline rhythm. Do not use `space-x-*` / `space-y-*`.
- Cards are functional panels. Do not nest cards in cards. Use
  `Card` + `CardHeader` + `CardContent` together (full composition).
- Forms use `FieldGroup` → `Field` → `FieldLabel` + input + `FieldDescription`.

## Tables

- Use `<Table>` with `<TableHeader>` rows of `<TableHead>` and body rows of
  `<TableCell>`. Add `tabular-nums` (or `data-amount`) to money cells.
- Place filters above the table inside a `FilterBar` row, sortable headers
  inside the table, and row-level actions in a trailing `DropdownMenu`.

## Forms

- Long forms split into named sections (Entry Details, Classification,
  Financial Traceability, PHC Details, AOP Linkage, Attachments).
- Use `Combobox` for searchable Reference Data, plain `Select` for short
  lists, `DatePicker` for transaction dates, and `Switch`/`Checkbox` for
  binary toggles. Use `RadioGroup` for short mutually-exclusive choices.
- Progressive reveal: PHC LGA/Facility fields only render when the PHC
  toggle is on, and Facility options are filtered by LGA. AOP Activity is
  filtered by selected MDA + fiscal year.

## Overlays & feedback

- `Dialog` is for focused edit flows; `Sheet` for side panels with longer
  content; `AlertDialog` for destructive confirmations.
- `sonner` (via `<Toaster richColors />`) is for transient toasts.
- `Alert` (variants for default/warning/destructive) is for page-level
  notices that must stay visible.
- `Skeleton` is for loading states; `Empty` is for empty queues, no-filter
  results, and finished import/export lists.

## Navigation & shell

- `AppShell` composes `AppSidebar` + `TopHeader`. Sidebar grouping uses the
  `section` field on `NavigationItem` and only items the user's role
  qualifies for are rendered.
- `TopHeader` carries the fiscal-year badge, MDA/role context, breadcrumbs,
  notifications, and the user `DropdownMenu`.

## Icons

- Use `lucide-react` icons inside buttons (always with `aria-hidden`) and
  inside navigation. Icon-only buttons must include `aria-label` and live
  inside a `Tooltip` when collapsed.

## Accessibility

- Every Dialog/Sheet/AlertDialog has an accessible title; supply `description`
  when present.
- Icon-only buttons require `aria-label`. Use `aria-current="page"` for
  active links.
- All form inputs are paired with `FieldLabel` (`htmlFor` → input `id`).
