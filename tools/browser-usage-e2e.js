async page => {
  const results=[],errors=[];
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const onError=e=>errors.push(e.message);page.on('pageerror',onError);
  const fixture={at:Date.now(),windows:[{label:'Codex 7일',used:31,resetsAt:Date.now()+86400000},{label:'Spark 5시간',used:60},{label:'Spark 7일',used:89}]};
  await page.route('**/api/usage',r=>r.fulfill({json:fixture}));
  try{
    await page.goto('http://127.0.0.1:8869');
    for(const [width,height] of [[952,577],[680,580],[390,580],[360,500],[1440,600],[1440,900]]){
      await page.setViewportSize({width,height});
      await page.evaluate(f=>renderUsage(f),fixture);
      const compact=width<=1100||height<=700;
      const before=await page.locator('.statusbar').boundingBox();
      check(await page.locator('#usage-toggle').isVisible()===compact,'Responsive toggle');
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
      if(compact){
        check(before.height<=48,`Compact footer ${width}: ${before.height}`);
        check(!await page.locator('.u-item .u-sub').first().isVisible(),'Resets collapsed');
        await page.getByRole('button',{name:'사용량 상세 펼치기'}).click();
        check(await page.locator('.u-item .u-sub').first().isVisible(),'Resets expanded');
        for(const item of await page.locator('.u-item').all()){
          const r=await item.boundingBox();check(r.x>=0&&r.x+r.width<=width,`Expanded limit fits ${width}`);
        }
        check(await page.locator('#usage-freshness').isVisible(),'Freshness available');
        await page.evaluate(f=>renderUsage({...f,windows:[{label:'Codex 7일',used:42}]}),fixture);
        check(await page.locator('.u-pct').textContent()==='42%','Live update while expanded');
        await page.getByRole('button',{name:'사용량 상세 접기'}).press('Enter');
        check((await page.locator('.statusbar').boundingBox()).height<=48,'Keyboard collapse');
        await page.evaluate(()=>renderUsage({error:'서버 연결 확인',windows:[]}));
        check(await page.getByText('한도 못 받음 — 서버 연결 확인').isVisible(),'Error still visible in compact mode');
        await page.evaluate(f=>renderUsage({...f,stale:true}),fixture);
        check(await page.getByText('이전 기록 · 최신 조회 확인 필요').isVisible(),'Stale marker retained');
      }else{
        check(before.height>70,'Wide footer retains details');
        check(await page.locator('.u-item .u-sub').first().isVisible(),'Wide resets visible');
      }
      results.push({width,height,footerHeight:before.height});
    }
    await page.setViewportSize({width:952,height:577});
    await page.getByRole('button',{name:'사용량 상세 펼치기'}).click();
    await page.setViewportSize({width:1440,height:900});
    await page.setViewportSize({width:952,height:577});
    check(await page.locator('#usage-toggle').getAttribute('aria-expanded')==='false','Resize resets compact mode');
    check(errors.length===0,errors.join('\n'));
    return results;
  }finally{await page.unroute('**/api/usage');page.off('pageerror',onError);}
}
