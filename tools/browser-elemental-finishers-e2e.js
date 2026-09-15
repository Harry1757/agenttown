async page=>{
 await page.goto('http://127.0.0.1:8869');await page.waitForFunction(()=>window.townAdventure);
 return page.evaluate(()=>{
  cancelAnimationFrame(frameRequest);const originalContext=ctx,g=townAdventure,check=(ok,msg)=>{if(!ok)throw Error(msg);};
  const sheet=document.createElement('canvas');sheet.width=1250;sheet.height=750;const c=sheet.getContext('2d');c.fillStyle='#111d29';c.fillRect(0,0,sheet.width,sheet.height);
  const labels=['화염 · 지면 폭발과 불기둥','번개 · 연쇄 낙뢰와 뇌격','물 · 양쪽 파도와 솟구침','바람 · 교차하는 세 갈래 칼날','안개 · 시차를 둔 연속 참격'],times=[.12,.45,.8],masks=[],counts=[];
  try{
   for(let row=0;row<3;row++)for(let kind=0;kind<5;kind++){
    const frame=document.createElement('canvas');frame.width=180;frame.height=170;ctx=frame.getContext('2d');ctx.translate(90,85);g.finisher(0,0,times[row],kind);
    const data=ctx.getImageData(0,0,180,170).data,mask=new Uint8Array(180*170);let painted=0,outside=0;
    for(let y=0;y<170;y++)for(let x=0;x<180;x++){const i=y*180+x;if(data[i*4+3]>35){mask[i]=1;painted++;if(x<5||x>174||y<5||y>164)outside++;}}
    check(painted>100,'effect remains visible at phase '+times[row]+' kind '+kind);check(!outside,'effect stays within foreground allowance');if(row===1)masks.push(mask);counts.push(painted);
    c.drawImage(frame,kind*250+26,row*250+48,198,187);c.fillStyle='#e8edde';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText(labels[kind],kind*250+125,row*250+23);c.fillStyle='#a2b5b3';c.font='11px sans-serif';c.fillText(Math.round(times[row]*2100)+'ms',kind*250+125,row*250+42);frame.width=frame.height=0;
   }
   let leastDifference=1;for(let a=0;a<5;a++)for(let b=a+1;b<5;b++){let union=0,different=0;for(let i=0;i<masks[a].length;i++){if(masks[a][i]||masks[b][i])union++;if(masks[a][i]!==masks[b][i])different++;}const ratio=different/union;leastDifference=Math.min(leastDifference,ratio);check(ratio>.2,'silhouettes must differ beyond recoloring: '+a+'/'+b);}
   return {frames:15,lateFrames:5,leastSilhouetteDifference:leastDifference,pixels:counts,contactSheet:sheet.toDataURL()};
  }finally{ctx=originalContext;sheet.width=sheet.height=0;}
 });
}
