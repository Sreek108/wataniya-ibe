"""
NSP IBE Backend — FastAPI
JWT Authentication + Role-Based Access Control
5 Roles: Admin, Supervisor, Collector, Legal, Support
"""

from fastapi import FastAPI, Depends, HTTPException, status
from ml_inference import real_score
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware 
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from enum import Enum
import jwt, bcrypt, json, joblib, numpy as np, pandas as pd
import os, uvicorn, random

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────

SECRET_KEY = "nsp-ibe-wataniya-2026-secret"
ALGORITHM  = "HS256"
TOKEN_EXPIRE_HOURS = 8

app = FastAPI(title="NSP IBE API", version="1.0.0",
              description="Wataniya Finance — Intelligent Business Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ─────────────────────────────────────────────────────────────
# ROLES & PERMISSIONS
# ─────────────────────────────────────────────────────────────

class Role(str, Enum):
    ADMIN      = "admin"
    SUPERVISOR = "supervisor"
    COLLECTOR  = "collector"
    LEGAL      = "legal"
    SUPPORT    = "support"

PERMISSIONS = {
    "admin": [
        "view_dashboard", "view_all_accounts", "manage_users",
        "configure_system", "view_reports", "manage_campaigns",
        "view_legal", "manage_legal", "view_ml_scores",
        "export_data", "audit_logs"
    ],
    "supervisor": [
        "view_dashboard", "view_all_accounts", "view_team_accounts",
        "manage_campaigns", "view_reports", "view_ml_scores",
        "approve_waivers", "reassign_accounts", "export_data"
    ],
    "collector": [
        "view_assigned_accounts", "capture_ptp", "log_call",
        "view_ml_scores", "request_waiver", "update_account_status",
        "view_dashboard"
    ],
    "legal": [
        "view_legal_accounts", "manage_legal_cases", "view_court_cases",
        "manage_documents", "view_dashboard", "view_reports"
    ],
    "support": [
        "view_tickets", "manage_tickets", "view_customer_info",
        "view_dashboard"
    ],
}

# ─────────────────────────────────────────────────────────────
# USER STORE
# ─────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

USERS_DB = {
    "admin@wataniya.sa": {
        "user_id":       "USR-001",
        "name":          "Abdullah Al-Otaibi",
        "email":         "admin@wataniya.sa",
        "password_hash": hash_password("Admin@2026"),
        "role":          "admin",
        "department":    "IT Administration",
        "active":        True,
        "status":        "Active",
        "last_login":    "2026-04-20T08:32:11",
        "created_at":    "2026-01-01",
    },
    "supervisor@wataniya.sa": {
        "user_id":       "USR-002",
        "name":          "Faisal Al-Rashidi",
        "email":         "supervisor@wataniya.sa",
        "password_hash": hash_password("Super@2026"),
        "role":          "supervisor",
        "department":    "Collections Management",
        "active":        True,
        "status":        "Active",
        "last_login":    "2026-04-21T07:15:43",
        "created_at":    "2026-01-01",
    },
    "collector@wataniya.sa": {
        "user_id":       "USR-003",
        "name":          "Nora Al-Khalid",
        "email":         "collector@wataniya.sa",
        "password_hash": hash_password("Collect@2026"),
        "role":          "collector",
        "department":    "Collections - Outbound",
        "active":        True,
        "status":        "Active",
        "last_login":    "2026-04-21T09:03:22",
        "created_at":    "2026-01-01",
    },
    "legal@wataniya.sa": {
        "user_id":       "USR-004",
        "name":          "Khaled Al-Harbi",
        "email":         "legal@wataniya.sa",
        "password_hash": hash_password("Legal@2026"),
        "role":          "legal",
        "department":    "Legal Recovery",
        "active":        True,
        "status":        "Active",
        "last_login":    "2026-04-19T10:45:00",
        "created_at":    "2026-01-01",
    },
    "support@wataniya.sa": {
        "user_id":       "USR-005",
        "name":          "Sara Al-Mutairi",
        "email":         "support@wataniya.sa",
        "password_hash": hash_password("Support@2026"),
        "role":          "support",
        "department":    "Customer Support",
        "active":        True,
        "status":        "Active",
        "last_login":    "2026-04-18T14:22:37",
        "created_at":    "2026-01-01",
    },
}

_users_id_counter = 6

# ─────────────────────────────────────────────────────────────
# AUDIT LOG
# ─────────────────────────────────────────────────────────────

audit_logs: list = [
    {"id":"AUD-0001","timestamp":"2026-03-25T08:32:00","user_id":"USR-001","user_name":"Abdullah Al-Otaibi","user_role":"Admin","action":"User Login","entity_type":"Auth","entity_id":"USR-001","description":"Admin login from 192.168.1.10"},
    {"id":"AUD-0002","timestamp":"2026-03-26T09:15:00","user_id":"USR-003","user_name":"Nora Al-Khalid","user_role":"Collector","action":"PTP Captured","entity_type":"PTP","entity_id":"PTP-00001","description":"PTP of SAR 12,000 captured for WAT-001234"},
    {"id":"AUD-0003","timestamp":"2026-03-27T10:22:00","user_id":"USR-002","user_name":"Faisal Al-Rashidi","user_role":"Supervisor","action":"Campaign Launched","entity_type":"Campaign","entity_id":"CMP-001","description":"Campaign Early Arrears SMS launched targeting 3,757 accounts"},
    {"id":"AUD-0004","timestamp":"2026-03-28T11:05:00","user_id":"USR-004","user_name":"Khaled Al-Harbi","user_role":"Legal","action":"Legal Case Initiated","entity_type":"Legal","entity_id":"LGL-0001","description":"Legal case initiated for WAT-001234 — Civil, SAR 485,000"},
    {"id":"AUD-0005","timestamp":"2026-03-29T14:30:00","user_id":"USR-002","user_name":"Faisal Al-Rashidi","user_role":"Supervisor","action":"Waiver Approved","entity_type":"Waiver","entity_id":"WAV-00001","description":"Late fee waiver SAR 1,200 approved — customer hardship confirmed"},
    {"id":"AUD-0006","timestamp":"2026-03-30T09:45:00","user_id":"USR-003","user_name":"Nora Al-Khalid","user_role":"Collector","action":"PTP Captured","entity_type":"PTP","entity_id":"PTP-00002","description":"PTP of SAR 8,500 captured for WAT-005612"},
    {"id":"AUD-0007","timestamp":"2026-04-01T10:15:00","user_id":"USR-001","user_name":"Abdullah Al-Otaibi","user_role":"Admin","action":"User Created","entity_type":"User","entity_id":"USR-006","description":"New collector account created for Ahmed Al-Zahrani"},
    {"id":"AUD-0008","timestamp":"2026-04-02T11:30:00","user_id":"USR-004","user_name":"Khaled Al-Harbi","user_role":"Legal","action":"Fraud Flag Added","entity_type":"Fraud","entity_id":"WAT-000012","description":"High severity fraud flag — Suspected Fraud, forged salary certificate"},
    {"id":"AUD-0009","timestamp":"2026-04-03T13:00:00","user_id":"USR-003","user_name":"Nora Al-Khalid","user_role":"Collector","action":"Settlement Created","entity_type":"Settlement","entity_id":"SETL-00001","description":"OTS offer SAR 390,000 created for WAT-036789"},
    {"id":"AUD-0010","timestamp":"2026-04-05T09:20:00","user_id":"USR-002","user_name":"Faisal Al-Rashidi","user_role":"Supervisor","action":"Settlement Accepted","entity_type":"Settlement","entity_id":"SETL-00001","description":"Settlement accepted — SAR 390,000 recovered from WAT-036789"},
    {"id":"AUD-0011","timestamp":"2026-04-07T10:45:00","user_id":"USR-002","user_name":"Faisal Al-Rashidi","user_role":"Supervisor","action":"Escalation Assigned","entity_type":"Escalation","entity_id":"PTP-00016","description":"Broken PTP escalation assigned to Nora Al-Khalid — supervisor queue"},
    {"id":"AUD-0012","timestamp":"2026-04-08T14:15:00","user_id":"USR-003","user_name":"Nora Al-Khalid","user_role":"Collector","action":"PTP Captured","entity_type":"PTP","entity_id":"PTP-00003","description":"PTP of SAR 22,000 captured for WAT-040123"},
    {"id":"AUD-0013","timestamp":"2026-04-10T09:00:00","user_id":"USR-001","user_name":"Abdullah Al-Otaibi","user_role":"Admin","action":"System Config","entity_type":"System","entity_id":"SYS","description":"ML model threshold updated — PTP score cutoff changed to 450"},
    {"id":"AUD-0014","timestamp":"2026-04-12T11:20:00","user_id":"USR-004","user_name":"Khaled Al-Harbi","user_role":"Legal","action":"Legal Case Updated","entity_type":"Legal","entity_id":"LGL-0006","description":"Case LGL-0006 status updated to Filed — court hearing scheduled"},
    {"id":"AUD-0015","timestamp":"2026-04-14T10:30:00","user_id":"USR-002","user_name":"Faisal Al-Rashidi","user_role":"Supervisor","action":"Waiver Rejected","entity_type":"Waiver","entity_id":"WAV-00009","description":"Interest waiver SAR 12,000 rejected — insufficient documentation"},
    {"id":"AUD-0016","timestamp":"2026-04-15T13:45:00","user_id":"USR-003","user_name":"Nora Al-Khalid","user_role":"Collector","action":"PTP Workflow Advanced","entity_type":"PTP","entity_id":"PTP-00005","description":"PTP workflow advanced to REMINDED — SMS reminder sent"},
    {"id":"AUD-0017","timestamp":"2026-04-16T09:10:00","user_id":"USR-001","user_name":"Abdullah Al-Otaibi","user_role":"Admin","action":"Fraud Flag Removed","entity_type":"Fraud","entity_id":"WAT-000034","description":"Fraud flag removed — dispute resolved, identity confirmed"},
    {"id":"AUD-0018","timestamp":"2026-04-18T14:00:00","user_id":"USR-002","user_name":"Faisal Al-Rashidi","user_role":"Supervisor","action":"Campaign Launched","entity_type":"Campaign","entity_id":"CMP-002","description":"Mid-Bucket AI Voice campaign launched — 250 high-risk accounts"},
    {"id":"AUD-0019","timestamp":"2026-04-20T10:30:00","user_id":"USR-002","user_name":"Faisal Al-Rashidi","user_role":"Supervisor","action":"Escalation Resolved","entity_type":"Escalation","entity_id":"PTP-00011","description":"Escalation resolved — SAR 18,000 payment arrangement reached"},
    {"id":"AUD-0020","timestamp":"2026-04-21T09:00:00","user_id":"USR-001","user_name":"Abdullah Al-Otaibi","user_role":"Admin","action":"User Updated","entity_type":"User","entity_id":"USR-003","description":"Nora Al-Khalid promoted to senior collector"},
]

def log_audit(user_id, user_name, user_role, action, entity_type, entity_id, description):
    audit_logs.append({
        "id":          f"AUD-{len(audit_logs)+1:04d}",
        "timestamp":   datetime.now().isoformat(),
        "user_id":     user_id,
        "user_name":   user_name,
        "user_role":   str(user_role),
        "action":      action,
        "entity_type": entity_type,
        "entity_id":   str(entity_id),
        "description": description,
    })

# ─────────────────────────────────────────────────────────────
# JWT UTILITIES
# ─────────────────────────────────────────────────────────────

def create_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire    = datetime.utcnow() + (expires_delta or timedelta(hours=TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    email   = payload.get("sub")
    if not email or email not in USERS_DB:
        raise HTTPException(status_code=401, detail="User not found")
    user = USERS_DB[email]
    if not user["active"]:
        raise HTTPException(status_code=403, detail="Account disabled")
    return user

def require_permission(permission: str):
    async def checker(user=Depends(get_current_user)):
        role  = user["role"]
        perms = PERMISSIONS.get(role, [])
        if permission not in perms:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{role}' does not have permission: '{permission}'"
            )
        return user
    return checker

# ─────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      str
    name:         str
    email:        str
    role:         str
    permissions:  List[str]
    expires_in:   int

class UserProfile(BaseModel):
    user_id:    str
    name:       str
    email:      str
    role:       str
    department: str
    permissions: List[str]

class ScoreRequest(BaseModel):
    current_dpd:              int
    max_dpd_ever:             int
    ontime_payment_ratio:     float
    ptp_reliability_rate:     Optional[float] = None
    consecutive_broken_ptps:  int
    dti_ratio:                float
    days_to_next_salary:      int
    call_pickup_rate:         float
    whatsapp_response_rate:   float
    monthly_income_sar:       float
    other_active_loans:       int
    job_loss_flag:            bool = False
    fraud_suspected_flag:     bool = False
    dispute_flag:             bool = False
    bucket:                   str
    bureau_score_at_origination: int = 620

class PTPCaptureRequest(BaseModel):
    account_id:   str
    agent_id:     str
    amount_sar:   float
    promise_date: str
    notes:        Optional[str] = ""
    channel:      str = "Human Agent"

class UserCreateRequest(BaseModel):
    name:     str
    email:    str
    password: str
    role:     str
    status:   str = "Active"

class UserUpdateRequest(BaseModel):
    name:   Optional[str] = None
    role:   Optional[str] = None
    status: Optional[str] = None

class PasswordResetRequest(BaseModel):
    new_password: str

# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def df_to_records(df: pd.DataFrame) -> list:
    """Convert DataFrame to JSON-safe list of dicts — handles NaN, numpy types."""
    return json.loads(df.to_json(orient='records', date_format='iso'))

def load_feature_importance(top_n: int = 10) -> dict:
    """Read feature_importance.json directly and return top N sorted descending.
    Bypasses the full model-loading chain so it works even if pkl files are absent."""
    try:
        base = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(base, 'models', 'feature_importance.json')
        with open(path) as f:
            data = json.load(f)
        sorted_items = sorted(data.items(), key=lambda x: x[1], reverse=True)
        return dict(sorted_items[:top_n])
    except Exception:
        return {}

# ─────────────────────────────────────────────────────────────
# LOAD ML MODELS & DATA
# ─────────────────────────────────────────────────────────────

_models = {}
_data   = {}

def get_models():
    if not _models:
        try:
            base = os.path.dirname(os.path.abspath(__file__))
            m    = os.path.join(base, 'models')
            _models['lr']       = joblib.load(os.path.join(m, 'model_lr.pkl'))
            _models['rf']       = joblib.load(os.path.join(m, 'model_rf.pkl'))
            _models['gb']       = joblib.load(os.path.join(m, 'model_gb.pkl'))
            _models['broken']   = joblib.load(os.path.join(m, 'model_broken_ptp.pkl'))
            _models['imputer']  = joblib.load(os.path.join(m, 'imputer.pkl'))
            _models['scaler']   = joblib.load(os.path.join(m, 'scaler.pkl'))
            _models['features'] = joblib.load(os.path.join(m, 'feature_cols.pkl'))
            with open(os.path.join(m, 'feature_importance.json')) as f:
                _models['importance'] = json.load(f)
            with open(os.path.join(m, 'model_metadata.json')) as f:
                _models['metadata'] = json.load(f)
        except Exception as e:
            print(f"Model load error: {e}")
    return _models

def get_data():
    if not _data:
        try:
            base     = os.path.dirname(os.path.abspath(__file__))
            csv_path = os.path.join(base, 'data', 'wataniya_ibe_unified_scored.csv')
            _data['df'] = pd.read_csv(csv_path)
        except Exception as e:
            print(f"Data load error: {e}")
            _data['df'] = pd.DataFrame()
    return _data

def compute_score_from_request(req: ScoreRequest) -> dict:
    bucket_map = {'1-30 DPD': 1, '31-60 DPD': 2, '61-90 DPD': 3, 'NPA': 4, 'Write-off': 5}
    bucket_sev = bucket_map.get(req.bucket, 3)
    ptp_rel    = req.ptp_reliability_rate if req.ptp_reliability_rate is not None else 0.5

    logit = (
          3.5 * req.ontime_payment_ratio
        + 2.2 * ptp_rel
        + 1.9 * (1 - min(req.dti_ratio, 1.0))
        + 1.6 * (1 if req.days_to_next_salary <= 4 else 0)
        + 1.3 * req.call_pickup_rate
        + 1.1 * req.whatsapp_response_rate
        + 0.8 * (req.bureau_score_at_origination / 900)
        - 3.2 * (req.current_dpd / 180)
        - 2.1 * (req.consecutive_broken_ptps / 5)
        - 1.6 * (1 if req.job_loss_flag else 0)
        - 1.4 * (req.other_active_loans / 5)
        - 1.1 * (req.max_dpd_ever / 365)
        - 0.7 * (1 if req.fraud_suspected_flag else 0)
        - 0.5 * (1 if req.dispute_flag else 0)
        - bucket_sev * 0.9
        - 1.8
    )

    prob  = round(float(np.clip(1 / (1 + np.exp(-logit)), 0.02, 0.98)), 3)
    score = int(np.clip(300 + prob * 550, 300, 850))

    risk_tier = ('Low Risk' if score >= 700 else 'Medium Risk' if score >= 550
                 else 'High Risk' if score >= 400 else 'Very High Risk')
    channel   = ('SMS' if score >= 700 else 'WhatsApp' if score >= 550
                 else 'AI Voice' if score >= 400 else 'Human Agent')
    handling  = ('AI Only' if score >= 600 else 'AI + Human' if score >= 450 else 'Human Led')

    return {
        "ptp_score": score, "pay_probability": prob,
        "risk_tier": risk_tier, "recommended_channel": channel, "handling_type": handling,
        "score_breakdown": {
            "payment_history":   round(3.5 * req.ontime_payment_ratio, 3),
            "ptp_reliability":   round(2.2 * ptp_rel, 3),
            "dti_headroom":      round(1.9 * (1 - min(req.dti_ratio, 1)), 3),
            "salary_alignment":  round(1.6 * (1 if req.days_to_next_salary <= 4 else 0.3), 3),
            "channel_response":  round(1.3 * req.call_pickup_rate + 1.1 * req.whatsapp_response_rate, 3),
            "delinquency_depth": round(-3.2 * (req.current_dpd / 180), 3),
            "broken_ptps":       round(-2.1 * (req.consecutive_broken_ptps / 5), 3),
            "hardship_flags":    round(-1.6 * (1 if req.job_loss_flag else 0), 3),
        }
    }

# ─────────────────────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = USERS_DB.get(form.username)
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid email or password",
                            headers={"WWW-Authenticate": "Bearer"})
    USERS_DB[form.username]["last_login"] = datetime.now().isoformat()
    log_audit(user["user_id"], user["name"], str(user["role"]), "User Login", "Auth",
              user["user_id"], f"{user['name']} logged in")
    token = create_token({"sub": user["email"], "role": user["role"], "name": user["name"]})
    return TokenResponse(
        access_token=token, user_id=user["user_id"], name=user["name"],
        email=user["email"], role=user["role"],
        permissions=PERMISSIONS[user["role"]], expires_in=TOKEN_EXPIRE_HOURS * 3600,
    )

@app.get("/auth/me", response_model=UserProfile)
async def get_me(user=Depends(get_current_user)):
    return UserProfile(
        user_id=user["user_id"], name=user["name"], email=user["email"],
        role=user["role"], department=user["department"],
        permissions=PERMISSIONS[user["role"]],
    )

@app.post("/auth/logout")
async def logout(user=Depends(get_current_user)):
    return {"message": f"Goodbye, {user['name']}"}

# ─────────────────────────────────────────────────────────────
# DASHBOARD ROUTES
# ─────────────────────────────────────────────────────────────

@app.get("/dashboard/overview")
async def dashboard_overview(user=Depends(require_permission("view_dashboard"))):
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    if df.empty:
        raise HTTPException(500, "Data not loaded")
    total    = len(df)
    labelled = df[df['outcome_label'] != 'Pending']
    paid_rate = (labelled['outcome_label'] == 'Paid').mean()
    return {
        "total_accounts":       total,
        "active_accounts":      int(len(df[df['outcome_label'] == 'Pending'])),
        "total_ptps_active":    int(df['has_active_ptp'].sum()),
        "avg_ptp_score":        int(df['ml_ptp_score'].mean()),
        "paid_rate":            round(float(paid_rate), 3),
        "bucket_distribution":  df['delinquency_bucket'].value_counts().to_dict(),
        "risk_distribution":    df['ml_risk_tier'].value_counts().to_dict(),
        "channel_distribution": df['ml_recommended_channel'].value_counts().to_dict(),
        "handling_distribution":df['ml_handling_type'].value_counts().to_dict(),
        "avg_outstanding_sar":  int(df['outstanding_balance_sar'].mean()),
        "total_outstanding_sar":int(df['outstanding_balance_sar'].sum()),
        "broken_ptps_today":    int(df['consecutive_broken_ptps'].gt(0).sum()),
    }

@app.get("/dashboard/performance")
async def dashboard_performance(user=Depends(require_permission("view_dashboard"))):
    data     = get_data()
    df       = data.get('df', pd.DataFrame())
    labelled = df[df['outcome_label'] != 'Pending']
    by_bucket = labelled.groupby('delinquency_bucket').apply(
        lambda x: {
            "total":     len(x),
            "paid":      int((x['outcome_label'] == 'Paid').sum()),
            "pay_rate":  round(float((x['outcome_label'] == 'Paid').mean()), 3),
            "avg_score": int(x['ml_ptp_score'].mean()),
        }
    ).to_dict()
    return {
        "by_bucket":    by_bucket,
        "model_accuracy": 0.8600, "model_auc": 0.9238,
        "model_f1": 0.9012, "model_version": "2.0.0", "last_trained": "2026-04-01",
    }

# ─────────────────────────────────────────────────────────────
# ACCOUNTS ROUTES
# ─────────────────────────────────────────────────────────────

@app.get("/accounts")
async def get_accounts(
    bucket: Optional[str] = None, risk_tier: Optional[str] = None,
    limit: int = 50, offset: int = 0, user=Depends(get_current_user)
):
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    if user['role'] == Role.COLLECTOR:
        df = df[df['assigned_agent_name'] == user['name']]
    elif user['role'] == Role.LEGAL:
        df = df[df['legal_action_flag'] == True]
    if bucket:    df = df[df['delinquency_bucket'] == bucket]
    if risk_tier: df = df[df['ml_risk_tier'] == risk_tier]
    df_sorted = df.sort_values('ml_ptp_score', ascending=True)
    page = df_sorted.iloc[offset:offset+limit][[
        'account_id', 'customer_name', 'phone_number', 'product_type',
        'delinquency_bucket', 'current_dpd', 'outstanding_balance_sar',
        'monthly_installment_sar', 'ml_ptp_score', 'ml_risk_tier',
        'ml_recommended_channel', 'ml_handling_type', 'has_active_ptp',
        'ptp_amount_sar', 'assigned_agent_name', 'dpd_trend', 'outcome_label'
    ]]
    return {"total": len(df_sorted), "offset": offset, "limit": limit,
            "accounts": df_to_records(page)}

@app.get("/accounts/{account_id}")
async def get_account(account_id: str, user=Depends(get_current_user)):
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    row  = df[df['account_id'] == account_id]
    if row.empty:
        raise HTTPException(404, f"Account {account_id} not found")
    return df_to_records(row)[0]

# ─────────────────────────────────────────────────────────────
# ML SCORING ROUTES
# ─────────────────────────────────────────────────────────────

@app.post("/ml/score")
async def score_account(req: ScoreRequest, user=Depends(require_permission("view_ml_scores"))):
    result = real_score(req.dict())
    result["scored_at"] = datetime.now().isoformat()
    result["feature_importance"] = load_feature_importance()
    return result

@app.get("/ml/account/{account_id}/score")
async def get_account_score(account_id: str, user=Depends(require_permission("view_ml_scores"))):
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    row  = df[df['account_id'] == account_id]
    if row.empty:
        raise HTTPException(404, "Account not found")
    r      = row.iloc[0]
    models = get_models()
    return {
        "account_id":          account_id,
        "ptp_score":           int(r['ml_ptp_score']),
        "pay_probability":     float(r['ml_pay_probability']),
        "risk_tier":           r['ml_risk_tier'],
        "recommended_channel": r['ml_recommended_channel'],
        "handling_type":       r['ml_handling_type'],
        "broken_ptp_risk":     float(r['ml_broken_ptp_risk']),
        "feature_importance":  load_feature_importance(),
        "model_version":       "2.0.0",
    }

@app.get("/ml/metadata")
async def get_model_metadata(user=Depends(require_permission("view_ml_scores"))):
    return get_models().get('metadata', {})

# ─────────────────────────────────────────────────────────────
# PTP ROUTES
# ─────────────────────────────────────────────────────────────

_ptp_log = []

def _risk_from_score(ptp_score: int) -> str:
    if ptp_score >= 700: return "low"
    if ptp_score >= 400: return "medium"
    return "high"

def _ptp_next_step(ptp: dict) -> str:
    status = ptp.get("workflow_status", "PENDING")
    risk   = ptp.get("risk_level", "medium")
    if status == "PENDING":        return "Send SMS reminder (Day -7)"
    if status == "REMINDED":       return "Send AI voice reminder" if risk == "high" else "Mark as due"
    if status == "VOICE_REMINDED": return "Mark as due"
    if status == "DUE":            return "Record payment or mark broken"
    if status == "PAID":           return "Resolved — payment received"
    if status == "BROKEN":         return "Escalate to supervisor"
    if status == "ESCALATED":      return "Legal referral if needed"
    return "—"

def _days_until_due(ptp: dict) -> int:
    try:
        due = datetime.strptime(ptp.get("due_date", ""), "%Y-%m-%d").date()
        return (due - datetime.now().date()).days
    except Exception:
        return 0

def _escalation_rec(broken_count: int) -> str:
    if broken_count >= 3: return "Supervisor escalation required"
    if broken_count == 2: return "Human agent review"
    return "AI retry recommended"

def _init_sample_ptps():
    if _ptp_log:
        return
    now = datetime.now()
    def d(delta): return (now + timedelta(days=delta)).strftime('%Y-%m-%d')
    def ts(delta, h=9): return (now - timedelta(days=delta)).replace(hour=h, minute=0, second=0).isoformat()
    samples = [
        {"ptp_id":"PTP-00001","account_id":"WAT-001234","customer_name":"Mohammed Al-Rashidi","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":4500,"promise_date":d(7),"channel":"Human Agent","notes":"Customer agreed to pay on salary date","captured_at":ts(1),"broken_ptp_risk":0.22,"reliability_flag":"NORMAL","workflow_status":"PENDING","due_date":d(7),"reminder_sent":False,"voice_reminder_sent":False,"outcome":None,"risk_level":"low","workflow_updated_at":ts(1),"broken_date":None,"broken_count":0},
        {"ptp_id":"PTP-00002","account_id":"WAT-011209","customer_name":"Ahmed Al-Otaibi","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":8200,"promise_date":d(5),"channel":"AI Voice","notes":"High-risk — agreed to partial payment","captured_at":ts(2),"broken_ptp_risk":0.68,"reliability_flag":"HIGH RISK","workflow_status":"PENDING","due_date":d(5),"reminder_sent":False,"voice_reminder_sent":False,"outcome":None,"risk_level":"high","workflow_updated_at":ts(2),"broken_date":None,"broken_count":0},
        {"ptp_id":"PTP-00003","account_id":"WAT-005612","customer_name":"Ibrahim Al-Mutairi","agent_id":"USR-002","agent_name":"Faisal Al-Rashidi","amount_sar":12000,"promise_date":d(6),"channel":"WhatsApp","notes":"Customer promises full instalment","captured_at":ts(1),"broken_ptp_risk":0.41,"reliability_flag":"NORMAL","workflow_status":"PENDING","due_date":d(6),"reminder_sent":False,"voice_reminder_sent":False,"outcome":None,"risk_level":"medium","workflow_updated_at":ts(1),"broken_date":None,"broken_count":0},
        {"ptp_id":"PTP-00004","account_id":"WAT-008344","customer_name":"Sara Al-Ghamdi","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":6800,"promise_date":d(3),"channel":"SMS","notes":"SMS reminder sent — awaiting payment","captured_at":ts(5),"broken_ptp_risk":0.31,"reliability_flag":"NORMAL","workflow_status":"REMINDED","due_date":d(3),"reminder_sent":True,"voice_reminder_sent":False,"outcome":None,"risk_level":"medium","workflow_updated_at":ts(1),"broken_date":None,"broken_count":0},
        {"ptp_id":"PTP-00005","account_id":"WAT-025678","customer_name":"Tariq Al-Shahrani","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":9500,"promise_date":d(2),"channel":"Human Agent","notes":"High risk — SMS reminder sent","captured_at":ts(6),"broken_ptp_risk":0.71,"reliability_flag":"HIGH RISK","workflow_status":"REMINDED","due_date":d(2),"reminder_sent":True,"voice_reminder_sent":False,"outcome":None,"risk_level":"high","workflow_updated_at":ts(2),"broken_date":None,"broken_count":0},
        {"ptp_id":"PTP-00006","account_id":"WAT-029001","customer_name":"Hessa Al-Qahtani","agent_id":"USR-002","agent_name":"Faisal Al-Rashidi","amount_sar":15000,"promise_date":d(1),"channel":"AI Voice","notes":"AI voice reminder placed — customer confirmed","captured_at":ts(8),"broken_ptp_risk":0.75,"reliability_flag":"HIGH RISK","workflow_status":"VOICE_REMINDED","due_date":d(1),"reminder_sent":True,"voice_reminder_sent":True,"outcome":None,"risk_level":"high","workflow_updated_at":ts(1),"broken_date":None,"broken_count":0},
        {"ptp_id":"PTP-00007","account_id":"WAT-014567","customer_name":"Khalid Al-Harbi","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":7200,"promise_date":d(0),"channel":"Human Agent","notes":"Due today — monitoring","captured_at":ts(10),"broken_ptp_risk":0.44,"reliability_flag":"NORMAL","workflow_status":"DUE","due_date":d(0),"reminder_sent":True,"voice_reminder_sent":False,"outcome":None,"risk_level":"medium","workflow_updated_at":ts(0),"broken_date":None,"broken_count":0},
        {"ptp_id":"PTP-00008","account_id":"WAT-017823","customer_name":"Noura Al-Shamri","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":3500,"promise_date":d(-1),"channel":"SMS","notes":"Overdue by 1 day — escalating","captured_at":ts(12),"broken_ptp_risk":0.62,"reliability_flag":"HIGH RISK","workflow_status":"DUE","due_date":d(-1),"reminder_sent":True,"voice_reminder_sent":True,"outcome":None,"risk_level":"high","workflow_updated_at":ts(1),"broken_date":None,"broken_count":0},
        {"ptp_id":"PTP-00009","account_id":"WAT-021445","customer_name":"Faisal Al-Dossari","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":11500,"promise_date":d(-3),"channel":"WhatsApp","notes":"Payment received on time","captured_at":ts(14),"broken_ptp_risk":0.18,"reliability_flag":"NORMAL","workflow_status":"PAID","due_date":d(-3),"reminder_sent":True,"voice_reminder_sent":False,"outcome":"PAID","risk_level":"low","workflow_updated_at":ts(3),"broken_date":None,"broken_count":0},
        {"ptp_id":"PTP-00010","account_id":"WAT-032556","customer_name":"Abdullah Al-Amer","agent_id":"USR-002","agent_name":"Faisal Al-Rashidi","amount_sar":5500,"promise_date":d(-2),"channel":"Human Agent","notes":"Full payment confirmed","captured_at":ts(12),"broken_ptp_risk":0.25,"reliability_flag":"NORMAL","workflow_status":"PAID","due_date":d(-2),"reminder_sent":True,"voice_reminder_sent":False,"outcome":"PAID","risk_level":"low","workflow_updated_at":ts(2),"broken_date":None,"broken_count":0},
        {"ptp_id":"PTP-00011","account_id":"WAT-036789","customer_name":"Mona Al-Subaie","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":18000,"promise_date":d(-5),"channel":"Human Agent","notes":"2nd broken PTP — human review needed","captured_at":ts(18),"broken_ptp_risk":0.88,"reliability_flag":"HIGH RISK","workflow_status":"BROKEN","due_date":d(-5),"reminder_sent":True,"voice_reminder_sent":True,"outcome":"BROKEN","risk_level":"high","workflow_updated_at":ts(5),"broken_date":ts(5),"broken_count":2,"outstanding_sar":124000},
        {"ptp_id":"PTP-00012","account_id":"WAT-040123","customer_name":"Wael Al-Harbi","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":22000,"promise_date":d(-7),"channel":"AI Voice","notes":"3 broken PTPs — supervisor escalation required","captured_at":ts(21),"broken_ptp_risk":0.93,"reliability_flag":"HIGH RISK","workflow_status":"ESCALATED","due_date":d(-7),"reminder_sent":True,"voice_reminder_sent":True,"outcome":"ESCALATED","risk_level":"high","workflow_updated_at":ts(7),"broken_date":ts(7),"broken_count":3,"outstanding_sar":285000},
    ]
    _ptp_log.extend(samples)

@app.post("/ptps/capture")
async def capture_ptp(req: PTPCaptureRequest, user=Depends(require_permission("capture_ptp"))):
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    row  = df[df['account_id'] == req.account_id]
    if row.empty:
        raise HTTPException(404, "Account not found")
    r       = row.iloc[0]
    risk_in = ScoreRequest(
        current_dpd=int(r['current_dpd']), max_dpd_ever=int(r['max_dpd_ever']),
        ontime_payment_ratio=float(r['ontime_payment_ratio']),
        ptp_reliability_rate=float(r['ptp_reliability_rate']) if not pd.isna(r['ptp_reliability_rate']) else None,
        consecutive_broken_ptps=int(r['consecutive_broken_ptps']),
        dti_ratio=float(r['dti_ratio']), days_to_next_salary=int(r['days_to_next_salary']),
        call_pickup_rate=float(r['call_pickup_rate']),
        whatsapp_response_rate=float(r['whatsapp_response_rate']),
        monthly_income_sar=float(r['monthly_income_sar']),
        other_active_loans=int(r['other_active_loans']),
        job_loss_flag=bool(r['job_loss_flag']), fraud_suspected_flag=bool(r['fraud_suspected_flag']),
        dispute_flag=bool(r['dispute_flag']), bucket=r['delinquency_bucket'],
        bureau_score_at_origination=int(r['bureau_score_at_origination']),
    )
    score_result = compute_score_from_request(risk_in)
    ptp_record = {
        "ptp_id":           f"PTP-{len(_ptp_log)+1:05d}",
        "account_id":       req.account_id,
        "customer_name":    str(r.get('customer_name', 'Unknown')),
        "agent_id":         req.agent_id,
        "agent_name":       user['name'],
        "amount_sar":       req.amount_sar,
        "promise_date":     req.promise_date,
        "channel":          req.channel,
        "notes":            req.notes,
        "captured_at":      datetime.now().isoformat(),
        "broken_ptp_risk":  score_result['pay_probability'],
        "reliability_flag": "HIGH RISK" if score_result['ptp_score'] < 400 else "NORMAL",
        # Workflow fields
        "workflow_status":      "PENDING",
        "due_date":             req.promise_date,
        "reminder_sent":        False,
        "voice_reminder_sent":  False,
        "outcome":              None,
        "risk_level":           _risk_from_score(score_result['ptp_score']),
        "workflow_updated_at":  datetime.now().isoformat(),
        "broken_date":          None,
        "broken_count":         0,
    }
    _ptp_log.append(ptp_record)
    log_audit(user["user_id"], user["name"], str(user["role"]), "PTP Captured", "PTP",
              req.account_id, f"PTP of SAR {req.amount_sar:,.0f} captured for {req.account_id}")
    return {"success": True, "ptp": ptp_record,
            "ml_warning": score_result['ptp_score'] < 400, "score": score_result}

@app.get("/ptps/workflow")
async def get_ptp_workflow(user=Depends(get_current_user)):
    _init_sample_ptps()
    result = []
    for ptp in _ptp_log:
        enriched = dict(ptp)
        enriched["next_step"]      = _ptp_next_step(ptp)
        enriched["days_until_due"] = _days_until_due(ptp)
        result.append(enriched)
    result.sort(key=lambda p: p["days_until_due"])
    return {"total": len(result), "ptps": result}

@app.get("/ptps/broken")
async def get_broken_ptps(user=Depends(get_current_user)):
    _init_sample_ptps()
    broken = [p for p in _ptp_log if p.get("outcome") in ("BROKEN", "ESCALATED")
              or p.get("workflow_status") in ("BROKEN", "ESCALATED")]
    enriched = []
    for ptp in broken:
        e = dict(ptp)
        e["escalation_rec"]  = _escalation_rec(ptp.get("broken_count", 1))
        e["next_step"]       = _ptp_next_step(ptp)
        e["days_until_due"]  = _days_until_due(ptp)
        enriched.append(e)
    return {"total": len(enriched), "ptps": enriched}

@app.get("/ptps")
async def get_ptps(limit: int = 50, user=Depends(get_current_user)):
    _init_sample_ptps()
    return {"total": len(_ptp_log), "ptps": _ptp_log[-limit:]}

@app.post("/ptps/{ptp_id}/trigger")
async def trigger_ptp_workflow(ptp_id: str, user=Depends(get_current_user)):
    _init_sample_ptps()
    ptp = next((p for p in _ptp_log if p["ptp_id"] == ptp_id), None)
    if not ptp:
        raise HTTPException(404, "PTP not found")
    status = ptp.get("workflow_status", "PENDING")
    risk   = ptp.get("risk_level", "medium")
    if status == "PENDING":
        ptp["workflow_status"] = "REMINDED"
        ptp["reminder_sent"]   = True
    elif status == "REMINDED":
        if risk == "high":
            ptp["workflow_status"]     = "VOICE_REMINDED"
            ptp["voice_reminder_sent"] = True
        else:
            ptp["workflow_status"] = "DUE"
    elif status == "VOICE_REMINDED":
        ptp["workflow_status"] = "DUE"
    elif status == "DUE":
        ptp["workflow_status"] = "PAID"
        ptp["outcome"]         = "PAID"
    elif status == "BROKEN":
        ptp["workflow_status"] = "ESCALATED"
        ptp["outcome"]         = "ESCALATED"
    else:
        raise HTTPException(400, f"Cannot advance from status '{status}'")
    ptp["workflow_updated_at"] = datetime.now().isoformat()
    log_audit(user['user_id'], user['name'], str(user['role']), "PTP Workflow Advanced",
              "PTP", ptp_id,
              f"PTP {ptp_id} advanced: {status} → {ptp['workflow_status']}")
    enriched = dict(ptp)
    enriched["next_step"]      = _ptp_next_step(ptp)
    enriched["days_until_due"] = _days_until_due(ptp)
    return enriched

@app.post("/ptps/{ptp_id}/mark-broken")
async def mark_ptp_broken(ptp_id: str, user=Depends(get_current_user)):
    _init_sample_ptps()
    ptp = next((p for p in _ptp_log if p["ptp_id"] == ptp_id), None)
    if not ptp:
        raise HTTPException(404, "PTP not found")
    bc = ptp.get("broken_count", 0) + 1
    ptp["workflow_status"]        = "BROKEN"
    ptp["outcome"]                = "BROKEN"
    ptp["broken_date"]            = datetime.now().isoformat()
    ptp["broken_count"]           = bc
    ptp["workflow_updated_at"]    = datetime.now().isoformat()
    # Escalation fields
    risk  = ptp.get("risk_level", "medium")
    level = _escalation_level_for(bc)
    ptp["escalation_level"]       = level
    ptp["escalation_status"]      = "pending"
    ptp["escalation_assigned_to"] = None
    ptp["escalation_note"]        = None
    ptp["auto_channel"]           = _auto_channel_for(bc, risk)
    ptp["escalation_created_at"]  = datetime.now().isoformat()
    ptp["resolution"]             = None
    ptp["recovery_amount_sar"]    = ptp.get("recovery_amount_sar", 0)
    ptp["last_call_sentiment"]    = "Negative"
    log_audit(user["user_id"], user["name"], str(user["role"]), "Broken PTP auto-escalated", "PTP",
              ptp_id, f"PTP {ptp_id} broken ({bc}x) — escalated to {level} via {ptp['auto_channel']}")
    return dict(ptp)

# ─────────────────────────────────────────────────────────────
# ESCALATIONS
# ─────────────────────────────────────────────────────────────

def _escalation_level_for(broken_count: int) -> str:
    if broken_count >= 3: return "supervisor"
    if broken_count == 2: return "human_agent"
    return "ai_retry"

def _auto_channel_for(broken_count: int, risk_level: str) -> str:
    if broken_count >= 3:                           return "Supervisor Queue"
    if broken_count == 2 and risk_level == "high":  return "Human Agent"
    if broken_count == 2:                           return "AI Voice + SMS"
    return "AI Voice retry"

def _recommended_action_for(level: str) -> str:
    if level == "supervisor":  return "Schedule senior negotiation. Consider settlement offer."
    if level == "human_agent": return "Direct call required. Review payment capacity."
    return "Auto-dial with revised payment plan offer."

_escalation_initialized = False

def _ensure_escalation_data():
    global _escalation_initialized
    _init_sample_ptps()
    if _escalation_initialized:
        return
    _escalation_initialized = True
    # Patch existing broken PTPs
    for ptp in _ptp_log:
        if ptp.get("workflow_status") in ("BROKEN", "ESCALATED") and "escalation_level" not in ptp:
            bc    = ptp.get("broken_count", 1)
            risk  = ptp.get("risk_level", "medium")
            level = _escalation_level_for(bc)
            is_esc = ptp["workflow_status"] == "ESCALATED"
            ptp["escalation_level"]       = level
            ptp["escalation_status"]      = "in_progress" if is_esc else "pending"
            ptp["escalation_assigned_to"] = "Faisal Al-Rashidi" if is_esc else None
            ptp["escalation_note"]        = "Assigned for senior negotiation" if is_esc else None
            ptp["auto_channel"]           = _auto_channel_for(bc, risk)
            ptp["escalation_created_at"]  = ptp.get("broken_date") or ptp.get("workflow_updated_at")
            ptp["resolution"]             = None
            ptp["recovery_amount_sar"]    = ptp.get("recovery_amount_sar", 0)
            ptp["last_call_sentiment"]    = "Negative"
    # Additional pre-populated escalation records
    now = datetime.now()
    def d(delta): return (now + timedelta(days=delta)).strftime('%Y-%m-%d')
    def ts(delta, h=9): return (now - timedelta(days=delta)).replace(hour=h, minute=0, second=0).isoformat()
    extra = [
        {"ptp_id":"PTP-00013","account_id":"WAT-043456","customer_name":"Reem Al-Anzi","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":6200,"promise_date":d(-3),"channel":"SMS","notes":"1st broken — AI retry","captured_at":ts(10),"broken_ptp_risk":0.55,"reliability_flag":"HIGH RISK","workflow_status":"BROKEN","due_date":d(-3),"reminder_sent":True,"voice_reminder_sent":False,"outcome":"BROKEN","risk_level":"medium","workflow_updated_at":ts(3),"broken_date":ts(3),"broken_count":1,"escalation_level":"ai_retry","escalation_status":"pending","escalation_assigned_to":None,"escalation_note":None,"auto_channel":"AI Voice retry","escalation_created_at":ts(3),"resolution":None,"recovery_amount_sar":0,"last_call_sentiment":"Neutral","outstanding_sar":85000},
        {"ptp_id":"PTP-00014","account_id":"WAT-046789","customer_name":"Sultan Al-Rashidi","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":4800,"promise_date":d(-4),"channel":"AI Voice","notes":"1st broken — high risk","captured_at":ts(12),"broken_ptp_risk":0.79,"reliability_flag":"HIGH RISK","workflow_status":"BROKEN","due_date":d(-4),"reminder_sent":True,"voice_reminder_sent":True,"outcome":"BROKEN","risk_level":"high","workflow_updated_at":ts(4),"broken_date":ts(4),"broken_count":1,"escalation_level":"ai_retry","escalation_status":"pending","escalation_assigned_to":None,"escalation_note":None,"auto_channel":"AI Voice retry","escalation_created_at":ts(4),"resolution":None,"recovery_amount_sar":0,"last_call_sentiment":"Negative","outstanding_sar":62500},
        {"ptp_id":"PTP-00015","account_id":"WAT-050012","customer_name":"Yousuf Al-Dosari","agent_id":"USR-003","agent_name":"Nora Al-Khalid","amount_sar":13500,"promise_date":d(-6),"channel":"Human Agent","notes":"2nd broken — human agent assigned","captured_at":ts(20),"broken_ptp_risk":0.82,"reliability_flag":"HIGH RISK","workflow_status":"BROKEN","due_date":d(-6),"reminder_sent":True,"voice_reminder_sent":True,"outcome":"BROKEN","risk_level":"medium","workflow_updated_at":ts(6),"broken_date":ts(6),"broken_count":2,"escalation_level":"human_agent","escalation_status":"in_progress","escalation_assigned_to":"Nora Al-Khalid","escalation_note":"Direct negotiation in progress","auto_channel":"AI Voice + SMS","escalation_created_at":ts(6),"resolution":None,"recovery_amount_sar":0,"last_call_sentiment":"Neutral","outstanding_sar":195000},
        {"ptp_id":"PTP-00016","account_id":"WAT-053345","customer_name":"Mariam Al-Shehri","agent_id":"USR-002","agent_name":"Faisal Al-Rashidi","amount_sar":28000,"promise_date":d(-9),"channel":"Human Agent","notes":"3rd broken — supervisor queue","captured_at":ts(25),"broken_ptp_risk":0.94,"reliability_flag":"HIGH RISK","workflow_status":"BROKEN","due_date":d(-9),"reminder_sent":True,"voice_reminder_sent":True,"outcome":"BROKEN","risk_level":"high","workflow_updated_at":ts(9),"broken_date":ts(9),"broken_count":3,"escalation_level":"supervisor","escalation_status":"pending","escalation_assigned_to":None,"escalation_note":None,"auto_channel":"Supervisor Queue","escalation_created_at":ts(9),"resolution":None,"recovery_amount_sar":0,"last_call_sentiment":"Negative","outstanding_sar":320000},
    ]
    _ptp_log.extend(extra)

class EscalationAssignRequest(BaseModel):
    assigned_to: str
    note:        str

class EscalationResolveRequest(BaseModel):
    resolution:          str
    recovery_amount_sar: float = 0
    note:                str

@app.get("/escalations/stats")
async def get_escalation_stats(user=Depends(get_current_user)):
    _ensure_escalation_data()
    pending  = [p for p in _ptp_log if p.get("escalation_status") == "pending"]
    in_prog  = [p for p in _ptp_log if p.get("escalation_status") == "in_progress"]
    now      = datetime.now()
    week_ago = (now - timedelta(days=7)).isoformat()
    resolved_wk = [p for p in _ptp_log
                   if p.get("escalation_status") == "resolved"
                   and (p.get("workflow_updated_at") or "") >= week_ago]
    pending_by_level: dict = {}
    for p in pending:
        lvl = p.get("escalation_level", "ai_retry")
        pending_by_level[lvl] = pending_by_level.get(lvl, 0) + 1
    all_active    = pending + in_prog
    total_at_risk = sum(p.get("amount_sar", 0) for p in all_active)
    bc_list       = [p.get("broken_count", 1) for p in all_active]
    avg_broken    = round(sum(bc_list) / len(bc_list), 1) if bc_list else 0
    return {
        "pending_count":      {"total": len(pending), **pending_by_level},
        "in_progress_count":  len(in_prog),
        "resolved_this_week": len(resolved_wk),
        "total_at_risk_sar":  total_at_risk,
        "avg_broken_count":   avg_broken,
    }

@app.get("/escalations")
async def get_escalations(user=Depends(get_current_user)):
    _ensure_escalation_data()
    df = get_data().get('df', pd.DataFrame())
    active = [p for p in _ptp_log if p.get("escalation_status") in ("pending", "in_progress")]
    result = []
    for p in active:
        e = dict(p)
        acct = df[df['account_id'] == p.get('account_id', '')] if not df.empty else pd.DataFrame()
        e["outstanding_sar"]     = float(acct.iloc[0]['outstanding_balance_sar']) if not acct.empty else float(p.get('outstanding_sar', 0))
        e["recommended_action"]  = _recommended_action_for(p.get("escalation_level", "ai_retry"))
        e["days_until_due"]      = _days_until_due(p)
        result.append(e)
    by_level: dict = {"supervisor": [], "human_agent": [], "ai_retry": []}
    for e in result:
        lvl = e.get("escalation_level", "ai_retry")
        if lvl in by_level:
            by_level[lvl].append(e)
    return {"total": len(result), "escalations": result, "by_level": by_level}

@app.post("/escalations/{ptp_id}/assign")
async def assign_escalation(ptp_id: str, req: EscalationAssignRequest, user=Depends(get_current_user)):
    _ensure_escalation_data()
    ptp = next((p for p in _ptp_log if p["ptp_id"] == ptp_id), None)
    if not ptp:
        raise HTTPException(404, "PTP not found")
    ptp["escalation_status"]      = "in_progress"
    ptp["escalation_assigned_to"] = req.assigned_to
    ptp["escalation_note"]        = req.note
    ptp["workflow_updated_at"]    = datetime.now().isoformat()
    log_audit(user["user_id"], user["name"], str(user["role"]), "Escalation Assigned", "PTP",
              ptp_id, f"Escalation {ptp_id} assigned to {req.assigned_to}")
    return dict(ptp)

@app.post("/escalations/{ptp_id}/resolve")
async def resolve_escalation(ptp_id: str, req: EscalationResolveRequest, user=Depends(get_current_user)):
    _ensure_escalation_data()
    ptp = next((p for p in _ptp_log if p["ptp_id"] == ptp_id), None)
    if not ptp:
        raise HTTPException(404, "PTP not found")
    ptp["escalation_status"]   = "resolved"
    ptp["resolution"]          = req.resolution
    ptp["recovery_amount_sar"] = req.recovery_amount_sar
    ptp["escalation_note"]     = req.note
    ptp["workflow_updated_at"] = datetime.now().isoformat()
    if req.resolution == "Paid":
        ptp["outcome"] = "PAID"
    log_audit(user["user_id"], user["name"], str(user["role"]), "Escalation Resolved", "PTP",
              ptp_id, f"Escalation {ptp_id} resolved as {req.resolution} — SAR {req.recovery_amount_sar:,.0f}")
    return dict(ptp)

# ─────────────────────────────────────────────────────────────
# CALLS ROUTES
# ─────────────────────────────────────────────────────────────

_calls_cache = {}

def get_calls_data():
    if not _calls_cache:
        try:
            base     = os.path.dirname(os.path.abspath(__file__))
            csv_path = os.path.join(base, 'data', 'call_events.csv')
            df = pd.read_csv(csv_path)
            df['ptp_amount_sar'] = df['ptp_amount_sar'].fillna(0).astype(int)
            df['latency_ms']     = df['latency_ms'].fillna(0).astype(int)
            df['duration_sec']   = df['duration_sec'].fillna(0).astype(int)
            df['sentiment']      = df['sentiment'].fillna('N/A')
            df['call_score']     = pd.to_numeric(df['call_score'], errors='coerce')
            _calls_cache['df']   = df
            print(f"✓ Call history loaded: {len(df)} records")
        except Exception as e:
            print(f"Call history load error: {e}")
            _calls_cache['df'] = pd.DataFrame()
    return _calls_cache

@app.get("/calls")
async def get_call_history(
    status:    Optional[str] = None,
    direction: Optional[str] = None,
    agent:     Optional[str] = None,
    bucket:    Optional[str] = None,
    search:    Optional[str] = None,
    limit:     int = 900,
    offset:    int = 0,
    user=Depends(get_current_user)
):
    data = get_calls_data()
    df   = data.get('df', pd.DataFrame())
    if df.empty:
        return {"total": 0, "calls": [], "summary": {}}

    filtered = df.copy()
    if status:    filtered = filtered[filtered['status']    == status]
    if direction: filtered = filtered[filtered['direction'] == direction]
    if agent:     filtered = filtered[filtered['agent_name']== agent]
    if bucket:    filtered = filtered[filtered['delinquency_bucket'] == bucket]
    if search:
        mask = (
            filtered['call_id'].str.contains(search, case=False, na=False)   |
            filtered['account_id'].str.contains(search, case=False, na=False) |
            filtered['agent_name'].str.contains(search, case=False, na=False)
        )
        filtered = filtered[mask]

    total = len(filtered)
    page  = filtered.sort_values('call_datetime', ascending=False).iloc[offset:offset+limit]

    # Summary stats from full dataset
    finished = df[df['status'] == 'FINISHED']
    summary  = {
        "total_calls":        int(len(df)),
        "success_rate":       round(float((df['status']=='FINISHED').mean() * 100), 1),
        "avg_duration_sec":   int(finished['duration_sec'].mean()) if len(finished) else 0,
        "positive_sentiment": int((finished['sentiment']=='Positive').sum()),
        "ptp_captured":       int((df['ptp_outcome']=='PTP Captured').sum()),
        "ptp_capture_rate":   round(float((df['ptp_outcome']=='PTP Captured').sum() / max(len(finished),1) * 100), 1),
        "total_ptp_value":    int(df['ptp_amount_sar'].sum()),
        "ai_call_share":      round(float((df['agent_type']=='AI').mean() * 100), 1),
        "outbound_calls":     int((df['direction']=='Outbound').sum()),
        "web_calls":          int((df['direction']=='Web').sum()),
        "status_distribution":    df['status'].value_counts().to_dict(),
        "sentiment_distribution": finished['sentiment'].value_counts().to_dict(),
        "ptp_outcome_distribution": finished['ptp_outcome'].value_counts().to_dict(),
        "agent_distribution":  df['agent_type'].value_counts().to_dict(),
        "bucket_distribution": df['delinquency_bucket'].value_counts().to_dict(),
        "unique_agents":       sorted(df['agent_name'].unique().tolist()),
    }

    # ✓ NaN-safe serialisation using pandas JSON encoder
    records = json.loads(page.to_json(orient='records', date_format='iso'))
    return {"total": total, "offset": offset, "limit": limit,
            "calls": records, "summary": summary}

@app.get("/calls/stats")
async def get_call_stats(user=Depends(get_current_user)):
    data = get_calls_data()
    df   = data.get('df', pd.DataFrame())
    if df.empty:
        return {}

    finished = df[df['status'] == 'FINISHED']

    # Daily volume trend
    df2 = df.copy()
    df2['date_only'] = pd.to_datetime(df2['call_datetime']).dt.date.astype(str)
    volume_trend = df2.groupby('date_only').size().reset_index(name='calls')
    volume_trend = volume_trend.rename(columns={'date_only': 'date'}).to_dict(orient='records')

    # Agent leaderboard
    agent_stats = []
    for agent in df['agent_name'].unique():
        a_df  = df[df['agent_name'] == agent]
        a_fin = a_df[a_df['status'] == 'FINISHED']
        ptp_rate = round(float((a_df['ptp_outcome']=='PTP Captured').sum() / max(len(a_fin),1) * 100), 1)
        scores   = a_fin['call_score'].dropna().astype(float)
        agent_stats.append({
            "name":        agent,
            "type":        a_df['agent_type'].iloc[0],
            "calls":       int(len(a_df)),
            "ptp_rate":    ptp_rate,
            "avg_quality": round(float(scores.mean()), 1) if len(scores) else None,
        })
    agent_stats.sort(key=lambda x: x['ptp_rate'], reverse=True)

    # Bucket performance
    bucket_perf = []
    for bucket in ['1-30 DPD','31-60 DPD','61-90 DPD','NPA','Write-off']:
        b_df  = df[df['delinquency_bucket'] == bucket]
        b_fin = b_df[b_df['status'] == 'FINISHED']
        if len(b_df) == 0:
            continue
        bucket_perf.append({
            "bucket":   bucket,
            "total":    int(len(b_df)),
            "ptp":      round(float((b_df['ptp_outcome']=='PTP Captured').sum() / max(len(b_fin),1) * 100), 1),
            "noAnswer": round(float((b_df['status']=='USER DID NOT ANSWER').mean() * 100), 1),
            "success":  round(float((b_df['status']=='FINISHED').mean() * 100), 1),
        })

    # Sentiment → PTP matrix
    sentiment_matrix = []
    for sent in ['Positive', 'Neutral', 'Negative']:
        s_df = finished[finished['sentiment'] == sent]
        if len(s_df) == 0:
            continue
        tot = len(s_df)
        sentiment_matrix.append({
            "sentiment":   sent,
            "ptpCaptured": round(float((s_df['ptp_outcome']=='PTP Captured').sum() / tot * 100), 1),
            "noPTP":       round(float((s_df['ptp_outcome']=='No PTP').sum() / tot * 100), 1),
            "refused":     round(float((s_df['ptp_outcome']=='Refused').sum() / tot * 100), 1),
            "dispute":     round(float((s_df['ptp_outcome']=='Dispute').sum() / tot * 100), 1),
        })

    # AI vs Human comparison
    def _ch_stats(cdf, cost_per_call):
        fin   = cdf[cdf['status'] == 'FINISHED']
        total = max(len(cdf), 1)
        conn  = max(len(fin), 1)
        ptps  = int((cdf['ptp_outcome'] == 'PTP Captured').sum())
        ptp_v = float(cdf['ptp_amount_sar'].sum())
        by_bk = {}
        for bk in ['1-30 DPD', '31-60 DPD', '61-90 DPD', 'NPA', 'Write-off']:
            b     = cdf[cdf['delinquency_bucket'] == bk]
            b_fin = b[b['status'] == 'FINISHED']
            bptps = int((b['ptp_outcome'] == 'PTP Captured').sum())
            by_bk[bk] = {
                'calls':     int(len(b)),
                'ptps':      bptps,
                'ptp_rate':  round(float(bptps / max(len(b_fin), 1) * 100), 1),
                'ptp_value': round(float(b['ptp_amount_sar'].sum())),
            }
        return {
            'total_calls':            int(len(cdf)),
            'connected_calls':        int(len(fin)),
            'ptp_captured':           ptps,
            'ptp_value_sar':          round(ptp_v),
            'avg_duration_sec':       round(float(cdf['duration_sec'].mean()), 1) if len(cdf) else 0,
            'connection_rate_pct':    round(float(len(fin) / total * 100), 1),
            'ptp_rate_pct':           round(float(ptps / conn * 100), 1),
            'cost_per_ptp_sar':       round(total * cost_per_call / max(ptps, 1), 1),
            'recovery_per_call_sar':  round(ptp_v / total, 2),
            'sentiment_positive_pct': round(float((fin['sentiment'] == 'Positive').sum() / conn * 100), 1),
            'by_bucket':              by_bk,
        }

    ai_df  = df[df['agent_type'] == 'AI']
    hum_df = df[df['agent_type'] != 'AI']
    ai_s   = _ch_stats(ai_df, 2)
    hum_s  = _ch_stats(hum_df, 35)
    roi_m  = round(hum_s['cost_per_ptp_sar'] / max(ai_s['cost_per_ptp_sar'], 0.1), 1)
    av_h   = {
        'ai':    ai_s,
        'human': hum_s,
        'comparison': {
            'ptp_rate_winner':        'AI' if ai_s['ptp_rate_pct'] >= hum_s['ptp_rate_pct'] else 'Human',
            'cost_efficiency_winner': 'AI',
            'volume_advantage':       'AI',
            'quality_advantage':      'Human',
            'roi_multiplier':         roi_m,
            'recommended_split_pct':  {'ai': 65, 'human': 35},
        },
    }

    return {
        "volume_trend":      volume_trend,
        "agent_leaderboard": agent_stats,
        "bucket_performance":bucket_perf,
        "sentiment_matrix":  sentiment_matrix,
        "ai_vs_human":       av_h,
    }

# ─────────────────────────────────────────────────────────────
# CAMPAIGNS
# ─────────────────────────────────────────────────────────────

_campaigns_db: list = []
_campaign_id_counter: int = 1

class CampaignCreateRequest(BaseModel):
    name:          str
    channel:       str
    buckets:       List[str]
    schedule_date: str
    schedule_time: str
    target_filter: str = "All"

def _get_target_count(buckets: List[str], target_filter: str) -> int:
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    if df.empty:
        return 0
    filtered = df[df['delinquency_bucket'].isin(buckets)]
    if target_filter == "High Risk":
        filtered = filtered[filtered['ml_risk_tier'].isin(['High Risk', 'Very High Risk'])]
    elif target_filter == "Medium Risk":
        filtered = filtered[filtered['ml_risk_tier'] == 'Medium Risk']
    elif target_filter == "Low Risk":
        filtered = filtered[filtered['ml_risk_tier'] == 'Low Risk']
    return len(filtered)

def _init_sample_campaigns():
    global _campaigns_db, _campaign_id_counter
    if _campaigns_db:
        return
    now  = datetime.now()
    yest = (now - timedelta(days=7)).strftime('%Y-%m-%d')
    tom  = (now + timedelta(days=1)).strftime('%Y-%m-%d')

    t1 = _get_target_count(['1-30 DPD'], 'All') or 2400
    r1 = int(t1 * 0.74); rs1 = int(r1 * 0.28); p1 = int(rs1 * 0.22)
    _campaigns_db.append({
        "id": 1, "name": "Early Arrears — SMS Reminder",
        "channel": "SMS", "buckets": ["1-30 DPD"],
        "schedule_date": now.strftime('%Y-%m-%d'), "schedule_time": "09:00",
        "status": "Active", "target_filter": "All",
        "target_count": t1, "reached_count": r1, "response_count": rs1, "ptp_count": p1,
        "created_by": "Abdullah Al-Otaibi", "created_at": (now - timedelta(hours=4)).isoformat(),
    })

    t2 = _get_target_count(['31-60 DPD'], 'High Risk') or 1850
    r2 = int(t2 * 0.68); rs2 = int(r2 * 0.31); p2 = int(rs2 * 0.24)
    _campaigns_db.append({
        "id": 2, "name": "Mid-Bucket — AI Voice Outreach",
        "channel": "AI Voice", "buckets": ["31-60 DPD"],
        "schedule_date": now.strftime('%Y-%m-%d'), "schedule_time": "10:30",
        "status": "Active", "target_filter": "High Risk",
        "target_count": t2, "reached_count": r2, "response_count": rs2, "ptp_count": p2,
        "created_by": "Faisal Al-Rashidi", "created_at": (now - timedelta(hours=2)).isoformat(),
    })

    t3 = _get_target_count(['61-90 DPD', 'NPA'], 'All') or 3100
    _campaigns_db.append({
        "id": 3, "name": "High-Risk Buckets — WhatsApp Follow-up",
        "channel": "WhatsApp", "buckets": ["61-90 DPD", "NPA"],
        "schedule_date": tom, "schedule_time": "11:00",
        "status": "Scheduled", "target_filter": "All",
        "target_count": t3, "reached_count": 0, "response_count": 0, "ptp_count": 0,
        "created_by": "Abdullah Al-Otaibi", "created_at": now.isoformat(),
    })

    t4 = _get_target_count(['1-30 DPD', '31-60 DPD'], 'All') or 4200
    r4 = int(t4 * 0.79); rs4 = int(r4 * 0.33); p4 = int(rs4 * 0.21)
    _campaigns_db.append({
        "id": 4, "name": "Monthly Salary Alignment — Multi-Bucket",
        "channel": "Voice", "buckets": ["1-30 DPD", "31-60 DPD"],
        "schedule_date": yest, "schedule_time": "08:00",
        "status": "Completed", "target_filter": "All",
        "target_count": t4, "reached_count": r4, "response_count": rs4, "ptp_count": p4,
        "created_by": "Faisal Al-Rashidi", "created_at": (now - timedelta(days=7)).isoformat(),
    })

    _campaign_id_counter = 5

@app.get("/campaigns")
async def list_campaigns(user=Depends(get_current_user)):
    _init_sample_campaigns()
    return {"campaigns": _campaigns_db}

@app.post("/campaigns")
async def create_campaign(req: CampaignCreateRequest, user=Depends(get_current_user)):
    global _campaign_id_counter
    if user['role'] not in ["admin", "supervisor"]:
        raise HTTPException(403, "Only Admin or Supervisor can create campaigns")
    _init_sample_campaigns()
    target = _get_target_count(req.buckets, req.target_filter)
    camp = {
        "id": _campaign_id_counter, "name": req.name, "channel": req.channel,
        "buckets": req.buckets, "schedule_date": req.schedule_date,
        "schedule_time": req.schedule_time, "status": "Scheduled",
        "target_filter": req.target_filter, "target_count": target,
        "reached_count": 0, "response_count": 0, "ptp_count": 0,
        "created_by": user['name'], "created_at": datetime.now().isoformat(),
    }
    _campaigns_db.append(camp)
    _campaign_id_counter += 1
    log_audit(user['user_id'], user['name'], str(user['role']), "Campaign Created",
              "Campaign", str(camp['id']),
              f"Campaign '{camp['name']}' created targeting {camp['target_count']} accounts via {camp['channel']}")
    return camp

@app.post("/campaigns/{campaign_id}/launch")
async def launch_campaign(campaign_id: int, user=Depends(get_current_user)):
    if user['role'] not in ["admin", "supervisor"]:
        raise HTTPException(403, "Only Admin or Supervisor can launch campaigns")
    _init_sample_campaigns()
    camp = next((c for c in _campaigns_db if c['id'] == campaign_id), None)
    if not camp:
        raise HTTPException(404, "Campaign not found")
    if camp['status'] != 'Scheduled':
        raise HTTPException(400, f"Cannot launch a campaign with status '{camp['status']}'")
    camp['status']         = 'Active'
    camp['reached_count']  = int(camp['target_count'] * random.uniform(0.60, 0.85))
    camp['response_count'] = int(camp['reached_count'] * random.uniform(0.20, 0.35))
    camp['ptp_count']      = int(camp['response_count'] * random.uniform(0.15, 0.25))
    log_audit(user['user_id'], user['name'], str(user['role']), "Campaign Launched",
              "Campaign", str(campaign_id),
              f"Campaign '{camp['name']}' launched — targeting {camp['target_count']} accounts")
    return camp

@app.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: int, user=Depends(get_current_user)):
    _init_sample_campaigns()
    camp = next((c for c in _campaigns_db if c['id'] == campaign_id), None)
    if not camp:
        raise HTTPException(404, "Campaign not found")
    if camp['status'] == 'Active':
        camp['status'] = 'Paused'
    elif camp['status'] == 'Paused':
        camp['status'] = 'Active'
    else:
        raise HTTPException(400, f"Cannot toggle a campaign with status '{camp['status']}'")
    action_lbl = "Campaign Paused" if camp['status'] == 'Paused' else "Campaign Resumed"
    log_audit(user['user_id'], user['name'], str(user['role']), action_lbl,
              "Campaign", str(campaign_id),
              f"Campaign '{camp['name']}' {camp['status'].lower()}")
    return camp

@app.get("/campaigns/{campaign_id}/stats")
async def get_campaign_stats(campaign_id: int, user=Depends(get_current_user)):
    _init_sample_campaigns()
    camp = next((c for c in _campaigns_db if c['id'] == campaign_id), None)
    if not camp:
        raise HTTPException(404, "Campaign not found")
    total   = camp['reached_count']
    hourly  = []
    cumulative = 0
    for h in range(24):
        if h < 8 or h > 21:
            count = 0
        else:
            weight = 1.0 - abs(14 - h) * 0.07
            count  = max(0, int(total * weight / 11) + random.randint(-3, 3)) if total > 0 else 0
        cumulative = min(cumulative + count, total)
        hourly.append({"hour": f"{h:02d}:00", "reached": count, "cumulative": cumulative})
    bucket_breakdown = [
        {"bucket": b, "count": max(1, camp['target_count'] // len(camp['buckets']))}
        for b in camp['buckets']
    ]
    response_rate = round(camp['response_count'] / camp['reached_count'] * 100, 1) if camp['reached_count'] > 0 else 0
    ptp_rate      = round(camp['ptp_count'] / camp['response_count'] * 100, 1) if camp['response_count'] > 0 else 0
    return {
        "campaign":         camp,
        "hourly_reach":     hourly,
        "bucket_breakdown": bucket_breakdown,
        "response_rate":    response_rate,
        "ptp_rate":         ptp_rate,
        "top_bucket":       camp['buckets'][0] if camp['buckets'] else None,
    }

# ─────────────────────────────────────────────────────────────
# LEGAL CASES
# ─────────────────────────────────────────────────────────────

legal_cases_db: list = []
legal_case_id_counter: int = 1

class LegalCaseCreateRequest(BaseModel):
    account_id:      str
    case_type:       str
    assigned_lawyer: str
    collateral_type: str = "None"
    notes:           Optional[str] = ""

class LegalCaseStatusRequest(BaseModel):
    status:           str
    note:             str
    next_action_date: Optional[str] = None
    next_action_type: Optional[str] = None

def _init_legal_cases():
    global legal_cases_db, legal_case_id_counter
    if legal_cases_db:
        return

    now = datetime.now()

    def dt(days_ago, hour=9):
        return (now - timedelta(days=days_ago)).replace(hour=hour, minute=0, second=0).isoformat()

    def fd(days_ahead):
        return (now + timedelta(days=days_ahead)).strftime('%Y-%m-%d')

    cases = [
        {"id":1,"case_number":"LGL-0001","account_id":"WAT-001234","customer_name":"Mohammed Al-Rashidi","delinquency_bucket":"NPA","outstanding_sar":485000,"assigned_lawyer":"Khaled Al-Harbi","status":"Initiated","case_type":"Civil","collateral_type":"Property","initiated_date":dt(10),"next_action_date":fd(5),"next_action_type":"Document Review","court_date":None,"recovery_amount_sar":0,"notes":"Customer unresponsive for 90+ days","timeline":[
            {"date":dt(10),"event":"Case initiated","user":"Khaled Al-Harbi","notes":"Account escalated from collections after 120 DPD"},
        ]},
        {"id":2,"case_number":"LGL-0002","account_id":"WAT-002891","customer_name":"Fatima Al-Zahrani","delinquency_bucket":"Write-off","outstanding_sar":1250000,"assigned_lawyer":"Nora Al-Khalid","status":"Initiated","case_type":"Enforcement","collateral_type":"Vehicle","initiated_date":dt(8),"next_action_date":fd(3),"next_action_type":"Asset Valuation","court_date":None,"recovery_amount_sar":0,"notes":"Vehicle collateral to be assessed. Customer relocated.","timeline":[
            {"date":dt(8),"event":"Case initiated","user":"Nora Al-Khalid","notes":"Write-off with vehicle collateral — initiating enforcement"},
        ]},
        {"id":3,"case_number":"LGL-0003","account_id":"WAT-005612","customer_name":"Ibrahim Al-Mutairi","delinquency_bucket":"NPA","outstanding_sar":178000,"assigned_lawyer":"Khaled Al-Harbi","status":"Initiated","case_type":"Civil","collateral_type":"Guarantor","initiated_date":dt(5),"next_action_date":fd(7),"next_action_type":"Guarantor Notice","court_date":None,"recovery_amount_sar":0,"notes":"Guarantor contacted, awaiting response","timeline":[
            {"date":dt(5),"event":"Case initiated","user":"Khaled Al-Harbi","notes":"Civil action against guarantor"},
        ]},
        {"id":4,"case_number":"LGL-0004","account_id":"WAT-008344","customer_name":"Sara Al-Ghamdi","delinquency_bucket":"NPA","outstanding_sar":312000,"assigned_lawyer":"Khaled Al-Harbi","status":"Under Review","case_type":"Civil","collateral_type":"None","initiated_date":dt(25),"next_action_date":fd(4),"next_action_type":"Legal Review","court_date":None,"recovery_amount_sar":0,"notes":"Documents under review by legal counsel","timeline":[
            {"date":dt(25),"event":"Case initiated","user":"Nora Al-Khalid","notes":"Account referred from collections"},
            {"date":dt(18),"event":"Under Review","user":"Khaled Al-Harbi","notes":"Documents collected, case under formal review"},
        ]},
        {"id":5,"case_number":"LGL-0005","account_id":"WAT-011209","customer_name":"Ahmed Al-Otaibi","delinquency_bucket":"Write-off","outstanding_sar":895000,"assigned_lawyer":"Nora Al-Khalid","status":"Under Review","case_type":"Criminal","collateral_type":"None","initiated_date":dt(30),"next_action_date":fd(6),"next_action_type":"Prosecutor Meeting","court_date":None,"recovery_amount_sar":0,"notes":"Fraud indicators detected — escalated to criminal","timeline":[
            {"date":dt(30),"event":"Case initiated","user":"Nora Al-Khalid","notes":"Fraud suspected — escalated from compliance"},
            {"date":dt(22),"event":"Under Review","user":"Nora Al-Khalid","notes":"Criminal referral submitted to prosecutor office"},
        ]},
        {"id":6,"case_number":"LGL-0006","account_id":"WAT-014567","customer_name":"Khalid Al-Harbi","delinquency_bucket":"NPA","outstanding_sar":630000,"assigned_lawyer":"Khaled Al-Harbi","status":"Filed","case_type":"Civil","collateral_type":"Property","initiated_date":dt(60),"next_action_date":fd(14),"next_action_type":"Court Hearing","court_date":fd(14),"recovery_amount_sar":0,"notes":"Property lien filed, court hearing scheduled","timeline":[
            {"date":dt(60),"event":"Case initiated","user":"Khaled Al-Harbi","notes":"NPA account — property collateral"},
            {"date":dt(45),"event":"Under Review","user":"Khaled Al-Harbi","notes":"Property valuation completed: SAR 720,000"},
            {"date":dt(30),"event":"Filed","user":"Khaled Al-Harbi","notes":"Filed at Commercial Court — ref CC-2026-1892"},
        ]},
        {"id":7,"case_number":"LGL-0007","account_id":"WAT-017823","customer_name":"Noura Al-Shamri","delinquency_bucket":"Write-off","outstanding_sar":2100000,"assigned_lawyer":"Nora Al-Khalid","status":"Filed","case_type":"Enforcement","collateral_type":"Property","initiated_date":dt(75),"next_action_date":fd(20),"next_action_type":"Court Hearing","court_date":fd(20),"recovery_amount_sar":0,"notes":"High-value property enforcement case","timeline":[
            {"date":dt(75),"event":"Case initiated","user":"Nora Al-Khalid","notes":"High-value write-off — property enforcement"},
            {"date":dt(58),"event":"Under Review","user":"Nora Al-Khalid","notes":"Property title confirmed, enforcement order prepared"},
            {"date":dt(40),"event":"Filed","user":"Nora Al-Khalid","notes":"Property freeze order issued by court"},
        ]},
        {"id":8,"case_number":"LGL-0008","account_id":"WAT-021445","customer_name":"Faisal Al-Dossari","delinquency_bucket":"NPA","outstanding_sar":420000,"assigned_lawyer":"Khaled Al-Harbi","status":"Filed","case_type":"Civil","collateral_type":"Guarantor","initiated_date":dt(55),"next_action_date":fd(10),"next_action_type":"Guarantor Hearing","court_date":fd(10),"recovery_amount_sar":0,"notes":"Guarantor dispute in court","timeline":[
            {"date":dt(55),"event":"Case initiated","user":"Khaled Al-Harbi","notes":"Guarantor failed to settle after primary default"},
            {"date":dt(40),"event":"Under Review","user":"Khaled Al-Harbi","notes":"Guarantor agreement reviewed by legal"},
            {"date":dt(25),"event":"Filed","user":"Khaled Al-Harbi","notes":"Civil claim filed — ref GC-2026-0441"},
        ]},
        {"id":9,"case_number":"LGL-0009","account_id":"WAT-025678","customer_name":"Tariq Al-Shahrani","delinquency_bucket":"Write-off","outstanding_sar":760000,"assigned_lawyer":"Nora Al-Khalid","status":"Active","case_type":"Civil","collateral_type":"Vehicle","initiated_date":dt(120),"next_action_date":fd(8),"next_action_type":"Second Hearing","court_date":fd(8),"recovery_amount_sar":85000,"notes":"First hearing completed, awaiting judge decision","timeline":[
            {"date":dt(120),"event":"Case initiated","user":"Khaled Al-Harbi","notes":"Write-off with vehicle collateral"},
            {"date":dt(100),"event":"Under Review","user":"Nora Al-Khalid","notes":"Assigned to Nora — case complexity"},
            {"date":dt(80),"event":"Filed","user":"Nora Al-Khalid","notes":"Filed at Civil Court — ref CIV-2026-0312"},
            {"date":dt(45),"event":"Active","user":"Nora Al-Khalid","notes":"First hearing held — vehicle repossession order pending"},
        ]},
        {"id":10,"case_number":"LGL-0010","account_id":"WAT-029001","customer_name":"Hessa Al-Qahtani","delinquency_bucket":"Write-off","outstanding_sar":1580000,"assigned_lawyer":"Khaled Al-Harbi","status":"Active","case_type":"Criminal","collateral_type":"None","initiated_date":dt(150),"next_action_date":fd(12),"next_action_type":"Criminal Hearing","court_date":fd(12),"recovery_amount_sar":0,"notes":"Criminal fraud case — travel ban issued","timeline":[
            {"date":dt(150),"event":"Case initiated","user":"Khaled Al-Harbi","notes":"Criminal fraud — high-value write-off"},
            {"date":dt(130),"event":"Under Review","user":"Khaled Al-Harbi","notes":"Evidence submitted to prosecutor"},
            {"date":dt(110),"event":"Filed","user":"Khaled Al-Harbi","notes":"Criminal referral accepted — prosecutor assigned"},
            {"date":dt(60),"event":"Active","user":"Khaled Al-Harbi","notes":"Travel ban and assets freeze order in place"},
        ]},
        {"id":11,"case_number":"LGL-0011","account_id":"WAT-032556","customer_name":"Abdullah Al-Amer","delinquency_bucket":"NPA","outstanding_sar":290000,"assigned_lawyer":"Nora Al-Khalid","status":"Active","case_type":"Enforcement","collateral_type":"Property","initiated_date":dt(90),"next_action_date":fd(15),"next_action_type":"Auction Date","court_date":fd(15),"recovery_amount_sar":120000,"notes":"Property auction scheduled","timeline":[
            {"date":dt(90),"event":"Case initiated","user":"Nora Al-Khalid","notes":"Enforcement against registered property"},
            {"date":dt(70),"event":"Under Review","user":"Nora Al-Khalid","notes":"Property title search completed"},
            {"date":dt(50),"event":"Filed","user":"Nora Al-Khalid","notes":"Enforcement order issued by court"},
            {"date":dt(20),"event":"Active","user":"Nora Al-Khalid","notes":"Property auction date set — estimated value SAR 380,000"},
        ]},
        {"id":12,"case_number":"LGL-0012","account_id":"WAT-036789","customer_name":"Mona Al-Subaie","delinquency_bucket":"Write-off","outstanding_sar":520000,"assigned_lawyer":"Khaled Al-Harbi","status":"Judgment","case_type":"Civil","collateral_type":"Property","initiated_date":dt(180),"next_action_date":fd(2),"next_action_type":"Recovery Execution","court_date":dt(15),"recovery_amount_sar":340000,"notes":"Judgment in bank's favor — executing recovery","timeline":[
            {"date":dt(180),"event":"Case initiated","user":"Khaled Al-Harbi","notes":"Write-off civil case"},
            {"date":dt(150),"event":"Under Review","user":"Khaled Al-Harbi","notes":"Documents compiled"},
            {"date":dt(120),"event":"Filed","user":"Khaled Al-Harbi","notes":"Filed — ref CIV-2025-0891"},
            {"date":dt(60),"event":"Active","user":"Khaled Al-Harbi","notes":"Three hearings held, final arguments submitted"},
            {"date":dt(15),"event":"Judgment","user":"Khaled Al-Harbi","notes":"Court ruled for bank — SAR 340,000 from property sale"},
        ]},
        {"id":13,"case_number":"LGL-0013","account_id":"WAT-040123","customer_name":"Wael Al-Harbi","delinquency_bucket":"Write-off","outstanding_sar":1100000,"assigned_lawyer":"Nora Al-Khalid","status":"Judgment","case_type":"Enforcement","collateral_type":"Vehicle","initiated_date":dt(200),"next_action_date":fd(7),"next_action_type":"Asset Handover","court_date":dt(25),"recovery_amount_sar":680000,"notes":"Enforcement judgment — asset handover pending","timeline":[
            {"date":dt(200),"event":"Case initiated","user":"Nora Al-Khalid","notes":"High-value enforcement — multiple vehicles"},
            {"date":dt(170),"event":"Under Review","user":"Nora Al-Khalid","notes":"Vehicle registrations traced"},
            {"date":dt(140),"event":"Filed","user":"Nora Al-Khalid","notes":"Enforcement filed — all vehicles listed"},
            {"date":dt(80),"event":"Active","user":"Nora Al-Khalid","notes":"Repossession order granted for 2 vehicles"},
            {"date":dt(25),"event":"Judgment","user":"Nora Al-Khalid","notes":"Final judgment: SAR 680,000 recovery — vehicles to be auctioned"},
        ]},
        {"id":14,"case_number":"LGL-0014","account_id":"WAT-043456","customer_name":"Reem Al-Anzi","delinquency_bucket":"NPA","outstanding_sar":380000,"assigned_lawyer":"Khaled Al-Harbi","status":"Suspended","case_type":"Civil","collateral_type":"Guarantor","initiated_date":dt(110),"next_action_date":fd(30),"next_action_type":"Resume Review","court_date":None,"recovery_amount_sar":0,"notes":"Suspended — customer in active settlement negotiation","timeline":[
            {"date":dt(110),"event":"Case initiated","user":"Nora Al-Khalid","notes":"Civil with guarantor"},
            {"date":dt(85),"event":"Under Review","user":"Khaled Al-Harbi","notes":"Guarantor located and contacted"},
            {"date":dt(65),"event":"Filed","user":"Khaled Al-Harbi","notes":"Filed — awaiting court date"},
            {"date":dt(40),"event":"Suspended","user":"Khaled Al-Harbi","notes":"60-day suspension — settlement offer under review"},
        ]},
        {"id":15,"case_number":"LGL-0015","account_id":"WAT-046789","customer_name":"Sultan Al-Rashidi","delinquency_bucket":"Write-off","outstanding_sar":640000,"assigned_lawyer":"Nora Al-Khalid","status":"Closed","case_type":"Civil","collateral_type":"Property","initiated_date":dt(365),"next_action_date":None,"next_action_type":None,"court_date":dt(120),"recovery_amount_sar":580000,"notes":"Fully resolved — property sold at auction","timeline":[
            {"date":dt(365),"event":"Case initiated","user":"Khaled Al-Harbi","notes":"High-value write-off — residential property"},
            {"date":dt(330),"event":"Under Review","user":"Nora Al-Khalid","notes":"Property valued at SAR 720,000"},
            {"date":dt(290),"event":"Filed","user":"Nora Al-Khalid","notes":"Filed at Commercial Court"},
            {"date":dt(200),"event":"Active","user":"Nora Al-Khalid","notes":"Three hearings completed"},
            {"date":dt(150),"event":"Judgment","user":"Nora Al-Khalid","notes":"Court ruled in bank's favor — full outstanding"},
            {"date":dt(90),"event":"Closed","user":"Nora Al-Khalid","notes":"Recovery complete — SAR 580,000 received. Case closed."},
        ]},
    ]
    legal_cases_db.extend(cases)
    legal_case_id_counter = 16

_LEGAL_ROLES = [Role.ADMIN, Role.SUPERVISOR, Role.LEGAL]

@app.get("/legal/cases")
async def list_legal_cases(
    page:   int = 1,
    limit:  int = 20,
    status: Optional[str] = None,
    bucket: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(get_current_user)
):
    _init_legal_cases()
    cases = list(legal_cases_db)
    if status: cases = [c for c in cases if c['status'] == status]
    if bucket: cases = [c for c in cases if c['delinquency_bucket'] == bucket]
    if search:
        sl = search.lower()
        cases = [c for c in cases if sl in c['case_number'].lower() or sl in c['customer_name'].lower() or sl in c['account_id'].lower()]
    total  = len(cases)
    offset = (page - 1) * limit
    page_data = cases[offset:offset + limit]
    return {"total": total, "page": page, "limit": limit, "cases": page_data}

@app.get("/legal/cases/{case_id}")
async def get_legal_case(case_id: int, user=Depends(get_current_user)):
    _init_legal_cases()
    case = next((c for c in legal_cases_db if c['id'] == case_id), None)
    if not case:
        raise HTTPException(404, "Case not found")
    return case

@app.post("/legal/cases")
async def create_legal_case(req: LegalCaseCreateRequest, user=Depends(get_current_user)):
    global legal_case_id_counter
    if user['role'] not in _LEGAL_ROLES:
        raise HTTPException(403, "Insufficient permissions to initiate legal cases")
    _init_legal_cases()
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    row  = df[df['account_id'] == req.account_id] if not df.empty else pd.DataFrame()
    if not row.empty:
        r               = row.iloc[0]
        customer_name   = str(r.get('customer_name', 'Unknown'))
        outstanding_sar = float(r.get('outstanding_balance_sar', 0))
        bucket          = str(r.get('delinquency_bucket', 'NPA'))
    else:
        customer_name   = 'Unknown'
        outstanding_sar = 0.0
        bucket          = 'NPA'
    case_num = f"LGL-{legal_case_id_counter:04d}"
    new_case = {
        "id":                  legal_case_id_counter,
        "case_number":         case_num,
        "account_id":          req.account_id,
        "customer_name":       customer_name,
        "delinquency_bucket":  bucket,
        "outstanding_sar":     outstanding_sar,
        "assigned_lawyer":     req.assigned_lawyer,
        "status":              "Initiated",
        "case_type":           req.case_type,
        "collateral_type":     req.collateral_type,
        "initiated_date":      datetime.now().isoformat(),
        "next_action_date":    None,
        "next_action_type":    None,
        "court_date":          None,
        "recovery_amount_sar": 0,
        "notes":               req.notes,
        "timeline": [
            {"date": datetime.now().isoformat(), "event": "Case initiated",
             "user": user['name'], "notes": req.notes or "Legal case opened"},
        ],
    }
    legal_cases_db.append(new_case)
    legal_case_id_counter += 1
    log_audit(user["user_id"], user["name"], str(user["role"]), "Legal Case Opened", "LegalCase",
              case_num, f"Legal case {case_num} initiated for {req.account_id}")
    return new_case

@app.put("/legal/cases/{case_id}/status")
async def update_legal_case_status(case_id: int, req: LegalCaseStatusRequest, user=Depends(get_current_user)):
    if user['role'] not in _LEGAL_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    _init_legal_cases()
    case = next((c for c in legal_cases_db if c['id'] == case_id), None)
    if not case:
        raise HTTPException(404, "Case not found")
    case['status'] = req.status
    if req.next_action_date: case['next_action_date'] = req.next_action_date
    if req.next_action_type: case['next_action_type'] = req.next_action_type
    case['timeline'].append({
        "date":  datetime.now().isoformat(),
        "event": req.status,
        "user":  user['name'],
        "notes": req.note,
    })
    log_audit(user['user_id'], user['name'], str(user['role']), "Legal Case Updated",
              "LegalCase", case['case_number'],
              f"Legal case {case['case_number']} status changed to '{req.status}'")
    return case

@app.get("/legal/stats")
async def get_legal_stats(user=Depends(get_current_user)):
    _init_legal_cases()
    cases          = legal_cases_db
    total          = len(cases)
    active_filed   = sum(1 for c in cases if c['status'] in ('Active', 'Filed', 'Under Review', 'Initiated'))
    judgment       = sum(1 for c in cases if c['status'] == 'Judgment')
    closed         = sum(1 for c in cases if c['status'] == 'Closed')
    total_out      = sum(c['outstanding_sar'] for c in cases)
    total_rec      = sum(c['recovery_amount_sar'] for c in cases)
    recovery_rate  = round(total_rec / total_out * 100, 1) if total_out > 0 else 0
    by_status      = {}
    by_bucket      = {}
    by_type        = {}
    for c in cases:
        by_status[c['status']] = by_status.get(c['status'], 0) + 1
        by_bucket[c['delinquency_bucket']] = by_bucket.get(c['delinquency_bucket'], 0) + 1
        by_type[c['case_type']] = by_type.get(c['case_type'], 0) + 1
    return {
        "total_cases":        total,
        "active_cases":       active_filed,
        "filed_cases":        sum(1 for c in cases if c['status'] == 'Filed'),
        "judgment_cases":     judgment,
        "closed_cases":       closed,
        "total_outstanding_sar": total_out,
        "total_recovered_sar":   total_rec,
        "recovery_rate_pct":  recovery_rate,
        "cases_by_status":    by_status,
        "cases_by_bucket":    by_bucket,
        "cases_by_type":      by_type,
    }

# ─────────────────────────────────────────────────────────────
# SETTLEMENTS
# ─────────────────────────────────────────────────────────────

settlements_db: list = []
settlement_id_counter: int = 1
_settlements_initialized = False

class SettlementCreateRequest(BaseModel):
    account_id:            str
    offer_type:            str
    discount_pct:          Optional[float] = None
    tenor_months:          Optional[int]   = None
    settlement_amount_sar: float
    expiry_days:           int = 7
    notes:                 Optional[str] = ""

def _settlement_options_for(score: int, outstanding: float) -> list:
    offers = []
    offers.append({
        "type": "PaymentPlan", "max_discount_pct": None,
        "available_tenors": [3, 4, 5],
        "recommended": 550 <= score < 700,
        "description": "Structured repayment over 3–5 months at no discount.",
    })
    if score < 400:
        if outstanding > 50000:
            offers.append({
                "type": "OTS", "max_discount_pct": None, "available_tenors": None,
                "recommended": True,
                "description": "One-Time Settlement — lump-sum payment to close account. Recommended for very high-risk accounts.",
            })
    elif score < 550:
        offers.append({
            "type": "Discount", "max_discount_pct": 10, "available_tenors": None,
            "recommended": False,
            "description": "Discounted settlement — up to 10% reduction on outstanding balance.",
        })
        offers.append({
            "type": "OTS", "max_discount_pct": None, "available_tenors": None,
            "recommended": True,
            "description": "One-Time Settlement — lump-sum payment to close account.",
        })
    elif score < 700:
        offers.append({
            "type": "Discount", "max_discount_pct": 20, "available_tenors": None,
            "recommended": True,
            "description": "Discounted settlement — up to 20% reduction on outstanding balance.",
        })
    else:
        offers.append({
            "type": "Discount", "max_discount_pct": 30, "available_tenors": None,
            "recommended": False,
            "description": "Discounted settlement — up to 30% reduction on outstanding balance.",
        })
        offers.append({
            "type": "FeeWaiver", "max_discount_pct": None, "available_tenors": None,
            "recommended": True,
            "description": "Fee waiver — waive late fees and penalties only. Principal remains.",
        })
    return offers

def _init_settlements():
    global settlements_db, settlement_id_counter, _settlements_initialized
    if _settlements_initialized:
        return
    _settlements_initialized = True
    now = datetime.now()
    def d(delta):  return (now + timedelta(days=delta)).strftime('%Y-%m-%d')
    def ts(delta): return (now - timedelta(days=delta)).replace(hour=10, minute=0, second=0).isoformat()
    samples = [
        {"id":1,"offer_id":"SETL-00001","account_id":"WAT-001234","customer_name":"Mohammed Al-Rashidi","delinquency_bucket":"NPA","risk_tier":"High Risk","offer_type":"Discount","discount_pct":8.0,"tenor_months":None,"original_amount_sar":485000,"settlement_amount_sar":446200,"saving_amount_sar":38800,"saving_pct":8.0,"status":"Accepted","created_by":"USR-003","created_by_name":"Nora Al-Khalid","created_at":ts(15),"expiry_date":d(-8),"accepted_date":ts(12),"rejected_date":None,"notes":"Customer agreed to 8% discount — partial property proceeds"},
        {"id":2,"offer_id":"SETL-00002","account_id":"WAT-005612","customer_name":"Ibrahim Al-Mutairi","delinquency_bucket":"NPA","risk_tier":"Medium Risk","offer_type":"PaymentPlan","discount_pct":None,"tenor_months":4,"original_amount_sar":178000,"settlement_amount_sar":178000,"saving_amount_sar":0,"saving_pct":0.0,"status":"Accepted","created_by":"USR-003","created_by_name":"Nora Al-Khalid","created_at":ts(10),"expiry_date":d(-3),"accepted_date":ts(8),"rejected_date":None,"notes":"4-month instalment plan — SAR 44,500/month"},
        {"id":3,"offer_id":"SETL-00003","account_id":"WAT-036789","customer_name":"Mona Al-Subaie","delinquency_bucket":"Write-off","risk_tier":"Very High Risk","offer_type":"OTS","discount_pct":None,"tenor_months":None,"original_amount_sar":520000,"settlement_amount_sar":390000,"saving_amount_sar":130000,"saving_pct":25.0,"status":"Accepted","created_by":"USR-002","created_by_name":"Faisal Al-Rashidi","created_at":ts(20),"expiry_date":d(-13),"accepted_date":ts(16),"rejected_date":None,"notes":"OTS at 75% — family hardship. Recovery confirmed."},
        {"id":4,"offer_id":"SETL-00004","account_id":"WAT-008344","customer_name":"Sara Al-Ghamdi","delinquency_bucket":"NPA","risk_tier":"High Risk","offer_type":"Discount","discount_pct":10.0,"tenor_months":None,"original_amount_sar":312000,"settlement_amount_sar":280800,"saving_amount_sar":31200,"saving_pct":10.0,"status":"Pending","created_by":"USR-003","created_by_name":"Nora Al-Khalid","created_at":ts(3),"expiry_date":d(4),"accepted_date":None,"rejected_date":None,"notes":"Customer reviewing — follow up due Thursday"},
        {"id":5,"offer_id":"SETL-00005","account_id":"WAT-040123","customer_name":"Wael Al-Harbi","delinquency_bucket":"Write-off","risk_tier":"Very High Risk","offer_type":"OTS","discount_pct":None,"tenor_months":None,"original_amount_sar":1100000,"settlement_amount_sar":770000,"saving_amount_sar":330000,"saving_pct":30.0,"status":"Pending","created_by":"USR-002","created_by_name":"Faisal Al-Rashidi","created_at":ts(2),"expiry_date":d(5),"accepted_date":None,"rejected_date":None,"notes":"Supervisor-approved OTS at 70% — legal case pending"},
        {"id":6,"offer_id":"SETL-00006","account_id":"WAT-025678","customer_name":"Tariq Al-Shahrani","delinquency_bucket":"Write-off","risk_tier":"Very High Risk","offer_type":"PaymentPlan","discount_pct":None,"tenor_months":5,"original_amount_sar":760000,"settlement_amount_sar":760000,"saving_amount_sar":0,"saving_pct":0.0,"status":"Pending","created_by":"USR-003","created_by_name":"Nora Al-Khalid","created_at":ts(1),"expiry_date":d(6),"accepted_date":None,"rejected_date":None,"notes":"5-month plan — SAR 152,000/month"},
        {"id":7,"offer_id":"SETL-00007","account_id":"WAT-029001","customer_name":"Hessa Al-Qahtani","delinquency_bucket":"Write-off","risk_tier":"Very High Risk","offer_type":"Discount","discount_pct":5.0,"tenor_months":None,"original_amount_sar":1580000,"settlement_amount_sar":1501000,"saving_amount_sar":79000,"saving_pct":5.0,"status":"Rejected","created_by":"USR-002","created_by_name":"Faisal Al-Rashidi","created_at":ts(18),"expiry_date":d(-11),"accepted_date":None,"rejected_date":ts(14),"notes":"Customer rejected — requesting higher discount"},
        {"id":8,"offer_id":"SETL-00008","account_id":"WAT-014567","customer_name":"Khalid Al-Harbi","delinquency_bucket":"NPA","risk_tier":"Medium Risk","offer_type":"FeeWaiver","discount_pct":None,"tenor_months":None,"original_amount_sar":630000,"settlement_amount_sar":598500,"saving_amount_sar":31500,"saving_pct":5.0,"status":"Rejected","created_by":"USR-003","created_by_name":"Nora Al-Khalid","created_at":ts(25),"expiry_date":d(-18),"accepted_date":None,"rejected_date":ts(20),"notes":"Customer wants full principal reduction"},
        {"id":9,"offer_id":"SETL-00009","account_id":"WAT-017823","customer_name":"Noura Al-Shamri","delinquency_bucket":"Write-off","risk_tier":"Very High Risk","offer_type":"OTS","discount_pct":None,"tenor_months":None,"original_amount_sar":2100000,"settlement_amount_sar":1470000,"saving_amount_sar":630000,"saving_pct":30.0,"status":"Expired","created_by":"USR-002","created_by_name":"Faisal Al-Rashidi","created_at":ts(40),"expiry_date":d(-33),"accepted_date":None,"rejected_date":None,"notes":"Offer expired — no response from customer"},
        {"id":10,"offer_id":"SETL-00010","account_id":"WAT-021445","customer_name":"Faisal Al-Dossari","delinquency_bucket":"NPA","risk_tier":"Low Risk","offer_type":"Discount","discount_pct":20.0,"tenor_months":None,"original_amount_sar":420000,"settlement_amount_sar":336000,"saving_amount_sar":84000,"saving_pct":20.0,"status":"Expired","created_by":"USR-003","created_by_name":"Nora Al-Khalid","created_at":ts(45),"expiry_date":d(-38),"accepted_date":None,"rejected_date":None,"notes":"Offer expired — customer missed deadline"},
    ]
    settlements_db.extend(samples)
    settlement_id_counter = 11

_SETTLEMENT_ROLES = [Role.ADMIN, Role.SUPERVISOR, Role.COLLECTOR]

@app.get("/settlements/stats")
async def get_settlement_stats(user=Depends(get_current_user)):
    _init_settlements()
    all_s    = settlements_db
    pending  = [s for s in all_s if s['status'] == 'Pending']
    accepted = [s for s in all_s if s['status'] == 'Accepted']
    rejected = [s for s in all_s if s['status'] == 'Rejected']
    expired  = [s for s in all_s if s['status'] == 'Expired']
    denom    = len(accepted) + len(rejected) + len(expired)
    return {
        "total_offers":               len(all_s),
        "pending_count":              len(pending),
        "pending_sar":                sum(s['settlement_amount_sar'] for s in pending),
        "accepted_count":             len(accepted),
        "accepted_sar":               sum(s['settlement_amount_sar'] for s in accepted),
        "rejected_count":             len(rejected),
        "expired_count":              len(expired),
        "total_settlement_value_sar": sum(s['settlement_amount_sar'] for s in accepted),
        "total_savings_offered_sar":  sum(s['saving_amount_sar'] for s in all_s),
        "acceptance_rate_pct":        round(len(accepted) / denom * 100, 1) if denom > 0 else 0,
    }

@app.get("/settlements/options/{account_id}")
async def get_settlement_options(account_id: str, user=Depends(get_current_user)):
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    row  = df[df['account_id'] == account_id] if not df.empty else pd.DataFrame()
    if row.empty:
        raise HTTPException(404, f"Account {account_id} not found")
    r           = row.iloc[0]
    score       = int(r.get('ml_ptp_score', 500))
    outstanding = float(r.get('outstanding_balance_sar', 0))
    return {
        "account_id":  account_id,
        "ptp_score":   score,
        "outstanding": outstanding,
        "offers":      _settlement_options_for(score, outstanding),
    }

@app.get("/settlements")
async def list_settlements(
    account_id: Optional[str] = None,
    status:     Optional[str] = None,
    user=Depends(get_current_user)
):
    _init_settlements()
    result = list(settlements_db)
    if account_id: result = [s for s in result if s['account_id'] == account_id]
    if status:     result = [s for s in result if s['status']     == status]
    return {"total": len(result), "settlements": result}

@app.post("/settlements")
async def create_settlement(req: SettlementCreateRequest, user=Depends(get_current_user)):
    global settlement_id_counter
    if user['role'] not in _SETTLEMENT_ROLES:
        raise HTTPException(403, "Only Collector, Supervisor, or Admin can create settlement offers")
    _init_settlements()
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    row  = df[df['account_id'] == req.account_id] if not df.empty else pd.DataFrame()
    if row.empty:
        raise HTTPException(404, f"Account {req.account_id} not found")
    r               = row.iloc[0]
    customer_name   = str(r.get('customer_name', 'Unknown'))
    original_amount = float(r.get('outstanding_balance_sar', 0))
    bucket          = str(r.get('delinquency_bucket', 'NPA'))
    risk_tier       = str(r.get('ml_risk_tier', 'High Risk'))
    saving          = round(original_amount - req.settlement_amount_sar, 2)
    saving_pct      = round(saving / original_amount * 100, 2) if original_amount > 0 else 0
    expiry          = (datetime.now() + timedelta(days=req.expiry_days)).strftime('%Y-%m-%d')
    new_s = {
        "id":                    settlement_id_counter,
        "offer_id":              f"SETL-{settlement_id_counter:05d}",
        "account_id":            req.account_id,
        "customer_name":         customer_name,
        "delinquency_bucket":    bucket,
        "risk_tier":             risk_tier,
        "offer_type":            req.offer_type,
        "discount_pct":          req.discount_pct,
        "tenor_months":          req.tenor_months,
        "original_amount_sar":   original_amount,
        "settlement_amount_sar": req.settlement_amount_sar,
        "saving_amount_sar":     saving,
        "saving_pct":            saving_pct,
        "status":                "Pending",
        "created_by":            user["user_id"],
        "created_by_name":       user["name"],
        "created_at":            datetime.now().isoformat(),
        "expiry_date":           expiry,
        "accepted_date":         None,
        "rejected_date":         None,
        "notes":                 req.notes,
    }
    settlements_db.append(new_s)
    settlement_id_counter += 1
    log_audit(user["user_id"], user["name"], str(user["role"]), "Settlement Offer Created",
              "Settlement", new_s["offer_id"],
              f"Settlement {new_s['offer_id']} ({req.offer_type}) created for {req.account_id} — SAR {req.settlement_amount_sar:,.0f}")
    return new_s

@app.get("/settlements/{settlement_id}")
async def get_settlement(settlement_id: int, user=Depends(get_current_user)):
    _init_settlements()
    s = next((s for s in settlements_db if s['id'] == settlement_id), None)
    if not s:
        raise HTTPException(404, "Settlement not found")
    return s

@app.put("/settlements/{settlement_id}/accept")
async def accept_settlement(settlement_id: int, user=Depends(get_current_user)):
    _init_settlements()
    s = next((s for s in settlements_db if s['id'] == settlement_id), None)
    if not s:
        raise HTTPException(404, "Settlement not found")
    if s['status'] != 'Pending':
        raise HTTPException(400, f"Cannot accept a settlement with status '{s['status']}'")
    s['status']        = 'Accepted'
    s['accepted_date'] = datetime.now().isoformat()
    log_audit(user["user_id"], user["name"], str(user["role"]), "Settlement Accepted",
              "Settlement", s["offer_id"],
              f"Settlement {s['offer_id']} accepted — SAR {s['settlement_amount_sar']:,.0f}")
    return s

@app.put("/settlements/{settlement_id}/reject")
async def reject_settlement(settlement_id: int, user=Depends(get_current_user)):
    _init_settlements()
    s = next((s for s in settlements_db if s['id'] == settlement_id), None)
    if not s:
        raise HTTPException(404, "Settlement not found")
    if s['status'] != 'Pending':
        raise HTTPException(400, f"Cannot reject a settlement with status '{s['status']}'")
    s['status']        = 'Rejected'
    s['rejected_date'] = datetime.now().isoformat()
    log_audit(user["user_id"], user["name"], str(user["role"]), "Settlement Rejected",
              "Settlement", s["offer_id"],
              f"Settlement {s['offer_id']} rejected for {s['account_id']}")
    return s

@app.put("/settlements/{settlement_id}/expire")
async def expire_settlement(settlement_id: int, user=Depends(get_current_user)):
    _init_settlements()
    s = next((s for s in settlements_db if s['id'] == settlement_id), None)
    if not s:
        raise HTTPException(404, "Settlement not found")
    if s['status'] != 'Pending':
        raise HTTPException(400, f"Cannot expire a settlement with status '{s['status']}'")
    s['status'] = 'Expired'
    return s

# ─────────────────────────────────────────────────────────────
# WAIVERS
# ─────────────────────────────────────────────────────────────

waivers_db: list = []
waiver_id_counter: int = 1
_waivers_initialized = False

class WaiverCreateRequest(BaseModel):
    account_id:  str
    waiver_type: str
    amount_sar:  float
    reason:      str
    notes:       Optional[str] = ""

class WaiverReviewRequest(BaseModel):
    review_note: str

def _init_waivers():
    global waivers_db, waiver_id_counter, _waivers_initialized
    if _waivers_initialized:
        return
    _waivers_initialized = True
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    if df.empty:
        return
    now  = datetime.now()
    accs = df.head(15)[['account_id','customer_name','outstanding_balance_sar','delinquency_bucket']].to_dict('records')

    def ts(d):  return (now - timedelta(days=d)).replace(hour=10, minute=0, second=0, microsecond=0).isoformat()
    def rv(d):  return (now - timedelta(days=d)).replace(hour=14, minute=30, second=0, microsecond=0).isoformat()

    samples = [
        # Approved × 4
        {"id":1,"waiver_id":"WAV-00001","account_id":accs[0]['account_id'],"customer_name":accs[0]['customer_name'],"outstanding_sar":float(accs[0]['outstanding_balance_sar']),"bucket":accs[0]['delinquency_bucket'],"waiver_type":"Late Fee","amount_sar":1200.0,"reason":"Customer hardship","notes":"Customer lost job — single income household","status":"Approved","requested_by":"Nora Al-Khalid","requested_by_role":"collector","requested_at":ts(18),"reviewed_by":"Faisal Al-Rashidi","reviewed_at":rv(16),"review_note":"Approved — hardship confirmed with documentation"},
        {"id":2,"waiver_id":"WAV-00002","account_id":accs[1]['account_id'],"customer_name":accs[1]['customer_name'],"outstanding_sar":float(accs[1]['outstanding_balance_sar']),"bucket":accs[1]['delinquency_bucket'],"waiver_type":"Penalty","amount_sar":850.0,"reason":"Long-term customer","notes":"10+ year customer with excellent prior record","status":"Approved","requested_by":"Nora Al-Khalid","requested_by_role":"collector","requested_at":ts(14),"reviewed_by":"Faisal Al-Rashidi","reviewed_at":rv(12),"review_note":"Approved — loyalty gesture for long-standing client"},
        {"id":3,"waiver_id":"WAV-00003","account_id":accs[2]['account_id'],"customer_name":accs[2]['customer_name'],"outstanding_sar":float(accs[2]['outstanding_balance_sar']),"bucket":accs[2]['delinquency_bucket'],"waiver_type":"Interest","amount_sar":3500.0,"reason":"Settlement facilitation","notes":"Waiving 60-day interest to facilitate full OTS","status":"Approved","requested_by":"Faisal Al-Rashidi","requested_by_role":"supervisor","requested_at":ts(10),"reviewed_by":"Abdullah Al-Otaibi","reviewed_at":rv(8),"review_note":"Approved — supports OTS deal worth SAR 480K"},
        {"id":4,"waiver_id":"WAV-00004","account_id":accs[3]['account_id'],"customer_name":accs[3]['customer_name'],"outstanding_sar":float(accs[3]['outstanding_balance_sar']),"bucket":accs[3]['delinquency_bucket'],"waiver_type":"Processing Fee","amount_sar":500.0,"reason":"Administrative error","notes":"Fee charged in error — system duplicate billing","status":"Approved","requested_by":"Nora Al-Khalid","requested_by_role":"collector","requested_at":ts(7),"reviewed_by":"Faisal Al-Rashidi","reviewed_at":rv(6),"review_note":"Approved — billing error confirmed by finance team"},
        # Pending × 4
        {"id":5,"waiver_id":"WAV-00005","account_id":accs[4]['account_id'],"customer_name":accs[4]['customer_name'],"outstanding_sar":float(accs[4]['outstanding_balance_sar']),"bucket":accs[4]['delinquency_bucket'],"waiver_type":"Late Fee","amount_sar":2400.0,"reason":"Customer hardship","notes":"Medical emergency — customer has hospital discharge letter","status":"Pending","requested_by":"Nora Al-Khalid","requested_by_role":"collector","requested_at":ts(3),"reviewed_by":None,"reviewed_at":None,"review_note":None},
        {"id":6,"waiver_id":"WAV-00006","account_id":accs[5]['account_id'],"customer_name":accs[5]['customer_name'],"outstanding_sar":float(accs[5]['outstanding_balance_sar']),"bucket":accs[5]['delinquency_bucket'],"waiver_type":"Penalty","amount_sar":1800.0,"reason":"Goodwill gesture","notes":"Customer promises full payment if penalty waived","status":"Pending","requested_by":"Faisal Al-Rashidi","requested_by_role":"supervisor","requested_at":ts(2),"reviewed_by":None,"reviewed_at":None,"review_note":None},
        {"id":7,"waiver_id":"WAV-00007","account_id":accs[6]['account_id'],"customer_name":accs[6]['customer_name'],"outstanding_sar":float(accs[6]['outstanding_balance_sar']),"bucket":accs[6]['delinquency_bucket'],"waiver_type":"Interest","amount_sar":6200.0,"reason":"Settlement facilitation","notes":"Part of proposed settlement package — supervisor review needed","status":"Pending","requested_by":"Nora Al-Khalid","requested_by_role":"collector","requested_at":ts(1),"reviewed_by":None,"reviewed_at":None,"review_note":None},
        {"id":8,"waiver_id":"WAV-00008","account_id":accs[7]['account_id'],"customer_name":accs[7]['customer_name'],"outstanding_sar":float(accs[7]['outstanding_balance_sar']),"bucket":accs[7]['delinquency_bucket'],"waiver_type":"Late Fee","amount_sar":950.0,"reason":"Long-term customer","notes":"15-year customer — first late payment ever","status":"Pending","requested_by":"Nora Al-Khalid","requested_by_role":"collector","requested_at":ts(0),"reviewed_by":None,"reviewed_at":None,"review_note":None},
        # Rejected × 2
        {"id":9,"waiver_id":"WAV-00009","account_id":accs[8]['account_id'],"customer_name":accs[8]['customer_name'],"outstanding_sar":float(accs[8]['outstanding_balance_sar']),"bucket":accs[8]['delinquency_bucket'],"waiver_type":"Interest","amount_sar":12000.0,"reason":"Customer hardship","notes":"Customer claims hardship but has active credit cards","status":"Rejected","requested_by":"Nora Al-Khalid","requested_by_role":"collector","requested_at":ts(20),"reviewed_by":"Faisal Al-Rashidi","reviewed_at":rv(18),"review_note":"Rejected — no supporting documentation; amount disproportionate"},
        {"id":10,"waiver_id":"WAV-00010","account_id":accs[9]['account_id'],"customer_name":accs[9]['customer_name'],"outstanding_sar":float(accs[9]['outstanding_balance_sar']),"bucket":accs[9]['delinquency_bucket'],"waiver_type":"Penalty","amount_sar":15000.0,"reason":"Goodwill gesture","notes":"Large penalty waiver — no specific justification","status":"Rejected","requested_by":"Faisal Al-Rashidi","requested_by_role":"supervisor","requested_at":ts(25),"reviewed_by":"Abdullah Al-Otaibi","reviewed_at":rv(23),"review_note":"Rejected — exceeds waiver authority limit without board approval"},
    ]
    waivers_db.extend(samples)
    waiver_id_counter = 11

_WAIVER_REQUEST_ROLES = [Role.ADMIN, Role.SUPERVISOR, Role.COLLECTOR]
_WAIVER_REVIEW_ROLES  = [Role.ADMIN, Role.SUPERVISOR]

@app.get("/waivers/stats")
async def get_waiver_stats(user=Depends(get_current_user)):
    _init_waivers()
    all_w    = waivers_db
    pending  = [w for w in all_w if w['status'] == 'Pending']
    approved = [w for w in all_w if w['status'] == 'Approved']
    rejected = [w for w in all_w if w['status'] == 'Rejected']
    denom    = len(approved) + len(rejected)
    now      = datetime.now()
    mo_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    approved_mo = [w for w in approved if w['reviewed_at'] and datetime.fromisoformat(w['reviewed_at']) >= mo_start]
    by_type: dict = {}
    for w in all_w:
        by_type[w['waiver_type']] = by_type.get(w['waiver_type'], 0) + 1
    return {
        "total_requests":            len(all_w),
        "pending_count":             len(pending),
        "approved_count":            len(approved),
        "rejected_count":            len(rejected),
        "total_approved_sar":        sum(w['amount_sar'] for w in approved),
        "total_requested_sar":       sum(w['amount_sar'] for w in all_w),
        "approval_rate_pct":         round(len(approved) / denom * 100, 1) if denom > 0 else 0,
        "by_type":                   by_type,
        "avg_processing_hours":      round(random.uniform(2, 24), 1),
        "approved_this_month_count": len(approved_mo),
        "approved_this_month_sar":   sum(w['amount_sar'] for w in approved_mo),
    }

@app.get("/waivers")
async def list_waivers(
    status:      Optional[str] = None,
    waiver_type: Optional[str] = None,
    user=Depends(get_current_user)
):
    _init_waivers()
    result = list(waivers_db)
    if user['role'] == Role.COLLECTOR:
        result = [w for w in result if w['requested_by'] == user['name']]
    if status:
        result = [w for w in result if w['status'] == status]
    if waiver_type:
        result = [w for w in result if w['waiver_type'] == waiver_type]
    return {"total": len(result), "waivers": result}

@app.post("/waivers")
async def create_waiver(req: WaiverCreateRequest, user=Depends(get_current_user)):
    global waiver_id_counter
    _init_waivers()
    if user['role'] not in _WAIVER_REQUEST_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    if req.amount_sar <= 0:
        raise HTTPException(400, "amount_sar must be positive")
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    row  = df[df['account_id'] == req.account_id] if not df.empty else pd.DataFrame()
    if row.empty:
        raise HTTPException(404, f"Account {req.account_id} not found")
    r       = row.iloc[0]
    wid     = waiver_id_counter
    waiver_id_counter += 1
    new_w = {
        "id":               wid,
        "waiver_id":        f"WAV-{wid:05d}",
        "account_id":       req.account_id,
        "customer_name":    str(r.get('customer_name', '')),
        "outstanding_sar":  float(r.get('outstanding_balance_sar', 0)),
        "bucket":           str(r.get('delinquency_bucket', '')),
        "waiver_type":      req.waiver_type,
        "amount_sar":       req.amount_sar,
        "reason":           req.reason,
        "notes":            req.notes or "",
        "status":           "Pending",
        "requested_by":     user['name'],
        "requested_by_role":user['role'],
        "requested_at":     datetime.now().isoformat(),
        "reviewed_by":      None,
        "reviewed_at":      None,
        "review_note":      None,
    }
    waivers_db.append(new_w)
    log_audit(user['user_id'], user['name'], str(user['role']), "Waiver requested",
              "Waiver", new_w['waiver_id'],
              f"Waiver SAR {req.amount_sar:,.0f} ({req.waiver_type}) requested for {req.account_id}")
    return new_w

@app.get("/waivers/{waiver_id}")
async def get_waiver(waiver_id: int, user=Depends(get_current_user)):
    _init_waivers()
    w = next((w for w in waivers_db if w['id'] == waiver_id), None)
    if not w:
        raise HTTPException(404, "Waiver not found")
    return w

@app.put("/waivers/{waiver_id}/approve")
async def approve_waiver(waiver_id: int, body: WaiverReviewRequest, user=Depends(get_current_user)):
    _init_waivers()
    if user['role'] not in _WAIVER_REVIEW_ROLES:
        raise HTTPException(403, "Only Supervisor or Admin can approve waivers")
    w = next((w for w in waivers_db if w['id'] == waiver_id), None)
    if not w:
        raise HTTPException(404, "Waiver not found")
    if w['status'] != 'Pending':
        raise HTTPException(400, f"Cannot approve waiver with status '{w['status']}'")
    if w['requested_by'] == user['name']:
        raise HTTPException(400, "Cannot approve your own waiver request")
    w['status']      = 'Approved'
    w['reviewed_by'] = user['name']
    w['reviewed_at'] = datetime.now().isoformat()
    w['review_note'] = body.review_note
    log_audit(user['user_id'], user['name'], str(user['role']), "Waiver approved",
              "Waiver", w['waiver_id'],
              f"Waiver {w['waiver_id']} approved — SAR {w['amount_sar']:,.0f} ({w['waiver_type']})")
    return w

@app.put("/waivers/{waiver_id}/reject")
async def reject_waiver(waiver_id: int, body: WaiverReviewRequest, user=Depends(get_current_user)):
    _init_waivers()
    if user['role'] not in _WAIVER_REVIEW_ROLES:
        raise HTTPException(403, "Only Supervisor or Admin can reject waivers")
    w = next((w for w in waivers_db if w['id'] == waiver_id), None)
    if not w:
        raise HTTPException(404, "Waiver not found")
    if w['status'] != 'Pending':
        raise HTTPException(400, f"Cannot reject waiver with status '{w['status']}'")
    if not body.review_note:
        raise HTTPException(400, "review_note is required when rejecting")
    w['status']      = 'Rejected'
    w['reviewed_by'] = user['name']
    w['reviewed_at'] = datetime.now().isoformat()
    w['review_note'] = body.review_note
    log_audit(user['user_id'], user['name'], str(user['role']), "Waiver rejected",
              "Waiver", w['waiver_id'],
              f"Waiver {w['waiver_id']} rejected — {body.review_note[:60]}")
    return w

# ─────────────────────────────────────────────────────────────
# REPORTS
# ─────────────────────────────────────────────────────────────

_BUCKET_ORDER = ['Write-off', 'NPA', '61-90 DPD', '31-60 DPD', '1-30 DPD', 'Current']
_BUCKET_IDX   = {b: i for i, b in enumerate(_BUCKET_ORDER)}

@app.get("/reports/roll-forward")
async def get_roll_forward(period: str = "month", user=Depends(get_current_user)):
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    if df.empty:
        raise HTTPException(500, "Data not loaded")

    matrix: dict      = {}
    rf_count = rf_sar = rb_count = rb_sar = st_count = st_sar = 0
    deteriorating: dict = {}
    improving_seg: dict = {}

    for _, row in df.iterrows():
        curr_b = row['delinquency_bucket']
        trend  = row.get('dpd_trend', 'Stable')
        sar    = float(row.get('outstanding_balance_sar', 0))
        cidx   = _BUCKET_IDX.get(curr_b)
        if cidx is None:
            continue

        if trend == 'Improving' and cidx > 0:
            # Came from one step worse (lower index in our best→worst scheme)
            from_b, to_b = _BUCKET_ORDER[cidx - 1], curr_b
            rb_count += 1; rb_sar += sar
            seg = improving_seg.setdefault(curr_b, {'count': 0, 'sar': 0.0})
            seg['count'] += 1; seg['sar'] += sar
        elif trend == 'Worsening' and cidx < len(_BUCKET_ORDER) - 1:
            # Came from one step better (higher index)
            from_b, to_b = _BUCKET_ORDER[cidx + 1], curr_b
            rf_count += 1; rf_sar += sar
            seg = deteriorating.setdefault(curr_b, {'count': 0, 'sar': 0.0})
            seg['count'] += 1; seg['sar'] += sar
        else:
            from_b = to_b = curr_b
            st_count += 1; st_sar += sar

        cell = matrix.setdefault((from_b, to_b), {'count': 0, 'sar': 0.0})
        cell['count'] += 1; cell['sar'] += sar

    multiplier = {'week': 0.25, 'month': 1.0, 'quarter': 3.0}.get(period, 1.0)

    matrix_list = [
        {'from_bucket': f, 'to_bucket': t, 'count': round(v['count'] * multiplier), 'sar': round(v['sar'] * multiplier)}
        for (f, t), v in matrix.items()
    ]
    top_det = sorted(deteriorating.items(), key=lambda x: x[1]['count'], reverse=True)
    top_imp = sorted(improving_seg.items(), key=lambda x: x[1]['count'], reverse=True)

    return {
        'period':         period,
        'rolled_forward': {'count': round(rf_count * multiplier), 'sar': round(rf_sar * multiplier)},
        'rolled_back':    {'count': round(rb_count * multiplier), 'sar': round(rb_sar * multiplier)},
        'stable':         {'count': round(st_count * multiplier), 'sar': round(st_sar * multiplier)},
        'net_movement_sar': round((rb_sar - rf_sar) * multiplier),
        'matrix':         matrix_list,
        'top_deteriorating_segments': [
            {'bucket': b, 'count': round(v['count'] * multiplier), 'sar': round(v['sar'] * multiplier)} for b, v in top_det[:5]
        ],
        'top_improving_segments': [
            {'bucket': b, 'count': round(v['count'] * multiplier), 'sar': round(v['sar'] * multiplier)} for b, v in top_imp[:5]
        ],
        'top_deteriorating_segment': top_det[0][0] if top_det else None,
        'top_improving_segment':     top_imp[0][0] if top_imp else None,
    }

@app.get("/reports/collection-efficiency")
async def get_collection_efficiency(user=Depends(get_current_user)):
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    if df.empty:
        raise HTTPException(500, "Data not loaded")

    TARGETS = {'1-30 DPD': 85, '31-60 DPD': 65, '61-90 DPD': 45, 'NPA': 25, 'Write-off': 10}
    total_sar   = float(df['outstanding_balance_sar'].sum())
    overall_paid_rate = float((df['outcome_label'] == 'Paid').mean())

    by_bucket = []
    for bucket, target in TARGETS.items():
        b_df  = df[df['delinquency_bucket'] == bucket]
        if b_df.empty:
            continue
        b_sar       = float(b_df['outstanding_balance_sar'].sum())
        b_paid_rate = float((b_df['outcome_label'] == 'Paid').mean()) * 100
        actual      = round(b_paid_rate, 1)
        by_bucket.append({
            'bucket':          bucket,
            'target_pct':      target,
            'actual_pct':      actual,
            'gap':             round(actual - target, 1),
            'total_accounts':  len(b_df),
            'total_sar':       round(b_sar),
        })

    collected_sar = total_sar * overall_paid_rate
    return {
        'total_portfolio_sar': round(total_sar),
        'collected_sar':       round(collected_sar),
        'collection_rate_pct': round(overall_paid_rate * 100, 1),
        'total_accounts':      len(df),
        'by_bucket':           by_bucket,
    }

@app.get("/reports/ai-vs-human")
async def get_ai_vs_human(user=Depends(get_current_user)):
    data = get_calls_data()
    df   = data.get('df', pd.DataFrame())
    if df.empty:
        raise HTTPException(500, "Data not loaded")

    ai_df  = df[df['agent_type'] == 'AI']
    hum_df = df[df['agent_type'] != 'AI']

    def _stats(cdf, cost_per_call):
        fin   = cdf[cdf['status'] == 'FINISHED']
        total = max(len(cdf), 1)
        conn  = max(len(fin), 1)
        ptps  = int((cdf['ptp_outcome'] == 'PTP Captured').sum())
        ptp_v = float(cdf['ptp_amount_sar'].sum())
        by_bk = {}
        for bk in ['1-30 DPD', '31-60 DPD', '61-90 DPD', 'NPA', 'Write-off']:
            b     = cdf[cdf['delinquency_bucket'] == bk]
            b_fin = b[b['status'] == 'FINISHED']
            bptps = int((b['ptp_outcome'] == 'PTP Captured').sum())
            by_bk[bk] = {
                'calls':     int(len(b)),
                'ptps':      bptps,
                'ptp_rate':  round(float(bptps / max(len(b_fin), 1) * 100), 1),
                'ptp_value': round(float(b['ptp_amount_sar'].sum())),
            }
        return {
            'total_calls':            int(len(cdf)),
            'connected_calls':        int(len(fin)),
            'ptp_captured':           ptps,
            'ptp_value_sar':          round(ptp_v),
            'avg_duration_sec':       round(float(cdf['duration_sec'].mean()), 1) if len(cdf) else 0,
            'connection_rate_pct':    round(float(len(fin) / total * 100), 1),
            'ptp_rate_pct':           round(float(ptps / conn * 100), 1),
            'cost_per_ptp_sar':       round(total * cost_per_call / max(ptps, 1), 1),
            'recovery_per_call_sar':  round(ptp_v / total, 2),
            'sentiment_positive_pct': round(float((fin['sentiment'] == 'Positive').sum() / conn * 100), 1),
            'by_bucket':              by_bk,
        }

    ai_s  = _stats(ai_df, 2)
    hum_s = _stats(hum_df, 35)
    roi_m = round(hum_s['cost_per_ptp_sar'] / max(ai_s['cost_per_ptp_sar'], 0.1), 1)

    # Recommended split: AI preferred for early buckets, human for NPA/Write-off
    ai_pref = sum(1 for bk in ['1-30 DPD','31-60 DPD','61-90 DPD']
                  if ai_s['by_bucket'].get(bk,{}).get('ptp_rate',0) >= hum_s['by_bucket'].get(bk,{}).get('ptp_rate',0))
    ai_pct  = min(max(55 + ai_pref * 5, 55), 75)

    comparison = {
        'ptp_rate_winner':        'AI' if ai_s['ptp_rate_pct'] >= hum_s['ptp_rate_pct'] else 'Human',
        'cost_efficiency_winner': 'AI',
        'volume_advantage':       'AI',
        'quality_advantage':      'Human',
        'roi_multiplier':         roi_m,
        'recommended_split_pct':  {'ai': ai_pct, 'human': 100 - ai_pct},
    }

    # Monthly trend — distribute totals across 6 months with variation
    months = []
    base   = datetime.now()
    rng    = random.Random(42)
    for i in range(5, -1, -1):
        m_date  = (base.replace(day=1) - timedelta(days=i * 30))
        var     = 1 + (rng.random() - 0.5) * 0.25
        ai_c    = int(len(ai_df)  / 6 * var)
        hum_c   = int(len(hum_df) / 6 * var)
        ai_p    = int(ai_s['ptp_captured']  / 6 * var)
        hum_p   = int(hum_s['ptp_captured'] / 6 * var)
        months.append({
            'month':           m_date.strftime('%b %Y'),
            'ai_calls':        max(ai_c, 0),
            'human_calls':     max(hum_c, 0),
            'ai_ptps':         max(ai_p, 0),
            'human_ptps':      max(hum_p, 0),
            'ai_ptp_rate':     round(max(ai_p, 0) / max(ai_c, 1) * 100, 1),
            'human_ptp_rate':  round(max(hum_p, 0) / max(hum_c, 1) * 100, 1),
        })

    # Top AI performers — group AI calls by bucket as pseudo-campaigns
    top_ai = []
    for bk in ['1-30 DPD', '31-60 DPD', '61-90 DPD', 'NPA', 'Write-off']:
        bk_data = ai_s['by_bucket'].get(bk, {})
        if bk_data.get('calls', 0) > 0:
            top_ai.append({
                'name':          f'AI Campaign — {bk}',
                'calls':         bk_data['calls'],
                'ptps':          bk_data['ptps'],
                'ptp_rate':      bk_data['ptp_rate'],
                'ptp_value_sar': bk_data['ptp_value'],
            })
    top_ai.sort(key=lambda x: x['ptp_rate'], reverse=True)
    top_ai = top_ai[:3]

    # Top human performers — top 5 agents by PTP rate
    human_agents = []
    for agent in hum_df['agent_name'].unique():
        a     = hum_df[hum_df['agent_name'] == agent]
        a_fin = a[a['status'] == 'FINISHED']
        ptps_a = int((a['ptp_outcome'] == 'PTP Captured').sum())
        if len(a) < 5:
            continue
        human_agents.append({
            'name':          agent,
            'calls':         int(len(a)),
            'ptps':          ptps_a,
            'ptp_rate':      round(float(ptps_a / max(len(a_fin), 1) * 100), 1),
            'ptp_value_sar': round(float(a['ptp_amount_sar'].sum())),
        })
    human_agents.sort(key=lambda x: x['ptp_rate'], reverse=True)

    return {
        'ai':                   ai_s,
        'human':                hum_s,
        'comparison':           comparison,
        'monthly_trend':        months,
        'top_ai_performers':    top_ai,
        'top_human_performers': human_agents[:5],
    }

# ─────────────────────────────────────────────────────────────
# FRAUD FLAGS
# ─────────────────────────────────────────────────────────────

fraud_flags_db: list = []
fraud_flag_id_counter: int = 1
_fraud_flags_initialized = False

class FraudFlagRequest(BaseModel):
    severity:     str
    reason:       str
    notes:        str
    evidence_ref: Optional[str] = ""

def _init_fraud_flags():
    global fraud_flags_db, fraud_flag_id_counter, _fraud_flags_initialized
    if _fraud_flags_initialized:
        return
    _fraud_flags_initialized = True
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    if df.empty:
        return
    now  = datetime.now()
    cols = ['account_id', 'customer_name', 'outstanding_balance_sar', 'delinquency_bucket']
    npa_wo = df[df['delinquency_bucket'].isin(['NPA', 'Write-off'])][cols]
    other  = df[~df['delinquency_bucket'].isin(['NPA', 'Write-off'])][cols]
    accs   = npa_wo.head(9).to_dict('records') + other.head(6).to_dict('records')

    def ts(d): return (now - timedelta(days=d)).replace(hour=10, minute=0, second=0, microsecond=0).isoformat()

    samples = [
        # High severity × 4
        {"id":1,"flag_id":"FRD-00001","account_id":accs[0]['account_id'],"customer_name":accs[0]['customer_name'],"outstanding_sar":float(accs[0]['outstanding_balance_sar']),"bucket":accs[0]['delinquency_bucket'],"severity":"High","reason":"Identity Theft","notes":"Customer reports account opened fraudulently — ID documents forged. Police report filed.","evidence_ref":"POL-2026-0341","status":"Active","flagged_by":"Khaled Al-Harbi","flagged_by_role":"legal","flagged_at":ts(45),"removed_by":None,"removed_at":None},
        {"id":2,"flag_id":"FRD-00002","account_id":accs[1]['account_id'],"customer_name":accs[1]['customer_name'],"outstanding_sar":float(accs[1]['outstanding_balance_sar']),"bucket":accs[1]['delinquency_bucket'],"severity":"High","reason":"Suspected Fraud","notes":"Multiple accounts with same phone number and address — possible identity ring. 4 accounts flagged together.","evidence_ref":"INT-2026-0088","status":"Active","flagged_by":"Faisal Al-Rashidi","flagged_by_role":"supervisor","flagged_at":ts(38),"removed_by":None,"removed_at":None},
        {"id":3,"flag_id":"FRD-00003","account_id":accs[2]['account_id'],"customer_name":accs[2]['customer_name'],"outstanding_sar":float(accs[2]['outstanding_balance_sar']),"bucket":accs[2]['delinquency_bucket'],"severity":"High","reason":"Payment Manipulation","notes":"Payment reversed 3 times from same card — card reported stolen after each reversal.","evidence_ref":"PAY-2026-1124","status":"Active","flagged_by":"Nora Al-Khalid","flagged_by_role":"collector","flagged_at":ts(22),"removed_by":None,"removed_at":None},
        {"id":4,"flag_id":"FRD-00004","account_id":accs[3]['account_id'],"customer_name":accs[3]['customer_name'],"outstanding_sar":float(accs[3]['outstanding_balance_sar']),"bucket":accs[3]['delinquency_bucket'],"severity":"High","reason":"Suspected Fraud","notes":"Customer provided forged salary certificate from non-existent employer. HR verification failed.","evidence_ref":"KYC-2026-0567","status":"Active","flagged_by":"Khaled Al-Harbi","flagged_by_role":"legal","flagged_at":ts(15),"removed_by":None,"removed_at":None},
        # Medium severity × 5
        {"id":5,"flag_id":"FRD-00005","account_id":accs[4]['account_id'],"customer_name":accs[4]['customer_name'],"outstanding_sar":float(accs[4]['outstanding_balance_sar']),"bucket":accs[4]['delinquency_bucket'],"severity":"Medium","reason":"Incorrect Info","notes":"Customer declared income SAR 18,000/month — salary slip shows SAR 7,200. Inflated income at origination.","evidence_ref":"","status":"Active","flagged_by":"Nora Al-Khalid","flagged_by_role":"collector","flagged_at":ts(55),"removed_by":None,"removed_at":None},
        {"id":6,"flag_id":"FRD-00006","account_id":accs[5]['account_id'],"customer_name":accs[5]['customer_name'],"outstanding_sar":float(accs[5]['outstanding_balance_sar']),"bucket":accs[5]['delinquency_bucket'],"severity":"Medium","reason":"Dispute","notes":"Customer disputes all 8 installments — claims funds never disbursed. Branch records confirm disbursement.","evidence_ref":"DISP-2026-0204","status":"Active","flagged_by":"Nora Al-Khalid","flagged_by_role":"collector","flagged_at":ts(42),"removed_by":None,"removed_at":None},
        {"id":7,"flag_id":"FRD-00007","account_id":accs[6]['account_id'],"customer_name":accs[6]['customer_name'],"outstanding_sar":float(accs[6]['outstanding_balance_sar']),"bucket":accs[6]['delinquency_bucket'],"severity":"Medium","reason":"Identity Theft","notes":"Two people claiming to be the account holder — biometric mismatch detected at branch.","evidence_ref":"BIO-2026-0033","status":"Active","flagged_by":"Faisal Al-Rashidi","flagged_by_role":"supervisor","flagged_at":ts(30),"removed_by":None,"removed_at":None},
        {"id":8,"flag_id":"FRD-00008","account_id":accs[7]['account_id'],"customer_name":accs[7]['customer_name'],"outstanding_sar":float(accs[7]['outstanding_balance_sar']),"bucket":accs[7]['delinquency_bucket'],"severity":"Medium","reason":"Payment Manipulation","notes":"Customer consistently makes partial payment then disputes remainder — recurring pattern over 5 months.","evidence_ref":"","status":"Active","flagged_by":"Nora Al-Khalid","flagged_by_role":"collector","flagged_at":ts(18),"removed_by":None,"removed_at":None},
        {"id":9,"flag_id":"FRD-00009","account_id":accs[8]['account_id'],"customer_name":accs[8]['customer_name'],"outstanding_sar":float(accs[8]['outstanding_balance_sar']),"bucket":accs[8]['delinquency_bucket'],"severity":"Medium","reason":"Incorrect Info","notes":"Employer listed as Ministry of Finance — no employee record found in MoF directory after verification.","evidence_ref":"EMP-2026-0198","status":"Active","flagged_by":"Khaled Al-Harbi","flagged_by_role":"legal","flagged_at":ts(10),"removed_by":None,"removed_at":None},
        # Low severity × 3
        {"id":10,"flag_id":"FRD-00010","account_id":accs[9]['account_id'],"customer_name":accs[9]['customer_name'],"outstanding_sar":float(accs[9]['outstanding_balance_sar']),"bucket":accs[9]['delinquency_bucket'],"severity":"Low","reason":"Dispute","notes":"Customer disputes SAR 450 processing fee charged twice — likely system error, under investigation.","evidence_ref":"","status":"Active","flagged_by":"Nora Al-Khalid","flagged_by_role":"collector","flagged_at":ts(58),"removed_by":None,"removed_at":None},
        {"id":11,"flag_id":"FRD-00011","account_id":accs[10]['account_id'],"customer_name":accs[10]['customer_name'],"outstanding_sar":float(accs[10]['outstanding_balance_sar']),"bucket":accs[10]['delinquency_bucket'],"severity":"Low","reason":"Incorrect Info","notes":"Contact phone number changed 4 times in 3 months — possibly avoiding contact, not confirmed fraud.","evidence_ref":"","status":"Active","flagged_by":"Nora Al-Khalid","flagged_by_role":"collector","flagged_at":ts(35),"removed_by":None,"removed_at":None},
        {"id":12,"flag_id":"FRD-00012","account_id":accs[11]['account_id'],"customer_name":accs[11]['customer_name'],"outstanding_sar":float(accs[11]['outstanding_balance_sar']),"bucket":accs[11]['delinquency_bucket'],"severity":"Low","reason":"Suspected Fraud","notes":"Third-party reported account holder operating without valid Iqama — Muqeem status unverified.","evidence_ref":"","status":"Active","flagged_by":"Faisal Al-Rashidi","flagged_by_role":"supervisor","flagged_at":ts(7),"removed_by":None,"removed_at":None},
    ]
    fraud_flags_db.extend(samples)
    fraud_flag_id_counter = 13

_FRAUD_FLAG_ROLES   = [Role.ADMIN, Role.SUPERVISOR, Role.COLLECTOR, Role.LEGAL]
_FRAUD_REMOVE_ROLES = [Role.ADMIN, Role.SUPERVISOR]

@app.get("/fraud/report")
async def get_fraud_report(user=Depends(get_current_user)):
    _init_fraud_flags()
    active      = [f for f in fraud_flags_db if f['status'] == 'Active']
    by_severity: dict = {'High': 0, 'Medium': 0, 'Low': 0}
    by_reason:   dict = {}
    by_bucket:   dict = {}
    for f in active:
        by_severity[f['severity']] = by_severity.get(f['severity'], 0) + 1
        by_reason[f['reason']]     = by_reason.get(f['reason'], 0) + 1
        by_bucket[f['bucket']]     = by_bucket.get(f['bucket'], 0) + 1
    return {
        "total_flagged":         len(active),
        "by_severity":           by_severity,
        "by_reason":             by_reason,
        "by_bucket":             by_bucket,
        "total_outstanding_sar": sum(f['outstanding_sar'] for f in active),
        "flagged_accounts":      active,
    }

@app.get("/accounts/{account_id}/fraud-flag")
async def get_account_fraud_flag(account_id: str, user=Depends(get_current_user)):
    _init_fraud_flags()
    flag = next((f for f in fraud_flags_db if f['account_id'] == account_id and f['status'] == 'Active'), None)
    return flag or {}

@app.post("/accounts/{account_id}/fraud-flag")
async def add_fraud_flag(account_id: str, req: FraudFlagRequest, user=Depends(get_current_user)):
    global fraud_flag_id_counter
    _init_fraud_flags()
    if user['role'] not in _FRAUD_FLAG_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    data = get_data()
    df   = data.get('df', pd.DataFrame())
    row  = df[df['account_id'] == account_id] if not df.empty else pd.DataFrame()
    if row.empty:
        raise HTTPException(404, f"Account {account_id} not found")
    r = row.iloc[0]
    for f in fraud_flags_db:
        if f['account_id'] == account_id and f['status'] == 'Active':
            f['status'] = 'Replaced'
    fid = fraud_flag_id_counter
    fraud_flag_id_counter += 1
    new_flag = {
        "id":              fid,
        "flag_id":         f"FRD-{fid:05d}",
        "account_id":      account_id,
        "customer_name":   str(r.get('customer_name', '')),
        "outstanding_sar": float(r.get('outstanding_balance_sar', 0)),
        "bucket":          str(r.get('delinquency_bucket', '')),
        "severity":        req.severity,
        "reason":          req.reason,
        "notes":           req.notes,
        "evidence_ref":    req.evidence_ref or "",
        "status":          "Active",
        "flagged_by":      user['name'],
        "flagged_by_role": user['role'],
        "flagged_at":      datetime.now().isoformat(),
        "removed_by":      None,
        "removed_at":      None,
    }
    fraud_flags_db.append(new_flag)
    log_audit(user['user_id'], user['name'], str(user['role']), "Fraud flag added",
              "Account", account_id,
              f"Fraud flag ({req.severity} — {req.reason}) added to {account_id}")
    return new_flag

@app.delete("/accounts/{account_id}/fraud-flag")
async def remove_fraud_flag(account_id: str, user=Depends(get_current_user)):
    _init_fraud_flags()
    if user['role'] not in _FRAUD_REMOVE_ROLES:
        raise HTTPException(403, "Only Supervisor or Admin can remove fraud flags")
    flag = next((f for f in fraud_flags_db if f['account_id'] == account_id and f['status'] == 'Active'), None)
    if not flag:
        raise HTTPException(404, "No active fraud flag for this account")
    flag['status']     = 'Removed'
    flag['removed_by'] = user['name']
    flag['removed_at'] = datetime.now().isoformat()
    log_audit(user['user_id'], user['name'], str(user['role']), "Fraud flag removed",
              "Account", account_id,
              f"Fraud flag removed from {account_id} by {user['name']}")
    return {"message": "Fraud flag removed", "flag": flag}

# ─────────────────────────────────────────────────────────────
# ADMIN — USER MANAGEMENT
# ─────────────────────────────────────────────────────────────

def _user_to_dict(u: dict) -> dict:
    return {
        "user_id":     u["user_id"],
        "name":        u["name"],
        "email":       u["email"],
        "role":        u["role"] if isinstance(u["role"], str) else u["role"].value,
        "department":  u.get("department", ""),
        "status":      u.get("status", "Active" if u.get("active", True) else "Inactive"),
        "active":      u.get("active", True),
        "last_login":  u.get("last_login"),
        "created_at":  u.get("created_at"),
        "permissions": PERMISSIONS.get(u["role"], []),
    }

@app.get("/admin/users")
async def list_users(user=Depends(require_permission("manage_users"))):
    return {"users": [_user_to_dict(u) for u in USERS_DB.values()]}

@app.post("/admin/users")
async def create_user(req: UserCreateRequest, current_user=Depends(require_permission("manage_users"))):
    global _users_id_counter
    if req.email in USERS_DB:
        raise HTTPException(400, "Email already exists")
    role_val = req.role.lower()
    if role_val not in [r.value for r in Role]:
        raise HTTPException(400, f"Invalid role: {req.role}")
    new_id    = f"USR-{_users_id_counter:03d}"
    new_user  = {
        "user_id":       new_id,
        "name":          req.name,
        "email":         req.email,
        "password_hash": hash_password(req.password),
        "role":          role_val,
        "department":    role_val.capitalize(),
        "active":        req.status == "Active",
        "status":        req.status,
        "last_login":    None,
        "created_at":    datetime.now().strftime("%Y-%m-%d"),
    }
    USERS_DB[req.email] = new_user
    _users_id_counter  += 1
    log_audit(current_user["user_id"], current_user["name"], str(current_user["role"]),
              "User Created", "User", new_id, f"Created {req.role} account for {req.name}")
    return _user_to_dict(new_user)

@app.put("/admin/users/{user_id}")
async def update_user(user_id: str, req: UserUpdateRequest, current_user=Depends(require_permission("manage_users"))):
    target = next((u for u in USERS_DB.values() if u["user_id"] == user_id), None)
    if not target:
        raise HTTPException(404, "User not found")
    if req.status == "Inactive" and target["user_id"] == current_user["user_id"]:
        raise HTTPException(400, "Cannot deactivate your own account")
    if req.name:
        target["name"] = req.name
    if req.role:
        role_val = req.role.lower()
        if role_val not in [r.value for r in Role]:
            raise HTTPException(400, f"Invalid role: {req.role}")
        target["role"] = role_val
    if req.status:
        target["status"] = req.status
        target["active"] = req.status == "Active"
    log_audit(current_user["user_id"], current_user["name"], str(current_user["role"]),
              "User Updated", "User", user_id, f"Updated user {target['name']}")
    return _user_to_dict(target)

@app.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user=Depends(require_permission("manage_users"))):
    target = next((u for u in USERS_DB.values() if u["user_id"] == user_id), None)
    if not target:
        raise HTTPException(404, "User not found")
    if target["user_id"] == current_user["user_id"]:
        raise HTTPException(400, "Cannot deactivate your own account")
    target["status"] = "Inactive"
    target["active"] = False
    return {"success": True, "user": _user_to_dict(target)}

@app.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, req: PasswordResetRequest, current_user=Depends(require_permission("manage_users"))):
    target = next((u for u in USERS_DB.values() if u["user_id"] == user_id), None)
    if not target:
        raise HTTPException(404, "User not found")
    target["password_hash"] = hash_password(req.new_password)
    return {"success": True, "message": f"Password reset for {target['name']}"}

@app.get("/admin/roles")
async def get_roles(user=Depends(require_permission("manage_users"))):
    return {
        "roles": {
            role.value: {
                "permissions": perms,
                "user_count":  sum(1 for u in USERS_DB.values() if u['role'] == role)
            }
            for role, perms in PERMISSIONS.items()
        }
    }

@app.get("/audit/logs")
async def get_audit_logs(
    page:         int = 1,
    limit:        int = 20,
    user_id:      Optional[str] = None,
    action:       Optional[str] = None,
    entity_type:  Optional[str] = None,
    date_from:    Optional[str] = None,
    date_to:      Optional[str] = None,
    current_user=Depends(require_permission("audit_logs"))
):
    logs = list(reversed(audit_logs))
    if user_id:                       logs = [l for l in logs if l["user_id"] == user_id]
    if action:                        logs = [l for l in logs if action.lower() in l["action"].lower()]
    if entity_type and entity_type != 'All':
        logs = [l for l in logs if l["entity_type"] == entity_type]
    if date_from:                     logs = [l for l in logs if l["timestamp"] >= date_from]
    if date_to:                       logs = [l for l in logs if l["timestamp"] <= date_to + "T23:59:59"]
    total     = len(logs)
    offset    = (page - 1) * limit
    page_data = logs[offset:offset + limit]
    return {"total": total, "page": page, "limit": limit, "logs": page_data}

@app.get("/audit/stats")
async def get_audit_stats(current_user=Depends(require_permission("audit_logs"))):
    now        = datetime.now()
    today_str  = now.strftime('%Y-%m-%d')
    week_ago   = (now - timedelta(days=7)).isoformat()

    action_counts = {}
    user_counts   = {}
    entity_counts = {}
    for l in audit_logs:
        action_counts[l['action']]      = action_counts.get(l['action'], 0) + 1
        user_counts[l['user_name']]     = user_counts.get(l['user_name'], 0) + 1
        entity_counts[l['entity_type']] = entity_counts.get(l['entity_type'], 0) + 1

    by_action = sorted(action_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    by_user   = sorted(user_counts.items(),   key=lambda x: x[1], reverse=True)[:5]

    CRITICAL = {'Fraud flag added', 'Fraud flag removed', 'Waiver approved', 'Waiver rejected',
                'Legal Case Opened', 'Legal Case Updated', 'Settlement Accepted', 'Campaign Launched'}
    critical = [l for l in reversed(audit_logs) if l['action'] in CRITICAL][:5]

    return {
        'total_logs':      len(audit_logs),
        'logs_today':      sum(1 for l in audit_logs if l['timestamp'].startswith(today_str)),
        'logs_this_week':  sum(1 for l in audit_logs if l['timestamp'] >= week_ago),
        'most_active_user': by_user[0][0] if by_user else None,
        'by_action_type':  [{'action': a, 'count': c} for a, c in by_action],
        'by_user':         [{'name': u, 'count': c} for u, c in by_user],
        'by_entity_type':  entity_counts,
        'recent_critical': critical,
    }

# ─────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    models = get_models()
    data   = get_data()
    return {
        "status":        "healthy",
        "version":       "2.0.0",
        "models_loaded": len(models) > 0,
        "data_loaded":   not data.get('df', pd.DataFrame()).empty,
        "accounts":      len(data.get('df', pd.DataFrame())),
        "timestamp":     datetime.now().isoformat(),
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
