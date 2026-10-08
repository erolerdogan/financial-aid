#!/usr/bin/env python3
"""Convert ABN AMRO statement PDFs (2023-2026 layouts) to CSV.

Usage:  python3 abnamro_pdf_to_csv.py .  -o out.csv        (every .pdf/.PDF in this folder)
        python3 abnamro_pdf_to_csv.py a.pdf b.PDF -o out.csv
            [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--strict]
Needs:  pip install pdfplumber
Runs fully offline.
Checks: each statement against its printed totals and balances (stops on mismatch);
the chain between statements per account (balance carry-over, statement numbering,
duplicates); identical same-day rows the app would collapse on import.
--from/--to keep only a period (e.g. the months not yet imported via CSV).
--strict refuses to write the CSV when a gap is found.
"""
import argparse
import csv
import os
import re
import sys
from collections import Counter

import pdfplumber

FIELD_RE = re.compile(r"^(IBAN|BIC|Naam|Omschrijving|Kenmerk|Incassant|Machtiging|Voor|Betalingskenm\.):\s*(.*)$")
WRAP_WIDTH = 31
AMOUNT_RE = re.compile(r"^\d{1,3}(?:\.\d{3})*,\d{2}$")
DATE_RE = re.compile(r"^\d{2}-\d{2}$")
# "12.04.01.312 NL60ABNA0120401312 29-05-2026 3 1 005" -> IBAN, date, statement number
HEADER_RE = re.compile(r"\b(NL\d{2}[A-Z]{4}\d{10})\s+(\d{2}-\d{2}-\d{4})\s+\d+\s+\d+\s+(\d{1,4})\b")


def to_number(text):
    return float(text.replace(".", "").replace(",", "."))


def group_lines(words, tolerance=3):
    lines = []
    for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
        if lines and abs(lines[-1]["top"] - w["top"]) <= tolerance:
            lines[-1]["words"].append(w)
        else:
            lines.append({"top": w["top"], "words": [w]})
    for line in lines:
        line["words"].sort(key=lambda w: w["x0"])
    return lines


def normalize_spaced_dates(text):
    """Older statements print some dates with a gap: "2 8-03-2024" -> "28-03-2024"."""
    return re.sub(r"(?<!\S)(\d) (\d-\d{2}(?:-\d{4})?)(?!\S)", r"\1\2", text)


def parse_statement(path):
    """Read one statement. Works for the 2023-2026 layouts (with or without the
    Mutcd / Bkdatum / Navraagrubriek columns). Labels and values overlap in the
    older PDFs, so only the font used for the transaction data is read."""
    with pdfplumber.open(path) as pdf:
        transactions, current, first_text = [], None, None
        for page in pdf.pages:
            hits = page.search(r"Bookdate|Boekdatum")
            if not hits:
                continue
            htop = hits[0]["top"]
            deb = page.search(r"Amount\s*debit|Bedrag\s*debet")
            cred = page.search(r"Amount\s*credit|Bedrag\s*credit")
            if not deb or not cred:
                raise ValueError(f"{path}: debit/credit column headers not found")
            debit_x0, credit_x0 = deb[0]["x0"], cred[0]["x0"]
            body_chars = [c for c in page.chars if c["top"] > htop + 8]
            if not body_chars:
                continue
            font = Counter(c["fontname"] for c in body_chars).most_common(1)[0][0]
            view = page.filter(lambda o, f=font: o.get("object_type") != "char" or o.get("fontname") == f)
            if first_text is None:
                # Data-font text first (older PDFs overlap labels and values), then the
                # plain page text (newer PDFs print the header values in another font).
                first_text = normalize_spaced_dates(
                    (view.extract_text(x_tolerance=1.5) or "") + "\n" + (page.extract_text() or ""))

            words = [w for w in view.extract_words(x_tolerance=1.5) if w["top"] > htop + 8]
            for line in group_lines(words):
                ws = line["words"]
                if (len(ws) >= 2 and re.fullmatch(r"\d", ws[0]["text"])
                        and re.fullmatch(r"\d-\d{2}", ws[1]["text"])):
                    ws = [dict(ws[0], text=ws[0]["text"] + ws[1]["text"], x1=ws[1]["x1"])] + ws[2:]
                texts = [w["text"] for w in ws]
                if texts == ["DIG"]:
                    continue
                if DATE_RE.match(texts[0]) and ws[0]["x0"] < 70:
                    amount, desc, year = None, [], None
                    for w in ws[1:]:
                        t = w["text"]
                        if amount is None and AMOUNT_RE.match(t) and w["x1"] > debit_x0:
                            # Debit amounts end before the credit column starts.
                            amount = -to_number(t) if w["x1"] <= credit_x0 + 5 else to_number(t)
                        elif amount is None:
                            desc.append(t)
                        else:
                            ym = re.fullmatch(r"\d{2}-\d{2}-(\d{4})", t)  # Bkdatum column
                            if ym:
                                year = int(ym.group(1))
                    if amount is None:
                        raise ValueError(f"{path}: no amount on booking line {' '.join(texts)}")
                    current = {"bookdate": texts[0], "amount": amount, "year": year,
                               "type": " ".join(desc), "lines": []}
                    transactions.append(current)
                elif current is not None:
                    text = re.sub(r"^\(\d{2}-\d{2}\)\s*", "", " ".join(texts))  # value date
                    if text:
                        current["lines"].append(text)

        if first_text is None:
            raise ValueError(f"{path}: no transaction table found (not an ABN AMRO statement?)")
        m = re.search(r"([\d.,]+)\s*\+?/?(CREDIT|DEBIT)\s+([\d.,]+)\s*\+?/?(CREDIT|DEBIT)\s+([\d.,]+)\s+([\d.,]+)",
                      first_text)
        if not m:
            raise ValueError(f"{path}: summary block not found (not an ABN AMRO statement?)")
        sign = lambda v, s: to_number(v) * (1 if s == "CREDIT" else -1)
        summary = {
            "previous": sign(m.group(1), m.group(2)),
            "new": sign(m.group(3), m.group(4)),
            "debit": to_number(m.group(5)),
            "credit": to_number(m.group(6)),
        }
        hm = HEADER_RE.search(first_text)
        if not hm:
            raise ValueError(f"{path}: statement header (IBAN / date / statement number) not found")
        iban, stmt_date, stmt_no = hm.group(1), hm.group(2), int(hm.group(3))
        d, mo, y = stmt_date.split("-")
        stmt = (int(d), int(mo), int(y))

    s_day, s_month, s_year = stmt
    rows = []
    for t in transactions:
        day, month = map(int, t["bookdate"].split("-"))
        year = s_year - 1 if month > s_month else s_year
        if t["year"] and not (month == 12 and t["year"] == year + 1):
            year = t["year"]
        # ABN AMRO wraps the description column at a fixed width (~32 characters),
        # often mid-word. A line without "Key:" continues the previous field; it is
        # glued without a space when the previous line was full width.
        fields, free, last = {}, [], None
        for line in t["lines"]:
            fm = FIELD_RE.match(line)
            if fm:
                last = fm.group(1)
                fields[last] = fm.group(2)
                last_len = len(line)
            elif last is not None:
                fields[last] += ("" if last_len >= WRAP_WIDTH else " ") + line
                last_len = len(line)
            else:
                free.append(line)
        # Card payments (BEA / eCom) have no "Naam:"; the merchant is the first free line.
        card_name = re.sub(r",\s*PAS\d+.*$", "", free[0]).strip() if free else ""
        name = fields.get("Naam") or card_name or t["type"]
        memo_parts = [t["type"]]
        if fields.get("Omschrijving"):
            memo_parts.append(fields["Omschrijving"])
        memo_parts += free
        if fields.get("Kenmerk") and fields["Kenmerk"] != "NOTPROVIDED":
            memo_parts.append("Kenmerk: " + fields["Kenmerk"])
        rows.append({
            "Date": f"{year:04d}-{month:02d}-{day:02d}",
            "Name": name,
            "Description": " / ".join(p for p in memo_parts if p),
            "Amount": f"{t['amount']:.2f}",
            "Counterparty IBAN": fields.get("IBAN", ""),
        })

    debit = round(-sum(float(r["Amount"]) for r in rows if float(r["Amount"]) < 0), 2)
    credit = round(sum(float(r["Amount"]) for r in rows if float(r["Amount"]) > 0), 2)
    checks = [
        ("total debit", debit, summary["debit"]),
        ("total credit", credit, summary["credit"]),
        ("new balance", round(summary["previous"] - debit + credit, 2), summary["new"]),
    ]
    for label, got, want in checks:
        if abs(got - want) > 0.005:
            raise ValueError(f"{path}: {label} mismatch, parsed {got:.2f} vs statement {want:.2f}")
    summary.update(path=path, iban=iban, date=f"{stmt[2]:04d}-{stmt[1]:02d}-{stmt[0]:02d}",
                   year=stmt[2], number=stmt_no, count=len(rows))
    return rows, summary


def check_chain(statements):
    """Per account: sort statements, drop exact duplicates, and report gaps.

    Returns (kept_statements, problems). A gap is a balance that does not carry
    over from one statement to the next, or a missing statement number within a year.
    """
    problems, kept = [], []
    by_account = {}
    for s in statements:
        by_account.setdefault(s["iban"], []).append(s)
    for iban, items in by_account.items():
        items.sort(key=lambda s: (s["date"], s["number"]))
        seen = set()
        prev = None
        for s in items:
            key = (s["year"], s["number"])
            if key in seen:
                problems.append(f"DUPLICATE  {iban}: statement {s['year']}/{s['number']:03d} given twice "
                                f"({s['path']}), second copy skipped")
                continue
            seen.add(key)
            if prev is not None:
                if abs(prev["new"] - s["previous"]) > 0.005:
                    problems.append(f"GAP        {iban}: balance after {prev['year']}/{prev['number']:03d} is "
                                    f"{prev['new']:.2f}, but {s['year']}/{s['number']:03d} starts at "
                                    f"{s['previous']:.2f} (difference {s['previous'] - prev['new']:+.2f}); "
                                    f"a statement between {prev['date']} and {s['date']} is probably missing")
                elif s["year"] == prev["year"] and s["number"] != prev["number"] + 1:
                    problems.append(f"NUMBERING  {iban}: {prev['year']}/{prev['number']:03d} is followed by "
                                    f"{s['number']:03d}; balances match, so the missing number(s) likely had "
                                    f"no transactions, but please check")
            kept.append(s)
            prev = s
    return kept, problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdfs", nargs="+")
    ap.add_argument("-o", "--output", default="transactions.csv")
    ap.add_argument("--from", dest="date_from", help="only keep transactions on/after YYYY-MM-DD")
    ap.add_argument("--to", dest="date_to", help="only keep transactions on/before YYYY-MM-DD")
    ap.add_argument("--strict", action="store_true", help="do not write the CSV when gaps are found")
    args = ap.parse_args()

    # A folder argument means every .pdf / .PDF inside it (shell globs are case-sensitive).
    paths = []
    for arg in args.pdfs:
        if os.path.isdir(arg):  # includes subfolders; a PDF is recognised by its content, not its name
            for root, _, files in os.walk(arg):
                for f in sorted(files):
                    full = os.path.join(root, f)
                    if f.endswith(".icloud"):
                        print(f"SKIP {full}: still in iCloud, not downloaded. In Finder right-click > "
                              f"Download Now, then run again.")
                        continue
                    try:
                        with open(full, "rb") as fh:
                            is_pdf = fh.read(1024).lstrip().startswith(b"%PDF")
                    except OSError as exc:
                        print(f"SKIP {full}: cannot open ({exc})")
                        continue
                    if is_pdf:
                        paths.append(full)
                    elif "pdf" in f.lower():
                        print(f"SKIP {full}: name looks like a PDF but the content is not a PDF")
        else:
            paths.append(arg)

    print(f"Found {len(paths)} PDF files")
    parsed, failed = [], []
    for path in paths:
        try:
            rows, s = parse_statement(path)
        except Exception as exc:  # keep going; the gap check shows what is missing
            failed.append(f"{path}: {exc}")
            print(f"ERR {path}: {exc}")
            continue
        print(f"OK  {s['date']}  stmt {s['year']}/{s['number']:03d}  {len(rows):3d} transactions  "
              f"balance {s['previous']:.2f} -> {s['new']:.2f}  ({path})")
        parsed.append((s, rows))

    kept, problems = check_chain([s for s, _ in parsed])
    kept_ids = {id(s) for s in kept}
    all_rows = [r for s, rows in parsed if id(s) in kept_ids for r in rows]

    print("\nCoverage")
    for iban in sorted({s["iban"] for s in kept}):
        items = [s for s in kept if s["iban"] == iban]
        dates = [r["Date"] for s, rows in parsed if id(s) in kept_ids and s["iban"] == iban for r in rows]
        span = f"{min(dates)} .. {max(dates)}" if dates else "no transactions"
        print(f"  {iban}: {len(items)} statements, {sum(s['count'] for s in items)} transactions, {span}")

    if args.date_from:
        all_rows = [r for r in all_rows if r["Date"] >= args.date_from]
    if args.date_to:
        all_rows = [r for r in all_rows if r["Date"] <= args.date_to]
    all_rows.sort(key=lambda r: r["Date"])

    # Same date + amount + text collapse into one row on import (the app's dedup key).
    # They are real separate bookings (the statement totals prove it), so number the
    # repeats: "... (2)". The suffix is deterministic, so re-importing still dedups.
    seen = {}
    for r in all_rows:
        k = (r["Date"], r["Amount"], r["Name"], r["Description"])
        seen[k] = seen.get(k, 0) + 1
        if seen[k] > 1:
            r["Description"] += f" ({seen[k]})"
    for k, n in seen.items():
        if n > 1:
            problems.append(f"SAME-DAY   {n}x {k[0]} {k[1]} '{k[2]}': identical bookings, numbered (2)..({n}) "
                            f"so the app imports all of them")

    if failed:
        problems = [f"UNREADABLE {f}" for f in failed] + problems
    if problems:
        print("\nCheck these")
        for p in problems:
            print("  " + p)
    else:
        print("\nNo gaps, duplicates or numbering issues found.")

    if args.strict and any(p.startswith(("GAP", "NUMBERING", "UNREADABLE")) for p in problems):
        print("\n--strict: CSV not written.")
        return 1
    with open(args.output, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["Date", "Name", "Description", "Amount", "Counterparty IBAN"])
        w.writeheader()
        w.writerows(all_rows)
    print(f"Wrote {len(all_rows)} rows to {args.output}")


if __name__ == "__main__":
    sys.exit(main())
