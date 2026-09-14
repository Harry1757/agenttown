async page => {
  await page.goto('http://127.0.0.1:8869');
  const backup=await page.evaluate(()=>Object.fromEntries(['codextown.adventure','codextown.shop','codextown.shop.sessions'].map(k=>[k,localStorage.getItem(k)])));
  try {
    return await page.evaluate(()=>{
      cancelAnimationFrame(frameRequest);
      const winCount=townUI.winCount;townUI.winCount=a=>a.key.includes('grown')?25:0;
      const failures=[];let tested=0;
      try {
        for(const id of ['','grown','steel','frost','astral','axe','hammer','staff','thunderblade','tideblade','eclipse','runemallet','legend']) {
          const key='E2E|weapon-'+id,a=avatars[key]={key,idx:84};
          for(let i=0;i<10;i++)townAdventure.reward(a,true);
          if(id&&!['grown','legend'].includes(id))townAdventure.buy(id,key);
          for(const size of [32,48,76])for(const angle of [.48,.9,1.3,1.95])for(const face of [1,-1]) {
            ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,320,240);
            ctx.save();ctx.translate(130,180);ctx.scale(face,1);drawTile(ctx,'dungeon',84,-size/2,-size,size/16);ctx.restore();
            const left=Math.floor(130-size*.18),top=Math.floor(180-size*.65),w=Math.ceil(size*.36),h=Math.ceil(size*.2);
            const before=ctx.getImageData(left,top,w,h).data;
            townAdventure.equipment(a,130,180,size,{sword:angle,flash:angle>.3?1:0},face,id==='legend');
            const after=ctx.getImageData(left,top,w,h).data;
            let opaque=0,changed=0;
            for(let p=0;p<before.length;p+=4)if(before[p+3]>240){
              opaque++;
              // Ignore subtle weapon glow; detect actual obstruction of facial pixels.
              if(Math.abs(before[p]-after[p])+Math.abs(before[p+1]-after[p+1])+Math.abs(before[p+2]-after[p+2])>120)changed++;
            }
            ctx.restore();tested++;
            if(!opaque||changed>Math.max(2,opaque*.08))failures.push({id,size,angle,face,changed,opaque});
          }
        }
        if(failures.length)throw Error('Face obstruction: '+JSON.stringify(failures));
        return {tested,failures};
      } finally {townUI.winCount=winCount;}
    });
  } finally {
    await page.evaluate(backup=>{for(const[k,v]of Object.entries(backup)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}},backup);
    await page.reload();
  }
}
