/* Village events keep their own clock and party state; wallets stay in townAdventure. */
(function (root) {
'use strict';
function createTownEvents(host) {
 const now=()=>host.now(),random=()=>host.random(),game=()=>host.game();
 let raid=null,treasure=null,nextRaid=now()+180000,nextTreasure=now()+90000,last=now(),greetAt=0;
 const greetings=[],eligible=()=>host.residents().filter(a=>host.eligible(a));
 const notify=(type,action,stars=0)=>host.event?.(type,action,stars);
 const freeze=a=>host.freeze?.(a),release=a=>host.release?.(a);
 function finish(won,time,cancelled=false){
  if(!raid||raid.done)return;
  const r=raid;r.done=true;r.won=won;r.cancelled=cancelled;r.ended=time;
  if(!cancelled){notify('raids',won?'won':'lost');host.result?.(r.monster,won);}
  if(won){
   const contributors=r.members.filter(m=>m.damage>0&&!m.left),total=contributors.reduce((s,m)=>s+m.damage,0),pool=96+r.members.length*12;
   for(const m of contributors){m.reward=6+Math.floor(pool*m.damage/Math.max(1,total));host.reward(m.a,true,m.reward);}
   host.cooperate?.(contributors.map(m=>m.a));
  }
 }
 function close(time){const old=raid;raid=null;nextRaid=time+180000+random()*180000;if(old)for(const m of old.members)if(!m.left)release(m.a);}
 function cancel(){if(raid){finish(false,now(),true);close(now());}if(treasure)removeTreasure(false);greetings.length=0;nextTreasure=now()+90000;}
 function startRaid(actors=eligible()){
  if(raid||game().active||host.duels()||!host.enabled())return false;
  const unique=[...new Map(actors.filter(a=>host.eligible(a)).map(a=>[a.key,a])).values()].slice(0,4);if(unique.length<2)return false;
  const members=unique.map(a=>{const stats=host.stats(a);return {a,stats,hp:stats.hp,maxHp:stats.hp,damage:0,reward:0,left:false};});
  const hp=220+members.reduce((s,m)=>s+m.maxHp*.9,0),attack=28+members.length*2+members.reduce((s,m)=>s+m.stats.attack,0)/members.length*.22;
  const kind={id:'eclipseLord',effect:'dusk',name:'월식의 군주',idx:122,color:'#d699ff',size:3.2};
  const monster={boss:true,elite:true,kind,idx:122,name:'균열의 월식 군주',level:12,power:kind};
  raid={members,monster,hp:Math.round(hp),maxHp:Math.round(hp),attack:Math.round(attack),defense:12,crit:.12,start:now(),next:now()+3000,phase:'arrival',cursor:0,turn:0,done:false};
  members.forEach(m=>freeze(m.a));notify('raids','seen');host.see?.(monster);return true;
 }
 function alive(r){return r.members.filter(m=>!m.left&&m.hp>0);}
 function preparePlayer(r,time){
  const ready=alive(r);if(!ready.length){finish(false,time);return;}
  for(let i=0;i<r.members.length;i++){const j=(r.cursor+i)%r.members.length,m=r.members[j];if(!m.left&&m.hp>0){r.actor=m;r.cursor=(j+1)%r.members.length;break;}}
  r.pending=host.damage(r.actor.stats.attack,r.defense,r.actor.stats.crit);r.finishing=r.pending.damage>=r.hp;r.phase='playerWindup';r.phaseAt=time;r.next=time+(r.finishing?2600:700);
 }
 function stepRaid(time){
  const r=raid;if(!r)return;
  for(const m of r.members)if(!m.left&&!host.present(m.a)){m.left=true;release(m.a);}
  if(!r.members.some(m=>!m.left)){finish(false,time,true);close(time);return;}
  if(r.done){if(time-r.ended>4200)close(time);return;}
  if(!alive(r).length){finish(false,time);return;}
  if(time<r.next)return;
  if(r.phase==='arrival'||r.phase==='bossImpact'){preparePlayer(r,time);return;}
  if(r.phase==='playerWindup'){
   if(r.actor.left||!r.actor.hp){preparePlayer(r,time);return;}
   const actual=Math.min(r.hp,r.pending.damage);r.hp-=actual;r.actor.damage+=actual;r.hit={at:time,damage:r.pending.damage,critical:r.pending.critical,target:'boss',actor:r.actor};host.hit?.(r.monster,actual);r.turn++;
   if(!r.hp){finish(true,time);return;}r.phase='playerImpact';r.phaseAt=time;r.next=time+850;return;
  }
  if(r.phase==='playerImpact'){
   const ready=alive(r);r.target=ready[Math.floor(random()*ready.length)];r.special=random()<.1;r.phase='bossWindup';r.phaseAt=time;r.next=time+(r.special?1600:800);return;
  }
  if(r.phase==='bossWindup'){
   if(r.target.left||!r.target.hp){const ready=alive(r);r.target=ready[Math.floor(random()*ready.length)];}
   const hit=host.damage(r.attack*(r.special?2.6:1),r.target.stats.defense,r.crit);r.target.hp=Math.max(0,r.target.hp-hit.damage);r.hit={at:time,...hit,target:r.target,actor:'boss',special:r.special};
   if(!r.target.hp)host.defeat?.(r.target.a);
   r.phase='bossImpact';r.phaseAt=time;r.next=time+(r.special?1450:1000);if(!alive(r).length)finish(false,time);
  }
 }
 function removeTreasure(caught,stars=0){if(!treasure)return;const t=treasure;treasure=null;if(!t.reported){t.reported=true;notify('treasure',caught?'caught':'escaped',stars);}if(game().active?.m!==t.monster){const list=game().monsters,i=list.indexOf(t.monster);if(i>=0)list.splice(i,1);}nextTreasure=now()+150000+random()*90000;}
 function spawnTreasure(role){
  if(treasure||raid||game().active||!host.enabled())return false;
  const residents=eligible(),a=role?residents.find(a=>a.role===role):residents[Math.floor(random()*residents.length)],room=a&&host.room(a.role);if(!room)return false;
  const monster={role:a.role,gx:room.gx,gy:room.gy,x:room.gx+2+random()*3,y:room.gy+3.7,boss:false,treasure:true,level:4,reward:18+Math.floor(random()*13),at:now(),idx:108,name:'별주머니 고블린',power:{hp:125,attack:21,defense:5,crit:.05,speed:1.25,size:1.1}};
  treasure={monster,until:now()+30000,engaged:false,reported:false};game().monsters.push(monster);notify('treasure','seen');return monster;
 }
 function stepTreasure(time,dt){
  if(!treasure)return;const t=treasure,m=t.monster,b=game().active;
  if(b?.m===m){t.engaged=true;if(b.done&&!t.reported){t.reported=true;notify('treasure',b.won?'caught':'escaped',b.won?m.reward:0);}return;}
  if(t.engaged){removeTreasure(false);return;}
  if(time>=t.until||!host.roomValid(m)||!game().monsters.includes(m)){removeTreasure(false);return;}
  // The existing encounter detector owns contact and battle start. This owns only fleeing.
  m.pauseUntil=time+300;
  const nearby=eligible().filter(a=>a.role===m.role).sort((a,b)=>Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y))[0];
  if(!nearby)return;const distance=Math.hypot(m.x-nearby.x,m.y-nearby.y);
  if(distance<2.3&&distance>1.05){const dx=m.x-nearby.x,dy=m.y-nearby.y;m.x=Math.max(m.gx+1.35,Math.min(m.gx+5.65,m.x+dx/distance*dt*1.1));m.y=Math.max(m.gy+2.75,Math.min(m.gy+4.75,m.y+dy/distance*dt*1.1));m.face=dx>=0?1:-1;}
  else if(distance>=2.3){m.x=Math.max(m.gx+1.35,Math.min(m.gx+5.65,m.x+Math.cos(time/1400)*dt*.6));m.y=Math.max(m.gy+2.75,Math.min(m.gy+4.75,m.y+Math.sin(time/1700)*dt*.4));}
 }
 function step(time=now()){
  const dt=Math.min(.1,Math.max(0,(time-last)/1000));last=time;
  if(!host.enabled()){cancel();return;}
  stepTreasure(time,dt);if(raid){stepRaid(time);return;}
  if(!game().active&&!host.duels()){
   if(time>=nextRaid){nextRaid=time+60000;startRaid();}
   if(!raid&&time>=nextTreasure){nextTreasure=time+45000;spawnTreasure();}
   if(time>=greetAt){greetAt=time+12000;const people=eligible();outer:for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){const a=people[i],b=people[j];if(a.role===b.role&&Math.hypot(a.x-b.x,a.y-b.y)<2){const relation=host.relation?.(a,b);if(relation?.coops||relation?.duels>=3){greetings.push({a,b,at:time,friend:relation.coops>0});break outer;}}}}
  }
  for(let i=greetings.length-1;i>=0;i--)if(time-greetings[i].at>2200)greetings.splice(i,1);
 }
 return {step,cancel,startRaid,spawnTreasure,busy:a=>Boolean(raid?.members.some(m=>m.a===a&&!m.left)),get active(){return raid;},get treasure(){return treasure;},get greetings(){return greetings;},snapshot:()=>({raid,treasure,nextRaid,nextTreasure})};
}
if(typeof module==='object'&&module.exports)module.exports={createTownEvents};
root.createTownEvents=createTownEvents;
if(!root.townAdventure||typeof avatars==='undefined')return;
const g=root.townAdventure,clock=()=>performance.now(),journal=()=>g.chronicle;
const host={now:clock,random:()=>Math.random(),game:()=>g,duels:()=>roomDuels.size,enabled:()=>g.enabled!==false&&!root.townUI?.motionReduced,
 residents:()=>Object.values(avatars),present:a=>avatars[a.key]===a&&!state.sessionInfo[a.key]?.needsInput,
 eligible:a=>avatars[a.key]===a&&workerState(a)!=='done'&&!state.sessionInfo[a.key]?.needsInput&&!a.travelFrom&&!a.portal&&!a.route?.length&&!a.duel&&!g.resting(a)&&displayedRooms.includes(ROOM_BY_ROLE[a.role]),
 room:role=>ROOM_BY_ROLE[role],roomValid:m=>{const r=ROOM_BY_ROLE[m.role];return displayedRooms.includes(r)&&r.gx===m.gx&&r.gy===m.gy;},
 stats:a=>g.statsFor(a),damage:(a,d,c)=>g.rollDamage(a,d,c),reward:(a,b,s)=>g.reward(a,b,s),defeat:a=>g.defeat?.(a),
 freeze:a=>{a.tx=a.x;a.ty=a.y;a.roomAction=null;clearDuelAftermath(a);},release:a=>{if(avatars[a.key]!==a)return;a.wanderAt=clock()+30000;const next=a.nextRole;a.nextRole=null;if(next&&next!==a.role)changeRoom(a,next);},
 event:(...args)=>journal()?.event(...args),see:m=>journal()?.see(m),hit:(m,n)=>journal()?.hit(m,n),result:(m,w)=>journal()?.result(m,w),cooperate:actors=>journal()?.cooperate(actors.map(a=>({...a,title:state.sessionInfo[a.key]?.title||a.key}))),relation:(a,b)=>journal()?.relation(a,b)};
const events=createTownEvents(host);
function drawMap(){
 const P=TILE*layout.scale,time=clock(),treasure=events.treasure;
 ctx.save();ctx.textAlign='center';
 if(treasure&&!treasure.engaged){const m=treasure.monster,x=layout.offsetX+(m.x+.5)*P,y=layout.offsetY+(m.y+1)*P;
  ctx.fillStyle='#a07039';ctx.fillRect(x+P*.27,y-P*.58,P*.37,P*.37);ctx.fillStyle='#ffe394';ctx.fillRect(x+P*.34,y-P*.48,P*.2,P*.12);
  ctx.fillStyle='#ffe394';ctx.font=`bold ${Math.max(9,8*layout.scale)}px sans-serif`;ctx.fillText('✦ '+Math.max(0,Math.ceil((treasure.until-time)/1000))+'초',x,y-P*1.3);
  for(let i=0;i<4;i++){const phase=(time/900+i*.25)%1;ctx.globalAlpha=1-phase;ctx.fillRect(x-(m.face||1)*phase*P,y-P*.2-Math.sin(phase*3)*P*.3,3,3);}ctx.globalAlpha=1;
 }
 for(const greeting of events.greetings)for(const a of [greeting.a,greeting.b]){if(avatars[a.key]!==a)continue;ctx.globalAlpha=Math.min(1,(2200-(time-greeting.at))/500);ctx.font='17px sans-serif';ctx.fillStyle=greeting.friend?'#f2b5cd':'#ffd88c';ctx.fillText(greeting.friend?'♥':'⚡',layout.offsetX+(a.x+.5)*P,layout.offsetY+a.y*P-12-(time-greeting.at)/140);}
 ctx.restore();
}
function drawBattle(){
 const r=events.active;if(!r)return;const time=clock(),age=r.hit?(time-r.hit.at)/1000:99,t=(time-r.start)/1000;
 const width=cv.width/dpr-24,height=cv.height/dpr-24;if(width<=0||height<=0)return;
 const arenaWidth=Math.min(640,Math.max(450,width/height*310)),scale=Math.min(1.65,width/arenaWidth,height/310),edge=arenaWidth/2;
 const charge=r.phase==='playerWindup'&&r.finishing?Math.min(1,(time-r.phaseAt)/2600):r.phase==='bossWindup'&&r.special?Math.min(1,(time-r.phaseAt)/1600):0;
 ctx.save();ctx.fillStyle=`rgba(3,7,15,${.68+charge*.18})`;ctx.fillRect(0,0,cv.width,cv.height);ctx.translate(cv.width/2,cv.height/2);ctx.scale(dpr*scale,dpr*scale);
 g.chamber?.(r.monster.kind,arenaWidth);ctx.fillStyle='#13202b';ctx.fillRect(-edge+14,-138,arenaWidth-28,57);g.atmosphere?.(4,charge,t,arenaWidth,100,false);
 ctx.textAlign='center';ctx.fillStyle='#e8d5ff';ctx.font='bold 15px sans-serif';ctx.fillText('공동 토벌 · 균열의 월식 군주',0,-118);
 ctx.fillStyle='#2e273d';ctx.fillRect(-140,-104,280,9);ctx.fillStyle='#ce97e9';ctx.fillRect(-140,-104,280*r.hp/r.maxHp,9);ctx.font='10px sans-serif';ctx.fillStyle='#ebdfef';ctx.fillText(r.hp+' / '+r.maxHp,0,-83);
 const bossX=edge*.39,bossY=88,bossSize=94,hitBoss=r.hit?.target==='boss'?Math.max(0,1-age/.7):0;
 const bossStrike=r.hit?.actor==='boss'?Math.max(0,1-age/(r.hit.special?1.2:.8)):0,targetIndex=r.hit?.actor==='boss'?r.members.indexOf(r.hit.target):-1,targetX=-edge+42+(targetIndex%2)*80,targetY=targetIndex<2?28:100,bossDrawX=bossX+hitBoss*8+(targetX+65-bossX)*bossStrike,bossDrawY=bossY-hitBoss*4+(targetY-bossY)*bossStrike;
 ctx.save();ctx.globalAlpha=r.done&&r.won?Math.max(0,1-(time-r.ended)/1900):1;
 if(g.monster)g.monster(r.monster,bossDrawX,bossDrawY,bossSize,t);else drawTile(ctx,'dungeon',122,bossDrawX-bossSize/2,bossDrawY-bossSize,bossSize/16);ctx.restore();
 const sizes=r.members.map(m=>spriteScaleFor(m.a,layout.scale)/layout.scale),unit=72/Math.max(2,...sizes);
 const positions=new Map();
 r.members.forEach((m,i)=>{
  const x=-edge+42+(i%2)*80,y=i<2?28:100,size=Math.max(18,sizes[i]*unit),received=r.hit?.target===m?Math.max(0,1-age/.8):0,attacking=r.hit?.actor===m?Math.max(0,1-age/.7):0;
  const px=x+(bossX-60-x)*attacking-received*8,pose={angle:!m.hp?-.9:received?-.18*received:0,alpha:m.left?.2:received?.7+.3*Math.abs(Math.sin(age*25)):1};positions.set(m,{x:px,y,size});
  ctx.save();g.applyBattlePose(ctx,px,y,pose);drawTile(ctx,'dungeon',m.a.idx,px-size/2,y-size,size/16);ctx.restore();g.loot(m.a,px,y,size,1,edge-15,pose);
  if(!m.left&&m.hp)g.equipment(m.a,px,y,size,{sword:attacking?1.9-attacking*.6:.52,trail:attacking},1,false,false,1,pose);
  ctx.fillStyle='#142726';ctx.fillRect(x-25,y+6,50,4);ctx.fillStyle=m.hp?'#abd797':'#a07585';ctx.fillRect(x-25,y+6,50*m.hp/m.maxHp,4);
  ctx.font='9px sans-serif';ctx.fillStyle='#dce8dd';ctx.fillText(m.left?'자리 비움':m.hp?m.hp+' / '+m.maxHp:'잠시 기절',x,y+20);
  if(received){g.impact?.(px,y-size*.5,age/.8,r.hit.damage,'#d4a5ff');ctx.fillStyle='#ffc4c3';ctx.font='bold 13px sans-serif';ctx.fillText('−'+r.hit.damage,px,y-size-12-age*12);}
 });
 if(r.phase==='playerWindup'&&r.finishing){const p=positions.get(r.actor);if(p)g.chargeAura?.(p.x,p.y,p.size,charge,t,g.elementFor(r.actor.a)??4);}
 if(r.phase==='bossWindup'&&r.special)g.chargeAura?.(bossX,bossY,bossSize,charge,t,4);
 if(hitBoss&&!r.done)g.impact?.(bossX,bossY-bossSize*.5,age/.7,r.hit.damage,'#ffe1a2');
 if(r.hit?.target==='boss'&&age<1){ctx.fillStyle=r.hit.critical?'#ffe39d':'#f0e8db';ctx.font='bold 16px sans-serif';ctx.fillText((r.hit.critical?'치명타! ':'')+'−'+r.hit.damage,bossX,bossY-bossSize-age*15);}
 if(r.done&&r.won&&age<g.finisherDuration)g.foregroundFinish(bossX,bossY-bossSize*.45,age/g.finisherDuration,1.8,g.elementFor(r.hit.actor.a)??4);
 ctx.textAlign='center';ctx.font='12px sans-serif';ctx.fillStyle='#ecdbb6';
 const message=r.done?(r.cancelled?'토벌을 잠시 멈췄어요':r.won?'함께 해냈어요! 참여한 친구에게 별가루를 나눠요':'잠깐 쉬고 다음에 다시 도전해요'):r.phase==='arrival'?'중앙의 균열이 열려요 · 힘을 모아요!':charge?r.phase==='bossWindup'?'위험! 달그림자 폭풍이 몰려와요…':'친구들의 힘을 모아 마지막 일격!':`${r.members.filter(m=>m.hp&&!m.left).length}명과 함께 · ${r.turn+1}번째 공방`;
 ctx.fillText(message,0,141);
 if(r.done&&r.won&&time-r.ended>1500){ctx.fillStyle='#ffe39d';ctx.font='bold 13px sans-serif';ctx.fillText('✦ 별가루 획득 · '+r.members.filter(m=>m.reward).map(m=>'+'+m.reward).join('  '),0,-60);}
 ctx.restore();
}
root.townEvents=Object.assign(events,{drawMap,drawBattle});
})(typeof window==='object'?window:globalThis);
