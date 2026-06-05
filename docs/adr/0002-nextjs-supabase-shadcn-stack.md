# Use Next.js, Supabase, and shadcn/ui

## Status

Accepted

## Context

The platform is an authenticated health-finance workflow application for MDA data entry, reviewer/admin queues, reference-data management, dashboards, imports, exports, notifications, and audit history.

Most user-facing screens are behind authentication and do not require public SEO. However, v1 also includes trusted backend work: Resend email delivery, PDF/XLSX export generation, admin imports, storage signing, audit-sensitive workflow actions, and any service-role Supabase operations.

A Vite SPA would keep the frontend simple, but it would require a separate backend surface for those trusted operations. Next.js gives the project a single deployable application with React UI, authenticated routing, route handlers, server actions where useful, and server-only environment variables.

Supabase remains the database and auth platform. Postgres Row Level Security is still the primary data-access boundary, and privileged server code must never bypass domain authorization checks just because it has service-role access.

## Decision

We will scaffold the web platform with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, lucide icons, Supabase SSR/browser clients, and server-side route handlers for trusted backend workflows.

Normal user-facing screens may use client components where they improve form/table interactivity. Privileged workflows such as Resend emails, exports, imports, and service-role operations will run only on the server side.

## Consequences

- The project has one primary web application instead of a separate SPA plus backend service.
- Resend email, export generation, imports, and trusted Supabase operations can live close to the product workflows that trigger them.
- Authenticated forms, tables, dashboards, and admin screens can still be client-rich where useful.
- The app has more framework surface area than Vite, so we should keep routing, server actions, and route handlers boring and explicit.
- If future workloads outgrow Next.js route handlers, specific jobs can move to Supabase Edge Functions or a worker without changing the user-facing app architecture.
