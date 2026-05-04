"""
generate_call_events.py
Generates 70,000 call records across the last 90 days, linked to
backend/data/wataniya_accounts.csv loan_ids.

Columns added in this version:
  sub_call_result      — detailed sub-result per main call_result
  ai_proposed_response — AI suggested response (support calls only)
  ticket_created       — whether a ticket was raised (true/false)
  sms_template_triggered — SMS template name if triggered, else empty
  (sms_triggered removed; use sms_template_triggered != '' instead)
"""

import csv
import os
import random
from datetime import date, timedelta, datetime

import pandas as pd
import numpy as np

SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
ACCOUNTS_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'wataniya_accounts.csv')
OUTPUT_PATH   = os.path.join(SCRIPT_DIR, '..', 'data', 'call_events.csv')

TODAY      = date(2026, 4, 28)
START_DATE = TODAY - timedelta(days=89)
N_CALLS    = 70_000
FRIDAY     = 4

rng = np.random.default_rng(seed=99)

# ── Agent pools by bucket ──────────────────────────────────────────────────────
BUCKET_AGENTS = {
    '0 Days':      ['Manal Sami Almusaad', 'Hala Salem Alqahtani',
                    'Fozyah Abdulaziz Alkhulifi', 'Mohammed Saleh Aldalbahi'],
    '1-30 Days':   ['Manal Sami Almusaad', 'Hala Salem Alqahtani',
                    'Fozyah Abdulaziz Alkhulifi', 'Mohammed Saleh Aldalbahi'],
    '31-60 Days':  ['Manal Sami Almusaad', 'Hala Salem Alqahtani',
                    'Fozyah Abdulaziz Alkhulifi', 'Mohammed Saleh Aldalbahi',
                    'Anisha', 'Sheetal'],
    '61-90 Days':  ['Manal Sami Almusaad', 'Hala Salem Alqahtani',
                    'Fozyah Abdulaziz Alkhulifi', 'Mohammed Saleh Aldalbahi'],
    'NPA 91-180':  ['Manal Salem Madi', 'Mohammed Aedh Alharthi',
                    'Fotoon Abdullah Khathran', 'Atheer Alhwasheil',
                    'Alanoud Ibrahim Almaslmani', 'Alanoud Saud Alotaibi',
                    'Amjd Ibrahim Al-Hazmi', 'Fahad Laili Obaid AlMarei'],
    'NPA 181-360': ['Hajir Obaid Al-Otaibi', 'Faez Abdualh Satem Mohamed',
                    'Ibrahim Abyan', 'Abdulrahman Bakheet Al Otaibi',
                    'Samar Fahad Alharbi', 'Atheer Alhwasheil'],
    'NPA 361-450': ['Sultan Fahad Alinzee', 'Sarah Abdulaziz Aljurayyad',
                    'Hajir Obaid Al-Otaibi', 'Faez Abdualh Satem Mohamed'],
    'Write-Off':   ['Amjd Ibrahim Al-Hazmi', 'Fahad Laili Obaid AlMarei',
                    'Mishaal Suleiman Alsaeed', 'khalid Aytim Alanazi',
                    'Fahad Abdulaziz Alateeq', 'Trad Khaled Alharbi',
                    'Suleiman Alhodhaif', 'Nawaf Suliman Aldayel',
                    'Abdulrahman Al Otaibi'],
}

IVR_AGENTS_BY_BUCKET = {
    '0 Days':      'IVR-61-90',
    '1-30 Days':   'IVR-61-90',
    '31-60 Days':  'IVR PKT-2',
    '61-90 Days':  'IVR-61-90',
    'NPA 91-180':  'IVR-NPA-91-180',
    'NPA 181-360': 'IVR-NPA-181-360',
    'NPA 361-450': 'IVR-NPA-361-450',
    'Write-Off':   'IVR-WriteOff+450',
}

NABA_AGENTS_BY_BUCKET = {
    '0 Days':      'Sawt-PKT-3',
    '1-30 Days':   'Sawt-PKT-3',
    '31-60 Days':  'Sarja-PKT-3',
    '61-90 Days':  'Sarja-PKT-3',
    'NPA 91-180':  'Sawt-NPA-91-180',
    'NPA 181-360': 'Sarja-NPA-181-360',
    'NPA 361-450': 'Sawt-NPA-361-450',
    'Write-Off':   'Sawt-WriteOff+450',
}

ALL_HUMAN_AGENTS = sorted({a for agents in BUCKET_AGENTS.values() for a in agents})
AGENT_EXTENSION  = {a: f"90{str(i+1).zfill(2)}" for i, a in enumerate(ALL_HUMAN_AGENTS)}
IVR_NUMBER  = '+966920001001'
NABA_NUMBER = '+966920001002'

CHANNEL_WEIGHTS = {
    '0 Days':      [0.10, 0.65, 0.25],
    '1-30 Days':   [0.20, 0.55, 0.25],
    '31-60 Days':  [0.38, 0.40, 0.22],
    '61-90 Days':  [0.45, 0.35, 0.20],
    'NPA 91-180':  [0.42, 0.30, 0.28],
    'NPA 181-360': [0.50, 0.30, 0.20],
    'NPA 361-450': [0.50, 0.33, 0.17],
    'Write-Off':   [0.50, 0.30, 0.20],
}

BUCKET_WEIGHT = {
    '0 Days':      1,
    '1-30 Days':   4,
    '31-60 Days':  7,
    '61-90 Days':  9,
    'NPA 91-180':  11,
    'NPA 181-360': 11,
    'NPA 361-450': 10,
    'Write-Off':   9,
}

# ── Collection call result taxonomy ───────────────────────────────────────────
COLLECTION_RESULTS = ['No Answer', 'Promise to Pay', 'Refused', 'Paid',
                      'Switched Off', 'Needs Follow-up', 'Wrong Number',
                      'Escalation to Supervisor']
COLLECTION_PROB    = [0.35, 0.20, 0.12, 0.05, 0.10, 0.10, 0.05, 0.03]

COLLECTION_SUB = {
    'No Answer':                ['Phone Not Answered', 'Busy Signal',
                                 'Out of Coverage', 'Voicemail Reached'],
    'Promise to Pay':           ['Full Payment Promise', 'Partial Payment Promise',
                                 'Installment Plan Agreed', 'Salary Date Commitment'],
    'Refused':                  ['Disputed Amount', 'Cannot Afford at This Time',
                                 'Requests More Time', 'Claims Already Settled'],
    'Paid':                     ['Full Settlement Confirmed', 'Partial Payment Made'],
    'Switched Off':             ['Phone Switched Off', 'Number Unreachable',
                                 'Number Changed or Discontinued'],
    'Needs Follow-up':          ['Callback Requested', 'Awaiting Documentation',
                                 'Pending Salary Transfer', 'Partial Info Gathered'],
    'Wrong Number':             ['Wrong Contact Reached', 'Number Not Registered',
                                 'Third Party Answered'],
    'Escalation to Supervisor': ['High Value Dispute', 'Complex Legal Case',
                                 'Fraud Suspicion Raised', 'Sensitive Customer Profile'],
}

# ── Support call taxonomy (from collection_related_support_service.xlsx) ───────
# ~8% of inbound agent calls are support-type
SUPPORT_TAXONOMY = [
    # (main_result, sub_result, ai_response, ticket_created, sms_action)
    ('complaint', 'customer complaint against an employee',
     'Thank you for your feedback. The matter will be investigated, and appropriate action will be taken.',
     True, None),
    ('complaint', 'Legal - Suspend',
     'Suspend request will be processed after payment confirmation.',
     True, None),
    ('complaint', 'Payment Not posted',
     'The payment allocation will be reviewed and corrected if required.',
     True, None),
    ('complaint', 'cancel promissory note',
     'The cancellation will be processed upon full settlement and submission to the relevant authority.',
     True, None),
    ('complaint', 'close contract after payment',
     'Your request will be reviewed, and closure will be processed if eligible.',
     True, None),
    ('complaint', 'Refund',
     'Your refund complaint has been recorded and will be processed accordingly.',
     True, None),
    ('inquire', 'Payment methods',
     'You can complete the payment through the mobile application or using the SADAD invoice number.',
     False, 'send mobile link and sadad number'),
    ('inquire', 'Installment schedule / Loan financial statement',
     'The financing terms include repayment period, installment amount, and profit rate as per policy.',
     False, None),
    ('inquire', 'SIMAH update',
     'Your status will be updated with SIMAH after the payment is reflected in the system.',
     False, None),
    ('inquire', 'Early settlement',
     'Share SAMA rule and amount from core system for early settlement calculation.',
     False, None),
    ('inquire', 'status of application',
     'Your request is currently under process. You will be updated once there is progress.',
     False, 'share stage and status update'),
    ('inquire', 'apply for a product through the website',
     'You can apply through the official website or mobile application by selecting the desired product.',
     False, 'send product link'),
    ('inquire', 'Reschedule terms',
     'Rescheduling depends on account status and delay period. Eligibility will be reviewed accordingly.',
     True, None),
    ('inquire', 'Write-off',
     'Discounts are subject to company policy, and your eligibility will be assessed.',
     True, None),
    ('Request', 'send the invoice number',
     'The invoice number has been sent to your registered mobile number.',
     False, 'share by SMS'),
    ('Request', 'send contract copy',
     'The request has been registered, and the contract copy will be shared via email.',
     False, 'share by email'),
    ('Request', 'Contact to collection department',
     'Your request has been forwarded to the collections team, and they will contact you.',
     True, None),
    ('Request', 'cancel request / contract loan',
     'Your cancellation request has been received and is under review.',
     True, None),
    ('Technical issue', 'Call disconnection',
     'We apologize for the disconnection. We will call you back to continue assisting you.',
     False, None),
    ('Technical issue', 'No response- callback',
     'Our team will contact you shortly to assist you.',
     False, None),
    ('Technical issue', 'No response during customer service',
     'We apologize for the issue. A technical ticket has been raised for resolution.',
     False, None),
]

# ── SMS template names from Notification_Module.xlsx ─────────────────────────
def get_sms_template(result: str, bucket: str) -> str:
    """Return SMS template name when sms should be triggered, else empty string."""
    if result not in ('No Answer', 'Switched Off', 'Promise to Pay'):
        return ''
    if result in ('No Answer', 'Switched Off'):
        return 'Mobile_Update_EN'
    # Promise to Pay — template by bucket
    template_map = {
        '0 Days':      'Bucket1_EN',
        '1-30 Days':   'Bucket1_EN',
        '31-60 Days':  'Bucket2_EN',
        '61-90 Days':  'PKT3_PreLegal_EN',
        'NPA 91-180':  'NPA_Offer_EN',
        'NPA 181-360': 'NPA_Offer_EN',
        'NPA 361-450': 'Legal_Warning_EN',
        'Write-Off':   'Write_Off_EN',
    }
    return template_map.get(bucket, 'Bucket1_EN')

# ── Duration ranges (seconds) by collection result ────────────────────────────
DURATION_RANGE = {
    'No Answer':                (0,   25),
    'Switched Off':             (0,   20),
    'Wrong Number':             (10,  55),
    'Paid':                     (60,  300),
    'Promise to Pay':           (120, 600),
    'Refused':                  (60,  280),
    'Needs Follow-up':          (60,  480),
    'Escalation to Supervisor': (180, 600),
    # support results
    'complaint':                (90,  420),
    'inquire':                  (60,  300),
    'Request':                  (60,  360),
    'Technical issue':          (30,  180),
}

# ── Call summaries by result ───────────────────────────────────────────────────
SUMMARIES = {
    'No Answer': [
        "Call attempt made. Customer did not answer. SMS follow-up triggered.",
        "No response after multiple rings. Customer unavailable. SMS sent.",
        "Outbound call unanswered. Auto-SMS notification dispatched.",
        "Customer did not pick up. Retry scheduled. SMS triggered.",
    ],
    'Switched Off': [
        "Customer mobile switched off. SMS triggered. Follow-up scheduled.",
        "Unable to reach customer — mobile appears switched off. NABA notification sent.",
        "Number switched off at time of call. Retry queued.",
        "Customer phone off. SMS sent. Case flagged for next-day follow-up.",
    ],
    'Wrong Number': [
        "Wrong number reached. Contact details require verification.",
        "Number not in service / wrong party answered. Profile update needed.",
        "Third party answered and confirmed wrong number. CIF update required.",
        "Incorrect number — customer contact details flagged for review.",
    ],
    'Paid': [
        "Customer confirmed payment of SAR {amt} via SADAD. Account updated.",
        "Customer reported full settlement of overdue. Payment verified.",
        "Customer made partial payment of SAR {amt}. Balance adjusted.",
        "Payment received. Customer confirmed bank transfer. Record updated.",
    ],
    'Promise to Pay': [
        "Customer agreed to pay SAR {amt} by {ptp_date}. PTP recorded. SMS sent.",
        "Spoke with customer. PTP secured for SAR {amt} on {ptp_date}.",
        "Customer committed to payment of SAR {amt} by {ptp_date}.",
        "PTP confirmed — SAR {amt} expected by {ptp_date}. Reminder SMS sent.",
    ],
    'Refused': [
        "Customer refused to pay. Cited financial difficulty. Escalation may be needed.",
        "Customer acknowledged debt but declined payment arrangement.",
        "Refused to commit to payment. Reason: disputed amount. Case documented.",
        "Customer stated inability to pay at this time. Follow-up in 7 days.",
    ],
    'Needs Follow-up': [
        "Customer acknowledged overdue. Requested callback. Follow-up logged.",
        "Spoke with customer. Requires more time to arrange payment. Callback set.",
        "Customer asked for additional details on outstanding balance. Follow-up scheduled.",
        "Partial conversation. Customer requested follow-up call next week.",
    ],
    'Escalation to Supervisor': [
        "Customer requested supervisor. Call escalated. Supervisor notified.",
        "Complex dispute raised. Escalated for supervisor review.",
        "Customer disputed outstanding amount. Supervisor escalation initiated.",
        "Legal threat raised by customer. Escalated to senior team.",
    ],
}

CALL_PURPOSES = ['Collection', 'Follow-up', 'Legal Notice', 'Settlement Offer', 'Payment Confirmation']
PURPOSE_PROB  = [0.60, 0.20, 0.08, 0.07, 0.05]

ESC_TYPES = ['Supervisor', 'Legal', 'AI Retry']
ESC_PROB  = [0.60, 0.25, 0.15]


def random_call_time() -> str:
    hour_weights = {
        9: 12, 10: 16, 11: 16, 12: 8,
        13: 14, 14: 16, 15: 15, 16: 12,
        17: 8,  18: 6,  19: 4,  20: 3,
    }
    hours  = list(hour_weights.keys())
    probs  = np.array(list(hour_weights.values()), dtype=float)
    probs /= probs.sum()
    h = int(rng.choice(hours, p=probs))
    m = int(rng.integers(0, 60))
    s = int(rng.integers(0, 60))
    return f"{h:02d}:{m:02d}:{s:02d}"


def random_workday(lo: date, hi: date) -> date:
    d = lo + timedelta(days=int(rng.integers(0, (hi - lo).days + 1)))
    attempts = 0
    while d.weekday() == FRIDAY:
        d = lo + timedelta(days=int(rng.integers(0, (hi - lo).days + 1)))
        attempts += 1
        if attempts > 200:
            break
    return d


def build_call(i: int, account: dict) -> dict:
    bucket  = account['dpd_bucket']
    overdue = float(account['overdue_amount'])
    mobile  = str(int(account['mobile_number']))

    # Channel
    cw      = CHANNEL_WEIGHTS[bucket]
    channel = str(rng.choice(['Agent Call', 'IVR/Robot', 'NABA'], p=cw))

    # Agent
    if channel == 'Agent Call':
        agent  = str(rng.choice(BUCKET_AGENTS[bucket]))
        caller = AGENT_EXTENSION.get(agent, '9000')
    elif channel == 'IVR/Robot':
        agent  = IVR_AGENTS_BY_BUCKET[bucket]
        caller = IVR_NUMBER
    else:
        agent  = NABA_AGENTS_BY_BUCKET[bucket]
        caller = NABA_NUMBER

    # Direction
    if channel == 'NABA':
        direction = 'Outbound'
    elif channel == 'IVR/Robot':
        direction = 'Outbound' if rng.random() < 0.92 else 'Inbound'
    else:
        direction = 'Outbound' if rng.random() < 0.87 else 'Inbound'

    call_date = random_workday(START_DATE, TODAY)
    call_time = random_call_time()

    # Determine if this is a support call (~8% of inbound agent calls)
    is_support = (channel == 'Agent Call' and direction == 'Inbound'
                  and rng.random() < 0.08)

    if is_support:
        # Pick a support taxonomy entry
        entry = SUPPORT_TAXONOMY[int(rng.integers(0, len(SUPPORT_TAXONOMY)))]
        main_result, sub_result, ai_response, ticket, sms_action = entry
        duration   = int(rng.integers(*DURATION_RANGE.get(main_result, (60, 360))))
        summary    = f"Support call: {sub_result}. {ai_response[:80]}"
        purpose    = 'Support / Inquiry'
        esc_type   = ''
        ptp_amount = ''
        ptp_date_s = ''
        ticket_created  = 'true' if ticket else 'false'
        sms_template    = ''  # support calls don't trigger collection SMS templates
        call_result     = main_result
    else:
        # Collection call
        result     = str(rng.choice(COLLECTION_RESULTS, p=COLLECTION_PROB))
        call_result = result
        main_result = result
        sub_result  = str(rng.choice(COLLECTION_SUB[result]))
        ai_response = ''

        lo_d, hi_d = DURATION_RANGE[result]
        duration   = int(rng.integers(lo_d, hi_d + 1))

        ptp_amount = ''
        ptp_date_s = ''
        if result == 'Promise to Pay':
            base_amt   = max(overdue * float(rng.uniform(0.25, 1.0)), 500.0)
            ptp_amount = round(min(base_amt, 80000), 2)
            days_ahead = int(rng.integers(3, 31))
            ptp_date_s = (call_date + timedelta(days=days_ahead)).isoformat()

        templates = SUMMARIES[result]
        tmpl = str(rng.choice(templates))
        if result == 'Promise to Pay':
            summary = tmpl.format(amt=f"{ptp_amount:,.0f}", ptp_date=ptp_date_s)
        elif result == 'Paid':
            paid_amt = max(overdue * float(rng.uniform(0.2, 1.0)), 200.0)
            summary  = tmpl.format(amt=f"{paid_amt:,.0f}")
        else:
            summary = tmpl

        purpose = str(rng.choice(CALL_PURPOSES, p=PURPOSE_PROB))

        if result == 'Escalation to Supervisor':
            esc_type = str(rng.choice(ESC_TYPES, p=ESC_PROB))
        elif result == 'No Answer' and rng.random() < 0.12:
            esc_type = 'AI Retry'
        else:
            esc_type = ''

        # Ticket created for escalations and some refused/disputes
        if result == 'Escalation to Supervisor':
            ticket_created = 'true'
        elif result == 'Refused' and 'Disputed' in sub_result:
            ticket_created = 'true' if rng.random() < 0.6 else 'false'
        else:
            ticket_created = 'false'

        sms_template = get_sms_template(result, bucket)

    return {
        'call_id':                f"CALL-{i+1:06d}",
        'loan_id':                account['loan_id'],
        'agent_name':             agent,
        'call_date':              call_date.isoformat(),
        'call_time':              call_time,
        'call_duration_seconds':  duration,
        'caller_number':          caller,
        'customer_number':        mobile,
        'call_direction':         direction,
        'call_channel':           channel,
        'call_result':            call_result,
        'sub_call_result':        sub_result,
        'ai_proposed_response':   ai_response,
        'ticket_created':         ticket_created,
        'ptp_amount':             ptp_amount,
        'ptp_date':               ptp_date_s,
        'call_summary':           summary,
        'call_purpose':           purpose,
        'escalation_type':        esc_type,
        'sms_template_triggered': sms_template,
        'dpd_bucket':             bucket,
        'product_type':           account['product_type'],
    }


FIELDNAMES = [
    'call_id', 'loan_id', 'agent_name', 'call_date', 'call_time',
    'call_duration_seconds', 'caller_number', 'customer_number',
    'call_direction', 'call_channel', 'call_result', 'sub_call_result',
    'ai_proposed_response', 'ticket_created', 'ptp_amount', 'ptp_date',
    'call_summary', 'call_purpose', 'escalation_type', 'sms_template_triggered',
    'dpd_bucket', 'product_type',
]


def main():
    print("Loading accounts...")
    accounts_df = pd.read_csv(
        ACCOUNTS_PATH,
        usecols=['loan_id', 'mobile_number', 'dpd_bucket', 'product_type', 'overdue_amount']
    )
    accounts_df['overdue_amount'] = accounts_df['overdue_amount'].fillna(0)
    accounts_df['_w'] = accounts_df['dpd_bucket'].map(BUCKET_WEIGHT).fillna(1).astype(float)
    total_w = accounts_df['_w'].sum()
    accounts_df['_p'] = accounts_df['_w'] / total_w

    sampled_idx = rng.choice(len(accounts_df), size=N_CALLS, replace=True,
                             p=accounts_df['_p'].values)
    account_records = accounts_df.to_dict('records')

    print(f"Generating {N_CALLS:,} call records...")
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    with open(OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        for i, idx in enumerate(sampled_idx):
            row = build_call(i, account_records[idx])
            writer.writerow(row)
            if (i + 1) % 10000 == 0:
                print(f"  {i+1:,} / {N_CALLS:,}")

    print("\nVerifying output...")
    calls = pd.read_csv(OUTPUT_PATH)
    valid_ids   = set(accounts_df['loan_id'])
    in_accounts = calls['loan_id'].isin(valid_ids).all()

    print(f"[OK] Rows written          : {len(calls):,}")
    print(f"[{'OK' if in_accounts else 'FAIL'}] All loan_ids in accounts : {in_accounts}")
    print(f"     Unique loan_ids        : {calls['loan_id'].nunique():,}")
    print(f"     Date range             : {calls['call_date'].min()} -> {calls['call_date'].max()}")
    print(f"     Fridays in data        : "
          f"{sum(1 for d in calls['call_date'] if datetime.strptime(d,'%Y-%m-%d').weekday()==FRIDAY)}")

    print("\ncall_result distribution:")
    for r, p in (calls['call_result'].value_counts(normalize=True) * 100).round(1).items():
        print(f"  {r:<35} {p:5.1f}%")

    print("\ncall_channel distribution:")
    for ch, p in (calls['call_channel'].value_counts(normalize=True) * 100).round(1).items():
        print(f"  {ch:<20} {p:5.1f}%")

    sms_triggered = (calls['sms_template_triggered'].notna() &
                     (calls['sms_template_triggered'] != '')).sum()
    tickets = (calls['ticket_created'] == 'true').sum()
    support = calls['call_result'].isin(['complaint', 'inquire', 'Request', 'Technical issue']).sum()
    print(f"\nsms_template_triggered    : {sms_triggered:,}")
    print(f"ticket_created=true       : {tickets:,}")
    print(f"support calls             : {support:,}")
    print(f"ptp_amount populated      : {calls['ptp_amount'].notna().sum():,}")

    print("\nSMS templates used:")
    tmpl_counts = calls[calls['sms_template_triggered'].notna() &
                        (calls['sms_template_triggered'] != '')]['sms_template_triggered'].value_counts()
    for t, c in tmpl_counts.items():
        print(f"  {t:<30} {c:,}")


if __name__ == '__main__':
    main()
