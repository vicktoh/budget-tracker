/**
 * Hand-authored Supabase `Database` type for the Kano Health Finance Tracker.
 *
 * Source of truth: `supabase/migrations/202605290001_initial_schema.sql`.
 *
 * This is intentionally narrow: it covers tables and views the application
 * currently reads or writes. When `supabase gen types` becomes available in
 * the project's CI, replace this file with the generated output. Keeping the
 * shape hand-written for now lets typed access work before a project URL is
 * connected to the typegen tool.
 */

export type AppRoleSlug = "admin" | "reviewer" | "mda_user" | "facility_user";
export type MembershipRoleSlug = "submitter" | "reviewer";
export type EntryStatusSlug = "pending" | "approved" | "processed" | "rejected";
export type EntryType = "funding_entry" | "expenditure_entry";

type ISODate = string;
type ISOTimestamp = string;

type Numeric = number;

type BaseRow<Insert, Update = Insert> = {
  Row: Insert & {
    created_at: ISOTimestamp;
    updated_at: ISOTimestamp;
  };
  Insert: Insert & { created_at?: ISOTimestamp; updated_at?: ISOTimestamp };
  Update: Partial<Update> & { id?: string };
};

type ReferenceRow = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
};

type ReferenceTable = BaseRow<ReferenceRow>;

export type Database = {
  public: {
    Tables: {
      profiles: BaseRow<{
        id: string;
        full_name: string;
        role: AppRoleSlug;
      }>;
      mda_types: ReferenceTable;
      mdas: BaseRow<{
        id: string;
        code: string;
        name: string;
        mda_type_id: string | null;
        abbreviation: string | null;
        active: boolean;
      }>;
      user_mda_memberships: {
        Row: {
          id: string;
          user_id: string;
          mda_id: string;
          membership_role: MembershipRoleSlug;
          created_at: ISOTimestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          mda_id: string;
          membership_role: MembershipRoleSlug;
          created_at?: ISOTimestamp;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          mda_id: string;
          membership_role: MembershipRoleSlug;
        }>;
      };
      user_facility_assignments: {
        Row: {
          id: string;
          user_id: string;
          facility_id: string;
          mda_id: string;
          created_at: ISOTimestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          facility_id: string;
          mda_id: string;
          created_at?: ISOTimestamp;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          facility_id: string;
          mda_id: string;
        }>;
      };
      programme_areas: ReferenceTable;
      funding_sources: ReferenceTable;
      expenditure_categories: ReferenceTable;
      expenditure_items: BaseRow<{
        id: string;
        expenditure_category_id: string | null;
        slug: string;
        name: string;
        active: boolean;
      }>;
      payment_methods: ReferenceTable;
      entry_statuses: BaseRow<{
        slug: EntryStatusSlug;
        name: string;
        description: string;
        active: boolean;
      }>;
      lgas: BaseRow<{ id: string; name: string; active: boolean }>;
      facilities: BaseRow<{
        id: string;
        lga_id: string;
        name: string;
        facility_type: string;
        active: boolean;
      }>;
      approved_budgets: BaseRow<{
        id: string;
        fiscal_year: number;
        mda_id: string;
        personnel_amount: Numeric;
        other_recurrent_amount: Numeric;
        total_recurrent_amount: Numeric;
        capital_amount: Numeric;
        total_budget_amount: Numeric;
        source_label: string | null;
      }>;
      aop_activities: BaseRow<{
        id: string;
        fiscal_year: number;
        activity_code: string;
        description: string;
        mda_id: string;
        budgeted_cost: Numeric;
        source_row_number: number | null;
        active: boolean;
      }>;
      funding_entries: {
        Row: {
          id: string;
          public_id: string | null;
          transaction_date: ISODate;
          fiscal_year: number;
          quarter: number;
          mda_id: string;
          funding_source_id: string;
          programme_area_id: string;
          amount: Numeric;
          reference_no: string;
          remarks: string | null;
          status: EntryStatusSlug;
          entered_by: string;
          approved_by: string | null;
          approved_at: ISOTimestamp | null;
          created_at: ISOTimestamp;
          updated_at: ISOTimestamp;
        };
        Insert: {
          id?: string;
          public_id?: string | null;
          transaction_date: ISODate;
          mda_id: string;
          funding_source_id: string;
          programme_area_id: string;
          amount: Numeric;
          reference_no: string;
          remarks?: string | null;
          status?: EntryStatusSlug;
          entered_by: string;
          approved_by?: string | null;
          approved_at?: ISOTimestamp | null;
          created_at?: ISOTimestamp;
          updated_at?: ISOTimestamp;
        };
        Update: Partial<{
          transaction_date: ISODate;
          mda_id: string;
          funding_source_id: string;
          programme_area_id: string;
          amount: Numeric;
          reference_no: string;
          remarks: string | null;
          status: EntryStatusSlug;
          approved_by: string | null;
          approved_at: ISOTimestamp | null;
        }>;
      };
      expenditure_entries: {
        Row: {
          id: string;
          public_id: string | null;
          transaction_date: ISODate;
          fiscal_year: number;
          quarter: number;
          mda_id: string;
          expenditure_category_id: string;
          programme_area_id: string;
          aop_activity_id: string | null;
          expenditure_item_id: string | null;
          is_phc: boolean;
          lga_id: string | null;
          facility_id: string | null;
          amount: Numeric;
          voucher_ref_no: string;
          payment_method_id: string;
          remarks: string | null;
          status: EntryStatusSlug;
          entered_by: string;
          approved_by: string | null;
          approved_at: ISOTimestamp | null;
          created_at: ISOTimestamp;
          updated_at: ISOTimestamp;
        };
        Insert: {
          id?: string;
          public_id?: string | null;
          transaction_date: ISODate;
          mda_id: string;
          expenditure_category_id: string;
          programme_area_id: string;
          aop_activity_id?: string | null;
          expenditure_item_id?: string | null;
          is_phc?: boolean;
          lga_id?: string | null;
          facility_id?: string | null;
          amount: Numeric;
          voucher_ref_no: string;
          payment_method_id: string;
          remarks?: string | null;
          status?: EntryStatusSlug;
          entered_by: string;
          approved_by?: string | null;
          approved_at?: ISOTimestamp | null;
          created_at?: ISOTimestamp;
          updated_at?: ISOTimestamp;
        };
        Update: Partial<{
          transaction_date: ISODate;
          mda_id: string;
          expenditure_category_id: string;
          programme_area_id: string;
          aop_activity_id: string | null;
          expenditure_item_id: string | null;
          is_phc: boolean;
          lga_id: string | null;
          facility_id: string | null;
          amount: Numeric;
          voucher_ref_no: string;
          payment_method_id: string;
          remarks: string | null;
          status: EntryStatusSlug;
          approved_by: string | null;
          approved_at: ISOTimestamp | null;
        }>;
      };
      entry_audit_events: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string | null;
          entity_key: string;
          event_type: string;
          old_values: Record<string, unknown> | null;
          new_values: Record<string, unknown> | null;
          reason: string | null;
          actor_id: string | null;
          created_at: ISOTimestamp;
        };
        Insert: never;
        Update: never;
      };
      entry_comments: {
        Row: {
          id: string;
          entry_type: EntryType;
          entry_id: string;
          body: string;
          comment_type:
            | "general"
            | "clarification"
            | "rejection_reason"
            | "approval_note";
          author_id: string;
          created_at: ISOTimestamp;
        };
        Insert: {
          id?: string;
          entry_type: EntryType;
          entry_id: string;
          body: string;
          comment_type?:
            | "general"
            | "clarification"
            | "rejection_reason"
            | "approval_note";
          author_id: string;
          created_at?: ISOTimestamp;
        };
        Update: Partial<{ body: string }>;
      };
      entry_attachments: {
        Row: {
          id: string;
          entry_type: EntryType;
          entry_id: string;
          storage_bucket: string;
          storage_path: string;
          file_name: string;
          content_type: string | null;
          file_size_bytes: number | null;
          uploaded_by: string;
          created_at: ISOTimestamp;
        };
        Insert: {
          id?: string;
          entry_type: EntryType;
          entry_id: string;
          storage_bucket?: string;
          storage_path: string;
          file_name: string;
          content_type?: string | null;
          file_size_bytes?: number | null;
          uploaded_by: string;
          created_at?: ISOTimestamp;
        };
        Update: never;
      };
      admin_import_batches: {
        Row: {
          id: string;
          import_type:
            | "reference_data"
            | "approved_budget"
            | "aop_activities"
            | "historical_funding"
            | "historical_expenditure";
          source_file_name: string;
          storage_path: string | null;
          status: "pending" | "validated" | "imported" | "failed";
          summary: Record<string, unknown>;
          created_by: string;
          created_at: ISOTimestamp;
          completed_at: ISOTimestamp | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["admin_import_batches"]["Row"],
          "id" | "created_at" | "completed_at" | "summary" | "status"
        > & {
          id?: string;
          summary?: Record<string, unknown>;
          status?: "pending" | "validated" | "imported" | "failed";
          created_at?: ISOTimestamp;
          completed_at?: ISOTimestamp | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["admin_import_batches"]["Row"]
        >;
      };
      admin_import_errors: {
        Row: {
          id: string;
          batch_id: string;
          row_number: number | null;
          field_name: string | null;
          message: string;
          raw_row: Record<string, unknown> | null;
          created_at: ISOTimestamp;
        };
        Insert: {
          id?: string;
          batch_id: string;
          row_number?: number | null;
          field_name?: string | null;
          message: string;
          raw_row?: Record<string, unknown> | null;
          created_at?: ISOTimestamp;
        };
        Update: never;
      };
      submission_windows: BaseRow<{
        id: string;
        name: string;
        fiscal_year: number | null;
        start_date: ISODate | null;
        end_date: ISODate | null;
        status: "open" | "closed";
        applies_to_mda_id: string | null;
        created_by: string;
      }>;
      entry_data_quality_warnings: {
        Row: {
          id: string;
          entry_type: EntryType;
          entry_id: string;
          warning_code: string;
          message: string;
          severity: "info" | "warning" | "high";
          resolved_at: ISOTimestamp | null;
          resolved_by: string | null;
          created_at: ISOTimestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["entry_data_quality_warnings"]["Row"],
          "id" | "created_at" | "resolved_at" | "resolved_by" | "severity"
        > & {
          id?: string;
          severity?: "info" | "warning" | "high";
          resolved_at?: ISOTimestamp | null;
          resolved_by?: string | null;
          created_at?: ISOTimestamp;
        };
        Update: Partial<{
          resolved_at: ISOTimestamp | null;
          resolved_by: string | null;
          message: string;
          severity: "info" | "warning" | "high";
        }>;
      };
      reference_value_requests: {
        Row: {
          id: string;
          reference_type:
            | "mda"
            | "mda_type"
            | "programme_area"
            | "funding_source"
            | "expenditure_category"
            | "expenditure_item"
            | "facility"
            | "payment_method"
            | "lga";
          requested_label: string;
          description: string | null;
          related_mda_id: string | null;
          related_lga_id: string | null;
          related_category_id: string | null;
          status: "pending" | "approved" | "rejected";
          resolved_reference_id: string | null;
          requested_by: string;
          reviewed_by: string | null;
          review_comment: string | null;
          created_at: ISOTimestamp;
          reviewed_at: ISOTimestamp | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["reference_value_requests"]["Row"],
          "id" | "status" | "created_at" | "reviewed_at" | "reviewed_by" | "resolved_reference_id" | "review_comment"
        > & {
          id?: string;
          status?: "pending" | "approved" | "rejected";
          created_at?: ISOTimestamp;
          reviewed_at?: ISOTimestamp | null;
          reviewed_by?: string | null;
          resolved_reference_id?: string | null;
          review_comment?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["reference_value_requests"]["Row"]
        >;
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          notification_type: string;
          title: string;
          body: string;
          entity_type: string | null;
          entity_id: string | null;
          read_at: ISOTimestamp | null;
          created_at: ISOTimestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["notifications"]["Row"],
          "id" | "created_at" | "read_at"
        > & {
          id?: string;
          read_at?: ISOTimestamp | null;
          created_at?: ISOTimestamp;
        };
        Update: Partial<{ read_at: ISOTimestamp | null }>;
      };
      email_delivery_events: {
        Row: {
          id: string;
          recipient_id: string | null;
          recipient_email: string;
          template_key: string;
          entity_type: string | null;
          entity_id: string | null;
          payload: Record<string, unknown>;
          provider: string;
          provider_message_id: string | null;
          status: "queued" | "sent" | "delivered" | "failed";
          error_message: string | null;
          created_at: ISOTimestamp;
          sent_at: ISOTimestamp | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["email_delivery_events"]["Row"],
          "id" | "created_at" | "sent_at" | "provider" | "payload" | "status"
        > & {
          id?: string;
          payload?: Record<string, unknown>;
          provider?: string;
          status?: "queued" | "sent" | "delivered" | "failed";
          created_at?: ISOTimestamp;
          sent_at?: ISOTimestamp | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["email_delivery_events"]["Row"]
        >;
      };
      export_jobs: {
        Row: {
          id: string;
          export_type: "csv" | "xlsx" | "pdf";
          subject: string;
          filters: Record<string, unknown>;
          storage_bucket: string | null;
          storage_path: string | null;
          status: "queued" | "processing" | "completed" | "failed";
          error_message: string | null;
          created_by: string;
          created_at: ISOTimestamp;
          completed_at: ISOTimestamp | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["export_jobs"]["Row"],
          "id" | "created_at" | "completed_at" | "status" | "filters"
        > & {
          id?: string;
          status?: "queued" | "processing" | "completed" | "failed";
          filters?: Record<string, unknown>;
          created_at?: ISOTimestamp;
          completed_at?: ISOTimestamp | null;
        };
        Update: Partial<Database["public"]["Tables"]["export_jobs"]["Row"]>;
      };
    };
    Views: {
      mda_budget_vs_actual: {
        Row: {
          fiscal_year: number;
          mda_id: string;
          mda_name: string;
          total_budget_amount: Numeric;
          total_funding_amount: Numeric;
          total_expenditure_amount: Numeric;
          budget_balance_amount: Numeric;
          budget_used_ratio: Numeric | null;
        };
      };
      funding_by_source: {
        Row: {
          fiscal_year: number;
          quarter: number;
          mda_id: string;
          mda_name: string;
          funding_source_id: string;
          funding_source_name: string;
          total_amount: Numeric;
          entry_count: number;
        };
      };
      expenditure_by_category: {
        Row: {
          fiscal_year: number;
          quarter: number;
          mda_id: string;
          mda_name: string;
          expenditure_category_id: string;
          expenditure_category_name: string;
          total_amount: Numeric;
          entry_count: number;
        };
      };
      programme_area_summary: {
        Row: {
          programme_area_id: string;
          programme_area_name: string;
          fiscal_year: number | null;
          mda_id: string | null;
          total_funding_amount: Numeric;
          total_expenditure_amount: Numeric;
        };
      };
      phc_lga_expenditure_summary: {
        Row: {
          fiscal_year: number;
          lga_id: string;
          lga_name: string;
          total_expenditure_amount: Numeric;
          entry_count: number;
        };
      };
      phc_facility_expenditure_summary: {
        Row: {
          fiscal_year: number;
          lga_id: string;
          lga_name: string;
          facility_id: string;
          facility_name: string;
          total_expenditure_amount: Numeric;
          entry_count: number;
        };
      };
      aop_planned_vs_actual: {
        Row: {
          fiscal_year: number;
          mda_id: string;
          mda_name: string;
          aop_activity_id: string;
          activity_code: string;
          description: string;
          budgeted_cost: Numeric;
          linked_expenditure_amount: Numeric;
          remaining_amount: Numeric;
        };
      };
      unlinked_expenditure: {
        Row: {
          fiscal_year: number;
          mda_id: string;
          mda_name: string;
          programme_area_id: string;
          programme_area_name: string;
          expenditure_category_id: string;
          expenditure_category_name: string;
          total_amount: Numeric;
          entry_count: number;
        };
      };
    };
    Functions: {
      review_entry: {
        Args: {
          p_entry_type: EntryType;
          p_entry_id: string;
          p_action: "approve" | "reject" | "process";
          p_reason?: string | null;
          p_comment?: string | null;
        };
        Returns: void;
      };
      resubmit_entry: {
        Args: {
          p_entry_type: EntryType;
          p_entry_id: string;
        };
        Returns: void;
      };
      update_reviewed_funding_entry: {
        Args: {
          p_id: string;
          p_reason: string;
          p_transaction_date: ISODate;
          p_mda_id: string;
          p_programme_area_id: string;
          p_funding_source_id: string;
          p_amount: Numeric;
          p_reference_no: string;
          p_remarks: string | null;
        };
        Returns: void;
      };
      update_reviewed_expenditure_entry: {
        Args: {
          p_id: string;
          p_reason: string;
          p_transaction_date: ISODate;
          p_mda_id: string;
          p_programme_area_id: string;
          p_expenditure_category_id: string;
          p_expenditure_item_id: string | null;
          p_aop_activity_id: string | null;
          p_is_phc: boolean;
          p_lga_id: string | null;
          p_facility_id: string | null;
          p_amount: Numeric;
          p_voucher_ref_no: string;
          p_payment_method_id: string;
          p_remarks: string | null;
        };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
};

export type Tables<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Row"];

export type TableInsert<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Insert"];

export type TableUpdate<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Update"];

export type Views<ViewName extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][ViewName]["Row"];
