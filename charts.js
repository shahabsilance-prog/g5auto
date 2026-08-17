/* G5 Auto — dependable SVG chart engine */
(function(){
'use strict';
const NS='http://www.w3.org/2000/svg';
const observers=new WeakMap();
const css=(n,f)=>getComputedStyle(document.documentElement).getPropertyValue(n).trim()||f;

// Cached color palette — refreshed on theme change instead of every draw
let _cachedColors=null;
let _lastTheme=null;
function C(){
  const cur=document.documentElement.getAttribute('data-theme');
  if(_cachedColors && cur===_lastTheme) return _cachedColors;
  _lastTheme=cur;
  _cachedColors={text:css('--text','#0c1322'),mute:css('--text-3','#8a96a8'),grid:css('--border','#e2e6ec'),surface:css('--surface','#fff'),brand:css('--brand','#0a8f5f'),pos:css('--pos','#09926b'),neg:css('--neg','#e23b4e'),accent:css('--accent','#2a6df4'),warn:css('--warn','#c2710c')};
  return _cachedColors;
}
// Force-refresh cache on theme change
new MutationObserver(()=>{ _cachedColors=null; }).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

const E=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));return el;};
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const money=v=>{v=num(v);const a=Math.abs(v),s=v<0?'-':'';if(a>=1e6)return s+'$'+(a/1e6).toFixed(a>=1e7?0:1)+'M';if(a>=1e3)return s+'$'+(a/1e3).toFixed(a>=1e4?0:1)+'k';return s+'$'+Math.round(a).toLocaleString('en-US');};
const step=range=>{const raw=Math.max(Math.abs(range)/5,1);const p=10**Math.floor(Math.log10(raw));const q=raw/p;return(q<=1?1:q<=2?2:q<=5?5:10)*p;};
const bounds=(vals,zero=false)=>{let min=Math.min(0,...vals),max=Math.max(0,...vals);if(zero)min=0;if(min===max)max=min+1;const st=step(max-min);return{min:zero?0:Math.floor(min/st)*st,max:Math.ceil(max/st)*st,step:st};};
function empty(c,title='No data yet',sub='Add or sell vehicles to populate this chart.'){
 c.innerHTML=`<div class="chart-empty"><div class="chart-empty-icon">∿</div><div class="chart-empty-title">${title}</div><div class="chart-empty-sub">${sub}</div></div>`;
}
function watch(c,draw){if(!c)return;observers.get(c)?.disconnect();const run=()=>{try{draw();}catch(err){console.error('G5 Auto chart error:',err);empty(c,'Chart unavailable','Refresh the page or check the data feeding this chart.');}};run();if('ResizeObserver' in window){const ro=new ResizeObserver(run);ro.observe(c);observers.set(c,ro);}}
function tip(c,title,val,x,y){let t=c.querySelector('.chart-tip');if(!t){t=document.createElement('div');t.className='chart-tip';c.appendChild(t);}t.innerHTML=`<b>${title}</b><span>${val}</span>`;t.style.left=Math.min(Math.max(8,x+8),Math.max(8,c.clientWidth-150))+'px';t.style.top=Math.max(8,y-54)+'px';t.classList.add('show');}
function hide(c){c.querySelector('.chart-tip')?.classList.remove('show');}
function axisTicks(s,p,b,W,H,opts){
 const col=C();const y=v=>p.t+p.h-(v-b.min)/(b.max-b.min)*p.h;
 for(let v=b.min;v<=b.max+1e-9;v+=b.step){const yy=y(v);s.appendChild(E('line',{x1:p.l,y1:yy,x2:W-p.r,y2:yy,stroke:col.grid,'stroke-width':1,'stroke-dasharray':'3 5'}));const t=E('text',{x:p.l-9,y:yy+4,'text-anchor':'end',fill:col.mute,'font-size':10});t.textContent=opts.percent?(v.toFixed(0)+'%'):money(v);s.appendChild(t);}
 if(b.min<0&&b.max>0)s.appendChild(E('line',{x1:p.l,y1:y(0),x2:W-p.r,y2:y(0),stroke:col.text,'stroke-opacity':.2,'stroke-width':1.2}));
 return y;
}
function area(c,points=[],opts={}){
 watch(c,()=>{
  const p=(Array.isArray(points)?points:[]).map(x=>({label:String(x.label??''),value:num(x.value)}));
  const secondary=(Array.isArray(opts.secondaryPoints)?opts.secondaryPoints:[]).map(x=>({label:String(x.label??''),value:num(x.value)}));
  if(!p.length){empty(c);return;}
  const vals=p.map(q=>q.value).concat(secondary.map(q=>q.value));const b=bounds(vals,!!opts.zeroBaseline);
  const col=C(),W=Math.max(c.clientWidth||0,360),H=Math.max(c.clientHeight||0,220),pad={l:60,r:18,t:20,b:34};pad.w=W-pad.l-pad.r;pad.h=H-pad.t-pad.b;
  const s=E('svg',{viewBox:`0 0 ${W} ${H}`,width:W,height:H,preserveAspectRatio:'none'});s.style.fontFamily='Inter,system-ui,sans-serif';
  const y=axisTicks(s,pad,b,W,H,{percent:!!opts.percent});const x=i=>p.length<=1?pad.l+pad.w/2:pad.l+i*pad.w/(p.length-1);
  const primaryColor=opts.color||col.brand,secondaryColor=opts.secondaryColor||col.accent;
  const line=p.map((q,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(q.value).toFixed(1)).join(' ');
  const gid='g'+Math.random().toString(36).slice(2,8);const defs=E('defs');const grad=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});grad.appendChild(E('stop',{offset:'0%','stop-color':primaryColor,'stop-opacity':.24}));grad.appendChild(E('stop',{offset:'100%','stop-color':primaryColor,'stop-opacity':.015}));defs.appendChild(grad);s.appendChild(defs);
  s.appendChild(E('path',{d:line+` L${x(p.length-1)} ${y(b.min)} L${x(0)} ${y(b.min)} Z`,fill:`url(#${gid})`}));
  s.appendChild(E('path',{d:line,fill:'none',stroke:primaryColor,'stroke-width':2.7,'stroke-linecap':'round','stroke-linejoin':'round'}));
  p.forEach((q,i)=>{const cx=x(i),cy=y(q.value),dot=E('circle',{cx,cy,r:3.2,fill:col.surface,stroke:primaryColor,'stroke-width':2});s.appendChild(dot);const hit=E('rect',{x:Math.max(pad.l,cx-20),y:pad.t,width:40,height:pad.h,fill:'transparent'});hit.style.cursor='crosshair';hit.addEventListener('mouseenter',()=>{dot.setAttribute('r',5.5);tip(c,q.label,money(q.value),cx,cy);});hit.addEventListener('mouseleave',()=>{dot.setAttribute('r',3.2);hide(c);});s.appendChild(hit);});
  if(secondary.length){const line2=secondary.map((q,i)=>{const xx=secondary.length<=1?pad.l+pad.w/2:pad.l+i*pad.w/(secondary.length-1);return(i?'L':'M')+xx.toFixed(1)+' '+y(q.value).toFixed(1);}).join(' ');s.appendChild(E('path',{d:line2,fill:'none',stroke:secondaryColor,'stroke-width':1.8,'stroke-dasharray':'6 5','stroke-linecap':'round'}));secondary.forEach((q,i)=>{const cx=secondary.length<=1?pad.l+pad.w/2:pad.l+i*pad.w/(secondary.length-1),cy=y(q.value);s.appendChild(E('circle',{cx,cy,r:2.4,fill:col.surface,stroke:secondaryColor,'stroke-width':1.7}));});}
  const every=Math.max(1,Math.ceil(p.length/8));p.forEach((q,i)=>{if(i%every!==0&&i!==p.length-1)return;const t=E('text',{x:x(i),y:H-10,'text-anchor':'middle',fill:col.mute,'font-size':10});t.textContent=q.label;s.appendChild(t);});
  if(opts.legend?.length){opts.legend.forEach((item,i)=>{const x0=pad.l+i*115;s.appendChild(E('line',{x1:x0,y1:8,x2:x0+16,y2:8,stroke:item.color,'stroke-width':2.5,'stroke-dasharray':item.dashed?'6 5':'0'}));const t=E('text',{x:x0+21,y:11,fill:col.mute,'font-size':10});t.textContent=item.label;s.appendChild(t);});}
  c.innerHTML='';c.appendChild(s);
 });
}
function groupedBars(c,points=[],labels=[],opts={}){
 watch(c,()=>{
  const p=(Array.isArray(points)?points:[]).map(x=>({label:String(x.label??''),values:(x.values||[]).map(num)}));if(!p.length){empty(c);return;}
  const vals=p.flatMap(x=>x.values);if(!vals.length){empty(c);return;}const col=C();const b=bounds(vals,true);const W=Math.max(c.clientWidth||0,430),H=Math.max(c.clientHeight||0,250),pad={l:62,r:18,t:28,b:40};pad.w=W-pad.l-pad.r;pad.h=H-pad.t-pad.b;
  const s=E('svg',{viewBox:`0 0 ${W} ${H}`,width:W,height:H,preserveAspectRatio:'none'});s.style.fontFamily='Inter,system-ui,sans-serif';
  const baseline=Math.max(0,b.min);const y=v=>pad.t+pad.h-(v-b.min)/(b.max-b.min)*pad.h;
  for(let v=b.min;v<=b.max+1e-9;v+=b.step){const yy=y(v);s.appendChild(E('line',{x1:pad.l,y1:yy,x2:W-pad.r,y2:yy,stroke:col.grid,'stroke-dasharray':'3 5'}));const t=E('text',{x:pad.l-9,y:yy+4,'text-anchor':'end',fill:col.mute,'font-size':10});t.textContent=money(v);s.appendChild(t);}
  const pal=[col.brand,col.accent,col.pos,col.warn];const slot=pad.w/p.length;const groupWidth=Math.max(12,slot-12);const barWidth=Math.max(8,(groupWidth-((p[0].values.length-1)*6))/Math.max(1,p[0].values.length));
  p.forEach((q,i)=>{q.values.forEach((val,j)=>{const xx=pad.l+i*slot+(slot-groupWidth)/2+j*(barWidth+6);const baseY=y(Math.max(0,val));const topY=y(val);const barH=Math.abs(topY-baseY);const startY=val>=0?baseY:topY;const r=E('rect',{x:xx,y:pad.t+pad.h,width:barWidth,height:0,rx:5,fill:pal[j%pal.length]});s.appendChild(r);requestAnimationFrame(()=>{r.setAttribute('y',startY);r.setAttribute('height',barH);r.style.transition='height .4s ease,y .4s ease';});r.addEventListener('mouseenter',()=>tip(c,`${q.label} · ${labels[j]||'Value'}`,money(val),xx+barWidth/2,Math.min(startY,startY+barH)));r.addEventListener('mouseleave',()=>hide(c));});const t=E('text',{x:pad.l+i*slot+slot/2,y:H-11,'text-anchor':'middle',fill:col.mute,'font-size':10});t.textContent=q.label;s.appendChild(t);});
  labels.forEach((label,i)=>{const x0=pad.l+i*120;s.appendChild(E('rect',{x:x0,y:8,width:10,height:10,rx:3,fill:pal[i%pal.length]}));const t=E('text',{x:x0+15,y:17,fill:col.mute,'font-size':10});t.textContent=label;s.appendChild(t);});
  c.innerHTML='';c.appendChild(s);
 });
}
function arc(cx,cy,r,ri,a0,a1){const large=(a1-a0)>Math.PI?1:0,p0=[cx+r*Math.cos(a0),cy+r*Math.sin(a0)],p1=[cx+r*Math.cos(a1),cy+r*Math.sin(a1)],p2=[cx+ri*Math.cos(a1),cy+ri*Math.sin(a1)],p3=[cx+ri*Math.cos(a0),cy+ri*Math.sin(a0)];return`M${p0[0]} ${p0[1]} A${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]} A${ri} ${ri} 0 ${large} 0 ${p3[0]} ${p3[1]} Z`;}
function donut(c,segments=[],opts={}){watch(c,()=>{const segs=(Array.isArray(segments)?segments:[]).filter(x=>num(x.value)>0),col=C(),W=Math.max(c.clientWidth||0,220),H=Math.max(c.clientHeight||0,220),size=Math.min(W,H),cx=W/2,cy=H/2,r=size/2-8,ri=r*.62,total=segs.reduce((a,x)=>a+num(x.value),0);const s=E('svg',{viewBox:`0 0 ${W} ${H}`,width:W,height:H,preserveAspectRatio:'xMidYMid meet'});if(!segs.length){s.appendChild(E('circle',{cx,cy,r,fill:'none',stroke:col.grid,'stroke-width':r-ri}));}let a=-Math.PI/2;segs.forEach(q=>{const a1=a+(num(q.value)/total)*Math.PI*2;s.appendChild(E('path',{d:arc(cx,cy,r,ri,a,a1),fill:q.color||col.brand,stroke:col.surface,'stroke-width':2}));a=a1;});const t=E('text',{x:cx,y:cy-2,'text-anchor':'middle',fill:col.text,'font-size':size*.15,'font-weight':800});t.textContent=opts.centerLabel??(total?money(total):'0');s.appendChild(t);const st=E('text',{x:cx,y:cy+size*.09,'text-anchor':'middle',fill:col.mute,'font-size':size*.07,'font-weight':600});st.textContent=opts.centerSub||'Total';s.appendChild(st);c.innerHTML='';c.appendChild(s);});}
window.Charts={area,groupedBars,donut};
})();
