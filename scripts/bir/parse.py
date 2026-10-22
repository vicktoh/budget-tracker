"""Parse the health-sector tables out of a Kano State BIR/BPR PDF.

Usage:
  python3 -I scripts/bir/parse.py tmp/bir-pdfs/manifest.json tmp/bir-pdfs tmp/bir-parsed [slug ...]

For each report it runs `pdftotext -layout`, finds the numbered tables, keeps
the health rows (admin codes 0521*, function 707*, programme 04*, the PHC
section) plus the state headline rows, and writes <out>/<slug>.json.

Every row is checked against the arithmetic the BIR itself prints (% column
and balance column); every table set is cross-checked (MDA total = personnel +
overhead + capital + other, sector total = sum of its MDAs, ...). Failures are
listed in the JSON under "checks" and in the console summary; a report is only
loadable when it has no failing checks.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

CLASSES = ("total", "personnel", "overhead", "capital", "other")

TABLE_KINDS = [
    (re.compile(r"^Budget (Implementation|Summary)", re.I), "state_summary", None),
    (re.compile(r"^Total Revenue by Administrative", re.I), "revenue_admin", "total"),
    (re.compile(r"^(Total|Personnel|Overhead|Capital|Other) Expenditure by Administrative", re.I), "exp_admin", 1),
    (re.compile(r"^(Total|Personnel|Overhead|Capital|Other) Expenditure by Function", re.I), "exp_function", 1),
    (re.compile(r"^(Total|Personnel|Overhead|Capital|Other) Expenditure by Programme", re.I), "exp_programme", 1),
    (re.compile(r"^Primary Health ?care Expenditure by Administrative", re.I), "phc_admin", "total"),
    (re.compile(r"^Primary Health ?care Expenditure by Function", re.I), "phc_function", "total"),
    (re.compile(r"^Primary Health ?care Expenditure by Programme", re.I), "phc_programme", "total"),
    (re.compile(r"^Primary Health ?care Expenditure by Economic", re.I), "phc_economic", "total"),
    (re.compile(r"^Primary Health ?care Capital Expenditure by Project", re.I), "phc_projects", "capital"),
]

HEALTH_PREFIX = {
    "revenue_admin": "0521",
    "exp_admin": "0521",
    "exp_function": "707",
    "exp_programme": "04",
}

# State headline rows we keep from Table 1 (label -> key).
SUMMARY_ROWS = [
    (re.compile(r"^Opening Balance", re.I), "opening_balance"),
    (re.compile(r"^Recurrent Revenue", re.I), "recurrent_revenue"),
    (re.compile(r"^11\s*-", re.I), "faac"),
    (re.compile(r"^12\s*-", re.I), "independent_revenue"),
    (re.compile(r"^13\s*-", re.I), "aid_and_grants"),
    (re.compile(r"^14\s*-", re.I), "cdf_receipts"),
    (re.compile(r"^Recurrent Expenditure", re.I), "recurrent_expenditure"),
    (re.compile(r"^21\s*-", re.I), "personnel"),
    (re.compile(r"^22\s*-", re.I), "other_recurrent"),
    (re.compile(r"^2202\s*-", re.I), "overhead"),
    (re.compile(r"^Capital Expenditure", re.I), "capital_expenditure"),
    (re.compile(r"^Total Revenue", re.I), "total_revenue"),
    (re.compile(r"^Total Expenditure", re.I), "total_expenditure"),
]

MONEY = r"\(?-?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d+\)?|\(?-?\d{1,3}(?:,\d{3})+\)?"
TOKEN_RE = re.compile(
    rf"(?P<pct>-?[\d,]*\.?\d+\s?%|#DIV/0!|#VALUE!)|(?P<money>{MONEY})|(?P<dash>(?<!\S)[-–](?!\S))"
)
CODE_RE = re.compile(r"^ ?(\d{2,12})(?:\s*-)?\s+(\S.*)$")
TABLE_RE = re.compile(r"(?:^|\s)Table\s+(\d+)\s*:\s*(.+?)\s*$")
PROJECT_MDA_RE = re.compile(r"^\s*(\d{12})\s*-\s*(\S.+?)\s*$")

TOLERANCE = 1.0  # naira


def to_number(tok: str) -> float:
    if tok in ("-", "–"):
        return 0.0
    neg = tok.startswith("(") or tok.startswith("-")
    value = float(tok.strip("()-").replace(",", ""))
    return -value if neg else value


def tokens(text: str):
    return [(m.lastgroup, m.group(m.lastgroup), m.start()) for m in TOKEN_RE.finditer(text)]


def trailing_run(text, toks):
    """Numeric tokens at the end of toks with nothing but spaces between them."""
    run = []
    for t in reversed(toks):
        if t[0] not in ("money", "dash"):
            break
        if run:
            gap = text[t[2] + len(t[1]):run[0][2]]
            if gap.strip():
                break
        run.insert(0, t)
    return run


def split_row(text: str, n_money: int):
    """Return (name_text, values dict, pct, balance) or None when incomplete."""
    toks = tokens(text)
    pct_idx = [i for i, t in enumerate(toks) if t[0] == "pct"]
    if not pct_idx:
        # A zero-budget row prints no % (and often no balance): accept a
        # trailing run of exactly n_money numbers, or n_money + a balance.
        run = trailing_run(text, toks)
        if len(run) < n_money or to_number(run[0][1]) != 0:
            return None  # incomplete (wrapped) row, or a real budget missing its %
        rest = run[n_money:]
        if not rest:
            return run, None, None
        if len(rest) == 1 and rest[0][0] == "money":
            return run[:n_money], None, to_number(rest[0][1])
        if len(rest) == 2 and rest[0][0] == "dash" and rest[1][0] == "money":
            return run[:n_money], None, -abs(to_number(rest[1][1]))
        return None
    p = pct_idx[-1]
    # Only the contiguous run of numeric tokens right before the % counts.
    run = trailing_run(text, toks[:p])
    if len(run) < n_money:
        return None
    after = toks[p + 1:]
    sign = 1.0
    balance = None
    for kind, tok, _ in after:
        if kind == "dash":
            sign = -1.0
            balance = 0.0 if balance is None else balance
        elif kind == "money":
            balance = sign * abs(to_number(tok)) if sign < 0 else to_number(tok)
            break
    pct_tok = toks[p][1]
    pct = None if pct_tok.startswith("#") else float(pct_tok.replace("%", "").replace(",", "").strip())
    return run, pct, balance


def assign(run, columns, pct, balance):
    """Pick the column assignment that reproduces the BIR's own % and balance."""
    n_money = len(columns)
    nums = [to_number(t[1]) for t in run]
    candidates = [(nums[-n_money:], run[-n_money][2])]
    if len(nums) > n_money:
        candidates.append(([nums[0]] + nums[-(n_money - 1):], run[0][2]))
    best = None
    for cand, cut in candidates:
        result = {"original_budget": None, "revised_budget": None}
        result.update(dict(zip(columns, cand)))
        ok, base = verify(result, pct, balance)
        result.update({"printed_pct": pct, "printed_balance": balance, "pct_base": base})
        if ok:
            return result, True, cut
        if best is None:
            best = (result, False, cut)
    return best


def verify(row, pct, balance):
    bases = [("original", row["original_budget"])] if row["original_budget"] is not None else []
    if row["revised_budget"] is not None:
        bases.insert(0, ("revised", row["revised_budget"]))
    for name, base in bases:
        pct_ok = True
        if pct is not None:
            if base:
                pct_ok = abs(row["ytd_actual"] / base * 100 - pct) <= 0.15
            else:
                pct_ok = pct == 0
        bal_ok = balance is None or abs((base - row["ytd_actual"]) - balance) <= TOLERANCE
        if pct_ok and bal_ok:
            return True, name
    return False, None


def clean_name(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip(" -–")
    return text


def parse_report(txt: str):
    pages = txt.split("\f")
    lines = []  # (page_no, line)
    for i, page in enumerate(pages, start=1):
        for line in page.splitlines():
            lines.append((i, line))

    # Locate table headings (skip table-of-contents lines with dot leaders).
    heads = []
    for idx, (page, line) in enumerate(lines):
        m = TABLE_RE.search(line)
        if m and "...." not in line and "…" not in line:
            title = m.group(2)
            for rx, kind, cls in TABLE_KINDS:
                km = rx.match(title)
                if km:
                    c = km.group(1).lower() if cls == 1 else cls
                    heads.append((idx, int(m.group(1)), title, kind, c))
                    break
            else:
                heads.append((idx, int(m.group(1)), title, None, None))

    tables = []
    for h, (start, number, title, kind, cls) in enumerate(heads):
        if kind is None:
            continue
        end = heads[h + 1][0] if h + 1 < len(heads) else len(lines)
        seg = lines[start + 1:end]
        columns = detect_columns(seg)
        rows = parse_segment(seg, kind, columns)
        hidden = pct_against_hidden_budget(seg, columns)
        if hidden:
            for r in rows:
                r["valid"] = True
                r["pct_base"] = "revised (not printed)"
        tables.append({"number": number, "title": title, "kind": kind, "class": cls,
                       "columns": columns, "pct_against_hidden_budget": hidden,
                       "page": lines[start][0], "rows": rows})
    return tables


BUDGET_COL_RE = re.compile(r"(?<!against )(?<!against)\b20\d\d\s+(Original|Revised|Final)\s+Budget", re.I)


def header_lines(seg):
    """Lines before the first line that carries figures."""
    out = []
    for item in seg[:16]:
        if any(k == "money" for k, _, _ in tokens(item[1])):
            break
        out.append(item[1])
    return out


def detect_columns(seg):
    """Budget columns named in the header, in order, then quarter + YTD actuals."""
    found = []
    for line in header_lines(seg):
        for m in BUDGET_COL_RE.finditer(line):
            key = "original_budget" if m.group(1).lower() == "original" else "revised_budget"
            if key not in found:
                found.append(key)
    if not found:
        found = ["original_budget"]
    return found + ["quarter_actual", "ytd_actual"]


def pct_against_hidden_budget(seg, columns):
    """True when the % column is 'against Revised/Final Budget' but no such column is printed."""
    if "revised_budget" in columns:
        return False
    for line in header_lines(seg):
        if re.match(r"^\s*(Revised|Final)\s+Budget\s*\)?\s*$", line, re.I) or re.search(r"against\s+20\d\d\s+(Revised|Final)", line, re.I):
            return True
    return False


def split_line(line):
    """(name text, trailing figures text) for one physical line."""
    # Some project tables print a count column (e.g. " 1") after the balance.
    if any(k == "pct" for k, _, _ in tokens(line)):
        line = re.sub(r"\s+\d{1,3}\s*$", "", line)
    toks = [t for t in tokens(line)]
    run = []
    for t in reversed(toks):
        if run:
            gap = line[t[2] + len(t[1]):run[0][2]]
            if gap.strip():
                break
        elif line[t[2] + len(t[1]):].strip():
            break
        run.insert(0, t)
    if not run:
        return line, ""
    return line[:run[0][2]], line[run[0][2]:]


class Pending:
    def __init__(self, code, page):
        self.code, self.page = code, page
        self.names, self.figures = [], []

    def add(self, line):
        line = re.sub(r"(\d\.\d{2})(?=[A-Za-z(])", r"\1 ", line)
        if self.names or self.figures:
            # Continuation line: every figure on it is a figure, the rest is name text.
            figs = [m.group(0) for m in TOKEN_RE.finditer(line)]
            name = TOKEN_RE.sub(" ", line)
            if name.strip():
                self.names.append(name.strip())
            if figs:
                self.figures.append("   ".join(figs))
            return
        name, figs = split_line(line)
        if name.strip():
            self.names.append(name.strip())
        if figs.strip():
            self.figures.append(figs.strip())

    def text(self):
        return " ".join(self.names) + "      " + "   ".join(self.figures)


def finish(pending, columns):
    """Return a row dict once the pending row has all its figures, else None."""
    text = pending.text()
    parts = split_row(text, len(columns))
    if parts is None:
        return None
    run, pct, balance = parts
    values, ok, cut = assign(run, columns, pct, balance)
    name = " ".join(pending.names)
    if pending.code:
        name = re.sub(r"^\s*" + re.escape(pending.code) + r"(\s*-)?", "", name)
    return {"code": pending.code, "name": clean_name(name), "page": pending.page, "valid": ok, **values}


def parse_segment(seg, kind, columns):
    rows = []
    pending = None
    project_mda = None
    for page, line in seg:
        if not line.strip():
            continue
        if kind == "phc_projects":
            m = PROJECT_MDA_RE.match(line)
            if m and not any(k in ("money", "pct") for k, _, _ in tokens(line)):
                project_mda = (m.group(1), clean_name(m.group(2)))
                pending = None
                continue
            if project_mda is None:
                continue
            if pending is None:
                pending = Pending(None, page)
            pending.add(line)
            row = finish(pending, columns)
            if row:
                rows.append({**row, "code": project_mda[0], "mda": project_mda[1]})
                pending = None
            continue

        code_m = CODE_RE.match(line)
        label_row = (kind == "state_summary" and not line.startswith("   " * 4)) or re.match(r"^\s*Total\b", line, re.I)
        if code_m or label_row:
            pending = Pending(code_m.group(1) if code_m else None, page)
        elif pending is None:
            continue
        pending.add(line)
        row = finish(pending, columns)
        if row:
            rows.append(row)
            pending = None
        elif len(pending.names) > 8:
            pending = None  # a header line that never got figures
    return rows


def keep_row(kind, row):
    if kind == "state_summary":
        return True
    if row["code"] is None:
        return row["name"].lower().startswith("total")
    prefix = HEALTH_PREFIX.get(kind)
    return prefix is None or row["code"].startswith(prefix)


def summary_key(name):
    for rx, key in SUMMARY_ROWS:
        if rx.match(name):
            return key
    return None


def near(a, b):
    return abs(a - b) <= TOLERANCE * 2


def cross_checks(tables):
    """Consistency checks between tables. Returns list of failure strings."""
    fails = []
    by = {}
    for t in tables:
        by.setdefault((t["kind"], t["class"]), t)

    def rows_by_code(t):
        out = {}
        for r in t["rows"]:
            if r["code"]:
                out.setdefault(r["code"], r)
        return out

    # 1. MDA total = personnel + overhead + capital + other (admin, function, programme).
    for kind in ("exp_admin", "exp_function", "exp_programme"):
        total = by.get((kind, "total"))
        parts = [by.get((kind, c)) for c in CLASSES[1:]]
        if not total or not all(parts):
            if total:
                fails.append(f"{kind}: missing class tables {[c for c, p in zip(CLASSES[1:], parts) if not p]}")
            continue
        maps = [rows_by_code(p) for p in parts]
        for code, r in rows_by_code(total).items():
            for field in ("original_budget", "revised_budget", "ytd_actual"):
                if r[field] is None or any(code in m and m[code][field] is None for m in maps):
                    continue  # this budget column is not printed in every table
                s = sum(m[code][field] for m in maps if code in m)
                if not near(s, r[field]):
                    fails.append(f"{kind} {code} {r['name'][:40]}: total {field} {r[field]:,.2f} != classes {s:,.2f}")

    # 2. Sector total = sum of children (admin 052100000000; function 707; programme 04).
    parents = {"exp_admin": ("052100000000", lambda c: len(c) == 12 and c != "052100000000"),
               "revenue_admin": ("052100000000", lambda c: len(c) == 12 and c != "052100000000"),
               "exp_function": ("707", lambda c: len(c) == 4),
               "exp_programme": ("04", lambda c: len(c) == 4)}
    for (kind, cls), t in by.items():
        if kind not in parents:
            continue
        parent_code, is_child = parents[kind]
        m = rows_by_code(t)
        if parent_code not in m:
            if any(is_child(c) for c in m):
                fails.append(f"{kind}/{cls}: no sector total row {parent_code}")
            continue  # no health rows at all in this class table: nothing spent or budgeted
        for field in ("original_budget", "revised_budget", "ytd_actual"):
            if m[parent_code][field] is None:
                continue
            s = sum(r[field] or 0 for c, r in m.items() if is_child(c))
            if not near(s, m[parent_code][field]):
                fails.append(f"{kind}/{cls}: sector {field} {m[parent_code][field]:,.2f} != children {s:,.2f}")
    return fails


def apply_correction(tables, corr):
    """Derive a class table that the BIR omits or prints under another code list:
    class = total - (the other classes), per code. Rows are marked derived."""
    kind, cls = corr["kind"], corr["class"]
    by = {(t["kind"], t["class"]): t for t in tables}
    total = by[(kind, "total")]
    others = [by[(kind, c)] for c in CLASSES[1:] if c != cls and (kind, c) in by]
    target = by.get((kind, cls))
    if target is None:
        raise SystemExit(f"correction for missing table {kind}/{cls}")
    keep = [r for r in target["rows"] if r["code"] is None]  # the state-wide Total row is still real
    for r in total["rows"]:
        if r["code"] is None:
            continue
        vals = {}
        for field in ("original_budget", "revised_budget", "quarter_actual", "ytd_actual"):
            if r[field] is None:
                vals[field] = None
                continue
            rest = sum(o_r[field] or 0 for o in others for o_r in o["rows"] if o_r["code"] == r["code"])
            vals[field] = round(r[field] - rest, 2)
            if vals[field] < -TOLERANCE:
                raise SystemExit(f"correction {kind}/{cls} {r['code']}: derived {field} is negative")
        if all(not v for v in vals.values()):
            continue
        keep.append({"code": r["code"], "name": r["name"], "page": r["page"], "valid": True,
                     "derived": corr["reason"], "printed_pct": None, "printed_balance": None,
                     "pct_base": None, **vals})
    target["rows"] = keep
    target["derived"] = corr["reason"]


def reference_originals(out, fiscal_year, current_slug, tables):
    """(kind, class, code) -> original budget, from the year's Q1 report.

    Q1 reports are published before any in-year revision, so their budget
    column is the untouched original budget for the whole year.
    """
    ref_tables = tables if current_slug == f"{fiscal_year}-Q1" else None
    if ref_tables is None:
        ref_path = out / f"{fiscal_year}-Q1.json"
        if not ref_path.exists():
            return {}
        ref_tables = json.loads(ref_path.read_text())["tables"]
    ref = {}
    for t in ref_tables:
        for r in t["rows"]:
            if r.get("original_budget") is not None and not r.get("derived"):
                ref.setdefault((t["kind"], t["class"], r["code"], r["name"] if r["code"] is None else ""), r["original_budget"])
    return ref


def reconcile_budgets(tables, ref, slug):
    """Relabel single budget columns that actually hold the revised budget, and
    fill original budgets the report does not print from the year's Q1 report."""
    notes = []
    for t in tables:
        if t["kind"] in ("state_summary", "phc_projects"):
            continue
        single = t["columns"][0] if len(t["columns"]) == 3 else None
        if single == "original_budget" and ref:
            mismatched = [r for r in t["rows"] if r["original_budget"] is not None and
                          (t["kind"], t["class"], r["code"], r["name"] if r["code"] is None else "") in ref and
                          abs(ref[(t["kind"], t["class"], r["code"], r["name"] if r["code"] is None else "")] - r["original_budget"]) > TOLERANCE]
            if mismatched and len(mismatched) * 2 >= len([r for r in t["rows"] if r["code"]]) and not slug.endswith("-Q1"):
                for r in t["rows"]:
                    r["revised_budget"], r["original_budget"] = r["original_budget"], None
                t["columns"] = ["revised_budget"] + t["columns"][1:]
                t["budget_column_note"] = "The budget column is labelled Original, but its figures match the revised budget."
                notes.append(f"T{t['number']} budget column holds revised figures")
        for r in t["rows"]:
            key = (t["kind"], t["class"], r["code"], r["name"] if r["code"] is None else "")
            if r["original_budget"] is None and key in ref:
                r["original_budget"] = ref[key]
                r["original_budget_from"] = "Q1 report"
            elif r["original_budget"] is not None and key in ref and not r.get("derived") and abs(ref[key] - r["original_budget"]) > TOLERANCE:
                notes.append(f"T{t['number']} {r['code']} original budget {r['original_budget']:,.2f} differs from Q1 {ref[key]:,.2f}")
    return notes


def run(manifest_path, pdf_dir, out_dir, only):
    corrections = json.loads((Path(__file__).parent / "corrections.json").read_text())
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(Path(manifest_path).read_text())
    for rep in manifest:
        if only and rep["slug"] not in only:
            continue
        pdf = Path(pdf_dir) / rep["file"]
        txt = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True).stdout
        tables = parse_report(txt)
        for t in tables:
            t["rows"] = [r for r in t["rows"] if keep_row(t["kind"], r)]
            if t["kind"] == "state_summary":
                seen = set()
                kept = []
                for r in t["rows"]:
                    r["key"] = summary_key(r["name"])
                    if r["key"] and r["key"] not in seen:
                        seen.add(r["key"])
                        kept.append(r)
                t["rows"] = kept
        ref = reference_originals(out, rep["fiscal_year"], rep["slug"], tables)
        budget_notes = reconcile_budgets(tables, ref, rep["slug"])
        for corr in corrections.get(rep["slug"], []):
            apply_correction(tables, corr)
        invalid = [f"T{t['number']} p{r['page']} {r['code'] or ''} {r['name'][:50]}: printed % / balance do not reconcile"
                   for t in tables for r in t["rows"] if not r["valid"]]
        fails = invalid + cross_checks(tables)
        kinds = sorted({(t["kind"], t["class"] or "") for t in tables})
        result = {**rep, "tables": tables, "checks": fails, "budget_notes": budget_notes,
                  "row_count": sum(len(t["rows"]) for t in tables)}
        (out / f"{rep['slug']}.json").write_text(json.dumps(result, indent=1))
        print(f"{rep['slug']}: {len(tables)} tables, {result['row_count']} rows, {len(fails)} failing checks")
        for n in budget_notes[:6]:
            print("    note:", n)
        for f in fails[:12]:
            print("   ", f)
        if len(fails) > 12:
            print(f"    ... {len(fails) - 12} more")
        missing = [k for k in ("state_summary", "revenue_admin", "exp_admin", "exp_function")
                   if not any(t["kind"] == k for t in tables)]
        if missing:
            print("    missing tables:", missing)


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2], sys.argv[3], set(sys.argv[4:]))
