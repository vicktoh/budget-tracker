#!/usr/bin/env python3
"""Generate supabase/seeds/009_aop_funding_2026.sql from the FY2026 resource-mapping workbooks.

Usage:
  python3 scripts/generate-aop-funding-seed.py <SMoH RESOURCE MAPPING.xlsx> <SPHCMB_2026_AOP.xlsx>

Reads the per-activity funding breakdown (government fund + up to 5
donor/implementing-partner tranches) and emits an idempotent seed that:
  1. upserts canonical funding_partners,
  2. inserts activities present in the workbooks but missing from the DB,
  3. updates budgeted_cost where the workbook disagrees with the DB,
  4. replaces all FY2026 aop_activity_funding_allocations for both MDAs.

Rules (agreed 2026-07-13):
  - "Joint Funding" and "HMoU" are canonical partners for now.
  - Tranches with a donor/IP name but no amount are stored with amount 0.
  - Leaf activities with no funding info at all get no allocation rows.
  - "Government" in a donor column annotates the government fund, not a partner.

Also writes a JSON report of skipped rows, garbage cells, and per-file stats
next to the seed (scripts/aop-funding-seed-report.json).
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

REPO = Path(__file__).resolve().parent.parent
SEED_PATH = REPO / "supabase" / "seeds" / "009_aop_funding_2026.sql"
REPORT_PATH = REPO / "scripts" / "aop-funding-seed-report.json"

LEAF_RE = re.compile(r"^\d+(\.\d+){3,}$")
NUMERIC_GARBAGE_RE = re.compile(r"^[\d,.\s]+$")

GOV_SOURCE = "kano-state-govt-budget-release"
DONOR_SOURCE = "donors-development-partners-funding"

MDAS = {
    "moh": "select id from public.mdas where name = 'Ministry of Health (HQ)'",
    "phc": "select id from public.mdas where code = '052100500100'",
}

# canonical slug -> display name
PARTNERS = {
    "acomin": "ACOMIN",
    "acephap": "ACEPHAP",
    "bmgf": "Gates Foundation (BMGF)",
    "c4sd": "C4SD",
    "chai": "CHAI",
    "chigari-foundation": "Chigari Foundation",
    "core-group": "CORE Group",
    "dph-dc": "DPH&DC",
    "dprs-smoh": "DPRS (SMoH)",
    "engenderhealth": "EngenderHealth",
    "fcdo": "FCDO",
    "gavi": "GAVI",
    "ghsc-psm": "GHSC-PSM",
    "global-fund": "Global Fund",
    "hatch-technology": "Hatch Technology",
    "hmou": "HMoU",
    "ipas": "IPAS",
    "joint-funding": "Joint Funding",
    "malaria-consortium": "Malaria Consortium",
    "mebs-global": "Mebs Global",
    "msh": "MSH",
    "msi": "MSI",
    "natview-foundation": "Natview Foundation",
    "ni": "NI",
    "nigeria-health-watch": "Nigeria Health Watch",
    "nmep": "NMEP",
    "options": "Options",
    "others-unspecified": "Others / Unspecified Partner",
    "palladium-lafiya": "Palladium (Lafiya)",
    "pathfinder": "Pathfinder International",
    "pharmaceutical-companies": "Pharmaceutical Companies",
    "ppln": "PPLN",
    "samu-lafiya": "Samu Lafiya",
    "sanhdef": "SANHDEF",
    "save-the-children": "Save the Children",
    "scidar": "SCIDaR",
    "sfh": "SFH",
    "smep": "SMEP",
    "smile-for-mothers": "Smile for Mothers",
    "sphcmb": "SPHCMB",
    "ta-connect": "TA-Connect",
    "unicef": "UNICEF",
    "wca-health": "WCA Health",
    "who": "WHO",
    "world-bank": "World Bank",
}

GOVERNMENT = "__government__"  # sentinel: annotates the gov fund, not a partner

# raw workbook spelling (lowercased) -> canonical slug
ALIASES = {
    "acomin": "acomin",
    "acephap": "acephap",
    "bmgf": "bmgf",
    "c4sd": "c4sd",
    "chai": "chai",
    "chigari foundation": "chigari-foundation",
    "coregroup": "core-group",
    "dph&dc": "dph-dc",
    "dprs smoh": "dprs-smoh",
    "engender health": "engenderhealth",
    "fcdo": "fcdo",
    "gate foundation": "bmgf",
    "gates foundation": "bmgf",
    "gates foundation (gf)": "bmgf",
    "gavi": "gavi",
    "ghsc psm": "ghsc-psm",
    "global fund": "global-fund",
    "government": GOVERNMENT,
    "hatch technology": "hatch-technology",
    "hatch technology / state govt.": "hatch-technology",
    "hmou": "hmou",
    "hmou / smep": "hmou",
    "hmou smep": "hmou",
    "ipas": "ipas",
    "joint funding": "joint-funding",
    "lafiya": "palladium-lafiya",
    "lafiya fcdo": "palladium-lafiya",
    "malaria consortium": "malaria-consortium",
    "management for science health (msh)": "msh",
    "mebs global": "mebs-global",
    "msh": "msh",
    "msi": "msi",
    "natview foundation": "natview-foundation",
    "ni": "ni",
    "nigeria health watch": "nigeria-health-watch",
    "nigerian health watch": "nigeria-health-watch",
    "nmep": "nmep",
    "options": "options",
    "others and unspecified partner": "others-unspecified",
    "palladium": "palladium-lafiya",
    "palladium intl dev. (lafiya)": "palladium-lafiya",
    "palladium intl. dev. nig (lafiya)": "palladium-lafiya",
    "pathfinder": "pathfinder",
    "pathfinder international": "pathfinder",
    "pharmaceutical companies": "pharmaceutical-companies",
    "ppln": "ppln",
    "samu lafiya": "samu-lafiya",
    "sandhef": "sanhdef",
    "sanhdef": "sanhdef",
    "save the children": "save-the-children",
    "scidar": "scidar",
    "scidar/solina": "scidar",
    "sfh": "sfh",
    "sfha360": "sfh",
    "smep": "smep",
    "smile for mothers": "smile-for-mothers",
    "sphcm": "sphcmb",
    "sphcmb": "sphcmb",
    "sphhcmb": "sphcmb",
    "sphmcmb": "sphcmb",
    "ssphcmb": "sphcmb",
    "ta = connect": "ta-connect",
    "ta-connect": "ta-connect",
    "unicef": "unicef",
    "unicef / state government": "unicef",
    "wca health": "wca-health",
    "wca heath": "wca-health",
    "wca option": "wca-health",
    "who": "who",
    "world bank": "world-bank",
    "gates foundation (gf)": "bmgf",
}


def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace("₦", "").replace(",", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def clean(v):
    if v is None:
        return None
    s = re.sub(r"\s+", " ", str(v)).strip()
    return s or None


def sql_str(v):
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def canonical(raw, warnings, code):
    if raw is None:
        return None
    if NUMERIC_GARBAGE_RE.match(raw):
        warnings.append(f"{code}: ignored numeric garbage in partner cell: {raw!r}")
        return None
    slug = ALIASES.get(raw.lower())
    if slug is None:
        raise SystemExit(f"Unmapped partner name {raw!r} on activity {code} — add it to ALIASES.")
    return slug


def read_workbook(path, sheet, code_col, first_data_row, mda_key, report):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    activities = {}  # code -> {row, desc, cost, tranches: [(no, source, donor, ip, amount, raw_d, raw_p)]}
    warnings = report["warnings"]
    for i, row in enumerate(ws.iter_rows(values_only=True), 1):
        if i < first_data_row:
            continue
        row = list(row) + [None] * 25
        code = clean(row[code_col])
        desc = clean(row[code_col + 1])
        if not code or not LEAF_RE.match(code) or not desc:
            continue
        if code in activities:
            raise SystemExit(f"Duplicate activity code {code} in {path}")
        cost = num(row[code_col + 2]) or 0.0
        gov = num(row[code_col + 3])
        tranches = []
        gov_annotation = None
        next_no = 1
        for k in range(5):
            base = code_col + 4 + k * 3
            raw_d, raw_p, amt = clean(row[base]), clean(row[base + 1]), num(row[base + 2])
            if not raw_d and not raw_p and not amt:
                continue
            donor = canonical(raw_d, warnings, code)
            ip = canonical(raw_p, warnings, code)
            if donor == GOVERNMENT or ip == GOVERNMENT:
                # annotates the government fund; not a partner tranche
                gov_annotation = raw_d if donor == GOVERNMENT else raw_p
                donor = None if donor == GOVERNMENT else donor
                ip = None if ip == GOVERNMENT else ip
                if not donor and not ip and not amt:
                    continue
            tranches.append((next_no, DONOR_SOURCE, donor, ip, amt or 0.0, raw_d, raw_p))
            next_no += 1
        allocations = []
        if gov:
            allocations.append((0, GOV_SOURCE, None, None, gov, gov_annotation, None))
        allocations.extend(tranches)
        funded = sum(a[4] for a in allocations)
        if funded - cost > 1:
            warnings.append(
                f"{code}: allocations ({funded:,.2f}) exceed cost ({cost:,.2f}) — kept as-is"
            )
        entry = {"row": i, "desc": desc, "cost": cost, "allocations": allocations}
        if not allocations:
            report["skipped_no_funding"][mda_key].append(code)
        activities[code] = entry
    wb.close()
    return activities


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    smoh_path, sphcmb_path = sys.argv[1], sys.argv[2]

    report = {
        "warnings": [],
        "skipped_no_funding": {"moh": [], "phc": []},
        "stats": {},
    }
    data = {
        "moh": read_workbook(smoh_path, "Sheet1", 0, 2, "moh", report),
        "phc": read_workbook(sphcmb_path, "SPHCMB", 0, 4, "phc", report),
    }

    used_slugs = set()
    for acts in data.values():
        for entry in acts.values():
            for (_, _, donor, ip, _, _, _) in entry["allocations"]:
                if donor:
                    used_slugs.add(donor)
                if ip:
                    used_slugs.add(ip)
    unused = sorted(set(PARTNERS) - used_slugs)
    if unused:
        report["warnings"].append(f"canonical partners defined but never used: {unused}")

    out = []
    w = out.append
    w("-- Generated by scripts/generate-aop-funding-seed.py from the FY2026")
    w("-- resource-mapping workbooks (SMoH RESOURCE MAPPING.xlsx, SPHCMB_2026_AOP.xlsx).")
    w("-- Do not edit by hand. Idempotent: replaces FY2026 allocations for both MDAs.")
    w("begin;")
    w("")
    w("do $$")
    w("begin")
    for key, sel in MDAS.items():
        w(f"  if not exists ({sel}) then")
        w(f"    raise exception 'MDA for {key} missing — apply reference seeds first.';")
        w("  end if;")
    w("end $$;")
    w("")

    w("insert into public.funding_partners (slug, name)")
    w("values")
    rows = [f"  ({sql_str(slug)}, {sql_str(PARTNERS[slug])})" for slug in sorted(used_slugs)]
    w(",\n".join(rows))
    w("on conflict (slug) do update")
    w("set name = excluded.name, active = true, updated_at = now();")
    w("")

    for key, sel in MDAS.items():
        acts = data[key]
        w(f"-- ===== {key.upper()} =====")

        # activities in the workbook but not yet in the DB
        w("insert into public.aop_activities (fiscal_year, activity_code, description, mda_id, budgeted_cost, source_row_number)")
        w("select 2026, v.code, v.description, ({sel}), v.cost, v.row_no".format(sel=sel))
        w("from (values")
        vals = [
            f"  ({sql_str(code)}, {sql_str(e['desc'])}, {e['cost']:.2f}::numeric, {e['row']})"
            for code, e in sorted(acts.items())
        ]
        w(",\n".join(vals))
        w(") as v(code, description, cost, row_no)")
        w(f"where not exists (select 1 from public.aop_activities a where a.fiscal_year = 2026 and a.mda_id = ({sel}) and a.activity_code = v.code);")
        w("")

        # cost updates where the workbook disagrees
        w("update public.aop_activities a")
        w("set budgeted_cost = v.cost, updated_at = now()")
        w("from (values")
        vals = [f"  ({sql_str(code)}, {e['cost']:.2f}::numeric)" for code, e in sorted(acts.items())]
        w(",\n".join(vals))
        w(") as v(code, cost)")
        w(f"where a.fiscal_year = 2026 and a.mda_id = ({sel}) and a.activity_code = v.code")
        w("  and a.budgeted_cost is distinct from v.cost;")
        w("")

        # replace allocations
        w("delete from public.aop_activity_funding_allocations")
        w("where aop_activity_id in (")
        w(f"  select id from public.aop_activities where fiscal_year = 2026 and mda_id = ({sel})")
        w(");")
        w("")
        alloc_rows = []
        for code, e in sorted(acts.items()):
            for (no, source, donor, ip, amount, raw_d, raw_p) in e["allocations"]:
                alloc_rows.append(
                    f"  ({sql_str(code)}, {no}::smallint, {sql_str(source)}, "
                    f"{sql_str(donor)}, {sql_str(ip)}, {amount:.2f}::numeric, "
                    f"{sql_str(raw_d)}, {sql_str(raw_p)})"
                )
        w("insert into public.aop_activity_funding_allocations")
        w("  (aop_activity_id, tranche_no, funding_source_id, donor_partner_id, implementing_partner_id, amount, source_donor_name, source_partner_name)")
        w("select a.id, v.tranche_no, fs.id, dp.id, ip.id, v.amount, v.source_donor_name, v.source_partner_name")
        w("from (values")
        w(",\n".join(alloc_rows))
        w(") as v(code, tranche_no, source_slug, donor_slug, ip_slug, amount, source_donor_name, source_partner_name)")
        w(f"join public.aop_activities a on a.fiscal_year = 2026 and a.mda_id = ({sel}) and a.activity_code = v.code")
        w("join public.funding_sources fs on fs.slug = v.source_slug")
        w("left join public.funding_partners dp on dp.slug = v.donor_slug")
        w("left join public.funding_partners ip on ip.slug = v.ip_slug;")
        w("")

        report["stats"][key] = {
            "leaf_activities": len(acts),
            "with_allocations": sum(1 for e in acts.values() if e["allocations"]),
            "allocation_rows": sum(len(e["allocations"]) for e in acts.values()),
            "zero_amount_rows": sum(
                1 for e in acts.values() for a in e["allocations"] if a[4] == 0
            ),
            "total_cost": round(sum(e["cost"] for e in acts.values()), 2),
            "total_allocated": round(
                sum(a[4] for e in acts.values() for a in e["allocations"]), 2
            ),
        }

    w("commit;")
    SEED_PATH.write_text("\n".join(out) + "\n")
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n")
    print(f"wrote {SEED_PATH} ({SEED_PATH.stat().st_size:,} bytes)")
    print(f"wrote {REPORT_PATH}")
    for key, s in report["stats"].items():
        print(f"{key}: {s}")
    print(f"warnings: {len(report['warnings'])}")


if __name__ == "__main__":
    main()
