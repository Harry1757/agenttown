// Standalone UI fixture. It never opens or changes a real Codex session.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('/Users/hwangsoonhwan/.npm/_npx/9833c18b2d85bc59/node_modules/playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const source = fs.readFileSync(path.join(root, 'town-adventure.js'), 'utf8');
    const shopMarkup = source.match(/shopDialog\.innerHTML=`([^`]+)`;/)[1];
    await page.setContent('<main id="map-stage" style="height:100vh"><div id="adventure-controls"><details id="adventure-log"><summary>⚔ 모험</summary></details><button id="open-stardust-shop">✦ 상점</button></div><section class="duel-mini-leaders" style="width:180px;height:48px">동네 챔피언</section><dialog id="stardust-shop">' + shopMarkup + '</dialog></main>');
    await page.addStyleTag({path: path.join(root, 'town-ui.css')});
    await page.addStyleTag({path: path.join(root, 'town-journal.css')});
    await page.addStyleTag({content: 'body{display:block;margin:0}#adventure-log summary{font:12px sans-serif;background:#203b32;border:1px solid #647e63;border-radius:8px;padding:7px 10px;list-style:none}'});
    await page.evaluate(() => {
      const names = ['숲의 파수꾼', '불꽃의 군주', '서리 여왕', '깊은 바다의 왕', '벼락의 사냥꾼', '모래의 수호자', '그림자 군주', '별의 용'];
      window.journalFixture = {
        bosses: names.map((name, idx) => ({id: String(idx), name, idx, level: 10 + idx, seen: idx < 3 ? 2 : 0, kills: idx < 2 ? 1 : 0, losses: idx === 2 ? 1 : 0, maxHit: idx < 3 ? 108 : 0})),
        treasure: {seen: 4, caught: 2, escaped: 2, stars: 120}, raids: {seen: 2, won: 1, lost: 1},
        relations: [{aKey: 'a', bKey: 'b', aName: '<img src=x onerror=alert(1)> 안전한 사용자 제목', bName: '한글 작업 이름이 길어도 읽기 편한 주민', coops: 3, duels: 12}],
        sessions: [{key: 'a', title: '첫 번째 주민', idx: 0, mode: 'off'}, {key: 'b', title: '두 번째 주민', idx: 1, mode: 'off'}]
      };
      window.autoModes = {};
      window.townAdventure = {journal: () => journalFixture, autoMode: key => autoModes[key] || 'off', setAutoMode: (key, mode) => {autoModes[key] = mode; window.dispatchEvent(new Event('town:chronicle')); return true;}};
      window.drawTile = context => {context.fillStyle = '#d5b880'; context.fillRect(10, 10, 60, 60);};
      document.querySelector('#shop-session').innerHTML = '<option value="a">첫 번째 주민</option><option value="b">두 번째 주민</option>';
    });
    await page.addScriptTag({path: path.join(root, 'town-journal-ui.js')});
    // Loading twice must not duplicate controls or listeners.
    await page.addScriptTag({path: path.join(root, 'town-journal-ui.js')});
    assert.equal(await page.locator('#shop-auto-mode').count(), 1);
    for (const width of [390, 680, 960]) {
      await page.setViewportSize({width, height: 580});
      const overlaps = await page.evaluate(() => {
        const a = document.querySelector('#open-town-journal').getBoundingClientRect();
        const b = document.querySelector('.duel-mini-leaders').getBoundingClientRect();
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      });
      assert.equal(overlaps, false, 'journal does not overlap leaders at ' + width);
      await page.locator('#open-town-journal').click();
      assert.equal(await page.locator('.journal-boss').count(), 8);
      assert.equal(await page.locator('.journal-relations img').count(), 0, 'user titles are plain text');
      assert.equal(await page.locator('#town-journal').evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
      assert.deepEqual(await page.locator('.journal-boss,.journal-event,.journal-relation').evaluateAll(nodes => nodes.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)), []);
      await page.locator('.journal-relation').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.journal-close').evaluate(e => e.getBoundingClientRect().top >= 0 && e.getBoundingClientRect().bottom < innerHeight), true);
      await page.locator('.journal-content').evaluate(e => {e.scrollTop = 0;});
      await page.screenshot({path: '/tmp/town-journal-' + width + '.png'});
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#open-town-journal').evaluate(e => document.activeElement === e), true, 'Escape restores focus');
      await page.evaluate(() => document.querySelector('#stardust-shop').showModal());
      await page.locator('#shop-auto-mode').selectOption('attack');
      assert.equal(await page.evaluate(() => autoModes.a), 'attack');
      await page.locator('#shop-session').selectOption('b');
      assert.equal(await page.locator('#shop-auto-mode').inputValue(), 'off');
      await page.locator('#shop-auto-mode').selectOption('tank');
      await page.locator('#shop-auto-mode').focus();
      await page.evaluate(() => {window.dispatchEvent(new Event('town:shop')); window.dispatchEvent(new Event('town:sessions'));});
      assert.equal(await page.locator('#shop-auto-mode').evaluate(e => document.activeElement === e), true, 'refresh preserves focus');
      await page.evaluate(() => {const e = document.querySelector('#shop-session'); e.innerHTML = '<option value="a">다시 첫 번째 주민</option>'; e.value = 'a';});
      await page.waitForFunction(() => document.querySelector('#shop-auto-mode').value === 'attack');
      assert.equal(await page.locator('.shop-auto-equipment').evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
      await page.keyboard.press('Escape');
      await page.evaluate(() => {autoModes.b = 'off'; document.querySelector('#shop-session').innerHTML = '<option value="a">첫 번째 주민</option><option value="b">두 번째 주민</option>';});
    }
    await page.evaluate(() => {journalFixture.sessions = []; const e = document.querySelector('#shop-session'); e.innerHTML = '<option value="">마을에 세션이 없어요</option>'; e.disabled = true; window.dispatchEvent(new Event('town:sessions'));});
    assert.equal(await page.locator('#shop-auto-mode').isDisabled(), true);
    await page.locator('#open-town-journal').click();
    assert.equal(await page.locator('.journal-boss').count(), 8, 'journal accessible without residents');
    await page.evaluate(() => {journalFixture.bosses[0].kills = 5; window.dispatchEvent(new Event('town:chronicle'));});
    assert.match(await page.locator('.journal-boss').first().innerText(), /승리\s+5/);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({passed: true, widths: [390, 680, 960], bosses: 8, safeTitles: true, independentModes: true, focusPreserved: true, noResidents: true, screenshots: '/tmp/town-journal-{width}.png'}));
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
