/* psylch report helpers v1: tabs ([data-tabs] > button[data-t] -> #id.panel), hash deep-link, auto table-wrap */
(function(){
 document.documentElement.classList.remove('no-js');
 function wrapTables(){document.querySelectorAll('.report table').forEach(function(t){if(t.parentElement.classList.contains('table-wrap'))return;var w=document.createElement('div');w.className='table-wrap';t.parentNode.insertBefore(w,t);w.appendChild(t);});}
 function initTabs(){document.querySelectorAll('[data-tabs],.tabs[role=tablist]').forEach(function(bar){
  var btns=[].slice.call(bar.querySelectorAll('[data-t]'));if(!btns.length)return;
  function show(id,push){btns.forEach(function(b){var on=b.getAttribute('data-t')===id;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);var p=document.getElementById(b.getAttribute('data-t'));if(p)p.classList.toggle('on',on);});
   var cur=bar.querySelector('.on');if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:'nearest',inline:'center'});if(push&&history.replaceState)history.replaceState(null,'','#'+id);}
  btns.forEach(function(b){b.setAttribute('role','tab');b.addEventListener('click',function(e){e.preventDefault();show(b.getAttribute('data-t'),true);});});
  var h=location.hash.slice(1);var hit=btns.some(function(b){return b.getAttribute('data-t')===h;});
  show(hit?h:(bar.querySelector('.on')||btns[0]).getAttribute('data-t'),false);
 });}
 function go(){wrapTables();initTabs();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
})();
/* v2: mobile section picker — any tab bar with >3 items becomes a sticky picker + bottom sheet on <=640px; <=3 items become a full-width segmented control. Prev/next pager at end of each panel. Works with pages' own tab JS by clicking the original tab. */
(function(){
 function txt(e){return (e.textContent||'').replace(/\s+/g,' ').trim();}
 function build(){
  var bars=[],seen=[];
  [].forEach.call(document.querySelectorAll('.tabbar,.tabs'),function(b){
   if(b.classList.contains('tabs')&&b.closest('.tabbar'))return;
   var its=[].slice.call(b.querySelectorAll('[data-t]')).filter(function(e){return document.getElementById(e.getAttribute('data-t'));});
   if(its.length<2)return; bars.push({el:b,its:its});
  });
  bars.forEach(function(B,bi){
   var bar=B.el,its=B.its;
   if(its.length<=3&&bar.classList.contains('tabs')){bar.classList.add('rp-seg');}
   else{
    bar.classList.add('rp-m-hide');
    var model=its.map(function(e,i){var g=e.closest('.grp'),gl=g&&g.querySelector('.gl');return {el:e,id:e.getAttribute('data-t'),name:txt(e),group:gl?txt(gl):'',i:i};});
    var pk=document.createElement('button');pk.type='button';pk.className='rp-picker';pk.setAttribute('aria-haspopup','dialog');
    pk.innerHTML='<span class="t"><span class="g"></span><b></b></span><span class="n"></span><span class="cv"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#111" stroke-width="1.6" stroke-linecap="round"><path d="M3 4.5 6 7.5 9 4.5"/></svg></span>';
    bar.parentNode.insertBefore(pk,bar.nextSibling);
    var scrim=document.createElement('div');scrim.className='rp-scrim';
    var sh=document.createElement('div');sh.className='rp-sheet';sh.setAttribute('role','dialog');sh.setAttribute('aria-label','选择章节');
    var h='<div class="hd">选择章节<button class="x" type="button" aria-label="关闭">×</button></div><div class="bd">',lastG=null;
    model.forEach(function(m){if(m.group!==lastG){if(m.group)h+='<h6>'+m.group.replace(/</g,'&lt;')+'</h6>';lastG=m.group;}
     h+='<button type="button" class="it" data-i="'+m.i+'"><i>'+(m.i+1)+'</i><span></span></button>';});
    sh.innerHTML=h+'</div>';
    [].forEach.call(sh.querySelectorAll('.it span'),function(s,i){s.textContent=model[i].name;});
    document.body.appendChild(scrim);document.body.appendChild(sh);
    function open(){document.documentElement.classList.add('rp-open');var c=sh.querySelector('.it.on');if(c)c.scrollIntoView({block:'center'});}
    function close(){document.documentElement.classList.remove('rp-open');}
    function cur(){for(var i=0;i<model.length;i++){var p=document.getElementById(model[i].id);if(p&&p.classList.contains('on'))return i;}return 0;}
    function sync(){var i=cur(),m=model[i];pk.querySelector('.g').textContent=m.group||'章节';pk.querySelector('b').textContent=m.name;pk.querySelector('.n').textContent=(i+1)+'/'+model.length;
     [].forEach.call(sh.querySelectorAll('.it'),function(b,j){b.classList.toggle('on',j===i);});}
    function go(i){close();model[i].el.click();setTimeout(function(){sync();var y=pk.getBoundingClientRect().top+scrollY-10;if(scrollY>y)scrollTo({top:y,behavior:'smooth'});},30);}
    pk.addEventListener('click',open);scrim.addEventListener('click',close);sh.querySelector('.x').addEventListener('click',close);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
    sh.addEventListener('click',function(e){var b=e.target.closest('.it');if(b)go(+b.getAttribute('data-i'));});
    model.forEach(function(m,i){var p=document.getElementById(m.id);if(!p||p.querySelector(':scope>.rp-pager'))return;
     var pg=document.createElement('div');pg.className='rp-pager';
     var pv=model[i-1],nx=model[i+1];
     pg.innerHTML=(pv?'<button type="button" class="pv"><small>← 上一节</small><span></span></button>':'<span class="sp"></span>')+(nx?'<button type="button" class="nx"><small>下一节 →</small><span></span></button>':'<span class="sp"></span>');
     if(pv){pg.querySelector('.pv span').textContent=pv.name;pg.querySelector('.pv').onclick=function(){go(i-1);};}
     if(nx){pg.querySelector('.nx span').textContent=nx.name;pg.querySelector('.nx').onclick=function(){go(i+1);};}
     p.appendChild(pg);});
    model.forEach(function(m){m.el.addEventListener('click',function(){setTimeout(sync,0);});});
    window.addEventListener('hashchange',function(){setTimeout(sync,0);});
    sync();
   }
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(build,0);});else setTimeout(build,0);
})();
/* back-to-top pill: shows after ~1 screen of scroll */
(function(){
 function init(){
  var b=document.createElement('button');b.type='button';b.className='rp-top';b.setAttribute('aria-label','回到顶部');
  b.innerHTML='<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11.5V3M3.5 6.5 7 3l3.5 3.5"/></svg>顶部';
  document.body.appendChild(b);
  var t=false;function up(){t=false;b.classList.toggle('show',scrollY>innerHeight*.9);}
  addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(up);}},{passive:true});up();
  b.addEventListener('click',function(){scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
