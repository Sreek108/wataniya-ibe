"""
Real ML inference — replaces the simplified formula in main.py
Drop this into backend/ and import from main.py
"""

import numpy as np
import pandas as pd
import joblib
import os
import json

_models = {}
_meta   = {}

def _load():
    if _models:
        return
    base = os.path.dirname(os.path.abspath(__file__))
    m    = os.path.join(base, 'models')
    try:
        _models['lr']       = joblib.load(os.path.join(m, 'model_lr.pkl'))
        _models['rf']       = joblib.load(os.path.join(m, 'model_rf.pkl'))
        _models['gb']       = joblib.load(os.path.join(m, 'model_gb.pkl'))
        _models['broken']   = joblib.load(os.path.join(m, 'model_broken_ptp.pkl'))
        _models['features'] = joblib.load(os.path.join(m, 'feature_cols.pkl'))
        with open(os.path.join(m, 'feature_importance.json')) as f:
            _meta['importance'] = json.load(f)
        with open(os.path.join(m, 'model_metadata.json')) as f:
            _meta['metadata'] = json.load(f)
        print("✓ ML models loaded for real inference")
    except Exception as e:
        print(f"Model load error: {e}")

def _engineer(row: dict) -> dict:
    """
    Engineer features from raw inputs — matches train_models.py exactly
    """
    dpd         = row.get('current_dpd', 45)
    max_dpd     = row.get('max_dpd_ever', 90)
    ontime      = row.get('ontime_payment_ratio', 0.65)
    ptp_rel     = row.get('ptp_reliability_rate') or 0.5
    consec_brk  = row.get('consecutive_broken_ptps', 1)
    dti         = row.get('dti_ratio', 0.30)
    days_sal    = row.get('days_to_next_salary', 8)
    pickup      = row.get('call_pickup_rate', 0.5)
    wa          = row.get('whatsapp_response_rate', 0.55)
    income      = row.get('monthly_income_sar', 10000)
    other_loans = row.get('other_active_loans', 1)
    job_loss    = float(row.get('job_loss_flag', False))
    fraud       = float(row.get('fraud_suspected_flag', False))
    dispute     = float(row.get('dispute_flag', False))
    bureau      = row.get('bureau_score_at_origination', 620)
    bucket      = row.get('bucket', '31-60 DPD')
    months_ob   = row.get('months_on_book', 24)
    tenure      = row.get('loan_tenure_months', 48)
    months_last = row.get('months_since_last_payment', 2)
    avg_pay     = row.get('avg_payment_ratio', 0.70)
    partial_freq= row.get('partial_payment_frequency', 0.20)
    total_ptps  = row.get('total_ptps_made', 2)
    days_late   = row.get('avg_days_late_broken_ptp', 10)
    has_ptp     = float(row.get('has_active_ptp', False))
    sms_rate    = row.get('sms_response_rate', 0.40)
    days_contact= row.get('days_since_last_contact', 5)
    attempts_30 = row.get('contact_attempts_30d', 4)
    rpc         = row.get('right_party_contact_rate', 0.35)
    loan_amt    = row.get('loan_amount_sar', 50000)
    outstanding = row.get('outstanding_balance_sar', 35000)
    installment = row.get('monthly_installment_sar', 1200)
    rem_tenure  = row.get('remaining_tenure_months', 24)
    ptps_broken_total = row.get('ptps_broken', 1)

    bucket_map  = {'1-30 DPD':1,'31-60 DPD':2,'61-90 DPD':3,'NPA':4,'Write-off':5}
    bsev        = bucket_map.get(bucket, 3)

    # All 40 engineered features — must match FEATURE_COLS in train_models.py exactly
    feats = {
        # Delinquency
        'dpd_normalized':         dpd / 180,
        'max_dpd_normalized':     max_dpd / 365,
        'dpd_acceleration':       dpd / (max_dpd + 1),
        'bucket_severity':        bsev,
        'dpd_trend_encoded':      0,   # unknown from manual input
        'times_30dpd_log':        np.log1p(max(0, bsev - 1)),

        # Payment
        'payment_consistency':    ontime * (1 - partial_freq),
        'payment_momentum':       avg_pay * ontime,
        'recency_decay':          np.exp(-months_last / 3),
        'payment_coverage':       (installment * months_ob * avg_pay) / (loan_amt + 1),
        'ontime_payment_ratio':   ontime,
        'avg_payment_ratio':      avg_pay,

        # PTP
        'ptp_reliability_filled': ptp_rel,
        'ptp_volume_log':         np.log1p(total_ptps),
        'broken_ptp_ratio':       ptps_broken_total / (total_ptps + 1),
        'consecutive_broken_log': np.log1p(consec_brk),
        'days_late_normalized':   days_late / 45,
        'has_active_ptp_int':     has_ptp,

        # Channel
        'best_channel_score':     max(pickup, wa, sms_rate),
        'channel_diversity':      int(pickup>0.3) + int(wa>0.3) + int(sms_rate>0.3),
        'contact_recency':        np.exp(-days_contact / 14),
        'contact_intensity':      np.log1p(attempts_30),
        'call_pickup_rate':       pickup,
        'whatsapp_response_rate': wa,

        # Income
        'dti_stress':             max(0, dti - 0.33),
        'income_log':             np.log1p(income),
        'salary_urgency':         np.exp(-days_sal / 7),
        'salary_soon_flag':       float(days_sal <= 5),
        'debt_burden':            other_loans * dti,
        'bureau_normalized':      bureau / 900,
        'installment_to_income':  installment / (income + 1),
        'balance_to_income':      outstanding / (income * 12 + 1),

        # Loan lifecycle
        'tenure_completion':      months_ob / (tenure + 1),
        'remaining_tenure_log':   np.log1p(rem_tenure),
        'loan_maturity':          float(rem_tenure < 6),

        # Hardship
        'hardship_score':         job_loss*3 + fraud*4 + dispute*1,

        # Interactions
        'ptp_x_salary':           ptp_rel * np.exp(-days_sal / 7),
        'payment_x_contact':      (ontime * (1-partial_freq)) * max(pickup, wa, sms_rate),
        'dpd_x_broken':           (dpd/180) * (ptps_broken_total/(total_ptps+1)),
        'income_x_dti':           np.log1p(income) * (1 - dti),
        'risk_composite':         (dpd/180)*0.35 + (ptps_broken_total/(total_ptps+1))*0.25 + max(0,dti-0.33)*0.20 + (job_loss*3+fraud*4+dispute*1)/10*0.20,
    }
    return feats

def real_score(inputs: dict) -> dict:
    """
    Run real ML inference using trained ensemble models.
    Returns same structure as compute_score_from_request().
    """
    _load()

    if not _models:
        # Fallback to formula if models not loaded
        return _formula_fallback(inputs)

    try:
        feat_cols = _models['features']
        feats     = _engineer(inputs)

        # Build feature vector in correct column order
        X = np.array([[feats.get(col, 0.0) for col in feat_cols]])

        # Ensemble: 20% LR + 30% RF + 50% GB
        p_lr  = _models['lr'].predict_proba(X)[0][1]
        p_rf  = _models['rf'].predict_proba(X)[0][1]
        p_gb  = _models['gb'].predict_proba(X)[0][1]
        prob  = float(np.clip(0.20*p_lr + 0.30*p_rf + 0.50*p_gb, 0.02, 0.98))

        score = int(np.clip(300 + prob * 550, 300, 850))

        risk_tier = (
            'Low Risk'       if score >= 700 else
            'Medium Risk'    if score >= 550 else
            'High Risk'      if score >= 400 else
            'Very High Risk'
        )
        channel = (
            'SMS'          if score >= 700 else
            'WhatsApp'     if score >= 550 else
            'AI Voice'     if score >= 400 else
            'Human Agent'
        )
        handling = (
            'AI Only'    if score >= 600 else
            'AI + Human' if score >= 450 else
            'Human Led'
        )

        # Score breakdown (contribution of each factor group)
        f = feats
        breakdown = {
            'payment_history':   round(3.5 * f['ontime_payment_ratio'], 3),
            'ptp_reliability':   round(2.2 * f['ptp_reliability_filled'], 3),
            'dti_headroom':      round(1.9 * (1 - min(inputs.get('dti_ratio', 0.3), 1)), 3),
            'salary_alignment':  round(1.6 * f['salary_soon_flag'] + 0.5 * f['salary_urgency'], 3),
            'channel_response':  round(1.3 * f['call_pickup_rate'] + 1.1 * f['whatsapp_response_rate'], 3),
            'delinquency_depth': round(-3.2 * f['dpd_normalized'], 3),
            'broken_ptps':       round(-2.1 * (f['consecutive_broken_log'] / 2), 3),
            'hardship_flags':    round(-1.6 * float(inputs.get('job_loss_flag', False))
                                      - 0.7 * float(inputs.get('fraud_suspected_flag', False)), 3),
        }

        return {
            'ptp_score':           score,
            'pay_probability':     round(prob, 3),
            'risk_tier':           risk_tier,
            'recommended_channel': channel,
            'handling_type':       handling,
            'score_breakdown':     breakdown,
            'feature_importance':  _meta.get('importance', {}),
            'model_version':       _meta.get('metadata', {}).get('model_version', '1.0.0'),
            'inference_type':      'real_ensemble',  # ← proof it's the real model
        }

    except Exception as e:
        print(f"Real inference error: {e}, falling back to formula")
        return _formula_fallback(inputs)


def _formula_fallback(inputs: dict) -> dict:
    """Simplified formula — used only if model files fail to load"""
    bucket_map = {'1-30 DPD':1,'31-60 DPD':2,'61-90 DPD':3,'NPA':4,'Write-off':5}
    bsev = bucket_map.get(inputs.get('bucket','31-60 DPD'), 3)
    ptp_rel = inputs.get('ptp_reliability_rate') or 0.5

    logit = (
          3.5 * inputs.get('ontime_payment_ratio', 0.65)
        + 2.2 * ptp_rel
        + 1.9 * (1 - min(inputs.get('dti_ratio', 0.3), 1.0))
        + 1.6 * float(inputs.get('days_to_next_salary', 8) <= 4)
        + 1.3 * inputs.get('call_pickup_rate', 0.5)
        + 1.1 * inputs.get('whatsapp_response_rate', 0.55)
        - 3.2 * (inputs.get('current_dpd', 45) / 180)
        - 2.1 * (inputs.get('consecutive_broken_ptps', 1) / 5)
        - 1.6 * float(inputs.get('job_loss_flag', False))
        - bsev * 0.9 - 1.8
    )
    prob  = float(np.clip(1 / (1 + np.exp(-logit)), 0.02, 0.98))
    score = int(np.clip(300 + prob * 550, 300, 850))
    risk_tier = 'Low Risk' if score>=700 else 'Medium Risk' if score>=550 else 'High Risk' if score>=400 else 'Very High Risk'
    return {
        'ptp_score': score, 'pay_probability': round(prob, 3),
        'risk_tier': risk_tier,
        'recommended_channel': 'SMS' if score>=700 else 'WhatsApp' if score>=550 else 'AI Voice' if score>=400 else 'Human Agent',
        'handling_type': 'AI Only' if score>=600 else 'AI + Human' if score>=450 else 'Human Led',
        'score_breakdown': {}, 'feature_importance': {},
        'model_version': '1.0.0', 'inference_type': 'formula_fallback',
    }
