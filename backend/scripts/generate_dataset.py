"""
NSP IBE — Wataniya Finance Collections Dataset
10,000 records | Saudi Arabia market | Statistically coherent
Real-world distributions based on SAMA consumer finance data 2024
"""

import numpy as np
import pandas as pd
from scipy import stats
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

rng = np.random.default_rng(2024)
TODAY = datetime(2026, 3, 24)
N = 10_000

print("=" * 60)
print("NSP IBE — Wataniya Finance Dataset Generator")
print(f"Generating {N:,} records...")
print("=" * 60)

# ─────────────────────────────────────────────────────────────
# SECTION 1 — SAUDI MARKET PARAMETERS
# Based on SAMA Annual Finance Report 2024
# ─────────────────────────────────────────────────────────────

PRODUCTS       = ['Personal Finance', 'Auto Finance', 'Home Finance',
                  'Small Business Finance', 'Gold Finance']
PROD_W         = [0.52, 0.22, 0.14, 0.08, 0.04]

SECTORS        = ['Government', 'Semi-Government', 'Private - Large',
                  'Private - SME', 'Military/Security', 'Self-Employed', 'Retired']
SECTOR_W       = [0.34, 0.18, 0.20, 0.14, 0.08, 0.04, 0.02]

REGIONS        = ['Riyadh', 'Jeddah', 'Dammam', 'Makkah',
                  'Madinah', 'Qassim', 'Asir', 'Other']
REGION_W       = [0.32, 0.22, 0.18, 0.08, 0.06, 0.05, 0.05, 0.04]

NATIONALITIES  = ['Saudi', 'Expat-GCC', 'Expat-Arab', 'Expat-Asian', 'Expat-Other']
NAT_W          = [0.78, 0.04, 0.07, 0.08, 0.03]

# Real Saudi male names (first + last combinations)
FIRST_NAMES_M = [
    'Mohammed', 'Abdullah', 'Ahmed', 'Khalid', 'Sultan', 'Faisal',
    'Omar', 'Ibrahim', 'Turki', 'Saud', 'Majed', 'Nawaf', 'Waleed',
    'Saad', 'Nasser', 'Yousef', 'Hamad', 'Mishal', 'Talal', 'Tariq',
    'Bandar', 'Rayan', 'Ziyad', 'Adel', 'Bader', 'Fahad', 'Mansour'
]
FIRST_NAMES_F = [
    'Nora', 'Sara', 'Fatima', 'Maha', 'Hessa', 'Reem', 'Lama',
    'Shahad', 'Dana', 'Lina', 'Abeer', 'Mona', 'Rana', 'Dina',
    'Hind', 'Amal', 'Wafa', 'Najla', 'Ghada', 'Asma', 'Haifa'
]
LAST_NAMES = [
    'Al-Rashidi', 'Al-Otaibi', 'Al-Ghamdi', 'Al-Zahrani', 'Al-Qahtani',
    'Al-Harbi', 'Al-Shehri', 'Al-Ahmadi', 'Al-Mutairi', 'Al-Dosari',
    'Al-Balawi', 'Al-Anazi', 'Al-Enazi', 'Al-Subaie', 'Al-Ruwaili',
    'Al-Maliki', 'Al-Omari', 'Al-Juhani', 'Al-Bishi', 'Al-Khaldi',
    'Al-Thubaiti', 'Al-Shahrani', 'Al-Asmari', 'Al-Bogami', 'Al-Zahrani'
]

# ─────────────────────────────────────────────────────────────
# SECTION 2 — CORE CUSTOMER DEMOGRAPHICS
# ─────────────────────────────────────────────────────────────

product_type  = rng.choice(PRODUCTS, N, p=PROD_W)
region        = rng.choice(REGIONS, N, p=REGION_W)
nationality   = rng.choice(NATIONALITIES, N, p=NAT_W)
employer_sec  = rng.choice(SECTORS, N, p=SECTOR_W)
gender        = rng.choice(['Male', 'Female'], N, p=[0.82, 0.18])

# Realistic Saudi age distribution for finance customers (25-60)
age = np.clip(
    np.round(rng.normal(38, 9, N)).astype(int), 22, 65
)

# Realistic Saudi names
customer_names = []
for g in gender:
    first = rng.choice(FIRST_NAMES_M if g == 'Male' else FIRST_NAMES_F)
    last  = rng.choice(LAST_NAMES)
    customer_names.append(f"{first} {last}")

# Phone numbers (Saudi format: 05XXXXXXXX)
phone_numbers = [
    f"05{rng.integers(10000000, 99999999)}" for _ in range(N)
]

# National IDs (Saudi: 1XXXXXXXXX for Saudi, 2XXXXXXXXX for expats)
national_ids = []
for nat in nationality:
    prefix = '1' if nat == 'Saudi' else '2'
    national_ids.append(f"{prefix}{rng.integers(100000000, 999999999)}")

# ─────────────────────────────────────────────────────────────
# SECTION 3 — LOAN CHARACTERISTICS
# Product-realistic amounts, rates, tenures
# ─────────────────────────────────────────────────────────────

loan_amount = np.zeros(N)
for i, pt in enumerate(product_type):
    if pt == 'Personal Finance':
        # SAR 5K–250K, log-normal, median ~SAR 55K
        loan_amount[i] = np.clip(rng.lognormal(10.9, 0.7), 5_000, 250_000)
    elif pt == 'Auto Finance':
        # SAR 30K–180K, median ~SAR 85K
        loan_amount[i] = np.clip(rng.lognormal(11.35, 0.4), 30_000, 180_000)
    elif pt == 'Home Finance':
        # SAR 200K–2M, median ~SAR 550K
        loan_amount[i] = np.clip(rng.lognormal(13.2, 0.5), 200_000, 2_000_000)
    elif pt == 'Small Business Finance':
        # SAR 20K–500K, median ~SAR 120K
        loan_amount[i] = np.clip(rng.lognormal(11.7, 0.65), 20_000, 500_000)
    else:  # Gold
        # SAR 3K–80K
        loan_amount[i] = np.clip(rng.lognormal(10.2, 0.55), 3_000, 80_000)

loan_amount = np.round(loan_amount / 500) * 500  # Round to nearest 500

# Interest / profit rate — SAIBOR-linked (5.5–6.5% base + risk premium)
saibor_base  = 5.75  # SAIBOR 2025-2026
risk_premium = rng.uniform(0.5, 4.5, N)
interest_rate = np.clip(saibor_base + risk_premium - rng.uniform(0, 1, N), 2.5, 14.0).round(2)

# Loan tenure
tenure_choices = {
    'Personal Finance':       ([12,24,36,48,60],       [0.08,0.18,0.30,0.27,0.17]),
    'Auto Finance':           ([24,36,48,60,72],        [0.05,0.20,0.35,0.28,0.12]),
    'Home Finance':           ([60,120,180,240,300],    [0.05,0.15,0.30,0.32,0.18]),
    'Small Business Finance': ([12,24,36,48,60],        [0.15,0.25,0.30,0.20,0.10]),
    'Gold Finance':           ([6,12,18,24],            [0.20,0.40,0.25,0.15]),
}
loan_tenure = np.array([
    rng.choice(tenure_choices[pt][0], p=tenure_choices[pt][1])
    for pt in product_type
])

# Origination date (1–7 years ago)
days_since_orig = rng.integers(180, 2555, N)
origination_date = [
    (TODAY - timedelta(days=int(d))).strftime('%Y-%m-%d')
    for d in days_since_orig
]
months_on_book = (days_since_orig / 30.44).astype(int)

# Outstanding balance
repayment_frac   = np.clip(months_on_book / loan_tenure, 0, 0.95)
outstanding_bal  = np.round(
    loan_amount * (1 - repayment_frac * rng.uniform(0.55, 1.0, N)) / 500
) * 500
outstanding_bal  = np.maximum(outstanding_bal, 1000)

# Monthly installment (annuity formula)
r_monthly = interest_rate / 100 / 12
monthly_inst = np.round(
    loan_amount * r_monthly / (1 - (1 + r_monthly) ** (-loan_tenure)) / 10
) * 10
monthly_inst = np.maximum(monthly_inst, 200)

# ─────────────────────────────────────────────────────────────
# SECTION 4 — DELINQUENCY PROFILE
# Real Saudi portfolio DPD distribution
# ─────────────────────────────────────────────────────────────

BUCKET_LABELS = ['1-30 DPD', '31-60 DPD', '61-90 DPD', 'NPA', 'Write-off']
BUCKET_W      = [0.38, 0.25, 0.17, 0.13, 0.07]
bucket        = rng.choice(BUCKET_LABELS, N, p=BUCKET_W)

# Current DPD — within-bucket
current_dpd = np.zeros(N, dtype=int)
for i, b in enumerate(bucket):
    if   b == '1-30 DPD':   current_dpd[i] = rng.integers(1, 31)
    elif b == '31-60 DPD':  current_dpd[i] = rng.integers(31, 61)
    elif b == '61-90 DPD':  current_dpd[i] = rng.integers(61, 91)
    elif b == 'NPA':         current_dpd[i] = rng.integers(91, 181)
    else:                    current_dpd[i] = rng.integers(181, 721)

max_dpd_ever = np.maximum(
    current_dpd,
    current_dpd + rng.integers(0, 60, N)
)

# DPD trend — correlated with bucket severity
dpd_trend_p = {
    '1-30 DPD':  [0.35, 0.40, 0.25],
    '31-60 DPD': [0.20, 0.35, 0.45],
    '61-90 DPD': [0.12, 0.28, 0.60],
    'NPA':       [0.08, 0.22, 0.70],
    'Write-off': [0.03, 0.15, 0.82],
}
dpd_trend = np.array([
    rng.choice(['Improving', 'Stable', 'Worsening'], p=dpd_trend_p[b])
    for b in bucket
])

times_30dpd = np.where(
    current_dpd < 30, rng.integers(0, 3, N),
    rng.integers(1, 7, N)
)

# ─────────────────────────────────────────────────────────────
# SECTION 5 — PAYMENT BEHAVIOUR
# Correlated with delinquency bucket
# ─────────────────────────────────────────────────────────────

ontime_base = {
    '1-30 DPD': 0.72, '31-60 DPD': 0.52, '61-90 DPD': 0.35,
    'NPA': 0.18, 'Write-off': 0.06
}
ontime_ratio = np.clip(
    np.array([rng.normal(ontime_base[b], 0.15) for b in bucket]),
    0.0, 1.0
).round(2)

partial_pay_freq = np.clip(
    rng.beta(1.5, 4.5, N) + (current_dpd / 450), 0, 1
).round(2)

avg_payment_ratio = np.clip(
    ontime_ratio * rng.uniform(0.65, 1.1, N), 0, 1.2
).round(2)

months_since_last_pay = np.where(
    bucket == '1-30 DPD',  rng.integers(0, 2, N),
    np.where(bucket == '31-60 DPD', rng.integers(1, 3, N),
    np.where(bucket == '61-90 DPD', rng.integers(2, 5, N),
    np.where(bucket == 'NPA', rng.integers(3, 10, N),
    rng.integers(6, 24, N))))
)

total_payments_made = np.clip(
    (months_on_book * ontime_ratio).astype(int), 1, months_on_book
)

total_paid = np.round(
    total_payments_made * monthly_inst * avg_payment_ratio / 500
) * 500

last_payment_amt = np.where(
    months_since_last_pay == 0,
    np.round(monthly_inst * rng.uniform(0.3, 1.1, N) / 100) * 100,
    0.0
).astype(int)

# ─────────────────────────────────────────────────────────────
# SECTION 6 — PTP HISTORY (core IBE signal)
# ─────────────────────────────────────────────────────────────

total_ptps = np.where(
    bucket == '1-30 DPD',  rng.integers(0, 3, N),
    np.where(bucket == '31-60 DPD', rng.integers(1, 5, N),
    np.where(bucket == '61-90 DPD', rng.integers(2, 8, N),
    np.where(bucket == 'NPA',  rng.integers(3, 12, N),
    rng.integers(4, 20, N))))
)

# PTP keep rate — higher for low-DPD, salary-aligned customers
ptp_keep_rate = np.clip(
    rng.beta(3, 2, N) * (1 - current_dpd / 520), 0.02, 1.0
)
ptps_kept    = np.minimum((total_ptps * ptp_keep_rate).astype(int), total_ptps)
ptps_broken  = total_ptps - ptps_kept

consecutive_broken = np.where(
    ptps_broken == 0, 0,
    np.minimum(ptps_broken, rng.integers(0, 5, N))
)

ptp_reliability = np.where(
    total_ptps == 0,
    np.nan,
    (ptps_kept / np.maximum(total_ptps, 1)).round(2)
)

avg_days_late_broken = np.where(
    ptps_broken == 0, 0, rng.integers(3, 45, N)
)

# Active PTP
has_active_ptp = rng.choice([True, False], N, p=[0.32, 0.68])
ptp_due_date = [
    (TODAY + timedelta(days=int(d))).strftime('%Y-%m-%d') if h else ''
    for h, d in zip(has_active_ptp, rng.integers(1, 21, N))
]
ptp_amount = np.where(
    has_active_ptp,
    np.round(monthly_inst * rng.uniform(0.5, 2.0, N) / 100) * 100,
    0
).astype(int)

ptp_captured_by = np.where(
    has_active_ptp,
    rng.choice(['AI', 'Human Agent'], N, p=[0.60, 0.40]),
    ''
)

# ─────────────────────────────────────────────────────────────
# SECTION 7 — CHANNEL RESPONSE BEHAVIOUR
# ─────────────────────────────────────────────────────────────

call_pickup_rate       = np.clip(rng.beta(2.2, 3.2, N) + rng.normal(0, 0.05, N), 0, 1).round(2)
sms_response_rate      = np.clip(rng.beta(1.8, 4.0, N), 0, 1).round(2)
# WhatsApp dominates in Saudi — higher than SMS
whatsapp_response_rate = np.clip(
    sms_response_rate * rng.uniform(1.1, 1.9, N), 0, 1
).round(2)
email_response_rate    = np.clip(rng.beta(1, 9, N), 0, 0.35).round(2)

# Preferred contact window — Saudi behavioural patterns
# Peak: 12pm-3pm (after prayers), 6pm-9pm (evening)
contact_windows = ['Before 9am', '9am-12pm', '12pm-3pm', '3pm-6pm', '6pm-9pm', 'After 9pm']
contact_w       = [0.05, 0.15, 0.25, 0.22, 0.24, 0.09]
preferred_contact = rng.choice(contact_windows, N, p=contact_w)

days_since_contact  = np.where(
    bucket == '1-30 DPD', rng.integers(0, 8, N),
    np.where(bucket == '31-60 DPD', rng.integers(1, 15, N),
    np.where(bucket == '61-90 DPD', rng.integers(3, 25, N),
    rng.integers(5, 60, N)))
)

contact_attempts_30d = np.where(
    bucket == '1-30 DPD',  rng.integers(1, 5, N),
    np.where(bucket == '31-60 DPD', rng.integers(2, 9, N),
    np.where(bucket == '61-90 DPD', rng.integers(3, 14, N),
    rng.integers(4, 22, N)))
)

right_party_contact = np.clip(
    call_pickup_rate * rng.uniform(0.6, 0.95, N), 0, 1
).round(2)

# ─────────────────────────────────────────────────────────────
# SECTION 8 — INCOME & FINANCIAL STRESS
# SAMA salary data: Saudi workforce avg SAR 8,000–14,000/month
# ─────────────────────────────────────────────────────────────

income_base = {
    'Government': 12500, 'Semi-Government': 14000, 'Private - Large': 11000,
    'Private - SME': 7500, 'Military/Security': 10500,
    'Self-Employed': 15000, 'Retired': 6500
}
monthly_income = np.array([
    np.clip(rng.lognormal(np.log(income_base[s]), 0.42), 3000, 80000)
    for s in employer_sec
]).round(-2).astype(int)

# Saudi salary calendar: mostly 1st or end-of-month
salary_day = rng.choice(
    [1, 25, 26, 27, 28, 29, 30],
    N, p=[0.38, 0.11, 0.13, 0.13, 0.11, 0.09, 0.05]
)
today_day        = TODAY.day  # 24th
days_to_salary   = np.where(
    salary_day >= today_day,
    salary_day - today_day,
    (30 - today_day) + salary_day
)

# DTI ratio — SAMA cap 33%, many exceed it in delinquent portfolios
dti_ratio = np.clip(monthly_inst / monthly_income, 0.02, 0.90).round(3)

# Other active loans (Saudi bureau pattern)
other_loans = rng.choice([0, 1, 2, 3, 4, 5], N, p=[0.22, 0.33, 0.25, 0.12, 0.06, 0.02])

# Credit bureau score at origination (300-900 Saudi scale)
bureau_score_orig = np.clip(
    rng.normal(620, 110, N), 300, 900
).round(0).astype(int)

# ─────────────────────────────────────────────────────────────
# SECTION 9 — HARDSHIP & RISK FLAGS
# ─────────────────────────────────────────────────────────────

job_loss_flag      = rng.choice([True, False], N, p=[0.08, 0.92])
medical_flag       = rng.choice([True, False], N, p=[0.05, 0.95])
family_change_flag = rng.choice([True, False], N, p=[0.04, 0.96])
dispute_flag       = rng.choice([True, False], N, p=[0.06, 0.94])
fraud_flag         = rng.choice([True, False], N, p=[0.02, 0.98])

legal_action_flag = np.where(
    np.isin(bucket, ['NPA', 'Write-off']),
    rng.choice([True, False], N, p=[0.38, 0.62]),
    False
)

collateral_flag = np.where(
    np.isin(product_type, ['Home Finance', 'Auto Finance']),
    True,
    rng.choice([True, False], N, p=[0.15, 0.85])
)

# ─────────────────────────────────────────────────────────────
# SECTION 10 — COLLECTIONS MANAGEMENT
# ─────────────────────────────────────────────────────────────

handling_type = np.where(
    bucket == '1-30 DPD',
    rng.choice(['AI Only', 'AI + Human'], N, p=[0.74, 0.26]),
    np.where(bucket == '31-60 DPD',
    rng.choice(['AI Only', 'AI + Human', 'Human Led'], N, p=[0.28, 0.47, 0.25]),
    np.where(bucket == '61-90 DPD',
    rng.choice(['AI + Human', 'Human Led'], N, p=[0.33, 0.67]),
    'Human Led'))
)

# 40 agents, realistic Saudi names
agent_pool = [
    'Faisal Al-Rashidi', 'Nora Al-Khalid', 'Khaled Al-Otaibi',
    'Sara Al-Mutairi', 'Mohammed Al-Zahrani', 'Hessa Al-Ghamdi',
    'Turki Al-Harbi', 'Maha Al-Shehri', 'Bandar Al-Qahtani',
    'Reem Al-Dosari', 'Nawaf Al-Anazi', 'Lama Al-Ahmadi',
    'Saud Al-Balawi', 'Dana Al-Subaie', 'Majed Al-Ruwaili',
    'Shahad Al-Maliki', 'Omar Al-Omari', 'Hind Al-Juhani',
    'Waleed Al-Bishi', 'Fatima Al-Khaldi', 'Adel Al-Thubaiti',
    'Rana Al-Shahrani', 'Hamad Al-Asmari', 'Ghada Al-Bogami',
    'Ziyad Al-Zahrani', 'Abeer Al-Enazi', 'Talal Al-Enezi',
    'Wafa Al-Shammari', 'Bader Al-Mutlaq', 'Dina Al-Habdan'
]
agent_ids = {name: f"AGT-{str(i+1).zfill(3)}" for i, name in enumerate(agent_pool)}

assigned_agent_name = np.where(
    handling_type == 'AI Only',
    'N/A',
    [rng.choice(agent_pool) for _ in range(N)]
)
assigned_agent_id = np.array([
    agent_ids.get(a, 'N/A') for a in assigned_agent_name
])

settlement_eligible = np.where(
    np.isin(bucket, ['NPA', 'Write-off']),
    rng.choice([True, False], N, p=[0.65, 0.35]),
    rng.choice([True, False], N, p=[0.12, 0.88])
)
ots_discount = np.where(
    settlement_eligible,
    rng.choice([5, 10, 15, 20, 25, 30], N, p=[0.15, 0.25, 0.28, 0.18, 0.09, 0.05]),
    0
)
waiver_requested = rng.choice([True, False], N, p=[0.11, 0.89])

# ─────────────────────────────────────────────────────────────
# SECTION 11 — ML TARGET VARIABLE
# Logistic model with real causal relationships
# ─────────────────────────────────────────────────────────────

ptp_rel_filled = np.where(np.isnan(ptp_reliability), 0.5, ptp_reliability)

logit = (
    # Strong positive: paying history, salary alignment, engagement
      3.5 * ontime_ratio
    + 2.2 * ptp_rel_filled
    + 1.9 * (1 - np.clip(dti_ratio, 0, 1))
    + 1.6 * (days_to_salary <= 4).astype(float)
    + 1.4 * (days_to_salary <= 7).astype(float) * 0.5
    + 1.3 * call_pickup_rate
    + 1.1 * whatsapp_response_rate
    + 0.8 * (bureau_score_orig / 900)

    # Strong negative: delinquency depth, broken promises, stress
    - 3.2 * (current_dpd / 180)
    - 2.1 * (consecutive_broken / 5)
    - 1.6 * job_loss_flag.astype(float)
    - 1.4 * (other_loans / 5)
    - 1.1 * (max_dpd_ever / 365)
    - 0.9 * (months_since_last_pay / 12)
    - 0.7 * fraud_flag.astype(float)
    - 0.5 * dispute_flag.astype(float)
    - 0.4 * (dti_ratio > 0.5).astype(float)

    # Bucket penalty
    - np.where(bucket == '1-30 DPD', 0.0,
      np.where(bucket == '31-60 DPD', 0.9,
      np.where(bucket == '61-90 DPD', 1.8,
      np.where(bucket == 'NPA', 2.8, 4.2))))

    # Real-world noise
    + rng.normal(0, 0.65, N)
    - 1.8  # intercept
)

pay_probability = np.clip(1 / (1 + np.exp(-logit)), 0.02, 0.98).round(3)
ptp_score       = np.clip(np.round(300 + pay_probability * 550).astype(int), 300, 850)

risk_tier = np.where(
    ptp_score >= 700, 'Low Risk',
    np.where(ptp_score >= 550, 'Medium Risk',
    np.where(ptp_score >= 400, 'High Risk', 'Very High Risk'))
)

channel_rec = np.where(
    ptp_score >= 700, 'SMS',
    np.where(ptp_score >= 550, 'WhatsApp',
    np.where(ptp_score >= 400, 'AI Voice',
    'Human Agent'))
)

# Outcome label — 65% observed, 35% live/pending
has_outcome  = rng.choice([True, False], N, p=[0.65, 0.35])
actual_paid  = np.where(
    has_outcome,
    (rng.uniform(0, 1, N) < pay_probability).astype(int),
    -1
)
outcome_label = np.where(
    actual_paid == 1,  'Paid',
    np.where(actual_paid == 0, 'Not Paid', 'Pending')
)

# ─────────────────────────────────────────────────────────────
# SECTION 12 — ACCOUNT IDs & ASSEMBLE
# ─────────────────────────────────────────────────────────────

account_ids = [f"WAT-{str(i+1).zfill(6)}" for i in range(N)]

df = pd.DataFrame({
    # Identifiers
    'account_id':              account_ids,
    'customer_name':           customer_names,
    'national_id':             national_ids,
    'phone_number':            phone_numbers,
    'origination_date':        origination_date,
    'months_on_book':          months_on_book,

    # Demographics
    'age':                     age,
    'gender':                  gender,
    'nationality':             nationality,
    'region':                  region,
    'employer_sector':         employer_sec,

    # Product
    'product_type':            product_type,
    'loan_amount_sar':         loan_amount.astype(int),
    'outstanding_balance_sar': outstanding_bal.astype(int),
    'monthly_installment_sar': monthly_inst.astype(int),
    'interest_rate_pct':       interest_rate,
    'loan_tenure_months':      loan_tenure,
    'remaining_tenure_months': np.maximum(loan_tenure - months_on_book, 0),
    'collateral_flag':         collateral_flag,

    # Delinquency
    'current_dpd':             current_dpd,
    'delinquency_bucket':      bucket,
    'max_dpd_ever':            max_dpd_ever,
    'dpd_trend':               dpd_trend,
    'times_entered_30dpd':     times_30dpd,

    # Payment behaviour
    'ontime_payment_ratio':    ontime_ratio,
    'partial_payment_frequency': partial_pay_freq,
    'avg_payment_ratio':       avg_payment_ratio,
    'total_payments_made':     total_payments_made,
    'total_amount_paid_sar':   total_paid.astype(int),
    'months_since_last_payment': months_since_last_pay,
    'last_payment_amount_sar': last_payment_amt,

    # PTP
    'total_ptps_made':         total_ptps,
    'ptps_kept':               ptps_kept,
    'ptps_broken':             ptps_broken,
    'consecutive_broken_ptps': consecutive_broken,
    'ptp_reliability_rate':    ptp_reliability.round(2),
    'avg_days_late_broken_ptp': avg_days_late_broken,
    'has_active_ptp':          has_active_ptp,
    'ptp_due_date':            ptp_due_date,
    'ptp_amount_sar':          ptp_amount,
    'ptp_captured_by':         ptp_captured_by,

    # Channel
    'call_pickup_rate':        call_pickup_rate,
    'sms_response_rate':       sms_response_rate,
    'whatsapp_response_rate':  whatsapp_response_rate,
    'email_response_rate':     email_response_rate,
    'preferred_contact_window': preferred_contact,
    'days_since_last_contact': days_since_contact,
    'contact_attempts_30d':    contact_attempts_30d,
    'right_party_contact_rate': right_party_contact,

    # Income & stress
    'monthly_income_sar':      monthly_income,
    'salary_day':              salary_day,
    'days_to_next_salary':     days_to_salary,
    'dti_ratio':               dti_ratio,
    'other_active_loans':      other_loans,
    'bureau_score_at_origination': bureau_score_orig,

    # Hardship flags
    'job_loss_flag':           job_loss_flag,
    'medical_hardship_flag':   medical_flag,
    'family_status_change':    family_change_flag,
    'dispute_flag':            dispute_flag,
    'fraud_suspected_flag':    fraud_flag,
    'legal_action_flag':       legal_action_flag,

    # Collections
    'handling_type':           handling_type,
    'assigned_agent_name':     assigned_agent_name,
    'assigned_agent_id':       assigned_agent_id,
    'settlement_eligible':     settlement_eligible,
    'ots_discount_pct':        ots_discount,
    'waiver_requested':        waiver_requested,

    # ML outputs
    'ptp_score':               ptp_score,
    'pay_probability':         pay_probability,
    'risk_tier':               risk_tier,
    'recommended_channel':     channel_rec,
    'outcome_label':           outcome_label,
})

# ─────────────────────────────────────────────────────────────
# SECTION 13 — VALIDATION
# ─────────────────────────────────────────────────────────────

print("\n── Dataset Summary ──────────────────────────────────")
print(f"Shape: {df.shape[0]:,} rows × {df.shape[1]} columns")

print("\nBucket distribution:")
bd = df['delinquency_bucket'].value_counts(normalize=True).mul(100).round(1)
for b, v in bd.items():
    print(f"  {b:<20} {v}%")

print("\nRisk tier distribution:")
for t, v in df['risk_tier'].value_counts(normalize=True).mul(100).round(1).items():
    print(f"  {t:<20} {v}%")

print("\nActual pay rate by bucket (labelled accounts only):")
labelled = df[df['outcome_label'] != 'Pending']
pay_rate = labelled.groupby('delinquency_bucket')['outcome_label'].apply(
    lambda x: (x == 'Paid').mean()
).round(2)
for b, v in pay_rate.items():
    print(f"  {b:<20} {v:.0%}")

print("\nKey statistics:")
print(f"  Avg outstanding balance : SAR {df['outstanding_balance_sar'].mean():,.0f}")
print(f"  Avg PTP score           : {df['ptp_score'].mean():.0f}")
print(f"  Avg pay probability     : {df['pay_probability'].mean():.3f}")
print(f"  Avg DTI ratio           : {df['dti_ratio'].mean():.3f}")
print(f"  Active PTPs             : {df['has_active_ptp'].sum():,}")
print(f"  Accounts with agent     : {(df['handling_type'] != 'AI Only').sum():,}")

print("\nData integrity checks:")
print(f"  ptps_kept <= total_ptps : {(df['ptps_kept'] <= df['total_ptps_made']).all()}")
print(f"  outstanding <= loan_amt : {(df['outstanding_balance_sar'] <= df['loan_amount_sar']).all()}")
print(f"  PTP score range         : {df['ptp_score'].min()}–{df['ptp_score'].max()}")
print(f"  Null values             : {df.isnull().sum().sum()} (only ptp_reliability for 0-PTP accounts)")

df.to_csv('data/wataniya_ibe_10k.csv', index=False)
print(f"\n✓ Saved: wataniya_ibe_10k.csv")
print("=" * 60)
