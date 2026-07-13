from __future__ import annotations

import csv
import json
import re
from decimal import Decimal
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parent
REPORTS = {quarter: ROOT / f"kano-2025-q{quarter}.pdf" for quarter in range(1, 5)}
HEALTH_PREFIX = "0521"

CATEGORY_PATTERNS = (
    ("total", "Total Expenditure by Administrative Classification"),
    ("personnel", "Personnel Expenditure by Administrative Classification"),
    ("overhead", "Overhead Expenditure by Administrative Classification"),
    ("capital", "Capital Expenditure by Administrative Classification"),
    ("other", "Other Expenditure by Administrative Classification"),
)


def compact(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def money(value: object) -> Decimal | None:
    text = compact(value)
    if not text or text == "-":
        return Decimal("0")
    patterns = (
        r"(?<![\d,])(\d{1,3}(?:\s*,\s*\d{3})+\s*\.\s*\d{2})(?!\d)",
        r"(?<!\d)(\d+\s*\.\s*\d{2})(?!\d)",
    )
    for pattern in patterns:
        matches = re.findall(pattern, text)
        if matches:
            return Decimal(re.sub(r"[\s,]", "", matches[-1]))
    return None


def category_for_page(text: str) -> str | None:
    normalized = compact(text).lower()
    for category, phrase in CATEGORY_PATTERNS:
        if phrase.lower() in normalized:
            return category
    return None


def money_tokens(value: str) -> list[Decimal]:
    return [
        Decimal(re.sub(r"[\s,]", "", token))
        for token in re.findall(r"(?<![\d,])(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?!\d)", value)
    ]


def raw_admin_records(page_text: str, quarter: int, page_number: int, category: str) -> list[dict]:
    lines = page_text.splitlines()
    starts = [index for index, line in enumerate(lines) if re.match(r"^\d{12}\s", line.strip())]
    records = []
    for position, start in enumerate(starts):
        end = starts[position + 1] if position + 1 < len(starts) else min(start + 4, len(lines))
        block = " ".join(line.strip() for line in lines[start:end])
        code = re.match(r"^(\d{12})\s+", block).group(1)
        if not code.startswith(HEALTH_PREFIX):
            continue
        amounts = money_tokens(block)
        if quarter <= 2:
            if len(amounts) < 2:
                continue
            original = final = amounts[0]
            balance = amounts[-1]
            middle = amounts[1:-1]
            q_value = middle[0] if len(middle) >= 2 else Decimal("0")
            ytd = middle[-1] if middle else Decimal("0")
        else:
            # New in the Q4 supplementary budget: KNCDC has no original budget.
            if code == "052101400100" and quarter >= 3:
                original = Decimal("0")
                final = amounts[0]
                q_value = amounts[1] if quarter == 3 else Decimal("0")
                ytd = amounts[-2]
                balance = amounts[-1]
            else:
                if len(amounts) < 3:
                    continue
                original, final = amounts[:2]
                balance = amounts[-1]
                middle = amounts[2:-1]
                q_value = middle[0] if len(middle) >= 2 else Decimal("0")
                ytd = middle[-1] if middle else Decimal("0")
        name = re.sub(r"^\d{12}\s+", "", block)
        first_money = re.search(r"\d{1,3}(?:,\d{3})+\.\d{2}", name)
        if first_money:
            name = name[: first_money.start()].strip()
        records.append(
            {
                "quarter": quarter,
                "pdf_page": page_number,
                "table_row": None,
                "category": category,
                "code": code,
                "name": compact(name),
                "original_budget": str(original),
                "final_budget": str(final),
                "quarter_performance": str(q_value),
                "ytd_performance": str(ytd),
                "balance": str(balance),
            }
        )
    return records


def column_index(header: list[str], required: tuple[str, ...], excluded: tuple[str, ...] = ()) -> int | None:
    for index, value in enumerate(header):
        lowered = compact(value).lower()
        if all(token in lowered for token in required) and not any(token in lowered for token in excluded):
            return index
    return None


def parse_admin_table(table: list[list[object]], quarter: int, page_number: int, category: str) -> list[dict]:
    if not table:
        return []
    header_index = next(
        (i for i, row in enumerate(table) if any("code" in compact(cell).lower() for cell in row[:2])),
        None,
    )
    if header_index is None:
        return []
    header = [compact(cell) for cell in table[header_index]]
    code_i = column_index(header, ("code",))
    name_i = column_index(header, ("admin",))
    original_i = column_index(header, ("original", "budget"))
    final_i = column_index(header, ("final", "budget"), ("against", "balance", "performance"))
    quarter_i = column_index(header, (f"q{quarter}", "performance"), ("year to date",))
    ytd_i = column_index(header, ("performance", "year to date"), ("%", "against"))
    balance_i = column_index(header, ("balance",))
    if code_i is None or name_i is None or quarter_i is None or ytd_i is None:
        return []

    records = []
    for source_row, row in enumerate(table[header_index + 1 :], start=header_index + 2):
        padded = list(row) + [None] * (len(header) - len(row))
        code_match = re.search(r"\b(\d{12})\b", compact(padded[code_i]))
        if not code_match:
            continue
        code = code_match.group(1)
        if not code.startswith(HEALTH_PREFIX):
            continue
        original = money(padded[original_i]) if original_i is not None else None
        final = money(padded[final_i]) if final_i is not None else original
        q_value = money(padded[quarter_i])
        ytd = money(padded[ytd_i])
        balance = money(padded[balance_i]) if balance_i is not None else None
        if final is None and ytd is not None and balance is not None:
            final = ytd + balance
        records.append(
            {
                "quarter": quarter,
                "pdf_page": page_number,
                "table_row": source_row,
                "category": category,
                "code": code,
                "name": compact(padded[name_i]),
                "original_budget": str(original) if original is not None else None,
                "final_budget": str(final) if final is not None else None,
                "quarter_performance": str(q_value) if q_value is not None else None,
                "ytd_performance": str(ytd) if ytd is not None else None,
                "balance": str(balance) if balance is not None else None,
            }
        )
    return records


def main() -> None:
    inventory = []
    records = []
    for quarter, path in REPORTS.items():
        layout_pages = (ROOT / f"kano-2025-q{quarter}.txt").read_text(encoding="utf-8").split("\f")
        active_category = None
        with pdfplumber.open(path) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                tables = page.extract_tables()
                layout_text = layout_pages[page_number - 1]
                detected_category = category_for_page(layout_text)
                if detected_category:
                    active_category = detected_category
                if "Expenditure by Economic Classification" in layout_text:
                    active_category = None
                category = active_category
                page_records = (
                    raw_admin_records(layout_text, quarter, page_number, category) if category else []
                )
                records.extend(page_records)
                headings = [
                    compact(line)
                    for line in text.splitlines()
                    if re.search(r"(?:Table \d+:|Budget Performance Report 2025|^[1-5]\.[A-Z])", compact(line))
                ][:8]
                inventory.append(
                    {
                        "quarter": quarter,
                        "pdf_page": page_number,
                        "category": category,
                        "table_count": len(tables),
                        "health_admin_rows": len(page_records),
                        "headings": headings,
                    }
                )

    # The Q2 overhead continuation page omits the code column in the source PDF.
    # Reconstruct those exact values from Total = Personnel + Overhead + Capital;
    # Table 8 confirms that Other Expenditure is not applicable.
    q2_index = {
        (row["category"], row["code"]): row
        for row in records
        if row["quarter"] == 2
    }
    for (category, code), total in list(q2_index.items()):
        if category != "total":
            continue
        personnel = q2_index.get(("personnel", code))
        capital = q2_index.get(("capital", code))
        derived = {}
        for field in ("original_budget", "final_budget", "quarter_performance", "ytd_performance"):
            value = Decimal(total[field])
            value -= Decimal(personnel[field]) if personnel else Decimal("0")
            value -= Decimal(capital[field]) if capital else Decimal("0")
            derived[field] = value
        derived["balance"] = derived["final_budget"] - derived["ytd_performance"]
        records.append(
            {
                "quarter": 2,
                "pdf_page": 27,
                "table_row": None,
                "category": "overhead",
                "code": code,
                "name": total["name"],
                **{field: str(value) for field, value in derived.items()},
            }
        )

    q4 = {
        (row["code"], row["category"]): row
        for row in records
        if row["quarter"] == 4 and row["code"] != "052100000000"
    }
    budget_rows = []
    for code in sorted({code for code, category in q4 if category == "total"}):
        personnel = Decimal(q4.get((code, "personnel"), {"final_budget": "0"})["final_budget"])
        overhead = Decimal(q4.get((code, "overhead"), {"final_budget": "0"})["final_budget"])
        capital = Decimal(q4.get((code, "capital"), {"final_budget": "0"})["final_budget"])
        total = Decimal(q4[(code, "total")]["final_budget"])
        budget_rows.append(
            {
                "code": code,
                "name": q4[(code, "total")]["name"],
                "personnel_amount": str(personnel),
                "other_recurrent_amount": str(overhead),
                "total_recurrent_amount": str(personnel + overhead),
                "capital_amount": str(capital),
                "total_budget_amount": str(total),
                "source": "Kano State 2025 Q4 BIR, administrative classification, PDF pages 18/21/25/28",
            }
        )
    entry_rows = []
    for row in sorted(records, key=lambda item: (item["quarter"], item["code"], item["category"])):
        if (
            row["code"] == "052100000000"
            or row["category"] not in {"personnel", "overhead", "capital"}
            or Decimal(row["quarter_performance"]) <= 0
        ):
            continue
        entry_rows.append(
            {
                "quarter": row["quarter"],
                "period_end": {1: "2025-03-31", 2: "2025-06-30", 3: "2025-09-30", 4: "2025-12-31"}[row["quarter"]],
                "code": row["code"],
                "name": row["name"],
                "category": row["category"],
                "amount": row["quarter_performance"],
                "pdf_page": row["pdf_page"],
                "proposed_reference": f"KSBIR25-Q{row['quarter']}-{row['code']}-{row['category'][:3].upper()}",
            }
        )

    for filename, rows in (
        ("candidate-approved-budgets.csv", budget_rows),
        ("candidate-quarterly-expenditures.csv", entry_rows),
    ):
        with (ROOT / filename).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)

    (ROOT / "page-inventory.json").write_text(json.dumps(inventory, indent=2), encoding="utf-8")
    (ROOT / "health-admin-rows.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    with (ROOT / "health-admin-rows.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)

    summary = {
        "pages": len(inventory),
        "pages_by_quarter": {
            str(q): sum(item["quarter"] == q for item in inventory) for q in REPORTS
        },
        "candidate_rows": len(records),
        "rows_by_quarter_category": {
            f"q{q}_{category}": sum(
                row["quarter"] == q and row["category"] == category for row in records
            )
            for q in REPORTS
            for category, _ in CATEGORY_PATTERNS
        },
        "unparsed_money_cells": sum(
            any(row[field] is None for field in ("final_budget", "quarter_performance", "ytd_performance"))
            for row in records
        ),
        "candidate_budget_rows": len(budget_rows),
        "candidate_expenditure_rows": len(entry_rows),
        "candidate_expenditure_total": str(
            sum((Decimal(row["amount"]) for row in entry_rows), Decimal("0"))
        ),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
