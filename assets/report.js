/* psylch report helpers v4 — https://psylch.github.io/assets/report.js
   tables   : every <table> gets a .table-wrap (horizontal scroll, edge shadows, sticky 1st column on phones)
   tabs     : [data-tabs] > [data-t] -> #id.panel, #hash deep link (also reads data-tab / aria-controls / href="#id")
   desktop (>=1024px): one fixed left column (.rp-sb) holds all navigation — tabs with their groups, the site's
              page list (nav.side / .rp-sitenav), and the headings of the current tab or page (scrollspy).
              Tab bars, pickers, duplicate inline TOCs and the floating dock are hidden there; no dialogs.
   phones/tablets: <=3 tabs -> equal-width segmented control; more -> pills while they fit, else one sticky picker
              + bottom sheet. Long tab-less pages get a 目录 button (bottom sheet). Prev/next pager after each panel.
              Pages' own tab JS keeps working: we only click the original tab.
   dock     : bottom-right 目录 + ↑ 顶部 (below 1024px, or pages without a left column) */
(function(){
 var D=document,R=D.documentElement;R.classList.remove('no-js');
 function $$(s,c){return [].slice.call((c||D).querySelectorAll(s));}
 function txt(e){return (e.textContent||'').replace(/\s+/g,' ').trim();}
 function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
 function hashId(){try{return decodeURIComponent(location.hash.slice(1));}catch(e){return location.hash.slice(1);}}
 /* labels that already carry their own number ("1. …", "03 …") don't get a second one */
 function dropNums(model){var re=/^(\d+|[一二三四五六七八九十]+)\s*[.、·:：)）]|^\d+\s/;
  if(model.filter(function(m){return re.test(m.name);}).length>=model.length/2)model.forEach(function(m){m.no='';});}
 function mq(q){return matchMedia(q).matches;}
 function phone(){return mq('(max-width:640px)');}
 function desk(){return mq('(min-width:1024px)');}
 function smooth(){return mq('(prefers-reduced-motion: reduce)')?'auto':'smooth';}
 function rafThrottle(f){var t=false;return function(){if(!t){t=true;requestAnimationFrame(function(){t=false;f();});}};}
 var onResize=[];addEventListener('resize',rafThrottle(function(){onResize.forEach(function(f){f();});}));
 var ICON={
  down:'<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 4.5 6 7.5 9 4.5"/></svg>',
  up:'<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11.5V3M3.5 6.5 7 3l3.5 3.5"/></svg>',
  list:'<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 3.5h10M2 7h10M2 10.5h6"/></svg>'
 };
 var SPY=90;

 /* ---------- headings ---------- */
 var idN=0;
 function ensureId(h){if(!h.id){var id;do{id='sec-'+(++idN);}while(D.getElementById(id));h.id=id;}return h.id;}
 /* h2s if there are at least `min`, else h2+h3; a lone leading h2 (a panel's own title) is dropped */
 function heads(root,min){
  function ok(h){return !h.closest('.toc,nav,.card,.grid,.rp-sheet,.rp-sb,details:not([open]),header,footer,.table-wrap,.rp-pager');}
  var hs=$$('h2',root).filter(ok);
  if(hs.length<min){var hx=$$('h2,h3',root).filter(ok);
   if(hx.filter(function(h){return h.tagName==='H2';}).length===1&&hx[0].tagName==='H2')hx.shift();
   if(hx.length>hs.length)hs=hx;}
  return hs.length>=min?hs:[];
 }
 function headModel(hs){
  var mixed=hs.some(function(h){return h.tagName==='H3';})&&hs.some(function(h){return h.tagName==='H2';});
  var k=0,model=hs.map(function(h){ensureId(h);var lv=mixed&&h.tagName==='H3'?1:0;return {h:h,name:txt(h),lv:lv,no:lv?'':++k};});
  dropNums(model);return model;
 }
 function jumpTo(h,setHash){h.scrollIntoView({behavior:smooth(),block:'start'});if(setHash&&history.replaceState)history.replaceState(null,'','#'+h.id);}
 function lastAbove(list){var i=-1;for(var j=0;j<list.length;j++){if(list[j].getBoundingClientRect().top<=SPY)i=j;else break;}return i;}

 /* ---------- tables ---------- */
 function tables(){
  $$('.report table').forEach(function(t){
   var w=t.parentElement;
   if(!w.classList.contains('table-wrap')){w=D.createElement('div');w.className='table-wrap';t.parentNode.insertBefore(w,t);w.appendChild(t);}
   function upd(){
    var over=w.scrollWidth>w.clientWidth+1,c=t.rows[0]&&t.rows[0].cells[0];
    w.classList.toggle('rp-x',over);
    w.classList.toggle('rp-l',over&&w.scrollLeft>2);
    w.classList.toggle('rp-stick1',!!(over&&phone()&&c&&c.offsetWidth<=Math.min(150,w.clientWidth*.42)));
   }
   w.addEventListener('scroll',rafThrottle(upd),{passive:true});upd();onResize.push(upd);
  });
 }
 /* runs of >=3 sibling profile cards (.card with .nm) become a card grid on desktop */
 function cardRuns(){
  $$('.report main .card').forEach(function(c){
   var p=c.previousElementSibling;if(p&&p.classList.contains('card'))return;
   if(c.parentElement.classList.contains('grid')||c.parentElement.classList.contains('rp-cards'))return;
   var run=[c],n=c.nextElementSibling;while(n&&n.classList.contains('card')){run.push(n);n=n.nextElementSibling;}
   if(run.length<3||!run.every(function(x){return x.querySelector(':scope>.nm');}))return;
   var g=D.createElement('div');g.className='rp-cards';c.parentNode.insertBefore(g,c);run.forEach(function(x){g.appendChild(x);});
  });
 }

 /* ---------- bottom sheet (phones/tablets only) ---------- */
 var openSheet=null,scrim;
 function close(){if(openSheet){openSheet.el.classList.remove('on');openSheet=null;}R.classList.remove('rp-open');}
 function makeSheet(title,model,onPick){
  if(!scrim){scrim=D.createElement('div');scrim.className='rp-scrim';D.body.appendChild(scrim);scrim.addEventListener('click',close);
   D.addEventListener('keydown',function(e){if(e.key==='Escape')close();});onResize.push(function(){if(desk())close();});}
  var el=D.createElement('div');el.className='rp-sheet';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',title);
  var h='<div class="hd"><span>'+title+'</span><button class="x" type="button" aria-label="关闭">×</button></div><div class="bd">',lastG=null;
  model.forEach(function(m,i){
   if(m.group!==lastG){if(lastG!==null)h+='</div>';h+='<div class="gp">'+(m.group?'<h6>'+esc(m.group)+'</h6>':'');lastG=m.group;}
   h+='<button type="button" class="it'+(m.lv?' sub':'')+'" data-i="'+i+'"><i>'+(m.no||'')+'</i><span><span>'+esc(m.name)+'</span></span></button>';
  });
  el.innerHTML=h+'</div></div>';
  var its=$$('.it',el);
  D.body.appendChild(el);
  el.querySelector('.x').addEventListener('click',close);
  el.addEventListener('click',function(e){var b=e.target.closest('.it');if(b){close();onPick(+b.getAttribute('data-i'));}});
  return {el:el,
   open:function(cur){close();openSheet=this;R.classList.add('rp-open');el.classList.add('on');
    its.forEach(function(b,j){b.classList.toggle('on',j===cur);b.setAttribute('aria-current',j===cur?'true':'false');});
    var c=its[cur];if(c){c.scrollIntoView({block:'center'});if(!phone())c.focus({preventScroll:true});}}};
 }

 /* ---------- desktop left column ----------
    items: [{name, group, no, lv, href, go(i)}]; opt.kids(i) -> headings shown under the current item;
    opt.itemHeads -> items are themselves headings (current item follows scroll) */
 var SB=null;
 function makeSidebar(title,items,opt){
  var nav=D.createElement('nav');nav.className='rp-sb';nav.setAttribute('aria-label',title);
  var h='<div class="hd">'+esc(title)+'</div>',lastG=null;
  items.forEach(function(m,i){
   if(m.group&&m.group!==lastG)h+='<h6>'+esc(m.group)+'</h6>';lastG=m.group;
   h+='<a class="it'+(m.lv?' sub':'')+'" data-i="'+i+'" href="'+esc(m.href||'#')+'">'+(m.no?'<i>'+m.no+'</i>':'')+'<span><span>'+esc(m.name)+'</span></span></a>';
   if(opt.kids)h+='<div class="kids" hidden></div>';
  });
  nav.innerHTML=h+'<a class="top" href="#">↑ 回到顶部</a>';
  D.body.appendChild(nav);D.body.classList.add('rp-sbon');
  var its=$$('.it',nav),cur=-2,kids=[],ka=[],kcur=-2;
  function reveal(a){if(!a||!desk())return;var r=nav.getBoundingClientRect(),ar=a.getBoundingClientRect();
   if(ar.top<r.top+40||ar.bottom>r.bottom-60)nav.scrollTop+=ar.top-r.top-r.height/3;}
  function spy(){
   if(opt.itemHeads){setCur(lastAbove(opt.itemHeads));return;}
   if(!ka.length)return;var i=lastAbove(kids);
   if(i!==kcur){kcur=i;ka.forEach(function(a,j){a.classList.toggle('on',j===i);});reveal(ka[i]);}
  }
  function setCur(i){
   if(i===cur)return;cur=i;
   its.forEach(function(a,j){a.classList.toggle('on',j===i);if(j===i)a.setAttribute('aria-current',opt.itemHeads?'location':'page');else a.removeAttribute('aria-current');});
   if(opt.kids){
    $$('.kids',nav).forEach(function(k){k.hidden=true;k.innerHTML='';});
    var km=i>=0?headModel(opt.kids(i)):[];kids=km.map(function(m){return m.h;});kcur=-2;
    if(km.length>=2){var box=its[i].nextElementSibling;box.hidden=false;
     box.innerHTML=km.map(function(m,j){return '<a class="k'+(m.lv?' sub':'')+'" data-k="'+j+'" href="#'+esc(m.h.id)+'"><span>'+esc(m.name)+'</span></a>';}).join('');}
    ka=$$('.k',nav);spy();
   }
   reveal(its[i]);
  }
  nav.addEventListener('click',function(e){
   var a=e.target.closest('a');if(!a)return;
   if(a.classList.contains('top')){e.preventDefault();scrollTo({top:0,behavior:smooth()});return;}
   if(a.classList.contains('k')){e.preventDefault();jumpTo(kids[+a.getAttribute('data-k')],opt.kidHash);return;}
   var i=+a.getAttribute('data-i'),m=items[i];
   if(opt.itemHeads){e.preventDefault();jumpTo(opt.itemHeads[i],true);}
   else if(m.go){e.preventDefault();m.go(i);}
  });
  addEventListener('scroll',rafThrottle(spy),{passive:true});
  return SB={el:nav,setCur:setCur,spy:spy};
 }

 /* ---------- tabs ([data-tabs] with [data-t]) ---------- */
 function initTabs(){$$('[data-tabs],.tabs[role=tablist]').forEach(function(bar){
  var btns=$$('[data-t]',bar);if(!btns.length)return;
  function show(id,push){btns.forEach(function(b){var on=b.getAttribute('data-t')===id;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);var p=D.getElementById(b.getAttribute('data-t'));if(p)p.classList.toggle('on',on);});
   if(push&&history.replaceState)history.replaceState(null,'','#'+id);}
  btns.forEach(function(b){b.setAttribute('role','tab');b.addEventListener('click',function(e){e.preventDefault();show(b.getAttribute('data-t'),true);});});
  var h=hashId();var hit=btns.some(function(b){return b.getAttribute('data-t')===h;});
  show(hit?h:(bar.querySelector('.on')||btns[0]).getAttribute('data-t'),false);
 });}

 /* ---------- section nav (tab bars) ---------- */
 function target(e){
  var v=e.getAttribute('data-t')||e.getAttribute('aria-controls')||(/^#./.test(e.getAttribute('href')||'')?e.getAttribute('href').slice(1):''),t=v&&D.getElementById(v);
  var dt=e.getAttribute('data-tab');if(!t&&dt)t=D.getElementById(dt)||D.getElementById('panel-'+dt);
  return t&&(t.classList.contains('panel')||t.getAttribute('role')==='tabpanel')?t:null;
 }
 function sectionNav(){
  var bars=[];
  $$('.tabbar,.tabs').forEach(function(b){
   if(b.classList.contains('tabs')&&b.closest('.tabbar'))return;
   var its=$$('[data-t],[data-tab],[aria-controls],a[href^="#"]',b).filter(target);
   if(its.length>=2)bars.push({el:b,its:its});
  });
  bars.forEach(function(B){
   var bar=B.el,its=B.its,n=its.length,grouped=!!bar.querySelector('.gl');
   var mark=D.createElement('div');mark.className='rp-mark';bar.parentNode.insertBefore(mark,bar);
   var model=its.map(function(e,i){var g=e.closest('.grp'),gl=g&&g.querySelector('.gl');return {el:e,panel:target(e),name:txt(e),group:gl?txt(gl):'',no:i+1};});dropNums(model);
   function cur(){for(var i=0;i<n;i++)if(model[i].panel.classList.contains('on'))return i;
    for(i=0;i<n;i++)if(model[i].el.classList.contains('on')||model[i].el.getAttribute('aria-selected')==='true')return i;return 0;}
   function settle(){var y=mark.getBoundingClientRect().top+scrollY-10;if(scrollY>y+2)scrollTo({top:y,behavior:smooth()});}
   function go(i){model[i].el.click();setTimeout(function(){sync();settle();},30);}
   var deep=model.some(function(m){return heads(m.panel,3).length;});
   var own=!SB&&(n>=4||grouped||deep)&&makeSidebar('章节',model.map(function(m){
     var t=m.el.getAttribute('data-t')||m.el.getAttribute('data-tab');return {name:m.name,group:m.group,no:m.no,href:t?'#'+t:'#'+m.panel.id,go:go};}),
    {kids:function(i){return heads(model[i].panel,2);}});
   if(own)bar.classList.add('rp-insb');
   function sync(){var i=cur();if(own)own.setCur(i);if(pk){var m=model[i];pk.querySelector('.g').textContent=m.group||'章节';pk.querySelector('b').textContent=m.name;pk.querySelector('.n').textContent=(i+1)+' / '+n;}}
   var pk=null;
   model.forEach(function(m){m.el.addEventListener('click',function(){setTimeout(function(){sync();settle();},30);});});
   addEventListener('hashchange',function(){setTimeout(sync,0);});
   if(n<=3&&!grouped&&bar.classList.contains('tabs')){bar.classList.add('rp-seg');sync();return;}
   pk=D.createElement('button');pk.type='button';pk.className='rp-picker';pk.setAttribute('aria-haspopup','dialog');
   pk.innerHTML='<span class="t"><span class="g"></span><b></b></span><span class="n"></span><span class="cv">'+ICON.down+'</span>';
   bar.parentNode.insertBefore(pk,bar.nextSibling);
   var sh=makeSheet('选择章节',model,go);
   pk.addEventListener('click',function(){sh.open(cur());});
   model.forEach(function(m,i){
    if(m.panel.querySelector(':scope>.rp-pager'))return;
    var pv=model[i-1],nx=model[i+1],pg=D.createElement('div');pg.className='rp-pager';
    pg.innerHTML=(pv?'<button type="button" class="pv"><small>← 上一节</small><span></span></button>':'<span class="sp"></span>')+(nx?'<button type="button" class="nx"><small>下一节 →</small><span></span></button>':'<span class="sp"></span>');
    if(pv){pg.querySelector('.pv span').textContent=pv.name;pg.querySelector('.pv').onclick=function(){go(i-1);};}
    if(nx){pg.querySelector('.nx span').textContent=nx.name;pg.querySelector('.nx').onclick=function(){go(i+1);};}
    m.panel.appendChild(pg);
   });
   function layout(){
    if(own&&desk()){bar.classList.remove('rp-collapsed');pk.classList.remove('on');return;}
    var collapse=phone()||grouped||n>8;
    if(!collapse){bar.classList.remove('rp-collapsed');var t=bar.classList.contains('tabs')?bar:bar.querySelector('.tabs')||bar;collapse=t.scrollWidth>t.clientWidth+1||t.offsetHeight>64;}
    bar.classList.toggle('rp-collapsed',collapse);pk.classList.toggle('on',collapse);
   }
   layout();onResize.push(layout);
   sync();
  });
 }

 /* ---------- dock: 目录 + 顶部 ---------- */
 var dock,tocBtn;
 function makeDock(){
  dock=D.createElement('div');dock.className='rp-dock';
  dock.innerHTML='<button type="button" class="rp-toc" hidden aria-label="本页目录">'+ICON.list+'<span>目录</span><small></small></button><button type="button" class="rp-top" aria-label="回到顶部">'+ICON.up+'<span>顶部</span></button>';
  D.body.appendChild(dock);tocBtn=dock.querySelector('.rp-toc');
  var up=function(){dock.classList.toggle('show',scrollY>innerHeight*.9);};
  addEventListener('scroll',rafThrottle(up),{passive:true});up();
  dock.querySelector('.rp-top').addEventListener('click',function(){scrollTo({top:0,behavior:smooth()});});
 }

 /* ---------- pages without tabs: site page list and/or outline ---------- */
 function outline(){
  var main=D.querySelector('body.report main')||D.querySelector('main');
  if(!main||D.querySelector('.panel'))return;
  var site=D.querySelector('nav.side,.rp-sitenav');
  var hs=heads(main,4),long=txt(main).length>=4000||R.scrollHeight>=innerHeight*3;
  var model=hs.length&&long?headModel(hs):[];
  if(site&&!SB){
   var links=$$('a[href]',site),here=location.href.split('#')[0],ci=-1;
   var items=links.map(function(a,i){if(a.classList.contains('cur')||a.getAttribute('aria-current')==='page'||a.href.split('#')[0]===here)ci=ci<0?i:ci;return {name:txt(a),href:a.getAttribute('href')};});
   var tl=site.querySelector('summary,h2,h3,b,.t');
   makeSidebar(tl?txt(tl):'目录',items,{kids:function(){return model.length?hs:heads(main,2);},kidHash:true});
   site.classList.add('rp-insb');SB.setCur(ci);
  }else if(model.length&&!SB){
   makeSidebar('本页目录',model.map(function(m){return {name:m.name,lv:m.lv,no:m.no,href:'#'+m.h.id};}),{itemHeads:hs});SB.spy();
  }
  if(!model.length)return;
  /* an inline .toc that just repeats the outline is hidden where the left column shows it */
  if(SB){var ids={};hs.forEach(function(h){ids[h.id]=1;});
   $$('.toc',main).forEach(function(t){if(t===site)return;var as=$$('a[href^="#"]',t),hit=as.filter(function(a){return ids[decodeURIComponent(a.getAttribute('href').slice(1))];}).length;
    if(as.length>=3&&hit>=as.length*.6)t.classList.add('rp-insb');});}
  var sh=makeSheet('本页目录',model,function(i){jumpTo(hs[i],true);});
  function spy(){var i=lastAbove(hs);tocBtn.querySelector('small').textContent=i>=0?(i+1)+'/'+model.length:'';}
  tocBtn.hidden=false;
  tocBtn.addEventListener('click',function(){sh.open(Math.max(lastAbove(hs),0));});
  addEventListener('scroll',rafThrottle(spy),{passive:true});spy();
 }

 /* ---------- long inline .toc: clamp on phones ---------- */
 function clampToc(){
  $$('.toc').forEach(function(t){
   var lis=t.querySelectorAll('li');if(lis.length<=8||t.querySelector('details'))return;
   t.classList.add('rp-clamp');
   var b=D.createElement('button');b.type='button';b.className='rp-more';b.textContent='展开全部 '+lis.length+' 项';
   b.addEventListener('click',function(){t.classList.add('rp-expanded');});
   t.appendChild(b);
  });
 }

 function go(){
  tables();cardRuns();initTabs();
  setTimeout(function(){makeDock();sectionNav();outline();clampToc();},0);
 }
 if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',go);else go();
})();
