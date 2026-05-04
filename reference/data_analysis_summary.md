# Wataniya Finance — Collections Platform: Comprehensive Data Analysis
**Source files:** 6 client reference documents | **Analysed:** 2026-04-27

---

## 1. Portfolio Dimensions & Taxonomy

### 1.1 DPD Buckets (Days Past Due)

| Bucket Label | DPD Range | Internal Code | Collection Objective |
|---|---|---|---|
| Current | 0 Days | PKT-0 | Retention / Prevention |
| Early Arrears | 1–30 DPD | PKT-1 | Rollforward ≤ 10% |
| Mid-Bucket | 31–60 DPD | PKT-2 | Rollforward ≤ 25% |
| Late-Bucket | 61–90 DPD | PKT-3 | Rollforward ≤ 30% (Apr); 35% (Oct) |
| NPA Early | 91–180 DPD | NPA-1 | Rollback 25% (Apr); 35% (Oct) |
| NPA Mid | 181–360 DPD | NPA-2 | 7% collection of overdue |
| NPA Late | 361–450 DPD | NPA-3 | 5% collection (Apr); 2.5% (Oct) |
| Write-off | > 450 DPD | WO | 1–3% recovery |
| Non-Starter 91–450 | 91–450 DPD | NS | 3.5% collection |
| Non-Starter WO | > 450 DPD | NS-WO | 2% recovery |

**Note:** Rollforward = accounts deteriorating to next bucket. Rollback = accounts improving to prior bucket.

### 1.2 Products

| # | Product Name | Segment | Notes |
|---|---|---|---|
| 1 | Jarir | Retail | Partner (retail chain) |
| 2 | Premium Partners | Retail | High-value partners |
| 3 | Noon | Retail | E-commerce partner |
| 4 | Other Partners | Retail | Miscellaneous retail partners |
| 5 | Cash Loan | Retail | Direct cash finance |
| — | Total Retail | Retail | SUM(1..5), computed |
| — | SME | SME | Small/Medium Enterprise |
| — | Grand Total | All | SUM(Retail + SME), computed |

### 1.3 Portfolio Segments

| Segment | Description |
|---|---|
| Total | Full portfolio (Current RAC + Closed RAC) |
| Normal | Standard borrowers |
| Non-Starter | Accounts that never made a first payment |
| Current RAC | Recommended Action Case — active in collections |
| Closed RAC | Cases closed/resolved |

### 1.4 Portfolio Scale (as of 2026-04-01 / 2026-04-23)

| Metric | Value | Source |
|---|---|---|
| Total Portfolio SAR | ~895.18M (dashboard) / ~878.41M (LCDPD) | PDF / XLSX |
| Total Loan Count | 142,514 (current RAC) | PDF |
| SME Portfolio | ~330.05M | PDF |
| NPA % (overall) | 11.98% (dashboard) | PDF |
| MTD Collections (Apr 2026) | SAR 41.17M | PDF |

---

## 2. Financial Fields & Data Types

### 2.1 Account-Level Financial Fields
*(Source: collections agents daily activities - EN.docx)*

| Field Name | Data Type | Description |
|---|---|---|
| `contract_number` | String | Primary contract identifier |
| `account_number` | String | Account identifier |
| `national_id` | String (15-digit) | National ID / Iqama Number |
| `product_type` | Enum | Jarir / Premium Partners / Noon / Other Partners / Cash Loan / SME |
| `account_status` | Enum | Active / Delinquent / Closed |
| `account_opening_date` | Date | Contract origination date |
| `total_finance_amount` | Decimal (SAR) | Total financed amount (principal + profit) |
| `principal_amount` | Decimal (SAR) | Original principal |
| `profit_amount` | Decimal (SAR) | Total profit/interest |
| `loan_amount_sar` | Decimal (SAR) | Loan face value |
| `outstanding_balance_sar` | Decimal (SAR) | Current outstanding (principal + profit remaining) |
| `remaining_principal` | Decimal (SAR) | Principal portion of outstanding |
| `remaining_profit` | Decimal (SAR) | Profit portion of outstanding |
| `total_amount_paid` | Decimal (SAR) | Cumulative payments received |
| `total_principal_paid` | Decimal (SAR) | Principal portion of payments |
| `total_profit_paid` | Decimal (SAR) | Profit portion of payments |
| `monthly_installment_sar` | Decimal (SAR) | Regular installment amount |
| `total_installments` | Integer | Total number of installments |
| `paid_installments` | Integer | Number of installments paid |
| `overdue_installments` | Integer | Number of overdue installments |
| `overdue_amount` | Decimal (SAR) | Total overdue amount (principal + profit) |
| `principal_overdue` | Decimal (SAR) | Principal component of overdue |
| `profit_overdue` | Decimal (SAR) | Profit component of overdue |
| `days_past_due` | Integer | Current DPD (0–450+) |
| `current_dpd` | Integer | Alias for days_past_due |
| `first_installment_date` | Date | Date of first installment due |
| `last_installment_date` | Date | Final installment due date |
| `last_payment_date` | Date | Most recent payment date |
| `salary` | Decimal (SAR) | Borrower monthly salary |
| `collection_fees` | Decimal (SAR) | Fees levied for collection |
| `excess_amount` | Decimal (SAR) | Overpayment balance |
| `sadad_payment_status` | Enum | SADAD bill payment status |
| `interest_rate_pct` | Decimal (%) | Annual profit/interest rate |
| `loan_tenure_months` | Integer | Total loan term in months |
| `remaining_tenure_months` | Integer | Months remaining to maturity |

### 2.2 Portfolio-Level Financial Fields
*(Source: LCDPD 1st Apr 2026.xlsx, PDF Dashboard)*

| Field Name | Data Type | Description |
|---|---|---|
| `portfolio_balance` | Decimal (SAR, millions) | Total outstanding balance |
| `npa_pct` | Decimal (%) | NPA% = NPA balance / Grand Total balance |
| `collections_mtd` | Decimal (SAR) | Month-to-date collections |
| `loan_id_count` | Integer | Number of loan accounts |
| `current_rac_balance` | Decimal (SAR) | Balance under active collection |
| `closed_rac_balance` | Decimal (SAR) | Balance of resolved cases |
| `overdue_total` | Decimal (SAR) | Total overdue (principal + profit) |
| `write_off_expected` | Decimal (SAR) | Projected write-off by month |

### 2.3 Write-off Schedule Fields
*(Source: LCDPD Write off sheet)*

| Field Name | Data Type | Description |
|---|---|---|
| `product` | Enum | Product category (1–5) |
| `write_off_month` | Date (Month-Year) | Projected write-off month |
| `expected_write_off_sar` | Decimal (SAR, millions) | Expected write-off amount |
| `rac_type` | Enum | Current RAC / Total |
| **Write-off projection range** | — | Apr 2026 → Jul 2027 |

### 2.4 Overdue Installment Granularity
*(Source: LCDPD Write off sheet — "Number of installment overdue against NPA")*

| Field Name | Data Type | Values |
|---|---|---|
| `installments_overdue_bucket` | Integer | 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 |
| `npa_balance_mm` | Decimal (SAR, millions) | NPA balance at that installment-overdue level |
| `overdue_amount_mm` | Decimal (SAR, millions) | Overdue amount |
| `account_count` | Integer | Number of accounts |

---

## 3. Agent Target Fields & Data Types

### 3.1 Agent-Level Target Record
*(Source: Agent Target Apr 2026.xlsx, Agent Target Mar 2026.xlsx, Collection Activity.xlsx)*

| Field Name | Data Type | Description |
|---|---|---|
| `agent_name` | String | Full agent name |
| `supervisor_name` | String | Supervising team leader |
| `dpd_bucket` | Enum | PKT-1 / PKT-2 / PKT-3 / NPA-1 / NPA-2 / NPA-3 / WO / NS / NS-WO / URDU |
| `account_count` | Integer | Number of accounts assigned |
| `principal_outstanding_sar` | Decimal (SAR) | Total principal O/S for assigned accounts |
| `overdue_amount_sar` | Decimal (SAR) | Total overdue for NPA/WO buckets |
| `target_amount_sar` | Decimal (SAR) | = principal × target_pct |
| `target_pct` | Decimal (%) | Bucket-specific target percentage |
| `stable_amount_sar` | Decimal (SAR) | = principal_outstanding − rollforward |
| `rollforward_amount_sar` | Decimal (SAR) | Amounts rolled to next (worse) bucket |
| `rollback_amount_sar` | Decimal (SAR) | Amounts rolled to prior (better) bucket |
| `stable_pct` | Decimal (%) | stable / principal_outstanding |
| `rollforward_pct` | Decimal (%) | rollforward / principal_outstanding |
| `achievement_pct` | Decimal (%) | total_collection / target_amount |
| `total_collection_sar` | Decimal (SAR) | All collections (cash + court + discount) |
| `court_collection_sar` | Decimal (SAR) | Collections via court judgments |
| `discount_amount_sar` | Decimal (SAR) | Discounts/waivers granted |

### 3.2 Target Percentages by Bucket (Reference Values)

| Bucket | Apr 2026 Target | Oct 2025 Target | Mar 2026 Target | Metric |
|---|---|---|---|---|
| PKT-1 (1–30 DPD) | 10% | 10% | 10% | Rollforward ≤ % |
| PKT-2 (31–60 DPD) | 25% | 25% | 25% | Rollforward ≤ % |
| PKT-3 (61–90 DPD) | 30% | 35% | 30% | Rollforward ≤ % |
| NPA 91–180 | 25% | 35% | 25% | Rollback % |
| NPA 181–360 | 7% | 7% | 7% | Collection of overdue |
| NPA 361–450 | 5% | 2.5% | 5% | Collection of overdue |
| Non-Starter 91–450 | 3.5% | 3.5% | 3.5% | Collection |
| URDU 31–450 | 12% | 12% | 12% | Collection |
| Write-off | SAR 400K/agent | SAR 300K/agent | SAR 350K/agent | Fixed amount |
| Urdu WO + 450 | 1% | 3% | 1% | Recovery |
| WO Non-Starter | 2% | 2% | — | Recovery |

### 3.3 Agent Roster (Named Agents Across Files)

**PKT-3 / NPA Agents:**
Manal Sami Almusaad, Hala Salem Alqahtani, Fozyah Abdulaziz Alkhulifi, Mohammed Saleh Aldalbahi, Manal Salem Madi, Mohammed Aedh Alharthi, Fotoon Abdullah Khathran, Atheer Alhwasheil, Hajir Obaid Al-Otaibi, Faez Abdualh Satem Mohamed, Ibrahim Abyan, Abdulrahman Bakheet Al Otaibi

**Write-off Agents:**
Amjd Ibrahim Al-Hazmi, Fahad Laili Obaid AlMarei, Mishaal Suleiman Alsaeed, Khalid Aytim Alanazi, Fahad Abdulaziz Alateeq, Trad Khaled Alharbi, Suleiman Alhodhaif, Nawaf Suliman Aldayel, Sultan Fahad Alinzee, Sarah Abdulaziz Aljurayyad, Abdullah Al-Mutairi

**URDU Team:** Anisha, Sheetal (handle non-Saudi / Urdu-speaking customers)

**Supervisors:** Amal Hamoud Alotaibi, Ahmed Alshammari

**IVR/Automated Channels:** IVR-PKT-2, IVR-61-90, IVR-NPA 91-180, IVR-181-360, IVR-361-450, IVR-Write Off, IVR-Write Off-Non Starter, Sawt (voice bot), Sarja (voice bot)

---

## 4. Collection Activity Fields & Data Types

### 4.1 Channel Activity Record
*(Source: Collection Activity 22-10-2025.xlsx — Activity sheet)*

| Field Name | Data Type | Values / Range |
|---|---|---|
| `report_date` | Date | 2025-10-22 |
| `view_type` | Enum | Cumulative / Daily |
| `dpd_bucket` | Enum | 1–30 / 31–60 / 61–90 / >91 / Write-off |
| `opening_count` | Integer | e.g., 40,105 |
| `current_count` | Integer | e.g., 14,506 |
| `unreachable_count` | Integer | e.g., 819 |
| `channel` | Enum | SMS / Push Notification / Robot Calling / NABA / Agent Calling |
| `attempt_count` | Integer | e.g., 54,238 (SMS) / 164,265 (Push) |
| `success_count` | Integer | e.g., 62,761 (SMS) / 133,730 (Push) |
| `success_pct` | Decimal (%) | Formula: success / attempt |

### 4.2 Channel Definitions

| Channel | Type | Notes |
|---|---|---|
| SMS | Outbound automated | Text message to customer |
| Push Notification | Outbound automated | App push notification |
| Robot Calling (IVR) | Outbound automated | Interactive voice response |
| NABA | Outbound automated | Automated notification system (SAMA-regulated) |
| Agent Calling | Outbound human | Direct agent-to-customer call |

### 4.3 Legal & Salary Pullout Activity Fields
*(Source: Collection Activity — Legal and Salary pullout sheet)*

| Field Name | Data Type | Description |
|---|---|---|
| `salary_pullout_channel` | Enum | Najez Portal (Retail) |
| `dpd_bucket` | Enum | >91 DPD / Write-off |
| `opening_count` | Integer | Accounts eligible |
| `current_count` | Integer | Accounts processed |
| `attempt_count` | Integer | Pullout attempts |
| `success_count` | Integer | Successful pullouts |
| `pullout_amount_sar` | Decimal (SAR) | Amount recovered via salary |
| `date` | Date | Oct 1–17, 2025 (daily) |
| `legal_filed_by_qf` | Integer | Daily count — legal filed by QF |
| `legal_filed_by_najiz` | Integer | Daily count — legal filed via Najiz portal |
| `writeoff_recovery_with_discount_sar` | Decimal (SAR) | e.g., 1,197,795.29 MTD |
| `sme_writeoff_recovery_sar` | Decimal (SAR) | SME segment write-off recovery |

### 4.4 Call Report Fields
*(Source: Collection Activity — Call Report sheet)*

| Field Name | Data Type | Values / Range |
|---|---|---|
| `report_date` | Date | 2025-10-21 |
| `supervisor_name` | String | Ahmed Alshammari / Amal Hamoud Alotaibi |
| `pkt_code` | Enum | A (First installment) / B (31–60) / C (61–90) / D (NPA 91–180) / E (NPA 181–360) / F (NPA 361–450) / NPA Non-Starter 91–450 / Write Off |
| `target_calls_per_day` | Integer | 60–90 |
| `agent_name` | String | Named agent |
| `completed_calls` | Integer | e.g., 38 |
| `completed_customers` | Integer | Unique customers called |
| `completed_minutes` | Decimal | Total call minutes |
| `not_connected_calls` | Integer | e.g., 171 |
| `not_connected_customers` | Integer | Unique unreached customers |
| `not_connected_minutes` | Decimal | Minutes spent on unanswered calls |
| `total_calls` | Integer | completed + not_connected |
| `total_customers` | Integer | Unique customers attempted |
| `total_minutes` | Decimal | Total dialling minutes |
| `actual_working_hours` | Decimal | total_minutes / 60 |
| `achievement_pct` | Decimal (%) | completed_calls / target_calls |

**Sample totals (22 agents, Oct 21 2025):**
- Total completed calls: 852 | Customers: 815 | Minutes: 1,056.78
- Total not connected: 3,217 | Customers: 3,006 | Minutes: 1,405.70
- Grand total calls: 4,069 | Customers: 3,760 | Minutes: 2,462.48

---

## 5. Customer Interaction Fields

### 5.1 Customer Profile Fields
*(Source: collections agents daily activities - EN.docx)*

| Field Name | Data Type | Description |
|---|---|---|
| `full_name` | String | Customer full name |
| `national_id` | String | National ID / Iqama |
| `mobile_number` | String | Primary mobile |
| `email_address` | String | Customer email |
| `national_address` | String | Registered address |
| `employer_name` | String | Current employer |
| `employer_sector` | Enum | Government / Private / Self-employed |
| `alternative_contacts` | Array[String] | References / secondary numbers |

### 5.2 Interaction Log Fields

| Field Name | Data Type | Description |
|---|---|---|
| `interaction_id` | String | Unique interaction identifier |
| `interaction_type` | Enum | Outbound Call / Inbound Call / SMS / Email |
| `interaction_date` | DateTime | Timestamp of interaction |
| `agent_id` | String | Agent who handled |
| `agent_name` | String | Agent full name |
| `call_duration_minutes` | Decimal | Duration of call |
| `call_recording_url` | String | Link to recording |
| `caller_number` | String | Number dialled |
| `call_outcome` | Enum | Paid / Promise to Pay / Refused / No Answer / Switched Off / Needs Follow-up |
| `call_summary` | Text | Free-text summary |
| `call_purpose` | Enum | Collection / Inquiry / Complaint / Service Request |
| `linked_to_portfolio` | Boolean | Whether call is tied to a specific account |
| `escalation_to_evaluation` | Boolean | Escalated for evaluation |
| `escalation_to_supervisor` | Boolean | Escalated to team leader |
| `sms_trigger` | Boolean | Whether SMS was sent post-call |
| `follow_up_date` | DateTime | Scheduled next contact |
| `follow_up_automated_reminder` | Boolean | System reminder enabled |

### 5.3 Note Types

| Note Type | Description |
|---|---|
| Agent Notes | Free-text written by collector |
| System Notes | Auto-generated by platform |
| Categorized Notes | Tagged by topic/type |
| Payment Note | Sub-type: Discount / Customer Payment / Court Payment |

### 5.4 Customer Service Request Fields

| Field Name | Data Type | Values |
|---|---|---|
| `request_id` | String | Unique identifier |
| `request_type` | Enum | Complaint / Inquiry / Dispute / Excess Refund Request |
| `request_status` | Enum | Open / In Progress / Closed |
| `request_date` | DateTime | Date raised |
| `resolution_notes` | Text | Resolution description |

---

## 6. Installment Schedule Fields

*(Source: collections agents daily activities - EN.docx)*

| Field Name | Data Type | Description |
|---|---|---|
| `installment_number` | Integer | Sequence number |
| `installment_date` | Date | Due date |
| `total_installment_amount` | Decimal (SAR) | Full installment amount |
| `installment_principal` | Decimal (SAR) | Principal portion |
| `installment_profit` | Decimal (SAR) | Profit portion |
| `paid_principal` | Decimal (SAR) | Principal paid to date |
| `paid_profit` | Decimal (SAR) | Profit paid to date |
| `installment_status` | Enum | Paid / Unpaid |

---

## 7. Legal Status Fields

*(Source: collections agents daily activities - EN.docx, Collection Activity - Legal sheet)*

| Field Name | Data Type | Values |
|---|---|---|
| `legal_status` | Enum | Normal / Delinquent / Enforcement |
| `last_legal_action_date` | Date | Date of most recent legal action |
| `legal_action_type` | Enum | Article 46 / Article 34 / Court Grace Period / Case Closure |
| `legal_filed_by` | Enum | QF (Qatar Finance?) / Najiz Portal |
| `court_collection_sar` | Decimal (SAR) | Amount collected via court orders |

---

## 8. Offers & Settlement Fields

*(Source: collections agents daily activities - EN.docx — Smart Collection Tools)*

| Field Name | Data Type | Description |
|---|---|---|
| `offer_type` | Enum | Discount / Waiver / Early Settlement / Full Settlement / Partial Payment / Final Settlement |
| `offer_basis` | Enum | AI Scoring / Manual |
| `discount_amount_sar` | Decimal (SAR) | Settlement discount offered |
| `settlement_amount_sar` | Decimal (SAR) | Agreed settlement amount |
| `offer_status` | Enum | Pending / Accepted / Rejected / Expired |
| `offer_generated_at` | DateTime | When offer was created |
| `offer_accepted_at` | DateTime | When customer accepted |

---

## 9. Document & Attachment Fields

*(Source: collections agents daily activities - EN.docx)*

| Document Type | Format |
|---|---|
| ID Copy (National ID / Iqama) | Image / PDF |
| Contract | PDF |
| Promissory Note | PDF |
| Product Invoice | PDF |
| IBAN Certificate | PDF / Image |
| Clearance Letter | PDF |

---

## 10. Computed / Derived Fields

| Field Name | Formula | Source |
|---|---|---|
| `total_retail_balance` | SUM(Jarir + Premium + Noon + Other + Cash Loan) | LCDPD |
| `grand_total_balance` | SUM(Total Retail + SME) | LCDPD |
| `npa_pct` | NPA Balance / Grand Total Balance | LCDPD |
| `target_amount_sar` | principal_outstanding × target_pct | Agent Target |
| `stable_amount_sar` | principal_outstanding − rollforward_amount | Agent Target |
| `achievement_pct` | total_collection / target_amount | Agent Target |
| `rollforward_pct` | rollforward_amount / principal_outstanding | Agent Target |
| `success_pct` | success_count / attempt_count | Collection Activity |
| `actual_working_hours` | total_minutes / 60 | Call Report |
| `remaining_finance` | total_finance_amount − total_amount_paid | Account |
| `total_collection_sar` | total_collection + court_collection + discount_amount | Agent Target |

---

## 11. Value Ranges & Benchmarks

### Portfolio Amount Ranges

| Level | Range | Unit |
|---|---|---|
| Individual loan | 4,800 – 264,721,606 | SAR |
| Agent portfolio (PKT-1) | 235M – 264M | SAR |
| Agent portfolio (PKT-3) | 2.4M – 6.6M | SAR |
| Agent portfolio (NPA) | 3.3M – 11.6M | SAR |
| Agent portfolio (WO) | 10.2M – 14.3M | SAR |
| Total portfolio (all products) | 878M – 895M | SAR |
| SME portfolio | ~330M | SAR |

### Collection Achievement Ranges (Oct 2025 actuals)

| Bucket | Agent Count Range | Achievement % Range |
|---|---|---|
| PKT-3 (61–90) | 395–1,025 accounts/agent | 303K–902K/agent |
| NPA 91–180 | 645–1,582 accounts/agent | 520K–839K/agent |
| NPA 181–360 | 646–658 accounts/agent | 48K–640K/agent |
| NPA 361–450 | 446–454 accounts/agent | 18K–243K/agent |
| Write-off | 630–634 accounts/agent | 82K–445K/agent |
| Call completion | — | 35%–100% daily |

### NPA % Ranges (by product/segment, Apr 2026)

| Segment | NPA % Range |
|---|---|
| Current RAC — 1.Jarir | 6.81% |
| Current RAC — 4.Other Partners | 8.99% |
| Closed RAC | 41.71%–51.80% |
| Overdue portion | 73.48%–88.59% |
| Overall portfolio | 11.98% |

---

## 12. Data Relationships Map

```
PORTFOLIO SNAPSHOT (LCDPD)
  │
  ├── Dimension: Product (1–5 + SME)
  ├── Dimension: DPD Bucket (0D / 1-30 / 31-60 / 61-90 / NPA)
  ├── Dimension: Segment (Total / Normal / Non-Starter)
  ├── Dimension: RAC Type (Current / Closed)
  └── Metrics: Balance, Count, NPA%, Overdue, Collections MTD
        │
        ▼
AGENT TARGETS (monthly)
  │
  ├── Grouped by: DPD Bucket → PKT-1/2/3 / NPA-1/2/3 / WO / NS
  ├── Agent → Supervisor → Bucket
  ├── Inputs: Principal O/S, Overdue Amount, Account Count
  ├── Targets: target_pct × principal (varies by bucket and month)
  └── Outputs: total_collection, court_collection, discount, achievement%
        │
        ▼
COLLECTION ACTIVITY (daily)
  │
  ├── Channel: SMS / Push / IVR / NABA / Agent
  ├── By DPD bucket: 1-30 / 31-60 / 61-90 / >91 / WO
  ├── Metrics: Attempt, Success, Success%
  ├── Sub-activity: Salary Pullout (Najez), Legal Filing (QF / Najiz)
  └── Call Report: Per-agent daily call volumes and outcomes
        │
        ▼
ACCOUNT / CUSTOMER RECORD (operational)
  │
  ├── Identity: national_id, contract_number, account_number
  ├── Financial: outstanding_balance, overdue_amount, dpd
  ├── Installment Schedule: per-installment status
  ├── Interaction Log: calls, SMS, notes, outcomes
  ├── Legal Status: Normal / Delinquent / Enforcement
  └── Offers: Discount / Settlement / Waiver
```

---

## 13. Key Business Rules Extracted

| Rule | Detail |
|---|---|
| PKT-1 rollforward threshold | If > 10% of accounts move to 31–60 DPD → target breached |
| PKT-2 rollforward threshold | > 25% move to 61–90 DPD → target breached |
| PKT-3 rollforward threshold | > 30%–35% move to NPA → target breached |
| NPA-1 rollback target | 25%–35% of accounts must move back to 61–90 DPD |
| NPA-2 collection target | Agents must collect 7% of overdue |
| NPA-3 collection target | 5% of overdue (2.5% in some periods) |
| Write-off fixed target | SAR 300K–400K per agent per month |
| Non-Starter separate tracking | 91–450 DPD NS tracked separately at 3.5% |
| URDU team | Dedicated team for non-Saudi (Urdu-speaking) borrowers, 12% target |
| Legal channels | QF (internal) and Najiz portal (court system) |
| Salary pullout | Only for >91 DPD and Write-off; via Najez portal |
| Discount types | Customer discount / Court payment / Write-off recovery with discount |
| Settlement offer basis | AI/Scoring model recommends offer type |
| Supervisor escalation | Triggered if follow-up delayed beyond scheduled date |
| Call recording | All agent calls recorded and linked to interaction log |

---

## 14. System Integrations Implied

| External System | Purpose |
|---|---|
| SADAD | Bill payment status tracking |
| Najez Portal | Salary pullout (wage protection) |
| Najiz Portal | Court filing and legal case management |
| NABA | Automated notification service (SAMA/Central Bank) |
| SAMA (implied) | Regulatory compliance (article references: Art 46, Art 34) |
| IVR / Sawt / Sarja | Automated voice calling bots |
| AI/Scoring Engine | Offer recommendation, PTP scoring |
| QF System | Internal legal filing |

---

## 15. Missing / To-Be-Confirmed Fields

| Field | Status | Note |
|---|---|---|
| `customer_id` (internal) | Implied, not explicit | Likely maps to contract_number |
| `assigned_agent_id` | Implied from agent_name | No explicit ID column in target files |
| `bureau_score` | Referenced in IBE but not in ops files | Likely SIMAH score |
| `collateral_type` | Not in ops files | Present in IBE legal module |
| `channel_preference` | Not in ops files | Derivable from interaction log |
| `payment_simulator` | Mentioned in docx, not fully detailed | Feature TBD |
| `offer_expiry_date` | Not explicit | Business rule needed |
| `dpd_trend` | Used in IBE model | Not in client ops files (derived) |

---

*End of analysis — 6 source files, ~15 data domains, ~120 distinct fields catalogued.*
