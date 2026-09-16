async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));const results=[];
 for(const width of [390,960,1440]){
  await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townAdventure);
  await page.evaluate(()=>{localStorage.setItem('codextown.adventure',JSON.stringify({'Sort|a':{kills:0,bosses:0,earnedStardust:10000}}));localStorage.removeItem('codextown.shop.sessions');});await page.reload();await page.waitForFunction(()=>window.townAdventure&&SHEETS.dungeon.img);
  await page.evaluate(()=>{cancelAnimationFrame(frameRequest);const key='Sort|a';avatars[key]={key,proj:'Sort',sid:'a',idx:84,role:'waiting',x:3,y:4,tx:3,ty:4};state.sessionInfo[key]={title:'상점 정렬 확인',state:'working',tokens:1e6};window.dispatchEvent(new Event('town:sessions'));townUI.select(key);});
  await page.locator('#equipment-selected').click();
  const slots=await page.locator('.shop-categories button').evaluateAll(es=>es.map(e=>e.dataset.slot));
  for(const slot of slots){await page.locator('.shop-categories [data-slot="'+slot+'"]').click();const sorted=await page.evaluate(slot=>{const shown=[...document.querySelectorAll('.shop-item [data-item]')].map(e=>townAdventure.catalog.find(i=>i.id===e.dataset.item));return shown.length>0&&shown.every((i,n)=>(slot==='all'||i.slot===slot)&&(!n||shown[n-1].price<=i.price))&&document.activeElement?.dataset.slot===slot;},slot);if(!sorted)throw Error('Sorting/filter/focus failed '+width+'/'+slot);}
  await page.locator('.shop-categories [data-slot="weapon"]').click();const first=page.locator('.shop-item [data-item]').first();const id=await first.getAttribute('data-item');await first.click();
  const bought=await page.evaluate(id=>{const card=document.querySelector('[data-item="'+id+'"]').closest('.shop-item'),item=townAdventure.catalog.find(i=>i.id===id);return card.querySelector('.shop-price').textContent.includes(String(item.price))&&card.querySelector('.shop-price').textContent.includes('장착 중')&&document.activeElement.dataset.item===id;},id);if(!bought)throw Error('Purchase price or focus lost');
  await page.keyboard.press('Escape');await page.locator('#close-detail').click();if(await page.locator('#task-detail').isVisible())throw Error('Detail did not close');
  results.push({width,categories:slots.length,priceOrder:true,purchasePrice:true,keyboardFocus:true,detailClose:true});
 }
 return results;
}
