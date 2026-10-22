// Shapes of the public BIR dataset (supabase/migrations/20261022090000_public_bir_dataset.sql).

export type EconClass = "total" | "personnel" | "overhead" | "capital" | "other";

export type FigureLens =
  | "state"
  | "revenue"
  | "mda"
  | "function"
  | "programme"
  | "phc_mda"
  | "phc_function"
  | "phc_programme"
  | "phc_economic"
  | "phc_project";

/** The three ways the public explorer can cut health spending. */
export type ExplorerLens = "mda" | "programme" | "function";

export type PublicReport = {
  id: string;
  slug: string;
  fiscal_year: number;
  quarter: number;
  full_year_only: boolean;
  title: string;
  source_url: string;
  source_note: string | null;
  storage_path: string | null;
  sha256: string | null;
  file_bytes: number | null;
  page_count: number | null;
  data_status: "download_only" | "published";
  data_note: string | null;
  published_at: string | null;
};

export type PublicFigure = {
  report_id: string;
  lens: FigureLens;
  econ_class: EconClass;
  code: string | null;
  row_key: string | null;
  name: string;
  mda_code: string | null;
  original_budget: number | null;
  revised_budget: number | null;
  quarter_actual: number | null;
  ytd_actual: number | null;
  table_number: number | null;
  page: number | null;
  note: string | null;
};

export type PublicEntity = {
  lens: string;
  code: string;
  name: string;
  short_name: string | null;
  sort_order: number | null;
};

export type PublicDataset = {
  reports: PublicReport[];
  figures: PublicFigure[];
  entities: PublicEntity[];
};
