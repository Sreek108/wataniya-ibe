"""
generate_agent_targets.py
Generates backend/data/agent_targets.csv from exact data extracted from:
  - reference/Agent Target 23 - April - 2026.xlsx
  - reference/Agent Target 31-Mar - 2026 - closed.xlsx
"""

import csv
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'agent_targets.csv')

FIELDNAMES = [
    'period', 'bucket', 'agent_name', 'agent_type', 'account_count',
    'principal_outstanding_sar', 'overdue_amount_sar', 'os_amount_sar',
    'target_amount_sar', 'target_pct',
    'stable_amount_sar', 'rollforward_amount_sar', 'rollback_amount_sar',
    'stable_pct', 'rollforward_pct', 'rollback_pct',
    'collected_from_overdue_sar', 'collected_from_overdue_pct',
    'total_collection_sar', 'court_collection_sar', 'discount_amount_sar',
    'net_collection_sar', 'achievement_amount_sar', 'achievement_pct',
]


def r(period, bucket, agent_name, agent_type, account_count,
      principal_outstanding_sar=None, overdue_amount_sar=None, os_amount_sar=None,
      target_amount_sar=None, target_pct=None,
      stable_amount_sar=None, rollforward_amount_sar=None, rollback_amount_sar=None,
      stable_pct=None, rollforward_pct=None, rollback_pct=None,
      collected_from_overdue_sar=None, collected_from_overdue_pct=None,
      total_collection_sar=None, court_collection_sar=None, discount_amount_sar=None,
      net_collection_sar=None, achievement_amount_sar=None, achievement_pct=None):
    return locals()


RECORDS = [
    # ================================================================
    # APRIL 2026
    # ================================================================

    # PKT-1 (1-30 DPD) — Rollforward target <= 10%
    r('April-2026', 'PKT-1', 'A-1-30', 'bucket', 40587,
      principal_outstanding_sar=254069456, target_amount_sar=25406945.6, target_pct=0.10,
      stable_amount_sar=181200987, rollforward_amount_sar=72868469,
      stable_pct=0.713195, rollforward_pct=0.286805,
      total_collection_sar=17098177.24, court_collection_sar=433572.87,
      discount_amount_sar=70801, achievement_pct=0.9),

    # PKT-2 (31-60 DPD) — Rollforward target <= 25%
    r('April-2026', 'PKT-2', 'B-31-60', 'bucket', 8694,
      principal_outstanding_sar=55519083, target_amount_sar=13879770.75, target_pct=0.25,
      stable_amount_sar=22396236, rollforward_amount_sar=33122847,
      stable_pct=0.403397, rollforward_pct=0.596603,
      total_collection_sar=2971324.46, court_collection_sar=266686.66,
      discount_amount_sar=40970.19, achievement_pct=0.75),

    # PKT-3 (61-90 DPD) — Rollforward target <= 30% — individual agents
    r('April-2026', 'PKT-3', 'Manal Sami Almusaad', 'human', 1025,
      principal_outstanding_sar=6568296, target_amount_sar=1970488.8, target_pct=0.30,
      stable_amount_sar=3876500, rollforward_amount_sar=2691796,
      stable_pct=0.590184, rollforward_pct=0.409816,
      total_collection_sar=824143.1, court_collection_sar=313409.58, discount_amount_sar=660.01),

    r('April-2026', 'PKT-3', 'Hala Salem Alqahtani', 'human', 1003,
      principal_outstanding_sar=6567964, target_amount_sar=1970389.2, target_pct=0.30,
      stable_amount_sar=3929335, rollforward_amount_sar=2638629,
      stable_pct=0.598258, rollforward_pct=0.401742,
      total_collection_sar=893300.03, court_collection_sar=367888.08, discount_amount_sar=6567.8),

    r('April-2026', 'PKT-3', 'Fozyah Abdulaziz Alkhulifi', 'human', 1007,
      principal_outstanding_sar=6567845, target_amount_sar=1970353.5, target_pct=0.30,
      stable_amount_sar=3989108, rollforward_amount_sar=2578737,
      stable_pct=0.607369, rollforward_pct=0.392631,
      total_collection_sar=797394.19, court_collection_sar=272261.5, discount_amount_sar=5603),

    r('April-2026', 'PKT-3', 'Mohammed Saleh Aldalbahi', 'human', 1008,
      principal_outstanding_sar=6567590, target_amount_sar=1970277, target_pct=0.30,
      stable_amount_sar=3623186, rollforward_amount_sar=2944404,
      stable_pct=0.551677, rollforward_pct=0.448323,
      total_collection_sar=902744.53, court_collection_sar=351105.81, discount_amount_sar=36372.04),

    r('April-2026', 'PKT-3', 'IVR-61-90', 'IVR', 395,
      principal_outstanding_sar=2412380, target_amount_sar=723714, target_pct=0.30,
      stable_amount_sar=1628461, rollforward_amount_sar=783919,
      stable_pct=0.675043, rollforward_pct=0.324957,
      total_collection_sar=303126.17, court_collection_sar=142698.1, discount_amount_sar=299),

    # NPA 91-180 — Rollback target >= 25%
    r('April-2026', 'NPA-91-180', 'IVR-NPA-91-180', 'IVR', 1582,
      principal_outstanding_sar=11607398, target_amount_sar=2901849.5, target_pct=0.25,
      stable_amount_sar=9497319, rollback_amount_sar=2110079,
      stable_pct=0.818213, rollback_pct=0.181787,
      total_collection_sar=1300832.87, court_collection_sar=1093530.95, discount_amount_sar=64327.5),

    r('April-2026', 'NPA-91-180', 'Manal Salem Madi', 'human', 591,
      principal_outstanding_sar=4184992, target_amount_sar=1046248, target_pct=0.25,
      stable_amount_sar=3431394, rollback_amount_sar=753598,
      stable_pct=0.819928, rollback_pct=0.180072,
      total_collection_sar=420553.7, court_collection_sar=325679.81, discount_amount_sar=41575.82),

    r('April-2026', 'NPA-91-180', 'Mohammed Aedh Alharthi', 'human', 588,
      principal_outstanding_sar=4153449, target_amount_sar=1038362.25, target_pct=0.25,
      stable_amount_sar=3433193, rollback_amount_sar=720256,
      stable_pct=0.826588, rollback_pct=0.173412,
      total_collection_sar=424856.92, court_collection_sar=303103.87, discount_amount_sar=35854.57),

    r('April-2026', 'NPA-91-180', 'Fotoon Abdullah Khathran', 'human', 587,
      principal_outstanding_sar=4135970, target_amount_sar=1033992.5, target_pct=0.25,
      stable_amount_sar=3480948, rollback_amount_sar=655022,
      stable_pct=0.841628, rollback_pct=0.158372,
      total_collection_sar=346728.51, court_collection_sar=259892, discount_amount_sar=22490.86),

    r('April-2026', 'NPA-91-180', 'Atheer Alhwasheil', 'human', 585,
      principal_outstanding_sar=4098384, target_amount_sar=1024596, target_pct=0.25,
      stable_amount_sar=3471155, rollback_amount_sar=627229,
      stable_pct=0.846957, rollback_pct=0.153043,
      total_collection_sar=363148.24, court_collection_sar=280632.7, discount_amount_sar=31624.04),

    # NPA 181-360 — Collect 7% of overdue
    r('April-2026', 'NPA-181-360', 'IVR-NPA-181-360', 'IVR', 1533,
      overdue_amount_sar=7960988, target_amount_sar=557269.16, target_pct=0.07,
      collected_from_overdue_sar=291071.69, collected_from_overdue_pct=0.036562,
      total_collection_sar=432922.4, court_collection_sar=323347.25, discount_amount_sar=47759.37),

    r('April-2026', 'NPA-181-360', 'Hajir Obaid Al-Otaibi', 'human', 636,
      overdue_amount_sar=3036625, target_amount_sar=212563.75, target_pct=0.07,
      collected_from_overdue_sar=98105.82, collected_from_overdue_pct=0.032308,
      total_collection_sar=126684.95, court_collection_sar=80457.75, discount_amount_sar=11789.79),

    r('April-2026', 'NPA-181-360', 'Faez Abdualh Satem Mohamed', 'human', 621,
      overdue_amount_sar=3036491, target_amount_sar=212554.37, target_pct=0.07,
      collected_from_overdue_sar=131588.05, collected_from_overdue_pct=0.043336,
      total_collection_sar=155333.25, court_collection_sar=112945.85, discount_amount_sar=19161.3),

    r('April-2026', 'NPA-181-360', 'Ibrahim Abyan', 'human', 628,
      overdue_amount_sar=3036460, target_amount_sar=212552.2, target_pct=0.07,
      collected_from_overdue_sar=116344.96, collected_from_overdue_pct=0.038316,
      total_collection_sar=157182.61, court_collection_sar=105975.22, discount_amount_sar=18208.72),

    r('April-2026', 'NPA-181-360', 'Abdulrahman Bakheet Al Otaibi', 'human', 629,
      overdue_amount_sar=3036423, target_amount_sar=212549.61, target_pct=0.07,
      collected_from_overdue_sar=116020.31, collected_from_overdue_pct=0.03821,
      total_collection_sar=145400.85, court_collection_sar=86058.75, discount_amount_sar=35322.55),

    # NPA 361-450 — Collect 5% of overdue
    r('April-2026', 'NPA-361-450', 'IVR-NPA-361-450', 'IVR', 850,
      overdue_amount_sar=7261919, target_amount_sar=363095.95, target_pct=0.05,
      collected_from_overdue_sar=141499, collected_from_overdue_pct=0.019485,
      total_collection_sar=179575.17, court_collection_sar=135105.76, discount_amount_sar=27745.41),

    r('April-2026', 'NPA-361-450', 'Sultan Fahad Alinzee', 'human', 484,
      overdue_amount_sar=4018454, target_amount_sar=200922.7, target_pct=0.05,
      collected_from_overdue_sar=177538.29, collected_from_overdue_pct=0.044181,
      total_collection_sar=233072.25, court_collection_sar=120399.29, discount_amount_sar=78797.38),

    r('April-2026', 'NPA-361-450', 'Sarah Abdulaziz Aljurayyad', 'human', 483,
      overdue_amount_sar=4016701, target_amount_sar=200835.05, target_pct=0.05,
      collected_from_overdue_sar=154790.39, collected_from_overdue_pct=0.038537,
      total_collection_sar=243881.73, court_collection_sar=101293.26, discount_amount_sar=91262.21),

    # URDU 31-450 — Collect 12% of overdue
    r('April-2026', 'URDU', 'Anisha', 'human', 267,
      overdue_amount_sar=906366, target_amount_sar=108763.92, target_pct=0.12,
      collected_from_overdue_sar=67006.35, collected_from_overdue_pct=0.073929,
      total_collection_sar=76643.47, court_collection_sar=19378.44, discount_amount_sar=1002),

    r('April-2026', 'URDU', 'Sheetal', 'human', 276,
      overdue_amount_sar=904072, target_amount_sar=108488.64, target_pct=0.12,
      collected_from_overdue_sar=142348.38, collected_from_overdue_pct=0.157452,
      total_collection_sar=209392.67, court_collection_sar=67796.7, discount_amount_sar=45412.39),

    # URDU Write-Off — 1% recovery
    r('April-2026', 'URDU-WO', 'Sheetal-WriteOff', 'human', 510,
      os_amount_sar=14333782, target_amount_sar=143337.82, target_pct=0.01,
      achievement_amount_sar=172278, achievement_pct=0.012019,
      total_collection_sar=222673.99, court_collection_sar=50395.99,
      discount_amount_sar=119663.21, net_collection_sar=103010.78),

    r('April-2026', 'URDU-WO', 'Anisha-WriteOff', 'human', 517,
      os_amount_sar=14306133, target_amount_sar=143061.33, target_pct=0.01,
      achievement_amount_sar=34388, achievement_pct=0.002404,
      total_collection_sar=51349.52, court_collection_sar=16961.52,
      discount_amount_sar=34388, net_collection_sar=16961.52),

    # Write-Off — SAR 400K fixed target per agent
    r('April-2026', 'Write-Off', 'Amjd Ibrahim Al-Hazmi', 'human', 925,
      os_amount_sar=18621969, target_amount_sar=400000,
      achievement_amount_sar=137531.54, achievement_pct=0.007385,
      total_collection_sar=345457.59, court_collection_sar=207926.05,
      discount_amount_sar=86301, net_collection_sar=259156.59),

    r('April-2026', 'Write-Off', 'Fahad Laili Obaid AlMarei', 'human', 922,
      os_amount_sar=18621689, target_amount_sar=400000,
      achievement_amount_sar=47526.96, achievement_pct=0.002552,
      total_collection_sar=285058.55, court_collection_sar=237531.59,
      discount_amount_sar=34630.94, net_collection_sar=250427.61),

    r('April-2026', 'Write-Off', 'Mishaal Suleiman Alsaeed', 'human', 932,
      os_amount_sar=18621609, target_amount_sar=400000,
      achievement_amount_sar=176896.66, achievement_pct=0.0095,
      total_collection_sar=361025.94, court_collection_sar=184129.28,
      discount_amount_sar=130395.54, net_collection_sar=230630.4),

    r('April-2026', 'Write-Off', 'khalid Aytim Alanazi', 'human', 926,
      os_amount_sar=18621593, target_amount_sar=400000,
      achievement_amount_sar=188010.63, achievement_pct=0.010096,
      total_collection_sar=445468.77, court_collection_sar=257458.14,
      discount_amount_sar=143598.55, net_collection_sar=301870.22),

    r('April-2026', 'Write-Off', 'Fahad Abdulaziz Alateeq', 'human', 920,
      os_amount_sar=18621568, target_amount_sar=400000,
      achievement_amount_sar=111052.5, achievement_pct=0.005964,
      total_collection_sar=328423.83, court_collection_sar=217371.33,
      discount_amount_sar=73258.52, net_collection_sar=255165.31),

    r('April-2026', 'Write-Off', 'Trad Khaled Alharbi', 'human', 931,
      os_amount_sar=18621403, target_amount_sar=400000,
      achievement_amount_sar=9991.29, achievement_pct=0.000537,
      total_collection_sar=225378.54, court_collection_sar=215387.25,
      discount_amount_sar=3524, net_collection_sar=221854.54),

    r('April-2026', 'Write-Off', 'Suleiman Alhodhaif', 'human', 923,
      os_amount_sar=18621376, target_amount_sar=400000,
      achievement_amount_sar=270745.62, achievement_pct=0.01454,
      total_collection_sar=397075.85, court_collection_sar=126330.23,
      discount_amount_sar=190185.65, net_collection_sar=206890.2),

    r('April-2026', 'Write-Off', 'Nawaf Suliman Aldayel', 'human', 926,
      os_amount_sar=18621376, target_amount_sar=400000,
      achievement_amount_sar=128410.99, achievement_pct=0.006896,
      total_collection_sar=395725.95, court_collection_sar=267314.96,
      discount_amount_sar=104704.95, net_collection_sar=291021.0),

    r('April-2026', 'Write-Off', 'IVR-WriteOff+450', 'IVR', 11,
      os_amount_sar=254051, target_amount_sar=0,
      achievement_amount_sar=152415.72, achievement_pct=0.599941,
      total_collection_sar=207946.82, court_collection_sar=55531.1,
      discount_amount_sar=126374.28, net_collection_sar=81572.54),

    # ================================================================
    # MARCH 2026
    # ================================================================

    # PKT-1 — single bucket entry
    r('March-2026', 'PKT-1', 'A-1-30', 'bucket', 43788,
      principal_outstanding_sar=264721606, target_amount_sar=26472160.6, target_pct=0.10,
      stable_amount_sar=233885397, rollforward_amount_sar=30836209,
      stable_pct=0.883515, rollforward_pct=0.116485,
      total_collection_sar=27213321.75, court_collection_sar=356415.6,
      discount_amount_sar=187, achievement_pct=0.9),

    # PKT-2 — IVR only
    r('March-2026', 'PKT-2', 'IVR PKT-2', 'IVR', 8694,
      principal_outstanding_sar=57144645, target_amount_sar=14286161.25, target_pct=0.25,
      stable_amount_sar=35489383, rollforward_amount_sar=21655262,
      stable_pct=0.621045, rollforward_pct=0.378955,
      total_collection_sar=4749610.89, court_collection_sar=345760.19,
      discount_amount_sar=15317.07, achievement_pct=0.75),

    # PKT-3
    r('March-2026', 'PKT-3', 'Faez Abdualh Satem Mohamed', 'human', 789,
      principal_outstanding_sar=5304192, target_amount_sar=1591257.6, target_pct=0.30,
      stable_amount_sar=3383522, rollforward_amount_sar=1920670,
      stable_pct=0.637896, rollforward_pct=0.362104,
      total_collection_sar=579925.62, court_collection_sar=59607.64, discount_amount_sar=0),

    r('March-2026', 'PKT-3', 'Fozyah Abdulaziz Alkhulifi', 'human', 790,
      principal_outstanding_sar=5304255, target_amount_sar=1591276.5, target_pct=0.30,
      stable_amount_sar=3279425, rollforward_amount_sar=2024830,
      stable_pct=0.618263, rollforward_pct=0.381737,
      total_collection_sar=623508.6, court_collection_sar=102786.41, discount_amount_sar=1426),

    r('March-2026', 'PKT-3', 'Hala Salem Alqahtani', 'human', 786,
      principal_outstanding_sar=5304247, target_amount_sar=1591274.1, target_pct=0.30,
      stable_amount_sar=3155959, rollforward_amount_sar=2148288,
      stable_pct=0.594987, rollforward_pct=0.405013,
      total_collection_sar=579953.83, court_collection_sar=59566.36, discount_amount_sar=2947.71),

    r('March-2026', 'PKT-3', 'Sawt-PKT-3', 'voicebot', 783,
      principal_outstanding_sar=5303680, target_amount_sar=1591104, target_pct=0.30,
      stable_amount_sar=2900434, rollforward_amount_sar=2403246,
      stable_pct=0.546872, rollforward_pct=0.453128,
      total_collection_sar=526733.21, court_collection_sar=66346.69, discount_amount_sar=0),

    r('March-2026', 'PKT-3', 'Sarja-PKT-3', 'voicebot', 795,
      principal_outstanding_sar=5304794, target_amount_sar=1591438.2, target_pct=0.30,
      stable_amount_sar=2813199, rollforward_amount_sar=2491595,
      stable_pct=0.530313, rollforward_pct=0.469687,
      total_collection_sar=520964.02, court_collection_sar=39440.04, discount_amount_sar=9106),

    # NPA 91-180
    r('March-2026', 'NPA-91-180', 'Alanoud Ibrahim Almaslmani', 'human', 665,
      principal_outstanding_sar=4712167, target_amount_sar=1178041.75, target_pct=0.25,
      stable_amount_sar=3507761, rollback_amount_sar=1204406,
      stable_pct=0.744405, rollback_pct=0.255595,
      total_collection_sar=839048.4, court_collection_sar=331330.51, discount_amount_sar=148230.35),

    r('March-2026', 'NPA-91-180', 'Alanoud Saud Alotaibi', 'human', 647,
      principal_outstanding_sar=4695065, target_amount_sar=1173766.25, target_pct=0.25,
      stable_amount_sar=3498841, rollback_amount_sar=1196224,
      stable_pct=0.745217, rollback_pct=0.254783,
      total_collection_sar=725419.49, court_collection_sar=336272.85, discount_amount_sar=134049.45),

    r('March-2026', 'NPA-91-180', 'Amjd Ibrahim Al-Hazmi', 'human', 655,
      principal_outstanding_sar=4694938, target_amount_sar=1173734.5, target_pct=0.25,
      stable_amount_sar=3688643, rollback_amount_sar=1006295,
      stable_pct=0.785664, rollback_pct=0.214336,
      total_collection_sar=631630.4, court_collection_sar=352828.36, discount_amount_sar=81169.59),

    r('March-2026', 'NPA-91-180', 'Fahad Laili Obaid AlMarei', 'human', 666,
      principal_outstanding_sar=4713633, target_amount_sar=1178408.25, target_pct=0.25,
      stable_amount_sar=3723360, rollback_amount_sar=990273,
      stable_pct=0.789913, rollback_pct=0.210087,
      total_collection_sar=520230.23, court_collection_sar=276447.14, discount_amount_sar=78229.65),

    r('March-2026', 'NPA-91-180', 'Sarja-NPA-91-180', 'voicebot', 665,
      principal_outstanding_sar=4710310, target_amount_sar=1177577.5, target_pct=0.25,
      stable_amount_sar=3693901, rollback_amount_sar=1016409,
      stable_pct=0.784216, rollback_pct=0.215784,
      total_collection_sar=589820.61, court_collection_sar=304878.02, discount_amount_sar=53642.08),

    r('March-2026', 'NPA-91-180', 'Sawt-NPA-91-180', 'voicebot', 654,
      principal_outstanding_sar=4695966, target_amount_sar=1173991.5, target_pct=0.25,
      stable_amount_sar=3765511, rollback_amount_sar=930455,
      stable_pct=0.801861, rollback_pct=0.198139,
      total_collection_sar=542218.73, court_collection_sar=335350.46, discount_amount_sar=35385.62),

    # NPA 181-360 — 7% of overdue
    r('March-2026', 'NPA-181-360', 'Atheer Alhwasheil', 'human', 615,
      overdue_amount_sar=3321116, target_amount_sar=232478.12, target_pct=0.07,
      collected_from_overdue_sar=235265.48, collected_from_overdue_pct=0.070839,
      total_collection_sar=370721.28, court_collection_sar=175850.93, discount_amount_sar=98055.8),

    r('March-2026', 'NPA-181-360', 'Hajir Obaid Al-Otaibi', 'human', 619,
      overdue_amount_sar=3321042, target_amount_sar=232472.94, target_pct=0.07,
      collected_from_overdue_sar=336427.27, collected_from_overdue_pct=0.101302,
      total_collection_sar=640299.85, court_collection_sar=298662.7, discount_amount_sar=166367.41),

    r('March-2026', 'NPA-181-360', 'Mohammed Aedh Alharthi', 'human', 626,
      overdue_amount_sar=3320985, target_amount_sar=232468.95, target_pct=0.07,
      collected_from_overdue_sar=367058.14, collected_from_overdue_pct=0.110527,
      total_collection_sar=654465.94, court_collection_sar=215838.31, discount_amount_sar=221158.98),

    r('March-2026', 'NPA-181-360', 'Samar Fahad Alharbi', 'human', 631,
      overdue_amount_sar=3321006, target_amount_sar=232470.42, target_pct=0.07,
      collected_from_overdue_sar=305014.68, collected_from_overdue_pct=0.091844,
      total_collection_sar=465417.81, court_collection_sar=144120.95, discount_amount_sar=171835.12),

    r('March-2026', 'NPA-181-360', 'Sarja-NPA-181-360', 'voicebot', 624,
      overdue_amount_sar=3321100, target_amount_sar=232477.0, target_pct=0.07,
      collected_from_overdue_sar=286680.93, collected_from_overdue_pct=0.086321,
      total_collection_sar=437608.46, court_collection_sar=215441.65, discount_amount_sar=109533.22),

    r('March-2026', 'NPA-181-360', 'Sawt-NPA-181-360', 'voicebot', 621,
      overdue_amount_sar=3321130, target_amount_sar=232479.1, target_pct=0.07,
      collected_from_overdue_sar=191240.01, collected_from_overdue_pct=0.057583,
      total_collection_sar=324578.12, court_collection_sar=170208.47, discount_amount_sar=69699.82),

    # NPA 361-450 — 5% of overdue
    r('March-2026', 'NPA-361-450', 'Sultan Fahad Alinzee', 'human', 603,
      overdue_amount_sar=4929905, target_amount_sar=246495.25, target_pct=0.05,
      collected_from_overdue_sar=283907.89, collected_from_overdue_pct=0.057589,
      total_collection_sar=401646.01, court_collection_sar=146341.44, discount_amount_sar=150653.43),

    r('March-2026', 'NPA-361-450', 'Sarja-NPA-361-450', 'voicebot', 303,
      overdue_amount_sar=2466328, target_amount_sar=123316.4, target_pct=0.05,
      collected_from_overdue_sar=104676.19, collected_from_overdue_pct=0.042442,
      total_collection_sar=161932.12, court_collection_sar=52797.31, discount_amount_sar=65962.03),

    r('March-2026', 'NPA-361-450', 'Sawt-NPA-361-450', 'voicebot', 301,
      overdue_amount_sar=2464939, target_amount_sar=123246.95, target_pct=0.05,
      collected_from_overdue_sar=163918.59, collected_from_overdue_pct=0.0665,
      total_collection_sar=235009.12, court_collection_sar=63527.15, discount_amount_sar=81897.69),

    # Non-Starter 91-450 — 3.5% collection
    r('March-2026', 'Non-Starter-91-450', 'Manal Sami Almusaad', 'human', 489,
      principal_outstanding_sar=5494878, target_amount_sar=192320.73, target_pct=0.035,
      collected_from_overdue_sar=560553.6, collected_from_overdue_pct=0.102014,
      total_collection_sar=575402.49, court_collection_sar=303093.96, discount_amount_sar=120560.52),

    r('March-2026', 'Non-Starter-91-450', 'Sarja-NPA-NonStarter-91-450', 'voicebot', 491,
      principal_outstanding_sar=5494447, target_amount_sar=192305.645, target_pct=0.035,
      collected_from_overdue_sar=413812.74, collected_from_overdue_pct=0.075315,
      total_collection_sar=414652.82, court_collection_sar=309461.12, discount_amount_sar=52095),

    r('March-2026', 'Non-Starter-91-450', 'Sawt-NPA-NonStarter-91-450', 'voicebot', 494,
      principal_outstanding_sar=5493653, target_amount_sar=192277.855, target_pct=0.035,
      collected_from_overdue_sar=385814.34, collected_from_overdue_pct=0.070229,
      total_collection_sar=389190.8, court_collection_sar=225877.09, discount_amount_sar=41684.48),

    # URDU 31-450 — 12% of overdue
    r('March-2026', 'URDU', 'Sheetal', 'human', 286,
      overdue_amount_sar=1038947, target_amount_sar=124673.64, target_pct=0.12,
      collected_from_overdue_sar=214462.01, collected_from_overdue_pct=0.206422,
      total_collection_sar=291889.41, court_collection_sar=39326.33, discount_amount_sar=91514.08),

    r('March-2026', 'URDU', 'IVR-English-31-450', 'IVR', 297,
      overdue_amount_sar=1030116, target_amount_sar=123613.92, target_pct=0.12,
      collected_from_overdue_sar=139462.44, collected_from_overdue_pct=0.135385,
      total_collection_sar=158889.73, court_collection_sar=25688.91, discount_amount_sar=23597.32),

    # URDU Write-Off — 1% recovery
    r('March-2026', 'URDU-WO', 'Sheetal-WriteOff', 'human', 498,
      os_amount_sar=14266841, target_amount_sar=142668.41, target_pct=0.01,
      achievement_amount_sar=92959.98, achievement_pct=0.006516,
      total_collection_sar=96063.2, court_collection_sar=18123.53,
      discount_amount_sar=47532.8, net_collection_sar=48530.4),

    r('March-2026', 'URDU-WO', 'IVR-English-WriteOff', 'IVR', 511,
      os_amount_sar=14268367, target_amount_sar=142683.67, target_pct=0.01,
      achievement_amount_sar=129394.17, achievement_pct=0.009069,
      total_collection_sar=133416.32, court_collection_sar=59049.52,
      discount_amount_sar=42120, net_collection_sar=91296.32),

    # Write-Off — SAR 350K fixed target per agent
    r('March-2026', 'Write-Off', 'Abdulrahman Al Otaibi', 'human', 690,
      os_amount_sar=14127043, target_amount_sar=350000,
      achievement_amount_sar=410387.88, achievement_pct=0.02905,
      total_collection_sar=432229.73, court_collection_sar=155566.38,
      discount_amount_sar=136609.6, net_collection_sar=295620.13),

    r('March-2026', 'Write-Off', 'Fahad Abdulaziz Alateeq', 'human', 703,
      os_amount_sar=14125455, target_amount_sar=350000,
      achievement_amount_sar=477467.81, achievement_pct=0.033802,
      total_collection_sar=483103.02, court_collection_sar=235193.36,
      discount_amount_sar=134590.84, net_collection_sar=348512.18),

    r('March-2026', 'Write-Off', 'Ibrahim Abyan', 'human', 696,
      os_amount_sar=14126713, target_amount_sar=350000,
      achievement_amount_sar=443024.85, achievement_pct=0.031361,
      total_collection_sar=447546.93, court_collection_sar=197165.22,
      discount_amount_sar=144363.63, net_collection_sar=303183.3),

    r('March-2026', 'Write-Off', 'khalid Aytim Alanazi', 'human', 693,
      os_amount_sar=14126723, target_amount_sar=350000,
      achievement_amount_sar=428540.81, achievement_pct=0.030335,
      total_collection_sar=445227.09, court_collection_sar=244531.23,
      discount_amount_sar=109207.68, net_collection_sar=336019.41),

    r('March-2026', 'Write-Off', 'Mishaal Suleiman Alsaeed', 'human', 696,
      os_amount_sar=14126375, target_amount_sar=350000,
      achievement_amount_sar=531503.81, achievement_pct=0.037625,
      total_collection_sar=544000.67, court_collection_sar=252169.61,
      discount_amount_sar=175481, net_collection_sar=368519.67),

    r('March-2026', 'Write-Off', 'Nawaf Suliman Aldayel', 'human', 693,
      os_amount_sar=14125991, target_amount_sar=350000,
      achievement_amount_sar=473818.01, achievement_pct=0.033542,
      total_collection_sar=480277.75, court_collection_sar=366817,
      discount_amount_sar=58095.36, net_collection_sar=422182.39),

    r('March-2026', 'Write-Off', 'Suleiman Alhodhaif', 'human', 705,
      os_amount_sar=14126465, target_amount_sar=350000,
      achievement_amount_sar=456459.56, achievement_pct=0.032312,
      total_collection_sar=464273.02, court_collection_sar=275188.99,
      discount_amount_sar=112434.71, net_collection_sar=351838.31),

    r('March-2026', 'Write-Off', 'Trad Khaled Alharbi', 'human', 704,
      os_amount_sar=14126576, target_amount_sar=350000,
      achievement_amount_sar=430513.66, achievement_pct=0.030475,
      total_collection_sar=433635.4, court_collection_sar=226832.07,
      discount_amount_sar=124310.73, net_collection_sar=309324.67),

    r('March-2026', 'Write-Off', 'Sawt-WriteOff+450', 'voicebot', 710,
      os_amount_sar=14126639, target_amount_sar=350000,
      achievement_amount_sar=390280.53, achievement_pct=0.027627,
      total_collection_sar=417884.94, court_collection_sar=244253.25,
      discount_amount_sar=95971.72, net_collection_sar=321913.22),

    r('March-2026', 'Write-Off', 'Sarja-WriteOff+450', 'voicebot', 698,
      os_amount_sar=14126626, target_amount_sar=350000,
      achievement_amount_sar=377995.09, achievement_pct=0.026758,
      total_collection_sar=389905.5, court_collection_sar=276750.11,
      discount_amount_sar=63601.65, net_collection_sar=326303.85),
]


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(RECORDS)

    april = [rec for rec in RECORDS if rec['period'] == 'April-2026']
    march = [rec for rec in RECORDS if rec['period'] == 'March-2026']
    print(f"[OK] {len(RECORDS)} records -> {OUTPUT_PATH}")
    print(f"     April-2026: {len(april)} rows")
    print(f"     March-2026: {len(march)} rows")

    buckets = {}
    for rec in RECORDS:
        key = (rec['period'], rec['bucket'])
        buckets[key] = buckets.get(key, 0) + 1
    print("\nRows per period / bucket:")
    for k in sorted(buckets):
        print(f"  {k[0]:<15}  {k[1]:<30}  {buckets[k]} rows")


if __name__ == '__main__':
    main()
