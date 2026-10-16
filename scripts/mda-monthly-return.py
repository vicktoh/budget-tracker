#!/usr/bin/env python3
"""Turn one MDA's monthly budget-tracking return into a loader call.

Usage:
  python3 scripts/mda-monthly-return.py <return.xlsx|.xls|.ett> --quarter 3
      [--fiscal-year 2026] [--mda-code 052101000100] [--sheet NAME ...]
      [--apply] [--out FILE] [--json]

Reads an MDA's monthly expenditure return and writes a single SQL statement
calling app_private.load_mda_monthly_return
(supabase/migrations/20261016120000_mda_monthly_return_loader.sql). Run that
statement with a privileged connection: without --apply it only returns the
check report; with --apply it loads the quarter. --json prints the parsed
lines instead.

MDAs send the IBP template in several shapes, all handled here:
  - the standard template: SN, ADMIN CODE, DESCRIPTION, ECONOMIC CODE,
    APPROVED BUDGET, then one column per month (optionally with PLANNED
    TARGET, quarterly % and overall-performance columns, which are ignored);
  - several sections in one sheet (capital, overhead, receipts), each with
    its own header row;
  - a quarter-only layout (DESCRIPTION, ECONOMIC CODE, BUDGET, JULY, AUGUST,
    SEPTEMBER), with or without an ADMIN CODE column;
  - an analysis layout where the economic code sits in a column headed CODE
    and group subtotal rows (2202, 220201...) sit between the lines;
  - legacy .xls workbooks, including WPS .ett templates (needs xlrd).

Rules:
  - Only 8-digit economic codes starting 21 (personnel), 22 (overhead) or
    23 (capital) are expenditure. Revenue and receipt lines (12..., 13...),
    group subtotals, TOTAL rows and malformed codes are skipped and counted.
  - A blank cell stays blank (not reported). 0, "-" and "nil" are zero
    returns. "NOT RELEASED" is read as a zero return, with a warning.
  - Amounts may be numbers or text with thousands separators.
  - Cells holding a range formula such as =SUM(K4:K36) are subtotals, not
    spending, and are left out with a warning (xlsx only; .xls formulas
    can't be inspected and are taken at their value).
  - The MDA is the admin code's first ten digits + "00" (11-digit codes are
    zero-padded), unless --mda-code is given. Admin columns that hold
    economic codes instead are ignored.
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
MONTH_RE = re.compile(r"^\s*(" + "|".join(MONTHS) + r")")
ECON_RE = re.compile(r"^\d{8}$")
ADMIN_RE = re.compile(r"^\s*(\d{11,12})\b")
RANGE_FORMULA_RE = re.compile(r"[A-Z]+\$?\d+\s*:\s*\$?[A-Z]+\$?\d+|\b(SUM|SUBTOTAL|AVERAGE)\s*\(", re.I)
CLASS_BY_PREFIX = {"21": "personnel", "22": "overhead", "23": "capital"}
ZERO_WORDS = {"-", "–", "—", "nil", "none"}
NOT_RELEASED_RE = re.compile(r"^not\s+releas", re.I)


def text(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def amount(value):
    """(number | None, problem | None) for one cell."""
    if value is None:
        return None, None
    if isinstance(value, bool):
        return None, f"'{value}' is not a number"
    if isinstance(value, (int, float)):
        return round(float(value), 2), None
    raw = str(value).strip()
    if raw == "":
        return None, None
    if raw.lower() in ZERO_WORDS:
        return 0.0, None
    if NOT_RELEASED_RE.match(raw):
        return 0.0, f"'{raw}' read as a zero return"
    if re.fullmatch(r"[₦N]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?", raw):
        return round(float(re.sub(r"[₦N,]", "", raw)), 2), None
    return None, f"'{raw}' is not a number; left blank"


def find_columns(cells):
    """Column map for a header row, or None if the row isn't a header."""
    cols = {"months": {}}
    labels = [text(v).upper() for v in cells]
    for idx, label in enumerate(labels):
        if not label:
            continue
        match = MONTH_RE.match(label)
        if match and "BUDGET" not in label:
            cols["months"].setdefault(MONTHS.index(match.group(1)) + 1, []).append(idx)
        elif re.search(r"ECONOMIC\s*CODE", label):
            cols["econ"] = idx
        elif "ADMIN" in label:
            cols["admin"] = idx
        elif label == "CODE":
            cols.setdefault("code", idx)
        elif any(word in label for word in ("BUDGET", "APPROVED", "ESTIMATE")) or re.fullmatch(r"20\d\d", label):
            cols.setdefault("budget", idx)
        elif any(word in label for word in ("DESCRIPTION", "PROJECT", "TITLE", "DETAILS")):
            cols.setdefault("descr", idx)
    if "econ" not in cols and "code" in cols:
        cols["econ"] = cols.pop("code")
    elif "code" in cols and "admin" not in cols:
        cols["admin"] = cols.pop("code")
    if "econ" in cols and "descr" in cols and len(cols["months"]) >= 3:
        return cols
    return None


def read_sheets(path, wanted):
    """Yield (sheet name, rows) where each row is a list of (value, formula)."""
    if path.suffix.lower() in {".xls", ".ett", ".et"}:
        import xlrd  # legacy binary workbooks only

        book = xlrd.open_workbook(str(path))
        for sheet in book.sheets():
            if wanted and sheet.name not in wanted:
                continue
            rows = []
            for r in range(sheet.nrows):
                row = []
                for c in range(sheet.ncols):
                    cell = sheet.cell(r, c)
                    row.append((None if cell.ctype in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK) else cell.value, None))
                rows.append(row)
            yield sheet.name, rows
        return

    import openpyxl

    values = openpyxl.load_workbook(path, data_only=True)
    formulas = openpyxl.load_workbook(path, data_only=False)
    for name in values.sheetnames:
        if wanted and name not in wanted:
            continue
        rows = []
        for vrow, frow in zip(values[name].iter_rows(), formulas[name].iter_rows()):
            rows.append([
                (v.value, f.value if isinstance(f.value, str) and f.value.startswith("=") else None)
                for v, f in zip(vrow, frow)
            ])
        yield name, rows


def resolve_months(cols, rows, start, name, warnings):
    """Pick one column per month. A month headed twice (templates where Q3
    was typed into extra columns) uses the column holding data below."""
    resolved = {}
    for month, candidates in cols["months"].items():
        if len(candidates) == 1:
            resolved[month] = candidates[0]
            continue
        filled = []
        for idx in candidates:
            n = 0
            for row in rows[start:]:
                if find_columns([v for v, _ in row]):
                    break
                if idx < len(row) and amount(row[idx][0])[0] is not None:
                    n += 1
            filled.append((n, idx))
        best = max(filled)[1]
        if sum(1 for n, _ in filled if n) > 1:
            warnings.append(f"{name}: {MONTHS[month - 1].title()} is headed in more than one column with data; using the fuller one.")
        resolved[month] = best
    return {**cols, "months": resolved}


def parse_sheet(name, rows, warnings, skipped):
    lines, admin_codes = [], []
    cols = None
    for row_no, row in enumerate(rows, start=1):
        values = [v for v, _ in row]
        found = find_columns(values)
        if found:
            cols = resolve_months(found, rows, row_no, name, warnings)
            continue
        if cols is None:
            continue
        cell = lambda key: values[cols[key]] if key in cols and cols[key] < len(values) else None
        econ = text(cell("econ"))
        descr = re.sub(r"\s+", " ", text(cell("descr")))
        if not econ and not descr:
            continue
        if "TOTAL" in descr.upper() or "TOTAL" in econ.upper():
            continue
        if not ECON_RE.match(econ):
            if econ:
                skipped[f"code {econ} is not an 8-digit economic code (subtotal or typo)"] += 1
            continue
        budget_class = CLASS_BY_PREFIX.get(econ[:2])
        if budget_class is None:
            skipped[f"economic code {econ[:2]}... is revenue or receipts, not spending"] += 1
            continue
        admin = ADMIN_RE.match(text(cell("admin")))
        if admin:
            admin_codes.append(admin.group(1).zfill(12))

        months = [None] * 12
        where = f"{name} row {row_no} ({descr[:40]})"
        for month, idx in cols["months"].items():
            if idx >= len(row):
                continue
            raw_value, formula = row[idx]
            label = f"{MONTHS[month - 1].title()} · {where}"
            if formula:
                if RANGE_FORMULA_RE.search(formula):
                    warnings.append(f"{label}: formula {formula} = {raw_value} is a subtotal, left out.")
                    continue
                warnings.append(f"{label}: formula {formula} kept as {raw_value}.")
            value, problem = amount(raw_value)
            if problem:
                warnings.append(f"{label}: {problem}.")
            if value is not None:
                if value < 0:
                    warnings.append(f"{label}: negative amount {value:,.2f}.")
                months[month - 1] = value

        budget, problem = amount(cell("budget"))
        if problem:
            warnings.append(f"Budget · {where}: {problem}.")
        lines.append({
            "row_no": row_no,
            "budget_class": budget_class,
            "economic_code": econ,
            "descr": descr,
            "budget": budget,
            "months": months,
        })
    return lines, admin_codes


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--quarter", type=int, required=True)
    parser.add_argument("--fiscal-year", type=int, default=2026)
    parser.add_argument("--mda-code")
    parser.add_argument("--sheet", action="append", help="Only these sheets (repeatable; default: all)")
    parser.add_argument("--apply", action="store_true", help="Load the quarter (default: check only)")
    parser.add_argument("--out", type=Path, help="Write the SQL here instead of stdout")
    parser.add_argument("--json", action="store_true", help="Print the parsed lines and warnings as JSON")
    args = parser.parse_args()

    warnings, lines, admin_codes, skipped = [], [], [], Counter()
    seen_rows = 0
    for name, rows in read_sheets(args.workbook, set(args.sheet or [])):
        sheet_lines, sheet_codes = parse_sheet(name, rows, warnings, skipped)
        # Row numbers must stay unique across sheets: offset later sheets.
        for line in sheet_lines:
            line["row_no"] += seen_rows
        seen_rows += len(rows) + 1000
        lines += sheet_lines
        admin_codes += sheet_codes
    warnings += [f"Skipped {n} row(s): {why}." for why, n in skipped.items()]

    if not lines:
        sys.exit("No budget lines found: no sheet has an economic-code header with month columns.")

    mda_code = args.mda_code
    if not mda_code:
        prefixes = Counter(code[:10] for code in admin_codes)
        if len(prefixes) != 1:
            sys.exit(f"Admin codes point to {len(prefixes)} MDAs ({dict(prefixes)}); pass --mda-code.")
        mda_code = next(iter(prefixes)) + "00"

    first = args.quarter * 3 - 2
    summary = [f"{args.workbook.name}: {len(lines)} lines, MDA {mda_code}"]
    for m in range(first, first + 3):
        filled = [l["months"][m - 1] for l in lines if l["months"][m - 1] is not None]
        summary.append(f"  {MONTHS[m - 1].title()}: {len(filled)} lines filled, total {sum(filled):,.2f}")
    summary += [f"  ! {w}" for w in warnings]
    print("\n".join(summary), file=sys.stderr)

    if args.json:
        json.dump({"mda_code": mda_code, "lines": lines, "warnings": warnings}, sys.stdout, ensure_ascii=False)
        return

    def dollar(value):
        body = json.dumps(value, ensure_ascii=False)
        assert "$mr$" not in body
        return f"$mr${body}$mr$::jsonb"

    label = args.workbook.name.replace("'", "''")
    sql = (
        "select app_private.load_mda_monthly_return(\n"
        f"  '{mda_code}', {args.fiscal_year}, {args.quarter}, '{label}',\n"
        f"  {dollar(lines)},\n"
        f"  {dollar(warnings)},\n"
        f"  {'true' if args.apply else 'false'}\n"
        ") as report;\n"
    )
    if args.out:
        args.out.write_text(sql)
    else:
        sys.stdout.write(sql)


if __name__ == "__main__":
    main()
