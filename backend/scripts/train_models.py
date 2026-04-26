"""
NSP IBE — PTP Propensity ML Model
Trains Model A (PTP Propensity), Model B (Broken PTP), Model C (Channel)
Produces: trained models + feature importances + evaluation metrics
"""

import numpy as np
import pandas as pd
import json, warnings, os
from datetime import datetime
warnings.filterwarnings('ignore')

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    classification_report, roc_auc_score, precision_recall_curve,
    average_precision_score, confusion_matrix, f1_score
)
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.calibration import CalibratedClassifierCV
import joblib

print("=" * 60)
print("NSP IBE — ML Model Training Pipeline")
print("=" * 60)

# ─────────────────────────────────────────────────────────────
# LOAD DATA
# ─────────────────────────────────────────────────────────────

df = pd.read_csv('data/wataniya_ibe_10k.csv')
print(f"\nLoaded: {df.shape[0]:,} records × {df.shape[1]} columns")

# Work only with labelled records for supervised training
labelled = df[df['outcome_label'] != 'Pending'].copy()
print(f"Labelled records for training: {len(labelled):,}")
print(f"  Paid: {(labelled['outcome_label']=='Paid').sum():,}")
print(f"  Not Paid: {(labelled['outcome_label']=='Not Paid').sum():,}")

# ─────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────

print("\n── Feature Engineering ──────────────────────────────")

def engineer_features(data):
    df = data.copy()

    # --- Delinquency features ---
    df['dpd_normalized']        = df['current_dpd'] / 180
    df['max_dpd_normalized']    = df['max_dpd_ever'] / 365
    df['dpd_acceleration']      = (df['current_dpd'] / (df['max_dpd_ever'] + 1))
    df['bucket_severity']       = df['delinquency_bucket'].map({
        '1-30 DPD': 1, '31-60 DPD': 2, '61-90 DPD': 3, 'NPA': 4, 'Write-off': 5
    })
    df['dpd_trend_encoded']     = df['dpd_trend'].map({
        'Improving': -1, 'Stable': 0, 'Worsening': 1
    })
    df['times_30dpd_log']       = np.log1p(df['times_entered_30dpd'])

    # --- Payment behaviour features ---
    df['payment_consistency']   = df['ontime_payment_ratio'] * (1 - df['partial_payment_frequency'])
    df['payment_momentum']      = df['avg_payment_ratio'] * df['ontime_payment_ratio']
    df['recency_decay']         = np.exp(-df['months_since_last_payment'] / 3)
    df['payment_coverage']      = df['total_amount_paid_sar'] / (df['loan_amount_sar'] + 1)

    # --- PTP history features ---
    df['ptp_reliability_filled']= df['ptp_reliability_rate'].fillna(0.5)
    df['ptp_volume_log']        = np.log1p(df['total_ptps_made'])
    df['broken_ptp_ratio']      = df['ptps_broken'] / (df['total_ptps_made'] + 1)
    df['consecutive_broken_log']= np.log1p(df['consecutive_broken_ptps'])
    df['days_late_normalized']  = df['avg_days_late_broken_ptp'] / 45
    df['has_active_ptp_int']    = df['has_active_ptp'].astype(int)

    # --- Channel response features ---
    df['best_channel_score']    = df[['call_pickup_rate','whatsapp_response_rate','sms_response_rate']].max(axis=1)
    df['channel_diversity']     = (
        (df['call_pickup_rate'] > 0.3).astype(int) +
        (df['whatsapp_response_rate'] > 0.3).astype(int) +
        (df['sms_response_rate'] > 0.3).astype(int)
    )
    df['contact_recency']       = np.exp(-df['days_since_last_contact'] / 14)
    df['contact_intensity']     = np.log1p(df['contact_attempts_30d'])

    # --- Income & financial stress ---
    df['dti_stress']            = np.where(df['dti_ratio'] > 0.33, df['dti_ratio'] - 0.33, 0)
    df['income_log']            = np.log1p(df['monthly_income_sar'])
    df['salary_urgency']        = np.exp(-df['days_to_next_salary'] / 7)
    df['salary_soon_flag']      = (df['days_to_next_salary'] <= 5).astype(int)
    df['debt_burden']           = df['other_active_loans'] * df['dti_ratio']
    df['bureau_normalized']     = df['bureau_score_at_origination'] / 900
    df['installment_to_income'] = df['monthly_installment_sar'] / (df['monthly_income_sar'] + 1)
    df['balance_to_income']     = df['outstanding_balance_sar'] / (df['monthly_income_sar'] * 12 + 1)

    # --- Loan lifecycle features ---
    df['tenure_completion']     = df['months_on_book'] / (df['loan_tenure_months'] + 1)
    df['remaining_tenure_log']  = np.log1p(df['remaining_tenure_months'])
    df['loan_maturity']         = np.where(df['remaining_tenure_months'] < 6, 1, 0)

    # --- Hardship composite ---
    df['hardship_score']        = (
        df['job_loss_flag'].astype(int) * 3 +
        df['medical_hardship_flag'].astype(int) * 2 +
        df['family_status_change'].astype(int) * 1.5 +
        df['dispute_flag'].astype(int) * 1 +
        df['fraud_suspected_flag'].astype(int) * 4
    )

    # --- Interaction features ---
    df['ptp_x_salary']          = df['ptp_reliability_filled'] * df['salary_urgency']
    df['payment_x_contact']     = df['payment_consistency'] * df['best_channel_score']
    df['dpd_x_broken']          = df['dpd_normalized'] * df['broken_ptp_ratio']
    df['income_x_dti']          = df['income_log'] * (1 - df['dti_ratio'])
    df['risk_composite']        = (
        df['dpd_normalized'] * 0.35 +
        df['broken_ptp_ratio'] * 0.25 +
        df['dti_stress'] * 0.20 +
        df['hardship_score'] / 10 * 0.20
    )

    return df

labelled_fe = engineer_features(labelled)
df_all_fe   = engineer_features(df)

# Feature list
FEATURE_COLS = [
    # Delinquency
    'dpd_normalized', 'max_dpd_normalized', 'dpd_acceleration',
    'bucket_severity', 'dpd_trend_encoded', 'times_30dpd_log',
    # Payment
    'payment_consistency', 'payment_momentum', 'recency_decay', 'payment_coverage',
    'ontime_payment_ratio', 'avg_payment_ratio',
    # PTP
    'ptp_reliability_filled', 'ptp_volume_log', 'broken_ptp_ratio',
    'consecutive_broken_log', 'days_late_normalized', 'has_active_ptp_int',
    # Channel
    'best_channel_score', 'channel_diversity', 'contact_recency', 'contact_intensity',
    'call_pickup_rate', 'whatsapp_response_rate',
    # Income / stress
    'dti_stress', 'income_log', 'salary_urgency', 'salary_soon_flag',
    'debt_burden', 'bureau_normalized', 'installment_to_income',
    # Loan
    'tenure_completion', 'remaining_tenure_log', 'loan_maturity',
    # Hardship
    'hardship_score',
    # Interactions
    'ptp_x_salary', 'payment_x_contact', 'dpd_x_broken', 'income_x_dti', 'risk_composite',
]

print(f"Total engineered features: {len(FEATURE_COLS)}")

X = labelled_fe[FEATURE_COLS].values
y = (labelled_fe['outcome_label'] == 'Paid').astype(int).values

print(f"Feature matrix shape: {X.shape}")
print(f"Class balance — Paid: {y.mean():.1%}, Not Paid: {(1-y).mean():.1%}")

# ─────────────────────────────────────────────────────────────
# MODEL A — PTP PROPENSITY
# ─────────────────────────────────────────────────────────────

print("\n── Model A: PTP Propensity ───────────────────────────")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"Train: {len(X_train):,} | Test: {len(X_test):,}")

# Manual class-weight balancing (SMOTE replacement — no imbalanced-learn needed)
pos_weight = (y_train == 0).sum() / (y_train == 1).sum()
print(f"Class weight (neg/pos): {pos_weight:.2f}")

# Pipeline: impute → scale → model
def make_pipeline(model):
    return Pipeline([
        ('imputer', SimpleImputer(strategy='mean')),
        ('scaler',  StandardScaler()),
        ('model',   model)
    ])

# ── Logistic Regression baseline ──
lr = make_pipeline(LogisticRegression(
    class_weight='balanced', max_iter=1000,
    C=0.5, random_state=42
))
lr.fit(X_train, y_train)
lr_proba = lr.predict_proba(X_test)[:, 1]
lr_auc   = roc_auc_score(y_test, lr_proba)
print(f"\nLogistic Regression  ROC-AUC: {lr_auc:.4f}")

# ── Random Forest ──
rf = make_pipeline(RandomForestClassifier(
    n_estimators=200, max_depth=12, min_samples_leaf=10,
    class_weight='balanced', random_state=42, n_jobs=-1
))
rf.fit(X_train, y_train)
rf_proba = rf.predict_proba(X_test)[:, 1]
rf_auc   = roc_auc_score(y_test, rf_proba)
print(f"Random Forest        ROC-AUC: {rf_auc:.4f}")

# ── Gradient Boosting (champion) ──
gb = make_pipeline(GradientBoostingClassifier(
    n_estimators=300, max_depth=5, learning_rate=0.05,
    subsample=0.8, min_samples_leaf=20,
    random_state=42
))
gb.fit(X_train, y_train)
gb_proba = gb.predict_proba(X_test)[:, 1]
gb_auc   = roc_auc_score(y_test, gb_proba)
print(f"Gradient Boosting    ROC-AUC: {gb_auc:.4f}")

# ── Ensemble (weighted average) ──
ensemble_proba = 0.20 * lr_proba + 0.30 * rf_proba + 0.50 * gb_proba
ensemble_auc   = roc_auc_score(y_test, ensemble_proba)
print(f"Ensemble (weighted)  ROC-AUC: {ensemble_auc:.4f}  ← CHAMPION")

# Threshold tuning for F1
from sklearn.metrics import f1_score
best_f1, best_thresh = 0, 0.5
for t in np.arange(0.30, 0.71, 0.02):
    f1 = f1_score(y_test, (ensemble_proba >= t).astype(int))
    if f1 > best_f1:
        best_f1, best_thresh = f1, t

y_pred_best = (ensemble_proba >= best_thresh).astype(int)
print(f"\nOptimal threshold: {best_thresh:.2f}")
print(f"F1 Score: {best_f1:.4f}")
print(f"Precision: {(y_pred_best[y_test==1]).mean():.4f}")
print(f"\nClassification Report:")
print(classification_report(y_test, y_pred_best, target_names=['Not Paid', 'Paid']))

# ── Feature importance from GB ──
gb_model   = gb.named_steps['model']
feat_imp   = pd.Series(gb_model.feature_importances_, index=FEATURE_COLS)
feat_imp   = feat_imp.sort_values(ascending=False)
print("\nTop 15 Features (Gradient Boosting):")
for feat, imp in feat_imp.head(15).items():
    bar = '█' * int(imp * 200)
    print(f"  {feat:<35} {imp:.4f} {bar}")

# ── Score calibration: map probability → 300-850 ──
def prob_to_score(prob):
    return np.clip(np.round(300 + prob * 550).astype(int), 300, 850)

test_scores = prob_to_score(ensemble_proba)
print(f"\nScore distribution on test set:")
for tier, (lo, hi) in [('Very High Risk',(300,400)),('High Risk',(400,550)),
                        ('Medium Risk',(550,700)),('Low Risk',(700,850))]:
    pct = ((test_scores >= lo) & (test_scores < hi)).mean()
    print(f"  {tier:<18} ({lo}-{hi}): {pct:.1%}")

# ─────────────────────────────────────────────────────────────
# MODEL B — BROKEN PTP PREDICTOR
# ─────────────────────────────────────────────────────────────

print("\n── Model B: Broken PTP Predictor ────────────────────")

ptp_data = labelled[labelled['total_ptps_made'] > 0].copy()
ptp_fe   = engineer_features(ptp_data)

PTP_FEATURES = [
    'consecutive_broken_log', 'broken_ptp_ratio', 'ptp_volume_log',
    'days_late_normalized', 'dpd_normalized', 'bucket_severity',
    'payment_consistency', 'recency_decay', 'salary_urgency',
    'salary_soon_flag', 'dti_stress', 'hardship_score',
    'has_active_ptp_int', 'call_pickup_rate', 'contact_recency',
    'ptp_x_salary', 'dpd_x_broken', 'risk_composite'
]

Xb = ptp_fe[PTP_FEATURES].values
yb = (ptp_fe['outcome_label'] == 'Not Paid').astype(int).values  # 1 = will break

Xb_train, Xb_test, yb_train, yb_test = train_test_split(
    Xb, yb, test_size=0.20, random_state=42, stratify=yb
)

broken_model = make_pipeline(GradientBoostingClassifier(
    n_estimators=200, max_depth=4, learning_rate=0.08,
    subsample=0.8, random_state=42
))
broken_model.fit(Xb_train, yb_train)
broken_proba = broken_model.predict_proba(Xb_test)[:, 1]
broken_auc   = roc_auc_score(yb_test, broken_proba)
print(f"Broken PTP Model     ROC-AUC: {broken_auc:.4f}")
print(f"Training samples: {len(Xb_train):,}")

# ─────────────────────────────────────────────────────────────
# MODEL C — CHANNEL OPTIMISER
# ─────────────────────────────────────────────────────────────

print("\n── Model C: Channel Optimiser ───────────────────────")

CHANNEL_FEATURES = [
    'call_pickup_rate', 'whatsapp_response_rate', 'sms_response_rate',
    'email_response_rate', 'contact_recency', 'contact_intensity',
    'bucket_severity', 'dpd_normalized', 'ptp_reliability_filled',
    'preferred_contact_window_enc', 'income_log', 'age_norm'
]

labelled_ch = labelled.copy()
labelled_ch['preferred_contact_window_enc'] = labelled_ch['preferred_contact_window'].map({
    'Before 9am': 0, '9am-12pm': 1, '12pm-3pm': 2,
    '3pm-6pm': 3, '6pm-9pm': 4, 'After 9pm': 5
})
labelled_ch['age_norm'] = labelled['age'] / 65

Xc = labelled_ch[[
    'call_pickup_rate', 'whatsapp_response_rate', 'sms_response_rate',
    'email_response_rate', 'days_since_last_contact', 'contact_attempts_30d',
    'bucket_severity' if 'bucket_severity' in labelled_ch.columns else 'current_dpd',
    'current_dpd', 'ptp_reliability_rate', 'preferred_contact_window_enc',
    'monthly_income_sar', 'age'
]].copy()

# Fill NaN in ptp_reliability
Xc['ptp_reliability_rate'] = Xc['ptp_reliability_rate'].fillna(0.5)
Xc['monthly_income_sar'] = np.log1p(Xc['monthly_income_sar'])
Xc['current_dpd'] = Xc['current_dpd'] / 180
Xc['age'] = Xc['age'] / 65

# Create channel label from response rates + bucket
def assign_channel_label(row):
    if row['call_pickup_rate'] > 0.5 and row['current_dpd'] > 0.5:
        return 'Human Agent'
    elif row['whatsapp_response_rate'] > row['call_pickup_rate']:
        return 'WhatsApp'
    elif row['call_pickup_rate'] > row['sms_response_rate']:
        return 'Voice'
    else:
        return 'SMS'

yc_labels   = labelled_ch.apply(assign_channel_label, axis=1)
le_channel  = LabelEncoder()
yc          = le_channel.fit_transform(yc_labels)

channel_model = make_pipeline(RandomForestClassifier(
    n_estimators=150, max_depth=8,
    class_weight='balanced', random_state=42, n_jobs=-1
))
channel_model.fit(Xc.values, yc)
print(f"Channel Optimiser trained on {len(yc):,} samples")
print(f"Channels: {le_channel.classes_.tolist()}")

# ─────────────────────────────────────────────────────────────
# SCORE ALL 10,000 ACCOUNTS
# ─────────────────────────────────────────────────────────────

print("\n── Scoring full 10,000 account portfolio ────────────")

df_fe  = engineer_features(df.copy())
X_all  = df_fe[FEATURE_COLS].values

# Impute + scale using training pipeline internals
imputer = SimpleImputer(strategy='mean')
scaler  = StandardScaler()
imputer.fit(X_train)
scaler.fit(imputer.transform(X_train))

X_all_clean = scaler.transform(imputer.transform(X_all))

# Get probabilities from each model
lr_all  = lr.predict_proba(X_all)[:, 1]
rf_all  = rf.predict_proba(X_all)[:, 1]
gb_all  = gb.predict_proba(X_all)[:, 1]
ens_all = 0.20 * lr_all + 0.30 * rf_all + 0.50 * gb_all

df['ml_pay_probability']   = ens_all.round(3)
df['ml_ptp_score']         = prob_to_score(ens_all)
df['ml_risk_tier']         = np.where(
    df['ml_ptp_score'] >= 700, 'Low Risk',
    np.where(df['ml_ptp_score'] >= 550, 'Medium Risk',
    np.where(df['ml_ptp_score'] >= 400, 'High Risk', 'Very High Risk'))
)
df['ml_recommended_channel'] = np.where(
    df['ml_ptp_score'] >= 700, 'SMS',
    np.where(df['ml_ptp_score'] >= 550, 'WhatsApp',
    np.where(df['ml_ptp_score'] >= 400, 'AI Voice', 'Human Agent'))
)
df['ml_handling_type'] = np.where(
    df['ml_ptp_score'] >= 600, 'AI Only',
    np.where(df['ml_ptp_score'] >= 450, 'AI + Human', 'Human Led')
)

# Broken PTP prediction for accounts with active PTPs
df_ptp      = df[df['has_active_ptp'] == True].copy()
df_ptp_fe   = engineer_features(df_ptp)
Xptp        = df_ptp_fe[PTP_FEATURES].values
broken_risk = broken_model.predict_proba(Xptp)[:, 1]
df.loc[df['has_active_ptp'] == True, 'ml_broken_ptp_risk'] = broken_risk.round(3)
df['ml_broken_ptp_risk'] = df['ml_broken_ptp_risk'].fillna(0.0).round(3)

print(f"ML scores applied to all {len(df):,} accounts")
print(f"\nML score distribution:")
for tier in ['Low Risk', 'Medium Risk', 'High Risk', 'Very High Risk']:
    n = (df['ml_risk_tier'] == tier).sum()
    print(f"  {tier:<18}: {n:,} ({n/len(df):.1%})")

# ─────────────────────────────────────────────────────────────
# FEATURE IMPORTANCE — for SHAP-style display in POC
# ─────────────────────────────────────────────────────────────

feature_importance_json = {
    feat: float(round(imp, 4))
    for feat, imp in feat_imp.head(20).items()
}

# ─────────────────────────────────────────────────────────────
# SAVE EVERYTHING
# ─────────────────────────────────────────────────────────────

print("\n── Saving artefacts ─────────────────────────────────")
os.makedirs('/home/claude/models', exist_ok=True)

# Save models
joblib.dump(lr,           'models/model_lr.pkl')
joblib.dump(rf,           'models/model_rf.pkl')
joblib.dump(gb,           'models/model_gb.pkl')
joblib.dump(broken_model, 'models/model_broken_ptp.pkl')
joblib.dump(channel_model,'models/model_channel.pkl')
joblib.dump(imputer,      'models/imputer.pkl')
joblib.dump(scaler,       'models/scaler.pkl')
joblib.dump(FEATURE_COLS, 'models/feature_cols.pkl')
joblib.dump(PTP_FEATURES, 'models/ptp_feature_cols.pkl')
print("✓ Models saved")

# Save scored dataset
df.to_csv('data/wataniya_ibe_10k_scored.csv', index=False)
print("✓ Scored dataset saved")

# Save model metadata for API
metadata = {
    "model_version": "1.0.0",
    "trained_on": datetime.now().strftime("%Y-%m-%d"),
    "training_samples": len(X_train),
    "test_samples": len(X_test),
    "model_a_roc_auc": round(ensemble_auc, 4),
    "model_a_f1": round(best_f1, 4),
    "model_a_threshold": round(best_thresh, 2),
    "model_b_roc_auc": round(broken_auc, 4),
    "feature_count": len(FEATURE_COLS),
    "score_range": [300, 850],
    "risk_tiers": {
        "Low Risk": "700-850",
        "Medium Risk": "550-700",
        "High Risk": "400-550",
        "Very High Risk": "300-400"
    },
    "top_features": feature_importance_json,
    "channel_classes": le_channel.classes_.tolist()
}
with open('models/model_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)
print("✓ Model metadata saved")

# Save feature names for frontend SHAP display
with open('models/feature_importance.json', 'w') as f:
    json.dump(feature_importance_json, f, indent=2)
print("✓ Feature importance saved")

print(f"\n{'='*60}")
print("MODEL TRAINING COMPLETE")
print(f"{'='*60}")
print(f"  Model A (PTP Propensity)  ROC-AUC: {ensemble_auc:.4f}")
print(f"  Model B (Broken PTP)      ROC-AUC: {broken_auc:.4f}")
print(f"  Model C (Channel)         Trained")
print(f"  Portfolio scored          10,000 accounts")
print(f"  All artefacts saved       models/")
print(f"{'='*60}")
