# Design System: Kano Health Finance Tracker
**Project ID:** `budget-tracker` local product design system

## 1. Visual Theme & Atmosphere

The Kano Health Finance Tracker should feel like a calm civic operations dashboard: trustworthy, restrained, accountable, and built for repeated finance work. The interface should be Kano-native through health-sector green and warm earth-brown accents, but not so heavily branded that the system cannot later be rethemed for another state or a more general public finance deployment.

The dominant mood is clear administrative utility rather than marketing polish. Screens should prioritize legibility, traceability, and fast scanning across forms, tables, review queues, dashboards, imports, exports, and audit history. The app should feel official through structure, labels, status clarity, and consistent interaction patterns, not through decorative seals, banners, or ceremonial visuals.

Use a light-first visual system. The product has dense tables, long forms, financial amounts, audit records, and report-like exports, so light surfaces should remain the default. Dark mode can be added later through semantic tokens, but v1 should be optimized for daylight readability, printing, and familiarity for finance and public-sector users.

## 2. Color Palette & Roles

- **Civic Canvas (#F8FAF7):** The warm off-white page background. It prevents the app from feeling stark while keeping tables and forms readable.
- **Clean Ledger Surface (#FFFFFF):** The primary surface for cards, tables, form sections, dialogs, and sheets.
- **Soft Boundary Mist (#D9E2DB):** The default border color for cards, inputs, table dividers, filters, and section boundaries.
- **Primary Ink (#1F2933):** The main text color for page titles, table values, form labels, and navigation.
- **Muted Administrative Slate (#64706A):** Secondary text for descriptions, metadata, helper text, timestamps, and low-priority labels.
- **Kano Health Green (#167A4A):** The primary action and identity color. Use for main buttons, active navigation, selected states, approved status, and high-confidence positive emphasis.
- **Deep Governance Green (#0F5132):** A darker green for hover states, strong headings in data-heavy contexts, and high-contrast accents on light surfaces.
- **Soft Health Mint (#E7F4EC):** A pale green background for selected rows, approved badges, success alerts, and calm positive feedback.
- **Grounded Earth Brown (#8A5A2B):** A restrained secondary accent for budget, planning, AOP, and institutional context.
- **Light Clay Wash (#F3E9DC):** A pale earth-tone background for budget/planning badges, neutral callouts, and low-intensity contextual panels.
- **Review Amber (#B7791F):** Used for pending status, warnings, import validation attention, and data quality warnings that are important but not blocking.
- **Warning Sand (#FFF7E6):** The background for pending badges and non-blocking warning panels.
- **Rejection Red (#B42318):** Reserved for rejected entries, destructive actions, validation errors, and failed imports.
- **Soft Rejection Rose (#FDECEC):** The background for rejected badges, error summaries, and destructive confirmation areas.
- **Processed Teal (#0F766E):** Used for processed/reconciled states, completed workflow steps, and operational completion indicators distinct from approval.
- **Soft Processed Aqua (#E6F4F1):** The background for processed badges and completed-state panels.

Status color rules should stay conservative. `pending` is amber, `approved` is health green, `processed` is teal, and `rejected` is red. Data Quality Warnings use amber outlines or soft amber backgrounds rather than red because they are non-blocking warnings.

## 3. Typography Rules

Use a highly readable modern sans-serif such as Inter or Geist Sans. The typography should feel like a clear administrative tool, not a formal printed document and not a dramatic SaaS landing page.

Page titles should use a strong but restrained bold weight. Section titles, table headers, card titles, and navigation labels should use semibold or medium weights. Body text, form input text, helper text, and table values should stay regular and highly legible. Dashboard metric values may be larger and semibold, but should not become oversized display typography.

Avoid decorative fonts, compressed letter spacing, and dramatic type scale jumps. Letter spacing should remain normal. The app should support long MDA names, fiscal labels, voucher references, public entry IDs, and Nigerian naira values without clipping or visual strain.

## 4. Component Stylings

* **Buttons:** Buttons should have subtly rounded corners, approximately 6px to 8px, with clear hierarchy. Primary buttons use Kano Health Green (#167A4A) with white text and Deep Governance Green (#0F5132) hover. Secondary buttons use white or Civic Canvas (#F8FAF7) with Soft Boundary Mist (#D9E2DB) borders. Destructive buttons use Rejection Red (#B42318) only when the action is genuinely destructive or rejecting.
* **Cards/Containers:** Cards are functional panels, not decorative floating tiles. Use Clean Ledger Surface (#FFFFFF), Soft Boundary Mist (#D9E2DB) borders, subtle rounding, and little to no shadow. Main page sections can be unframed or lightly bordered; avoid putting cards inside cards.
* **Inputs/Forms:** Inputs should be white with soft borders, clear labels, helper text, and visible validation states. Error states use Rejection Red (#B42318), while warnings use Review Amber (#B7791F). Long forms should be split into named sections with calm spacing and progressive reveal where later fields depend on earlier choices.
* **Tables:** Tables should be compact and table-forward with clean row dividers, sticky headers where useful, row hover states, sortable columns, and filter controls close to the data. Avoid heavy grid boxes. Public Entry IDs, MDA names, status badges, dates, and money values should be easy to scan.
* **Status Badges:** Badges should be small, readable, and semantic. Pending badges use Review Amber (#B7791F) on Warning Sand (#FFF7E6). Approved badges use Kano Health Green (#167A4A) on Soft Health Mint (#E7F4EC). Processed badges use Processed Teal (#0F766E) on Soft Processed Aqua (#E6F4F1). Rejected badges use Rejection Red (#B42318) on Soft Rejection Rose (#FDECEC).
* **Navigation:** Use a collapsible sidebar with a slim top header. The sidebar should be role-aware but visually stable across MDA users, Reviewers, and Admins. Active navigation uses Kano Health Green (#167A4A) with a soft mint background. The top header carries fiscal year, current role/MDA context, notifications, and the user menu.
* **Overlays:** Dialogs, sheets, popovers, and dropdowns may use soft diffused shadows to signal layering. These shadows should be quiet and functional rather than dramatic.
* **Charts:** Charts should be restrained operational analytics. Use green, teal, brown, amber, and slate tones. Avoid rainbow dashboards. Every chart should support decision-making and provide a table or drill-down path nearby.

## 5. Layout Principles

The layout should be compact by default and guided at the point of action. Dashboards, review queues, reference data, import validation, exports, and audit trails should support dense scanning. Funding Entry and Expenditure Entry forms should feel calmer through sectioning, helper text, and predictable field grouping.

Use a shared app shell with a collapsible sidebar and a slim contextual header. The main content area should begin with the active workflow, not a hero section. Page headers should include title, short description, primary action, and relevant filters where appropriate.

Forms should use sectioned single pages rather than multi-step wizards for v1. Recommended sections include Entry Details, Classification, Financial Traceability, PHC Details, AOP Linkage, Attachments, and Review Notes where relevant. Progressive reveal should be used for PHC LGA/facility fields and AOP activity filtering.

Tables and dashboards should keep filters prominent and consistent. Use summary metric cards sparingly for totals, pending review, budget utilization, warnings, and export readiness. Detailed tables remain first-class because traceability matters as much as visualization.

Spacing should be practical and consistent: compact table rows, comfortable form sections, and restrained page margins. Avoid oversized empty states, decorative backgrounds, and marketing-style composition. The app should feel like a durable daily operations tool for official health finance reporting.
