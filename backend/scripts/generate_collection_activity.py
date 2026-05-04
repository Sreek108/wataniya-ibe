"""
generate_collection_activity.py
Generates 60 days (March 1 – April 29, 2026) of daily multi-channel collection
activity data, calibrated to patterns in:
  reference/Collection Activity  22-10-2025.xlsx

Columns per row:
  date, dpd_bucket, opening_count, current_count, unreachable_count,
  sms_attempt, sms_success, sms_success_pct,
  push_attempt, push_success, push_success_pct,
  robot_calling_attempt, robot_calling_success, robot_calling_success_pct,
  naba_attempt, naba_success, naba_success_pct,
  agent_calling_attempt, agent_calling_success, agent_calling_success_pct
"""

import csv
import math
import os
import random
from datetime import date, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'collection_activity.csv')

random.seed(42)

START  = date(2026, 3, 1)
END    = date(2026, 4, 29)   # inclusive → 60 days
DAYS   = (END - START).days + 1

BUCKETS = ['1-30 DPD', '31-60 DPD', '61-90 DPD', '>91 DPD', 'Write-off']

# Saudi weekend: Friday (weekday 4) and Saturday (weekday 5)
WEEKEND_DAYS = {4, 5}

# ── Opening counts ────────────────────────────────────────────────────────────
# Fixed portfolio opening for the period; scaled to April 2026 actuals
OPENING = {
    '1-30 DPD':  40587,
    '31-60 DPD':  9320,
    '61-90 DPD':  4438,
    '>91 DPD':   10400,
    'Write-off':  6500,
}

# ── Current count ─────────────────────────────────────────────────────────────
# Starts high at month-open, declines as accounts resolve / roll forward.
# Reference Oct 2025: 1-30 dropped from ~18,500 to ~14,100 in 14 days.
# We model 60 days across two months.
CURRENT_START = {
    '1-30 DPD':  38500,
    '31-60 DPD':  9050,
    '61-90 DPD':  4300,
    '>91 DPD':   10300,
    'Write-off':  6460,
}
CURRENT_END = {
    '1-30 DPD':  14100,
    '31-60 DPD':  5850,
    '61-90 DPD':  2000,
    '>91 DPD':    9680,
    'Write-off':  6370,
}

# ── Unreachable counts ────────────────────────────────────────────────────────
# Reference Oct 21: 1-30=819, 31-60=964, 61-90=479, >91=2800, WO=2634
UNREACHABLE_BASE = {
    '1-30 DPD':   750,
    '31-60 DPD':  880,
    '61-90 DPD':  420,
    '>91 DPD':   2500,
    'Write-off': 2100,
}

# ── SMS attempt base (weekday) ─────────────────────────────────────────────────
# Reference Oct 21 daily: 1-30=22760, 31-60=8902, 61-90=3554, >91=10366, WO=6467
# No success tracking for SMS in client data (client only records attempts)
SMS_BASE = {
    '1-30 DPD':  22500,
    '31-60 DPD':  8700,
    '61-90 DPD':  3500,
    '>91 DPD':   10100,
    'Write-off':  6300,
}

# ── Push Notifications attempt base ───────────────────────────────────────────
# Reference Oct 21 daily: 1-30=31555, 31-60=8107, 61-90=3224, >91=8125, WO=3162
# No success tracking for Push in client data
PUSH_BASE = {
    '1-30 DPD':  30500,
    '31-60 DPD':  8000,
    '61-90 DPD':  3100,
    '>91 DPD':    8100,
    'Write-off':  3100,
}

# ── Robot Calling attempt base & success rates ─────────────────────────────────
# Reference daily attempts Oct 21: 1-30=25830, 31-60=8627, 61-90=3501, >91=10350, WO=6466
# Success rates from multiple daily observations (cumulative is much lower):
#   1-30: 47-80% daily (base ~50%), 31-60: 42-87% (base ~44%),
#   61-90: 35-83% (base ~40%), >91: 28-71% (base ~32%), WO: 19-58% (base ~23%)
ROBOT_BASE = {
    '1-30 DPD':  25000,
    '31-60 DPD':  8400,
    '61-90 DPD':  3400,
    '>91 DPD':   10100,
    'Write-off':  6300,
}
ROBOT_RATE = {
    '1-30 DPD':  0.50,
    '31-60 DPD': 0.44,
    '61-90 DPD': 0.40,
    '>91 DPD':   0.32,
    'Write-off': 0.23,
}

# ── NABA attempt base & success rates ─────────────────────────────────────────
# Reference Oct 21 daily: 1-30=1112(99.9%), 31-60=267(100%), 61-90=3013(99.8%),
#                         >91=10203(99.1%), WO=6441(96%)
# Oct 8: >91=10160(99%), WO=6430(96%)
NABA_BASE = {
    '1-30 DPD':  1100,
    '31-60 DPD':  350,
    '61-90 DPD': 2900,
    '>91 DPD':   8500,
    'Write-off': 5200,
}
NABA_RATE = {
    '1-30 DPD':  0.999,
    '31-60 DPD': 1.000,
    '61-90 DPD': 0.998,
    '>91 DPD':   0.990,
    'Write-off': 0.962,
}

# ── Agent Calling attempt base & success rates ─────────────────────────────────
# Reference Oct 21: 1-30=None, 31-60=3861(38.85%), 61-90=2778(66.8% — unusually high),
#   >91=6574(52.7% — cumulative-influenced?), WO=3510(47.9% — cumulative-influenced)
# More typical daily single-day from Oct 15:
#   31-60=461(40.8%), 61-90=1016(23.8%), >91=2116(19.7%), WO=1620(18.6%)
# Oct 20: 31-60=235(44.3%), 61-90=875(23.0%), >91=2409(21.6%), WO=1573(14.0%)
# Use realistic single-day baselines:
AGENT_BASE = {
    '1-30 DPD':  None,  # No agent calling for 1-30 DPD per client data
    '31-60 DPD': 3600,
    '61-90 DPD': 2800,
    '>91 DPD':   6500,
    'Write-off': 3500,
}
AGENT_RATE = {
    '1-30 DPD':  None,
    '31-60 DPD': 0.37,
    '61-90 DPD': 0.31,
    '>91 DPD':   0.23,
    'Write-off': 0.18,
}

# ── Weekend factors ───────────────────────────────────────────────────────────
# Saudi weekend: Friday + Saturday
# Automated channels run at ~35% on weekends; agents don't work
WEEKEND_AUTO_FACTOR  = 0.35
WEEKEND_AGENT_FACTOR = 0.00

FIELDNAMES = [
    'date', 'dpd_bucket',
    'opening_count', 'current_count', 'unreachable_count',
    'sms_attempt', 'sms_success', 'sms_success_pct',
    'push_attempt', 'push_success', 'push_success_pct',
    'robot_calling_attempt', 'robot_calling_success', 'robot_calling_success_pct',
    'naba_attempt', 'naba_success', 'naba_success_pct',
    'agent_calling_attempt', 'agent_calling_success', 'agent_calling_success_pct',
]


def vary(base, lo=0.88, hi=1.12):
    """Apply random ±variation to a base value."""
    return int(base * random.uniform(lo, hi))


def fmt(v):
    return '' if v is None else v


def pct(success, attempt):
    if not attempt:
        return None
    return round(success / attempt, 6)


def current_count(bucket, day_idx):
    """Linear interpolation from start to end over DAYS, with ±4% noise."""
    t     = day_idx / (DAYS - 1)
    base  = CURRENT_START[bucket] + t * (CURRENT_END[bucket] - CURRENT_START[bucket])
    noise = random.uniform(0.96, 1.04)
    return max(1, int(base * noise))


def build_row(d, bucket, day_idx):
    is_weekend = d.weekday() in WEEKEND_DAYS
    auto_f     = WEEKEND_AUTO_FACTOR if is_weekend else 1.0
    agent_f    = WEEKEND_AGENT_FACTOR if is_weekend else 1.0

    # ── counts ──────────────────────────────────────────────────────────────
    cc = current_count(bucket, day_idx)
    uc = vary(UNREACHABLE_BASE[bucket], 0.85, 1.15)

    # ── SMS (attempt only — no success tracking in client data) ─────────────
    sms_att = vary(SMS_BASE[bucket], 0.88, 1.12)
    sms_att = int(sms_att * auto_f)
    sms_suc = None
    sms_pct = None

    # ── Push Notifications (attempt only) ────────────────────────────────────
    push_att = vary(PUSH_BASE[bucket], 0.88, 1.12)
    push_att = int(push_att * auto_f)
    push_suc = None
    push_pct = None

    # ── Robot Calling ────────────────────────────────────────────────────────
    robot_att = vary(ROBOT_BASE[bucket], 0.88, 1.12)
    robot_att = int(robot_att * auto_f)
    rate_r    = ROBOT_RATE[bucket] * random.uniform(0.90, 1.10)
    rate_r    = min(rate_r, 0.98)
    robot_suc = int(robot_att * rate_r)
    robot_pct = pct(robot_suc, robot_att)

    # ── NABA ─────────────────────────────────────────────────────────────────
    naba_att = vary(NABA_BASE[bucket], 0.88, 1.12)
    naba_att = int(naba_att * auto_f)
    rate_n   = NABA_RATE[bucket] * random.uniform(0.995, 1.000)
    rate_n   = min(rate_n, 1.0)
    naba_suc = int(naba_att * rate_n)
    naba_pct = pct(naba_suc, naba_att)

    # ── Agent Calling (none for 1-30 DPD; zero on weekends) ─────────────────
    if AGENT_BASE[bucket] is None or agent_f == 0:
        agent_att = None
        agent_suc = None
        agent_pct = None
    else:
        agent_att = vary(AGENT_BASE[bucket], 0.88, 1.12)
        agent_att = int(agent_att * agent_f)
        rate_a    = AGENT_RATE[bucket] * random.uniform(0.90, 1.10)
        rate_a    = min(rate_a, 0.95)
        agent_suc = int(agent_att * rate_a)
        agent_pct = pct(agent_suc, agent_att)
        if agent_att == 0:
            agent_att = agent_suc = agent_pct = None

    return {
        'date':                   d.isoformat(),
        'dpd_bucket':             bucket,
        'opening_count':          OPENING[bucket],
        'current_count':          cc,
        'unreachable_count':      uc,
        'sms_attempt':            sms_att,
        'sms_success':            fmt(sms_suc),
        'sms_success_pct':        fmt(sms_pct),
        'push_attempt':           push_att,
        'push_success':           fmt(push_suc),
        'push_success_pct':       fmt(push_pct),
        'robot_calling_attempt':  robot_att,
        'robot_calling_success':  robot_suc,
        'robot_calling_success_pct': robot_pct,
        'naba_attempt':           naba_att,
        'naba_success':           naba_suc,
        'naba_success_pct':       naba_pct,
        'agent_calling_attempt':  fmt(agent_att),
        'agent_calling_success':  fmt(agent_suc),
        'agent_calling_success_pct': fmt(agent_pct),
    }


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    rows = []

    for i in range(DAYS):
        d = START + timedelta(days=i)
        for bucket in BUCKETS:
            rows.append(build_row(d, bucket, i))

    with open(OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    total        = len(rows)
    weekday_rows = sum(1 for r in rows if date.fromisoformat(r['date']).weekday() not in WEEKEND_DAYS)
    weekend_rows = total - weekday_rows

    print(f"[OK] {total} rows -> {OUTPUT_PATH}")
    print(f"     {DAYS} days x {len(BUCKETS)} buckets")
    print(f"     Weekday rows : {weekday_rows}")
    print(f"     Weekend rows : {weekend_rows}")

    # Sample stats
    print("\nSample robot_calling_success_pct (weekday averages by bucket):")
    from collections import defaultdict
    bucket_rates = defaultdict(list)
    for r in rows:
        d = date.fromisoformat(r['date'])
        if d.weekday() in WEEKEND_DAYS:
            continue
        v = r['robot_calling_success_pct']
        if v not in ('', None):
            bucket_rates[r['dpd_bucket']].append(float(v))
    for b in BUCKETS:
        vals = bucket_rates[b]
        avg  = sum(vals) / len(vals) if vals else 0
        print(f"  {b:<12}  avg={avg:.3f}  n={len(vals)}")

    print("\nSample agent_calling_success_pct (weekday averages by bucket):")
    bucket_agent = defaultdict(list)
    for r in rows:
        d = date.fromisoformat(r['date'])
        if d.weekday() in WEEKEND_DAYS:
            continue
        v = r['agent_calling_success_pct']
        if v not in ('', None):
            bucket_agent[r['dpd_bucket']].append(float(v))
    for b in BUCKETS:
        vals = bucket_agent[b]
        if vals:
            avg = sum(vals) / len(vals)
            print(f"  {b:<12}  avg={avg:.3f}  n={len(vals)}")
        else:
            print(f"  {b:<12}  N/A")


if __name__ == '__main__':
    main()
