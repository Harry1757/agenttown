/* Village events keep their own clock and party state; wallets stay in townAdventure. */
(function (root) {
'use strict';
function raidFormation(count,width,height){
 const columns=Math.min(2,Math.max(1,count)),rows=Math.ceil(count/columns),top=-height/2+108,bottom=height/2-34;
 const cellHeight=(bottom-top)/Math.max(1,rows),size=Math.max(8,Math.min(72,cellHeight-20)),side=width/2-Math.max(38,size/2+20);
 return {columns,rows,size,positions:Array.from({length:count},(_,i)=>({x:i%2?side:-side,y:top+(Math.floor(i/columns)+1)*cellHeight-17})),meetingX:0,bossX:0,bossY:height/2-48};
}
function createTownEvents(host) {
 const now=()=>host.now(),random=()=>host.random(),game=()=>host.game();
 let raid=null,treasure=null,nextRaid=now()+180000,nextTreasure=now()+90000,last=now(),greetAt=0,raidPending=false;
 const greetings=[],eligible=()=>host.residents().filter(a=>host.eligible(a));
 const raidEligible=a=>host.raidEligible?host.raidEligible(a):host.eligible(a),raidCandidates=()=>host.residents().filter(raidEligible);
 const notify=(type,action,stars=0)=>host.event?.(type,action,stars);
 const freeze=a=>host.freeze?.(a),release=a=>host.release?.(a);
 function finish(won,time,cancelled=false){
  if(!raid||raid.done)return;
  const r=raid;r.done=true;r.won=won;r.cancelled=cancelled;r.ended=time;
  if(!cancelled){notify('raids',won?'won':'lost');host.result?.(r.monster,won);}
  if(won){
   const contributors=r.members.filter(m=>m.damage>0&&!m.left),total=contributors.reduce((s,m)=>s+m.damage,0),pool=96+r.members.length*12;
   for(const m of r.members.filter(m=>!m.left)){
    m.growthBonus=Math.max(0,6-m.grade)*6;
    m.reward=6+Math.floor(pool*m.damage/Math.max(1,total))+m.growthBonus;host.reward(m.a,true,m.reward);
   }
   host.cooperate?.(contributors.map(m=>m.a));
  }
 }
 function close(time){const old=raid;raid=null;raidPending=false;nextRaid=now()+180000+random()*180000;if(old)for(const m of old.members)if(!m.left)release(m.a);}
 function cancel(){raidPending=false;if(raid){finish(false,now(),true);close(now());}if(treasure)removeTreasure(false);greetings.length=0;nextTreasure=now()+90000;}
 function startRaid(actors=raidCandidates()){
  if(host.combatPaused?.()||raid||game().active||host.duels()||!host.enabled())return false;
  const unique=[...new Map(actors.filter(raidEligible).map(a=>[a.key,a])).values()];if(unique.length<2||unique.some(a=>host.raidReady&&!host.raidReady(a)))return false;
  const members=unique.map(a=>{const stats=host.stats(a);return {a,stats,grade:host.grade?.(stats)??10,hp:stats.hp,maxHp:stats.hp,damage:0,reward:0,left:false};});
  const hp=220+members.reduce((s,m)=>s+m.maxHp*.9,0),attack=28+members.length*2+members.reduce((s,m)=>s+m.stats.attack,0)/members.length*.22;
  const kind={id:'eclipseLord',effect:'dusk',name:'월식의 군주',idx:122,color:'#d699ff',size:3.2};
  const monster={boss:true,elite:true,kind,idx:122,name:'균열의 월식 군주',level:12,power:kind};
  raid={members,monster,hp:Math.round(hp),maxHp:Math.round(hp),attack:Math.round(attack),defense:12,crit:.12,start:now(),next:now()+3000,phase:'arrival',cursor:0,turn:0,done:false};
  raidPending=false;members.forEach(m=>freeze(m.a));notify('raids','seen');host.see?.(monster);return true;
 }
 function alive(r){return r.members.filter(m=>!m.left&&m.hp>0);}
 function preparePlayer(r,time){
  const ready=alive(r);if(!ready.length){finish(false,time);return;}
  for(let i=0;i<r.members.length;i++){const j=(r.cursor+i)%r.members.length,m=r.members[j];if(!m.left&&m.hp>0){r.actor=m;r.cursor=(j+1)%r.members.length;break;}}
  const skill=random()<.25,element=skill?Math.floor(random()*5):null;
  r.pending={...host.damage(r.actor.stats.attack*(skill?1.6:1),r.defense,r.actor.stats.crit),skill,element};r.finishing=r.pending.damage>=r.hp;r.phase=r.finishing||skill?'playerCharge':'playerApproach';r.phaseAt=time;r.next=time+(r.finishing?2600:skill?1300:260);
 }
 function prepareBossStrike(r,time,from=null){
  const ready=alive(r),plan=r.bossPlan;
  let choices=plan.kind==='scatter'?ready.filter(m=>!plan.seen.includes(m)):ready;
  if(!choices.length)choices=ready;
  r.target=plan.kind==='focus'&&ready.includes(plan.focus)?plan.focus:choices[Math.floor(random()*choices.length)];
  if(!plan.focus)plan.focus=r.target;plan.seen.push(r.target);
  r.bossTargets=plan.kind==='wave'?ready.slice():[r.target];r.bossFromTarget=from;
  r.special=random()<.1;r.phase='bossApproach';r.phaseAt=time;r.next=time+260;
 }
 function beginBossTurn(r,time){
  const roll=random(),kind=roll<.25?'wave':roll<.55?'focus':roll<.85?'scatter':'single';
  r.bossPlan={kind,total:kind==='wave'||kind==='single'?1:Math.min(3,Math.max(2,Math.ceil(alive(r).length/3))),index:0,seen:[]};
  prepareBossStrike(r,time);
 }
 function stepRaid(time){
  const r=raid;if(!r)return;
  for(const m of r.members)if(!m.left&&!host.present(m.a)){m.left=true;release(m.a);}
  if(!r.members.some(m=>!m.left)){finish(false,time,true);close(time);return;}
  if(r.done){if(time-r.ended>4200)close(time);return;}
  if(!alive(r).length){finish(false,time);return;}
  if(time<r.next)return;
  if(r.phase==='arrival'||r.phase==='bossReturn'){preparePlayer(r,time);return;}
  if(r.phase==='playerCharge'){
   if(r.actor.left||!r.actor.hp){preparePlayer(r,time);return;}
   r.phase='playerApproach';r.phaseAt=time;r.next=time+260;return;
  }
  if(r.phase==='playerApproach'){
   if(r.actor.left||!r.actor.hp){preparePlayer(r,time);return;}
   r.phase='playerWindup';r.phaseAt=time;r.next=time+120;return;
  }
  if(r.phase==='playerWindup'){
   if(r.actor.left||!r.actor.hp){preparePlayer(r,time);return;}
   const actual=Math.min(r.hp,r.pending.damage);r.hp-=actual;r.actor.damage+=actual;r.hit={at:time,...r.pending,target:'boss',actor:r.actor};host.hit?.(r.monster,actual);r.turn++;
   r.phase='playerImpact';r.phaseAt=time;r.next=time+(r.pending.skill?1400:350);if(!r.hp)finish(true,time);return;
  }
  if(r.phase==='playerImpact'){
   r.phase='playerReturn';r.phaseAt=time;r.next=time+260;return;
  }
  if(r.phase==='playerReturn'){
   beginBossTurn(r,time);return;
  }
  if(r.phase==='bossApproach'){
   if(r.target.left||!r.target.hp){prepareBossStrike(r,time,r.target);return;}
   r.phase='bossWindup';r.phaseAt=time;r.next=time+(r.special?1600:r.bossPlan.kind==='wave'?1200:r.bossPlan.index?320:500);return;
  }
  if(r.phase==='bossWindup'){
   if(r.target.left||!r.target.hp){prepareBossStrike(r,time,r.target);return;}
   const area=r.bossPlan.kind==='wave',power={wave:.65,focus:.72,scatter:.85,single:1}[r.bossPlan.kind],targets=area?alive(r):[r.target];
   const victims=targets.map(target=>{
    const hit=host.damage(r.attack*power*(r.special?2.6:1),target.stats.defense,r.crit);target.hp=Math.max(0,target.hp-hit.damage);
    if(!target.hp){target.defeatedAt=time;target.defeatEffectDuration=r.special||area?1250:800;host.defeat?.(target.a);}
    return {...hit,target};
   });
   r.hit={at:time,...victims[0],victims,actor:'boss',special:r.special,area};
   r.phase='bossImpact';r.phaseAt=time;r.next=time+(r.special||area?1450:800);if(!alive(r).length)finish(false,time);return;
  }
  if(r.phase==='bossImpact'){
   if(r.bossPlan.index+1<r.bossPlan.total){r.bossPlan.index++;prepareBossStrike(r,time,r.target);return;}
   r.phase='bossReturn';r.phaseAt=time;r.next=time+260;
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
  stepTreasure(time,dt);if(raid){stepRaid(host.combatTime?host.combatTime(raid.start,time):time);return;}
  if(!game().active&&!host.duels()){
   if(time>=nextRaid)raidPending=true;if(raidPending)startRaid();
   if(!raid&&time>=nextTreasure){nextTreasure=time+45000;spawnTreasure();}
   if(time>=greetAt){greetAt=time+12000;const people=eligible();outer:for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){const a=people[i],b=people[j];if(a.role===b.role&&Math.hypot(a.x-b.x,a.y-b.y)<2){const relation=host.relation?.(a,b);if(relation?.coops||relation?.duels>=3){greetings.push({a,b,at:time,friend:relation.coops>0});break outer;}}}}
  }
  for(let i=greetings.length-1;i>=0;i--)if(time-greetings[i].at>2200)greetings.splice(i,1);
 }
 return {step,cancel,startRaid,spawnTreasure,busy:a=>Boolean(raid?.members.some(m=>m.a===a&&!m.left)),get active(){return raid;},get treasure(){return treasure;},get greetings(){return greetings;},snapshot:()=>({raid,treasure,nextRaid,nextTreasure,raidPending})};
}
if(typeof module==='object'&&module.exports)module.exports={createTownEvents,raidFormation};
root.createTownEvents=createTownEvents;
root.raidFormation=raidFormation;
if(!root.townAdventure||typeof avatars==='undefined')return;
const g=root.townAdventure,clock=()=>performance.now(),journal=()=>g.chronicle;
const host={combatTime:g.combatTime,combatPaused:()=>root.townUI?.combatPaused?.(),now:clock,random:()=>Math.random(),game:()=>g,duels:()=>roomDuels.size,enabled:()=>g.enabled!==false&&!root.townUI?.motionReduced,
 residents:()=>Object.values(avatars),present:a=>avatars[a.key]===a&&!state.sessionInfo[a.key]?.needsInput,
 raidEligible:a=>avatars[a.key]===a&&a.role!=='done'&&!state.sessionInfo[a.key]?.needsInput,
 raidReady:a=>!a.travelFrom&&!a.portal&&!a.route?.length&&!a.duel,
 eligible:a=>avatars[a.key]===a&&a.role!=='done'&&workerState(a)!=='done'&&!state.sessionInfo[a.key]?.needsInput&&!a.travelFrom&&!a.portal&&!a.route?.length&&!a.duel&&!g.resting(a)&&displayedRooms.includes(ROOM_BY_ROLE[a.role]),
 room:role=>ROOM_BY_ROLE[role],roomValid:m=>{const r=ROOM_BY_ROLE[m.role];return displayedRooms.includes(r)&&r.gx===m.gx&&r.gy===m.gy;},
 stats:a=>g.statsFor(a),grade:stats=>g.gradeFor(stats),damage:(a,d,c)=>g.rollDamage(a,d,c),reward:(a,b,s)=>g.reward(a,b,s),defeat:a=>g.defeat?.(a),
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
 const r=events.active;if(!r)return;const time=g.combatTime(r.start,clock()),age=r.hit?(time-r.hit.at)/1000:99,t=(time-r.start)/1000;
 const width=cv.width/dpr-24,height=cv.height/dpr-24;if(width<=0||height<=0)return;
 const arenaHeight=Math.min(470,310+Math.max(0,Math.ceil(r.members.length/4)-2)*36),arenaWidth=Math.min(820,Math.max(450,width/height*arenaHeight)),scale=Math.min(1.65,width/arenaWidth,height/arenaHeight),edge=arenaWidth/2,formation=raidFormation(r.members.length,arenaWidth,arenaHeight);
 const skillDuration=g.skillDuration||1.4,playerCharge=r.phase==='playerCharge',chargedMove=['playerApproach','playerWindup'].includes(r.phase)&&(r.finishing||r.pending.skill),charge=chargedMove?1:playerCharge?Math.min(1,(time-r.phaseAt)/(r.next-r.phaseAt)):r.phase==='bossWindup'&&(r.special||r.bossPlan?.kind==='wave')?Math.min(1,(time-r.phaseAt)/(r.next-r.phaseAt)):0,element=r.pending?.element??(r.actor?g.elementFor(r.actor.a):4)??4;
 drawBattleBackdrop(`rgba(3,7,15,${.68+charge*.18})`);ctx.save();ctx.translate(cv.width/2,cv.height/2);ctx.scale(dpr*scale,dpr*scale);
 ctx.save();ctx.scale(1,arenaHeight/270);g.chamber?.(r.monster.kind,arenaWidth);ctx.restore();ctx.fillStyle='#13202b';ctx.fillRect(-edge+14,-arenaHeight/2+10,arenaWidth-28,64);g.atmosphere?.(playerCharge||chargedMove?element:4,charge,t,arenaWidth,formation.bossY+10,false);
 ctx.textAlign='center';ctx.fillStyle='#e8d5ff';ctx.font='bold 15px sans-serif';ctx.fillText('공동 토벌 · 균열의 월식 군주',0,-arenaHeight/2+30);
 ctx.fillStyle='#2e273d';ctx.fillRect(-140,-arenaHeight/2+42,280,9);ctx.fillStyle='#ce97e9';ctx.fillRect(-140,-arenaHeight/2+42,280*r.hp/r.maxHp,9);ctx.font='10px sans-serif';ctx.fillStyle='#ebdfef';ctx.fillText(r.hp+' / '+r.maxHp+' · '+r.members.length+'명 참가',0,-arenaHeight/2+66);
 const sizes=r.members.map(m=>spriteScaleFor(m.a,layout.scale)/layout.scale),unit=formation.size/Math.max(2,...sizes);
 const bossX=formation.bossX,bossY=formation.bossY,bossSize=94,hitBoss=r.hit?.target==='boss'?Math.max(0,1-age/.7):0;
 const progress=Math.max(0,Math.min(1,(time-r.phaseAt)/260)),smooth=q=>q*q*(3-2*q);
 const area=r.bossPlan?.kind==='wave',bossPhase=r.phase.startsWith('boss');
 const contact=m=>{if(!m||area)return {x:bossX,y:bossY};const i=r.members.indexOf(m),p=formation.positions[i],size=Math.max(8,(sizes[i]||1)*unit),side=p.x<0?-1:1;
  return {x:p.x-side*((bossSize+size)*.5+24),y:Math.min(arenaHeight/2-28,p.y+(bossSize-size)*.65)};};
 const targetPoint=contact(r.target),fromPoint=contact(r.bossFromTarget),home={x:bossX,y:bossY};
 let bossPoint=home;
 if(r.done&&!r.won){const q=smooth(Math.max(0,Math.min(1,(time-r.ended-(r.hit?.special||r.hit?.area?1450:800))/260)));bossPoint={x:targetPoint.x+(home.x-targetPoint.x)*q,y:targetPoint.y+(home.y-targetPoint.y)*q};}
 else if(r.phase==='bossApproach'){const q=smooth(progress);bossPoint={x:fromPoint.x+(targetPoint.x-fromPoint.x)*q,y:fromPoint.y+(targetPoint.y-fromPoint.y)*q};}
 else if(r.phase==='bossReturn'){const q=smooth(progress);bossPoint={x:targetPoint.x+(home.x-targetPoint.x)*q,y:targetPoint.y+(home.y-targetPoint.y)*q};}
 else if(['bossWindup','bossImpact'].includes(r.phase))bossPoint=targetPoint;
 const bossRecoil=hitBoss?Math.sin(Math.min(1,age/.12)*Math.PI/2)*Math.exp(-age*5):0,bossWalking=['bossApproach','bossReturn'].includes(r.phase)&&!r.done&&!area,bossBob=bossWalking?Math.sin(progress*Math.PI*4)*Math.sin(progress*Math.PI)*2.6:0;
 const hitSide=r.hit?.actor?.a?Math.sign(formation.positions[r.members.indexOf(r.hit.actor)].x): -1;
 const bossDrawX=bossPoint.x-bossRecoil*8*hitSide,bossDrawY=bossPoint.y-bossRecoil*4+bossBob,bossFace=bossPhase&&r.target?Math.sign(formation.positions[r.members.indexOf(r.target)].x):1;
 const bossFall=r.done&&r.won?Math.max(0,Math.min(1,((time-r.ended)/1000-g.finisherDuration)/.8)):0,bossEase=bossFall*bossFall*(3-2*bossFall);
 const bossSwing=-bossFace*g.monsterAttackAngle(r.phase==='bossWindup'?(time-r.phaseAt)/(r.next-r.phaseAt):-1,r.hit?.actor==='boss'?age:-1);
 ctx.save();g.applyBattlePose(ctx,bossDrawX,bossDrawY,{face:bossFace,angle:bossFall>0?.9*bossEase:bossSwing,squash:1-.45*bossEase,alpha:1-bossFall});
 if(g.monster)g.monster(r.monster,bossDrawX,bossDrawY,bossSize,bossWalking?t:0);else drawTile(ctx,'dungeon',122,bossDrawX-bossSize/2,bossDrawY-bossSize,bossSize/16);ctx.restore();
 const positions=new Map();
 r.members.forEach((m,i)=>{
  const victim=r.hit?.victims?.find(v=>v.target===m)||(r.hit?.target===m?r.hit:null),receivedDuration=r.hit?.special||r.hit?.area?1.25:.8,{x,y}=formation.positions[i],face=x<0?1:-1,size=Math.max(8,sizes[i]*unit),received=victim?Math.max(0,1-age/receivedDuration):0,attacking=r.hit?.actor===m&&r.phase==='playerImpact'?Math.max(0,1-age/.35):0;
  const fall=!m.hp?Math.max(0,Math.min(1,(time-(m.defeatedAt??-1e8)-(m.defeatEffectDuration??800))/500)):0,fallEase=fall*fall*(3-2*fall);
  const travel=r.actor!==m?0:r.done&&r.won?1-smooth(Math.max(0,Math.min(1,(time-r.ended-g.finisherDuration*1000)/260))):r.phase==='playerApproach'?smooth(progress):r.phase==='playerReturn'?1-smooth(progress):['playerWindup','playerImpact'].includes(r.phase)?1:0;
  const moving=!r.done&&r.actor===m&&['playerApproach','playerReturn'].includes(r.phase),bob=moving?Math.sin(progress*Math.PI*4)*Math.sin(progress*Math.PI)*2:0,recoil=received?Math.sin(Math.min(1,age/.12)*Math.PI/2)*Math.exp(-age*5):0;
  const contactGap=bossSize*.43+size*.4+20,px=x+(bossX-face*contactGap-x)*travel-face*recoil*8,py=y+(bossY-y)*travel+bob,pose={face,angle:fall>0?-.9*fallEase:received?-.18*recoil:attacking?face*g.swordLean(age):0,alpha:m.left?.2:!m.hp?1:received?.7+.3*Math.abs(Math.sin(age*25)):1};positions.set(m,{x:px,y:py,size});
  ctx.save();g.applyBattlePose(ctx,px,py,pose);drawTile(ctx,'dungeon',m.a.idx,px-size/2,py-size,size/16);ctx.restore();g.loot(m.a,px,py,size,face,edge-15,pose);
  const winding=r.actor===m&&r.phase==='playerWindup'&&!r.done?Math.max(0,Math.min(1,(time-r.phaseAt)/Math.max(1,r.next-r.phaseAt))):0,swing=g.swordSwing(attacking?age:-1,winding,.52);
  if(!m.left)g.equipment(m.a,px,py,size,{sword:swing,trail:attacking},face,false,false,1,pose);
  const barWidth=Math.min(50,formation.size+8);ctx.fillStyle='#142726';ctx.fillRect(px-barWidth/2,py+4,barWidth,3);ctx.fillStyle=m.hp?'#abd797':'#a07585';ctx.fillRect(px-barWidth/2,py+4,barWidth*m.hp/m.maxHp,3);
  ctx.font='8px sans-serif';ctx.fillStyle='#dce8dd';ctx.fillText(m.left?'비움':m.hp?r.members.length>9?Math.round(m.hp/m.maxHp*100)+'%':m.hp+' / '+m.maxHp:'기절',px,py+16);
  if(received){g.impact?.(px,py-size*.5,age/receivedDuration,victim.damage,'#d4a5ff');ctx.fillStyle='#ffc4c3';ctx.font='bold 13px sans-serif';ctx.fillText('−'+victim.damage,px,py-size-12-age*12);}
 });
 if(playerCharge||chargedMove){const p=positions.get(r.actor);if(p)g.chargeAura?.(p.x,p.y,p.size,charge,t,element);}
 if(r.phase==='bossWindup'&&(r.special||area))g.chargeAura?.(bossDrawX,bossDrawY,bossSize,charge,t,4);
 if(bossPhase&&r.phase==='bossWindup'){
  ctx.save();ctx.strokeStyle=area?'#efaddb':'#ffd58b';ctx.globalAlpha=.45+.25*Math.sin(t*10);ctx.lineWidth=2;
  for(const target of r.bossTargets||[]){if(target.left||!target.hp)continue;const p=positions.get(target);if(!p)continue;ctx.beginPath();ctx.ellipse(p.x,p.y+2,p.size*.65+5,6,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
 if(r.hit?.area&&age>=0&&age<1.25){
  const p=age/1.25;ctx.save();ctx.globalAlpha=(1-p)*.8;ctx.strokeStyle='#e2b3ff';ctx.lineWidth=4*(1-p)+1;
  for(let i=0;i<3;i++){const q=Math.max(0,p-i*.12);ctx.beginPath();ctx.ellipse(bossX,bossY-25,22+q*arenaWidth*.65,8+q*arenaHeight*.42,0,0,Math.PI*2);ctx.stroke();}
  for(const hit of r.hit.victims){const v=positions.get(hit.target);if(!v)continue;ctx.beginPath();ctx.moveTo(bossX,bossY-45);ctx.quadraticCurveTo((bossX+v.x)/2,bossY-95,v.x,v.y-v.size*.45);ctx.stroke();}
  ctx.restore();
 }
 if(hitBoss&&!r.done)g.impact?.(bossX,bossY-bossSize*.5,age/.7,r.hit.damage,'#ffe1a2');
 if(r.hit?.target==='boss'&&age<1){ctx.fillStyle=r.hit.critical?'#ffe39d':'#f0e8db';ctx.font='bold 16px sans-serif';ctx.fillText((r.hit.critical?'치명타! ':'')+'−'+r.hit.damage,bossX,bossY-bossSize-age*15);}
 if(r.done&&r.won&&age<g.finisherDuration)g.foregroundFinish(bossDrawX,bossDrawY,age/g.finisherDuration,1.8,r.hit.element??g.elementFor(r.hit.actor.a)??4,bossSize);
 else if(r.hit?.skill&&r.hit.target==='boss'&&age<skillDuration)g.foregroundFinish(bossDrawX,bossDrawY,age/skillDuration,.9,r.hit.element,bossSize);
 ctx.textAlign='center';ctx.font='12px sans-serif';ctx.fillStyle='#ecdbb6';
 const bossLabel={single:'강타',focus:'집중 연타',scatter:'그림자 추격',wave:'전원 공격 · 달그림자 파동'}[r.bossPlan?.kind]||'공격';
 const message=r.done?(r.cancelled?'토벌을 잠시 멈췄어요':r.won?'함께 해냈어요! 참여한 친구에게 별가루를 나눠요':'잠깐 쉬고 다음에 다시 도전해요'):r.phase==='arrival'?'중앙의 균열이 열려요 · 모두 함께 힘을 모아요!':bossPhase?`${bossLabel}${r.bossPlan.total>1?' · '+(r.bossPlan.index+1)+' / '+r.bossPlan.total:''}${r.phase==='bossWindup'?' · 준비!':''}`:chargedMove?'힘을 모았어요 · 보스에게 돌진!':charge?r.phase==='bossWindup'?'위험! 달그림자 폭풍이 몰려와요…':r.finishing?'친구들의 힘을 모아 마지막 일격!':['화염','번개','물','바람','안개'][element]+' 기술 · 힘을 모아요!':`${r.members.filter(m=>m.hp&&!m.left).length}명과 함께 · ${r.turn+1}번째 공방`;
 ctx.fillText(message,0,arenaHeight/2-14);
 if(r.done&&r.won&&time-r.ended>(g.finisherDuration+.55)*1000){ctx.fillStyle='#ffe39d';ctx.font='bold 13px sans-serif';const paid=r.members.filter(m=>m.reward),growth=paid.reduce((n,m)=>n+(m.growthBonus||0),0),total=paid.reduce((n,m)=>n+m.reward,0);ctx.fillText('✦ '+paid.length+'명 · 별가루 '+total+'개'+(growth?' (성장 +'+growth+' 포함)':''),0,-arenaHeight/2+92);}
 if(r.phase==='arrival'){
  const intro=Math.max(0,Math.min(1,(time-r.start)/450,(r.next-time)/450)),top=-arenaHeight/2+15;ctx.save();ctx.globalAlpha=intro;
  ctx.strokeStyle='#ca9fff';ctx.shadowColor='#b98af0';ctx.shadowBlur=12;for(let ring=0;ring<3;ring++){ctx.lineWidth=3-ring*.6;ctx.beginPath();ctx.ellipse(bossDrawX,bossY+3,48+ring*14+Math.sin(t*3+ring)*5,9+ring*6,0,0,7);ctx.stroke();}
  for(let i=0;i<18;i++){const a=i*Math.PI/9+t*.7,reach=52+((t*.45+i/18)%1)*38;ctx.globalAlpha=intro*.6;ctx.fillStyle='#e9d1ff';ctx.fillRect(bossDrawX+Math.cos(a)*reach,bossY-40+Math.sin(a)*reach*.65,2+i%2,2+i%2);}
  ctx.globalAlpha=intro;ctx.shadowBlur=0;ctx.fillStyle='#171226';ctx.fillRect(-Math.min(180,edge-20),top,Math.min(360,arenaWidth-40),74);ctx.strokeStyle='#bc8fdb';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-Math.min(180,edge-20),top);ctx.lineTo(Math.min(180,edge-20),top);ctx.moveTo(-Math.min(180,edge-20),top+74);ctx.lineTo(Math.min(180,edge-20),top+74);ctx.stroke();
  ctx.font='bold 29px sans-serif';ctx.fillStyle='#ecd6ff';ctx.fillText('BOSS',0,top+32);ctx.font='bold 13px sans-serif';ctx.fillText('균열의 월식 군주 · '+r.members.length+'명이 맞서요',0,top+56);ctx.restore();
 }
 ctx.restore();
}
root.townEvents=Object.assign(events,{drawMap,drawBattle});
})(typeof window==='object'?window:globalThis);
