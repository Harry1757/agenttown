/* Village memories are independent of the residents currently in the village. */
(() => {
  'use strict';
  const controls = document.getElementById('adventure-controls');
  const shop = document.getElementById('stardust-shop');
  if (!controls || !shop || document.getElementById('town-journal')) return;
  const game = () => window.townAdventure;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))).toLocaleString('ko-KR') : '0';
  const button = make('button', '', '▤ 도감');
  button.id = 'open-town-journal';
  button.type = 'button';
  button.setAttribute('aria-label', '마을 모험 도감 열기');
  button.setAttribute('aria-haspopup', 'dialog');
  button.title = '보스 도감 · 주민 인연 · 마을 사건';
  controls.append(button);

  const dialog = make('dialog');
  dialog.id = 'town-journal';
  dialog.setAttribute('aria-labelledby', 'town-journal-title');
  dialog.setAttribute('closedby', 'any');
  dialog.innerHTML = '<header class="journal-heading"><div><span class="journal-eyebrow">함께 쌓아 가는 마을의 기억</span><h2 id="town-journal-title">모험 도감</h2></div><button type="button" class="journal-close" aria-label="모험 도감 닫기" autofocus>×</button></header><div class="journal-content"><p class="journal-intro">주민이 떠나도 발견과 전투 기록은 이 마을에 남아요.</p><section aria-labelledby="journal-boss-title"><div class="journal-section-heading"><h3 id="journal-boss-title">보스 도감</h3><span class="journal-discovered"></span></div><div class="journal-bosses"></div></section><section aria-labelledby="journal-event-title"><h3 id="journal-event-title">마을 사건</h3><div class="journal-events"></div></section><section aria-labelledby="journal-relation-title"><h3 id="journal-relation-title">주민 사이의 인연</h3><p class="journal-note">함께 이긴 협동전은 친구의 기억, 주민전은 라이벌의 기록이 돼요.</p><ul class="journal-relations"></ul></section></div>';
  document.getElementById('map-stage').append(dialog);
  const metrics = entries => {
    const list = make('dl', 'journal-metrics');
    for (const [label, value] of entries) {
      const pair = make('div');
      pair.append(make('dt', '', label), make('dd', '', count(value)));
      list.append(pair);
    }
    return list;
  };
  let lastSnapshot = '';
  function renderJournal() {
    if (!dialog.open || !game()?.journal) return;
    const snapshot = game().journal();
    const signature = JSON.stringify(snapshot);
    if (signature === lastSnapshot) return;
    lastSnapshot = signature;
    const bosses = snapshot.bosses || [];
    dialog.querySelector('.journal-discovered').textContent = `${bosses.filter(b => b.seen > 0).length} / ${bosses.length} 발견`;
    const cards = bosses.map(boss => {
      const card = make('article', 'journal-boss' + (boss.seen ? ' is-discovered' : ''));
      const portrait = make('div', 'journal-portrait');
      const canvas = make('canvas');
      canvas.width = canvas.height = 80;
      canvas.setAttribute('aria-hidden', 'true');
      portrait.append(canvas);
      if (!boss.seen) portrait.append(make('span', 'journal-unknown', '?'));
      const copy = make('div', 'journal-boss-copy');
      copy.append(make('span', 'journal-eyebrow', boss.seen ? `발견 · Lv. ${count(boss.level)}` : '미발견'), make('h4', '', boss.name));
      card.append(portrait, copy, metrics([['만남', boss.seen], ['승리', boss.kills], ['패배', boss.losses], ['최대 피해', boss.maxHit]]));
      const context = canvas.getContext('2d');
      if (context && typeof drawTile === 'function') {
        context.imageSmoothingEnabled = false;
        drawTile(context, 'dungeon', boss.idx, 8, 8, 4);
      }
      return card;
    });
    dialog.querySelector('.journal-bosses').replaceChildren(...cards);
    const treasure = snapshot.treasure || {}, raids = snapshot.raids || {};
    const treasureCard = make('article', 'journal-event');
    treasureCard.append(make('h4', '', '✦ 보물 고블린'), metrics([['등장', treasure.seen], ['포획', treasure.caught], ['도주', treasure.escaped], ['보너스 별가루', treasure.stars]]));
    const raidCard = make('article', 'journal-event');
    raidCard.append(make('h4', '', '⚔ 중앙 협동전'), metrics([['시작', raids.seen], ['승리', raids.won], ['패배·종료', raids.lost]]));
    dialog.querySelector('.journal-events').replaceChildren(treasureCard, raidCard);
    const rows = (snapshot.relations || []).filter(pair => pair.coops || pair.duels).map(pair => {
      const row = make('li', 'journal-relation');
      const names = make('p', 'journal-pair');
      names.append(make('span', '', pair.aName || '떠난 주민'), make('span', 'journal-pair-link', '↔'), make('span', '', pair.bName || '떠난 주민'));
      row.append(names, make('p', 'journal-relation-count', `♡ 함께 승리 ${count(pair.coops)}회 · ⚔ 주민전 ${count(pair.duels)}회`));
      return row;
    });
    if (!rows.length) rows.push(make('li', 'journal-empty', '아직 기록된 인연이 없어요. 주민들이 함께 모험하면 이곳에 남아요.'));
    dialog.querySelector('.journal-relations').replaceChildren(...rows);
  }
  button.addEventListener('click', () => {
    dialog.showModal();
    renderJournal();
    dialog.querySelector('.journal-content').scrollTop = 0;
  });
  dialog.querySelector('.journal-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => button.focus({preventScroll: true}));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });

  // Keep the selector node stable so shop updates never interrupt keyboard use.
  const sessionSelect = shop.querySelector('#shop-session');
  const auto = make('div', 'shop-auto-equipment');
  const label = make('label', '', '자동 장비 구매');
  label.htmlFor = 'shop-auto-mode';
  const select = make('select');
  select.id = 'shop-auto-mode';
  select.setAttribute('aria-describedby', 'shop-auto-note');
  for (const [value, name] of [['off', '꺼짐 · 직접 고르기'], ['attack', '공격 우선'], ['tank', '생존 우선'], ['balanced', '균형 있게']]) {
    const option = make('option', '', name);
    option.value = value;
    select.append(option);
  }
  const note = make('p', '', '보상을 받은 뒤 쉬는 동안, 이 세션의 별가루로 더 좋은 장비를 골라요.');
  note.id = 'shop-auto-note';
  auto.append(label, select, note);
  sessionSelect.insertAdjacentElement('afterend', auto);
  function syncAuto() {
    const key = sessionSelect.value;
    const mode = game()?.autoMode?.(key) || 'off';
    if (select.value !== mode) select.value = mode;
    select.disabled = !key || sessionSelect.disabled || !game()?.setAutoMode;
  }
  select.addEventListener('change', () => {
    const key = sessionSelect.value;
    const success = key && game()?.setAutoMode?.(key, select.value);
    syncAuto();
    const feedback = shop.querySelector('.shop-feedback');
    if (feedback) feedback.textContent = success ? '이 세션의 자동 장비 구매 설정을 저장했어요.' : '자동 구매 설정을 저장하지 못했어요.';
  });
  sessionSelect.addEventListener('change', syncAuto);
  // Existing shop refreshes options programmatically when opening another resident.
  new MutationObserver(syncAuto).observe(sessionSelect, {childList: true, attributes: true, attributeFilter: ['disabled']});
  new MutationObserver(syncAuto).observe(shop, {attributes: true, attributeFilter: ['open']});
  for (const event of ['town:chronicle', 'town:sessions', 'town:shop']) window.addEventListener(event, () => {
    syncAuto();
    renderJournal();
  });
  syncAuto();
})();
