/* Cosmetic dungeon adventures. No Codex session records are modified. */
(()=>{
'use strict';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const saved=read('codextown.adventure',{}),records={};
for(const [key,r] of Object.entries(saved&&typeof saved==='object'?saved:{}))if(r&&Number.isSafeInteger(r.kills)&&r.kills>=0)records[key]={kills:r.kills,bosses:Number.isSafeInteger(r.bosses)&&r.bosses>=0?r.bosses:0};
const monsters=[],rest=new Map();let battle=null,nextSpawn=performance.now()+12000,lastStep=0,enabled=read('codextown.adventureEnabled',true)!==false;
const hpFor=t=>80+Math.round(Math.min(120,Math.log10(1+Math.max(0,Number(t)||0)/1000)*24));
const record=a=>records[a.key]||{kills:0,bosses:0};
const eligible=a=>avatars[a.key]===a&&!a.travelFrom&&!a.portal&&!a.route?.length&&!a.duel&&workerState(a)!=='done'&&!state.sessionInfo[a.key]?.needsInput&&performance.now()>=(rest.get(a.key)||0)&&displayedRooms.includes(ROOM_BY_ROLE[a.role]);
const gear=a=>{const wins=window.townUI?.winCount(a)||0;return wins>=25?3:wins>=10?2:wins>=3?1:0;};
const star=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,d=i%2?r*.3:r;ctx.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}ctx.closePath();ctx.fill();};
function reward(a,boss){const r=record(a);records[a.key]={kills:r.kills+1,bosses:r.bosses+(boss?1:0)};save('codextown.adventure',records);renderLog();}
function cancel(){if(battle){battle.a.tx=battle.a.x;battle.a.ty=battle.a.y;rest.set(battle.a.key,performance.now()+20000);monsters.splice(monsters.indexOf(battle.m),1);}battle=null;nextSpawn=performance.now()+45000;}
function spawn(role,boss=false){const room=ROOM_BY_ROLE[role];if(!room||monsters.some(m=>m.role===role))return null;const type=['waiting','meeting','plan'].includes(role)?0:['research','design','explore'].includes(role)?1:2;
 const m={role,gx:room.gx,gy:room.gy,x:room.gx+3.5,y:room.gy+4.4,boss,type,at:performance.now(),idx:boss?(Math.random()<.5?110:122):[108,121,124][type],name:boss?'심연의 수호자':['이끼 유령','서고 유령','동굴 괴물'][type]};monsters.push(m);return m;}
function wander(m,now,dt){
 if(now<(m.pauseUntil||0))return;
 if(m.tx===undefined){m.tx=m.gx+1.35+Math.random()*4.3;m.ty=m.gy+2.75+Math.random()*2;}
 const dx=m.tx-m.x,dy=m.ty-m.y,d=Math.hypot(dx,dy),step=dt*(m.boss?.38:.58);
 if(d<=step+.02){m.x=m.tx;m.y=m.ty;m.tx=undefined;m.pauseUntil=now+700+Math.random()*2200;}
 else{m.x+=dx/d*step;m.y+=dy/d*step;if(Math.abs(dx)>.02)m.face=dx>0?1:-1;}
}
function begin(a,m){if(battle||!eligible(a)||!monsters.includes(m)||a.role!==m.role||roomDuels.size)return false;
 const size=spriteScaleFor(a,layout.scale)/layout.scale,monsterSize=m.boss?2.5:1.3;
 const maxHp=hpFor(tokensOf(a)),damage=18+Math.round(size*7),monsterHp=m.boss?damage*6:damage*2;
 battle={a,m,size,monsterSize,maxHp,hp:maxHp,monsterHp,maxMonsterHp:monsterHp,damage,start:performance.now(),next:performance.now()+1800,round:0,legendary:size<monsterSize&&Math.random()<.2,done:false};
 clearDuelAftermath(a);a.tx=a.x;a.ty=a.y;a.roomAction=null;return true;}
function step(now){const dt=Math.min(.1,Math.max(0,(now-lastStep)/1000));lastStep=now;
 if(!enabled||window.townUI?.motionReduced){if(battle)cancel();monsters.length=0;nextSpawn=now+12000;return;}
 for(let i=monsters.length-1;i>=0;i--){const m=monsters[i],r=ROOM_BY_ROLE[m.role];if(!displayedRooms.includes(r)||r.gx!==m.gx||r.gy!==m.gy||now-m.at>180000){if(battle?.m===m)cancel();else monsters.splice(i,1);}}
 for(const m of monsters)if(battle?.m!==m)wander(m,now,dt);
 if(battle){const b=battle;if(!eligible(b.a)||b.a.role!==b.m.role){cancel();return;}
  if(b.done){if(now-b.ended>(b.won?4600:2200)){rest.set(b.a.key,now+(b.won?45000:65000));monsters.splice(monsters.indexOf(b.m),1);battle=null;nextSpawn=now+45000;}return;}
  if(b.counterAt&&now>=b.counterAt){b.hp=Math.max(0,b.hp-(b.m.boss?22:12));b.playerHitAt=now;b.counterAt=0;if(!b.hp){b.done=true;b.won=false;b.ended=now;}return;}
  if(now>=b.next){b.round++;b.hitAt=now;b.hitPlayer=false;const final=b.legendary&&b.round===2;b.monsterHp=Math.max(0,b.monsterHp-(final?b.maxMonsterHp:b.damage));
   if(b.monsterHp===0){b.done=true;b.won=true;b.ended=now;const before=record(b.a);b.rewardLabel=b.m.boss&&!before.bosses?'보스 배지':before.kills===2?'별 장식':before.kills===9?'보라 별 장식':'별가루 +1';reward(b.a,b.m.boss);}
   else{b.counterAt=now+650;b.next=now+(b.legendary&&b.round===1?3400:b.monsterHp<=b.damage?2400:1600);}
  }
 }else{
  const residents=Object.values(avatars).filter(eligible);
  if(now>=nextSpawn&&monsters.length<3&&residents.length){const a=residents[Math.floor(Math.random()*residents.length)];spawn(a.role,Math.random()<.15);nextSpawn=now+45000+Math.random()*30000;}
  for(const m of monsters){if(now-m.at<1500)continue;const targets=residents.filter(a=>a.role===m.role);const a=targets.sort((a,b)=>Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y))[0];if(!a)continue;
   if(Math.hypot(a.x-m.x,a.y-m.y)<1.05&&begin(a,m))break;
  }
 }
}
function monster(m,x,y,size,t){ctx.save();const hop=window.townUI?.motionReduced?0:Math.sin(t*3)*size*.035;ctx.fillStyle='#07120d80';ctx.beginPath();ctx.ellipse(x,y+3,size*.4,5,0,0,7);ctx.fill();
 if(m.boss){ctx.shadowColor='#b77fd8';ctx.shadowBlur=size*.12;}drawTile(ctx,'dungeon',m.idx,x-size/2,y-size-hop,size/16);ctx.restore();}
function masonry(x,y,w,h,unit=18){ctx.fillStyle='#252c35';ctx.fillRect(x,y,w,h);ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();for(let row=0;row<Math.ceil(h/unit);row++)for(let col=-1;col<Math.ceil(w/(unit*1.7));col++){
 const xx=x+(col+(row%2)*.5)*unit*1.7,yy=y+row*unit;ctx.fillStyle=['#56606b','#636974','#4b5661'][(row+col+9)%3];ctx.fillRect(xx+1,yy+1,unit*1.7-2,unit-2);ctx.fillStyle='#7a818a';ctx.fillRect(xx+2,yy+2,unit*1.7-5,Math.max(1,unit*.12));ctx.fillStyle='#363f49';ctx.fillRect(xx+2,yy+unit-4,unit*1.7-4,2);
 }ctx.restore();}
function caveWalls(x,y,w,h,s){const p=16*s;masonry(x,y,w,p,s*8);masonry(x,y,p,h,s*8);masonry(x+w-p,y,p,h,s*8);masonry(x,y+h-p,w,p,s*8);}
function caveDoor(x,y,w,h,s,room){const p=16*s,cx=x+w/2,top=y+h-p*1.45,bottom=y+h;ctx.save();ctx.beginPath();ctx.moveTo(cx-p,bottom);ctx.lineTo(cx-p,top+p*.55);ctx.quadraticCurveTo(cx,top-p*.4,cx+p,top+p*.55);ctx.lineTo(cx+p,bottom);ctx.closePath();ctx.fillStyle='#080f15';ctx.fill();ctx.strokeStyle='#7a8085';ctx.lineWidth=3*s;ctx.stroke();ctx.clip();const leaf=p*(1-doorOpening(room));masonry(cx-p,top,leaf,p*1.5,4*s);masonry(cx+p-leaf,top,leaf,p*1.5,4*s);ctx.restore();}
function chamber(){
 ctx.fillStyle='#17202a';ctx.fillRect(-190,-135,380,270);
 // Recessed arches, broken columns and a rune floor sit behind combatants.
 for(const x of [-113,70]){ctx.fillStyle='#0c121d';ctx.beginPath();ctx.moveTo(x-24,78);ctx.lineTo(x-24,-32);ctx.quadraticCurveTo(x+11,-86,x+46,-32);ctx.lineTo(x+46,78);ctx.fill();masonry(x-33,-33,12,119,12);masonry(x+44,-33,12,119,12);}
 ctx.fillStyle='#333841';ctx.fillRect(-178,77,356,46);ctx.strokeStyle='#51565f';ctx.lineWidth=1;for(let y=79;y<123;y+=13){ctx.beginPath();ctx.moveTo(-178,y);ctx.lineTo(178,y);ctx.stroke();}
 ctx.strokeStyle='#88759f';ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(0,99,117,15,0,0,7);ctx.stroke();ctx.beginPath();ctx.ellipse(0,99,89,10,0,0,7);ctx.stroke();ctx.globalAlpha=1;
 masonry(-190,-135,380,14,12);masonry(-190,121,380,14,12);masonry(-190,-121,12,242,13);masonry(178,-121,12,242,13);
 for(const x of [-162,156]){ctx.fillStyle='#41302b';ctx.fillRect(x,-37,6,23);star(x+3,-41,9,'#db9b65');star(x+3,-41,4,'#fff0b9');}
 for(const [x,y] of [[-174,109],[155,112],[-151,115]]){ctx.fillStyle='#687064';ctx.fillRect(x,y,11,5);ctx.fillStyle='#92a080';ctx.fillRect(x,y,7,2);}
}
function drawMap(){const P=TILE*layout.scale,t=performance.now()/1000;for(const m of monsters){const x=layout.offsetX+(m.x+.5)*P,y=layout.offsetY+(m.y+1)*P;ctx.save();ctx.strokeStyle=m.boss?'#da9fe3':'#a4dad2';ctx.lineWidth=layout.scale;ctx.beginPath();ctx.ellipse(x,y,P*.65,P*.18,0,0,7);ctx.stroke();monster(m,x,y,P*(m.boss?1.5:.85),t);ctx.restore();}}
function bar(x,y,value,max,color){ctx.fillStyle='#142726';ctx.fillRect(x,y,130,8);ctx.fillStyle=color;ctx.fillRect(x,y,130*Math.max(0,value/max),8);ctx.fillStyle='#e7edda';ctx.font='11px sans-serif';ctx.fillText(`${value} / ${max}`,x+65,y+22);}
function crescent(x,y,p){if(p<0||p>1)return;ctx.save();ctx.globalAlpha=1-p;ctx.translate(x,y-30);ctx.rotate(-.65);ctx.shadowColor='#d997ff';ctx.shadowBlur=14;ctx.fillStyle='#c48bee';ctx.beginPath();ctx.moveTo(-65,-20);ctx.quadraticCurveTo(0,55,65,-20);ctx.quadraticCurveTo(0,100,-65,-20);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff0c2';ctx.beginPath();ctx.moveTo(-65,-20);ctx.quadraticCurveTo(0,68,65,-20);ctx.quadraticCurveTo(0,86,-65,-20);ctx.fill();ctx.restore();}
const elements=['화염','번개','물','바람','안개'];
function finisher(x,y,p,key){if(p<0||p>1)return;const kind=hashSeed(key)%5,colors=['#ffac45','#ffe786','#5abde9','#a9e3b1','#dedee9'];ctx.save();ctx.translate(x,y);ctx.globalAlpha=1-p;ctx.shadowColor=colors[kind];ctx.shadowBlur=8;
 for(let i=0;i<8;i++){const a=i*Math.PI/4,r=12+p*33,xx=Math.cos(a)*r,yy=Math.sin(a)*r;ctx.strokeStyle=colors[kind];ctx.fillStyle=colors[kind];ctx.lineWidth=2;
 if(kind===0){ctx.fillStyle=i%2?'#ffd57c':'#ed694c';ctx.beginPath();ctx.moveTo(xx,yy-13*(1-p));ctx.quadraticCurveTo(xx-12,yy+9,xx,yy+11);ctx.quadraticCurveTo(xx+10,yy+4,xx,yy-13*(1-p));ctx.fill();}
 else if(kind===1){ctx.beginPath();ctx.moveTo(xx*.5,yy*.5);ctx.lineTo(xx*.75+5,yy*.75-5);ctx.lineTo(xx-4,yy+3);ctx.lineTo(xx*1.4,yy*1.4);ctx.stroke();}
 else if(kind===2){ctx.lineWidth=4;ctx.beginPath();ctx.arc(xx*.5,yy*.5,r*.65,a+p*2,a+p*2+1.7);ctx.stroke();ctx.strokeStyle='#eafcff';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.ellipse(xx,yy,2,4,a,0,7);ctx.fill();}
 else if(kind===3){ctx.beginPath();ctx.ellipse(0,0,r,r*.4,a+p*3,0,1.7);ctx.stroke();}
 else{ctx.globalAlpha=(1-p)*.16;ctx.beginPath();ctx.ellipse(xx*.7,yy*.55,19,9,a,0,7);ctx.fill();ctx.globalAlpha=1-p;ctx.beginPath();ctx.moveTo(xx-9,yy+8);ctx.lineTo(xx+12,yy-12);ctx.stroke();}}
 star(0,0,22*(1-p),colors[kind]);ctx.restore();}
function drawBattle(){if(!battle)return;const b=battle,now=performance.now(),t=(now-b.start)/1000,age=(now-(b.hitAt||-1e8))/1000,charge=!b.done&&(b.legendary&&b.round===1||b.monsterHp<=b.damage&&b.next-now<1000);
 const scale=Math.min(1,(cv.width/dpr-20)/380,(cv.height/dpr-20)/270);if(scale<=0)return;
 ctx.save();ctx.fillStyle='rgba(4,8,16,.55)';ctx.fillRect(0,0,cv.width,cv.height);ctx.translate(cv.width/2,cv.height/2);ctx.scale(dpr*scale,dpr*scale);
 chamber();ctx.textAlign='center';ctx.font='600 14px sans-serif';ctx.fillStyle='#e7edda';ctx.fillText(b.m.boss?'심연의 수호자 · 보스전':b.m.name+' 등장!',0,-111);
 ctx.font='11px sans-serif';ctx.fillText('주민 · 토큰 체력',-95,-95);ctx.fillText(b.m.name,95,-95);
 bar(-160,-89,b.hp,b.maxHp,'#a8d89b');bar(30,-89,b.monsterHp,b.maxMonsterHp,'#dba0ca');

 const unit=96/Math.max(b.size,b.monsterSize),as=b.size*unit,ms=b.monsterSize*unit,hit=Math.max(0,1-age/.5),counter=Math.max(0,1-(now-(b.playerHitAt||-1e8))/450),mx=85+hit*7-counter*32;
 const windup=!b.done&&!charge&&b.next-now<300?Math.max(0,1-(b.next-now)/300):0,px=-83+Math.max(windup,hit)*100-counter*7;
 ctx.save();ctx.translate(px,87);ctx.rotate(charge?Math.sin(t*16)*.05:0);drawTile(ctx,'dungeon',b.a.idx,-as/2,-as,as/16);ctx.restore();
 equipment(b.a,px,87,as,{sword:charge?-.1:hit*.95-.3},1,b.legendary&&(charge||b.done&&b.won),b.size<b.monsterSize);
 const finishAge=b.done&&b.won?(now-b.ended)/1000:-1;
 ctx.save();if(finishAge>=0){ctx.globalAlpha=Math.max(0,1-Math.max(0,finishAge-.2)/1.05);ctx.translate(mx,87);ctx.scale(1+Math.min(.18,finishAge*.15),Math.max(.3,1-finishAge*.45));ctx.translate(-mx,-87);}monster(b.m,mx,87-hit*9,ms,t);ctx.restore();
 if(finishAge>=0&&finishAge<1.5){ctx.save();ctx.globalAlpha=1-finishAge/1.5;for(let i=0;i<18;i++){const a=i*2.4,r=finishAge*43;star(mx+Math.cos(a)*r,87-ms*.5+Math.sin(a)*r-finishAge*12,i%3?2:4,'#e6c8ff');}ctx.restore();}
 if(charge){ctx.save();ctx.globalAlpha=.65;for(let i=0;i<8;i++){const a=i*Math.PI/4+t*3,r=18+((b.next-now)/1000%1)*28;star(px+Math.cos(a)*r,87-as*.5+Math.sin(a)*r,2,'#ffe4ad');}ctx.restore();}
 if(finishAge>=1.15){const q=Math.min(1,(finishAge-1.15)/2.5),fly=Math.max(0,(q-.5)*2),ix=85+(-83-85)*fly,iy=35-Math.sin(q*Math.PI)*53+fly*30;
  ctx.save();ctx.globalAlpha=q>.9?(1-q)*10:1;ctx.shadowColor='#ffe4a5';ctx.shadowBlur=14;star(ix,iy,b.rewardLabel==='별가루 +1'?10:16,b.m.boss?'#efb4ed':'#ffe0a0');ctx.shadowBlur=0;star(ix,iy,5,'#fff8df');ctx.textAlign='center';ctx.font='600 14px sans-serif';ctx.fillStyle='#ffe5ab';ctx.fillText(b.rewardLabel+' 획득!',0,0);ctx.restore();}

 if(b.done&&b.won){star(px,87-as-12,7,'#ffe19b');}
 if(counter>0)star(-83,87-as*.5,15*counter,'#ffce94');
 if(age>=0&&age<.7){if(b.legendary&&b.done&&b.won)crescent(mx,87-ms*.5,age/.7);else if(b.done&&b.won)finisher(mx,87-ms*.45,age/.7,b.a.key);else star(mx,87-ms*.45,18*hit,'#ffe0a1');}
 ctx.fillStyle='#e8dfba';ctx.font='12px sans-serif';ctx.fillText(b.done?(b.won?elements[hashSeed(b.a.key)%5]+' 일격! 별가루 +1'+(b.m.boss?' · 보스 배지 획득':''):'잠깐 쉬면 체력이 회복돼요'):charge?(b.legendary?'전설검 · 별빛을 모으는 중…':'마지막 일격 · 힘을 모으는 중…'):`${b.round+1}번째 공방`,0,116);
 ctx.restore();}
function equipment(a,x,y,size,pose,face,legendary=false,shield=false){ctx.save();ctx.translate(x,y);ctx.scale(face,1);sword(size*.27,-size*.48,legendary?size*2.5:size*.62,pose.sword??-.3,legendary?3:gear(a),performance.now()/1000);
 if(shield){ctx.fillStyle='#efcc83';ctx.beginPath();ctx.arc(-size*.28,-size*.3,size*.24,0,7);ctx.fill();ctx.fillStyle='#84aabd';ctx.beginPath();ctx.arc(-size*.28,-size*.3,Math.max(1,size*.24-2),0,7);ctx.fill();star(-size*.28,-size*.3,size*.1,'#ffeac2');}ctx.restore();}
function roomInterior(room,ix,iy,scale){const P=TILE*scale,w=6*P,h=5*P,inn=['waiting','done'].includes(room.role);ctx.save();ctx.fillStyle=inn?'#766043':'#454d50';ctx.fillRect(ix,iy,w,h);ctx.strokeStyle=inn?'#8d7651':'#63706b';ctx.lineWidth=Math.max(1,scale*.5);
 for(let row=0;row<10;row++){const yy=iy+row*P*.5;ctx.beginPath();ctx.moveTo(ix,yy);ctx.lineTo(ix+w,yy);ctx.stroke();if(!inn)for(let col=0;col<7;col++){const xx=ix+(col+(row%2)*.5)*P;if(xx>ix+w)continue;ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx,yy+P*.5);ctx.stroke();}}
 ctx.globalAlpha=.18;ctx.fillStyle=room.accent;ctx.fillRect(ix,iy,w,h);ctx.globalAlpha=1;
 const theme={plan:0,research:0,design:2,meeting:5,explore:1,frontend:2,backend:3,infra:3,qa:4,release:1,waiting:5,done:4}[room.role]??0;
 const tile=(idx,x,y,k=1)=>drawTile(ctx,'dungeon',idx,ix+x*P,iy+y*P,scale*k);
 const rect=(x,y,ww,hh,color)=>{ctx.fillStyle=color;ctx.fillRect(ix+x*P,iy+y*P,ww*P,hh*P);};
 if(theme===0){
  for(const [x,y] of [[.3,.1],[3.8,.3]]){rect(x,y,1.6,1.15,'#583f35');for(let j=0;j<7;j++){rect(x+.1+j*.2,y+.1,.13,.37,['#b38476','#b6a269','#8497aa'][j%3]);rect(x+.1+j*.2,y+.67,.13,.32,['#8c9b75','#ac889f'][j%2]);}}
  rect(1.1,2.5,2.5,1.7,'#64617b');rect(1.22,2.62,2.26,1.46,'#535365');tile(66,2.7,.15);
 }else if(theme===1){tile(64,.5,.25,1.2);tile(65,3.8,.45,1.2);tile(65,2.25,.08);ctx.strokeStyle='#292e37';ctx.lineWidth=scale;ctx.beginPath();ctx.moveTo(ix+P,iy+3*P);ctx.lineTo(ix+2.6*P,iy+3.4*P);ctx.lineTo(ix+2*P,iy+4.4*P);ctx.stroke();
 }else if(theme===2){for(const [x,y,hue] of [[.65,.5,'#ac8ce3'],[4.6,.6,'#82cdd6'],[3.1,.1,'#cfacd9']]){ctx.fillStyle=hue;ctx.beginPath();ctx.moveTo(ix+x*P,iy+y*P);ctx.lineTo(ix+(x+.3)*P,iy+(y-.4)*P);ctx.lineTo(ix+(x+.55)*P,iy+(y+.4)*P);ctx.lineTo(ix+(x+.15)*P,iy+(y+.7)*P);ctx.fill();}ctx.strokeStyle='#9c91c5';ctx.globalAlpha=.45;ctx.beginPath();ctx.ellipse(ix+3.3*P,iy+3.5*P,P*1.3,P*.5,-.2,0,7);ctx.stroke();ctx.globalAlpha=1;
 }else if(theme===3){rect(.3,.1,1.3,1,'#302c30');rect(.5,.3,.9,.6,'#c97049');tile(68,3.2,.3);tile(69,4.5,.6);ctx.strokeStyle='#a56440';ctx.lineWidth=2*scale;ctx.beginPath();ctx.moveTo(ix+.1*P,iy+2.2*P);ctx.lineTo(ix+.5*P,iy+3*P);ctx.lineTo(ix+.15*P,iy+4.7*P);ctx.stroke();
 }else if(theme===4){for(let i=0;i<9;i++){const x=(i*1.7)%5.5,y=(i*.83)%4.5;rect(x,y,.45,.18,'#586c54');}tile(89,4.1,.25);ctx.fillStyle='#395e65';ctx.beginPath();ctx.ellipse(ix+1.7*P,iy+.75*P,P*.9,P*.4,-.15,0,7);ctx.fill();
 }else{rect(.3,.25,1.6,.95,'#49392f');rect(.4,.35,1.4,.7,'#b08e66');tile(66,3.9,.1);rect(1.8,2.6,2.7,1.7,'#7d5263');rect(1.95,2.75,2.4,1.4,'#694751');tile(89,4.9,.65);}
 for(const x of theme%2?[.15,5.6]:[1.9,5.7]){rect(x,.25,.12,.55,'#332a27');star(ix+(x+.06)*P,iy+.25*P,P*.16,theme===2?'#bce6ff':'#ffc47d');}
 ctx.restore();}
function loot(a,x,y,size){const r=record(a);if(r.kills<3&&!r.bosses)return;ctx.save();star(x+size*.45,y-size*.6,size*.1,r.bosses?'#efacd8':r.kills>=10?'#c5b4ff':'#ffe09b');ctx.restore();}
const panel=document.createElement('details');panel.id='adventure-log';panel.innerHTML='<summary>⚔ 모험</summary><div class="adventure-body"><button type="button"></button><p></p></div>';
const style=document.createElement('style');style.textContent='#adventure-log{position:absolute;left:9px;top:9px;z-index:4;color:#e4edd8;font:12px sans-serif;max-width:230px}#adventure-log summary{cursor:pointer;background:#203b32;border:1px solid #647e63;border-radius:8px;padding:7px 10px;list-style:none}#adventure-log .adventure-body{background:#203b32;padding:12px;border-radius:8px;line-height:1.7}#adventure-log button{font:inherit;background:#354f3a;color:#e4edd8;border:1px solid #89a17a;border-radius:6px;padding:6px 10px}#adventure-log p{margin:8px 0 0;white-space:pre-line}';document.head.append(style);document.getElementById('map-stage').append(panel);
function renderLog(){const all=Object.values(records),kills=all.reduce((s,r)=>s+r.kills,0),bosses=all.reduce((s,r)=>s+r.bosses,0);panel.querySelector('button').textContent=enabled?'모험 켜짐 · 끄기':'모험 꺼짐 · 켜기';panel.querySelector('p').textContent=`몬스터 ${kills}마리 · 보스 ${bosses}마리\n별가루 ${kills}개\n주민별 3마리: 별 장식\n10마리: 보라 별 장식\n보스 처치: 분홍 보스 배지`;}
panel.querySelector('button').onclick=()=>{enabled=!enabled;save('codextown.adventureEnabled',enabled);if(!enabled){cancel();monsters.length=0;}else nextSpawn=performance.now()+4000;renderLog();};renderLog();
window.townAdventure={wander,finisher,caveWalls,caveDoor,step,drawMap,drawBattle,roomInterior,equipment,loot,hpFor,spawn,begin,cancel,record,reward,get active(){return battle;},get monsters(){return monsters;},busy:a=>battle?.a===a,resting:a=>performance.now()<(rest.get(a.key)||0),duelTime:d=>{const t=(performance.now()-d.start)/1000;return d.legendary&&t>=2.5?t<4.5?2.5:t-2:t;},crescent};
function sword(x,y,length,angle,rank,t){
ctx.save();ctx.translate(x,y);ctx.rotate(angle);
const L=length;
ctx.fillStyle=rank?'#543967':'#80664c';ctx.fillRect(-3,0,6,15);
ctx.fillStyle='#f1c875';for(let j=2;j<14;j+=4)ctx.fillRect(-3,j,6,1);
if(rank===0){
 ctx.fillStyle='#a8d9cd';ctx.fillRect(-3,-L+5,6,L-9);ctx.fillRect(-1,-L,2,5);
 ctx.fillStyle='#e4f9e7';ctx.fillRect(-1,-L+5,2,L-10);ctx.fillStyle='#bba784';ctx.fillRect(-8,-4,16,4);
}else if(rank===1){
 ctx.fillStyle='#718baa';ctx.beginPath();ctx.moveTo(-7,-6);ctx.lineTo(-7,-L+12);ctx.lineTo(0,-L);ctx.lineTo(7,-L+12);ctx.lineTo(7,-6);ctx.closePath();ctx.fill();
 ctx.fillStyle='#f1f8ff';ctx.beginPath();ctx.moveTo(0,-L);ctx.lineTo(5,-L+12);ctx.lineTo(5,-6);ctx.lineTo(0,-6);ctx.fill();
 ctx.fillStyle='#efc574';ctx.fillRect(-14,-5,28,5);ctx.fillRect(-14,-10,5,6);ctx.fillRect(9,-10,5,6);
}else if(rank===2){
 ctx.shadowColor='#5de9ff';ctx.shadowBlur=9;ctx.fillStyle='#36b8d6';
 ctx.beginPath();ctx.moveTo(0,-L);ctx.lineTo(12,-L*.65);ctx.lineTo(9,-12);ctx.lineTo(0,-5);ctx.lineTo(-9,-12);ctx.lineTo(-12,-L*.65);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
 ctx.fillStyle='#b6ffff';ctx.beginPath();ctx.moveTo(0,-L);ctx.lineTo(0,-8);ctx.lineTo(-9,-15);ctx.lineTo(-7,-L*.65);ctx.closePath();ctx.fill();
 ctx.fillStyle='#efffff';ctx.beginPath();ctx.moveTo(0,-L);ctx.lineTo(4,-L*.64);ctx.lineTo(0,-10);ctx.closePath();ctx.fill();
 for(const dir of [-1,1]){star(dir*15,-7,7,'#6de4ef');star(dir*15,-7,3,'#efffff');}
 ctx.fillStyle='#dbb877';ctx.fillRect(-13,-5,26,5);star(0,-4,8,'#a585fa');star(0,-4,3,'#f8c9ff');
}else{
 ctx.shadowColor='#d98cff';ctx.shadowBlur=16;ctx.fillStyle='#aa67e3';
 ctx.beginPath();ctx.moveTo(0,-L-3);ctx.lineTo(13,-L*.72);ctx.lineTo(10,-L*.4);ctx.lineTo(15,-L*.28);ctx.lineTo(8,-6);ctx.lineTo(-8,-6);ctx.lineTo(-15,-L*.28);ctx.lineTo(-10,-L*.4);ctx.lineTo(-13,-L*.72);ctx.closePath();ctx.fill();
 ctx.shadowBlur=0;ctx.fillStyle='#ffe9fa';ctx.beginPath();ctx.moveTo(0,-L-3);ctx.lineTo(6,-L*.7);ctx.lineTo(3,-8);ctx.lineTo(-3,-8);ctx.lineTo(-6,-L*.7);ctx.closePath();ctx.fill();
 ctx.fillStyle='#ffd77d';for(const dir of [-1,1]){ctx.beginPath();ctx.moveTo(dir*5,-5);ctx.lineTo(dir*23,-17);ctx.lineTo(dir*19,-5);ctx.lineTo(dir*10,2);ctx.closePath();ctx.fill();}
 star(0,-5,13,'#ffdf88');star(0,-5,7,'#ed8fd1');star(0,-5,3,'#fff7e1');
 for(let i=0;i<5;i++){const phase=(t*.55+i/5)%1;star(Math.sin(i*2+t*2)*(15+4*Math.sin(t)), -9-phase*(L-7),i%2?3:4,i%2?'#fce5aa':'#ffc9f6');}
 ctx.strokeStyle='#ffe3a1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-11,8);ctx.quadraticCurveTo(-25,13,-16+Math.sin(t*5)*4,24);ctx.stroke();
}
ctx.fillStyle=rank===3?'#ffc7ed':'#c5ae85';ctx.fillRect(-4,13,8,4);ctx.restore();}

})();
