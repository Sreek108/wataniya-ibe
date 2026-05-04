import { useState, useEffect, useMemo } from 'react'
import { Users, Download } from 'lucide-react'
import { getAgentTargets } from './api'

// ── Bucket ordering & metadata ────────────────────────────────────────────────
const BUCKET_ORDER = [
  'PKT-1', 'PKT-2', 'PKT-3',
  'NPA-91-180', 'NPA-181-360', 'NPA-361-450',
  'Non-Starter-91-450', 'URDU', 'URDU-WO', 'Write-Off',
]

const BUCKET_LABEL = {
  'PKT-1':              'PKT-1 (1-30 DPD)',
  'PKT-2':              'PKT-2 (31-60 DPD)',
  'PKT-3':              'PKT-3 (61-90 DPD)',
  'NPA-91-180':         'NPA 91-180 DPD',
  'NPA-181-360':        'NPA 181-360 DPD',
  'NPA-361-450':        'NPA 361-450 DPD',
  'Non-Starter-91-450': 'Non-Starter 91-450',
  'URDU':               'URDU 31-450',
  'URDU-WO':            'Write-Off (URDU)',
  'Write-Off':          'Write-Off',
}

const BUCKET_TARGET_RULE = {
  'PKT-1':              'Rollforward target 10%',
  'PKT-2':              'Rollforward target 25%',
  'PKT-3':              'Rollforward target 30%',
  'NPA-91-180':         'Rollback target 25%',
  'NPA-181-360':        'Collection 7% of overdue',
  'NPA-361-450':        'Collection 5% of overdue',
  'Non-Starter-91-450': 'Collection 3.5%',
  'URDU':               'Collection 12%',
  'URDU-WO':            'Target 1% recovery',
  'Write-Off':          'Target SAR 350K per agent',
}

const PKT_BUCKETS  = new Set(['PKT-1', 'PKT-2', 'PKT-3'])
const SHOW_ROLLBACK = new Set(['NPA-91-180'])

const SUPERVISOR_MAP = {
  'A-1-30':                       'Amal Hamoud Alotaibi',
  'B-31-60':                      'Amal Hamoud Alotaibi',
  'IVR PKT-2':                    'Amal Hamoud Alotaibi',
  'Manal Sami Almusaad':          'Amal Hamoud Alotaibi',
  'Hala Salem Alqahtani':         'Amal Hamoud Alotaibi',
  'Fotoon Abdullah Khathran':     'Amal Hamoud Alotaibi',
  'Atheer Alhwasheil':            'Amal Hamoud Alotaibi',
  'Hajir Obaid Al-Otaibi':        'Amal Hamoud Alotaibi',
  'Samar Fahad Alharbi':          'Amal Hamoud Alotaibi',
  'Sultan Fahad Alinzee':         'Amal Hamoud Alotaibi',
  'Sarah Abdulaziz Aljurayyad':   'Amal Hamoud Alotaibi',
  'IVR-NPA-361-450':              'Amal Hamoud Alotaibi',
  'Fozyah Abdulaziz Alkhulifi':   'Ahmed Alshammari',
  'Mohammed Saleh Aldalbahi':     'Ahmed Alshammari',
  'IVR-61-90':                    'Ahmed Alshammari',
  'Sawt-PKT-3':                   'Ahmed Alshammari',
  'Sarja-PKT-3':                  'Ahmed Alshammari',
  'Faez Abdualh Satem Mohamed':   'Ahmed Alshammari',
  'IVR-NPA-91-180':               'Ahmed Alshammari',
  'Manal Salem Madi':             'Ahmed Alshammari',
  'Mohammed Aedh Alharthi':       'Ahmed Alshammari',
  'Alanoud Ibrahim Almaslmani':   'Ahmed Alshammari',
  'Alanoud Saud Alotaibi':        'Ahmed Alshammari',
  'Amjd Ibrahim Al-Hazmi':        'Ahmed Alshammari',
  'Fahad Laili Obaid AlMarei':    'Ahmed Alshammari',
  'Sarja-NPA-91-180':             'Ahmed Alshammari',
  'Sawt-NPA-91-180':              'Ahmed Alshammari',
  'IVR-NPA-181-360':              'Ahmed Alshammari',
  'Ibrahim Abyan':                'Ahmed Alshammari',
  'Abdulrahman Bakheet Al Otaibi':'Ahmed Alshammari',
  'Sarja-NPA-181-360':            'Ahmed Alshammari',
  'Sawt-NPA-181-360':             'Ahmed Alshammari',
  'Sarja-NPA-361-450':            'Ahmed Alshammari',
  'Sawt-NPA-361-450':             'Ahmed Alshammari',
  'Sarja-NPA-NonStarter-91-450':  'Ahmed Alshammari',
  'Sawt-NPA-NonStarter-91-450':   'Ahmed Alshammari',
  'Anisha':                       'Ahmed Alshammari',
  'Sheetal':                      'Ahmed Alshammari',
  'Anisha-WriteOff':              'Ahmed Alshammari',
  'Sheetal-WriteOff':             'Ahmed Alshammari',
  'IVR-English-31-450':           'Ahmed Alshammari',
  'IVR-English-WriteOff':         'Ahmed Alshammari',
  'Mishaal Suleiman Alsaeed':     'Ahmed Alshammari',
  'khalid Aytim Alanazi':         'Ahmed Alshammari',
  'Fahad Abdulaziz Alateeq':      'Ahmed Alshammari',
  'Trad Khaled Alharbi':          'Ahmed Alshammari',
  'Suleiman Alhodhaif':           'Ahmed Alshammari',
  'Nawaf Suliman Aldayel':        'Ahmed Alshammari',
  'IVR-WriteOff+450':             'Ahmed Alshammari',
  'Abdulrahman Al Otaibi':        'Ahmed Alshammari',
  'Sawt-WriteOff+450':            'Ahmed Alshammari',
  'Sarja-WriteOff+450':           'Ahmed Alshammari',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const sar  = v => (v == null || isNaN(v) || v === 0) ? '—' : (v / 1e6).toFixed(2) + 'M'
const sarK = v => (v == null || isNaN(v))             ? '—' : (v / 1000).toFixed(1) + 'K'
const pct  = v => (v == null || isNaN(v))             ? '—' : v.toFixed(1) + '%'
const num  = v => v == null                            ? '—' : Number(v).toLocaleString()

const isSystemAgent = name =>
  ['IVR', 'Sawt', 'Sarja', 'A-1-30', 'B-31-60'].some(p => (name || '').startsWith(p))

function achPct(t, c) {
  if (!t || t === 0) return null
  return (c / t) * 100
}

function achColor(p) {
  if (p == null) return '#6b7280'
  if (p >= 90)   return '#16a34a'
  if (p >= 60)   return '#d97706'
  return '#dc2626'
}

function achBg(p) {
  if (p == null) return '#f3f4f6'
  if (p >= 90)   return '#dcfce7'
  if (p >= 60)   return '#fef9c3'
  return '#fee2e2'
}

function bucketTotals(rows) {
  let accounts = 0, overdue = 0, target = 0, collected = 0, court = 0, discount = 0
  let stableW = 0, rfW = 0, rbW = 0
  let hasStable = false, hasRF = false, hasRB = false

  for (const r of rows) {
    const ac = r.account_count || 0
    accounts  += ac
    overdue   += r.principal_outstanding_sar || 0
    target    += r.target_amount_sar || 0
    collected += r.total_collection_sar || 0
    court     += r.court_collection_sar || 0
    discount  += r.discount_amount_sar || 0

    if (r.stable_pct != null && !isNaN(r.stable_pct)) { stableW += r.stable_pct * ac; hasStable = true }
    if (r.rollforward_pct != null && !isNaN(r.rollforward_pct)) { rfW += r.rollforward_pct * ac; hasRF = true }
    if (r.rollback_pct != null && !isNaN(r.rollback_pct)) { rbW += r.rollback_pct * ac; hasRB = true }
  }

  return {
    accounts, overdue, target, collected, court, discount,
    stablePct:  hasStable && accounts > 0 ? (stableW / accounts) * 100 : null,
    rfPct:      hasRF     && accounts > 0 ? (rfW     / accounts) * 100 : null,
    rbPct:      hasRB     && accounts > 0 ? (rbW     / accounts) * 100 : null,
  }
}

// ── Style constants ───────────────────────────────────────────────────────────
const TH = (extra = {}) => ({
  padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700,
  color: '#fff', whiteSpace: 'nowrap', background: '#1e3a5f',
  borderRight: '1px solid #2d5080', position: 'sticky', top: 0, zIndex: 1, ...extra,
})
const TD = (extra = {}) => ({
  padding: '8px 12px', textAlign: 'right', fontSize: 12,
  color: '#374151', borderRight: '0.5px solid #f0f2f7', whiteSpace: 'nowrap', ...extra,
})

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, bg }) {
  return (
    <div style={{ flex: 1, minWidth: 160, background: bg || '#fff', border: '0.5px solid #e8eaf0', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || '#1a1a2e', lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Achievement badge ─────────────────────────────────────────────────────────
function AchBadge({ target, collected }) {
  const p = achPct(target, collected)
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: achBg(p), color: achColor(p) }}>
      {p != null ? p.toFixed(1) + '%' : '—'}
    </span>
  )
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportBucketCSV(bucketGroups, period) {
  const hdr = ['DPD Bucket', 'Target Rule', 'Accounts', 'Overdue (SAR M)', 'Target (SAR M)',
               'Collected (SAR M)', 'Court (SAR)', 'Discount (SAR)', 'Achievement %',
               'Stable %', 'RF/RB %']
  const lines = [hdr.join(',')]
  let gt = { accounts: 0, overdue: 0, target: 0, collected: 0, court: 0, discount: 0 }
  for (const b of BUCKET_ORDER) {
    const rows = bucketGroups[b] || []
    if (!rows.length) continue
    const t = bucketTotals(rows)
    const p = achPct(t.target, t.collected)
    const rfRb = SHOW_ROLLBACK.has(b) ? t.rbPct : PKT_BUCKETS.has(b) ? t.rfPct : null
    lines.push([
      BUCKET_LABEL[b] || b,
      BUCKET_TARGET_RULE[b] || '',
      t.accounts,
      (t.overdue / 1e6).toFixed(2),
      (t.target / 1e6).toFixed(2),
      (t.collected / 1e6).toFixed(2),
      t.court.toFixed(0),
      t.discount.toFixed(0),
      p != null ? p.toFixed(1) + '%' : '',
      t.stablePct != null ? t.stablePct.toFixed(1) + '%' : '',
      rfRb != null ? rfRb.toFixed(1) + '%' : '',
    ].join(','))
    gt.accounts += t.accounts; gt.overdue += t.overdue; gt.target += t.target
    gt.collected += t.collected; gt.court += t.court; gt.discount += t.discount
  }
  const gtp = achPct(gt.target, gt.collected)
  lines.push(['Grand Total', '', gt.accounts, (gt.overdue/1e6).toFixed(2), (gt.target/1e6).toFixed(2),
    (gt.collected/1e6).toFixed(2), gt.court.toFixed(0), gt.discount.toFixed(0),
    gtp != null ? gtp.toFixed(1) + '%' : '', '', ''].join(','))

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `agent-targets-${period}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── Section 2: Bucket Summary Table ──────────────────────────────────────────
function BucketSummaryTable({ bucketGroups, period }) {
  let grandAcct = 0, grandOvd = 0, grandTgt = 0, grandColl = 0, grandCourt = 0, grandDisc = 0

  const rows = BUCKET_ORDER.map(b => {
    const bRows = bucketGroups[b] || []
    if (!bRows.length) return null
    const t  = bucketTotals(bRows)
    const p  = achPct(t.target, t.collected)
    const isNPA = !PKT_BUCKETS.has(b)
    const rfRb = SHOW_ROLLBACK.has(b) ? t.rbPct : PKT_BUCKETS.has(b) ? t.rfPct : null
    grandAcct  += t.accounts; grandOvd   += t.overdue
    grandTgt   += t.target;   grandColl  += t.collected
    grandCourt += t.court;    grandDisc  += t.discount
    return { b, t, p, isNPA, rfRb }
  }).filter(Boolean)

  const gp = achPct(grandTgt, grandColl)

  return (
    <div style={{ background: '#fff', border: '0.5px solid #e8eaf0', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #e8eaf0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>Collection Targets by Bucket</span>
          <span style={{ fontSize: 11, color: '#888', marginLeft: 12 }}>All buckets · MTD</span>
        </div>
        <button onClick={() => exportBucketCSV(bucketGroups, period)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: '0.5px solid #e0e3eb', background: '#fff', fontSize: 11, fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
          <Download size={13} />Export CSV
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={TH({ textAlign: 'left', minWidth: 160 })}>DPD Bucket</th>
              <th style={TH({ textAlign: 'left', minWidth: 180 })}>Target Rule</th>
              <th style={TH()}>Accounts</th>
              <th style={TH()}>Overdue (SAR M)</th>
              <th style={TH()}>Target (SAR M)</th>
              <th style={TH()}>Collected (SAR M)</th>
              <th style={TH()}>Court (SAR)</th>
              <th style={TH()}>Discount (SAR)</th>
              <th style={TH()}>Achievement %</th>
              <th style={TH()}>Stable %</th>
              <th style={{ ...TH({ borderRight: 'none' }) }}>RF / RB %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ b, t, p, isNPA, rfRb }, i) => (
              <tr key={b} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '0.5px solid #f0f2f7' }}>
                <td style={TD({ textAlign: 'left', fontWeight: 700, color: '#1e3a5f' })}>{BUCKET_LABEL[b] || b}</td>
                <td style={TD({ textAlign: 'left', fontSize: 11, color: '#6b7280' })}>{BUCKET_TARGET_RULE[b] || '—'}</td>
                <td style={TD()}>{num(t.accounts)}</td>
                <td style={TD()}>{sar(t.overdue)}</td>
                <td style={TD({ color: '#1e3a5f', fontWeight: 600 })}>{sar(t.target)}</td>
                <td style={TD({ color: '#16a34a', fontWeight: 600 })}>{sar(t.collected)}</td>
                <td style={TD()}>{sarK(t.court)}</td>
                <td style={TD()}>{sarK(t.discount)}</td>
                <td style={TD()}>
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: achBg(p), color: achColor(p) }}>
                    {p != null ? p.toFixed(1) + '%' : '—'}
                  </span>
                </td>
                <td style={TD({ color: '#3b82f6' })}>{t.stablePct != null ? pct(t.stablePct) : '—'}</td>
                <td style={{ ...TD({ borderRight: 'none', color: isNPA ? '#ef4444' : '#3b82f6' }) }}>
                  {rfRb != null ? pct(rfRb) : '—'}
                </td>
              </tr>
            ))}
            {/* Grand Total */}
            <tr style={{ background: '#1e3a5f', borderTop: '2px solid #1e3a5f' }}>
              <td style={{ ...TD({ textAlign: 'left', fontWeight: 800, color: '#fff', background: '#1e3a5f' }) }}>Grand Total</td>
              <td style={{ ...TD({ textAlign: 'left', color: '#94a3b8', background: '#1e3a5f' }) }}>All Buckets</td>
              <td style={{ ...TD({ fontWeight: 700, color: '#fff', background: '#1e3a5f' }) }}>{num(grandAcct)}</td>
              <td style={{ ...TD({ color: '#fff', background: '#1e3a5f' }) }}>{sar(grandOvd)}</td>
              <td style={{ ...TD({ fontWeight: 700, color: '#93c5fd', background: '#1e3a5f' }) }}>{sar(grandTgt)}</td>
              <td style={{ ...TD({ fontWeight: 700, color: '#86efac', background: '#1e3a5f' }) }}>{sar(grandColl)}</td>
              <td style={{ ...TD({ color: '#e2e8f0', background: '#1e3a5f' }) }}>{sarK(grandCourt)}</td>
              <td style={{ ...TD({ color: '#e2e8f0', background: '#1e3a5f' }) }}>{sarK(grandDisc)}</td>
              <td style={{ ...TD({ background: '#1e3a5f' }) }}>
                <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 12, background: achBg(gp), color: achColor(gp) }}>
                  {gp != null ? gp.toFixed(1) + '%' : '—'}
                </span>
              </td>
              <td style={{ ...TD({ color: '#e2e8f0', background: '#1e3a5f' }) }}>—</td>
              <td style={{ ...TD({ borderRight: 'none', color: '#e2e8f0', background: '#1e3a5f' }) }}>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section 3: Always-open agent table per bucket ────────────────────────────
function BucketSection({ bucket, rows }) {
  const t = bucketTotals(rows)
  const p = achPct(t.target, t.collected)
  const isPKT = PKT_BUCKETS.has(bucket)
  const isNPA = !isPKT

  const sorted = [...rows].sort((a, b) => {
    const pa = achPct(a.target_amount_sar, a.total_collection_sar) ?? -1
    const pb = achPct(b.target_amount_sar, b.total_collection_sar) ?? -1
    return pb - pa
  })

  const humanAgents = sorted.filter(r => !isSystemAgent(r.agent_name))
  const topAgent    = humanAgents.length ? humanAgents[0].agent_name : null
  const bottomAgent = humanAgents.length > 1 ? humanAgents[humanAgents.length - 1].agent_name : null

  return (
    <div style={{ border: '0.5px solid #e8eaf0', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
      {/* Bucket header — visual separator only */}
      <div style={{ padding: '11px 16px', background: '#1e3a5f', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#fff', flex: 1 }}>
          {BUCKET_LABEL[bucket] || bucket}
        </span>
        <span style={{ fontSize: 11, color: '#93c5fd' }}>{num(t.accounts)} accounts</span>
        <span style={{ fontSize: 11, color: '#86efac', marginLeft: 16 }}>{sar(t.overdue)} overdue</span>
        <span style={{ fontSize: 11, color: '#e2e8f0', marginLeft: 16 }}>Target: {sar(t.target)}</span>
        <span style={{ marginLeft: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 12, background: achBg(p), color: achColor(p) }}>
            {p != null ? p.toFixed(1) + '%' : '—'}
          </span>
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={TH({ textAlign: 'left', minWidth: 200 })}>Agent</th>
              <th style={TH({ textAlign: 'left', minWidth: 160 })}>Supervisor</th>
              <th style={TH()}>Accounts</th>
              <th style={TH()}>Overdue (SAR M)</th>
              <th style={TH()}>Target (SAR M)</th>
              {isPKT && <th style={TH()}>Stable</th>}
              {isPKT && <th style={TH()}>Rollforward</th>}
              {isPKT && <th style={TH()}>Stable %</th>}
              {isPKT && <th style={TH()}>RF %</th>}
              {isNPA && SHOW_ROLLBACK.has(bucket) && <th style={TH()}>Rollback %</th>}
              <th style={TH()}>Collected (SAR M)</th>
              <th style={TH()}>Court (SAR K)</th>
              <th style={TH()}>Discount (SAR K)</th>
              <th style={{ ...TH({ borderRight: 'none' }) }}>Achievement %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const rp  = achPct(r.target_amount_sar, r.total_collection_sar)
              const sys = isSystemAgent(r.agent_name)
              const isTop = !sys && r.agent_name === topAgent && rp != null
              const isBot = !sys && r.agent_name === bottomAgent && rp != null && topAgent !== bottomAgent
              const rowBg = isTop ? '#f0fdf4' : isBot ? '#fef2f2' : i % 2 === 0 ? '#fff' : '#f8fafc'

              return (
                <tr key={i} style={{ background: rowBg, borderBottom: '0.5px solid #f0f2f7' }}>
                  <td style={TD({
                    textAlign: 'left', minWidth: 200,
                    color: sys ? '#94a3b8' : isTop ? '#15803d' : isBot ? '#dc2626' : '#1e3a5f',
                    fontWeight: sys ? 400 : 600, fontStyle: sys ? 'italic' : 'normal',
                  })}>
                    {isTop && <span style={{ marginRight: 4 }}>⭐</span>}
                    {isBot && <span style={{ marginRight: 4 }}>⚠</span>}
                    {r.agent_name}
                  </td>
                  <td style={TD({ textAlign: 'left', color: '#6b7280', fontSize: 11 })}>
                    {SUPERVISOR_MAP[r.agent_name] || '—'}
                  </td>
                  <td style={TD()}>{num(r.account_count)}</td>
                  <td style={TD()}>{sar(r.principal_outstanding_sar)}</td>
                  <td style={TD({ color: '#1e3a5f', fontWeight: 600 })}>{sar(r.target_amount_sar)}</td>
                  {isPKT && <td style={TD()}>{sar(r.stable_amount_sar)}</td>}
                  {isPKT && <td style={TD()}>{sar(r.rollforward_amount_sar)}</td>}
                  {isPKT && <td style={TD({ color: '#3b82f6' })}>{r.stable_pct != null ? pct(r.stable_pct * 100) : '—'}</td>}
                  {isPKT && <td style={TD({ color: '#6c63ff' })}>{r.rollforward_pct != null ? pct(r.rollforward_pct * 100) : '—'}</td>}
                  {isNPA && SHOW_ROLLBACK.has(bucket) && (
                    <td style={TD({ color: '#ef4444' })}>{r.rollback_pct != null ? pct(r.rollback_pct * 100) : '—'}</td>
                  )}
                  <td style={TD({ color: '#16a34a', fontWeight: 600 })}>{sar(r.total_collection_sar)}</td>
                  <td style={TD()}>{sarK(r.court_collection_sar)}</td>
                  <td style={TD()}>{sarK(r.discount_amount_sar)}</td>
                  <td style={{ ...TD({ borderRight: 'none' }) }}>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: achBg(rp), color: achColor(rp) }}>
                      {rp != null ? rp.toFixed(1) + '%' : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section 4: Expandable supervisor section ──────────────────────────────────
const SUP_AGENT_COLS = (
  <tr>
    <th style={TH({ textAlign: 'left', minWidth: 200 })}>Agent</th>
    <th style={TH({ textAlign: 'left', minWidth: 150 })}>Bucket</th>
    <th style={TH()}>Accounts</th>
    <th style={TH()}>Overdue (SAR M)</th>
    <th style={TH()}>Target (SAR M)</th>
    <th style={TH()}>Collected (SAR M)</th>
    <th style={TH()}>Court (SAR K)</th>
    <th style={TH()}>Discount (SAR K)</th>
    <th style={{ ...TH({ borderRight: 'none' }) }}>Achievement %</th>
  </tr>
)

function SupervisorSection({ supervisor, agents }) {
  // Group by bucket in BUCKET_ORDER
  const agentsByBucket = {}
  for (const r of agents) {
    if (!agentsByBucket[r.bucket]) agentsByBucket[r.bucket] = []
    agentsByBucket[r.bucket].push(r)
  }
  const orderedBuckets = BUCKET_ORDER.filter(b => agentsByBucket[b]?.length)

  const t = bucketTotals(agents)
  const p = achPct(t.target, t.collected)

  // Top / bottom performers among human agents across all buckets
  const ranked = agents
    .filter(r => !isSystemAgent(r.agent_name))
    .map(r => ({ name: r.agent_name, ach: achPct(r.target_amount_sar, r.total_collection_sar) }))
    .filter(r => r.ach != null)
    .sort((a, b) => b.ach - a.ach)
  const topName = ranked.length     ? ranked[0].name                 : null
  const botName = ranked.length > 1 ? ranked[ranked.length - 1].name : null

  return (
    <div style={{ border: '0.5px solid #2d5080', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
      {/* Supervisor header — visual separator only */}
      <div style={{ padding: '12px 18px', background: '#1e3a5f', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#fff', flex: 1 }}>{supervisor}</span>
        <span style={{ fontSize: 11, color: '#93c5fd' }}>{agents.length} agents</span>
        <span style={{ fontSize: 11, color: '#93c5fd', marginLeft: 14 }}>{num(t.accounts)} accounts</span>
        <span style={{ fontSize: 11, color: '#86efac', marginLeft: 14 }}>{sar(t.overdue)} overdue</span>
        <span style={{ fontSize: 11, color: '#e2e8f0', marginLeft: 14 }}>Target: {sar(t.target)}</span>
        <span style={{ marginLeft: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 12, background: achBg(p), color: achColor(p) }}>
            {p != null ? p.toFixed(1) + '%' : '—'}
          </span>
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>{SUP_AGENT_COLS}</thead>
          <tbody>
            {orderedBuckets.map(bucket => {
              const bRows = agentsByBucket[bucket]
              const bt    = bucketTotals(bRows)
              const bp    = achPct(bt.target, bt.collected)

              return [
                /* Bucket sub-header */
                <tr key={`hdr-${bucket}`} style={{ background: '#243447' }}>
                  <td colSpan={9} style={{ padding: '7px 16px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#2dd4bf' }}>
                      {BUCKET_LABEL[bucket] || bucket}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 12 }}>
                      {num(bt.accounts)} accounts · Target {sar(bt.target)} · Collected {sar(bt.collected)}
                    </span>
                    <span style={{ marginLeft: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: achBg(bp), color: achColor(bp) }}>
                        {bp != null ? bp.toFixed(1) + '%' : '—'}
                      </span>
                    </span>
                  </td>
                </tr>,

                /* Agent rows */
                ...bRows.map((r, i) => {
                  const rp  = achPct(r.target_amount_sar, r.total_collection_sar)
                  const sys = isSystemAgent(r.agent_name)
                  const isTop = !sys && r.agent_name === topName && rp != null
                  const isBot = !sys && r.agent_name === botName  && rp != null && topName !== botName
                  const rowBg = isTop ? '#f0fdf4' : isBot ? '#fef2f2' : i % 2 === 0 ? '#fff' : '#f8fafc'

                  return (
                    <tr key={`${bucket}-${i}`} style={{ background: rowBg, borderBottom: '0.5px solid #f0f2f7' }}>
                      <td style={TD({
                        textAlign: 'left', paddingLeft: 24,
                        color: sys ? '#94a3b8' : isTop ? '#15803d' : isBot ? '#dc2626' : '#1e3a5f',
                        fontWeight: sys ? 400 : 600, fontStyle: sys ? 'italic' : 'normal',
                      })}>
                        {isTop && <span style={{ marginRight: 4 }}>⭐</span>}
                        {isBot && <span style={{ marginRight: 4 }}>⚠</span>}
                        {r.agent_name}
                      </td>
                      <td style={TD({ textAlign: 'left', fontSize: 11, color: '#6b7280' })}>
                        {BUCKET_LABEL[r.bucket] || r.bucket}
                      </td>
                      <td style={TD()}>{num(r.account_count)}</td>
                      <td style={TD()}>{sar(r.principal_outstanding_sar)}</td>
                      <td style={TD({ color: '#1e3a5f', fontWeight: 600 })}>{sar(r.target_amount_sar)}</td>
                      <td style={TD({ color: '#16a34a', fontWeight: 600 })}>{sar(r.total_collection_sar)}</td>
                      <td style={TD()}>{sarK(r.court_collection_sar)}</td>
                      <td style={TD()}>{sarK(r.discount_amount_sar)}</td>
                      <td style={{ ...TD({ borderRight: 'none' }) }}>
                        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: achBg(rp), color: achColor(rp) }}>
                          {rp != null ? rp.toFixed(1) + '%' : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                }),
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SupervisorSummaryTable({ targets }) {
  const SUPERVISORS = ['Amal Hamoud Alotaibi', 'Ahmed Alshammari']

  const supData = SUPERVISORS.map(sup => {
    const agents = targets.filter(r => (SUPERVISOR_MAP[r.agent_name] || '—') === sup)
    return { sup, agents, t: bucketTotals(agents) }
  }).filter(d => d.agents.length)

  if (!supData.length) return null

  const grand = bucketTotals(targets.filter(r => SUPERVISORS.includes(SUPERVISOR_MAP[r.agent_name])))
  const gp    = achPct(grand.target, grand.collected)

  return (
    <div style={{ background: '#fff', border: '0.5px solid #e8eaf0', borderRadius: 12, overflow: 'hidden' }}>
      {/* Section title */}
      <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #e8eaf0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>Supervisor Overview</span>
        <span style={{ fontSize: 11, color: '#888' }}>Click a supervisor to expand agents by bucket</span>
      </div>

      {/* Expandable supervisor sections */}
      <div style={{ padding: '12px' }}>
        {supData.map(({ sup, agents }) => (
          <SupervisorSection key={sup} supervisor={sup} agents={agents} />
        ))}
      </div>

      {/* Grand total — always visible */}
      <div style={{ borderTop: '2px solid #1e3a5f' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            <tr style={{ background: '#1e3a5f' }}>
              <td style={{ ...TD({ textAlign: 'left', fontWeight: 800, color: '#fff', background: '#1e3a5f', minWidth: 200 }) }}>
                Grand Total — Both Supervisors
              </td>
              <td style={{ ...TD({ textAlign: 'left', color: '#94a3b8', background: '#1e3a5f', minWidth: 150 }) }}>All Buckets</td>
              <td style={{ ...TD({ color: '#fff', background: '#1e3a5f', fontWeight: 700 }) }}>{num(grand.accounts)}</td>
              <td style={{ ...TD({ color: '#fff', background: '#1e3a5f' }) }}>{sar(grand.overdue)}</td>
              <td style={{ ...TD({ color: '#93c5fd', background: '#1e3a5f', fontWeight: 700 }) }}>{sar(grand.target)}</td>
              <td style={{ ...TD({ color: '#86efac', background: '#1e3a5f', fontWeight: 700 }) }}>{sar(grand.collected)}</td>
              <td style={{ ...TD({ color: '#e2e8f0', background: '#1e3a5f' }) }}>{sarK(grand.court)}</td>
              <td style={{ ...TD({ color: '#e2e8f0', background: '#1e3a5f' }) }}>{sarK(grand.discount)}</td>
              <td style={{ ...TD({ borderRight: 'none', background: '#1e3a5f' }) }}>
                <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 12, background: achBg(gp), color: achColor(gp) }}>
                  {gp != null ? gp.toFixed(1) + '%' : '—'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AgentPerformancePage() {
  const [period,  setPeriod]  = useState('April-2026')
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAgentTargets({ period })
      .then(d  => { setData(d);           setLoading(false) })
      .catch(e => { setError(e.message);  setLoading(false) })
  }, [period])

  const targets = useMemo(() => data?.targets || [], [data])

  const kpi = useMemo(() => {
    const totAcct  = targets.reduce((s, r) => s + (r.account_count || 0), 0)
    const totOvd   = targets.reduce((s, r) => s + (r.principal_outstanding_sar || 0), 0)
    const totTgt   = targets.reduce((s, r) => s + (r.target_amount_sar || 0), 0)
    const totColl  = targets.reduce((s, r) => s + (r.total_collection_sar || 0), 0)
    const ovAch    = totTgt > 0 ? (totColl / totTgt) * 100 : null
    return { totAcct, totOvd, totTgt, totColl, ovAch }
  }, [targets])

  const bucketGroups = useMemo(() => {
    const g = {}
    for (const r of targets) {
      if (!g[r.bucket]) g[r.bucket] = []
      g[r.bucket].push(r)
    }
    return g
  }, [targets])

  const orderedBuckets = BUCKET_ORDER.filter(b => bucketGroups[b]?.length)
  const periods = data?.periods || ['April-2026', 'March-2026']

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#1e3a5f,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Agent Performance</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>Collection Targets by Bucket &amp; Agent</div>
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6c63ff', background: '#f0eeff', border: '0.5px solid #c4b5fd', borderRadius: 8, padding: '5px 12px' }}>{period}</span>
      </div>

      {/* ── Filter ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Period:</label>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '0.5px solid #e0e3eb', fontSize: 12, fontWeight: 600, background: '#fff', color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 80, color: '#aaa', fontSize: 14 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8eaf0', borderTopColor: '#6c63ff', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          Loading agent targets…
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
      {error && !loading && (
        <div style={{ background: '#fef2f2', border: '0.5px solid #fca5a5', borderRadius: 12, padding: '20px 24px', color: '#dc2626', fontSize: 13 }}>
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── Section 1: KPI Cards ── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiCard label="Total Accounts"       value={kpi.totAcct.toLocaleString()}                sub="All assigned accounts"  color="#1e3a5f" bg="#eff6ff" />
            <KpiCard label="Total Overdue (SAR M)" value={`SAR ${(kpi.totOvd/1e6).toFixed(1)}M`}   sub="Principal outstanding"  color="#dc2626" bg="#fef2f2" />
            <KpiCard label="Total Target (SAR M)"  value={`SAR ${(kpi.totTgt/1e6).toFixed(2)}M`}   sub="Monthly collection target" color="#1e40af" bg="#eff6ff" />
            <KpiCard label="Total Collected (SAR M)" value={`SAR ${(kpi.totColl/1e6).toFixed(2)}M`} sub="MTD total collection"   color="#16a34a" bg="#f0fdf4" />
            <KpiCard
              label="Overall Achievement %"
              value={kpi.ovAch != null ? kpi.ovAch.toFixed(1) + '%' : '—'}
              sub="Collection ÷ Target"
              color={achColor(kpi.ovAch)}
              bg={achBg(kpi.ovAch)}
            />
          </div>

          {/* ── Section 2: Bucket Summary Table ── */}
          <BucketSummaryTable bucketGroups={bucketGroups} period={period} />

          {/* ── Section 3: Agent Details by Bucket ── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>Agent Details by Bucket</span>
              <span style={{ fontSize: 11, color: '#888' }}>Click a bucket to expand agents</span>
            </div>
            {orderedBuckets.map(b => (
              <BucketSection key={b} bucket={b} rows={bucketGroups[b]} />
            ))}
          </div>

          {/* ── Section 4: Supervisor Summary ── */}
          <SupervisorSummaryTable targets={targets} />
        </>
      )}
    </div>
  )
}
