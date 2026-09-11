'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const savedFavorites = read('codextown.favorites', []);
  const favorites = new Set(Array.isArray(savedFavorites) ? savedFavorites : []);
  const ui = window.townUI = {
    roomView: read('codextown.roomView', 'focus'), selectedKey: null, filter: 'all', project: '', query: '', favoritesOnly: false, connected: false,
    motionReduced: read('codextown.reducedMotion', window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    matches(key) {
      const row = state.sessionInfo[key];
      if (!row) return true;
      return matching({ ...row, key, proj: key.slice(0, key.lastIndexOf('|')) });
    },
    select(key) {
      ui.selectedKey = key;
      render();
      if (window.innerWidth <= 1100) setRoster(true);
    },
  };
  const statusOf = row => row.needsInput ? 'input' : row.state;
  const statusText = row => ({ input: '내 응답 필요', working: '작업 중', waiting: '답변 완료', done: '쉬는 중' })[statusOf(row)] || '확인 중';
  function rows() {
    return Object.entries(state.sessionInfo).map(([key, row]) => ({...row, key, proj:key.slice(0,key.lastIndexOf('|')), sid:key.slice(key.lastIndexOf('|')+1)}));
  }
  function matching(row) {
    if (ui.project && ui.project !== row.proj) return false;
    if (ui.favoritesOnly && !favorites.has(row.key)) return false;
    if (ui.filter === 'input' && !row.needsInput) return false;
    if (ui.filter === 'working' && (row.state !== 'working' || row.needsInput)) return false;
    if (ui.filter === 'resting' && (row.needsInput || row.state === 'working')) return false;
    const text = `${row.title} ${shortLabel(row.proj)} ${row.model || ''}`.toLocaleLowerCase();
    return !ui.query || text.includes(ui.query);
  }
  function drawPortrait(canvas, key, sub) {
    if (!canvas || !SHEETS.dungeon.img) return;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0,0,32,32);
    drawTile(c, 'dungeon', sub ? T.charSlime : charFor(key), 0, 0, 2);
  }
  let lastList = '', lastDetail = '', lastProjects = '', lastDetailKey = '';
  function render() {
    const all = rows();
    const counts = {
      all:all.length, input:all.filter(r=>r.needsInput).length,
      working:all.filter(r=>r.state==='working'&&!r.needsInput).length,
      resting:all.filter(r=>r.state!=='working'&&!r.needsInput).length,
    };
    for (const [key,value] of Object.entries(counts)) $('count-'+key).textContent = value;
    $('roster-total').textContent = `${all.length}개`;
    $('office-summary').textContent = counts.input ? `${counts.working}개 작업 중 · ${counts.input}개 작업이 답을 기다려요` : counts.working ? `${counts.working}개 작업이 진행 중이에요` : all.length ? '작업을 마치고 잠시 쉬는 중이에요' : ui.connected ? '새 작업을 시작하면 마을에 나타납니다' : 'Codex의 작업을 불러오고 있어요';
    $('map-empty').hidden = all.length > 0 || !ui.connected;
    const today = all.reduce((n,r)=>n+(r.tokensToday||0),0);
    $('today-value').innerHTML = `${formatTokens(today)} <span>토큰</span>`;
    const projects = [...new Set(all.map(r=>r.proj))].sort((a,b)=>shortLabel(a).localeCompare(shortLabel(b)));
    const projectSignature = JSON.stringify(projects.map(key=>[key,shortLabel(key)]));
    if (projectSignature !== lastProjects) {
      $('project-filter').replaceChildren(new Option('모든 프로젝트',''), ...projects.map(key=>new Option(shortLabel(key),key)));
      if (projects.includes(ui.project)) $('project-filter').value = ui.project;
      else ui.project = '';
      lastProjects = projectSignature;
    }
    const rank = r => r.needsInput ? 0 : r.state === 'working' ? 1 : r.state === 'waiting' ? 2 : 3;
    const visible = all.filter(matching).sort((a,b)=>Number(favorites.has(b.key))-Number(favorites.has(a.key)) || rank(a)-rank(b) || b.mtime-a.mtime);
    const signature = JSON.stringify(visible.map(r=>[r.key,r.title,statusOf(r),favorites.has(r.key)])) + ui.selectedKey;
    if (signature !== lastList) {
      const focused = document.activeElement?.closest('.task-button')?.dataset.key;
      const scrollTop = $('task-list').scrollTop;
      const fragments = document.createDocumentFragment();
      for (const row of visible) {
        const item = document.createElement('li'); item.className='task-row';
        const button = document.createElement('button');
        button.className='task-button'+(row.needsInput?' needs-input':'');
        button.dataset.key=row.key;
        button.setAttribute('aria-pressed',String(ui.selectedKey===row.key));
        button.innerHTML=`<canvas width="32" height="32" class="mini-avatar" aria-hidden="true"></canvas><span class="task-copy"><span class="task-title">${escapeHtml(row.title||shortLabel(row.proj))}</span><span class="task-meta"><span class="task-project">${escapeHtml(shortLabel(row.proj))}</span><span>·</span><span class="task-state ${statusOf(row)}">${statusText(row)}</span></span></span>${favorites.has(row.key)?'<span class="favorite-marker" aria-label="즐겨찾기">★</span>':`<i class="dot ${statusOf(row)}" aria-hidden="true"></i>`}`;
        button.addEventListener('click',()=>ui.select(row.key));
        button.addEventListener('dblclick',()=>openTask(row));
        item.append(button);fragments.append(item);
        drawPortrait(button.querySelector('canvas'),row.key,row.sub);
      }
      if (!visible.length) {
        const empty=document.createElement('li');empty.className='empty-list';
        empty.innerHTML=all.length?'<strong>해당하는 작업이 없어요</strong>검색어나 필터를 바꿔 보세요.':'<strong>아직 도착한 작업이 없어요</strong>Codex에서 작업을 시작해 보세요.';
        fragments.append(empty);
      }
      $('task-list').replaceChildren(fragments);
      $('task-list').scrollTop=scrollTop;
      if (focused) [...$('task-list').querySelectorAll('button')].find(b=>b.dataset.key===focused)?.focus({preventScroll:true});
      lastList=signature;
    }
    const selected=all.find(r=>r.key===ui.selectedKey);
    if (!selected && ui.selectedKey) { ui.selectedKey=null; lastDetail=''; }
    $('roster').classList.toggle('show-detail',Boolean(selected));
    $('task-detail').hidden=!selected;
    $('detail-placeholder').hidden=Boolean(selected);
    if (selected) renderDetail(selected);
    $('view-focus').setAttribute('aria-pressed',String(ui.roomView!=='all'));
    $('view-all').setAttribute('aria-pressed',String(ui.roomView==='all'));
    $('zoom-label').textContent=Math.round(cam.scale/cam.fitScale*100)+'%';
    $('local-clock').textContent=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
    $('motion-toggle').setAttribute('aria-pressed',String(ui.motionReduced));
  }
  function renderDetail(row) {
    const signature=JSON.stringify([row,favorites.has(row.key)]);
    if (signature===lastDetail) return;
    const focusId=$('task-detail').contains(document.activeElement)?document.activeElement.id:null;
    const el=$('task-detail');
    const detailScroll = lastDetailKey === row.key ? el.scrollTop : 0;
    el.innerHTML=`<button id="back-to-list" class="back-to-list">← 작업 목록으로</button><div class="detail-eyebrow"><i class="dot ${statusOf(row)}"></i>${statusText(row)}${row.sub?' · 보조 에이전트':''}</div><h3 class="detail-title">${escapeHtml(row.title)}</h3><dl class="detail-info"><dt>프로젝트</dt><dd>${escapeHtml(shortLabel(row.proj))}</dd><dt>모델</dt><dd>${escapeHtml(row.model||'기록 없음')}</dd><dt>최근 도구</dt><dd>${escapeHtml(row.lastTool||'아직 없음')}</dd><dt>오늘 토큰</dt><dd>${formatTokens(row.tokensToday||0)} <span style="color:var(--muted)">/ 누적 ${formatTokens(row.tokens||0)}</span></dd></dl><div class="detail-actions"><button id="open-selected" class="open-task">Codex에서 열기</button><button id="locate-selected" class="locate">지도에서 찾기</button><button id="star-selected" class="star-button" aria-label="즐겨찾기" aria-pressed="${favorites.has(row.key)}">${favorites.has(row.key)?'★':'☆'}</button></div>`;
    $('back-to-list').onclick=()=>{ui.selectedKey=null;render();$('task-search').focus({preventScroll:true});};
    $('open-selected').onclick=()=>openTask(row);
    $('locate-selected').onclick=()=>{
      const a=avatars[row.key];if (!a) return;
      if(a.role==='done' && ui.roomView!=='all'){ui.roomView='all';save('codextown.roomView','all');refit();render();}
      ui.selectedKey=row.key;
      cam.zoomSteps=cam.fitScale*.65;cam.userAdjusted=true;cam.animTo=null;
      const scale=cam.fitScale+cam.zoomSteps;
      const off=clampOffset(scale,cv.width/2-(a.x+.5)*TILE*scale,cv.height/2-(a.y+.5)*TILE*scale);
      cam.offX=off.x;cam.offY=off.y;
      if (window.innerWidth<=1100) setRoster(false);
    };
    $('star-selected').onclick=()=>{ if(favorites.has(row.key)) favorites.delete(row.key); else favorites.add(row.key);save('codextown.favorites',[...favorites]);render(); };
    el.scrollTop=detailScroll;
    if(focusId) $(focusId)?.focus({preventScroll:true});
    lastDetailKey=row.key;lastDetail=signature;
  }
  async function openTask(row) {
    if (window.codextown?.focusSession) {
      const result=await window.codextown.focusSession([],row.title,row.entry,row.sid);
      if (!result?.ok) toast(result?.reason||'Codex 앱을 열지 못했습니다');
    } else if (/^[a-f0-9-]{36}$/i.test(row.sid)) {
      window.location.href=`codex://threads/${row.sid}`;
    }
  }
  function setRoster(open) {
    $('workspace').classList.toggle('roster-open',open);
    $('mobile-roster').setAttribute('aria-expanded',String(open));
    if (!open && $('roster').contains(document.activeElement) && window.innerWidth<=1100) $('mobile-roster').focus({preventScroll:true});
  }
  document.querySelector('.office').addEventListener('click',e=>{
    if(window.innerWidth<=1100 && $('workspace').classList.contains('roster-open')) {e.stopPropagation();setRoster(false);}
  },true);
  window.matchMedia('(max-width:1100px)').addEventListener('change',()=>setRoster(false));
  $('task-search').addEventListener('input',e=>{ui.query=e.target.value.trim().toLocaleLowerCase();render();});
  $('project-filter').addEventListener('change',e=>{ui.project=e.target.value;render();});
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    ui.filter=button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();
  }));
  $('favorites-filter').onclick=()=>{ui.favoritesOnly=!ui.favoritesOnly;$('favorites-filter').setAttribute('aria-pressed',String(ui.favoritesOnly));$('favorites-filter').textContent=ui.favoritesOnly?'★':'☆';render();};
  for (const [id,view] of [['view-focus','focus'],['view-all','all']]) $(id).onclick=()=>{ui.roomView=view;save('codextown.roomView',view);refit();render();};
  $('zoom-in').onclick=()=>zoomStep(1,cv.width/2,cv.height/2);
  $('zoom-out').onclick=()=>zoomStep(-1,cv.width/2,cv.height/2);
  $('map-reset').onclick=()=>{resetCamera();ui.selectedKey=null;render();};
  $('motion-toggle').onclick=()=>{ui.motionReduced=!ui.motionReduced;setGesture(null);save('codextown.reducedMotion',ui.motionReduced);render();};
  $('mobile-roster').onclick=()=>setRoster(!$('workspace').classList.contains('roster-open'));
  $('close-roster').onclick=()=>setRoster(false);
  document.addEventListener('keydown',e=>{
    if ((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k') { e.preventDefault();setRoster(true);$('task-search').focus(); }
    if (e.key==='Escape'&&!gesture) { if (document.activeElement===$('task-search')) {$('task-search').value='';ui.query='';render();}else{ui.selectedKey=null;setRoster(false);render();} }
  });
  let notificationsEnabled=true;
  function notificationState(enabled) {notificationsEnabled=enabled;$('notification-toggle').setAttribute('aria-pressed',String(enabled));$('notification-toggle').querySelector('span').textContent=enabled?'무음 배너':'알림 꺼짐';}
  if(window.codextown?.getNotifications) window.codextown.getNotifications().then(notificationState);
  else {$('notification-toggle').disabled=true;$('notification-toggle').title='데스크톱 앱에서 배너 알림을 사용할 수 있습니다';$('notification-test').disabled=true;}
  $('notification-toggle').onclick=async()=>{try{notificationState(await window.codextown.setNotifications(!notificationsEnabled));}catch{toast('알림 설정을 저장하지 못했습니다');}};
  $('notification-test').onclick=()=>window.codextown?.testNotification();
  window.addEventListener('town:sessions',()=>{ui.connected=true;setConnection(true);render();});
  window.addEventListener('town:disconnected',()=>setConnection(false));
  window.addEventListener('town:usage',e=>{
    const usage=e.detail;
    $('usage-freshness').textContent=usage.stale?'이전 기록 표시 중':usage.at?'최근 확인 '+new Date(usage.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'사용량 확인 중';
  });
  function setConnection(connected) {ui.connected=connected;$('connection-state').classList.toggle('offline',!connected);$('connection-state').querySelector('span').textContent=connected?'실시간 연결':'다시 연결 중';}
  if(window.codextown?.onVisibility) window.codextown.onVisibility(visible=>{
    const wasHidden=window.townHidden;window.townHidden=!visible;
    if(!visible){cancelAnimationFrame(frameRequest);frameRequest=0;}
    if(visible&&wasHidden){refit();if(!frameRequest)frameRequest=requestAnimationFrame(tick);render();}
  });
  setInterval(()=>{if(!window.townHidden)render();},1000);
  render();
  const portraits=setInterval(()=>{if(!SHEETS.dungeon.img)return;drawPortrait($('brand-avatar'),'codextown-brand',false);lastList='';render();clearInterval(portraits);},150);
})();
