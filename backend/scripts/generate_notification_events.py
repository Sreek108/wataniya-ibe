"""
generate_notification_events.py
Generates April 2026 (30 days) daily notification event data per channel per DPD bucket.
Calibrated to the Activity Report in reference/Notification_Module.xlsx (Apr 25 2026 MTD).

Columns:
  date, day_type, week_number, dpd_bucket, channel,
  template_name, attempt_count, success_count, success_pct
"""

import csv
import os
import random
from datetime import date, timedelta

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'notification_events.csv')

random.seed(99)

START = date(2026, 4, 1)
END   = date(2026, 4, 30)   # inclusive → 30 days
DAYS  = (END - START).days + 1

# Saudi weekend: Friday=4, Saturday=5
WEEKEND = {4, 5}

BUCKETS = ['1-30 DPD', '31-60 DPD', '61-90 DPD', '>91 DPD', 'Write-off']

CHANNELS = ['SMS', 'Push', 'IVR', 'NABA']

# ── Template per bucket (primary template for each bucket) ────────────────────
# Based on EN Template sheet segment labels
BUCKET_TEMPLATE = {
    '1-30 DPD':  'Bucket1_EN',
    '31-60 DPD': 'Bucket2_EN',
    '61-90 DPD': 'PKT3_PreLegal_EN',
    '>91 DPD':   'NPA_Offer_EN',
    'Write-off': 'Write_Off_EN',
}

# IVR uses Mobile_Update_EN for unreachable; NPA/Write-off use offer templates
IVR_TEMPLATE = {
    '1-30 DPD':  'Due_Reminder_EN',
    '31-60 DPD': 'Due_Reminder_EN',
    '61-90 DPD': 'LPC_EN',
    '>91 DPD':   'NPA_Offer_EN',
    'Write-off': 'Write_Off_EN',
}

# Week-based secondary templates (from Notification calendar 4-week schedule)
# Some days within a week alternate to these
WEEK_ALT_TEMPLATES = {
    1: {
        '1-30 DPD':  'Bucket1_EN',
        '31-60 DPD': 'Bucket2_EN',
        '61-90 DPD': 'PKT3_PreLegal_EN',
        '>91 DPD':   'NPA_Offer_EN',
        'Write-off': 'Write_Off_EN',
    },
    2: {
        '1-30 DPD':  'Mobile_Update_EN',
        '31-60 DPD': 'Mobile_Update_EN',
        '61-90 DPD': 'PKT3_PreLegal_EN',
        '>91 DPD':   'NPA_Offer_EN',
        'Write-off': 'Write_Off_EN',
    },
    3: {
        '1-30 DPD':  'Bucket1_EN',
        '31-60 DPD': 'Bucket2_EN',
        '61-90 DPD': 'Legal_Warning_EN',
        '>91 DPD':   'NPA_Offer_EN',
        'Write-off': 'Write_Off_EN',
    },
    4: {
        '1-30 DPD':  'Due_Reminder_EN',
        '31-60 DPD': 'Bucket2_EN',
        '61-90 DPD': 'PKT3_PreLegal_EN',
        '>91 DPD':   'NPA_Offer_EN',
        'Write-off': 'Write_Off_EN',
    },
}

# ── Daily base attempt counts (calibrated: MTD cumulative / 17 weekdays) ──────
# Source: Activity Report Apr 25, 2026 (MTD cumulative / 17 weekdays ≈ per day)
# IVR base is per weekday; weekends get ~35% of weekday volume
SMS_BASE = {
    '1-30 DPD':  2513,
    '31-60 DPD': 1386,
    '61-90 DPD':  652,
    '>91 DPD':   1709,
    'Write-off': 1635,
}
PUSH_BASE = {
    '1-30 DPD':  7324,
    '31-60 DPD': 4502,
    '61-90 DPD': 2139,
    '>91 DPD':   5187,
    'Write-off': 2972,
}
IVR_BASE = {
    '1-30 DPD':  13922,
    '31-60 DPD':  7333,
    '61-90 DPD':  3736,
    '>91 DPD':   11382,
    'Write-off':  9713,
}
NABA_BASE = {
    '1-30 DPD':   457,
    '31-60 DPD':  242,
    '61-90 DPD':  362,
    '>91 DPD':    954,
    'Write-off':  897,
}

# ── Success rates ──────────────────────────────────────────────────────────────
# SMS and Push: no success tracking in client data → None
# IVR: from Activity Report success %
# NABA: very high, from Activity Report
IVR_RATE = {
    '1-30 DPD':  0.3623,
    '31-60 DPD': 0.3020,
    '61-90 DPD': 0.2750,
    '>91 DPD':   0.2031,
    'Write-off': 0.1696,
}
NABA_RATE = {
    '1-30 DPD':  0.9977,
    '31-60 DPD': 0.9998,
    '61-90 DPD': 0.9972,
    '>91 DPD':   0.9915,
    'Write-off': 0.9485,
}

# Weekend factors: SMS/Push/NABA = 0 (not sent on weekends per calendar);
# IVR continues at ~35% for automated outreach
WEEKEND_FACTOR = {
    'SMS':  0.00,
    'Push': 0.00,
    'IVR':  0.35,
    'NABA': 0.00,
}

FIELDNAMES = [
    'date', 'day_type', 'week_number', 'dpd_bucket',
    'channel', 'template_name', 'attempt_count',
    'success_count', 'success_pct',
]


def vary(base, lo=0.88, hi=1.12):
    return int(base * random.uniform(lo, hi))


def week_number(d: date) -> int:
    return min((d.day - 1) // 7 + 1, 4)


def build_rows(d: date) -> list:
    is_weekend = d.weekday() in WEEKEND
    day_type   = 'Weekend' if is_weekend else 'Weekday'
    wk         = week_number(d)
    rows = []

    for bucket in BUCKETS:
        for channel in CHANNELS:
            factor = WEEKEND_FACTOR[channel] if is_weekend else 1.0

            if channel == 'SMS':
                base = SMS_BASE[bucket]
            elif channel == 'Push':
                base = PUSH_BASE[bucket]
            elif channel == 'IVR':
                base = IVR_BASE[bucket]
            else:
                base = NABA_BASE[bucket]

            attempt = int(vary(base) * factor)
            if attempt == 0:
                continue  # skip zero-attempt rows (weekend non-IVR)

            # Success
            if channel == 'SMS' or channel == 'Push':
                success = None
                spct    = None
            elif channel == 'IVR':
                rate    = IVR_RATE[bucket] * random.uniform(0.92, 1.08)
                rate    = min(rate, 0.98)
                success = int(attempt * rate)
                spct    = round(success / attempt, 6) if attempt else None
            else:  # NABA
                rate    = NABA_RATE[bucket] * random.uniform(0.998, 1.000)
                rate    = min(rate, 1.0)
                success = int(attempt * rate)
                spct    = round(success / attempt, 6) if attempt else None

            # Template selection: alternate by week with small noise
            if channel == 'IVR':
                tmpl = IVR_TEMPLATE[bucket]
            elif random.random() < 0.15:
                tmpl = WEEK_ALT_TEMPLATES[wk][bucket]
            else:
                tmpl = BUCKET_TEMPLATE[bucket]

            rows.append({
                'date':          d.isoformat(),
                'day_type':      day_type,
                'week_number':   wk,
                'dpd_bucket':    bucket,
                'channel':       channel,
                'template_name': tmpl,
                'attempt_count': attempt,
                'success_count': '' if success is None else success,
                'success_pct':   '' if spct is None else spct,
            })

    return rows


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    all_rows = []

    for i in range(DAYS):
        d = START + timedelta(days=i)
        all_rows.extend(build_rows(d))

    with open(OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"[OK] {len(all_rows)} rows -> {OUTPUT_PATH}")
    print(f"     {DAYS} days × {len(BUCKETS)} buckets × up to {len(CHANNELS)} channels")

    # Quick stats
    import pandas as pd
    df = pd.read_csv(OUTPUT_PATH)
    print(f"\nRows by channel:")
    print(df['channel'].value_counts().to_string())
    print(f"\nRows by dpd_bucket:")
    print(df['dpd_bucket'].value_counts().to_string())
    print(f"\nIVR avg success_pct by bucket:")
    ivr = df[df['channel'] == 'IVR'].copy()
    ivr['success_pct'] = pd.to_numeric(ivr['success_pct'], errors='coerce')
    print(ivr.groupby('dpd_bucket')['success_pct'].mean().round(4).to_string())
    print(f"\nTemplates used:")
    print(df['template_name'].value_counts().to_string())


if __name__ == '__main__':
    main()
