/* =====================================================================
   G5 Auto — Application Logic  (routes, views, modals, interactions)
   ===================================================================== */
(function(){
"use strict";
const S=window.Store, C=window.Charts;
const $=S.$, $$=S.$$;
const V=S.VEHICLE_STATUSES, EC=S.EXPENSE_CATEGORIES, WS=S.WATCH_STATUSES;

/* ---- DOM refs ---- */
const viewEl=()=>$('#view');
const modalBack=$('#modalBack');
const modalSlot=$('#modalSlot');
const toastWrap=$('#toastWrap');
const srAnnounce=$('#srAnnounce');

/* ---- Screen reader announcements ---- */
function announce(msg){
  if(srAnnounce){ srAnnounce.textContent=''; requestAnimationFrame(()=>{ srAnnounce.textContent=msg; }); }
}

/* ---- Undo system ---- */
let undoStack=[];
let undoTimer=null;
function pushUndo(fn, label){
  undoStack.push({fn, label, time:Date.now()});
  if(undoStack.length>20) undoStack.shift();
}
function undo(){
  if(!undoStack.length) return;
  const action=undoStack.pop();
  action.fn();
  toast('Undid: '+action.label,'info',4000);
  announce('Undid '+action.label);
}

/* ---- Router ---- */
let currentView='dashboard', currentParam=null;
function route(view,param){
  currentView=view; currentParam=param||null;
  renderNav(); render(); closeMobileNav();
  announce(view.charAt(0).toUpperCase()+view.slice(1)+' view loaded');
}

/* ---- Toast ---- */
function toast(msg,type,dur){
  const t=document.createElement('div');
  const iconMap={ok:'M5 13l4 4L19 7',err:'M6 6l12 12M18 6L6 18',info:'M12 8v4m0 4h.01',warn:'M12 9v4m0 4h.01'};
  const icon=iconMap[type]||iconMap.info;
  t.className='toast '+type;
  t.innerHTML=`<div class="tic"><svg viewBox="0 0 24 24" fill="none"><path d="${icon}" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div><div><div class="tt">${msg}</div></div>`;
  t.setAttribute('role','status');
  t.setAttribute('aria-live','polite');
  toastWrap.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  announce(msg);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);}, dur||3500);
}

/* ---- Modal ---- */
let previousFocus=null;
function openModal(html){
  previousFocus=document.activeElement;
  modalSlot.innerHTML=html;
  modalBack.classList.add('open');
  modalBack.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  // Focus first focusable element
  requestAnimationFrame(()=>{
    const focusable=modalBack.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if(focusable.length) focusable[0].focus();
  });
  // Focus trap
  modalBack._trapHandler=function(e){
    if(e.key!=='Tab') return;
    const focusable=modalBack.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if(!focusable.length) return;
    const first=focusable[0], last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }
  };
  modalBack.addEventListener('keydown',modalBack._trapHandler);
}
function closeModal(){
  modalBack.classList.remove('open');
  modalBack.setAttribute('aria-hidden','true');
  modalSlot.innerHTML='';
  document.body.style.overflow='';
  modalBack.removeEventListener('keydown',modalBack._trapHandler);
  if(previousFocus) previousFocus.focus();
}
window.closeModal = closeModal;
modalBack.addEventListener('click',e=>{ if(e.target===modalBack) closeModal(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&modalBack.classList.contains('open')) closeModal(); });

/* ---- Photo placeholder ---- */
function vehPhoto(v){
  const colors=[['#0a8f5f','#055b3f'],['#2a6df4','#1a4499'],['#7c3aed','#4c1d95'],['#0891b2','#0e7490'],['#d9770c','#92400e'],['#e11d48','#9f1239']];
  const i=(S.vehicleName(v).split('').reduce((a,c)=>a+c.charCodeAt(0),0))%colors.length;
  const [c1,c2]=colors[i];
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="250" fill="url(%23g)"/><text x="200" y="110" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" font-size="52" fill="rgba(255,255,255,.2)">${(v.year||'')}</text><text x="200" y="155" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="22" fill="rgba(255,255,255,.8)">${(v.make||'')}</text><text x="200" y="185" text-anchor="middle" font-family="Inter,sans-serif" font-weight="500" font-size="16" fill="rgba(255,255,255,.5)">${(v.model||'')}</text></svg>`)}`;
}
function getVehiclePhoto(v){
  if(v.photos&&v.photos.length&&v.photos[0]) return v.photos[0];
  return vehPhoto(v);
}

/* ---- Premium full vehicle details modal ---- */
function modalVehicleDetails(id){
  const v=Store.state.vehicles.find(x=>x.id===id);
  if(!v){toast('Vehicle not found','err');return;}
  const e=S.estimatedSalesInfo(v), ti=S.totalInvestment(v), sold=v.status==='sold';
  const fin=sold?S.salesInfo(v):null;
  const photo=getVehiclePhoto(v);
  const costs=S.vehicleCosts(v);
  const rows=[
    ['Purchase Price',S.money(v.purchasePrice)],['Repairs',S.money(v.repairCost)],['Parts',S.money(v.partsCost)],['Labor',S.money(v.laborCost)],
    ['Transport',S.money(v.transportCost)],['Auction Fees',S.money(v.auctionFees)],['Dealer Fees',S.money(v.dealerFees)],['Taxes',S.money(v.taxes)],
    ['Registration',S.money(v.registrationCost)],['Advertising',S.money(v.advertisingCost)],['Detailing',S.money(v.detailingCost)],['Other Fees',S.money(v.otherFees||v.miscCost)]
  ];
  openModal(`<div class="modal premium-detail-modal">
    <div class="premium-detail-hero">
      <img src="${photo}" alt="${S.vehicleName(v)}" onerror="this.src='${vehPhoto(v)}'">
      <div class="hero-overlay"></div>
      <div class="hero-top"><span class="status-pill"><span class="sd ${V[v.status]?.cls||'s-just'}"></span>${V[v.status]?.label||'Inventory'}</span><button class="modal-x light" data-close-modal>✕</button></div>
      <div class="hero-copy"><div class="eyebrow">${v.year||''} · ${v.condition||'Vehicle'}</div><h2>${S.vehicleName(v)}</h2><div class="hero-meta">${v.mileage?S.round(v.mileage/1000,1)+'k miles · ':''}${v.location||v.seller||'No source'}${v.vin?' · VIN '+v.vin:''}</div></div>
    </div>
    <div class="modal-body premium-detail-body">
      <div class="premium-kpis">
        <div><span>Invested</span><strong>${S.money(ti)}</strong></div>
        <div><span>${sold?'Sold For':'Listed At'}</span><strong>${S.money(sold?v.salePrice:(v.listPrice||0))}</strong></div>
        <div><span>ROI</span><strong>${sold?S.roiDisplay(fin.roi,ti):'—'}</strong></div>
        <div><span>Margin</span><strong>${sold?(fin.margin===null?'—':S.pct(fin.margin)):'—'}</strong></div>
      </div>
      <div class="detail-grid">
        <section class="detail-panel"><div class="panel-title"><span>Vehicle</span><span class="panel-icon">⌁</span></div><div class="spec-grid">
          <div><span>Year</span><b>${v.year||'—'}</b></div><div><span>Make</span><b>${v.make||'—'}</b></div><div><span>Model</span><b>${v.model||'—'}</b></div><div><span>Trim</span><b>${v.trim||'—'}</b></div><div><span>Mileage</span><b>${v.mileage?S.money(v.mileage).replace('$','')+' mi':'—'}</b></div><div><span>Condition</span><b>${v.condition||'—'}</b></div><div><span>Seller</span><b>${v.seller||'—'}</b></div><div><span>Location</span><b>${v.location||'—'}</b></div>
        </div></section>
        <section class="detail-panel"><div class="panel-title"><span>Investment breakdown</span><span class="panel-total">${S.money(costs.total)}</span></div><div class="cost-list">${rows.map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}<div class="cost-total"><span>All costs</span><b>${S.money(costs.total)}</b></div><div class="cost-total strong"><span>Total investment</span><b>${S.money(ti)}</b></div></div></section>
      </div>
      <section class="detail-panel notes-panel"><div class="panel-title"><span>Notes & issues</span></div><p>${v.notes||v.damage||'No notes added for this vehicle.'}</p></section>
    </div>
    <div class="modal-foot premium-detail-foot"><button class="btn ghost" data-close-modal>Close</button><div class="spacer"></div><button class="btn subtle" id="detailEdit">Edit Vehicle</button>${sold?'':`<button class="btn primary" id="detailSell">Record Sale</button>`}</div>
  </div>`);
  $$('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));
  $('#detailEdit')?.addEventListener('click',()=>{closeModal();App.modalEditVehicle(v.id);});
  $('#detailSell')?.addEventListener('click',()=>{closeModal();App.modalRecordSale(v.id);});
}

/* ---- Quick Action Modal (click on vehicle card) ---- */
function modalQuickAction(id){
  const v=Store.state.vehicles.find(x=>x.id===id);
  if(!v){ toast('Vehicle not found','err'); return; }
  const isSold=v.status==='sold';
  const e=S.estimatedSalesInfo(v);
  const ti=S.totalInvestment(v);
  const photo=getVehiclePhoto(v);
  const soldProfit=isSold?S.salesInfo(v).profit:0;
  const soldRoi=isSold?S.salesInfo(v).roi:null;
  const soldMargin=isSold?S.salesInfo(v).margin:null;
  openModal(`
  <div class="modal">
    <div class="modal-head">
      <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
        <img src="${photo}" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0" onerror="this.src='${vehPhoto(v)}'">
        <div style="min-width:0">
          <h3 style="margin:0;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${S.vehicleName(v)}</h3>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px">${v.seller||v.location||'No source'} · ${v.condition||'—'}</div>
        </div>
      </div>
      <button class="modal-x" data-close-modal>✕</button>
    </div>
    <div class="modal-body">
      <div class="stat-strip mb-16" style="grid-template-columns:repeat(4,1fr)">
        <div class="cell"><div class="lbl">Invested</div><div class="v tnum">${S.money(ti)}</div></div>
        <div class="cell"><div class="lbl">${isSold?'Sold For':'Est. Resale'}</div><div class="v tnum">${isSold?S.money(v.salePrice):S.money(e.listingPrice)}</div></div>
        <div class="cell"><div class="lbl">${isSold?'Profit':'Est. Profit'}</div><div class="v tnum" style="color:${(isSold?soldProfit:e.profit)>=0?'var(--pos)':'var(--neg)'}">${isSold?S.money(soldProfit):S.money(e.profit)}</div></div>
        <div class="cell"><div class="lbl">ROI</div><div class="v tnum" style="color:${(isSold?ti>0&&soldRoi!==null:e.totalInvestment>0&&e.roi!==null)?((isSold?soldRoi:e.roi)>=0?'var(--pos)':'var(--neg)'):'var(--text-3)'}">${isSold?S.roiDisplay(soldRoi,ti):S.roiDisplay(e.roi,e.totalInvestment)}</div></div>
      </div>

      ${!isSold?`
      <h4 style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text-2)">Quick Sell</h4>
      <div class="grid-form" style="grid-template-columns:1fr 1fr">
        <div class="field"><label>Sale Price</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" id="qsPrice" placeholder="0"></div></div>
        <div class="field"><label>Date Sold</label><input class="inp" type="date" id="qsDate" value="${S.LOCAL_ISO()}"></div>
        <div class="field"><label>Selling Fees</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" id="qsFees" value="0" min="0" step="0.01"></div></div>
      </div>
      <div id="qsSummary" style="margin-top:12px;padding:12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border)">
        <div class="kv"><span class="k">Total Investment</span><span class="v tnum">${S.money(ti)}</span></div>
        <div class="kv"><span class="k bold">Net Profit</span><span class="v tnum bold" id="qsProfit">—</span></div>
        <div class="kv"><span class="k">ROI</span><span class="v tnum" id="qsRoi" style="color:${e.totalInvestment>0&&e.roi!==null?(e.roi>=0?'var(--pos)':'var(--neg)'):'var(--text-3)'}">${S.roiDisplay(e.roi,e.totalInvestment)}</span></div>
        <div class="kv"><span class="k">Margin</span><span class="v tnum" id="qsMargin" style="color:var(--text-3)">—</span></div>
      </div>
      `:`
      <div id="soldView">
        <h4 style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text-2)">Sale Details</h4>
        <div class="kv" style="padding:10px 0;border-bottom:1px solid var(--border)"><span class="k">Sale Price</span><span class="v tnum">${S.money(v.salePrice)}</span></div>
        <div class="kv" style="padding:10px 0;border-bottom:1px solid var(--border)"><span class="k">Date Sold</span><span class="v tnum">${v.saleDate||'—'}</span></div>
        <div class="kv" style="padding:10px 0;border-bottom:1px solid var(--border)"><span class="k">Total Investment</span><span class="v tnum">${S.money(ti)}</span></div>
        <div class="kv" style="padding:10px 0;border-bottom:1px solid var(--border)"><span class="k">Net Profit</span><span class="v tnum" style="color:${soldProfit>=0?'var(--pos)':'var(--neg)'};font-weight:700">${S.money(soldProfit)}</span></div>
        <div class="kv" style="padding:10px 0;border-bottom:1px solid var(--border)"><span class="k">ROI</span><span class="v tnum" style="color:${ti>0?(soldRoi>=0?'var(--pos)':'var(--neg)'):'var(--text-3)'};font-weight:700">${S.roiDisplay(soldRoi,ti)}</span></div>
        <div class="kv" style="padding:10px 0"><span class="k">Margin</span><span class="v tnum" style="color:${soldMargin!==null?(soldMargin>=0?'var(--pos)':'var(--neg)'):'var(--text-3)'};font-weight:700">${soldMargin===null?'—':S.pct(soldMargin)}</span></div>
      </div>
      `}
    </div>
    <div class="modal-foot">
      <button class="btn ghost" data-close-modal>Close</button>
      <div class="spacer"></div>
      ${!isSold?`
        <button class="btn subtle" onclick="closeModal();App.modalVehicleDetails('${v.id}')">Full Details</button>
        <button class="btn primary" id="qsConfirm">Confirm Sale</button>
      `:`
        <button class="btn subtle" id="qsEditToggle">Edit Sale</button>
        <button class="btn primary" id="qsSaveEdit" style="display:none">Save Changes</button>
        <button class="btn subtle" onclick="closeModal();App.modalVehicleDetails('${v.id}')">View Details</button>
      `}
    </div>
  </div>`);
  $$('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));

  const wireLiveUpdate=(el)=>{
    const priceInput=el||$('#qsPrice');
    if(!priceInput) return;
    const updateSummary=()=>{
      const sp=S.num(priceInput.value);
      const f=S.calculateFinancials({investment:ti,revenue:sp,sellingFees:S.num($('#qsFees')?.value)});
      const profitEl=$('#qsProfit');
      const roiEl=$('#qsRoi');
      const marginEl=$('#qsMargin');
      if(profitEl){ profitEl.textContent=S.money(f.profit); profitEl.style.color=f.profit>=0?'var(--pos)':'var(--neg)'; }
      if(roiEl){ roiEl.textContent=S.roiDisplay(f.roi,f.totalInvestment); roiEl.style.color=f.hasInvestment?(f.roi>=0?'var(--pos)':'var(--neg)'):'var(--text-3)'; }
      if(marginEl){ marginEl.textContent=f.hasRevenue?S.pct(f.margin):'—'; marginEl.style.color=f.hasRevenue?(f.margin>=0?'var(--pos)':'var(--neg)'):'var(--text-3)'; }
    };
    priceInput.removeEventListener('input',priceInput._handler);
    priceInput._handler=updateSummary;
    priceInput.addEventListener('input',updateSummary);
    $('#qsFees')?.addEventListener('input',updateSummary);
    updateSummary();
    priceInput.focus();
  };

  if(!isSold){
    wireLiveUpdate();
    $('#qsConfirm')?.addEventListener('click',async ()=>{
      const sp=+($('#qsPrice')?.value||0);
      const sd=$('#qsDate')?.value||S.LOCAL_ISO();
      const sf=S.num($('#qsFees')?.value);
      if(!sp){ toast('Enter a sale price','warn'); return; }
      try {
        await Store.sellVehicle(id,{salePrice:sp,saleDate:sd,sellingFees:sf,buyer:''});
        closeModal();
        renderNav(); render(); renderNotifications();
        toast(`Sold ${S.vehicleName(v)} for ${S.money(sp)}!`,'ok');
      } catch(err) { toast('Error: '+err.message,'err'); }
    });
  } else {
    $('#qsEditToggle')?.addEventListener('click',()=>{
      $('#soldView').style.display='none';
      const editDiv=document.createElement('div');
      editDiv.id='soldEdit';
      editDiv.innerHTML=`
        <h4 style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text-2)">Edit Sale</h4>
        <div class="grid-form" style="grid-template-columns:1fr 1fr">
          <div class="field"><label>Sale Price</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" id="qsPrice" value="${v.salePrice||''}"></div></div>
          <div class="field"><label>Date Sold</label><input class="inp" type="date" id="qsDate" value="${v.saleDate||S.LOCAL_ISO()}"></div>
          <div class="field"><label>Selling Fees</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" id="qsFees" value="${v.sellingFees||0}" min="0" step="0.01"></div></div>
        </div>
        <div id="qsSummary" style="margin-top:12px;padding:12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border)">
          <div class="kv"><span class="k">Total Investment</span><span class="v tnum">${S.money(ti)}</span></div>
          <div class="kv"><span class="k bold">Net Profit</span><span class="v tnum bold" id="qsProfit">${S.money(soldProfit)}</span></div>
          <div class="kv"><span class="k">ROI</span><span class="v tnum" id="qsRoi" style="color:${soldRoi>=0?'var(--pos)':'var(--neg)'}">${S.pct(soldRoi)}</span></div>
          <div class="kv"><span class="k">Margin</span><span class="v tnum" id="qsMargin" style="color:${soldMargin>=0?'var(--pos)':'var(--neg)'}">${S.pct(soldMargin)}</span></div>
        </div>`;
      $('#soldView').parentNode.insertBefore(editDiv,$('#soldView').nextSibling);
      wireLiveUpdate(editDiv.querySelector('#qsPrice'));
      $('#qsEditToggle').style.display='none';
      $('#qsSaveEdit').style.display='';
    });

    $('#qsSaveEdit')?.addEventListener('click',async ()=>{
      const sp=+($('#qsPrice')?.value||0);
      const sd=$('#qsDate')?.value||S.LOCAL_ISO();
      const sf=S.num($('#qsFees')?.value);
      if(!sp){ toast('Enter a sale price','warn'); return; }
      try {
        await Store.sellVehicle(id,{salePrice:sp,saleDate:sd,sellingFees:sf,buyer:v.buyer||''});
        closeModal();
        renderNav(); render(); renderNotifications();
        toast(`Updated sale for ${S.vehicleName(v)}`,'ok');
      } catch(err) { toast('Error: '+err.message,'err'); }
    });
  }
}

/* ---- Helpers ---- */
function daysOld(v){ return S.daysInInventory(v); }
function statBadge(v){
  const st=V[v.status]||V.just_purchased;
  return `<span class="badge neutral"><span class="sd ${st.cls}"></span>${st.label}</span>`;
}
function roiStr(v){
  if(v.status==='sold'){ const i=S.salesInfo(v); return `<span class="${i.profit>=0?'pos':'neg'}">${S.roiDisplay(i.roi,i.totalInvestment)}</span>`; }
  const e=S.estimatedSalesInfo(v); return `<span class="${e.profit>=0?'pos':'neg'}">${S.roiDisplay(e.roi,e.totalInvestment)}</span>`;
}
function profitStr(v){
  if(v.status==='sold'){ const i=S.salesInfo(v); return `<span class="${i.profit>=0?'pos':'neg'}">${S.money(i.profit)}</span>`; }
  const e=S.estimatedSalesInfo(v); return `<span class="${e.profit>=0?'pos':'neg'}">${S.money(e.profit)}</span>`;
}
function miniSelect(opts,selected,label){
  return `<select class="inp" data-field="${label}"><option value="">Any</option>${opts.map(o=>`<option value="${o}"${o===selected?' selected':''}>${o}</option>`).join('')}</select>`;
}

/* ================================================================
   VIEW: DASHBOARD
   ================================================================ */
function renderDashboard(){
  const m=S.business.lifetimeMetrics();
  const inv=S.business.inventorySnapshot();
  const sold=S.business.soldVehicles();
  const held=S.business.heldVehicles();
  const recentPurchases=[...held].sort((a,b)=>(b.purchaseDate||'').localeCompare(a.purchaseDate||'')).slice(0,5);
  const recentSales=[...sold].sort((a,b)=>(b.saleDate||'').localeCompare(a.saleDate||'')).slice(0,5);
  const alerts=S.alerts().slice(0,5);
  const eByCat=S.business.expenseByCategory();
  const invB=S.business.inventoryStatusBreakdown();
  const profitAll=S.business.profitSeries('all');
  const revenueAll=S.business.revenueSeries('all');
  const isEmpty=held.length===0&&sold.length===0;

  return `
  <div class="view-pad fade-in">
    ${isEmpty?`
    <div style="text-align:center;padding:60px 20px 40px">
      <div style="width:80px;height:80px;border-radius:20px;background:var(--brand-soft);display:inline-grid;place-items:center;margin-bottom:20px">
        <svg viewBox="0 0 24 24" fill="none" width="40" height="40"><path d="M5 14l1.6-4.2A2 2 0 0 1 8.4 8.5h7.2a2 2 0 0 1 1.8 1.3L19 14M8 14a1.7 1.7 0 1 1-3.4 0A1.7 1.7 0 0 1 8 14Zm12.4 0a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Z" stroke="var(--brand)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <h2 style="font-size:24px;font-weight:800;margin-bottom:8px">Welcome to G5 Auto</h2>
      <p style="color:var(--text-3);font-size:14px;max-width:420px;margin:0 auto 24px;line-height:1.6">Your Charlotte NC used-car business dashboard. Add your first vehicle to start tracking costs, repairs, and profits.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn primary" onclick="App.modalAddVehicle()" style="font-size:14px;padding:10px 24px">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style="margin-right:6px"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Add First Vehicle
        </button>
        <button class="btn subtle" onclick="App.nav('search')" style="font-size:14px;padding:10px 24px">Search for Cars</button>
      </div>
    </div>
    `:''}
    <div class="page-head"><div class="page-title">Dashboard<small class="crumb" style="display:block;margin-top:4px;font-size:12px;font-weight:500;color:var(--text-3)">Your business at a glance</small></div><div class="spacer"></div>
      <div class="range-pills" id="dashRange"><button data-r="7d">7d</button><button data-r="30d">30d</button><button data-r="3m">3m</button><button data-r="6m">6m</button><button data-r="1y" class="active">1y</button><button data-r="all">All</button></div>
    </div>

    <div class="kpi-grid stagger mb-20">
      <div class="kpi is-accent"><div class="kpi-top"><span class="lbl">Total Invested</span><div class="ic"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div><div class="v tnum">${S.money(m.totalInvested)}</div><div class="delta up"><svg viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${held.length} vehicles held</div></div>
      <div class="kpi is-pos"><div class="kpi-top"><span class="lbl">Revenue</span><div class="ic"><svg viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div><div class="v tnum">${S.money(m.revenue)}</div><div class="delta up"><svg viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${sold.length} sold</div></div>
      <div class="kpi is-pos"><div class="kpi-top"><span class="lbl">Net Profit</span><div class="ic"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div><div class="v tnum">${S.money(m.profit)}</div><div class="delta ${m.profit>=0?'up':'down'}">${S.pct(m.avgRoi)} avg ROI</div></div>
      <div class="kpi"><div class="kpi-top"><span class="lbl">Avg Profit / Car</span><div class="ic"><svg viewBox="0 0 24 24" fill="none"><path d="M12 8v8m-4-4h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div></div><div class="v tnum">${S.money(m.avgProfit)}</div><div class="delta">${S.round(m.avgDays,0)} avg days to sell</div></div>
      <div class="kpi"><div class="kpi-top"><span class="lbl">Inventory Value</span><div class="ic"><svg viewBox="0 0 24 24" fill="none"><path d="M5 11l1.3-3.5A2 2 0 018.2 6h7.6a2 2 0 011.9 1.5L19 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div></div><div class="v tnum">${S.money(inv.estValue)}</div><div class="delta">${m.heldCount} vehicles held</div></div>
      <div class="kpi"><div class="kpi-top"><span class="lbl">In Inventory</span><div class="ic"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M3 9h18M9 3v18" stroke="currentColor" stroke-width="1.6"/></svg></div></div><div class="v tnum">${m.heldCount}<small> cars</small></div><div class="delta">Sold: ${m.soldCount}</div></div>
    </div>

    <div class="premium-opportunity-grid mb-20">
      <div class="card market-pulse-card"><div class="card-head"><div><h3>Charlotte Market Pulse</h3><div class="page-sub">Snapshot from multiple marketplace sources</div></div><span class="badge brand">Updated ${S.marketSnapshotFor({}).refreshed}</span></div><div class="card-body">
        <div class="market-pulse-grid">
          <div><span>All used vehicles</span><b>${S.money(S.marketSnapshotFor({}).allUsed.avg)}</b><small>Multi-source index</small></div>
          <div><span>2022 Camry</span><b>${S.money(23562)}</b><small>Charlotte avg</small></div>
          <div><span>2022 F-150</span><b>${S.money(38823)}</b><small>Charlotte avg</small></div>
          <div><span>2022 Accord</span><b>${S.money(25667)}</b><small>Charlotte observed avg</small></div>
        </div>
        <div class="market-pulse-links"><a href="https://www.cargurus.com/research/price-trends" target="_blank" rel="noopener">CarGurus trends ↗</a><a href="https://www.facebook.com/marketplace/charlotte" target="_blank" rel="noopener">Facebook Marketplace ↗</a><a href="https://www.autotrader.com/cars-for-sale/2022/toyota/camry/charlotte-nc" target="_blank" rel="noopener">Charlotte Camry comps ↗</a><a href="https://charlotte.craigslist.org/search/cta" target="_blank" rel="noopener">Craigslist CLT ↗</a></div>
      </div></div>
      <div class="card"><div class="card-head"><div><h3>Capital at Risk</h3><div class="page-sub">What your current inventory is tying up</div></div></div><div class="card-body">
        ${(() => { const held=S.business.heldVehicles(); const tiers={fresh:0,attention:0,stale:0}; held.forEach(v=>{const d=S.daysInInventory(v); if(d>=45)tiers.stale++; else if(d>=21)tiers.attention++; else tiers.fresh++;}); return `<div class="risk-tier"><span class="dot fresh"></span><div><b>${tiers.fresh} Fresh</b><small>under 21 days</small></div></div><div class="risk-tier"><span class="dot attention"></span><div><b>${tiers.attention} Attention</b><small>21–44 days</small></div></div><div class="risk-tier"><span class="dot stale"></span><div><b>${tiers.stale} Stale</b><small>45+ days</small></div></div>`; })()}
      </div></div>
    </div>

    <div class="dash-grid mb-20">
      <div class="card"><div class="card-head"><div><h3>Revenue & Exit Outlook</h3><div class="page-sub">Realized sales with projected inventory exit</div></div><div class="market-badge">Charlotte · ${S.marketSnapshotFor({}).refreshed}</div></div><div class="card-body"><div class="chart-h" id="revChart"></div></div></div>
      <div class="card"><div class="card-head"><h3>Inventory</h3></div><div class="card-body"><div id="invDonut" style="display:flex;gap:20px;align-items:center"><div style="flex:1;min-width:0"><div style="height:200px" id="invDonutSvg"></div></div><div class="legend" id="invLegend" style="min-width:140px"></div></div></div></div>
    </div>

    <div class="dash-grid mb-20">
      <div class="dash-stack">
        <div class="card"><div class="card-head"><h3>Profit Trend</h3></div><div class="card-body"><div class="chart-h sm" id="profitChart"></div></div></div>
        <div class="card"><div class="card-head"><h3>Expenses by Category</h3></div><div class="card-body"><div id="expBreakdown" class="breakdown"></div></div></div>
      </div>
      <div class="dash-stack">
        <div class="card"><div class="card-head"><h3>Recent Purchases</h3><div class="spacer"></div><button class="btn link sm" onclick="App.nav('inventory')">View all</button></div><div id="recentPurchases"></div></div>
        <div class="card"><div class="card-head"><h3>Recent Sales</h3></div><div id="recentSales"></div></div>
        ${alerts.length?`<div class="card"><div class="card-head"><h3>Alerts</h3><span class="badge warn">${alerts.length}</span></div><div id="dashAlerts"></div></div>`:''}
      </div>
    </div>
  </div>`;
}

function mountDashboard(){
  // Revenue chart
  const range=$('#dashRange .active')?.dataset.r||'1y';
  const rc=$('#revChart');
  if(rc) C.area(rc,S.business.revenueSeries(range),{color:getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(),zeroBaseline:true,secondaryPoints:S.business.projectedRevenueSeries(range),secondaryColor:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),legend:[{label:'Realized',color:getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()},{label:'Projected exit',color:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),dashed:true}]});
  const pc=$('#profitChart');
  if(pc) C.area(pc,S.business.profitSeries(range),{color:getComputedStyle(document.documentElement).getPropertyValue('--pos').trim(),money:true,zeroBaseline:false});
  // Inventory donut
  const ids=$('#invDonutSvg');
  if(ids){
    const b=S.business.inventoryStatusBreakdown();
    const segs=[
      {label:'Just Purchased',value:b.owned,color:'#2a6df4'},
      {label:'Repairing',value:b.repair,color:'#7c3aed'},
      {label:'Ready',value:b.ready,color:'#09926b'},
      {label:'Listed',value:b.listed,color:'#0a8f5f'},
      {label:'Negotiating',value:b.negotiating,color:'#b08320'},
      {label:'Sold',value:b.sold,color:'#8a96a8'}
    ].filter(s=>s.value>0);
    C.donut(ids,segs,{centerLabel:heldCountStr(),centerSub:'vehicles'});
    const lg=$('#invLegend');
    if(lg) lg.innerHTML=segs.map(s=>`<div class="li"><span class="sw" style="background:${s.color}"></span><span class="lab">${s.label}</span><span class="amt">${s.value}</span></div>`).join('');
  }
  function heldCountStr(){ return String(S.business.heldVehicles().length); }
  // Expense breakdown
  const eb=$('#expBreakdown');
  if(eb){
    const ecat=S.business.expenseByCategory();
    const items=Object.keys(EC).filter(k=>k!=='purchase'&&ecat[k]>0).map(k=>({label:EC[k].label, value:ecat[k], color:EC[k].color}));
    const total=items.reduce((s,x)=>s+x.value,0);
    eb.innerHTML=items.map(it=>`
      <div class="bk"><span class="lab">${it.label}</span><span class="track"><i style="width:${total?((it.value/total)*100).toFixed(1):0}%;background:${it.color}"></i></span><span class="amt">${S.money(it.value)}</span></div>
    `).join('');
  }
  // Recent purchases
  const rp=$('#recentPurchases');
  if(rp){
    const held=S.business.heldVehicles().sort((a,b)=>(b.purchaseDate||'').localeCompare(a.purchaseDate||'')).slice(0,5);
    rp.innerHTML=held.length?held.map(v=>{const photoUrl=getVehiclePhoto(v);return`<div class="wrow" onclick="App.nav('vehicle','${v.id}')"><div class="ic"><img class="dash-img" data-vid="${v.id}" src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.onerror=null;this.src='${vehPhoto(v)}'"></div><div class="main"><div class="t">${S.vehicleName(v)}</div><div class="s">${v.purchaseDate} · ${v.seller||'—'}</div></div><div class="val"><div class="l">Paid</div>${S.money(v.purchasePrice)}</div></div>`;}).join(''):'<div class="empty-state"><div class="ei"><svg viewBox="0 0 24 24" fill="none"><path d="M5 11l1.3-3.5A2 2 0 018.2 6h7.6a2 2 0 011.9 1.5L19 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h4>No vehicles yet</h4><p>Add your first vehicle to start tracking your inventory.</p><button class="btn primary mt-12" onclick="App.modalAddVehicle()">Add Vehicle</button></div>';
  }
  // Recent sales
  const rs=$('#recentSales');
  if(rs){
    const sold=S.business.soldVehicles().sort((a,b)=>(b.saleDate||'').localeCompare(a.saleDate||'')).slice(0,5);
    rs.innerHTML=sold.length?sold.map(v=>{const info=S.salesInfo(v);const photoUrl=getVehiclePhoto(v);return`<div class="wrow" onclick="App.nav('vehicle','${v.id}')"><div class="ic"><img class="dash-img" data-vid="${v.id}" src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.onerror=null;this.src='${vehPhoto(v)}'"></div><div class="main"><div class="t">${S.vehicleName(v)}</div><div class="s">Sold ${v.saleDate} · ${v.buyer||'—'}</div></div><div class="val"><div class="l">Profit</div><span class="${info.profit>=0?'pos':'neg'}">${S.money(info.profit)}</span></div></div>`;}).join(''):'<div class="empty-state"><div class="ei"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h4>No sales yet</h4><p>Sell a vehicle to see your profit data here.</p></div>';
  }
  // Alerts
  const da=$('#dashAlerts');
  if(da){
    const al=S.alerts().slice(0,5);
    const iconMap={clock:'M12 6v6l4 2',wrench:'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',receipt:'M4 4h16v16H4z'};
    da.innerHTML=al.map(a=>`<div class="wrow"><div class="ic" style="background:var(--warn-soft);color:var(--warn)"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="${iconMap[a.icon]||iconMap.clock}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="main"><div class="t">${a.title}</div><div class="s">${a.sub}</div></div></div>`).join('');
  }
  // Dashboard range pills
  bindRangePills('#dashRange', range=>{
    const rc=$('#revChart');
    if(rc) C.area(rc,S.business.revenueSeries(range),{color:getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(),zeroBaseline:true,secondaryPoints:S.business.projectedRevenueSeries(range),secondaryColor:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),legend:[{label:'Realized',color:getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()},{label:'Projected exit',color:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),dashed:true}]});
    const pc=$('#profitChart');
    if(pc) C.area(pc,S.business.profitSeries(range),{color:getComputedStyle(document.documentElement).getPropertyValue('--pos').trim()});
  });
}

function bindRangePills(sel,fn){
  const el=$(sel); if(!el) return;
  el.addEventListener('click',e=>{
    const btn=e.target.closest('button'); if(!btn) return;
    el.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    fn(btn.dataset.r);
  });
}

/* ================================================================
   VIEW: INVENTORY
   ================================================================ */
let invFilter={search:'',status:'',make:'',sort:'newest'};
function renderInventory(){
  let vehicles=[...S.state.vehicles];
  const f=invFilter;
  if(f.search){const q=f.search.toLowerCase();vehicles=vehicles.filter(v=>S.vehicleName(v).toLowerCase().includes(q)||(v.vin||'').toLowerCase().includes(q));}
  if(f.status) vehicles=vehicles.filter(v=>v.status===f.status);
  if(f.make) vehicles=vehicles.filter(v=>v.make===f.make);
  // sort
  switch(f.sort){
    case 'price_asc': vehicles.sort((a,b)=>(a.purchasePrice||0)-(b.purchasePrice||0)); break;
    case 'price_desc': vehicles.sort((a,b)=>(b.purchasePrice||0)-(a.purchasePrice||0)); break;
    case 'profit': vehicles.sort((a,b)=>{const pa=S.estimatedSalesInfo(a).profit,pb=S.estimatedSalesInfo(b).profit;return pb-pa;}); break;
    case 'days': vehicles.sort((a,b)=>daysOld(b)-daysOld(a)); break;
    case 'mileage': vehicles.sort((a,b)=>(a.mileage||0)-(b.mileage||0)); break;
    default: vehicles.sort((a,b)=>(b.purchaseDate||'').localeCompare(a.purchaseDate||''));
  }
  const inv=S.business.inventorySnapshot();
  const makes=[...new Set(S.state.vehicles.map(v=>v.make).filter(Boolean))].sort();
  return `
  <div class="view-pad fade-in">
    <div class="page-head"><div class="page-title">Inventory</div><div class="spacer"></div>
      ${S.state.vehicles.length>0?`<button class="btn danger" onclick="if(confirm('Delete EVERYTHING? Vehicles, expenses, watchlist — all gone.')){App.resetAll()}">Start Fresh</button>`:''}
      <button class="btn primary" onclick="App.modalAddVehicle()"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Add Vehicle</button>
    </div>
    <div class="stat-strip mb-20 stagger">
      <div class="cell"><div class="lbl">Vehicles</div><div class="v tnum">${inv.count}</div></div>
      <div class="cell"><div class="lbl">Invested</div><div class="v tnum">${S.money(inv.invested)}</div></div>
      <div class="cell"><div class="lbl">Estimated Value</div><div class="v tnum">${S.money(inv.estValue)}</div></div>
    </div>
    <div class="filters mb-16">
      <input class="inp" style="max-width:260px" placeholder="Search vehicles…" data-inv-search value="${f.search||''}">
      <select class="inp" style="max-width:160px" data-inv-status><option value="">All statuses</option>${Object.keys(V).map(k=>`<option value="${k}"${f.status===k?' selected':''}>${V[k].label}</option>`).join('')}</select>
      <select class="inp" style="max-width:160px" data-inv-make><option value="">All makes</option>${makes.map(m=>`<option value="${m}"${f.make===m?' selected':''}>${m}</option>`).join('')}</select>
      <select class="inp" style="max-width:160px" data-inv-sort><option value="newest"${f.sort==='newest'?' selected':''}>Newest first</option><option value="price_desc"${f.sort==='price_desc'?' selected':''}>Highest price</option><option value="price_asc"${f.sort==='price_asc'?' selected':''}>Lowest price</option><option value="profit"${f.sort==='profit'?' selected':''}>Best profit</option><option value="days"${f.sort==='days'?' selected':''}>Longest held</option><option value="mileage"${f.sort==='mileage'?' selected':''}>Lowest mileage</option></select>
    </div>
    <div class="veh-grid stagger">${vehicles.length?vehicles.map(v=>vehCard(v)).join(''):`<div class="empty-state" style="grid-column:1/-1"><div class="ei"><svg viewBox="0 0 24 24" fill="none"><path d="M5 11l1.3-3.5A2 2 0 018.2 6h7.6a2 2 0 011.9 1.5L19 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h4>No vehicles found</h4><p>Add your first vehicle to get started.</p><button class="btn primary mt-12" onclick="App.modalAddVehicle()">Add Vehicle</button></div>`}</div>
  </div>`;
}
function vehCard(v){
  const e=S.estimatedSalesInfo(v);
  const photoSrc=getVehiclePhoto(v);
  const html=`<div class="veh" onclick="App.nav('vehicle','${v.id}')">
    <div class="ph"><img class="veh-img" data-vid="${v.id}" src="${photoSrc}" alt="${S.vehicleName(v)}"><div class="st"><span class="sd ${V[v.status]?.cls||'s-just'}"></span>${V[v.status]?.label||''}</div>${daysOld(v)>0?`<div class="days">${daysOld(v)}d</div>`:''}
    <button class="veh-del" onclick="event.stopPropagation();App.deleteVehicleWithUndo('${v.id}')" title="Delete vehicle" aria-label="Delete ${S.vehicleName(v)}">
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
    </div>
    <div class="body"><div class="nav-t">${v.seller||v.location||'Private acquisition'}</div><div class="nm">${S.vehicleName(v)}</div>
    <div class="meta"><span>${v.mileage?S.round(v.mileage/1000,1)+'k mi':'Mileage —'}</span><span class="dot"></span><span>${v.condition||'Condition —'}</span><span class="dot"></span><span>${daysOld(v)>=45?'Stale':daysOld(v)>=21?'Attention':'Fresh'}</span></div>
    <div class="fin"><div class="blk"><div class="l">Invested</div><div class="v">${S.money(S.totalInvestment(v))}</div></div>
    <div class="blk right"><div class="l">Days in stock</div><div class="v tnum">${daysOld(v)}d</div></div></div>
    <div class="veh-card-cta"><span>Open full deal workspace</span><span>→</span></div></div>
  </div>`;
  return html;
}
function mountInventory(){
  const qs=(s)=>$(s); 
  const deb=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
  const reRender=deb(()=>{const el=viewEl();if(el&&currentView==='inventory'){el.innerHTML=renderInventory();mountInventory();}},200);
  $('[data-inv-search]')?.addEventListener('input',e=>{invFilter.search=e.target.value;reRender();});
  $('[data-inv-status]')?.addEventListener('change',e=>{invFilter.status=e.target.value;reRender();});
  $('[data-inv-make]')?.addEventListener('change',e=>{invFilter.make=e.target.value;reRender();});
  $('[data-inv-sort]')?.addEventListener('change',e=>{invFilter.sort=e.target.value;reRender();});
}

/* ================================================================
   VIEW: VEHICLE DETAIL
   ================================================================ */
function renderVehicle(id){
  const v=Store.state.vehicles.find(x=>x.id===id)||S.getVehicle(id);
  if(!v) return `<div class="view-pad"><div class="empty-state"><div class="ei"><svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div><h4>Vehicle not found</h4><p>This vehicle may have been deleted or has a corrupted ID.</p><button class="btn primary mt-12" onclick="App.nav('inventory')">Back to Inventory</button></div></div>`;
  const info=S.salesInfo(v);
  const est=S.estimatedSalesInfo(v);
  const costs=S.vehicleCosts(v);
  const rec=S.priceRecommendation(v);
  const mv=S.estimateMarketValue(v);
  const comps=S.findComps(v);
  const ti=S.totalInvestment(v);
  const isSold=v.status==='sold';
  const marketFactor=mv.factors||{};
  const nextActions=[];
  if(!isSold){
    if(est.profit<=0) nextActions.push('Re-check acquisition price before adding more capital.');
    if((v.status==='needs_repairs'||v.status==='being_repaired')) nextActions.push('Finish repairs and update actual costs before pricing the exit.');
    if((v.status==='just_purchased'||v.status==='needs_inspection')) nextActions.push('Complete inspection and document condition before locking in the list price.');
    nextActions.push('Verify 3–5 live Charlotte comparables before listing.');
  } else nextActions.push('Compare realized profit with your estimate to tighten future buy limits.');

  const costFields=[
    {key:'repairCost',label:'Repairs'},{key:'partsCost',label:'Parts'},{key:'laborCost',label:'Labor'},
    {key:'transportCost',label:'Transportation'},{key:'auctionFees',label:'Auction Fees'},{key:'dealerFees',label:'Dealer Fees'},
    {key:'taxes',label:'Taxes'},{key:'registrationCost',label:'Registration / Title'},{key:'advertisingCost',label:'Advertising'},
    {key:'detailingCost',label:'Detailing'},{key:'otherFees',label:'Other Fees'},{key:'miscCost',label:'Miscellaneous'}
  ];
  const timeline=v.timeline||[];

  return `
  <div class="view-pad fade-in">
    <div class="page-head"><div class="page-title"><div class="crumb"><a onclick="App.nav('inventory')">Inventory</a> / <span>${S.vehicleName(v)}</span></div></div><div class="spacer"></div>
      ${!isSold?`<button class="btn subtle" onclick="App.modalRecordSale('${v.id}')"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>Record Sale</button>`:''}
      <button class="btn ghost" onclick="App.modalEditVehicle('${v.id}')">Edit</button>
      <button class="btn danger sm" onclick="App.deleteVehicleWithUndo('${v.id}')">Delete</button>
    </div>

    <div class="vehicle-hero-panel mb-20">
      <div class="vehicle-hero-image"><img class="vehicle-main-photo" data-vid="${v.id}" src="${getVehiclePhoto(v)}" alt="${S.vehicleName(v)}" onerror="this.onerror=null;this.src='${vehPhoto(v)}'"></div>
      <div class="vehicle-hero-copy">
        <div class="eyebrow">Charlotte inventory · ${isSold?'Sold':'Active'}</div>
        <h1>${S.vehicleName(v)}</h1>
        <div class="hero-tags"><span>${v.year||'—'}</span><span>${v.condition||'—'}</span><span>${v.mileage?S.money(v.mileage)+' mi':'Mileage —'}</span><span>${v.location||'Charlotte, NC'}</span></div>
        <div class="hero-actions">
          ${!isSold?`<button class="btn primary" onclick="App.modalRecordSale('${v.id}')">Record Sale</button>`:''}
          <button class="btn subtle" onclick="App.modalEditVehicle('${v.id}')">Edit Vehicle</button>
          <button class="btn ghost" onclick="App.modalVehicleDetails('${v.id}')">Full Details</button>
        </div>
      </div>
    </div>

    <div class="vehicle-insight-grid mb-20">
      <div class="insight-card"><div class="insight-kicker">Market Range</div><div class="insight-value">${S.money(rec.marketMid)}</div><div class="insight-sub">${S.money(rec.marketLow)} – ${S.money(rec.marketHigh)}</div><div class="market-source">Blended from ${rec.marketplaces?.length||8} marketplaces · ${marketFactor.localMarket?'Local model':'Benchmark'}</div></div>
      <div class="insight-card"><div class="insight-kicker">Suggested Buy</div><div class="insight-value">${S.money(rec.suggestedPurchase)}</div><div class="insight-sub">18% target resale margin</div></div>
      <div class="insight-card"><div class="insight-kicker">Expected Exit</div><div class="insight-value">${S.money(rec.expectedNegotiated)}</div><div class="insight-sub">Negotiation-adjusted</div></div>
      <div class="insight-card"><div class="insight-kicker">Outcome</div><div class="insight-value ${(isSold?info.profit:est.profit)>=0?'positive':'negative'}">${S.money(isSold?info.profit:est.profit)}</div><div class="insight-sub">ROI ${isSold?(info.roi==null?'—':S.pct(info.roi)):(est.roi==null?'—':S.pct(est.roi))} · Margin ${isSold?(info.margin==null?'—':S.pct(info.margin)):(est.margin==null?'—':S.pct(est.margin))}</div></div>
    </div>

    <div class="stat-strip mb-20">
      <div class="cell"><div class="lbl">Purchase Price</div><div class="v tnum">${S.money(v.purchasePrice)}</div><div class="sub">${v.purchaseDate||''}</div></div>
      <div class="cell"><div class="lbl">Total Cost</div><div class="v tnum">${S.money(ti)}</div><div class="sub">${Object.keys(costs.categories).filter(k=>costs.categories[k]>0).length} categories</div></div>
      <div class="cell"><div class="lbl">${isSold?'Sale Price':'List Price'}</div><div class="v tnum">${isSold?S.money(info.sale):S.money(v.listPrice||0)}</div></div>
    </div>

    <div class="grid-23 gap-16 mb-20">
      <div class="col gap-16">
        <div class="card"><div class="card-head"><h3>Vehicle Information</h3></div><div class="card-body">
          <div class="grid-form">
            <div class="field"><label>Status</label><div>${statBadge(v)}</div></div>
            ${!isSold?`<div class="field"><label>Change Status</label><select class="inp" data-veh-field="status" data-veh-id="${v.id}">${Object.keys(V).map(k=>`<option value="${k}"${v.status===k?' selected':''}>${V[k].label}</option>`).join('')}</select></div>`:''}
            <div class="field"><label>Year</label><div class="tnum">${v.year||'—'}</div></div>
            <div class="field"><label>Make</label><div>${v.make||'—'}</div></div>
            <div class="field"><label>Model</label><div>${v.model||'—'}</div></div>
            <div class="field"><label>Trim</label><div>${v.trim||'—'}</div></div>
            <div class="field"><label>VIN</label><div class="mono" style="font-size:12px">${v.vin||'—'}</div></div>
            <div class="field"><label>Mileage</label><div class="tnum">${v.mileage?S.round(v.mileage/1000,1)+'k':'—'}</div></div>
            <div class="field"><label>Condition</label><div>${v.condition||'—'}</div></div>
            <div class="field"><label>Seller</label><div>${v.seller||'—'}</div></div>
            <div class="field"><label>Location</label><div>${v.location||'—'}</div></div>
            ${v.damage?`<div class="field col-2"><label>Damage</label><div style="font-size:13px;line-height:1.5">${v.damage}</div></div>`:''}
            ${v.notes?`<div class="field col-2"><label>Notes</label><div style="font-size:13px;line-height:1.5">${v.notes}</div></div>`:''}
          </div>
        </div></div>

        <div class="card"><div class="card-head"><h3>Photos</h3></div><div class="card-body">
          <input type="file" id="photoUploadInput" accept="image/*" capture="environment" style="display:none">
          <div class="gallery">
          ${(v.photos&&v.photos.length)?v.photos.map((p,i)=>`<div class="gcell"><img class="detail-img" data-vid="${v.id}" src="${p}" alt="Photo ${i+1}" onerror="this.onerror=null;this.src='${vehPhoto(v)}'"></div>`).join(''):`<div class="gcell"><img class="detail-img" data-vid="${v.id}" src="${vehPhoto(v)}" alt="${S.vehicleName(v)}"></div>`}
          <div class="gcell gadd" id="photoUploadBtn" data-vid="${v.id}"><svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Add Photo</div>
        </div></div></div>

        <div class="card"><div class="card-head"><h3>Financial Breakdown</h3></div><div class="card-body">
          <div class="kv"><span class="k">Purchase Price</span><span class="v tnum">${S.money(v.purchasePrice)}</span></div>
          ${costFields.filter(f=>v[f.key]>0).map(f=>`<div class="kv"><span class="k">${f.label}</span><span class="v tnum">${S.money(v[f.key])}</span></div>`).join('')}
          <div class="divider"></div>
          <div class="kv"><span class="k bold">Total Investment</span><span class="v tnum bold">${S.money(ti)}</span></div>
          ${isSold?`<div class="kv"><span class="k">Selling Fees</span><span class="v tnum">${S.money(v.sellingFees||0)}</span></div><div class="kv"><span class="k bold">Total Cost</span><span class="v tnum bold">${S.money(info.totalCost)}</span></div><div class="kv"><span class="k">Sale Price</span><span class="v tnum">${S.money(info.sale)}</span></div><div class="kv"><span class="k bold">Net Profit</span><span class="v tnum bold" style="color:${info.profit>=0?'var(--pos)':'var(--neg)'}">${S.money(info.profit)}</span></div>`:''}
        </div></div>
      </div>

      <div class="col gap-16">
        <div class="card market-intel-card"><div class="card-head"><h3>Marketplace Price Comparison</h3><span class="badge brand">${rec.marketplaces?.length||8} sources</span></div><div class="card-body">
          <div class="marketplace-comparison-grid">
            ${(rec.marketplaces||[]).map(mp => `
              <div class="mp-row" onclick="window.open('${mp.url}','_blank')" style="cursor:pointer">
                <div class="mp-info">
                  <span class="mp-name">${S.esc(mp.name)}</span>
                  <span class="mp-tag badge ${mp.tag==='Auction'?'warn':mp.tag==='Local'?'accent':'brand'}">${S.esc(mp.tag)}</span>
                </div>
                <div class="mp-details">
                  <span class="mp-buyer">${S.esc(mp.buyerType)}</span>
                  <span class="mp-fees">${S.esc(mp.feeNote)}</span>
                </div>
                <div class="mp-price tnum">${S.money(mp.estimatedPrice)}</div>
                <div class="mp-vs ${mp.vsBase>=0?'pos':'neg'}">${mp.vsBase>=0?'+':''}${mp.vsBase}%</div>
              </div>
            `).join('')}
          </div>
          <div class="market-note" style="margin-top:14px">Click any marketplace to search live ${S.vehicleName(v)} listings in Charlotte. Prices are algorithmic estimates based on your vehicle's year, mileage, condition, damage, and title status.</div>
        </div></div>

        <div class="card"><div class="card-head"><h3>Comparable Vehicles Found</h3>${comps.length?`<span class="badge brand">${comps.length} matches</span>`:'<span class="badge neutral">No matches</span>'}</div><div class="card-body">
          ${comps.length?`
          <div class="market-note" style="margin-bottom:12px">Similar ${v.year||''} ${v.make||''} ${v.model||''} vehicles from embedded Charlotte market data — used to anchor the price estimate.</div>
          <div class="comps-grid">
            ${comps.map(c=>`
              <div class="comp-card" onclick="window.open('${S.esc(c.url)}','_blank')" style="cursor:pointer">
                <div class="comp-header">
                  <span class="comp-name">${S.esc(c.name)}</span>
                  <span class="comp-badge badge brand">Exact match</span>
                </div>
                <div class="comp-price tnum">${S.money(c.price)}</div>
                <div class="comp-meta">
                  ${c.mileage?`<span>${(c.mileage/1000).toFixed(0)}k mi</span>`:''}
                  <span>${S.esc(c.source)}</span>
                  ${c.titleStatus&&c.titleStatus!=='clean'?`<span class="comp-salvage">${S.esc(c.titleStatus)}</span>`:''}
                </div>
                <div class="comp-note">${S.esc(c.note||'')}</div>
              </div>
            `).join('')}
          </div>
          `:`
          <div class="empty-state" style="padding:20px;text-align:center">
            <div style="font-size:24px;margin-bottom:8px;opacity:.4">🔍</div>
            <div style="font-size:13px;font-weight:700;margin-bottom:4px">No ${v.year||''} ${v.make||''} ${v.model||''} comparables found</div>
            <div style="font-size:12px;color:var(--text-3)">No matching vehicles of this exact year/make/model exist in the embedded market snapshot. The price estimate is based on model averages and depreciation curves.</div>
          </div>
          `}
        </div></div>

        ${timeline.length?`<div class="card"><div class="card-head"><h3>Timeline</h3></div><div class="card-body"><div class="timeline">${timeline.map((t,i)=>`<div class="tl-item ${i===timeline.length-1?'current':'done'}"><div class="tl-date">${t.date||''}</div><div class="tl-t">${t.event}</div>${t.note?`<div class="tl-s">${t.note}</div>`:''}</div>`).join('')}</div></div></div>`:''}

        <div class="card next-actions-card"><div class="card-head"><h3>Recommended Next Steps</h3></div><div class="card-body">
          ${nextActions.map((a,i)=>`<div class="next-action"><span>${i+1}</span><div>${a}</div></div>`).join('')}
        </div></div>
        <div class="card"><div class="card-head"><h3>Expenses</h3><button class="btn subtle sm" onclick="App.modalAddExpense('${v.id}')">+ Add</button></div>
          <div id="vehExpenses">${(S.state.expenses||[]).filter(e=>e.vehicleId===v.id).map(e=>`<div class="wrow"><div class="ic" style="background:${(EC[e.category]||{}).color||'var(--text-3)'}20;color:${(EC[e.category]||{}).color||'var(--text-3)'}"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div><div class="main"><div class="t">${(EC[e.category]||{}).label||e.category}</div><div class="s">${e.date||''} · ${e.description||''}</div></div><div class="val tnum">${S.money(e.amount)}</div></div>`).join('')||'<div style="padding:16px;text-align:center;color:var(--text-3);font-size:13px">No expenses recorded</div>'}</div>
        </div>
      </div>
    </div>
  </div>`;
}
function mountVehicle(){
  $$('[data-veh-field="status"]').forEach(sel=>{
    sel.addEventListener('change',async e=>{
      const vid=e.target.dataset.vehId;
      try {
        await S.updateVehicle(vid,{status:e.target.value});
        App.toast('Status updated','ok');
        render();
      } catch(err) { App.toast(err.message,'err'); }
    });
  });
  // Photo upload handler
  const photoInput=$('#photoUploadInput');
  const photoBtn=$('#photoUploadBtn');
  if(photoBtn&&photoInput){
    photoBtn.addEventListener('click',()=>photoInput.click());
    photoBtn.style.cursor='pointer';
    photoInput.addEventListener('change',async e=>{
      const file=e.target.files[0];
      if(!file) return;
      const vid=photoBtn.dataset.vid;
      photoBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" width="20" height="20" style="animation:spin 1s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Uploading...';
      photoBtn.style.pointerEvents='none';
      try{
        await S.uploadPhoto(vid,file);
        App.toast('Photo uploaded','ok');
        render();
      }catch(err){ App.toast('Upload failed: '+err.message,'err'); photoBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Add Photo'; photoBtn.style.pointerEvents=''; }
      photoInput.value='';
    });
  }
}

/* ================================================================
   VIEW: CAR SEARCH (Lot Finder)
   ================================================================ */
let searchState={make:'any',car:'',yearFrom:'',yearTo:'',priceMin:'',priceMax:'',condition:'any',clCity:'charlotte',radius:'50'};
const CLT_AREAS=['charlotte','concord','gastonia','mooresville','huntersville','matthews','monroe','rock-hill','salisbury','asheboro','statesville','lincolnton','shelby','kannapolis','hickory'];
const searchSites=[
  {name:'Facebook Marketplace',tag:'Local',tier:'direct',detail:'Charlotte metro area — price filters apply',build(ctx){let u=`https://www.facebook.com/marketplace/charlotte/search/?query=${encodeURIComponent(ctx.fullText)}`;if(ctx.priceMin)u+=`&minPrice=${ctx.priceMin}`;if(ctx.priceMax)u+=`&maxPrice=${ctx.priceMax}`;return u;}},
  {name:'Craigslist Charlotte',tag:'Classifieds',tier:'direct',detail:'Direct search — filters in URL',build(ctx){let q=`query=${encodeURIComponent(ctx.fullText)}`;if(ctx.priceMin)q+=`&min_price=${ctx.priceMin}`;if(ctx.priceMax)q+=`&max_price=${ctx.priceMax}`;return`https://charlotte.craigslist.org/search/cta?${q}`;}},
  {name:'Craigslist Greensboro',tag:'Classifieds',tier:'direct',detail:'Asheboro / Triad area',build(ctx){let q=`query=${encodeURIComponent(ctx.fullText)}`;if(ctx.priceMin)q+=`&min_price=${ctx.priceMin}`;if(ctx.priceMax)q+=`&max_price=${ctx.priceMax}`;return`https://greensboro.craigslist.org/search/cta?${q}`;}},
  {name:'Craigslist Hickory',tag:'Classifieds',tier:'direct',detail:'Western NC area',build(ctx){let q=`query=${encodeURIComponent(ctx.fullText)}`;if(ctx.priceMin)q+=`&min_price=${ctx.priceMin}`;if(ctx.priceMax)q+=`&max_price=${ctx.priceMax}`;return`https://hickory.craigslist.org/search/cta?${q}`;}},
  {name:'OfferUp',tag:'Local',tier:'direct',detail:'Charlotte area — price range applied',build(ctx){let u=`https://offerup.com/search?q=${encodeURIComponent(ctx.fullText)}&location=charlotte`;if(ctx.priceMin)u+=`&PRICE_MIN=${ctx.priceMin}`;if(ctx.priceMax)u+=`&PRICE_MAX=${ctx.priceMax}`;return u;}},
  {name:'Copart',tag:'Auction',tier:'text',detail:'Live auction bids — not fixed price',build(ctx){return`https://www.copart.com/lotSearchResults?free=true&query=${encodeURIComponent(ctx.fullText)}&location=charlotte`;}},
  {name:'IAAI (Insurance Auto)',tag:'Auction',tier:'text',detail:'Salvage auctions — Charlotte',build(ctx){return`https://www.iaai.com/Vehicles/Search?Keywords=${encodeURIComponent(ctx.fullText)}`;}},
  {name:'CarGurus',tag:'Marketplace',tier:'direct',detail:'Charlotte area deals',build(ctx){let u=`https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?zip=28202&showNegotiable=true&sortDir=ASC&sourceContext=carGurusHomePageModel&distance=${ctx.radius||'50'}&sortType=DEAL_SCORE&entitySelectingHelper.selectedEntity=${encodeURIComponent(ctx.fullText)}`;return u;}},
  {name:'Autotrader',tag:'Marketplace',tier:'direct',detail:'Charlotte NC listings',build(ctx){return`https://www.autotrader.com/cars-for-sale/all-cars/${encodeURIComponent(ctx.fullText.replace(/\s+/g,'-').toLowerCase())}/charlotte-nc-28202?searchRadius=${ctx.radius||'50'}`;}},
  {name:'Cars.com',tag:'Marketplace',tier:'direct',detail:'Near Charlotte, NC',build(ctx){return`https://www.cars.com/shopping/results/?keyword=${encodeURIComponent(ctx.fullText)}&zip=28202&maximum_distance=${ctx.radius||'50'}`;}},
  {name:'Carvana',tag:'Online Dealer',tier:'text',detail:'Delivers to Charlotte area',build(ctx){return`https://www.carvana.com/cars/${encodeURIComponent(ctx.fullText.replace(/\s+/g,'-').toLowerCase())}`;}},
  {name:'TrueCar',tag:'Marketplace',tier:'text',detail:'New & used — Charlotte area pricing',build(ctx){return`https://www.truecar.com/used-cars-for-sale/listings/${encodeURIComponent(ctx.fullText.replace(/\s+/g,'-').toLowerCase())}/buyer-market/charlotte-nc/`;}},
  {name:'CarFax',tag:'Research',tier:'text',detail:'Vehicle history & listings',build(ctx){return`https://www.carfax.com/Used-${encodeURIComponent(ctx.fullText.replace(/\s+/g,'_'))}_w282`;}},
  {name:'Edmunds',tag:'Research',tier:'text',detail:'Pricing & used car listings',build(ctx){return`https://www.edmunds.com/inventory/srp.html?make=${encodeURIComponent(ctx.make||'')}&model=${encodeURIComponent(ctx.car||'')}&radius=${ctx.radius||'50'}&zip=28202`;}}
];
function searchBuildCtx(){
  const s=searchState;
  const make=s.make==='any'?'':s.make;
  const parts=[make,s.car,s.yearFrom&&s.yearTo&&s.yearFrom!==s.yearTo?`${s.yearFrom}-${s.yearTo}`:(s.yearFrom||s.yearTo||'')];
  return{make,car:s.car,fullText:parts.filter(Boolean).join(' '),priceMin:s.priceMin,priceMax:s.priceMax,yearFrom:s.yearFrom,yearTo:s.yearTo,clCity:s.clCity||'charlotte',radius:s.radius||'50'};
}
function renderSearch(){
  const s=searchState, ctx=searchBuildCtx();
  const makes=['any',...S.MAKES];
  const years=['',...Array.from({length:27},(_,i)=>String(2027-i))];
  const prices=['','500','1000','2000','3000','5000','7500','10000','15000','20000','25000','30000','40000','50000'];
  const radii=['25','50','75','100','150'];
  return `
  <div class="view-pad fade-in">
    <div class="page-head"><div class="page-title">Car Search</div><div class="page-sub">Search ${searchSites.length} marketplaces across the Charlotte, NC area</div></div>
    <div class="grid-23 gap-16">
      <div class="card" style="height:fit-content"><div class="card-head"><h3>Search Filters</h3></div><div class="card-body">
        <div class="field"><label>Car / Model</label><input class="inp" data-sr="car" value="${s.car}" placeholder="e.g. Accord, Silverado, WRX"></div>
        <div class="grid-form">
          <div class="field"><label>Make</label><select class="inp" data-sr="make">${makes.map(m=>`<option value="${m}"${s.make===m?' selected':''}>${m==='any'?'Any Make':m}</option>`).join('')}</select></div>
          <div class="field"><label>Condition</label><select class="inp" data-sr="condition"><option value="any">Any</option><option value="clean"${s.condition==='clean'?' selected':''}>Clean title</option><option value="salvage"${s.condition==='salvage'?' selected':''}>Salvage</option><option value="rebuilt"${s.condition==='rebuilt'?' selected':''}>Rebuilt</option></select></div>
          <div class="field"><label>Year from</label><select class="inp" data-sr="yearFrom">${years.map(y=>`<option value="${y}"${s.yearFrom===y?' selected':''}>${y||'Any'}</option>`).join('')}</select></div>
          <div class="field"><label>Year to</label><select class="inp" data-sr="yearTo">${years.map(y=>`<option value="${y}"${s.yearTo===y?' selected':''}>${y||'Any'}</option>`).join('')}</select></div>
          <div class="field"><label>Price min</label><select class="inp" data-sr="priceMin">${prices.map(p=>`<option value="${p}"${s.priceMin===p?' selected':''}>${p?'$'+Number(p).toLocaleString():'No min'}</option>`).join('')}</select></div>
          <div class="field"><label>Price max</label><select class="inp" data-sr="priceMax">${prices.map(p=>`<option value="${p}"${s.priceMax===p?' selected':''}>${p?'$'+Number(p).toLocaleString():'No max'}</option>`).join('')}</select></div>
          <div class="field"><label>Search Radius</label><select class="inp" data-sr="radius">${radii.map(r=>`<option value="${r}"${s.radius===r?' selected':''}>${r} miles</option>`).join('')}</select></div>
          <div class="field"><label>Area</label><select class="inp" data-sr="clCity">${CLT_AREAS.map(c=>`<option value="${c}"${s.clCity===c?' selected':''}>${c.split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}</option>`).join('')}</select></div>
        </div>
        <button class="btn primary block mt-16" data-sr-search>Search ${searchSites.length} Marketplaces</button>
      </div></div>
      <div>
        <div id="srResults">${ctx.fullText?renderSearchResults(ctx):'<div class="empty-state"><div class="ei"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.7"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div><h4>Search for cars in the Charlotte area</h4><p>Enter a make, model, or keyword and hit search to find listings across all major marketplaces near Charlotte, NC.</p></div>'}</div>
      </div>
    </div>
  </div>`;
}
function renderSearchResults(ctx){
  return `<div class="panel-title mb-12"><span class="bar"></span>${searchSites.length} sites · ${ctx.fullText} · ${ctx.radius||'50'}mi radius</div>
  <div class="veh-grid">${searchSites.map((site,i)=>`<div class="veh" style="cursor:pointer" data-search-url="${encodeURIComponent(site.build(ctx))}">
    <div class="body"><div class="nav-t">${site.tag}</div><div class="nm">${site.name}</div>
    <div class="meta"><span class="badge ${site.tier==='direct'?'brand':site.tier==='google'?'accent':'neutral'}">${site.tier==='direct'?'Direct Link':'Search'}</span></div>
    <div style="margin-top:10px;font-size:12.5px;color:var(--text-3)">${site.detail}</div>
    <div style="margin-top:14px;font-size:12.5px;font-weight:600;color:var(--brand)">Open search →</div>
    </div></div>`).join('')}</div>`;
}
function mountSearch(){
  $$('[data-sr]').forEach(el=>{
    el.addEventListener(el.tagName==='SELECT'?'change':'input',e=>{
      const f=e.target.dataset.sr;
      if(f) searchState[f]=e.target.value;
    });
  });
  $('[data-sr-search]')?.addEventListener('click',()=>{
    const ctx=searchBuildCtx();
    if(!ctx.fullText){App.toast('Enter a car or make first','warn');return;}
    const el=$('#srResults');if(el) el.innerHTML=renderSearchResults(ctx);
  });
  $('#srResults')?.addEventListener('click',e=>{
    const card=e.target.closest('[data-search-url]');
    if(card) window.open(decodeURIComponent(card.dataset.searchUrl),'_blank');
  });
}

/* ================================================================
   VIEW: WATCHLIST
   ================================================================ */
function renderWatchlist(){
  const items=S.state.watchlist||[];
  return `
  <div class="view-pad fade-in">
    <div class="page-head"><div class="page-title">Watchlist</div><div class="spacer"></div>
      <button class="btn primary" onclick="App.modalAddWatch()"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Add Deal</button></div>
    ${items.length?`<div class="card"><div class="card-body scroll-x"><table class="tbl"><thead><tr><th>Vehicle</th><th>Asking</th><th>Est. Value</th><th>Est. Profit</th><th>Seller</th><th>Location</th><th>Link</th><th>Added</th><th>Status</th><th></th></tr></thead><tbody>
    ${items.map(w=>`<tr>
      <td><span class="bold">${w.label||''}</span></td>
      <td class="num tnum">${S.money(w.askingPrice)}</td>
      <td class="num tnum">${S.money(w.estimatedValue)}</td>
      <td class="num tnum"><span class="${(w.estimatedProfit||0)>=0?'pos':'neg'}">${S.money(w.estimatedProfit)}</span></td>
      <td>${w.seller||'—'}</td><td>${w.location||'—'}</td>
      <td>${w.url?`<a href="${w.url}" target="_blank" class="btn link sm" style="padding:2px 8px">Open</a>`:'—'}</td>
      <td class="mute">${w.dateAdded||''}</td>
      <td><select class="inp" style="max-width:130px;padding:6px 8px;font-size:12px" data-watch-status="${w.id}">${WS.map(s=>`<option value="${s}"${w.status===s?' selected':''}>${s}</option>`).join('')}</select></td>
      <td><button class="btn danger sm" onclick="Store.deleteWatch('${w.id}').then(()=>App.refresh()).catch(e=>App.toast(e.message,'err'))">✕</button></td>
    </tr>`).join('')}
    </tbody></table></div></div>`
    :`<div class="empty-state"><div class="ei"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.6-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.4-7 10-7 10Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h4>Your watchlist is empty</h4><p>Track deals you're interested in and never lose sight of a good opportunity in the Charlotte area.</p><button class="btn primary mt-12" onclick="App.modalAddWatch()">Add Deal to Watchlist</button></div>`}
  </div>`;
}
function mountWatchlist(){
  $$('[data-watch-status]').forEach(sel=>{
    sel.addEventListener('change',async e=>{
      try {
        await S.updateWatch(e.target.dataset.watchStatus,{status:e.target.value});
        App.toast('Status updated','ok');
      } catch(err) { App.toast(err.message,'err'); }
    });
  });
}

/* ================================================================
   VIEW: ANALYTICS
   ================================================================ */
function renderAnalytics(){
  const m=S.business.lifetimeMetrics();
  const perf=S.business.vehiclePerformance();
  const best=[...perf].sort((a,b)=>b.profit-a.profit).slice(0,5);
  const worst=[...perf].sort((a,b)=>a.profit-b.profit).slice(0,5);
  const fastest=[...perf].sort((a,b)=>a.days-b.days).slice(0,5);
  const slowest=[...perf].sort((a,b)=>b.days-a.days).slice(0,5);
  const eCat=S.business.expenseByCategory();
  const totalExpenses=Object.values(eCat).reduce((s,v)=>s+v,0);
  return `
  <div class="view-pad fade-in">
    <div class="page-head"><div class="page-title">Analytics</div></div>
    <div class="stat-strip mb-20 stagger">
      <div class="cell"><div class="lbl">Lifetime Profit</div><div class="v tnum" style="color:${m.profit>=0?'var(--pos)':'var(--neg)'}">${S.money(m.profit)}</div></div>
      <div class="cell"><div class="lbl">Total Revenue</div><div class="v tnum">${S.money(m.revenue)}</div></div>
      <div class="cell"><div class="lbl">Total Invested</div><div class="v tnum">${S.money(m.totalInvested)}</div></div>
      <div class="cell"><div class="lbl">Avg ROI</div><div class="v tnum">${m.avgRoi==null?'—':S.pct(m.avgRoi)}</div></div>
      <div class="cell"><div class="lbl">Avg Margin</div><div class="v tnum">${m.avgMargin==null?'—':S.pct(m.avgMargin)}</div></div>
    </div>
    <div class="grid2 mb-20">
      <div class="card"><div class="card-head"><h3>Revenue vs Expenses</h3></div><div class="card-body"><div class="chart-h" id="analyticsBarChart"></div></div></div>
      <div class="card"><div class="card-head"><h3>Profit Trend</h3></div><div class="card-body"><div class="chart-h" id="analyticsProfitChart"></div></div></div>
    </div>
    <div class="grid2 mb-20">
      <div class="card"><div class="card-head"><h3>Top Performers</h3></div><div class="card-body scroll-x"><table class="tbl"><thead><tr><th>Vehicle</th><th class="num">Profit</th><th class="num">ROI</th><th class="num">Days</th></tr></thead><tbody>
      ${best.map(p=>`<tr class="clickable" onclick="App.nav('vehicle','${p.id}')"><td>${p.name}</td><td class="num pos tnum">${S.money(p.profit)}</td><td class="num pos tnum">${S.roiDisplay(p.roi,p.totalInvestment)}</td><td class="num tnum">${p.days}</td></tr>`).join('')}
      ${best.length===0?'<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:20px">No sales data yet — sell some vehicles first</td></tr>':''}
      </tbody></table></div></div>
      <div class="card"><div class="card-head"><h3>Worst Performers</h3></div><div class="card-body scroll-x"><table class="tbl"><thead><tr><th>Vehicle</th><th class="num">Profit</th><th class="num">ROI</th><th class="num">Days</th></tr></thead><tbody>
      ${worst.map(p=>`<tr class="clickable" onclick="App.nav('vehicle','${p.id}')"><td>${p.name}</td><td class="num ${p.profit>=0?'pos':'neg'} tnum">${S.money(p.profit)}</td><td class="num ${p.roi>=0?'pos':'neg'} tnum">${S.roiDisplay(p.roi,p.totalInvestment)}</td><td class="num tnum">${p.days}</td></tr>`).join('')}
      ${worst.length===0?'<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:20px">No data yet</td></tr>':''}
      </tbody></table></div></div>
    </div>
    <div class="grid2">
      <div class="card"><div class="card-head"><h3>Fastest Selling</h3></div><div class="card-body scroll-x"><table class="tbl"><thead><tr><th>Vehicle</th><th class="num">Days</th><th class="num">Profit</th></tr></thead><tbody>
      ${fastest.map(p=>`<tr><td>${p.name}</td><td class="num tnum">${p.days}</td><td class="num ${p.profit>=0?'pos':'neg'} tnum">${S.money(p.profit)}</td></tr>`).join('')||'<tr><td colspan="3" style="text-align:center;color:var(--text-3);padding:20px">No data yet</td></tr>'}
      </tbody></table></div></div>
      <div class="card"><div class="card-head"><h3>Expense Breakdown</h3></div><div class="card-body">
        <div class="chart-h sm" id="analyticsExpDonut"></div>
        <div id="analyticsExpLegend" class="legend mt-12"></div>
      </div></div>
    </div>
  </div>`;
}
function mountAnalytics(){
  const now=new Date(),pts=[];
  for(let i=11;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const end=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59);
    let rev=0,inv=0;
    S.state.vehicles.forEach(v=>{
      if(v.saleDate){const sd=S.parseDate(v.saleDate);if(sd>=d&&sd<=end)rev+=Number(v.salePrice)||0;}
      if(v.purchaseDate){const pd=S.parseDate(v.purchaseDate);if(pd>=d&&pd<=end)inv+=S.totalInvestment(v);}
    });
    pts.push({label:S.fmtMonth(d),values:[rev,inv]});
  }
  const bc=$('#analyticsBarChart');
  if(bc) C.groupedBars(bc,pts,['Revenue','Investment'],{money:true});
  const pc=$('#analyticsProfitChart');
  if(pc) C.area(pc,S.business.profitSeries('1y'),{color:getComputedStyle(document.documentElement).getPropertyValue('--pos').trim(),money:true});
  const ed=$('#analyticsExpDonut');
  if(ed){
    const eCat=S.business.expenseByCategory();
    const segs=Object.keys(EC).filter(k=>k!=='purchase'&&eCat[k]>0).map(k=>({label:EC[k].label,value:eCat[k],color:EC[k].color}));
    C.donut(ed,segs,{centerLabel:S.money(Object.values(eCat).reduce((a,b)=>a+b,0)),centerSub:'all costs'});
    const lg=$('#analyticsExpLegend');
    if(lg) lg.innerHTML=segs.length?segs.map(s=>`<div class="li"><span class="sw" style="background:${s.color}"></span><span class="lab">${s.label}</span><span class="amt">${S.money(s.value)}</span></div>`).join(''):'<div class="muted txt-sm">No expense data yet.</div>';
  }
}

/* ================================================================
   VIEW: EXPENSES
   ================================================================ */
function renderExpenses(){
  const exps=S.state.expenses||[];
  const cat=S.business.expenseByCategory();
  const total=Object.values(cat).reduce((s,v)=>s+v,0);
  const heldVehicles=S.business.heldVehicles();
  const vehicleCostsList=heldVehicles.map(v=>({name:S.vehicleName(v),total:S.totalInvestment(v),costs:S.vehicleCosts(v),purchasePrice:+v.purchasePrice||0})).filter(v=>v.total>0).sort((a,b)=>b.total-a.total);
  return `
  <div class="view-pad fade-in">
    <div class="page-head"><div class="page-title">Expenses</div><div class="spacer"></div>
      <button class="btn primary" onclick="App.modalAddExpense()"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Add Expense</button></div>
    <div class="stat-strip mb-20 stagger">
      <div class="cell"><div class="lbl">Total Expenses</div><div class="v tnum">${S.money(total)}</div></div>
      <div class="cell"><div class="lbl">Purchase Costs</div><div class="v tnum">${S.money(cat.purchase)}</div></div>
      <div class="cell"><div class="lbl">Repair Costs</div><div class="v tnum">${S.money((cat.repairs||0)+(cat.parts||0)+(cat.labor||0))}</div></div>
      <div class="cell"><div class="lbl">Transport & Fees</div><div class="v tnum">${S.money((cat.transport||0)+(cat.auction||0)+(cat.dealer||0)+(cat.taxes||0)+(cat.registration||0))}</div></div>
    </div>
    ${vehicleCostsList.length?`
    <div class="card mb-20"><div class="card-head"><h3>Vehicle Investment Summary</h3><div class="spacer"></div><span class="badge neutral">${vehicleCostsList.length} vehicles</span></div><div class="card-body scroll-x"><table class="tbl"><thead><tr><th>Vehicle</th><th class="num">Purchase</th><th class="num">Repairs</th><th class="num">Parts/Labor</th><th class="num">Transport/Fees</th><th class="num">Other</th><th class="num bold">Total Invested</th></tr></thead><tbody>
    ${vehicleCostsList.map(v=>{const c=v.costs;return`<tr>
      <td class="bold">${v.name}</td>
      <td class="num tnum">${S.money(v.purchasePrice)}</td>
      <td class="num tnum">${S.money((c.categories.repairs||0)+(c.categories.parts||0))}</td>
      <td class="num tnum">${S.money(c.categories.labor||0)}</td>
      <td class="num tnum">${S.money((c.categories.transport||0)+(c.categories.auction||0)+(c.categories.dealer||0)+(c.categories.taxes||0)+(c.categories.registration||0))}</td>
      <td class="num tnum">${S.money((c.categories.advertising||0)+(c.categories.detailing||0)+(c.categories.misc||0))}</td>
      <td class="num tnum bold">${S.money(v.total)}</td>
    </tr>`}).join('')}
    <tr style="font-weight:700;background:var(--surface-2)"><td>Total</td><td class="num tnum">${S.money(vehicleCostsList.reduce((s,v)=>s+v.purchasePrice,0))}</td><td class="num tnum" colspan="4"></td><td class="num tnum">${S.money(vehicleCostsList.reduce((s,v)=>s+v.total,0))}</td></tr>
    </tbody></table></div></div>`:''}
    <div class="card"><div class="card-head"><h3>Expense History</h3></div><div class="card-body scroll-x">
      ${exps.length?`<table class="tbl"><thead><tr><th>Date</th><th>Category</th><th>Vehicle</th><th>Description</th><th class="num">Amount</th><th></th></tr></thead><tbody>
      ${exps.map(e=>{const veh=e.vehicleId?S.getVehicle(e.vehicleId):null;
        return`<tr><td class="mute">${e.date||''}</td><td><span class="badge neutral" style="background:${(EC[e.category]||{}).color||''}15;color:${(EC[e.category]||{}).color||''}">${(EC[e.category]||{}).label||e.category}</span></td><td>${veh?S.vehicleName(veh):'<span class="mute">Business</span>'}</td><td>${e.description||''}</td><td class="num tnum">${S.money(e.amount)}</td><td><button class="btn danger sm" onclick="Store.deleteExpense('${e.id}').then(()=>App.refresh()).catch(err=>App.toast(err.message,'err'))">✕</button></td></tr>`;
      }).join('')}
      </tbody></table>`:'<div class="empty-state"><div class="ei"><svg viewBox="0 0 24 24" fill="none"><path d="M3 7h18M5 7v10a1 1 0 001 1h12a1 1 0 001-1V7M8 11h8M8 15h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h4>No expenses yet</h4><p>Track your business expenses to get a clear picture of where your money goes.</p><button class="btn primary mt-12" onclick="App.modalAddExpense()">Add First Expense</button></div>'}
    </div></div>
  </div>`;
}

/* ================================================================
   VIEW: BUSINESS EXPENSES
   ================================================================ */
const BE_CATEGORIES = [
  {key:'food',label:'Food & Dining',color:'#f59e0b'},
  {key:'gas',label:'Gas & Fuel',color:'#10b981'},
  {key:'phone',label:'Phone & Internet',color:'#3b82f6'},
  {key:'software',label:'Software & Tools',color:'#8b5cf6'},
  {key:'office',label:'Office & Supplies',color:'#6366f1'},
  {key:'insurance',label:'Insurance',color:'#ef4444'},
  {key:'rent',label:'Rent & Storage',color:'#ec4899'},
  {key:'legal',label:'Legal & Fees',color:'#f97316'},
  {key:'marketing',label:'Marketing & Ads',color:'#14b8a6'},
  {key:'meals',label:'Client Meals',color:'#f43f5e'},
  {key:'travel',label:'Travel & Lodging',color:'#06b6d4'},
  {key:'education',label:'Training & Education',color:'#a855f7'},
  {key:'banking',label:'Bank & Finance Fees',color:'#64748b'},
  {key:'utilities',label:'Utilities',color:'#0ea5e9'},
  {key:'other',label:'Other',color:'#94a3b8'}
];
function renderBusinessExpenses(){
  const exps=S.state.businessExpenses||[];
  const catTotals={};
  BE_CATEGORIES.forEach(c=>catTotals[c.key]=0);
  exps.forEach(e=>{if(catTotals[e.category]!==undefined) catTotals[e.category]+=S.num(e.amount);});
  const total=Object.values(catTotals).reduce((s,v)=>s+v,0);
  const thisMonth=exps.filter(e=>{const d=new Date(e.date);const now=new Date();return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  const monthTotal=thisMonth.reduce((s,e)=>s+S.num(e.amount),0);
  const topCats=Object.entries(catTotals).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return `
  <div class="view-pad fade-in">
    <div class="page-head"><div class="page-title">Business Expenses</div><div class="spacer"></div>
      <button class="btn primary" onclick="App.modalAddBusinessExpense()"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Add Expense</button></div>
    <div class="stat-strip mb-20 stagger">
      <div class="cell"><div class="lbl">Total All-Time</div><div class="v tnum">${S.money(total)}</div></div>
      <div class="cell"><div class="lbl">This Month</div><div class="v tnum">${S.money(monthTotal)}</div></div>
      <div class="cell"><div class="lbl">Categories Used</div><div class="v tnum">${topCats.length}</div></div>
      <div class="cell"><div class="lbl">Total Entries</div><div class="v tnum">${exps.length}</div></div>
    </div>
    ${topCats.length?`<div class="grid2 mb-20">
      <div class="card"><div class="card-head"><h3>Spending by Category</h3></div><div class="card-body">
        ${topCats.map(([k,v])=>{const cat=BE_CATEGORIES.find(c=>c.key===k);const pct=total>0?(v/total*100):0;return`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;font-weight:700">${cat?.label||k}</span><span class="tnum" style="font-size:12px;font-weight:800">${S.money(v)}</span></div><div style="height:6px;border-radius:99px;background:var(--surface-2);overflow:hidden"><div style="height:100%;width:${pct}%;background:${cat?.color||'var(--brand)'};border-radius:99px;transition:width .4s"></div></div></div>`;}).join('')}
      </div></div>
      <div class="card"><div class="card-head"><h3>Recent Entries</h3></div><div class="card-body">
        ${exps.slice(0,5).map(e=>{const cat=BE_CATEGORIES.find(c=>c.key===e.category);return`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="width:32px;height:32px;border-radius:8px;display:grid;place-items:center;background:${cat?.color||'var(--brand)'}15;color:${cat?.color||'var(--brand)'}"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cat?.label||e.category}</div><div style="font-size:11px;color:var(--text-3)">${e.date||''} ${e.description?'· '+e.description:''}</div></div><div class="tnum" style="font-size:13px;font-weight:800">${S.money(e.amount)}</div></div>`;}).join('')}
      </div></div>
    </div>`:''}
    <div class="card"><div class="card-head"><h3>All Business Expenses</h3></div><div class="card-body scroll-x">
      ${exps.length?`<table class="tbl"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="num">Amount</th><th></th></tr></thead><tbody>
      ${exps.map(e=>{const cat=BE_CATEGORIES.find(c=>c.key===e.category);
        return`<tr><td class="mute">${e.date||''}</td><td><span class="badge neutral" style="background:${cat?.color||'var(--brand)'}15;color:${cat?.color||'var(--brand)'}">${cat?.label||e.category}</span></td><td>${e.description||''}</td><td class="num tnum">${S.money(e.amount)}</td><td><button class="btn danger sm" onclick="Store.deleteBusinessExpense('${e.id}').then(()=>App.refresh()).catch(err=>App.toast(err.message,'err'))">✕</button></td></tr>`;
      }).join('')}
      </tbody></table>`:'<div class="empty-state"><div class="ei"><svg viewBox="0 0 24 24" fill="none"><path d="M2 7h20v11a2 2 0 01-2 2H4a2 2 0 01-2-2V7zM16 11a4 4 0 01-8 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h4>No business expenses yet</h4><p>Track food, gas, software, insurance, and other operating costs.</p><button class="btn primary mt-12" onclick="App.modalAddBusinessExpense()">Add First Expense</button></div>'}
    </div></div>
  </div>`;
}

/* ================================================================
   MODALS
   ================================================================ */
const COMMON_MODELS={
  'Toyota':['Camry','Corolla','RAV4','Highlander','Tacoma','Tundra','4Runner','Prius','Avalon','Sienna','Supra','GR86'],
  'Honda':['Accord','Civic','CR-V','Pilot','Odyssey','HR-V','Ridgeline','Insight','Passport'],
  'Ford':['F-150','F-250','F-350','Explorer','Escape','Bronco','Mustang','Edge','Expedition','Ranger','Maverick','Transit'],
  'Chevrolet':['Silverado','Equinox','Traverse','Tahoe','Suburban','Camaro','Malibu','Colorado','Blazer','Trailblazer','Corvette','Express'],
  'Nissan':['Altima','Sentra','Rogue','Pathfinder','Frontier','Maxima','Kicks','Murano','Armada','Titan'],
  'Jeep':['Wrangler','Grand Cherokee','Cherokee','Compass','Renegade','Gladiator','Wagoneer'],
  'Ram':['1500','2500','3500','ProMaster','ProMaster City'],
  'GMC':['Sierra','Yukon','Terrain','Acadia','Canyon','Hummer EV'],
  'Hyundai':['Sonata','Elantra','Tucson','Santa Fe','Kona','Palisade','Ioniq 5','Accent','Venue'],
  'Kia':['Forte','K5','Sportage','Sorento','Telluride','Seltos','Soul','Carnival','Stinger','EV6'],
  'Subaru':['Outback','Forester','Crosstrek','Impreza','Legacy','Ascent','BRZ','WRX'],
  'Mazda':['CX-5','CX-50','CX-9','Mazda3','Mazda6','MX-5 Miata','CX-30'],
  'Volkswagen':['Jetta','Taos','Tiguan','Atlas','Golf GTI','ID.4','Passat','Arteon'],
  'BMW':['3 Series','5 Series','7 Series','X3','X5','X7','M3','M4','iX','i4'],
  'Mercedes-Benz':['C-Class','E-Class','S-Class','GLC','GLE','GLS','A-Class','CLA','AMG GT'],
  'Audi':['A4','A6','A8','Q5','Q7','Q8','e-tron','TT','R8','RS5'],
  'Lexus':['RX','ES','IS','GX','NX','UX','LS','LC','LX'],
  'Acura':['MDX','RDX','Integra','TLX','ZDX'],
  'Infiniti':['Q50','Q60','QX50','QX55','QX60','QX80'],
  'Cadillac':['Escalade','XT5','XT6','CT5','CT4','Lyriq'],
  'Buick':['Enclave','Encore','Envision','LaCrosse','Regal'],
  'Lincoln':['Navigator','Aviator','Corsair','Nautilus','Explorer'],
  'Volvo':['XC60','XC90','XC40','S60','S90','V60','C40 Recharge'],
  'Mitsubishi':['Outlander','Eclipse Cross','Mirage','Outlander Sport'],
  'Tesla':['Model 3','Model Y','Model S','Model X','Cybertruck'],
  'Porsche':['911','Cayenne','Macan','Taycan','Panamera','Cayman','Boxster'],
  'Land Rover':['Range Rover','Discovery','Defender','Range Rover Sport','Range Rover Evoque','Range Rover Velar'],
  'Chrysler':['Pacifica','300'],
  'Dodge':['Charger','Challenger','Durango','Hornet','Ram Van'],
  'Other':['(Other — type model below)']
};
const DAMAGE_OPTIONS=['None','Front bumper','Rear bumper','Left fender','Right fender','Left door','Right door','Hood','Trunk/Tailgate','Windshield','Headlight','Tail light','Mirror','Tire(s)','Wheel(s)','Radiator','Brakes','Transmission','Engine','Suspension','Exhaust','Interior','Paint/Scratch','Dent','Rust','Flood damage','Frame damage','Multiple areas'];
const COMMON_SELLERS=['Private Seller','Copart','IAAI (Insurance Auto)','Manheim','ADESA','Facebook Marketplace','Craigslist','OfferUp','Dealer Auction','Wholesale','Carvana','Other'];

function modalAddVehicle(editV){
  const v=editV||S.makeBlank();
  const isEdit=!!editV;
  const vehicleModels=v.make&&COMMON_MODELS[v.make]?COMMON_MODELS[v.make]:[];
  const fields=[
    {k:'year',l:'Year',type:'number',ph:'2020',col:''},
    {k:'make',l:'Make',type:'select',opts:S.MAKES,col:''},
    {k:'model',l:'Model',type:'select',opts:vehicleModels.length?vehicleModels:['(Select make first)'],col:''},
    {k:'trim',l:'Trim',type:'text',ph:'Sport, XLT, SE, etc.',col:''},
    {k:'vin',l:'VIN',type:'text',ph:'1HGBH41JXMN109186',col:'col-2'},
    {k:'mileage',l:'Mileage',type:'number',ph:'82000',col:''},
    {k:'condition',l:'Condition',type:'select',opts:S.CONDITIONS,col:''},
    {k:'purchasePrice',l:'Purchase Price',type:'number',ph:'12500',col:'',money:true},
    {k:'purchaseDate',l:'Purchase Date',type:'date',col:''},
    {k:'seller',l:'Seller / Source',type:'select',opts:COMMON_SELLERS,col:''},
    {k:'location',l:'Location',type:'select',opts:['Charlotte, NC','Concord, NC','Gastonia, NC','Mooresville, NC','Huntersville, NC','Matthews, NC','Monroe, NC','Rock Hill, SC','Salisbury, NC','Asheboro, NC','Statesville, NC','Lincolnton, NC','Shelby, NC','Kannapolis, NC','Hickory, NC','Other'],col:''},
    {k:'damage',l:'Damage / Issues',type:'select',opts:DAMAGE_OPTIONS,col:'col-2'},
    {k:'notes',l:'Notes',type:'textarea',ph:'Any additional notes…',col:'col-2'}
  ];
  const costFields=[
    {k:'repairCost',l:'Repairs'},{k:'partsCost',l:'Parts'},{k:'laborCost',l:'Labor'},
    {k:'transportCost',l:'Transportation'},{k:'auctionFees',l:'Auction Fees'},{k:'dealerFees',l:'Dealer Fees'},
    {k:'taxes',l:'Taxes'},{k:'registrationCost',l:'Registration'},{k:'advertisingCost',l:'Advertising'},
    {k:'detailingCost',l:'Detailing'},{k:'otherFees',l:'Other Fees'},{k:'miscCost',l:'Misc'}
  ];

  openModal(`
  <div class="modal lg">
    <div class="modal-head">
      <div class="ic-lg"><svg viewBox="0 0 24 24" fill="none"><path d="M5 11l1.3-3.5A2 2 0 018.2 6h7.6a2 2 0 011.9 1.5L19 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h3>${isEdit?'Edit':'Add'} Vehicle</h3>
      <button class="modal-x" data-close-modal>✕</button>
    </div>
    <div class="modal-body" style="max-height:60vh">
      <h4 style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text-2)">Vehicle Information</h4>
      <div class="grid-form mb-20">
        ${fields.map(f=>`<div class="field ${f.col}"><label>${f.l}</label>${f.type==='select'?`<select class="inp" data-veh-f="${f.k}" data-veh-select="${f.k}">${f.opts.map(o=>`<option value="${o}"${v[f.k]===o?' selected':''}>${o}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea class="inp" data-veh-f="${f.k}" placeholder="${f.ph||''}">${v[f.k]||''}</textarea>`:f.type==='date'?`<input class="inp" type="date" data-veh-f="${f.k}" value="${v[f.k]||''}">`:f.money?`<div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" data-veh-f="${f.k}" value="${v[f.k]||''}" placeholder="${f.ph||''}"></div>`:`<input class="inp" type="${f.type||'text'}" data-veh-f="${f.k}" value="${v[f.k]||''}" placeholder="${f.ph||''}">`}</div>`).join('')}
      </div>
      <h4 style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text-2)">Costs & Fees</h4>
      <div class="grid-form">
        ${costFields.map(f=>`<div class="field"><label>${f.l}</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" data-veh-f="${f.k}" value="${v[f.k]||''}" placeholder="0"></div></div>`).join('')}
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" data-close-modal>Cancel</button>
      <div class="spacer"></div>
      <button class="btn primary" data-save-vehicle="${isEdit?v.id:''}">${isEdit?'Save Changes':'Add Vehicle'}</button>
    </div>
  </div>`);

  $$('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));

  // Dynamic model dropdown based on make selection
  const makeSelect=$('[data-veh-select="make"]');
  if(makeSelect){
    makeSelect.addEventListener('change',e=>{
      const make=e.target.value;
      const modelSelect=$('[data-veh-select="model"]');
      if(modelSelect&&COMMON_MODELS[make]){
        modelSelect.innerHTML=COMMON_MODELS[make].map(m=>`<option value="${m}">${m}</option>`).join('');
      }else if(modelSelect){
        modelSelect.innerHTML='<option value="">(Type model)</option>';
      }
    });
  }

  $('[data-save-vehicle]').addEventListener('click',async ()=>{
    const data={};
    const raw={};
    $$('[data-veh-f]').forEach(el=>{
      const v=el.dataset.vehF;
      const isNum=el.type==='number'||el.closest('.money-wrap');
      raw[v]=el.value;
      data[v]=isNum?S.num(el.value):el.value;
    });
    if(raw.purchasePrice!==undefined && raw.purchasePrice.trim()===''){
      App.toast('Purchase Price is required for accurate investment and ROI calculations','warn');
      $('[data-veh-f="purchasePrice"]')?.focus();
      return;
    }
    delete data.photoUrl;
    let vId;
    try {
      if(isEdit){
        vId=$('[data-save-vehicle]').dataset.saveVehicle;
        const existing=S.getVehicle(vId);
        if(!data.photos||!data.photos.length){
          data.photos=(existing&&existing.photos)?existing.photos:[];
        }
        await S.updateVehicle(vId,data);
        App.toast('Vehicle updated','ok');
      } else {
        data.photos=[];
        const nv=await S.addVehicle(data);
        vId=nv.id;
        App.toast('Vehicle added','ok');
      }
      closeModal();
      renderNav(); render();
    } catch(err) {
      App.toast('Error: '+err.message,'err');
    }
  });
}

function modalRecordSale(id){
  const v=S.getVehicle(id); if(!v) return;
  openModal(`
  <div class="modal">
    <div class="modal-head"><div class="ic-lg"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>Record Sale — ${S.vehicleName(v)}</h3><button class="modal-x" data-close-modal>✕</button></div>
    <div class="modal-body">
      <div class="grid-form">
        <div class="field"><label>Sale Price *</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" data-sale="salePrice" placeholder="18500"></div></div>
        <div class="field"><label>Date Sold</label><input class="inp" type="date" data-sale="saleDate" value="${S.LOCAL_ISO()}"></div>
        <div class="field"><label>Buyer</label><input class="inp" data-sale="buyer" placeholder="Walk-in, CarGurus, etc."></div>
        <div class="field"><label>Selling Fees</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" data-sale="sellingFees" value="0"></div></div>
      </div>
      <div style="margin-top:16px;padding:12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border)">
        <div style="font-size:12px;color:var(--text-3);font-weight:600;margin-bottom:4px">Summary</div>
        <div class="kv"><span class="k">Total Investment</span><span class="v tnum">${S.money(S.totalInvestment(v))}</span></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close-modal>Cancel</button><div class="spacer"></div><button class="btn primary" data-confirm-sale="${id}">Confirm Sale</button></div>
  </div>`);
  $$('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));
  // live update summary
  $$('[data-sale]').forEach(el=>el.addEventListener('input',()=>{
    const sp=+$('[data-sale="salePrice"]').value||0;
    const sf=+$('[data-sale="sellingFees"]').value||0;
    const ti=S.totalInvestment(v);
    const financials=S.calculateFinancials({investment:ti,revenue:sp,sellingFees:sf});
    const profit=financials.profit;
    const summaryDiv=$('.modal-body > div:last-child');
    if(summaryDiv) summaryDiv.innerHTML=`<div style="font-size:12px;color:var(--text-3);font-weight:600;margin-bottom:4px">Summary</div><div class="kv"><span class="k">Total Investment</span><span class="v tnum">${S.money(ti)}</span></div><div class="kv"><span class="k">Sale Price</span><span class="v tnum">${S.money(sp)}</span></div><div class="kv"><span class="k">Selling Fees</span><span class="v tnum">${S.money(sf)}</span></div><div class="kv"><span class="k bold">Net Profit</span><span class="v tnum bold" style="color:${profit>=0?'var(--pos)':'var(--neg)'}">${S.money(profit)}</span></div><div class="kv"><span class="k">ROI</span><span class="v tnum">${S.roiDisplay(financials.roi,financials.totalInvestment)}</span></div><div class="kv"><span class="k">Margin</span><span class="v tnum">${financials.margin===null?'—':S.pct(financials.margin)}</span></div>`;
  }));
  $('[data-confirm-sale]').addEventListener('click',async ()=>{
    const data={};
    $$('[data-sale]').forEach(el=>{data[el.dataset.sale]=el.type==='number'?+(el.value||0):el.value;});
    if(!data.salePrice){App.toast('Enter sale price','warn');return;}
    try {
      await S.sellVehicle(id,data);
      closeModal(); renderNav(); render(); renderNotifications();
      App.toast(`Sold for ${S.money(data.salePrice)}!`,'ok');
    } catch(err) {
      App.toast('Error: '+err.message,'err');
    }
  });
}

function modalAddExpense(preVehId){
  openModal(`
  <div class="modal">
    <div class="modal-head"><div class="ic-lg"><svg viewBox="0 0 24 24" fill="none"><path d="M3 7h18M5 7v10a1 1 0 001 1h12a1 1 0 001-1V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>Add Expense</h3><button class="modal-x" data-close-modal>✕</button></div>
    <div class="modal-body">
      <div class="grid-form">
        <div class="field"><label>Category *</label><select class="inp" data-exp="category"><option value="">Select…</option>${Object.keys(EC).map(k=>`<option value="${k}">${EC[k].label}</option>`).join('')}</select></div>
        <div class="field"><label>Amount *</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" data-exp="amount" placeholder="0"></div></div>
        <div class="field"><label>Date</label><input class="inp" type="date" data-exp="date" value="${S.LOCAL_ISO()}"></div>
        <div class="field"><label>Vehicle</label><select class="inp" data-exp="vehicleId"><option value="">Business (not tied to a vehicle)</option>${S.business.heldVehicles().map(v=>`<option value="${v.id}"${preVehId===v.id?' selected':''}>${S.vehicleName(v)}</option>`).join('')}</select></div>
        <div class="field col-2"><label>Description</label><input class="inp" data-exp="description" placeholder="What is this expense for?"></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close-modal>Cancel</button><div class="spacer"></div><button class="btn primary" data-save-expense>Add Expense</button></div>
  </div>`);
  $$('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));
  $('[data-save-expense]').addEventListener('click',async ()=>{
    const data={};
    $$('[data-exp]').forEach(el=>{data[el.dataset.exp]=el.type==='number'?+(el.value||0):el.value;});
    if(!data.category||!data.amount){App.toast('Category and amount required','warn');return;}
    try {
      await S.addExpense(data);
      closeModal(); renderNav(); render(); renderNotifications();
      App.toast('Expense added','ok');
    } catch(err) {
      App.toast('Error: '+err.message,'err');
    }
  });
}

function modalAddBusinessExpense(){
  openModal(`
  <div class="modal">
    <div class="modal-head"><div class="ic-lg"><svg viewBox="0 0 24 24" fill="none"><path d="M2 7h20v11a2 2 0 01-2 2H4a2 2 0 01-2-2V7zM16 11a4 4 0 01-8 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>Add Business Expense</h3><button class="modal-x" data-close-modal>✕</button></div>
    <div class="modal-body">
      <div class="grid-form">
        <div class="field"><label>Category *</label><select class="inp" data-biz="category"><option value="">Select…</option>${BE_CATEGORIES.map(c=>`<option value="${c.key}">${c.label}</option>`).join('')}</select></div>
        <div class="field"><label>Amount *</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" data-biz="amount" placeholder="0"></div></div>
        <div class="field"><label>Date</label><input class="inp" type="date" data-biz="date" value="${S.LOCAL_ISO()}"></div>
        <div class="field col-2"><label>Description</label><input class="inp" data-biz="description" placeholder="What is this expense for?"></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close-modal>Cancel</button><div class="spacer"></div><button class="btn primary" data-save-biz>Add Expense</button></div>
  </div>`);
  $$('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));
  $('[data-save-biz]').addEventListener('click',async ()=>{
    const data={};
    $$('[data-biz]').forEach(el=>{data[el.dataset.biz]=el.type==='number'?+(el.value||0):el.value;});
    if(!data.category||!data.amount){App.toast('Category and amount required','warn');return;}
    try {
      await S.addBusinessExpense(data);
      closeModal(); renderNav(); render(); renderNotifications();
      App.toast('Business expense added','ok');
    } catch(err) {
      App.toast('Error: '+err.message,'err');
    }
  });
}

function modalResetData(){
  openModal(`
  <div class="modal">
    <div class="modal-head"><div class="ic-lg" style="background:var(--neg-soft);color:var(--neg)"><svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M3.6 9h16.8c.56 0 .84 0 1.054-.109a1 1 0 00.437-.437C22 8.24 22 7.96 22 7.4V5.6c0-.56 0-.84-.109-1.054a1 1 0 00-.437-.437C21.24 4 20.96 4 20.4 4H3.6c-.56 0-.84 0-1.054.109a1 1 0 00-.437.437C2 4.76 2 5.04 2 5.6v1.8c0 .56 0 .84.109 1.054a1 1 0 00.437.437C2.76 9 3.04 9 3.6 9zM4 9l1.5 12.5c.136.95.204 1.425.448 1.776a2 2 0 00.874.804C7.074 24 7.549 24 8.5 24h7c.951 0 1.426 0 1.678-.12a2 2 0 00.874-.804c.244-.351.312-.826.448-1.776L20 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>Reset All Data</h3><button class="modal-x" data-close-modal>✕</button></div>
    <div class="modal-body">
      <div style="padding:16px;border-radius:12px;background:var(--neg-soft);color:var(--neg);font-size:13px;margin-bottom:16px;font-weight:600">⚠ This will permanently delete ALL your vehicles, expenses, watchlist items, business expenses, and activity history.</div>
      <div class="field"><label>Enter your password to confirm</label><input class="inp" type="password" id="resetPassword" placeholder="Your password"></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close-modal>Cancel</button><div class="spacer"></div><button class="btn danger" id="confirmReset">Delete Everything</button></div>
  </div>`);
  $$('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));
  $('#confirmReset').addEventListener('click',async ()=>{
    const pw=$('#resetPassword').value;
    if(!pw){App.toast('Enter your password','warn');return;}
    try {
      await App.resetAll(pw);
      closeModal();
      App.toast('All data cleared','ok');
    } catch(err) { App.toast(err.message,'err'); }
  });
}

function modalAddWatch(){
  openModal(`
  <div class="modal">
    <div class="modal-head"><div class="ic-lg"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.6-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.4-7 10-7 10Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>Add to Watchlist</h3><button class="modal-x" data-close-modal>✕</button></div>
    <div class="modal-body">
      <div class="grid-form">
        <div class="field col-2"><label>Vehicle *</label><input class="inp" data-watch="label" placeholder="2020 Honda Accord Sport"></div>
        <div class="field col-2"><label>Listing URL</label><input class="inp" data-watch="url" placeholder="https://..."></div>
        <div class="field"><label>Asking Price</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" data-watch="askingPrice"></div></div>
        <div class="field"><label>Est. Value</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" data-watch="estimatedValue"></div></div>
        <div class="field"><label>Est. Profit</label><div class="money-wrap"><span class="pre">$</span><input class="inp money" type="number" data-watch="estimatedProfit"></div></div>
        <div class="field"><label>Seller</label><input class="inp" data-watch="seller" placeholder="Private, Copart, etc."></div>
        <div class="field"><label>Location</label><input class="inp" data-watch="location" placeholder="Charlotte, NC"></div>
        <div class="field"><label>Status</label><select class="inp" data-watch="status">${WS.map(s=>`<option value="${s}"${s==='Watching'?' selected':''}>${s}</option>`).join('')}</select></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close-modal>Cancel</button><div class="spacer"></div><button class="btn primary" data-save-watch>Add to Watchlist</button></div>
  </div>`);
  $$('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));
  $('[data-save-watch]').addEventListener('click',async ()=>{
    const data={};
    $$('[data-watch]').forEach(el=>{data[el.dataset.watch]=el.type==='number'?+(el.value||0):el.value;});
    if(!data.label){App.toast('Vehicle name required','warn');return;}
    try {
      await S.addWatch(data);
      closeModal(); renderNav(); render(); renderNotifications();
      App.toast('Added to watchlist','ok');
    } catch(err) {
      App.toast('Error: '+err.message,'err');
    }
  });
}

/* ================================================================
   VIEW: ACTIVITY LOG
   ================================================================ */
async function renderActivity(){
  let activities=[];
  try{
    activities=await S.getActivity(100);
  }catch(e){ /* ignore */ }
  const actionIcons={
    vehicle_added:'M12 5v14M5 12h14',vehicle_updated:'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7',
    vehicle_deleted:'M18 6L6 18M6 6l12 12',vehicle_sold:'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
    expense_added:'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',expense_deleted:'M18 6L6 18M6 6l12 12',
    watchlist_added:'M12 20s-7-4.6-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.4-7 10-7 10Z',
    watchlist_updated:'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7',
    photo_uploaded:'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12'
  };
  const actionColors={
    vehicle_added:'var(--brand)',vehicle_updated:'var(--accent)',vehicle_deleted:'var(--neg)',
    vehicle_sold:'var(--pos)',expense_added:'var(--warn)',expense_deleted:'var(--neg)',
    watchlist_added:'var(--brand)',watchlist_updated:'var(--accent)',photo_uploaded:'var(--text-2)'
  };
  return `
  <div class="view-pad fade-in">
    <div class="page-head"><div class="page-title">Activity Log</div><div class="spacer"></div><span class="badge neutral">${activities.length} entries</span></div>
    ${activities.length?`<div class="card"><div class="card-body">
      <div class="activity-list">
        ${activities.map(a=>`
          <div class="activity-item">
            <div class="activity-icon" style="background:${actionColors[a.action]||'var(--text-3)'}15;color:${actionColors[a.action]||'var(--text-3)'}">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="${actionIcons[a.action]||actionIcons.vehicle_updated}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="activity-content">
              <div class="activity-title">${S.esc(a.description||a.action)}</div>
              <div class="activity-meta">${a.username||'System'} · ${a.createdAt||''}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div></div>`
    :`<div class="empty-state"><div class="ei"><svg viewBox="0 0 24 24" fill="none"><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div><h4>No activity yet</h4><p>Actions like adding vehicles, recording sales, and expenses will appear here.</p></div>`}
  </div>`;
}

/* ================================================================
   MAIN RENDER + NAVIGATION
   ================================================================ */
function render(){
  console.log('[G5] render() called, currentView:', currentView);
  const el=viewEl(); if(!el) { console.error('[G5] viewEl() returned null - #view not found'); return; }
  try {
  const html = (() => {
  switch(currentView){
    case 'dashboard': return renderDashboard();
    case 'inventory': return renderInventory();
    case 'vehicle': return renderVehicle(currentParam);
    case 'search': return renderSearch();
    case 'watchlist': return renderWatchlist();
    case 'analytics': return renderAnalytics();
    case 'expenses': return renderExpenses();
    case 'business-expenses': return renderBusinessExpenses();
    case 'activity': renderActivity().then(html=>{el.innerHTML=html;}).catch(()=>{el.innerHTML='<div class="view-pad"><p>Error loading activity</p></div>';}); return null;
    default: return renderDashboard();
  }
  })();
  if(html!==null) el.innerHTML=html;
  switch(currentView){
    case 'dashboard': mountDashboard(); break;
    case 'inventory': mountInventory(); break;
    case 'vehicle': mountVehicle(); break;
    case 'search': mountSearch(); break;
    case 'watchlist': mountWatchlist(); break;
    case 'analytics': mountAnalytics(); break;
  }
  } catch(err) {
    console.error('Render error:', err);
    el.innerHTML='<div class="view-pad" style="padding:40px;text-align:center"><h2>Something went wrong</h2><p style="color:var(--text-3)">'+err.message+'</p><button class="btn primary mt-12" onclick="location.reload()">Reload</button></div>';
  }
  // scroll to top
  $('#viewScroll')?.scrollTo({top:0});
}

function renderNav(){
  try {
  $$('.nav-item').forEach(n=>{n.classList.toggle('active',n.dataset.view===currentView);});
  $$('.b-item').forEach(n=>{n.classList.toggle('active',n.dataset.view===currentView);});
  // counts
  const inv=$('#navCountInv'); if(inv) inv.textContent=S.business.heldVehicles().length;
  const wk=$('#navCountWatch'); if(wk) wk.textContent=(S.state.watchlist||[]).length;
  // mini stats
  const mi=$('#miniInv'); if(mi) mi.textContent=S.money(S.business.inventorySnapshot().invested);
  const mp=$('#miniProfit'); if(mp) mp.textContent=S.money(S.business.lifetimeMetrics().profit);
  } catch(err) { console.error('renderNav error:', err); }
}

/* ---- Notifications ---- */
let notifRead={};
function renderNotifications(){
  const alerts=S.alerts();
  const unread=alerts.filter(a=>!notifRead[a.title]);
  const nb=$('#notifBadge');
  if(nb){ nb.style.display=unread.length?'inline-grid':'none'; nb.textContent=unread.length; }
  const nl=$('#notifList');
  if(nl){
    if(!alerts.length){ nl.innerHTML='<div style="padding:24px;text-align:center;color:var(--text-3);font-size:13.5px"><div style="font-size:24px;margin-bottom:8px">✓</div>No alerts — everything looks good</div>'; return; }
    nl.innerHTML=alerts.map(a=>{
      const iconMap={clock:'M12 6v6l4 2',wrench:'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',receipt:'M4 4h16v16H4z'};
      return`<div class="nitem ${notifRead[a.title]?'':'unread'}"><div class="nic" style="background:var(--warn-soft);color:var(--warn)"><svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="${iconMap[a.icon]||iconMap.clock}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div><div class="nt">${a.title}</div><div class="ns">${a.sub}</div></div></div>`;
    }).join('');
  }
}

/* ---- Theme ---- */
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme',theme);
  localStorage.setItem('g5_theme',theme);
  const icon=$('#themeIcon');
  if(icon) icon.innerHTML=theme==='dark'?'<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>':'<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';
}

/* ---- Sidebar collapse ---- */
function initSidebar(){
  const app=$('#app');
  $('#collapseBtn')?.addEventListener('click',()=>app.classList.toggle('nav-collapsed'));
}

/* ---- Mobile ---- */
function closeMobileNav(){ $('#app')?.classList.remove('nav-open'); }
function openMobileNav(){ $('#app')?.classList.add('nav-open'); }

/* ---- Global keyboard shortcuts ---- */
function initKeyboard(){
  document.addEventListener('keydown',e=>{
    // Ctrl+Z for undo
    if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){
      if(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA') return;
      e.preventDefault(); undo(); return;
    }
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT') return;
    if(e.key==='n'||e.key==='N'){ e.preventDefault(); modalAddVehicle(); }
    if(e.key==='/'){ e.preventDefault(); $('#globalSearch')?.focus(); }
    if(e.key==='d'||e.key==='D'){ route('dashboard'); }
    if(e.key==='i'||e.key==='I'){ route('inventory'); }
    if(e.key==='s'||e.key==='S'){ route('search'); }
    if(e.key==='w'||e.key==='W'){ route('watchlist'); }
    if(e.key==='a'||e.key==='A'){ route('analytics'); }
  });
}

/* ---- Public API ---- */
window.App={
  nav:(view,param)=>route(view,param),
  refresh:()=>{ renderNav(); render(); renderNotifications(); },
  toast,
  modalQuickAction,
  modalVehicleDetails,
  modalAddVehicle:v=>modalAddVehicle(v?S.getVehicle(v):null),
  modalEditVehicle:id=>{const v=S.getVehicle(id);if(v)modalAddVehicle(v);},
  modalRecordSale,
  modalAddExpense,
  modalAddBusinessExpense,
  modalResetData,
  modalAddWatch,
  deleteVehicleWithUndo:async id=>{
    try {
      const v=Store.state.vehicles.find(x=>x.id===id);
      if(!v) { toast('Vehicle not found','err'); return; }
      await Store.deleteVehicle(id);
      renderNav(); render();
      toast('Vehicle deleted','info',5000);
    } catch(err) {
      console.error('Delete failed:', err);
      toast('Delete failed: '+err.message,'err');
    }
  },
  undo,
  resetAll:async password=>{
    try {
      await Store.resetAll(password);
      renderNav(); render(); renderNotifications();
      toast('All data cleared — starting fresh','ok');
    } catch(err) { toast(err.message,'err'); }
  },
};

/* ---- Auth Screen ---- */
function renderAuthScreen(){
  const overlay=$('#authOverlay');
  if(!overlay) return;
  overlay.innerHTML=`
  <div class="auth-card">
    <div class="auth-logo">
      <svg viewBox="0 0 24 24" fill="none" width="40" height="40"><path d="M5 14l1.6-4.2A2 2 0 0 1 8.4 8.5h7.2a2 2 0 0 1 1.8 1.3L19 14M8 14a1.7 1.7 0 1 1-3.4 0A1.7 1.7 0 0 1 8 14Zm12.4 0a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Z" stroke="var(--brand)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h2 class="auth-title">G5 Auto</h2>
    <p class="auth-sub">Charlotte NC Used-Car Business Dashboard</p>
    <form class="auth-form" id="authLoginForm">
      <div class="field"><label>Username</label><input class="inp" type="text" id="authUser" autocomplete="username" required></div>
      <div class="field"><label>Password</label><input class="inp" type="password" id="authPass" autocomplete="current-password" required></div>
      <div id="authError" class="auth-error" style="display:none"></div>
      <button class="btn primary block" type="submit">Log In</button>
    </form>
  </div>`;
  $('#authLoginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const errEl=$('#authError'); errEl.style.display='none';
    try{
      const user=await S.login($('#authUser').value,$('#authPass').value);
      if(user.mustChangePassword) renderChangePasswordScreen();
      else bootApp();
    }
    catch(err){ errEl.textContent=err.message||'Login failed'; errEl.style.display='block'; }
  });
}

/* ---- Change Password Screen ---- */
function renderChangePasswordScreen(){
  const overlay=$('#authOverlay');
  if(!overlay) return;
  overlay.innerHTML=`
  <div class="auth-card">
    <div class="auth-logo">
      <svg viewBox="0 0 24 24" fill="none" width="40" height="40"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V6a4 4 0 00-8 0v4h8z" stroke="var(--brand)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h2 class="auth-title">Change Your Password</h2>
    <p class="auth-sub">Welcome ${S.currentUser?.displayName||S.currentUser?.username||''}! Set a new password to continue.</p>
    <form class="auth-form" id="changePassForm">
      <div class="field"><label>New Password</label><input class="inp" type="password" id="newPassInput" autocomplete="new-password" required minlength="4" placeholder="4+ characters"></div>
      <div class="field"><label>Confirm Password</label><input class="inp" type="password" id="confirmPassInput" autocomplete="new-password" required minlength="4" placeholder="Repeat new password"></div>
      <div id="changePassError" class="auth-error" style="display:none"></div>
      <button class="btn primary block" type="submit">Set New Password</button>
    </form>
  </div>`;
  $('#changePassForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const errEl=$('#changePassError'); errEl.style.display='none';
    const np=$('#newPassInput').value;
    const cp=$('#confirmPassInput').value;
    if(np!==cp){ errEl.textContent='Passwords do not match'; errEl.style.display='block'; return; }
    if(np.length<4){ errEl.textContent='Password must be 4+ characters'; errEl.style.display='block'; return; }
    try{
      await S.changePassword(np);
      S.logout();
      renderAuthScreen();
      requestAnimationFrame(()=>{
        const errEl=$('#authError');
        if(errEl){ errEl.textContent='Password changed! Log in with your new password.'; errEl.style.display='block'; errEl.className='auth-success'; }
      });
    }catch(err){ errEl.textContent=err.message||'Failed'; errEl.style.display='block'; }
  });
}

function bootApp(){
  console.log('[G5] bootApp called, currentUser:', S.currentUser);
  // Clear auth overlay
  const authOverlay=$('#authOverlay'); if(authOverlay) authOverlay.innerHTML='';

  applyTheme(localStorage.getItem('g5_theme')||'light');
  $('#themeBtn')?.addEventListener('click',()=>applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'));

  $$('.nav-item').forEach(n=>n.addEventListener('click',()=>route(n.dataset.view)));
  $$('.b-item').forEach(n=>n.addEventListener('click',()=>route(n.dataset.view)));

  $('#menuToggle')?.addEventListener('click',openMobileNav);
  $('#overlay')?.addEventListener('click',closeMobileNav);

  $('#notifBtn')?.addEventListener('click',e=>{
    e.stopPropagation();
    const p=$('#notifPanel'); p?.classList.toggle('open');
  });
  $('#notifClear')?.addEventListener('click',()=>{
    S.alerts().forEach(a=>notifRead[a.title]=true);
    renderNotifications();
  });
  document.addEventListener('click',e=>{
    if(!e.target.closest('#notifPanel')&&!e.target.closest('#notifBtn')){
      $('#notifPanel')?.classList.remove('open');
    }
  });

  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close-modal]');
    if(close){ e.preventDefault(); closeModal(); }
  });

  $('#quickAdd')?.addEventListener('click',()=>modalAddVehicle());

  const gs=$('#globalSearch');
  let searchDebounce;
  gs?.addEventListener('input',e=>{
    clearTimeout(searchDebounce);
    searchDebounce=setTimeout(()=>{
      const q=e.target.value.trim();
      if(q.length>=2){ invFilter.search=q; route('inventory'); }
    },400);
  });

  initSidebar();
  initKeyboard();

  const skipLink=$('#skipLink');
  skipLink?.addEventListener('click',e=>{
    e.preventDefault();
    const target=$('#view');
    if(target){ target.focus(); target.scrollIntoView({behavior:'smooth'}); }
  });

  updateUserDisplay();
  console.log('[G5] about to renderNav and render');
  try { renderNav(); } catch(e) { console.error('[G5] renderNav error:', e); }
  try { render(); console.log('[G5] render complete, #view length:', $('#view')?.innerHTML?.length); } catch(e) { console.error('[G5] render error:', e); }
  renderNotifications();
}

function updateUserDisplay(){
  const user=S.currentUser;
  const name=user?.displayName||user?.display_name||user?.username||'Guest';
  const initial=(name)[0].toUpperCase();
  const nameEl=$('#userName');
  const avatarEl=$('#userAvatar');
  const topName=$('#topbarName');
  const topAvatar=$('#topbarAvatar');
  if(nameEl) nameEl.textContent=name;
  if(avatarEl) avatarEl.textContent=initial;
  if(topName) topName.textContent=name;
  if(topAvatar) topAvatar.textContent=initial;
  $('#logoutBtn')?.addEventListener('click',()=>{ S.logout(); location.reload(); });
}

/* ---- Boot ---- */
function boot(){
  // Show loading state immediately
  const view=$('#view');
  if(view) view.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px"><div style="width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--brand);border-radius:50%;animation:spin 1s linear infinite"></div><div style="color:var(--text-3);font-size:14px" id="loadMsg">Waking up server... this takes 30-60s on first load</div></div>';

  // Timeout warning
  const loadTimer=setTimeout(()=>{ const m=$('#loadMsg'); if(m) m.textContent='Still loading... Render free tier cold starts can take up to 2 minutes'; },15000);

  try {
    S.checkAuth().then(user=>{
      clearTimeout(loadTimer);
      console.log('[G5] checkAuth resolved, user:', user?.username);
      if(user){
        if(S.mustChangePassword) renderChangePasswordScreen();
        else bootApp();
      } else renderAuthScreen();
    }).catch((e)=>{ clearTimeout(loadTimer); console.error('[G5] checkAuth catch:', e); renderAuthScreen(); });
  } catch(e) {
    clearTimeout(loadTimer);
    console.error('Boot error:', e);
    renderAuthScreen();
  }
}

boot();

})();
