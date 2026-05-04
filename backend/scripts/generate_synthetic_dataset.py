#!/usr/bin/env python3
"""
Wataniya Finance — Synthetic Collections Dataset Generator
==========================================================
Generates 10,000 synthetic loan accounts from real client data distributions.

Sources: LCDPD 1st Apr 2026, Agent Target Apr/Mar 2026, Collection Activity Oct 2025
Output:  backend/data/wataniya_accounts.csv
"""

import os, json, random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ── Reproducibility ─────────────────────────────────────────────────────────────
SEED = 42
np.random.seed(SEED)
random.seed(SEED)

TODAY = datetime(2026, 4, 27)
N     = 10_000

# ── Paths ───────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'data'))
os.makedirs(DATA_DIR, exist_ok=True)
OUT_PATH   = os.path.join(DATA_DIR, 'wataniya_accounts.csv')

# ═══════════════════════════════════════════════════════════════════════════════
# NAME & IDENTITY POOLS
# ═══════════════════════════════════════════════════════════════════════════════

FIRST_NAMES_M = [
    "Mohammed", "Abdullah", "Ahmed", "Khalid", "Faisal", "Omar", "Ali",
    "Yousef", "Ibrahim", "Abdulrahman", "Turki", "Nawaf", "Majed", "Fahad",
    "Sultan", "Meshari", "Waleed", "Saud", "Tariq", "Hassan", "Saleh",
    "Rayan", "Ziad", "Mansour", "Nayef", "Mishal", "Hamad", "Rashid",
    "Bader", "Talal", "Saad", "Mazen", "Bandar", "Wael", "Bassam",
]
FIRST_NAMES_F = [
    "Fatima", "Nora", "Sara", "Hessa", "Mona", "Lama", "Reem", "Noura",
    "Amal", "Mariam", "Renad", "Jawhara", "Hala", "Fozyah", "Samar",
    "Atheer", "Manal", "Layla", "Shahad", "Dana", "Rana", "Arwa", "Maha",
]
LAST_NAMES = [
    "Al-Otaibi", "Al-Rashidi", "Al-Harbi", "Al-Shehri", "Al-Qahtani",
    "Al-Ghamdi", "Al-Zahrani", "Al-Mutairi", "Al-Anzi", "Al-Dosari",
    "Al-Shamri", "Al-Subaie", "Al-Dossari", "Al-Amer", "Al-Shahrani",
    "Al-Khalidi", "Al-Asmari", "Al-Bishi", "Al-Yami", "Al-Malki",
    "Al-Ruwaili", "Al-Subai", "Al-Juhani", "Al-Enezi", "Al-Balawi",
    "Al-Hamdan", "Al-Saeed", "Al-Suleiman", "Al-Mansouri", "Al-Rasheed",
]
FATHER_NAMES = FIRST_NAMES_M  # used as middle name

CITIES = [
    ("Riyadh", "Al Olaya"),     ("Riyadh", "Al Malaz"),     ("Riyadh", "Al Rabwa"),
    ("Riyadh", "Al Nakheel"),   ("Riyadh", "Al Muruj"),      ("Riyadh", "Diriyah"),
    ("Jeddah", "Al Hamra"),     ("Jeddah", "Al Rawdah"),     ("Jeddah", "Al Zahraa"),
    ("Jeddah", "Al Faisaliah"), ("Dammam", "Al Faisaliah"),  ("Dammam", "Al Shati"),
    ("Mecca",  "Al Aziziyah"), ("Medina", "Al Aziziyah"),   ("Taif", "Al Hada"),
    ("Khobar", "Al Thuqbah"),   ("Tabuk", "Al Rawdah"),      ("Abha", "Al Manhal"),
    ("Buraidah","Al Andalus"),  ("Hail", "Al Hamra"),        ("Jubail", "Al Fanateer"),
]
EMPLOYERS = [
    "Saudi Aramco", "SABIC", "Saudi Telecom (STC)", "NCB (Al Ahli Bank)",
    "Al Rajhi Bank", "Saudi Electricity Company", "NEOM", "Vision 2030 Office",
    "Ministry of Health", "Ministry of Education", "Riyadh Municipality",
    "Saudi Airlines", "Emaar Saudi", "Jarir Bookstore", "Noon Group",
    "Extra Stores", "Panda Retail", "Al Othaim Markets", "Abdul Latif Jameel",
    "Olayan Group", "Al Faisaliah Group", "Dar Al Arkan", "Kingdom Holding",
    "Saudi Post", "ZATCA", "PIF", "King Faisal Hospital", "Saudi German Hospital",
    "G4S Saudi Arabia", "Saudi Ground Services", "Almarai", "Advanced Electronics",
    "Saudi Binladin Group", "SASO", "Ministry of Finance",
]
EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com"]

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCT CONFIGURATION  (client data: LCDPD Apr 2026 + PDF Dashboard)
# ═══════════════════════════════════════════════════════════════════════════════

PRODUCTS      = ["Cash Loan", "Other Partners", "Noon", "Jarir", "Premium Partners"]
PRODUCT_WGTS  = [0.76,        0.10,             0.05,   0.07,    0.02             ]

# NPA% per product (from client LCDPD file — accounts in NPA+WO buckets / total)
PRODUCT_NPA   = {
    "Jarir":             0.110,
    "Premium Partners":  0.146,
    "Noon":              0.005,
    "Other Partners":    0.083,
    "Cash Loan":         0.104,
}

# Principal amount ranges (SAR) per product
PRINCIPAL_RNG = {
    "Cash Loan":         (10_000, 500_000),
    "Jarir":             ( 5_000,  80_000),
    "Premium Partners":  (15_000, 300_000),
    "Noon":              ( 3_000,  50_000),
    "Other Partners":    ( 5_000, 150_000),
}

# ═══════════════════════════════════════════════════════════════════════════════
# DPD BUCKET CONFIGURATION  (client data: Agent Target files)
# ═══════════════════════════════════════════════════════════════════════════════

BUCKETS = [
    "0 Days", "1-30 Days", "31-60 Days", "61-90 Days",
    "NPA 91-180", "NPA 181-360", "NPA 361-450", "Write-Off"
]

# Non-NPA bucket sub-weights (normalised from overall: 60/22/6/3)
NON_NPA_WGTS = [0.659, 0.242, 0.066, 0.033]
# NPA+WO sub-weights across the four bad buckets
NPA_WGTS     = [0.44,  0.28,  0.17,  0.11 ]

DPD_RANGE = {
    "0 Days":      (0,   0),
    "1-30 Days":   (1,   30),
    "31-60 Days":  (31,  60),
    "61-90 Days":  (61,  90),
    "NPA 91-180":  (91,  180),
    "NPA 181-360": (181, 360),
    "NPA 361-450": (361, 450),
    "Write-Off":   (451, 600),
}
IS_NPA = {b: i >= 4 for i, b in enumerate(BUCKETS)}

# Beta distribution params for ptp_kept_ratio — (alpha, beta)
# Higher alpha relative to beta → skewed towards kept PTPs (good payers)
BETA_PARAMS = {
    "0 Days":      (8, 2),
    "1-30 Days":   (6, 3),
    "31-60 Days":  (4, 4),
    "61-90 Days":  (3, 5),
    "NPA 91-180":  (2, 6),
    "NPA 181-360": (2, 8),
    "NPA 361-450": (1, 9),
    "Write-Off":   (1, 12),
}

# ═══════════════════════════════════════════════════════════════════════════════
# AGENT ROSTER  (from Agent Target Apr 2026 & Collection Activity Oct 2025)
# ═══════════════════════════════════════════════════════════════════════════════

BUCKET_AGENTS = {
    "0 Days": (
        ["A-1-30"],
        ["Amal Hamoud Alotaibi"],
    ),
    "1-30 Days": (
        ["A-1-30"],
        ["Amal Hamoud Alotaibi"],
    ),
    "31-60 Days": (
        ["IVR PKT-2", "Hala Salem Alqahtani", "Samar Fahad Alharbi"],
        ["Amal Hamoud Alotaibi", "Ahmed Alshammari"],
    ),
    "61-90 Days": (
        ["Manal Sami Almusaad", "Fozyah Abdulaziz Alkhulifi",
         "Mohammed Saleh Aldalbahi", "IVR-61-90"],
        ["Amal Hamoud Alotaibi", "Ahmed Alshammari"],
    ),
    "NPA 91-180": (
        ["Manal Salem Madi", "Mohammed Aedh Alharthi",
         "Fotoon Abdullah Khathran", "Atheer Alhwasheil", "IVR-NPA 91-180"],
        ["Ahmed Alshammari", "Amal Hamoud Alotaibi"],
    ),
    "NPA 181-360": (
        ["Hajir Obaid Al-Otaibi", "Faez Abdualh Satem Mohamed",
         "Ibrahim Abyan", "Abdulrahman Bakheet Al Otaibi", "IVR-181-360"],
        ["Ahmed Alshammari", "Amal Hamoud Alotaibi"],
    ),
    "NPA 361-450": (
        ["Sultan Fahad Alinzee", "Sarah Abdulaziz Aljurayyad", "IVR-361-450"],
        ["Amal Hamoud Alotaibi"],
    ),
    "Write-Off": (
        ["Amjd Ibrahim Al-Hazmi", "Fahad Laili Obaid AlMarei",
         "Mishaal Suleiman Alsaeed", "Khalid Aytim Alanazi",
         "Fahad Abdulaziz Alateeq", "Trad Khaled Alharbi",
         "Suleiman Alhodhaif", "Nawaf Suliman Aldayel", "IVR-Write Off"],
        ["Ahmed Alshammari", "Amal Hamoud Alotaibi"],
    ),
}

# Collection target % per bucket (from Agent Target Apr 2026)
TARGET_PCT = {
    "0 Days":      0.00,
    "1-30 Days":   0.10,   # rollforward ≤ 10%
    "31-60 Days":  0.25,   # rollforward ≤ 25%
    "61-90 Days":  0.30,   # rollforward ≤ 30%
    "NPA 91-180":  0.25,   # rollback 25%
    "NPA 181-360": 0.07,   # 7% of overdue
    "NPA 361-450": 0.05,   # 5% of overdue
    "Write-Off":   0.01,   # 1% recovery
}

# ═══════════════════════════════════════════════════════════════════════════════
# GENERATOR HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def date_str(d) -> str:
    return d.strftime("%Y-%m-%d") if d else ""

def rand_date(start: datetime, end: datetime) -> datetime:
    delta = max((end - start).days, 0)
    return start + timedelta(days=random.randint(0, delta))

def gen_name() -> str:
    if random.random() < 0.65:
        first = random.choice(FIRST_NAMES_M)
    else:
        first = random.choice(FIRST_NAMES_F)
    mid  = random.choice(FATHER_NAMES)
    last = random.choice(LAST_NAMES)
    return f"{first} {mid} {last}"

def gen_email(name: str) -> str:
    clean = name.lower().replace("'", "").replace("-", "").replace(" ", ".")
    parts = clean.split(".")
    local = f"{parts[0]}{parts[-1]}{random.randint(10, 999)}"
    return f"{local}@{random.choice(EMAIL_DOMAINS)}"

def gen_mobile() -> str:
    # Saudi mobile: +966 5X XXXXXXX (operators: 50/53/54/55/56/57/58/59)
    op   = random.choice(["50", "53", "54", "55", "56", "57", "58", "59"])
    rest = "".join(str(random.randint(0, 9)) for _ in range(7))
    return f"+966{op}{rest}"

def gen_national_id() -> str:
    # 1XXXXXXXXX = Saudi National ID, 2XXXXXXXXX = Iqama (resident)
    prefix = "1" if random.random() < 0.85 else "2"
    return prefix + "".join(str(random.randint(0, 9)) for _ in range(9))

def pick_bucket(product: str) -> str:
    """Assign DPD bucket respecting per-product NPA rates."""
    is_npa = random.random() < PRODUCT_NPA[product]
    if is_npa:
        return random.choices(BUCKETS[4:], weights=NPA_WGTS)[0]
    return random.choices(BUCKETS[:4], weights=NON_NPA_WGTS)[0]

def calc_ptp_score(dpd: int, ptp_kept_ratio: float, num_overdue: int) -> int:
    """300–850 propensity score, correlated with payment behaviour."""
    dpd_factor     = 1.0 - min(dpd / 600, 1.0)
    overdue_factor = 1.0 - min(num_overdue / 20, 1.0)
    kept_factor    = float(ptp_kept_ratio)
    combined = 0.50 * dpd_factor + 0.30 * overdue_factor + 0.20 * kept_factor
    combined = float(np.clip(combined + np.random.normal(0, 0.04), 0.0, 1.0))
    return int(300 + combined * 550)

def calc_broken_risk(dpd: int, ptp_kept_ratio: float) -> float:
    """0.0–1.0 risk of breaking a PTP, anticorrelated with ptp_kept_ratio."""
    base  = 0.05 + (dpd / 600) * 0.65 + (1.0 - float(ptp_kept_ratio)) * 0.35
    noise = float(np.random.normal(0, 0.04))
    return round(float(np.clip(base + noise, 0.0, 1.0)), 3)

def calc_risk_tier(score: int) -> str:
    if score >= 700: return "Low Risk"
    if score >= 550: return "Medium Risk"
    if score >= 400: return "High Risk"
    return "Very High Risk"

def calc_recommended_channel(dpd: int, bucket: str, score: int) -> str:
    if dpd > 360 or bucket == "Write-Off":
        return random.choices(
            ["Legal Notice", "Field Visit"], weights=[0.60, 0.40])[0]
    if dpd > 90:
        return random.choices(
            ["Outbound Call", "Field Visit", "Legal Notice"],
            weights=[0.50, 0.30, 0.20])[0]
    if score >= 650:
        return random.choices(
            ["SMS/WhatsApp", "Outbound Call"], weights=[0.60, 0.40])[0]
    return random.choices(
        ["Outbound Call", "SMS/WhatsApp"], weights=[0.70, 0.30])[0]

def calc_legal(dpd: int):
    """Returns (legal_status, last_legal_action_date, legal_action_type)."""
    if dpd == 0:
        return "Normal", "", ""
    if dpd <= 90:
        return "Delinquent", "", ""
    if dpd <= 270:
        days_ago = random.randint(10, max(10, dpd - 90))
        ld = date_str(TODAY - timedelta(days=days_ago))
        return "Delinquent", ld, "Article 46"
    if dpd <= 450:
        ld = date_str(TODAY - timedelta(days=random.randint(10, 180)))
        lt = random.choice(["Article 34", "Court Grace Period"])
        return "Enforcement", ld, lt
    ld = date_str(TODAY - timedelta(days=random.randint(30, 365)))
    lt = random.choice(["Court Grace Period", "Case Closure"])
    return "Enforcement", ld, lt

def calc_sadad(dpd: int) -> str:
    if dpd == 0:
        return random.choices(["Active", "Inactive"],          weights=[0.85, 0.15])[0]
    if dpd <= 90:
        return random.choices(["Active", "Inactive", "Pending"], weights=[0.50, 0.30, 0.20])[0]
    return random.choices(["Inactive", "Pending"],             weights=[0.70, 0.30])[0]

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN GENERATION LOOP
# ═══════════════════════════════════════════════════════════════════════════════

print(f"Generating {N:,} synthetic accounts ...")
records = []

for i in range(1, N + 1):

    # ── Identity ──────────────────────────────────────────────────────────────
    loan_id         = f"WFC-{i:06d}"
    national_id     = gen_national_id()
    contract_number = f"CNT-{random.randint(10_000_000, 99_999_999)}"
    name            = gen_name()
    mobile          = gen_mobile()
    email           = gen_email(name)
    employer        = random.choice(EMPLOYERS)
    city, district  = random.choice(CITIES)
    nat_address     = f"{district}, {city}"

    # ── Product & bucket ──────────────────────────────────────────────────────
    product         = random.choices(PRODUCTS, weights=PRODUCT_WGTS)[0]
    bucket          = pick_bucket(product)
    dpd_lo, dpd_hi  = DPD_RANGE[bucket]
    dpd             = random.randint(dpd_lo, dpd_hi)
    is_npa          = IS_NPA[bucket]

    starter_type    = "Non-Starter" if random.random() < 0.035 else "Normal"
    rac_status      = "Closed" if random.random() < 0.08 else "Current"

    if bucket == "Write-Off":
        acc_status = "Written-Off"
    elif is_npa or dpd > 30:
        acc_status = "Delinquent"
    elif dpd > 0:
        acc_status = random.choices(["Delinquent", "Active"], weights=[0.85, 0.15])[0]
    else:
        acc_status = random.choices(["Active", "Closed"], weights=[0.95, 0.05])[0]

    # ── Financial core ────────────────────────────────────────────────────────
    p_lo, p_hi    = PRINCIPAL_RNG[product]
    # Round to nearest SAR 500 for realism
    principal     = round(random.uniform(p_lo, p_hi) / 500) * 500
    profit_rate   = round(random.uniform(0.15, 0.25), 4)
    profit        = round(principal * profit_rate, 2)
    total_finance = round(principal + profit, 2)

    tenure_choices = [6, 9, 12, 18, 24, 36, 48, 60]
    num_inst      = random.choice(tenure_choices)
    inst_amt      = round(total_finance / num_inst, 2)

    # Origination date: derive from how long the account has been open
    # At minimum the account must be old enough for the DPD accrued
    min_months = max(3, (dpd // 30) + 1)
    extra_months   = max(0, min(24, num_inst - min_months + 1))
    months_on_book = min_months + random.randint(0, extra_months)
    orig_date      = TODAY - timedelta(days=months_on_book * 30)
    first_inst_dt  = orig_date + timedelta(days=30)
    last_inst_dt   = first_inst_dt + timedelta(days=num_inst * 30)

    # Paid installments: consistent with months_on_book and DPD
    overdue_months = dpd // 30
    theoretical_paid = max(0, months_on_book - overdue_months - 1)
    if starter_type == "Non-Starter":
        num_paid = 0
    elif bucket == "Write-Off":
        num_paid = random.randint(0, min(3, num_inst))
    else:
        lo = max(0, theoretical_paid - 2)
        hi = min(theoretical_paid + 1, num_inst)
        num_paid = random.randint(lo, hi)
    num_paid = min(num_paid, num_inst)

    total_paid     = round(inst_amt * num_paid, 2)

    # Outstanding (exact: total_finance - total_paid)
    outstanding    = round(max(0.0, total_finance - total_paid), 2)

    # Proportional split: principal amortises faster in early instalments (≈ 0.9× rate vs profit)
    p_frac         = (principal / total_finance) if total_finance > 0 else 0.8
    rem_principal  = round(outstanding * p_frac, 2)
    rem_profit     = round(outstanding - rem_principal, 2)

    # Overdue instalments
    num_overdue    = min(max(0, overdue_months), num_inst - num_paid)
    overdue_amt    = round(inst_amt * num_overdue, 2)
    princ_overdue  = round(overdue_amt * p_frac, 2)
    profit_overdue = round(overdue_amt - princ_overdue, 2)

    coll_fees      = round(overdue_amt * random.uniform(0.0, 0.02), 2)
    excess_amt     = round(random.uniform(10, 300), 2) if random.random() < 0.04 else 0.0
    salary         = round(random.uniform(3_000, 45_000) / 100) * 100

    # Dates
    if num_paid > 0:
        last_pay_dt = TODAY - timedelta(days=dpd + random.randint(0, 15))
        last_pay_dt = max(last_pay_dt, first_inst_dt)
    elif dpd == 0:
        last_pay_dt = TODAY - timedelta(days=random.randint(1, 28))
    else:
        last_pay_dt = None

    # ── Collections intelligence ──────────────────────────────────────────────
    if bucket == "0 Days":
        ptp_count = 0
    elif bucket == "1-30 Days":
        ptp_count = random.randint(0, 2)
    elif bucket in ("31-60 Days", "61-90 Days"):
        ptp_count = random.randint(1, 5)
    else:
        ptp_count = random.randint(2, 15)

    a, b          = BETA_PARAMS[bucket]
    kept_ratio    = round(float(np.random.beta(a, b)), 3) if ptp_count > 0 else 1.0
    broken_ptps   = max(0, ptp_count - round(ptp_count * kept_ratio))

    call_attempts = (random.randint(0, 3) if dpd == 0
                     else random.randint(1, 50))
    days_since    = (random.randint(0, 5) if dpd == 0
                     else min(dpd, random.randint(1, 30)))
    last_contact  = TODAY - timedelta(days=days_since)

    # Build realistic channel history
    ch_hist = ["SMS"]
    if call_attempts > 2:
        ch_hist.append("Outbound Call")
    if is_npa:
        ch_hist.append("NABA")
    if dpd > 90 and random.random() < 0.4:
        ch_hist.append("Push Notification")
    if dpd > 180:
        ch_hist.append("Field Visit")
    if dpd > 360:
        ch_hist.append("Legal Notice")
    contact_ch_json = json.dumps(sorted(set(ch_hist)))

    best_time     = random.choice(["Morning", "Afternoon", "Evening"])

    # ── ML scores ─────────────────────────────────────────────────────────────
    ptp_score     = calc_ptp_score(dpd, kept_ratio, num_overdue)
    b_risk        = calc_broken_risk(dpd, kept_ratio)
    risk_tier     = calc_risk_tier(ptp_score)
    rec_channel   = calc_recommended_channel(dpd, bucket, ptp_score)

    # ── Legal ─────────────────────────────────────────────────────────────────
    leg_status, leg_date, leg_type = calc_legal(dpd)

    # ── SADAD ─────────────────────────────────────────────────────────────────
    sadad = calc_sadad(dpd)

    # ── Agent assignment ──────────────────────────────────────────────────────
    agents_pool, sup_pool = BUCKET_AGENTS[bucket]
    agent      = random.choice(agents_pool)
    supervisor = random.choice(sup_pool)

    # Target = % of overdue (NPA) or outstanding (early buckets)
    target_base = overdue_amt if is_npa else outstanding
    target_amt  = round(target_base * TARGET_PCT[bucket], 2)

    # ── Append record ─────────────────────────────────────────────────────────
    records.append({
        # Account identity
        "loan_id":                   loan_id,
        "national_id":               national_id,
        "contract_number":           contract_number,
        "customer_name":             name,
        "mobile_number":             mobile,
        "email":                     email,
        "employer":                  employer,
        "national_address":          nat_address,

        # Product & status
        "product_type":              product,
        "account_status":            acc_status,
        "starter_type":              starter_type,
        "rac_status":                rac_status,

        # Financial
        "principal_amount":          principal,
        "profit_amount":             profit,
        "profit_rate_pct":           round(profit_rate * 100, 2),
        "total_finance_amount":      total_finance,
        "num_installments":          num_inst,
        "installment_amount":        inst_amt,
        "num_paid_installments":     num_paid,
        "total_paid":                total_paid,
        "remaining_principal":       rem_principal,
        "remaining_profit":          rem_profit,
        "outstanding_balance":       outstanding,
        "num_overdue_installments":  num_overdue,
        "overdue_amount":            overdue_amt,
        "principal_overdue":         princ_overdue,
        "profit_overdue":            profit_overdue,
        "collection_fees":           coll_fees,
        "excess_amount":             excess_amt,
        "salary":                    salary,

        # Dates
        "origination_date":          date_str(orig_date),
        "first_installment_date":    date_str(first_inst_dt),
        "last_installment_date":     date_str(last_inst_dt),
        "last_payment_date":         date_str(last_pay_dt),
        "months_on_book":            months_on_book,

        # DPD
        "dpd":                       dpd,
        "dpd_bucket":                bucket,

        # Collections intelligence
        "ptp_count":                 ptp_count,
        "ptp_kept_ratio":            kept_ratio,
        "broken_ptp_count":          broken_ptps,
        "last_contact_date":         date_str(last_contact),
        "call_attempts":             call_attempts,
        "contact_channel_history":   contact_ch_json,
        "best_contact_time":         best_time,
        "days_since_last_contact":   days_since,

        # ML scores
        "ptp_propensity_score":      ptp_score,
        "broken_ptp_risk":           b_risk,
        "recommended_channel":       rec_channel,
        "ml_risk_tier":              risk_tier,

        # Legal
        "legal_status":              leg_status,
        "last_legal_action_date":    leg_date,
        "legal_action_type":         leg_type,

        # SADAD
        "sadad_payment_status":      sadad,

        # Agent targets
        "assigned_agent":            agent,
        "assigned_supervisor":       supervisor,
        "target_amount":             target_amt,
        "rollforward_target_pct":    TARGET_PCT[bucket],
    })

# ═══════════════════════════════════════════════════════════════════════════════
# SME ACCOUNTS  (23 accounts matching client LCDPD data)
# Distribution: 2 at 0 Days, 21 NPA (94.62% NPA per client data)
# All SME: starter_type=Normal, rac_status=Closed, product_type=SME
# ═══════════════════════════════════════════════════════════════════════════════

SME_EMPLOYERS = [
    "Al Faisaliah Group", "Olayan Group", "Abdul Latif Jameel",
    "Kingdom Holding", "Dar Al Arkan", "Saudi Binladin Group",
    "Almana Group", "Al Suwaidi Group", "Al Babtain Group",
    "Al Muhaidib Group", "Xenel Industries", "Rezayat Group",
    "Al Jomaih Group", "Al Gosaibi Group", "Rawabi Holding",
    "Al Khorayef Group", "Al Zamil Group", "Abdul Karim Group",
    "Mohamed Al Subeaei", "Al Rashed Group", "Algosaibi Trading",
    "Al Issa Group", "Al Hokair Group",
]

# 2 current (0 Days), then NPA split across 91-180 / 181-360 / 361-450
SME_BUCKET_PLAN = (
    ["0 Days"] * 2 +
    ["NPA 91-180"] * 9 +
    ["NPA 181-360"] * 6 +
    ["NPA 361-450"] * 4 +
    ["NPA 91-180", "NPA 181-360"]   # fill to 23
)

sme_records = []
for idx, sme_bucket in enumerate(SME_BUCKET_PLAN, start=1):
    loan_id     = f"WFC-SME-{idx:05d}"
    name        = gen_name()
    employer    = SME_EMPLOYERS[(idx - 1) % len(SME_EMPLOYERS)]
    city, district = random.choice(CITIES)

    dpd_lo, dpd_hi = DPD_RANGE[sme_bucket]
    dpd            = random.randint(dpd_lo, dpd_hi)
    is_npa         = IS_NPA[sme_bucket]

    principal = round(random.uniform(500_000, 5_000_000) / 1000) * 1000
    profit_rate   = round(random.uniform(0.12, 0.20), 4)
    profit        = round(principal * profit_rate, 2)
    total_finance = round(principal + profit, 2)
    num_inst      = random.choice([24, 36, 48, 60])
    inst_amt      = round(total_finance / num_inst, 2)

    overdue_months    = dpd // 30
    months_on_book    = max(overdue_months + 3, num_inst // 2)
    orig_date         = TODAY - timedelta(days=months_on_book * 30)
    first_inst_dt     = orig_date + timedelta(days=30)
    last_inst_dt      = first_inst_dt + timedelta(days=num_inst * 30)

    theoretical_paid  = max(0, months_on_book - overdue_months - 1)
    num_paid          = max(0, min(theoretical_paid, num_inst))
    total_paid        = round(inst_amt * num_paid, 2)
    outstanding       = round(max(0.0, total_finance - total_paid), 2)

    p_frac        = (principal / total_finance) if total_finance > 0 else 0.8
    rem_principal = round(outstanding * p_frac, 2)
    rem_profit    = round(outstanding - rem_principal, 2)

    num_overdue   = min(max(0, overdue_months), num_inst - num_paid)
    # NPA SME: overdue_amount = 100% of outstanding (client spec)
    if is_npa:
        overdue_amt = outstanding
    else:
        overdue_amt = round(inst_amt * num_overdue, 2)
    princ_overdue  = round(overdue_amt * p_frac, 2)
    profit_overdue = round(overdue_amt - princ_overdue, 2)

    if sme_bucket == "0 Days":
        acc_status = "Active"
        ptp_count  = 0
        last_pay_dt = TODAY - timedelta(days=random.randint(1, 28))
    else:
        acc_status = "Delinquent"
        ptp_count  = random.randint(2, 10)
        last_pay_dt = TODAY - timedelta(days=dpd + random.randint(0, 15))

    a, b_     = BETA_PARAMS[sme_bucket]
    kept_ratio = round(float(np.random.beta(a, b_)), 3) if ptp_count > 0 else 1.0
    broken_ptps = max(0, ptp_count - round(ptp_count * kept_ratio))

    call_attempts = random.randint(1, 20) if dpd > 0 else random.randint(0, 3)
    days_since    = min(dpd, random.randint(1, 30)) if dpd > 0 else random.randint(0, 5)
    last_contact  = TODAY - timedelta(days=days_since)

    ch_hist = ["SMS", "Outbound Call"]
    if is_npa:
        ch_hist += ["NABA", "Field Visit"]
    if dpd > 180:
        ch_hist.append("Legal Notice")

    ptp_score   = calc_ptp_score(dpd, kept_ratio, num_overdue)
    b_risk      = calc_broken_risk(dpd, kept_ratio)
    risk_tier   = calc_risk_tier(ptp_score)
    rec_channel = calc_recommended_channel(dpd, sme_bucket, ptp_score)
    leg_status, leg_date, leg_type = calc_legal(dpd)
    sadad       = calc_sadad(dpd)

    agents_pool, sup_pool = BUCKET_AGENTS[sme_bucket]
    agent      = random.choice(agents_pool)
    supervisor = random.choice(sup_pool)
    salary     = round(random.uniform(15_000, 80_000) / 100) * 100

    target_base = overdue_amt if is_npa else outstanding
    target_amt  = round(target_base * TARGET_PCT[sme_bucket], 2)

    sme_records.append({
        "loan_id":                   loan_id,
        "national_id":               gen_national_id(),
        "contract_number":           f"CNT-{random.randint(10_000_000, 99_999_999)}",
        "customer_name":             name,
        "mobile_number":             gen_mobile(),
        "email":                     gen_email(name),
        "employer":                  employer,
        "national_address":          f"{district}, {city}",
        "product_type":              "SME",
        "account_status":            acc_status,
        "starter_type":              "Normal",
        "rac_status":                "Closed",
        "principal_amount":          principal,
        "profit_amount":             profit,
        "profit_rate_pct":           round(profit_rate * 100, 2),
        "total_finance_amount":      total_finance,
        "num_installments":          num_inst,
        "installment_amount":        inst_amt,
        "num_paid_installments":     num_paid,
        "total_paid":                total_paid,
        "remaining_principal":       rem_principal,
        "remaining_profit":          rem_profit,
        "outstanding_balance":       outstanding,
        "num_overdue_installments":  num_overdue,
        "overdue_amount":            overdue_amt,
        "principal_overdue":         princ_overdue,
        "profit_overdue":            profit_overdue,
        "collection_fees":           round(overdue_amt * random.uniform(0.0, 0.01), 2),
        "excess_amount":             0.0,
        "salary":                    salary,
        "origination_date":          date_str(orig_date),
        "first_installment_date":    date_str(first_inst_dt),
        "last_installment_date":     date_str(last_inst_dt),
        "last_payment_date":         date_str(last_pay_dt),
        "months_on_book":            months_on_book,
        "dpd":                       dpd,
        "dpd_bucket":                sme_bucket,
        "ptp_count":                 ptp_count,
        "ptp_kept_ratio":            kept_ratio,
        "broken_ptp_count":          broken_ptps,
        "last_contact_date":         date_str(last_contact),
        "call_attempts":             call_attempts,
        "contact_channel_history":   json.dumps(sorted(set(ch_hist))),
        "best_contact_time":         random.choice(["Morning", "Afternoon", "Evening"]),
        "days_since_last_contact":   days_since,
        "ptp_propensity_score":      ptp_score,
        "broken_ptp_risk":           b_risk,
        "recommended_channel":       rec_channel,
        "ml_risk_tier":              risk_tier,
        "legal_status":              leg_status,
        "last_legal_action_date":    leg_date,
        "legal_action_type":         leg_type,
        "sadad_payment_status":      sadad,
        "assigned_agent":            agent,
        "assigned_supervisor":       supervisor,
        "target_amount":             target_amt,
        "rollforward_target_pct":    TARGET_PCT[sme_bucket],
    })

records.extend(sme_records)
print(f"Added {len(sme_records)} SME accounts (total: {len(records):,})")

# ═══════════════════════════════════════════════════════════════════════════════
# BUILD & SAVE
# ═══════════════════════════════════════════════════════════════════════════════

df = pd.DataFrame(records)
df.to_csv(OUT_PATH, index=False)

print(f"[OK] Saved {len(df):,} rows x {len(df.columns)} columns -> {OUT_PATH}\n")

# ── Validation report ───────────────────────────────────────────────────────────
SEP = "-" * 58

print(SEP)
print("BUCKET DISTRIBUTION (target: 0D~60%, 1-30~22%, 31-60~6%, 61-90~3%, NPA~8%, WO~1%)")
print(SEP)
bkt     = df["dpd_bucket"].value_counts().reindex(BUCKETS, fill_value=0)
bkt_pct = bkt / len(df) * 100
for b in BUCKETS:
    print(f"  {b:<22s}: {bkt[b]:>5,}  ({bkt_pct[b]:5.1f}%)")

print()
print(SEP)
print("PRODUCT DISTRIBUTION (target: CL~76%, OP~10%, J~7%, N~5%, PP~2%)")
print(SEP)
prd = df["product_type"].value_counts()
for p in PRODUCTS:
    print(f"  {p:<22s}: {prd.get(p,0):>5,}  ({prd.get(p,0)/len(df)*100:5.1f}%)")

print()
print(SEP)
print("NPA% BY PRODUCT (target: CashLoan~10.4%, Jarir~11%, PP~14.6%, Noon~0.5%, OtherP~8.3%)")
print(SEP)
NPA_BUCKETS = ["NPA 91-180","NPA 181-360","NPA 361-450","Write-Off"]
for prod in PRODUCTS:
    prod_df = df[df["product_type"] == prod]
    actual  = prod_df["dpd_bucket"].isin(NPA_BUCKETS).mean() * 100
    target  = PRODUCT_NPA[prod] * 100
    delta   = actual - target
    flag    = "[OK]" if abs(delta) < 3 else "[~~]"
    print(f"  {prod:<22s}: actual={actual:5.1f}%  target={target:5.1f}%  delta={delta:+.1f}%  {flag}")

print()
print(SEP)
print("FINANCIAL SUMMARY")
print(SEP)
print(f"  Principal range  : SAR {df['principal_amount'].min():>10,.0f} to {df['principal_amount'].max():>10,.0f}")
print(f"  Outstanding range: SAR {df['outstanding_balance'].min():>10,.0f} to {df['outstanding_balance'].max():>10,.0f}")
print(f"  Total portfolio  : SAR {df['outstanding_balance'].sum():>14,.0f}")
print(f"  Total overdue    : SAR {df['overdue_amount'].sum():>14,.0f}")
print(f"  Avg overdue      : SAR {df['overdue_amount'].mean():>10,.0f}")
print(f"  Salary range     : SAR {df['salary'].min():>10,.0f} to {df['salary'].max():>10,.0f}")

diff     = ((df["remaining_principal"] + df["remaining_profit"]) - df["outstanding_balance"]).abs()
max_diff = diff.max()
ok_flag  = "[OK]" if max_diff < 1 else "[FAIL]"
print(f"  Financial consistency (rem_p + rem_profit == outstanding): max diff SAR {max_diff:.2f}  {ok_flag}")

print()
print(SEP)
print("ML SCORE RANGES")
print(SEP)
print(f"  PTP propensity score: {df['ptp_propensity_score'].min()} to {df['ptp_propensity_score'].max()}  "
      f"mean={df['ptp_propensity_score'].mean():.0f}")
print(f"  Broken PTP risk:      {df['broken_ptp_risk'].min():.3f} to {df['broken_ptp_risk'].max():.3f}  "
      f"mean={df['broken_ptp_risk'].mean():.3f}")
for t, cnt in df["ml_risk_tier"].value_counts().items():
    print(f"  {t:<22s}: {cnt:>5,}  ({cnt/len(df)*100:.1f}%)")

print()
print(SEP)
print("SEGMENTATION")
print(SEP)
print(f"  Non-Starter: {(df['starter_type']=='Non-Starter').mean()*100:.1f}%  (target ~3.5%)")
print(f"  Closed RAC : {(df['rac_status']=='Closed').mean()*100:.1f}%  (target ~8.0%)")
print(f"  Written-Off: {(df['account_status']=='Written-Off').mean()*100:.1f}%")

print()
print(SEP)
print("RECOMMENDED CHANNELS")
print(SEP)
for ch, cnt in df["recommended_channel"].value_counts().items():
    print(f"  {ch:<22s}: {cnt:>5,}  ({cnt/len(df)*100:.1f}%)")

print()
print(SEP)
print(f"[OK] Validation complete -- {len(df.columns)} columns, {len(df):,} rows")
print(SEP)
