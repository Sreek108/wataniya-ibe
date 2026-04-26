"""
NSP IBE — Unified Dataset Generator
Generates ~50,000 call events for all 10,000 accounts,
aggregates call features per account, merges with account data,
produces two outputs:
  - data/wataniya_ibe_unified.csv   (10,000 rows × 84+ cols)
  - data/call_events.csv            (~50,000 rows × 20 cols)
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

rng  = np.random.default_rng(2026)
TODAY = datetime(2026, 3, 24)

print("=" * 60)
print("NSP IBE — Unified Dataset Generator")
print("=" * 60)

# ─────────────────────────────────────────────────────────────
# STEP 1 — Load existing account dataset
# ─────────────────────────────────────────────────────────────
print("\n[1/5] Loading account dataset...")
df = pd.read_csv('data/wataniya_ibe_10k.csv')
print(f"      Loaded {len(df):,} accounts × {df.shape[1]} columns")

# ─────────────────────────────────────────────────────────────
# STEP 2 — Generate call events for every account
# Number of calls per account correlated with bucket severity
# ─────────────────────────────────────────────────────────────
print("\n[2/5] Generating call events (~50,000 records)...")

BUCKET_CALLS = {
    '1-30 DPD':  (2, 5),   # 2–5 calls
    '31-60 DPD': (4, 9),   # 4–9 calls
    '61-90 DPD': (6, 14),  # 6–14 calls
    'NPA':       (8, 20),  # 8–20 calls
    'Write-off': (3, 12),  # 3–12 calls (many unreachable)
}

STATUSES   = ['FINISHED','DECLINED BY USER','USER DID NOT ANSWER',
              'PBX FAILED TO MAKE CALL','NO CUSTOMER SPEECH']

SENTIMENTS = ['Positive','Neutral','Negative']
PTP_OUTCOMES = ['PTP Captured','No PTP','Broken PTP','Refused','Dispute','No Contact']

AGENTS = [
    ('AGT-007','Faisal Al-Rashidi','Human'),
    ('AGT-012','Nora Al-Khalid','Human'),
    ('AGT-003','Khaled Al-Otaibi','Human'),
    ('AGT-024','Mohammed Al-Zahrani','Human'),
    ('AGT-008','Hessa Al-Ghamdi','Human'),
    ('AGT-011','Turki Al-Harbi','Human'),
    ('AGT-021','Bandar Al-Qahtani','Human'),
    ('AI-BOT','AI Voice Bot','AI'),
]

call_events = []
call_num    = 10000

for _, acc in df.iterrows():
    bucket  = acc['delinquency_bucket']
    lo, hi  = BUCKET_CALLS.get(bucket, (3, 8))
    n_calls = int(rng.integers(lo, hi + 1))

    # Account-level probabilities (correlated with existing features)
    pickup_base  = float(acc['call_pickup_rate'])
    wa_base      = float(acc['whatsapp_response_rate'])
    ontime       = float(acc['ontime_payment_ratio'])
    ptp_rel      = float(acc['ptp_reliability_rate']) if not pd.isna(acc['ptp_reliability_rate']) else 0.5
    handling     = acc.get('ml_handling_type', 'AI + Human')

    # Probability of FINISHED call (correlated with pickup rate)
    p_finished  = np.clip(pickup_base * rng.uniform(0.7, 1.2), 0.05, 0.75)
    p_no_answer = np.clip(1 - pickup_base + rng.uniform(-0.1, 0.1), 0.15, 0.80)
    p_declined  = np.clip(rng.uniform(0.05, 0.25), 0.05, 0.30)
    p_no_speech = np.clip(rng.uniform(0.05, 0.30), 0.05, 0.30)
    p_pbx       = 0.01

    # Normalise
    total = p_finished + p_no_answer + p_declined + p_no_speech + p_pbx
    status_probs = [p_finished/total, p_declined/total, p_no_answer/total,
                    p_pbx/total, p_no_speech/total]

    # Sentiment probabilities (correlated with account behaviour)
    pos_base = np.clip(ontime * 0.5 + ptp_rel * 0.3 + rng.uniform(-0.1, 0.1), 0.05, 0.65)
    neg_base = np.clip((1-ontime)*0.4 + rng.uniform(0, 0.2), 0.05, 0.60)
    neu_base = max(0.05, 1 - pos_base - neg_base)
    total_s  = pos_base + neu_base + neg_base
    sent_probs = [pos_base/total_s, neu_base/total_s, neg_base/total_s]

    # PTP outcome probs (correlated with ptp_reliability)
    p_ptp_cap = np.clip(ptp_rel * 0.6 + rng.uniform(-0.1, 0.1), 0.05, 0.70)
    p_no_ptp  = np.clip(rng.uniform(0.15, 0.35), 0.10, 0.40)
    p_refused = np.clip((1-ptp_rel)*0.3 + rng.uniform(0, 0.1), 0.03, 0.30)
    p_broken  = np.clip((1-ptp_rel)*0.2, 0.02, 0.20)
    p_dispute = np.clip(rng.uniform(0.01, 0.06), 0.01, 0.08)
    total_p   = p_ptp_cap + p_no_ptp + p_refused + p_broken + p_dispute
    ptp_fin_probs = [p_ptp_cap/total_p, p_no_ptp/total_p,
                     p_broken/total_p, p_refused/total_p, p_dispute/total_p]

    for call_idx in range(n_calls):
        call_num += 1

        # Call date — spread over last 90 days, recent calls more likely
        days_ago = int(rng.integers(0, 90))
        call_dt  = TODAY - timedelta(days=days_ago,
                                     hours=int(rng.integers(8, 22)),
                                     minutes=int(rng.integers(0, 60)))

        # Agent — AI bot for AI-only, mix otherwise
        if handling == 'AI Only':
            agent = AGENTS[7]  # AI-BOT
        elif handling == 'Human Led':
            agent = AGENTS[int(rng.integers(0, 7))]
        else:
            agent = AGENTS[7] if rng.random() < 0.55 else AGENTS[int(rng.integers(0, 7))]

        # Status
        status = rng.choice(STATUSES, p=status_probs)

        # Duration
        if status == 'FINISHED':
            duration_sec = int(np.clip(rng.lognormal(4.0, 0.8), 15, 600))
        elif status in ['DECLINED BY USER', 'NO CUSTOMER SPEECH']:
            duration_sec = int(rng.integers(0, 45))
        else:
            duration_sec = 0

        # Sentiment — only for FINISHED
        if status == 'FINISHED':
            sentiment = rng.choice(SENTIMENTS, p=sent_probs)
        else:
            sentiment = 'N/A'

        # PTP outcome — only for FINISHED
        if status == 'FINISHED':
            ptp_outcome = rng.choice(
                ['PTP Captured','No PTP','Broken PTP','Refused','Dispute'],
                p=ptp_fin_probs
            )
            ptp_amount = int(rng.integers(1, 16) * 500 * (acc['monthly_installment_sar'] / 1000)) \
                         if ptp_outcome == 'PTP Captured' else 0
            ptp_amount = min(ptp_amount, int(acc['outstanding_balance_sar']))
        else:
            ptp_outcome = 'No Contact'
            ptp_amount  = 0

        # Call quality score
        if status == 'FINISHED':
            if sentiment == 'Positive':
                call_score = round(rng.uniform(6.5, 10.0), 1)
            elif sentiment == 'Neutral':
                call_score = round(rng.uniform(4.0, 7.5), 1)
            else:
                call_score = round(rng.uniform(1.0, 5.0), 1)
        else:
            call_score = None

        # Direction
        direction = 'Web' if rng.random() < 0.034 else 'Outbound'

        # Latency
        latency_ms = int(rng.lognormal(7.2, 0.9))

        call_events.append({
            'call_id':            f'CE-{call_num}',
            'call_datetime':      call_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'call_date':          call_dt.strftime('%Y-%m-%d'),
            'call_time':          call_dt.strftime('%H:%M:%S'),
            'account_id':         acc['account_id'],
            'customer_name':      acc['customer_name'],
            'delinquency_bucket': bucket,
            'direction':          direction,
            'status':             status,
            'duration_sec':       duration_sec,
            'duration_fmt':       f"{duration_sec//60}m {duration_sec%60}s" if duration_sec > 0 else '0s',
            'agent_id':           agent[0],
            'agent_name':         agent[1],
            'agent_type':         agent[2],
            'sentiment':          sentiment,
            'ptp_outcome':        ptp_outcome,
            'ptp_amount_sar':     int(ptp_amount),
            'latency_ms':         latency_ms,
            'call_score':         call_score,
        })

call_df = pd.DataFrame(call_events).sort_values('call_datetime').reset_index(drop=True)
print(f"      Generated {len(call_df):,} call events across {len(df):,} accounts")
print(f"      Avg calls per account: {len(call_df)/len(df):.1f}")

# ─────────────────────────────────────────────────────────────
# STEP 3 — Aggregate call features per account
# ─────────────────────────────────────────────────────────────
print("\n[3/5] Aggregating call features per account...")

SENTIMENT_SCORE = {'Positive': 1.0, 'Neutral': 0.0, 'Negative': -1.0, 'N/A': 0.0}
call_df['sentiment_num'] = call_df['sentiment'].map(SENTIMENT_SCORE)

agg = call_df.groupby('account_id').apply(lambda g: pd.Series({
    # Volume
    'total_calls_made':      len(g),
    'calls_last_30d':        int((pd.to_datetime(g['call_datetime']) >= pd.Timestamp(TODAY - timedelta(days=30))).sum()),

    # Contact quality
    'call_answer_rate':      round(float((g['status'] == 'FINISHED').mean()), 3),
    'call_no_answer_rate':   round(float((g['status'] == 'USER DID NOT ANSWER').mean()), 3),
    'call_avg_duration_sec': round(float(g.loc[g['status']=='FINISHED','duration_sec'].mean()), 1)
                             if (g['status']=='FINISHED').any() else 0.0,

    # Sentiment
    'call_sentiment_score':  round(float(g.loc[g['status']=='FINISHED','sentiment_num'].mean()), 3)
                             if (g['status']=='FINISHED').any() else 0.0,
    'call_positive_rate':    round(float((g['sentiment']=='Positive').mean()), 3),
    'call_negative_rate':    round(float((g['sentiment']=='Negative').mean()), 3),

    # PTP from calls
    'call_ptp_capture_rate': round(float(
        (g['ptp_outcome']=='PTP Captured').sum() /
        max((g['status']=='FINISHED').sum(), 1)
    ), 3),
    'call_refused_rate':     round(float(
        (g['ptp_outcome']=='Refused').sum() /
        max((g['status']=='FINISHED').sum(), 1)
    ), 3),
    'call_broken_ptp_rate':  round(float(
        (g['ptp_outcome']=='Broken PTP').sum() /
        max((g['ptp_outcome']=='PTP Captured').sum(), 1)
    ), 3),
    'call_total_ptp_value':  int(g['ptp_amount_sar'].sum()),

    # Recency
    'last_call_days_ago':    int((TODAY - pd.to_datetime(g['call_datetime']).max()).days),
    'last_call_outcome':     g.sort_values('call_datetime').iloc[-1]['status'],
    'last_call_sentiment':   g.sort_values('call_datetime').iloc[-1]['sentiment'],
    'last_call_ptp':         g.sort_values('call_datetime').iloc[-1]['ptp_outcome'],

    # Quality
    'call_quality_avg':      round(float(g['call_score'].dropna().mean()), 2)
                             if g['call_score'].notna().any() else None,

    # Agent
    'ai_call_share':         round(float((g['agent_type']=='AI').mean()), 3),
})).reset_index()

# Fill NaN call_quality_avg
agg['call_quality_avg'] = agg['call_quality_avg'].fillna(0.0)
agg['call_broken_ptp_rate'] = agg['call_broken_ptp_rate'].fillna(0.0)

print(f"      Aggregated {len(agg):,} account call profiles")
print(f"      New call features: {len(agg.columns)-1}")

# ─────────────────────────────────────────────────────────────
# STEP 4 — Merge with account dataset
# ─────────────────────────────────────────────────────────────
print("\n[4/5] Merging account data with call features...")

# Drop old aggregated call columns (will be replaced by real ones)
cols_to_drop = [
    'call_pickup_rate', 'sms_response_rate', 'whatsapp_response_rate',
    'email_response_rate', 'days_since_last_contact', 'contact_attempts_30d',
    'right_party_contact_rate'
]
df_clean = df.drop(columns=[c for c in cols_to_drop if c in df.columns])

unified = df_clean.merge(agg, on='account_id', how='left')

# Fill any accounts with no calls (shouldn't happen but safety net)
call_cols = [c for c in agg.columns if c != 'account_id']
for col in call_cols:
    if unified[col].dtype in ['float64', 'float32']:
        unified[col] = unified[col].fillna(0.0)
    elif unified[col].dtype in ['int64', 'int32']:
        unified[col] = unified[col].fillna(0).astype(int)
    else:
        unified[col] = unified[col].fillna('N/A')

print(f"      Unified dataset: {unified.shape[0]:,} rows × {unified.shape[1]} columns")

# ─────────────────────────────────────────────────────────────
# STEP 5 — Re-compute ML target with new call features
# The logit now includes call behaviour signals
# ─────────────────────────────────────────────────────────────
print("\n[5/5] Recomputing ML target with call features...")

def compute_unified_logit(row):
    ptp_rel = row['ptp_reliability_rate'] if not pd.isna(row['ptp_reliability_rate']) else 0.5
    bucket_map = {'1-30 DPD':1,'31-60 DPD':2,'61-90 DPD':3,'NPA':4,'Write-off':5}
    bsev = bucket_map.get(row['delinquency_bucket'], 3)

    logit = (
        # Original payment features
          3.5 * row['ontime_payment_ratio']
        + 2.2 * ptp_rel
        + 1.9 * (1 - min(row['dti_ratio'], 1.0))
        + 1.6 * (1 if row['days_to_next_salary'] <= 4 else 0)
        + 0.8 * (row['bureau_score_at_origination'] / 900)
        - 3.2 * (row['current_dpd'] / 180)
        - 2.1 * (row['consecutive_broken_ptps'] / 5)
        - 1.6 * float(row['job_loss_flag'])
        - 1.4 * (row['other_active_loans'] / 5)
        - 1.1 * (row['max_dpd_ever'] / 365)
        - 0.7 * float(row['fraud_suspected_flag'])
        - bsev * 0.9

        # NEW: call behaviour features
        + 2.0 * row['call_answer_rate']           # picks up phone → more likely to pay
        + 1.8 * row['call_sentiment_score']        # positive tone → cooperative
        + 1.5 * row['call_ptp_capture_rate']       # made PTPs from calls → intent to pay
        - 1.4 * row['call_refused_rate']           # refused → not cooperative
        - 1.2 * row['call_broken_ptp_rate']        # broke PTPs from calls → unreliable
        + 0.8 * (1 if row['last_call_sentiment'] == 'Positive' else
                 -0.5 if row['last_call_sentiment'] == 'Negative' else 0)
        + 0.6 * (1 if row['last_call_ptp'] == 'PTP Captured' else
                 -0.8 if row['last_call_ptp'] == 'Refused' else 0)
        + 0.4 * row['ai_call_share']               # AI-handled → better segmented
        - 0.3 * min(row['last_call_days_ago'] / 30, 1)  # stale contact → decay

        - 1.8  # intercept
        + np.random.normal(0, 0.55)  # noise
    )
    return logit

np.random.seed(2026)
unified['logit']          = unified.apply(compute_unified_logit, axis=1)
unified['pay_probability'] = np.clip(1 / (1 + np.exp(-unified['logit'])), 0.02, 0.98).round(3)
unified['ptp_score']       = np.clip(300 + unified['pay_probability'] * 550, 300, 850).astype(int)
unified['risk_tier']       = unified['ptp_score'].apply(
    lambda s: 'Low Risk' if s>=700 else 'Medium Risk' if s>=550 else 'High Risk' if s>=400 else 'Very High Risk'
)
unified['recommended_channel'] = unified['ptp_score'].apply(
    lambda s: 'SMS' if s>=700 else 'WhatsApp' if s>=550 else 'AI Voice' if s>=400 else 'Human Agent'
)
unified['handling_type'] = unified['ptp_score'].apply(
    lambda s: 'AI Only' if s>=600 else 'AI + Human' if s>=450 else 'Human Led'
)
unified = unified.drop(columns=['logit'])

# ─────────────────────────────────────────────────────────────
# VALIDATION
# ─────────────────────────────────────────────────────────────
print("\n── Validation ──────────────────────────────────────")
print(f"Unified dataset:  {unified.shape[0]:,} rows × {unified.shape[1]} columns")
print(f"Call events:      {len(call_df):,} rows × {call_df.shape[1]} columns")
print(f"\nNew call feature sample stats:")
print(f"  Avg calls/account:       {unified['total_calls_made'].mean():.1f}")
print(f"  Avg answer rate:         {unified['call_answer_rate'].mean():.1%}")
print(f"  Avg sentiment score:     {unified['call_sentiment_score'].mean():.3f}")
print(f"  Avg PTP capture rate:    {unified['call_ptp_capture_rate'].mean():.1%}")
print(f"  Avg AI call share:       {unified['ai_call_share'].mean():.1%}")
print(f"\nML target distribution:")
for tier, n in unified['risk_tier'].value_counts().items():
    print(f"  {tier:<20} {n:>5,} ({n/len(unified)*100:.1f}%)")
print(f"\nScore range:    {unified['ptp_score'].min()}–{unified['ptp_score'].max()}")
print(f"Avg PTP score:  {unified['ptp_score'].mean():.0f}")

# ─────────────────────────────────────────────────────────────
# SAVE
# ─────────────────────────────────────────────────────────────
unified.to_csv('data/wataniya_ibe_unified.csv', index=False)
call_df.to_csv('data/call_events.csv', index=False)

print(f"\n✓ Saved: data/wataniya_ibe_unified.csv  ({unified.shape[0]:,} rows × {unified.shape[1]} cols)")
print(f"✓ Saved: data/call_events.csv           ({len(call_df):,} rows × {call_df.shape[1]} cols)")
print("\n" + "=" * 60)
print("Next step: run train_unified_model.py")
print("=" * 60)