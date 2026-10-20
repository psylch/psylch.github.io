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
