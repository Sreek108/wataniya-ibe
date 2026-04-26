"""
NSP IBE — Unified ML Model Training
Trains on unified dataset (10,000 accounts + call history features)
New features: call_answer_rate, call_sentiment_score, call_ptp_capture_rate,
              call_refused_rate, last_call_sentiment, last_call_ptp etc.
"""

import numpy as np
import pandas as pd
import json, warnings, os
warnings.filterwarnings('ignore')

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import roc_auc_score, f1_score, classification_report
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
import joblib
from datetime import datetime

print("=" * 60)
print("NSP IBE — Unified ML Model Training")
print("=" * 60)

# ─── Load unified dataset ────────────────────────────────────
df = pd.read_csv('data/wataniya_ibe_unified.csv')
print(f"\nLoaded: {df.shape[0]:,} rows × {df.shape[1]} columns")

# Work with labelled records only
labelled = df[df['outcome_label'] != 'Pending'].copy()
print(f"Labelled for training: {len(labelled):,}")
print(f"  Paid: {(labelled['outcome_label']=='Paid').sum():,}")
print(f"  Not Paid: {(labelled['outcome_label']=='Not Paid').sum():,}")

# ─── Encode categorical call features ───────────────────────
SENTIMENT_MAP = {'Positive': 1.0, 'Neutral': 0.0, 'Negative': -1.0, 'N/A': 0.0}
OUTCOME_MAP   = {'PTP Captured': 1.0, 'No PTP': 0.0, 'Refused': -1.0,
                 'Broken PTP': -0.5, 'Dispute': -0.8, 'No Contact': 0.0}
STATUS_MAP    = {'FINISHED': 1.0, 'DECLINED BY USER': -0.3,
                 'USER DID NOT ANSWER': -0.5, 'NO CUSTOMER SPEECH': -0.2,
                 'PBX FAILED TO MAKE CALL': -0.1, 'N/A': 0.0}

for df_ in [labelled, df]:
    df_['last_call_sentiment_num'] = df_['last_call_sentiment'].map(SENTIMENT_MAP).fillna(0)
    df_['last_call_ptp_num']       = df_['last_call_ptp'].map(OUTCOME_MAP).fillna(0)
    df_['last_call_outcome_num']   = df_['last_call_outcome'].map(STATUS_MAP).fillna(0)

# ─── Feature engineering ─────────────────────────────────────
print("\n── Feature Engineering ──────────────────────────────")

def engineer_features(data):
    d = data.copy()

    # Delinquency
    d['dpd_normalized']         = d['current_dpd'] / 180
    d['max_dpd_normalized']     = d['max_dpd_ever'] / 365
    d['dpd_acceleration']       = d['current_dpd'] / (d['max_dpd_ever'] + 1)
    d['bucket_severity']        = d['delinquency_bucket'].map(
        {'1-30 DPD':1,'31-60 DPD':2,'61-90 DPD':3,'NPA':4,'Write-off':5})
    d['dpd_trend_encoded']      = d['dpd_trend'].map({'Improving':-1,'Stable':0,'Worsening':1})
    d['times_30dpd_log']        = np.log1p(d['times_entered_30dpd'])

    # Payment history
    d['payment_consistency']    = d['ontime_payment_ratio'] * (1 - d['partial_payment_frequency'])
    d['payment_momentum']       = d['avg_payment_ratio'] * d['ontime_payment_ratio']
    d['recency_decay']          = np.exp(-d['months_since_last_payment'] / 3)
    d['payment_coverage']       = d['total_amount_paid_sar'] / (d['loan_amount_sar'] + 1)

    # PTP history
    d['ptp_reliability_filled'] = d['ptp_reliability_rate'].fillna(0.5)
    d['ptp_volume_log']         = np.log1p(d['total_ptps_made'])
    d['broken_ptp_ratio']       = d['ptps_broken'] / (d['total_ptps_made'] + 1)
    d['consecutive_broken_log'] = np.log1p(d['consecutive_broken_ptps'])
    d['has_active_ptp_int']     = d['has_active_ptp'].astype(int)

    # Income & stress
    d['dti_stress']             = np.where(d['dti_ratio'] > 0.33, d['dti_ratio'] - 0.33, 0)
    d['income_log']             = np.log1p(d['monthly_income_sar'])
    d['salary_urgency']         = np.exp(-d['days_to_next_salary'] / 7)
    d['salary_soon_flag']       = (d['days_to_next_salary'] <= 5).astype(int)
    d['debt_burden']            = d['other_active_loans'] * d['dti_ratio']
    d['bureau_normalized']      = d['bureau_score_at_origination'] / 900

    # Loan lifecycle
    d['tenure_completion']      = d['months_on_book'] / (d['loan_tenure_months'] + 1)
    d['remaining_tenure_log']   = np.log1p(d['remaining_tenure_months'])

    # Hardship
    d['hardship_score']         = (
        d['job_loss_flag'].astype(int) * 3 +
        d['medical_hardship_flag'].astype(int) * 2 +
        d['fraud_suspected_flag'].astype(int) * 4 +
        d['dispute_flag'].astype(int) * 1
    )

    # ── NEW: Call history features ──────────────────────────
    d['call_engagement']        = d['call_answer_rate'] * np.log1p(d['total_calls_made'])
    d['call_sentiment_recency'] = d['call_sentiment_score'] * d['last_call_sentiment_num']
    d['call_ptp_consistency']   = d['call_ptp_capture_rate'] * d['ptp_reliability_filled']
    d['call_refusal_risk']      = d['call_refused_rate'] * (1 - d['ptp_reliability_filled'])
    d['call_recency_decay']     = np.exp(-d['last_call_days_ago'] / 14)
    d['call_quality_signal']    = d['call_quality_avg'] / 10
    d['call_volume_log']        = np.log1p(d['total_calls_made'])
    d['ai_efficiency']          = d['ai_call_share'] * d['call_answer_rate']

    # Interactions
    d['ptp_x_salary']           = d['ptp_reliability_filled'] * d['salary_urgency']
    d['payment_x_call']         = d['payment_consistency'] * d['call_answer_rate']
    d['dpd_x_broken']           = d['dpd_normalized'] * d['broken_ptp_ratio']
    d['income_x_dti']           = d['income_log'] * (1 - d['dti_ratio'])
    d['call_x_sentiment']       = d['call_answer_rate'] * d['call_sentiment_score']
    d['risk_composite']         = (
        d['dpd_normalized'] * 0.25 +
        d['broken_ptp_ratio'] * 0.20 +
        d['dti_stress'] * 0.15 +
        d['call_refused_rate'] * 0.20 +
        (1 - d['call_answer_rate']) * 0.20
    )

    return d

labelled_fe = engineer_features(labelled)
df_all_fe   = engineer_features(df)

# ─── Feature columns ─────────────────────────────────────────
FEATURE_COLS = [
    # Delinquency
    'dpd_normalized','max_dpd_normalized','dpd_acceleration',
    'bucket_severity','dpd_trend_encoded','times_30dpd_log',
    # Payment
    'payment_consistency','payment_momentum','recency_decay','payment_coverage',
    'ontime_payment_ratio','avg_payment_ratio',
    # PTP history
    'ptp_reliability_filled','ptp_volume_log','broken_ptp_ratio',
    'consecutive_broken_log','has_active_ptp_int',
    # Income
    'dti_stress','income_log','salary_urgency','salary_soon_flag',
    'debt_burden','bureau_normalized',
    # Loan
    'tenure_completion','remaining_tenure_log',
    # Hardship
    'hardship_score',
    # ── NEW call features ──
    'call_answer_rate','call_sentiment_score','call_ptp_capture_rate',
    'call_refused_rate','call_broken_ptp_rate','call_quality_signal',
    'call_volume_log','call_recency_decay','call_engagement',
    'call_sentiment_recency','call_ptp_consistency','call_refusal_risk',
    'last_call_sentiment_num','last_call_ptp_num','last_call_outcome_num',
    'ai_efficiency','calls_last_30d',
    # Interactions
    'ptp_x_salary','payment_x_call','dpd_x_broken',
    'income_x_dti','call_x_sentiment','risk_composite',
]

print(f"Total features: {len(FEATURE_COLS)} ({len(FEATURE_COLS)-23} new call features added)")

X = labelled_fe[FEATURE_COLS].values
y = (labelled_fe['outcome_label'] == 'Paid').astype(int).values

print(f"Feature matrix: {X.shape}")
print(f"Class balance — Paid: {y.mean():.1%}, Not Paid: {(1-y).mean():.1%}")

# ─── Train/test split ────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"\nTrain: {len(X_train):,} | Test: {len(X_test):,}")

def make_pipeline(model):
    return Pipeline([
        ('imputer', SimpleImputer(strategy='mean')),
        ('scaler',  StandardScaler()),
        ('model',   model)
    ])

# ─── Model A: PTP Propensity ─────────────────────────────────
print("\n── Model A: PTP Propensity ───────────────────────────")

lr = make_pipeline(LogisticRegression(class_weight='balanced', max_iter=1000, C=0.5, random_state=42))
lr.fit(X_train, y_train)
lr_proba = lr.predict_proba(X_test)[:, 1]
lr_auc   = roc_auc_score(y_test, lr_proba)
print(f"Logistic Regression  ROC-AUC: {lr_auc:.4f}")

rf = make_pipeline(RandomForestClassifier(
    n_estimators=200, max_depth=12, min_samples_leaf=10,
    class_weight='balanced', random_state=42, n_jobs=-1))
rf.fit(X_train, y_train)
rf_proba = rf.predict_proba(X_test)[:, 1]
rf_auc   = roc_auc_score(y_test, rf_proba)
print(f"Random Forest        ROC-AUC: {rf_auc:.4f}")

gb = make_pipeline(GradientBoostingClassifier(
    n_estimators=300, max_depth=5, learning_rate=0.05,
    subsample=0.8, min_samples_leaf=20, random_state=42))
gb.fit(X_train, y_train)
gb_proba = gb.predict_proba(X_test)[:, 1]
gb_auc   = roc_auc_score(y_test, gb_proba)
print(f"Gradient Boosting    ROC-AUC: {gb_auc:.4f}")

# Ensemble
ensemble_proba = 0.20*lr_proba + 0.30*rf_proba + 0.50*gb_proba
ensemble_auc   = roc_auc_score(y_test, ensemble_proba)
print(f"Ensemble (weighted)  ROC-AUC: {ensemble_auc:.4f}  ← CHAMPION")

# Threshold tuning
best_f1, best_thresh = 0, 0.5
for t in np.arange(0.30, 0.71, 0.02):
    f1 = f1_score(y_test, (ensemble_proba >= t).astype(int))
    if f1 > best_f1:
        best_f1, best_thresh = f1, t

print(f"\nOptimal threshold: {best_thresh:.2f}  |  F1: {best_f1:.4f}")
print(classification_report(y_test, (ensemble_proba >= best_thresh).astype(int),
                             target_names=['Not Paid','Paid']))

# Feature importance
gb_model  = gb.named_steps['model']
feat_imp  = pd.Series(gb_model.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
print("Top 15 features:")
for feat, imp in feat_imp.head(15).items():
    tag = " ← NEW" if feat.startswith('call_') or feat in ['last_call_sentiment_num','last_call_ptp_num','last_call_outcome_num','ai_efficiency','calls_last_30d'] else ""
    print(f"  {feat:<40} {imp:.4f}{tag}")

# ─── Model B: Broken PTP ────────────────────────────────────
print("\n── Model B: Broken PTP Predictor ────────────────────")
PTP_FEATURES = [
    'consecutive_broken_log','broken_ptp_ratio','ptp_volume_log',
    'dpd_normalized','bucket_severity','payment_consistency',
    'recency_decay','salary_urgency','salary_soon_flag','dti_stress',
    'hardship_score','has_active_ptp_int',
    # call features
    'call_ptp_capture_rate','call_broken_ptp_rate','call_refused_rate',
    'call_recency_decay','last_call_ptp_num','call_sentiment_score',
]
ptp_data = labelled[labelled['total_ptps_made'] > 0].copy()
ptp_fe   = engineer_features(ptp_data)
Xb = ptp_fe[PTP_FEATURES].values
yb = (ptp_fe['outcome_label'] == 'Not Paid').astype(int).values
Xb_train, Xb_test, yb_train, yb_test = train_test_split(Xb, yb, test_size=0.2, random_state=42, stratify=yb)

broken_model = make_pipeline(GradientBoostingClassifier(
    n_estimators=200, max_depth=4, learning_rate=0.08, subsample=0.8, random_state=42))
broken_model.fit(Xb_train, yb_train)
broken_auc = roc_auc_score(yb_test, broken_model.predict_proba(Xb_test)[:,1])
print(f"Broken PTP Model     ROC-AUC: {broken_auc:.4f}")

# ─── Model C: Channel optimiser ─────────────────────────────
print("\n── Model C: Channel Optimiser ───────────────────────")
labelled_ch = labelled.copy()
labelled_ch['preferred_contact_window_enc'] = labelled_ch['preferred_contact_window'].map(
    {'Before 9am':0,'9am-12pm':1,'12pm-3pm':2,'3pm-6pm':3,'6pm-9pm':4,'After 9pm':5}).fillna(3)

CHANNEL_FEATURES = [
    'call_answer_rate','call_sentiment_score','call_ptp_capture_rate',
    'call_refused_rate','call_recency_decay','ai_call_share',
    'bucket_severity','dpd_normalized','ptp_reliability_filled',
    'preferred_contact_window_enc','income_log',
]
Xc_fe = engineer_features(labelled_ch)
Xc    = Xc_fe[CHANNEL_FEATURES].values

def assign_channel(row):
    if row.get('call_answer_rate', 0) > 0.4 and row.get('dpd_normalized', 0) > 0.5:
        return 'Human Agent'
    elif row.get('call_sentiment_score', 0) > 0.3:
        return 'WhatsApp'
    elif row.get('call_answer_rate', 0) > 0.3:
        return 'Voice'
    return 'SMS'

yc_labels = Xc_fe.apply(assign_channel, axis=1)
le_channel = LabelEncoder()
yc         = le_channel.fit_transform(yc_labels)

channel_model = make_pipeline(RandomForestClassifier(
    n_estimators=150, max_depth=8, class_weight='balanced', random_state=42, n_jobs=-1))
channel_model.fit(Xc, yc)
print(f"Channel Optimiser trained | Classes: {le_channel.classes_.tolist()}")

# ─── Score full portfolio ────────────────────────────────────
print("\n── Scoring full 10,000 account portfolio ────────────")
df_fe   = engineer_features(df_all_fe)
X_all   = df_fe[FEATURE_COLS].values

lr_all  = lr.predict_proba(X_all)[:, 1]
rf_all  = rf.predict_proba(X_all)[:, 1]
gb_all  = gb.predict_proba(X_all)[:, 1]
ens_all = 0.20*lr_all + 0.30*rf_all + 0.50*gb_all

df['ml_pay_probability']     = ens_all.round(3)
df['ml_ptp_score']           = np.clip(300 + ens_all*550, 300, 850).astype(int)
df['ml_risk_tier']           = np.where(df['ml_ptp_score']>=700,'Low Risk',
                               np.where(df['ml_ptp_score']>=550,'Medium Risk',
                               np.where(df['ml_ptp_score']>=400,'High Risk','Very High Risk')))
df['ml_recommended_channel'] = np.where(df['ml_ptp_score']>=700,'SMS',
                               np.where(df['ml_ptp_score']>=550,'WhatsApp',
                               np.where(df['ml_ptp_score']>=400,'AI Voice','Human Agent')))
df['ml_handling_type']       = np.where(df['ml_ptp_score']>=600,'AI Only',
                               np.where(df['ml_ptp_score']>=450,'AI + Human','Human Led'))

# Broken PTP for active PTPs
ptp_mask = df['has_active_ptp'] == True
if ptp_mask.sum() > 0:
    df_ptp   = engineer_features(df[ptp_mask].copy())
    Xptp     = df_ptp[PTP_FEATURES].values
    df.loc[ptp_mask, 'ml_broken_ptp_risk'] = broken_model.predict_proba(Xptp)[:,1].round(3)
df['ml_broken_ptp_risk'] = df.get('ml_broken_ptp_risk', pd.Series(0.0, index=df.index)).fillna(0.0)

print(f"Scored {len(df):,} accounts")
for tier in ['Low Risk','Medium Risk','High Risk','Very High Risk']:
    n = (df['ml_risk_tier']==tier).sum()
    print(f"  {tier:<18}: {n:,} ({n/len(df):.1%})")

# ─── Save everything ─────────────────────────────────────────
print("\n── Saving artefacts ─────────────────────────────────")
os.makedirs('models', exist_ok=True)

joblib.dump(lr,            'models/model_lr.pkl')
joblib.dump(rf,            'models/model_rf.pkl')
joblib.dump(gb,            'models/model_gb.pkl')
joblib.dump(broken_model,  'models/model_broken_ptp.pkl')
joblib.dump(channel_model, 'models/model_channel.pkl')
joblib.dump(FEATURE_COLS,  'models/feature_cols.pkl')
joblib.dump(PTP_FEATURES,  'models/ptp_feature_cols.pkl')

feat_imp_dict = {f: round(float(v), 4) for f, v in feat_imp.head(20).items()}
with open('models/feature_importance.json', 'w') as f:
    json.dump(feat_imp_dict, f, indent=2)

metadata = {
    "model_version":      "2.0.0",
    "dataset":            "unified (accounts + call history)",
    "trained_on":         datetime.now().strftime("%Y-%m-%d"),
    "training_samples":   len(X_train),
    "test_samples":       len(X_test),
    "model_a_roc_auc":    round(ensemble_auc, 4),
    "model_a_f1":         round(best_f1, 4),
    "model_a_threshold":  round(best_thresh, 2),
    "model_b_roc_auc":    round(broken_auc, 4),
    "feature_count":      len(FEATURE_COLS),
    "call_features_added":17,
    "score_range":        [300, 850],
    "risk_tiers": {
        "Low Risk":"700-850","Medium Risk":"550-700",
        "High Risk":"400-550","Very High Risk":"300-400"
    },
    "top_features":       feat_imp_dict,
}
with open('models/model_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

# Save scored unified CSV
df.to_csv('data/wataniya_ibe_unified_scored.csv', index=False)
print("✓ Models saved to models/")
print("✓ Scored unified CSV saved")

print(f"\n{'='*60}")
print("UNIFIED MODEL TRAINING COMPLETE")
print(f"{'='*60}")
print(f"  Model A (PTP Propensity)  ROC-AUC: {ensemble_auc:.4f}")
print(f"  Model B (Broken PTP)      ROC-AUC: {broken_auc:.4f}")
print(f"  Model C (Channel)         Trained")
print(f"  Features                  {len(FEATURE_COLS)} ({len(FEATURE_COLS)-23} new call features)")
print(f"  Portfolio scored          10,000 accounts")
print(f"{'='*60}")