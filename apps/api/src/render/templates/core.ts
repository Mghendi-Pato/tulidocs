import { esc, extras, footer, itemsTable, logo, metaRows, multi, onAccent, partyLines, RenderDoc, RenderOptions, stamp, tint, titleOf, totals } from './shared';

/** The original five templates */
// ───────────────────────── Templates ─────────────────────────

export function classic(d: RenderDoc, opts: RenderOptions) {
  const a = d.accent;
  const css = `
    .bar { position: absolute; top: 0; left: 0; right: 0; height: 8px; background: ${a}; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .title { font-size: 34px; font-weight: 800; letter-spacing: -.02em; color: ${a}; text-align: right; line-height: 1.1; }
    .from { margin-top: 14px; color: #39414f; }
    .grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 32px; margin-top: 40px; }
    .meta div { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; border-bottom: 1px dashed #d3dae6; }
    .meta div span:first-child { color: #3f4a5e; }
    .meta div span:last-child { font-weight: 600; }
    table.items thead tr { background: ${tint(a, 0.16)}; }
    table.items th { color: ${a}; }
    .t-total { background: ${a}; color: ${onAccent(a)}; border-radius: 8px; }
  `;
  return {
    css,
    body: `<div class="bar"></div>
    <div class="head">
      <div>${logo(d)}<div class="from">${partyLines(d.from, d.taxIdLabel)}</div></div>
      <div class="title">${titleOf(d.type)}</div>
    </div>
    <div class="grid">
      <div><div class="label">${d.type === 'RECEIPT' ? 'Received from' : 'Bill to'}</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div class="meta">${metaRows(d)
        .map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`)
        .join('')}</div>
    </div>
    ${itemsTable(d)}${totals(d)}${extras(d)}${stamp(d)}${footer(d, opts)}`,
  };
}

export function modern(d: RenderDoc, opts: RenderOptions) {
  const a = d.accent;
  const on = onAccent(a);
  const css = `
    .page { padding-top: 0; }
    .hero { margin: 0 -56px; padding: 44px 56px 36px; background: ${a}; color: ${on}; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
    .hero .logo-fallback { background: ${on}; color: ${a}; }
    .hero img.logo { background: #fff; padding: 6px; border-radius: 10px; }
    .hero h1 { font-size: 40px; font-weight: 800; letter-spacing: -.03em; line-height: 1; text-align: right; }
    .hero .no { text-align: right; margin-top: 8px; font-weight: 600; opacity: .85; }
    .cols { display: grid; grid-template-columns: 1fr 1fr 0.9fr; gap: 28px; margin-top: 34px; }
    .meta div { padding: 2px 0; }
    .meta span { display: block; }
    .meta .k { font-size: 10.5px; color: #3f4a5e; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
    .meta .v { font-weight: 600; margin-bottom: 6px; }
    table.items th { border-bottom: 2px solid ${a}; color: #0f1b33; }
    .t-total { border-top: 2px solid ${a}; color: ${a}; }
  `;
  const [first, ...rest] = metaRows(d);
  return {
    css,
    body: `<div class="hero">
      <div>${logo(d)}</div>
      <div><h1>${titleOf(d.type)}</h1><div class="no">${first[1]}</div></div>
    </div>
    <div class="cols">
      <div><div class="label">From</div>${partyLines(d.from, d.taxIdLabel)}</div>
      <div><div class="label">${d.type === 'RECEIPT' ? 'Received from' : 'Bill to'}</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div class="meta">${rest.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}</div>
    </div>
    ${itemsTable(d)}${totals(d)}${extras(d)}${stamp(d)}${footer(d, opts)}`,
  };
}

export function minimal(d: RenderDoc, opts: RenderOptions) {
  const css = `
    .page { padding: 72px 72px 80px; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; }
    .top .logo { max-height: 48px; }
    .top .logo-fallback { background: #0f1b33; color: #fff; width: 44px; height: 44px; font-size: 20px; border-radius: 50%; }
    .t { font-size: 13px; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; }
    .rule { height: 1px; background: #0f1b33; margin: 36px 0 28px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px; }
    .meta div { display: flex; justify-content: space-between; gap: 10px; }
    .meta span:first-child { color: #3f4a5e; }
    table.items th { border-bottom: 1px solid #0f1b33; color: #0f1b33; padding-left: 0; }
    table.items td { padding-left: 0; border-bottom-color: #eceff4; }
    table.items .c-no { display: none; }
    .t-row { padding-left: 0; padding-right: 0; }
    .t-total { border-top: 1px solid #0f1b33; border-bottom: 1px solid #0f1b33; margin-top: 10px; }
    .t-total span:last-child { color: ${d.accent}; }
    .box { background: transparent; border: 1px solid #d3dae6; }
    .box.pay { background: transparent; border-color: #0f1b33; }
    .foot { left: 72px; right: 72px; }
  `;
  return {
    css,
    body: `<div class="top">${logo(d)}<div class="t">${titleOf(d.type)}</div></div>
    <div class="rule"></div>
    <div class="cols">
      <div><div class="label">From</div>${partyLines(d.from, d.taxIdLabel)}</div>
      <div><div class="label">${d.type === 'RECEIPT' ? 'Received from' : 'To'}</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div class="meta">${metaRows(d)
        .map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`)
        .join('')}</div>
    </div>
    ${itemsTable(d)}${totals(d)}${extras(d)}${stamp(d)}${footer(d, opts)}`,
  };
}

export function elegant(d: RenderDoc, opts: RenderOptions) {
  const a = d.accent;
  const css = `
    .page { padding-top: 60px; }
    .center { text-align: center; }
    .center .logo, .center .logo-fallback { margin: 0 auto; }
    .center .logo-fallback { border-radius: 50%; font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 30px; }
    .bname { font-family: 'Instrument Serif', Georgia, serif; font-size: 30px; margin-top: 10px; letter-spacing: -.01em; }
    .bline { color: #3f4a5e; font-size: 11.5px; margin-top: 2px; }
    h1 { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 54px; color: ${a}; line-height: 1; margin-top: 36px; }
    .orn { width: 64px; height: 1px; background: ${a}; margin: 18px auto 0; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 36px; padding: 20px 0; border-top: 1px solid #d3dae6; border-bottom: 1px solid #d3dae6; }
    .meta div { display: flex; justify-content: space-between; padding: 2px 0; }
    .meta span:first-child { color: #3f4a5e; }
    .meta span:last-child { font-weight: 600; }
    table.items th { color: ${a}; border-bottom: 1px solid ${a}; }
    .t-total { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 24px; border-top: 1px solid ${a}; }
    .t-total span:last-child { color: ${a}; }
  `;
  const contact = [d.from.address?.replace(/\n/g, ', '), d.from.phone, d.from.email].filter(Boolean).map(esc).join(' · ');
  return {
    css,
    body: `<div class="center">${logo(d)}
      <div class="bname">${esc(d.from.name)}</div>
      ${contact ? `<div class="bline">${contact}</div>` : ''}
      ${d.from.taxId ? `<div class="bline">${esc(d.taxIdLabel)} ${esc(d.from.taxId)}</div>` : ''}
      <h1>${titleOf(d.type)}</h1><div class="orn"></div>
    </div>
    <div class="cols">
      <div><div class="label">${d.type === 'RECEIPT' ? 'Received from' : 'Billed to'}</div>${partyLines(d.to, d.taxIdLabel)}</div>
      <div class="meta">${metaRows(d)
        .map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`)
        .join('')}</div>
    </div>
    ${itemsTable(d)}${totals(d)}${extras(d)}${stamp(d)}${footer(d, opts)}`,
  };
}

export function bold(d: RenderDoc, opts: RenderOptions) {
  const a = d.accent;
  const css = `
    .page { padding: 0; display: grid; grid-template-columns: 250px 1fr; }
    .side { background: #0f1b33; color: #dfe5ef; padding: 56px 28px 72px; min-height: 1123px; }
    .side img.logo { background: #fff; padding: 6px; border-radius: 10px; }
    .side .logo-fallback { background: ${a}; color: ${onAccent(a)}; }
    .side .p-name { color: #fff; }
    .side .label { color: #8a97ad; margin-top: 30px; }
    .side .meta div { padding: 3px 0; }
    .side .meta .k { display: block; font-size: 10.5px; color: #8a97ad; }
    .side .meta .v { display: block; color: #fff; font-weight: 600; }
    .main { padding: 56px 44px 72px; position: relative; }
    h1 { font-size: 44px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
    h1 span { color: ${a}; }
    .to { margin-top: 32px; }
    table.items .c-no { display: none; }
    table.items th { background: #e8edf5; }
    .t-total { background: ${a}; color: ${onAccent(a)}; border-radius: 8px; }
    .totals { width: 280px; }
    .extras { grid-template-columns: 1fr; }
    .foot { left: 294px; right: 44px; }
    .stamp { top: 120px; right: 44px; }
  `;
  return {
    css,
    body: `<aside class="side">
      ${logo(d)}
      <div class="label">From</div>${partyLines(d.from, d.taxIdLabel)}
      <div class="label">Details</div>
      <div class="meta">${metaRows(d)
        .map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`)
        .join('')}</div>
    </aside>
    <main class="main">
      <h1>${titleOf(d.type)}<span>.</span></h1>
      <div class="to"><div class="label">${d.type === 'RECEIPT' ? 'Received from' : 'Bill to'}</div>${partyLines(d.to, d.taxIdLabel)}</div>
      ${itemsTable(d)}${totals(d)}${extras(d)}${stamp(d)}
    </main>${footer(d, opts)}`,
  };
}

