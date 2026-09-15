async page=>{
 await page.route('**/events',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
 await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townAdventure);
 const results=[];
 for(const [width,height] of [[390,580],[960,580],[1920,1080],[2560,1440]]){
  await page.setViewportSize({width,height});
  results.push(await page.evaluate(()=>{
   cancelAnimationFrame(frameRequest);townUI.roomView='all';updateRoomView();fitCanvas();const original=ctx.scale;let sample=null,checks=0;
   ctx.scale=function(x,y){const result=original.call(this,x,y);if(!sample)sample=this.getTransform();return result;};
   try{for(const zoom of [.8,1.8])for(const size of [32,76,96])for(const element of [0,1,2,3,4,null]){
    ctx.save();ctx.resetTransform();ctx.translate(cv.width/2,cv.height/2);ctx.scale(dpr*zoom,dpr*zoom);sample=null;
    const x=45,feet=50,anchor=element===0||element===2?45:element===1?37:element===3?-12:0;
    const targetY=element===0||element===2?feet:element===1?feet-size*.2:feet-size*.45;
    townAdventure.foregroundFinish(x,feet,.45,2,element,size);
    if(!sample)throw Error('missing effect');const expectedX=cv.width/2+x*dpr*zoom,expectedY=cv.height/2+targetY*dpr*zoom;
    if(Math.abs(sample.e-expectedX)>.01||Math.abs(sample.f+sample.d*anchor-expectedY)>.01)throw Error('skill detached from target: '+JSON.stringify({width:innerWidth,element,size,expectedY,actualY:sample.f+sample.d*anchor}));
    if(sample.a/(dpr*zoom)>Math.max(1.05,size/60)*(element===null?1.35:1)+.001)throw Error('fullscreen effect grows beyond target proportions');
    ctx.restore();checks++;
   }return {width:innerWidth,height:innerHeight,anchors:checks};}finally{ctx.scale=original;}
  }));
 }
 return results;
}
