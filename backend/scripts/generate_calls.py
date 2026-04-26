"""
NSP IBE — Call History Dataset Generator
Generates realistic call records matching the platform's existing data patterns
823 total calls (matching the Total shown in screenshots)
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

rng = np.random.default_rng(2026)
random.seed(2026)

# Date range from screenshots: Feb 21 - Mar 23, 2026
START_DATE = datetime(2026, 2, 21)
END_DATE   = datetime(2026, 3, 23, 17, 30)
N_CALLS    = 823  # matches "Total: 823" in screenshots

print("Generating call history dataset...")

# ─── Agent pool (Saudi names matching existing agents) ──────
AGENTS = [
    {'id': 'AGT-007', 'name': 'Faisal Al-Rashidi',   'type': 'outbound'},
    {'id': 'AGT-012', 'name': 'Nora Al-Khalid',       'type': 'outbound'},
    {'id': 'AGT-003', 'name': 'Khaled Al-Otaibi',     'type': 'outbound'},
    {'id': 'AGT-019', 'name': 'Sara Al-Mutairi',      'type': 'inbound'},
    {'id': 'AGT-024', 'name': 'Mohammed Al-Zahrani',  'type': 'outbound'},
    {'id': 'AGT-008', 'name': 'Hessa Al-Ghamdi',      'type': 'outbound'},
    {'id': 'AGT-011', 'name': 'Turki Al-Harbi',       'type': 'outbound'},
    {'id': 'AGT-015', 'name': 'Maha Al-Shehri',       'type': 'inbound'},
    {'id': 'AGT-021', 'name': 'Bandar Al-Qahtani',    'type': 'outbound'},
    {'id': 'AGT-004', 'name': 'Reem Al-Dosari',       'type': 'inbound'},
    {'id': 'AI-BOT',  'name': 'AI Voice Bot',          'type': 'outbound'},
]

# ─── Call status distribution (matching screenshots exactly) ─
# FINISHED 22.4%, DECLINED 19.0%, NO ANSWER 32.9%, PBX FAILED 0.6%, NO SPEECH 25.2%
STATUSES = ['FINISHED', 'DECLINED BY USER', 'USER DID NOT ANSWER', 'PBX FAILED TO MAKE CALL', 'NO CUSTOMER SPEECH']
STATUS_W = [0.22378, 0.18981, 0.32867, 0.00599, 0.25175]

# ─── Direction distribution (from screenshots: 795 Outbound, 28 Web) ─
DIRECTIONS = ['Outbound', 'Inbound', 'Reverse Inbound', 'Web']
DIRECTION_W = [0.966, 0.000, 0.000, 0.034]  # 795 outbound, 28 web ≈ 823 total

# ─── Sentiment (Positive 28.4%, Neutral 54.6%, Negative 16.9% — only for FINISHED calls) ─
SENTIMENTS = ['Positive', 'Neutral', 'Negative']
SENTIMENT_W = [0.284, 0.546, 0.170]

# ─── DPD buckets for context ─────────────────────────────────
BUCKETS = ['1-30 DPD', '31-60 DPD', '61-90 DPD', 'NPA', 'Write-off']
BUCKET_W = [0.38, 0.25, 0.17, 0.13, 0.07]

# ─── Saudi account IDs ───────────────────────────────────────
account_pool = [f"WAT-{str(i).zfill(6)}" for i in range(1, 10001)]

# ─── Daily call volume — bell curve matching the trend chart ─
# Peak around Mar 8, low at start and end
all_dates = pd.date_range(START_DATE, END_DATE.date(), freq='D')
all_dates = [d for d in all_dates if d.weekday() < 6]  # no Fridays (Saudi weekend)

# Create realistic daily distribution (matches screenshot bell curve)
n_days = len(all_dates)
bell = np.array([
    np.exp(-0.5 * ((i - n_days * 0.55) / (n_days * 0.22)) ** 2)
    for i in range(n_days)
])
bell = bell / bell.sum()
daily_counts = np.round(bell * N_CALLS).astype(int)
# Adjust to exactly N_CALLS
diff = N_CALLS - daily_counts.sum()
daily_counts[np.argmax(bell)] += diff

# ─── Generate call records ────────────────────────────────────
records = []
call_num = 8000  # starting call number

for day_idx, (date, count) in enumerate(zip(all_dates, daily_counts)):
    for _ in range(count):
        call_num += 1

        # Direction
        direction = rng.choice(DIRECTIONS, p=DIRECTION_W)

        # Agent — AI bot handles 60% of outbound, humans handle rest + inbound/web
        if direction == 'Outbound':
            agent = rng.choice(AGENTS[:11],
                               p=[0.10, 0.10, 0.09, 0.00, 0.08, 0.08, 0.08, 0.00, 0.07, 0.00, 0.40])
        elif direction == 'Web':
            agent = rng.choice([a for a in AGENTS if a['id'] == 'AI-BOT'])[0] \
                    if False else {'id': 'AI-BOT', 'name': 'AI Voice Bot', 'type': 'outbound'}
        else:
            inbound_agents = [a for a in AGENTS if a['type'] == 'inbound']
            agent = rng.choice(inbound_agents)

        # Status
        status = rng.choice(STATUSES, p=STATUS_W)

        # Duration — realistic per status
        if status == 'FINISHED':
            # 10s–5min, right-skewed
            duration_sec = int(np.clip(rng.lognormal(4.0, 0.9), 10, 600))
        elif status in ['DECLINED BY USER', 'NO CUSTOMER SPEECH']:
            duration_sec = int(rng.integers(0, 45))
        elif status == 'USER DID NOT ANSWER':
            duration_sec = 0
        else:  # PBX FAILED
            duration_sec = 0

        # Sentiment — only meaningful for FINISHED calls
        if status == 'FINISHED':
            sentiment = rng.choice(SENTIMENTS, p=SENTIMENT_W)
        else:
            sentiment = 'N/A'

        # PTP outcome — only for FINISHED calls
        if status == 'FINISHED':
            ptp_outcome = rng.choice(
                ['PTP Captured', 'No PTP', 'Broken PTP', 'Refused', 'Dispute'],
                p=[0.45,          0.28,      0.10,         0.12,      0.05]
            )
            ptp_amount = rng.integers(500, 15000, endpoint=True) * 100 \
                         if ptp_outcome == 'PTP Captured' else 0
        else:
            ptp_outcome = 'No Contact'
            ptp_amount  = 0

        # Call time — business hours 8am-9pm Saudi time
        hour   = rng.integers(8, 22)
        minute = rng.integers(0, 60)
        second = rng.integers(0, 60)
        call_dt = date.replace(hour=int(hour), minute=int(minute), second=int(second))

        # Account
        account_id = rng.choice(account_pool)

        # DPD bucket context
        bucket = rng.choice(BUCKETS, p=BUCKET_W)

        # Latency (ms) — realistic VoIP latency
        latency_ms = int(rng.lognormal(7.5, 0.8))  # median ~1800ms

        # Call score (quality) — 0-10, only for finished calls
        if status == 'FINISHED' and sentiment == 'Positive':
            call_score = round(rng.uniform(7.0, 10.0), 1)
        elif status == 'FINISHED' and sentiment == 'Neutral':
            call_score = round(rng.uniform(4.0, 7.5), 1)
        elif status == 'FINISHED' and sentiment == 'Negative':
            call_score = round(rng.uniform(1.0, 4.5), 1)
        else:
            call_score = None

        records.append({
            'call_id':         f'CL-{call_num}',
            'call_datetime':   call_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'call_date':       call_dt.strftime('%Y-%m-%d'),
            'call_time':       call_dt.strftime('%H:%M:%S'),
            'direction':       direction,
            'status':          status,
            'duration_sec':    duration_sec,
            'duration_fmt':    f"{duration_sec//60}m {duration_sec%60}s" if duration_sec > 0 else '0s',
            'account_id':      account_id,
            'delinquency_bucket': bucket,
            'agent_id':        agent['id'],
            'agent_name':      agent['name'],
            'agent_type':      'AI' if agent['id'] == 'AI-BOT' else 'Human',
            'sentiment':       sentiment,
            'ptp_outcome':     ptp_outcome,
            'ptp_amount_sar':  int(ptp_amount),
            'latency_ms':      latency_ms,
            'call_score':      call_score,
        })

df = pd.DataFrame(records).sort_values('call_datetime').reset_index(drop=True)

# ─── Validation ───────────────────────────────────────────────
print(f"\nTotal calls:     {len(df)}")
print(f"Date range:      {df['call_date'].min()} → {df['call_date'].max()}")
print(f"\nStatus distribution:")
for s, v in df['status'].value_counts().items():
    print(f"  {s:<35} {v:>4} ({v/len(df)*100:.1f}%)")
print(f"\nDirection distribution:")
for d, v in df['direction'].value_counts().items():
    print(f"  {d:<20} {v:>4}")
print(f"\nSentiment (finished calls only):")
fin = df[df['status']=='FINISHED']
for s, v in fin['sentiment'].value_counts().items():
    print(f"  {s:<15} {v:>4} ({v/len(fin)*100:.1f}%)")
print(f"\nPTP captures:    {(df['ptp_outcome']=='PTP Captured').sum()}")
print(f"Total PTP value: SAR {df['ptp_amount_sar'].sum():,}")
print(f"Avg duration (finished): {fin['duration_sec'].mean():.0f}s")
print(f"AI handled:      {(df['agent_type']=='AI').sum()} ({(df['agent_type']=='AI').mean()*100:.0f}%)")

df.to_csv('data/call_history.csv', index=False)
print(f"\n✓ Saved: data/call_history.csv ({len(df)} records)")
