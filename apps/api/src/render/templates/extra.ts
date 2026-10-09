import {
  amountDue,
  contactBits,
  esc,
  extras,
  flourishCss,
  fmtMoney,
  footer,
  infoStack,
  itemsTable,
  logo,
  metaPairs,
  metaRows,
  multi,
  onAccent,
  partyLines,
  RenderDoc,
  RenderOptions,
  signature,
  stamp,
  thanks,
  tint,
  titleOf,
  totals,
} from './shared';

/**
 * Sixteen more layouts. Every one takes the business's accent colour, logo and wording,
 * so a single layout covers many colour variants.
 */

type Out = { css: string; body: string };

const billLabel = (d: RenderDoc) =>
  d.type === 'RECEIPT' ? 'Received from' : 'Bill to';
const upper = (d: RenderDoc) => titleOf(d.type).toUpperCase();

/** One-line contact strip: "phone · email · address" */
const contactLine = (d: RenderDoc, sep = ' · ') =>
  [d.from.phone, d.from.email, d.from.address?.replace(/\n/g, ', ')]
    .filter(Boolean)
    .map(esc)
    .join(sep);

// ───────────────────────── 1. Wave — bold title, sweeping shapes at the foot ─────────────────────────
export function wave(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    ${flourishCss(a)}
    .page { padding-bottom: 220px; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; }
    .top .no { font-weight: 700; letter-spacing: .06em; }
    h1 { font-size: 62px; font-weight: 800; letter-spacing: -.02em; line-height: 1; margin: 30px 0 10px; }
    .date { font-weight: 700; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 28px; }
    table.items thead tr { background: #e9ecf1; }
    table.items th { color: #0b1529; }
    .t-total { border-top: 2px solid #0b1529; }
    .waves { position: absolute; left: 0; right: 0; bottom: 0; height: 200px; }
    .foot { bottom: 210px; }
  `;
  const svg = `<svg class="waves" viewBox="0 0 794 200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 70 C 160 20, 300 150, 520 120 S 760 40, 794 60 L794 200 L0 200 Z" fill="#d6dae1"/>
      <path d="M0 140 C 200 90, 420 170, 600 140 S 760 60, 794 30 L794 200 L0 200 Z" fill="${a}"/>
    </svg>`;
  return {
    css,
    body: `<div class="top">${logo(d)}<div class="no">NO. ${esc(d.number)}</div></div>
    <h1>${upper(d)}</h1>
    <div class="date">${metaRows(d)
      .slice(1)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' &nbsp;·&nbsp; ')}</div>
    <div class="cols">
      <div><div class="label">${billLabel(d)}</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div><div class="label">From</div>${partyLines(d.from, d.taxIdLabel)}</div>
    </div>
    ${itemsTable(d)}${totals(d)}${extras(d)}${stamp(d)}${footer(d, opts)}${svg}`,
  };
}

// ───────────────────────── 2. Corners — geometric triangles, boxed table ─────────────────────────
export function corners(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    ${flourishCss(a)}
    .tri-tr { position: absolute; top: 0; right: 0; width: 230px; height: 230px; }
    .tri-bl { position: absolute; bottom: 0; left: 0; width: 230px; height: 200px; }
    h1 { font-size: 44px; font-weight: 700; letter-spacing: .14em; margin-top: 28px; }
    .head { display: flex; align-items: center; gap: 16px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 30px; max-width: 560px; }
    .mp { display: block; margin-bottom: 6px; } .mk { display: block; font-weight: 700; letter-spacing: .04em; } .mv { color: #3f4a5e; }
    table.items { border: 1.5px solid #3f4a5e; }
    table.items th { background: #e9ecf1; color: #0b1529; border: 1.5px solid #3f4a5e; }
    table.items td { border-left: 1.5px solid #3f4a5e; border-right: 1.5px solid #3f4a5e; border-bottom: 1px solid #d3dae6; }
    table.items tbody tr:last-child td { padding-bottom: 60px; }
    .totals { margin-top: 0; width: 100%; border: 1.5px solid #3f4a5e; border-top: 0; }
    .t-row { justify-content: flex-end; gap: 40px; }
    .t-total { font-size: 15px; letter-spacing: .06em; }
    .bottom { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; }
    .extras { margin-top: 24px; }
    .foot { left: 260px; }
  `;
  return {
    css,
    body: `<svg class="tri-tr" viewBox="0 0 230 230"><polygon points="70,0 230,0 230,160" fill="${tint(a, 0.35)}"/><polygon points="120,40 230,150 230,40" fill="${a}"/></svg>
    <svg class="tri-bl" viewBox="0 0 230 200"><polygon points="0,60 0,200 120,200" fill="${a}"/><polygon points="40,200 130,110 220,200" fill="${tint(a, 0.35)}"/></svg>
    <div class="head">${d.from.logo ? logo(d) : ''}</div>
    <h1>${upper(d)}</h1>
    <div class="cols">
      <div>${metaPairs(d)}</div>
      <div><div class="mk">Issued to:</div>${partyLines(d.to, d.taxIdLabel)}</div>
    </div>
    ${itemsTable(d)}${totals(d)}
    <div class="bottom"><div style="max-width:60%">${infoStack(d)}</div>${signature(d, 'Manager')}</div>
    ${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 3. Gratitude — warm paper, script heading, footer band ─────────────────────────
export function gratitude(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    ${flourishCss(a)}
    body, .page { background: #f7f3ee; }
    .page { font-family: 'Instrument Serif', Georgia, serif; font-size: 14.5px; padding-bottom: 120px; }
    .script { font-family: 'Script', cursive; font-size: 64px; color: ${a}; line-height: 1; }
    .title { text-align: right; text-transform: uppercase; letter-spacing: .12em; font-size: 15px; margin-top: 14px; }
    .title small { display: block; font-size: 13px; letter-spacing: .04em; text-transform: none; color: #3f4a5e; }
    .to { margin-top: 20px; }
    table.items th { font-family: 'Manrope', sans-serif; border-top: 1px solid #0b1529; border-bottom: 1px solid #0b1529; color: #0b1529; }
    table.items td { border-bottom: 0; padding-top: 14px; padding-bottom: 14px; }
    table.items { border-bottom: 1px solid #0b1529; }
    .t-total { font-weight: 400; font-size: 18px; }
    .box { background: transparent; padding-left: 0; } .box.pay { background: transparent; }
    .band { position: absolute; left: 56px; right: 56px; bottom: 44px; background: ${a}; color: ${onAccent(a)}; text-align: center; padding: 14px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; font-family: 'Manrope', sans-serif; }
    .mp { display: flex; justify-content: flex-end; gap: 14px; } .mk { color: #3f4a5e; }
    .foot { display: none; }
  `;
  return {
    css,
    body: `<div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div class="script">With gratitude</div>${d.from.logo ? logo(d) : ''}</div>
    <div class="title">${titleOf(d.type)} · ${esc(d.from.name)}<small>#${esc(d.number)}</small></div>
    <div style="display:flex;justify-content:space-between;margin-top:16px">
      <div class="to"><div class="label">${billLabel(d)}</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div style="text-align:right">${metaPairs(d)}</div>
    </div>
    ${itemsTable(d)}${totals(d)}${extras(d)}${stamp(d)}
    <div class="band">${contactLine(d, ' &nbsp;•&nbsp; ') || esc(d.from.name)}</div>${footer(d, opts)}`,
  };
}

// ───────────────────────── 4. Vivid — tinted page, big accent title, grid table ─────────────────────────
export function vivid(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    ${flourishCss(a)}
    body, .page { background: ${tint(a, 0.13)}; }
    .meta-top { font-size: 11.5px; color: #3f4a5e; }
    h1 { font-size: 58px; font-weight: 800; color: ${a}; letter-spacing: -.02em; line-height: 1; margin-top: 6px; }
    .row { display: flex; justify-content: space-between; gap: 24px; }
    .brand { text-align: right; font-weight: 800; color: ${a}; }
    .brand .logo, .brand .logo-fallback { margin-left: auto; margin-top: 6px; }
    .thank { font-weight: 800; color: ${a}; font-size: 15px; margin-top: 26px; }
    table.items { border: 1.5px solid ${a}; }
    table.items th { background: ${a}; color: ${onAccent(a)}; text-align: center; }
    table.items td { border: 1px solid ${tint(a, 0.45)}; background: rgba(255,255,255,.55); }
    .totals { width: 320px; border: 1px solid ${tint(a, 0.45)}; border-top: 0; margin-top: 0; background: rgba(255,255,255,.55); }
    .t-row { border-bottom: 1px solid ${tint(a, 0.3)}; }
    .t-total { color: ${a}; }
    .box, .box.pay { background: rgba(255,255,255,.6); }
    .bottom { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; }
  `;
  return {
    css,
    body: `<div class="row">
      <div><div class="meta-top">No. ${esc(d.number)} | ${metaRows(d)[1][1]}</div><h1>${upper(d)}</h1></div>
      <div class="brand">${esc(d.from.name)}${logo(d)}</div>
    </div>
    <div class="row" style="margin-top:22px">
      <div style="max-width:52%"><div class="thank">Thank you for your business!</div>
        ${d.notes ? `<div style="margin-top:8px;color:#3f4a5e">${multi(d.notes)}</div>` : ''}</div>
      <div><div class="label" style="color:${a}">${billLabel(d)}:</div>${partyLines(d.to, d.taxIdLabel)}
        ${d.dueDate && d.type !== 'RECEIPT' ? `<div class="label" style="color:${a};margin-top:12px">${d.type === 'QUOTE' ? 'Valid until' : 'Due date'}:</div><div>${metaRows(d)[2]?.[1] ?? ''}</div>` : ''}</div>
    </div>
    ${itemsTable(d)}${totals(d)}
    <div class="bottom"><div style="font-size:12px;color:#3f4a5e">${partyLines({ ...d.from, name: '' }, d.taxIdLabel)}</div>${signature(d, 'Signature')}</div>
    ${d.paymentInfo || d.terms ? extras({ ...d, notes: null }) : ''}${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 5. Ribbon — curved colour header ─────────────────────────
export function ribbon(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const on = onAccent(a);
  const css = `
    ${flourishCss(a)}
    .page { padding-top: 0; }
    .hdr { position: relative; margin: 0 -56px; height: 190px; color: ${on}; }
    .hdr svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .hdr .in { position: relative; display: flex; justify-content: space-between; align-items: center; padding: 48px 56px 0; }
    .hdr h1 { font-size: 44px; font-weight: 800; letter-spacing: .04em; }
    .hdr .no { font-weight: 700; font-size: 15px; }
    .hdr .logo-fallback { background: ${on}; color: ${a}; }
    .hdr img.logo { background: #fff; border-radius: 10px; padding: 6px; }
    .cols { display: flex; justify-content: space-between; margin-top: 10px; }
    .cols .right { text-align: right; }
    .p-name { font-size: 17px; }
    table.items th { background: ${a}; color: ${on}; }
    table.items td { border: 1px solid #c3cad6; }
    .t-total { background: ${a}; color: ${on}; border-radius: 0; }
    .bottom { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 34px; }
  `;
  return {
    css,
    body: `<div class="hdr"><svg viewBox="0 0 794 190" preserveAspectRatio="none"><path d="M0 0 H794 V120 C 600 200, 420 90, 220 150 S 40 170, 0 160 Z" fill="${a}"/><path d="M0 160 C 120 190, 260 120, 420 150" stroke="${tint(a, 0.5)}" stroke-width="10" fill="none"/></svg>
      <div class="in"><div style="display:flex;align-items:center;gap:16px">${logo(d)}<h1>${upper(d)}</h1></div><div class="no">NO: ${esc(d.number)}</div></div></div>
    <div class="cols">
      <div><div class="label">${billLabel(d)}:</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div class="right"><div class="label">From:</div>${partyLines(d.from, d.taxIdLabel)}</div>
    </div>
    <div style="margin-top:18px;font-size:14px">${metaRows(d)
      .slice(1)
      .map(([k, v]) => `${k}: <b>${v}</b>`)
      .join(' &nbsp;&nbsp; ')}</div>
    ${itemsTable(d)}${totals(d)}
    <div class="bottom"><div style="max-width:55%">${infoStack(d)}</div>${thanks('Thank you!')}</div>
    ${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 6. Stripes — diagonal geometric bands ─────────────────────────
export function stripes(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    .geo-tl { position: absolute; top: 0; left: 0; width: 260px; height: 200px; }
    .geo-br { position: absolute; bottom: 0; right: 0; width: 220px; height: 120px; }
    .right { text-align: right; }
    .bname { font-size: 30px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; margin-top: 10px; }
    .t { font-size: 20px; font-weight: 800; letter-spacing: .2em; margin-top: 18px; }
    .no { font-size: 24px; color: #3f4a5e; letter-spacing: .06em; }
    .grid2 { display: grid; grid-template-columns: 110px 1fr; gap: 6px 16px; margin-top: 34px; max-width: 520px; }
    .grid2 .k { font-weight: 800; letter-spacing: .1em; text-transform: uppercase; font-size: 11.5px; color: #0b1529; }
    table.items thead tr { background: #1f2a44; }
    table.items th { color: #fff; letter-spacing: .12em; }
    table.items td { color: #3f4a5e; }
    .t-total { border-top: 2px solid #1f2a44; letter-spacing: .1em; text-transform: uppercase; }
    .extras { grid-template-columns: 1fr; max-width: 70%; }
    .box, .box.pay { background: transparent; padding-left: 0; }
    .foot { right: 250px; }
  `;
  return {
    css,
    body: `<svg class="geo-tl" viewBox="0 0 260 200"><polygon points="0,0 90,0 0,90" fill="#1f2a44"/><polygon points="30,0 150,0 0,150 0,120" fill="${a}"/><polygon points="120,0 160,0 40,200 0,200 0,190" fill="${tint(a, 0.55)}"/><polygon points="0,30 60,90 60,200 0,200" fill="${tint(a, 0.8)}"/></svg>
    <svg class="geo-br" viewBox="0 0 220 120"><polygon points="220,0 220,120 40,120" fill="${a}"/><polygon points="220,40 220,120 120,120" fill="#1f2a44"/><polygon points="160,120 220,60 220,75 175,120" fill="#fff"/></svg>
    <div class="right">${d.from.logo ? `<div style="display:flex;justify-content:flex-end">${logo(d)}</div>` : ''}
      <div class="bname">${esc(d.from.name)}</div><div class="t">${upper(d)}</div><div class="no">#${esc(d.number)}</div></div>
    <div class="grid2">
      <div class="k">${billLabel(d)}:</div><div>${partyLines(d.to, d.taxIdLabel)}</div>
      ${metaRows(d)
        .slice(1)
        .map(([k, v]) => `<div class="k">${k}:</div><div>${v}</div>`)
        .join('')}
    </div>
    ${itemsTable(d)}${totals(d)}${extras(d)}${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 7. Statement — summary panel across the foot ─────────────────────────
export function statement(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    .page { padding-bottom: 300px; }
    .head { display: flex; align-items: center; gap: 16px; }
    .head h1 { font-size: 22px; font-weight: 800; letter-spacing: .12em; }
    .cols { display: flex; justify-content: space-between; margin-top: 56px; }
    .client { font-size: 20px; font-weight: 600; }
    .meta { margin-top: 10px; font-size: 12px; color: #3f4a5e; } .meta b { color: #0b1529; }
    .from { text-align: right; font-size: 12.5px; color: #3f4a5e; }
    table.items { margin-top: 44px; }
    table.items th { color: #3f4a5e; border-bottom: 1px solid #0b1529; }
    table.items td { font-weight: 600; border-bottom: 0; }
    table.items td.c-amt { color: ${a}; }
    .panel { position: absolute; left: 0; right: 0; bottom: 0; height: 260px; background: #e4e1dc; padding: 40px 56px; }
    .panel .grid3 { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 24px; border-top: 1px solid #b9b4ad; border-bottom: 1px solid #b9b4ad; padding: 16px 0; align-items: end; }
    .panel .big { font-size: 28px; font-weight: 500; }
    .panel .due { font-size: 26px; font-weight: 800; color: ${a}; text-align: right; white-space: nowrap; }
    .panel .label { color: #5f6878; }
    .panel .thx { display: flex; justify-content: space-between; margin-top: 22px; font-size: 15px; }
    .panel .thx span:first-child::before { content: '♥ '; color: ${a}; }
    .totals { margin-top: 10px; }
    .foot { display: none; }
  `;
  const rows = metaRows(d);
  const due = rows.find(([k]) => k === 'Due date' || k === 'Valid until');
  return {
    css,
    body: `<div class="head">${logo(d)}<h1>${upper(d)}</h1></div>
    <div class="cols">
      <div><div class="client">${esc(d.to.name)}</div>
        <div class="meta">${rows
          .filter(([k]) => k !== 'Due date' && k !== 'Valid until')
          .map(([k, v]) => `${k}: <b>${v}</b>`)
          .join('<br>')}</div>
        <div class="meta">${partyLines({ ...d.to, name: '' }, d.taxIdLabel)}</div></div>
      <div class="from">${partyLines(d.from, d.taxIdLabel)}</div>
    </div>
    ${itemsTable(d)}${totals(d)}
    ${d.notes || d.terms ? `<div style="margin-top:20px;font-size:12px;color:#3f4a5e">${multi([d.notes, d.terms].filter(Boolean).join('\n'))}</div>` : ''}
    <div class="panel">
      <div class="grid3">
        <div><div class="label">${d.type === 'RECEIPT' ? 'Paid by' : 'Payment info'}</div><div style="font-size:12px">${d.type === 'RECEIPT' ? esc(d.paymentMethod ?? '') : multi(d.paymentInfo ?? '—')}</div></div>
        <div><div class="label">${due ? due[0] : 'Date'}</div><div class="big">${due ? due[1] : rows[1][1]}</div></div>
        <div><div class="label" style="text-align:right">${d.type === 'RECEIPT' ? 'Amount paid' : 'Total due'}</div><div class="due">${amountDue(d)}</div></div>
      </div>
      <div class="thx"><span>Thank you!</span><span style="font-size:11px;color:#5f6878">${contactLine(d, ' | ')}</span></div>
    </div>${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 8. Monogram — centred initial, soft tinted bars ─────────────────────────
export function monogram(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    ${flourishCss('#0b1529')}
    .center { text-align: center; }
    .mono { width: 76px; height: 76px; border-radius: 50%; background: ${tint(a, 0.25)}; color: #0b1529; font-family: 'Script', cursive; font-size: 40px; display: inline-flex; align-items: center; justify-content: center; }
    .center .logo { margin: 0 auto; }
    .bname { font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: .28em; font-size: 20px; margin-top: 12px; text-transform: uppercase; }
    .cols { display: flex; justify-content: space-between; margin-top: 56px; font-size: 12.5px; }
    .mp { display: flex; gap: 18px; justify-content: space-between; } .mk { font-weight: 800; letter-spacing: .06em; text-transform: uppercase; font-size: 11px; }
    table.items thead tr { background: ${tint(a, 0.22)}; }
    table.items th { color: #0b1529; letter-spacing: .1em; }
    table.items td { border-bottom: 0; padding-top: 8px; padding-bottom: 8px; }
    table.items .c-no { display: none; }
    .totals { width: 100%; }
    .t-total { background: ${tint(a, 0.22)}; justify-content: flex-end; gap: 60px; letter-spacing: .1em; text-transform: uppercase; }
    .bottom { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; }
  `;
  const initial = esc((d.from.name || '?').trim().charAt(0).toLowerCase());
  return {
    css,
    body: `<div class="center">${d.from.logo ? logo(d) : `<span class="mono">${initial}</span>`}<div class="bname">${esc(d.from.name)}</div></div>
    <div class="cols">
      <div><div class="mk">${billLabel(d)}:</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div>${metaPairs(d)}</div>
    </div>
    ${itemsTable(d)}${totals(d)}
    <div class="bottom"><div style="max-width:58%">${infoStack(d)}</div>${signature(d, 'Thank you')}</div>
    ${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 9. Ledger — typewriter type, ruled grid ─────────────────────────
export function ledger(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    ${flourishCss('#0b1529')}
    .page { font-family: 'Mono', monospace; font-size: 12.5px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; }
    h1 { font-size: 30px; font-weight: 700; letter-spacing: .12em; }
    .sub { margin-top: 10px; line-height: 1.7; }
    .head .right { text-align: center; font-weight: 700; letter-spacing: .1em; }
    .head .right .logo, .head .right .logo-fallback { margin: 0 auto 8px; }
    table.items { border: 2px solid #0b1529; margin-top: 40px; }
    table.items th { border: 1.5px solid #0b1529; color: #0b1529; font-family: 'Mono', monospace; }
    table.items td { border-left: 1.5px solid #0b1529; border-right: 1.5px solid #0b1529; border-bottom: 1px solid #c3cad6; text-transform: uppercase; }
    table.items .c-no { display: none; }
    .totals { width: 100%; margin-top: 0; border: 2px solid #0b1529; border-top: 0; }
    .t-row { justify-content: flex-end; gap: 30px; font-weight: 700; }
    .t-total { border-top: 1.5px solid #0b1529; font-size: 15px; }
    .t-total span:last-child { color: ${a}; }
    .bottom { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
    .info .label { font-family: 'Mono', monospace; color: #0b1529; }
    .info { margin-bottom: 12px; }
  `;
  return {
    css,
    body: `<div class="head">
      <div><h1>${upper(d)}</h1><div class="sub">${titleOf(d.type)} no: ${esc(d.number)}<br>${esc(billLabel(d))}: ${esc(d.to.name)}${metaRows(
        d,
      )
        .slice(1)
        .map(([k, v]) => `<br>${k}: ${v}`)
        .join('')}</div></div>
      <div class="right">${logo(d)}${esc(d.from.name).toUpperCase()}</div>
    </div>
    ${itemsTable(d)}${totals(d)}
    <div class="bottom"><div style="max-width:58%">${infoStack(d)}</div>${signature(d, 'Signed')}</div>
    ${stamp(d)}${footer(d, opts)}`,
  };
}

export function headline(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    body, .page { background: #f8f5ec; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #0b1529; padding-bottom: 18px; }
    h1 { font-size: 92px; font-weight: 800; letter-spacing: -.04em; line-height: .9; }
    .head .meta { text-align: right; font-size: 12px; } .head .meta b { display: block; }
    .to { margin-top: 26px; padding-bottom: 22px; border-bottom: 1px solid #0b1529; }
    table.items { margin-top: 60px; }
    table.items th { border-bottom: 1px solid #0b1529; color: #0b1529; text-transform: none; letter-spacing: 0; font-size: 12.5px; }
    table.items td { border-bottom: 1px solid #d9d4c7; }
    table.items .c-no { display: none; }
    .t-total { border-top: 1px solid #0b1529; }
    .t-total span:last-child { color: ${a}; }
    .footgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; border-top: 1px solid #0b1529; border-bottom: 1px solid #0b1529; padding: 16px 0; margin-top: 60px; font-size: 12px; }
  `;
  return {
    css,
    body: `<div class="head"><h1>${titleOf(d.type)}</h1><div class="meta">${metaRows(
      d,
    )
      .slice(1)
      .map(([, v]) => v)
      .join('<br>')}<b>${titleOf(d.type)} No. ${esc(d.number)}</b></div></div>
    <div class="to"><div class="label">${billLabel(d)}:</div>${partyLines(d.to, d.taxIdLabel)}</div>
    ${itemsTable(d)}${totals(d)}
    <div class="footgrid">
      <div><div class="label">${d.type === 'RECEIPT' ? 'Notes' : 'Payment information'}</div>${multi(d.type === 'RECEIPT' ? (d.notes ?? '') : (d.paymentInfo ?? d.notes ?? ''))}</div>
      <div><div class="label">${esc(d.from.name)}</div>${partyLines({ ...d.from, name: '' }, d.taxIdLabel)}</div>
    </div>
    ${d.terms ? `<div style="margin-top:14px;font-size:12px;color:#3f4a5e">${multi(d.terms)}</div>` : ''}${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 11. Frame — accent spine on the left, top bar ─────────────────────────
export function frame(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    .page { padding-left: 96px; }
    .spine { position: absolute; top: 0; bottom: 0; left: 0; width: 44px; background: ${tint(a, 0.85)}; }
    .spine::after { content: ''; position: absolute; top: 100px; left: 44px; border-left: 18px solid ${tint(a, 0.85)}; border-top: 22px solid transparent; border-bottom: 22px solid transparent; }
    .bar { position: absolute; top: 0; left: 44px; right: 0; height: 22px; background: #1f2a44; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 18px; }
    h1 { font-size: 46px; font-weight: 800; letter-spacing: -.01em; line-height: 1; }
    .no { color: ${a}; font-weight: 800; font-size: 18px; text-align: right; }
    .who { display: grid; grid-template-columns: 180px 1fr; gap: 8px 20px; margin-top: 34px; }
    .who .k { font-weight: 800; font-size: 15px; text-transform: uppercase; }
    table.items th { border-bottom: 2px solid #0b1529; color: #0b1529; text-transform: none; font-size: 12.5px; letter-spacing: 0; }
    table.items .c-no { display: none; }
    .split { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start; }
    .split .totals { margin-top: 18px; }
    .t-total { border-top: 1.5px solid #0b1529; }
    .big { font-size: 18px; font-weight: 800; text-transform: uppercase; margin-top: 18px; }
    .contacts { position: absolute; left: 96px; right: 56px; bottom: 50px; display: flex; gap: 26px; font-size: 11px; color: #3f4a5e; }
    .contacts span::before { content: '●'; color: ${a}; margin-right: 6px; }
    .foot { display: none; }
  `;
  return {
    css,
    body: `<div class="spine"></div><div class="bar"></div>
    <div class="head"><div><h1>${upper(d)}</h1><div style="margin-top:8px;font-weight:700">${esc(d.from.name)}</div></div>
      <div><div class="no">${upper(d)} #${esc(d.number)}</div><div style="text-align:right;font-size:12px">${metaRows(
        d,
      )
        .slice(1)
        .map(([k, v]) => `${k}: ${v}`)
        .join('<br>')}</div></div></div>
    <div class="who"><div class="k">${billLabel(d)}</div><div>${partyLines(d.to, d.taxIdLabel)}</div></div>
    ${itemsTable(d)}
    <div class="split"><div class="big">Thank you!</div>${totals(d)}</div>
    <div style="margin-top:26px">${infoStack(d)}</div>
    <div class="contacts">${contactBits(d.from)
      .map((c) => `<span>${c.v.replace(/<br>/g, ', ')}</span>`)
      .join('')}</div>${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 12. Noir — black header and footer, accent title ─────────────────────────
export function noir(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const css = `
    ${flourishCss('#0b1529')}
    .page { padding-top: 0; padding-bottom: 110px; }
    .hdr { margin: 0 -56px; background: #111318; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 30px 56px; }
    .hdr h1 { color: ${a}; font-size: 38px; font-weight: 800; letter-spacing: .14em; }
    .hdr .logo-fallback { background: ${a}; color: ${onAccent(a)}; }
    .hdr img.logo { background: #fff; border-radius: 10px; padding: 6px; }
    .cols { display: flex; justify-content: space-between; gap: 30px; margin-top: 30px; font-family: 'Instrument Serif', Georgia, serif; font-size: 15px; }
    .cols .label { font-family: 'Manrope', sans-serif; color: #0b1529; }
    table.items { border: 1.5px solid #3f4a5e; }
    table.items th { background: #e9ecf1; color: #0b1529; border: 1px solid #3f4a5e; }
    table.items td { border: 1px solid #c3cad6; }
    .totals { border: 1px solid #c3cad6; border-top: 0; margin-top: 0; }
    .t-row { border-bottom: 1px solid #c3cad6; }
    .t-total { background: #e9ecf1; }
    .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
    .signs div { border-top: 1px solid #0b1529; padding-top: 6px; text-align: center; font-size: 11.5px; color: #3f4a5e; }
    .bar { position: absolute; left: 0; right: 0; bottom: 0; background: #111318; color: #fff; display: flex; justify-content: center; gap: 30px; padding: 16px 56px 46px; font-size: 11px; border-top: 4px solid ${a}; }
    .foot { display: none; }
  `;
  return {
    css,
    body: `<div class="hdr">${logo(d)}<h1>${upper(d)}</h1></div>
    <div class="cols">
      <div>${metaRows(d)
        .map(([k, v]) => `${k}: ${v}`)
        .join(
          '<br>',
        )}<div class="label" style="margin-top:14px">${billLabel(d)}</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div style="text-align:right;max-width:46%">${d.terms ? `<div class="label">Special instructions</div>${multi(d.terms)}` : partyLines(d.from, d.taxIdLabel)}</div>
    </div>
    ${itemsTable(d)}${totals(d)}${extras({ ...d, terms: null })}
    ${d.type === 'QUOTE' ? `<div class="signs"><div>Signature over printed name</div><div>Date signed</div></div>` : ''}
    ${stamp(d)}
    <div class="bar">${contactBits(d.from)
      .map((c) => `<span>${c.v.replace(/<br>/g, ', ')}</span>`)
      .join('')}</div>${footer(d, opts)}`,
  };
}

// ───────────────────────── 13. Corporate — contact row, highlighted total column ─────────────────────────
export function corporate(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const on = onAccent(a);
  const css = `
    ${flourishCss('#0b1529')}
    .top { display: flex; justify-content: space-between; align-items: flex-start; }
    .bn { font-family: 'Montserrat', sans-serif; font-weight: 800; letter-spacing: .04em; margin-top: 6px; text-transform: uppercase; font-size: 13px; }
    .contacts { display: flex; gap: 26px; font-size: 11px; color: #3f4a5e; }
    .contacts .k { display: block; font-weight: 800; color: #0b1529; font-size: 11.5px; }
    .contacts .k::before { content: ''; display: inline-block; width: 9px; height: 9px; border: 2px solid ${a}; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
    .mid { display: flex; justify-content: space-between; margin-top: 50px; }
    .mid .k { color: ${a}; font-weight: 700; }
    h1 { font-family: 'Montserrat', sans-serif; font-size: 40px; font-weight: 800; color: ${a}; letter-spacing: .02em; line-height: 1; }
    .chip { display: inline-block; background: #111318; color: #fff; font-size: 11px; padding: 2px 10px; margin-top: 4px; }
    .facts { display: flex; gap: 28px; margin-top: 12px; font-size: 11.5px; } .facts b { display: block; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
    table.items { margin: 34px -56px 0; width: calc(100% + 112px); }
    table.items thead tr { background: #111318; }
    table.items th { color: #fff; padding-top: 14px; padding-bottom: 14px; }
    table.items th:first-child, table.items td:first-child { padding-left: 56px; }
    table.items th:last-child, table.items td:last-child { padding-right: 56px; }
    table.items th.c-desc, table.items td.c-desc { background: #eceef2; }
    table.items th.c-desc { background: #111318; }
    table.items td.c-amt, table.items th:last-child { background: ${a}; color: ${on}; }
    table.items td { border-bottom: 1px solid #c3cad6; }
    .lower { display: grid; grid-template-columns: 1fr 300px; gap: 30px; margin-top: 20px; }
    .lower .totals { margin-top: 0; width: 100%; }
    .t-total { background: #e3e6eb; border-radius: 0; }
    .end { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
    .end .bye { font-family: 'Montserrat', sans-serif; font-weight: 800; letter-spacing: .1em; text-decoration: underline; font-size: 15px; }
  `;
  return {
    css,
    body: `<div class="top"><div>${logo(d)}<div class="bn">${esc(d.from.name)}</div></div>
      <div class="contacts">${contactBits(d.from)
        .map((c) => `<div><span class="k">${c.k}</span>${c.v}</div>`)
        .join('')}</div></div>
    <div class="mid">
      <div><div class="label" style="color:#0b1529">${billLabel(d)},</div><div class="k">${esc(d.to.name)}</div>${partyLines({ ...d.to, name: '' }, d.taxIdLabel)}</div>
      <div><h1>${upper(d)}</h1><div class="chip">${titleOf(d.type)} No: ${esc(d.number)}</div>
        <div class="facts">${metaRows(d)
          .slice(1, 3)
          .map(([k, v]) => `<div><b>${k}</b>${v}</div>`)
          .join(
            '',
          )}<div><b>${d.type === 'RECEIPT' ? 'Paid' : 'Total due'}</b>${amountDue(d)}</div></div></div>
    </div>
    ${itemsTable(d)}
    <div class="lower"><div>${infoStack(d)}</div>${totals(d)}</div>
    <div class="end"><div class="bye">Thanks for being with us!</div>${signature(d, 'Account manager')}</div>
    ${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 14. Executive — dark top band, shaded number columns ─────────────────────────
export function executive(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const on = onAccent(a);
  const css = `
    .page { padding-top: 0; }
    .band { margin: 0 -56px; background: #3a3d44; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 34px 56px; border-bottom: 5px solid ${a}; }
    .band h1 { font-size: 46px; font-weight: 800; letter-spacing: .04em; }
    .band .brand { display: flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 700; }
    .band .logo-fallback { background: transparent; border: 3px solid ${a}; color: ${a}; }
    .band img.logo { background: #fff; border-radius: 10px; padding: 6px; }
    .cols { display: flex; justify-content: space-between; margin-top: 36px; }
    .cols h3 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .mp { display: grid; grid-template-columns: 100px auto; } .mk { color: #3f4a5e; }
    table.items thead tr { background: ${a}; }
    table.items th { color: ${on}; }
    table.items td:nth-child(n+4), table.items td.c-no { background: #e3e6eb; }
    table.items td { border-bottom: 2px solid #fff; }
    .lower { display: grid; grid-template-columns: 1fr 300px; gap: 30px; margin-top: 18px; }
    .lower .totals { margin-top: 0; width: 100%; }
    .t-total { border-top: 1.5px solid #0b1529; }
    .auth { margin-top: 50px; display: flex; justify-content: flex-end; }
    .auth div { border-top: 1px solid #0b1529; padding-top: 6px; width: 200px; text-align: center; font-weight: 700; font-size: 12px; }
  `;
  return {
    css,
    body: `<div class="band"><div class="brand">${logo(d)}${esc(d.from.name)}</div><h1>${upper(d)}</h1></div>
    <div class="cols">
      <div><h3>${billLabel(d)}:</h3>${partyLines(d.to, d.taxIdLabel)}</div>
      <div><h3>${titleOf(d.type)} details</h3>${metaPairs(d)}</div>
    </div>
    ${itemsTable(d)}
    <div class="lower"><div><div style="font-weight:700;font-size:15px;margin-bottom:14px">Thank you for your business</div>${infoStack(d)}</div>${totals(d)}</div>
    <div class="auth"><div>Authorised signature</div></div>
    ${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 15. Capsule — rounded pill headers ─────────────────────────
export function capsule(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const on = onAccent(a);
  const css = `
    ${flourishCss('#0b1529')}
    .top { display: flex; justify-content: space-between; align-items: flex-start; }
    .pill { display: inline-flex; align-items: stretch; border-radius: 0 18px 18px 18px; overflow: hidden; font-weight: 800; font-size: 22px; letter-spacing: .06em; }
    .pill .plus { background: #111318; color: #fff; padding: 4px 14px; border-radius: 18px 0 0 18px; }
    .pill .t { background: ${a}; color: ${on}; padding: 4px 22px 4px 14px; border-radius: 0 18px 18px 0; }
    .brand { text-align: right; } .brand .logo, .brand .logo-fallback { margin-left: auto; }
    .bn { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 17px; text-transform: uppercase; margin-top: 6px; }
    .cols { display: flex; justify-content: space-between; margin-top: 40px; }
    .info-h { font-weight: 800; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 6px; }
    .mp { display: grid; grid-template-columns: 110px auto; } .mk { color: #3f4a5e; }
    table.items { border-collapse: separate; border-spacing: 0; }
    table.items th { background: ${a}; color: ${on}; }
    table.items th:first-child { background: #111318; color: #fff; border-radius: 16px 0 0 16px; }
    table.items th:last-child { background: #111318; color: #fff; border-radius: 0 16px 16px 0; }
    table.items td { border-bottom: 1px solid #c3cad6; }
    table.items td.c-no { border-right: 1px solid #c3cad6; }
    .t-total { background: ${a}; color: ${on}; border-radius: 18px; border-left: 26px solid #111318; }
    .bottom { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
    .bye { font-weight: 800; letter-spacing: .04em; text-transform: uppercase; margin-top: 24px; padding-top: 10px; border-top: 2px solid ${a}; display: inline-block; }
  `;
  return {
    css,
    body: `<div class="top"><div class="pill"><span class="plus">+</span><span class="t">${upper(d)}</span></div>
      <div class="brand">${logo(d)}<div class="bn">${esc(d.from.name)}</div></div></div>
    <div class="cols">
      <div><div class="info-h">To.</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div><div class="info-h">${titleOf(d.type)} info</div>${metaPairs(d)}</div>
    </div>
    ${itemsTable(d)}${totals(d)}
    <div class="bottom"><div style="max-width:58%">${infoStack(d)}<div class="bye">Thanks for being with us!</div><div style="font-size:11.5px;color:#3f4a5e;margin-top:6px">${contactLine(d)}</div></div>${signature(d, 'Manager')}</div>
    ${stamp(d)}${footer(d, opts)}`,
  };
}

// ───────────────────────── 16. Summit — accent table header, split grand total ─────────────────────────
export function summit(d: RenderDoc, opts: RenderOptions): Out {
  const a = d.accent;
  const on = onAccent(a);
  const css = `
    ${flourishCss('#0b1529')}
    .top { display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .bn { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 22px; text-transform: uppercase; letter-spacing: .02em; }
    .bn span { color: ${a}; }
    h1 { font-family: 'Montserrat', sans-serif; font-size: 34px; font-weight: 800; text-align: right; }
    .date { text-align: right; } .date b { color: ${a}; }
    .row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 44px; }
    .facts { display: flex; gap: 34px; } .facts b { display: block; font-size: 12.5px; }
    table.items thead tr { background: ${a}; }
    table.items th { color: ${on}; padding-top: 13px; padding-bottom: 13px; }
    table.items tbody tr:nth-child(even) td { background: #eceef2; }
    table.items td { border-bottom: 0; }
    .lower { display: grid; grid-template-columns: 1fr 320px; gap: 30px; margin-top: 18px; }
    .lower .totals { margin-top: 0; width: 100%; }
    .t-total { padding: 0; overflow: hidden; border-radius: 0; }
    .t-total span { padding: 11px 14px; }
    .t-total span:first-child { background: #111318; color: #fff; flex: 1; }
    .t-total span:last-child { background: ${a}; color: ${on}; flex: 1; text-align: right; }
    .purchase .label { color: #0b1529; } .purchase .amt { font-size: 17px; font-weight: 700; }
    .bottom { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; }
    .contacts { position: absolute; left: 56px; right: 56px; bottom: 52px; display: flex; gap: 40px; font-size: 11px; color: #3f4a5e; }
    .contacts span::before { content: '●'; color: ${a}; margin-right: 6px; }
    .foot { display: none; }
  `;
  const name = esc(d.from.name);
  const half = Math.ceil(name.length / 2);
  return {
    css,
    body: `<div class="top"><div class="brand">${logo(d)}<div class="bn">${name.slice(0, half)}<span>${name.slice(half)}</span></div></div>
      <div><h1>${upper(d)}</h1><div class="date"><b>${metaRows(d)[1][1]}</b></div></div></div>
    <div class="row">
      <div><div class="label">${billLabel(d)}</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div class="facts"><div><b>${titleOf(d.type)} no</b>${esc(d.number)}</div>${d.dueDate && d.type !== 'RECEIPT' ? `<div><b>${metaRows(d)[2][0]}</b>${metaRows(d)[2][1]}</div>` : ''}<div><b>Currency</b>${esc(d.currency)}</div></div>
    </div>
    ${itemsTable(d)}
    <div class="lower"><div class="purchase"><div class="label">${d.type === 'RECEIPT' ? 'Total received' : 'Total purchase'}</div><div class="amt">${fmtMoney(d.total, d.currency)}</div></div>${totals(d)}</div>
    <div class="bottom"><div style="max-width:58%">${infoStack(d)}</div>${signature(d, 'Manager')}</div>
    <div class="contacts">${contactBits(d.from)
      .map((c) => `<span>${c.v.replace(/<br>/g, ', ')}</span>`)
      .join('')}</div>${stamp(d)}${footer(d, opts)}`,
  };
}
