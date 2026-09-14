/* Cosmetic dungeon adventures. No Codex session records are modified. */
(()=>{
'use strict';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const saved=read('codextown.adventure',{}),records={};
for(const [key,r] of Object.entries(saved&&typeof saved==='object'?saved:{}))if(r&&Number.isSafeInteger(r.kills)&&r.kills>=0)records[key]={kills:r.kills,bosses:Number.isSafeInteger(r.bosses)&&r.bosses>=0?r.bosses:0};
const shopSaved=read('codextown.shop',{}),owned=new Set(Array.isArray(shopSaved.owned)?shopSaved.owned:[]);let spent=Number.isSafeInteger(shopSaved.spent)&&shopSaved.spent>=0?shopSaved.spent:0,equipped=shopSaved.equipped||'';
const catalog=[{id:'halo',name:'별빛 왕관',price:5},{id:'wings',name:'요정 날개',price:12},{id:'orbit',name:'달빛 위성',price:20}];
const balance=()=>Math.max(0,Object.values(records).reduce((s,r)=>s+r.kills+r.bosses*7,0)-spent);
function buy(id){const item=catalog.find(i=>i.id===id);if(!item)return false;if(!owned.has(id)){if(balance()<item.price)return false;spent+=item.price;owned.add(id);}equipped=equipped===id?'':id;save('codextown.shop',{owned:[...owned],spent,equipped});renderLog();return true;}
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
 for(let i=monsters.length-1;i>=0;i--){const m=monsters[i],r=ROOM_BY_ROLE[m.role];if(!displayedRooms.includes(r)||r.gx!==m.gx||r.gy!==m.gy||(now-m.at>180000&&battle?.m!==m)){if(battle?.m===m)cancel();else monsters.splice(i,1);}}
 for(const m of monsters)if(battle?.m!==m)wander(m,now,dt);
 if(battle){const b=battle;if(avatars[b.a.key]!==b.a||state.sessionInfo[b.a.key]?.needsInput||b.a.role!==b.m.role){cancel();return;}
  if(b.done){if(now-b.ended>(b.won?4600:2200)){rest.set(b.a.key,now+(b.won?45000:65000));monsters.splice(monsters.indexOf(b.m),1);battle=null;nextSpawn=now+5000;const next=b.a.nextRole;b.a.nextRole=null;if(next&&next!==b.a.role)changeRoom(b.a,next);}return;}
  if(b.counterAt&&now>=b.counterAt){b.hp=Math.max(0,b.hp-(b.m.boss?22:12));b.playerHitAt=now;b.receivedDamage=b.m.boss?22:12;b.counterAt=0;if(!b.hp){b.done=true;b.won=false;b.ended=now;}return;}
  if(now>=b.next){b.round++;b.hitAt=now;b.hitPlayer=false;const final=b.legendary&&b.round===2;b.inflictedDamage=final?b.maxMonsterHp:b.damage;b.monsterHp=Math.max(0,b.monsterHp-(final?b.maxMonsterHp:b.damage));
   if(b.monsterHp===0){b.done=true;b.won=true;b.ended=now;const before=record(b.a);b.rewardLabel=b.m.boss&&!before.bosses?'보스 배지':before.kills===2?'별 장식':before.kills===9?'보라 별 장식':`별가루 +${b.m.boss?8:1}`;reward(b.a,b.m.boss);}
   else{b.counterAt=now+650;b.next=now+(b.legendary&&b.round===1?3400:b.monsterHp<=b.damage?2400:1600);}
  }
 }else{
  const residents=Object.values(avatars).filter(eligible);
  const available=displayedRooms.filter(r=>r.role!=='done'&&!monsters.some(m=>m.role===r.role));
  if(now>=nextSpawn&&monsters.length<4&&available.length){const room=available[Math.floor(Math.random()*available.length)];spawn(room.role,!monsters.some(m=>m.boss)&&Math.random()<.15);nextSpawn=now+(monsters.length<3?1200:12000+Math.random()*8000);}
  for(const m of monsters){if(now-m.at<1500)continue;const targets=residents.filter(a=>a.role===m.role);const a=targets.sort((a,b)=>Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y))[0];if(!a)continue;
   const near=Math.hypot(a.x-m.x,a.y-m.y)<1.35;
   if(near){if(m.encounterKey!==a.key){m.encounterKey=a.key;m.encounterAt=now;}m.pauseUntil=now+150;a.tx=a.x;a.ty=a.y;if(now-m.encounterAt>=450&&begin(a,m))break;}else{m.encounterKey=null;m.encounterAt=0;}
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
function drawMap(){const P=TILE*layout.scale,t=performance.now()/1000;for(const m of monsters){const x=layout.offsetX+(m.x+.5)*P,y=layout.offsetY+(m.y+1)*P;ctx.save();ctx.strokeStyle=m.boss?'#da9fe3':'#a4dad2';ctx.lineWidth=layout.scale;ctx.beginPath();ctx.ellipse(x,y,P*.65,P*.18,0,0,7);ctx.stroke();monster(m,x,y,P*(m.boss?1.5:.85),t);if(m.encounterKey&&!battle){ctx.font='bold 18px sans-serif';ctx.fillStyle='#ffe3a2';ctx.fillText('!',x,y-P*1.8);}ctx.restore();}}
function bar(x,y,value,max,color){ctx.fillStyle='#142726';ctx.fillRect(x,y,130,8);ctx.fillStyle=color;ctx.fillRect(x,y,130*Math.max(0,value/max),8);ctx.fillStyle='#e7edda';ctx.font='11px sans-serif';ctx.fillText(`${value} / ${max}`,x+65,y+22);}
function crescent(x,y,p){if(p<0||p>1)return;ctx.save();ctx.globalAlpha=1-p;ctx.translate(x,y-30);ctx.rotate(-.65);ctx.shadowColor='#d997ff';ctx.shadowBlur=14;ctx.fillStyle='#c48bee';ctx.beginPath();ctx.moveTo(-65,-20);ctx.quadraticCurveTo(0,55,65,-20);ctx.quadraticCurveTo(0,100,-65,-20);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff0c2';ctx.beginPath();ctx.moveTo(-65,-20);ctx.quadraticCurveTo(0,68,65,-20);ctx.quadraticCurveTo(0,86,-65,-20);ctx.fill();ctx.restore();}
const elements=['화염','번개','물','바람','안개'];
function finisher(x,y,p,key){if(p<0||p>1)return;const kind=hashSeed(key)%5,colors=['#ffac45','#ffe786','#5abde9','#a9e3b1','#dedee9'];ctx.save();ctx.translate(x,y);ctx.globalAlpha=1-p;ctx.shadowColor=colors[kind];ctx.shadowBlur=8;ctx.save();ctx.rotate(-.65+p*.18);ctx.fillStyle=colors[kind];ctx.beginPath();ctx.moveTo(-65,-28);ctx.quadraticCurveTo(2,48,68,-25);ctx.quadraticCurveTo(5,100,-65,-28);ctx.fill();ctx.fillStyle='#fff4d7';ctx.beginPath();ctx.moveTo(-65,-28);ctx.quadraticCurveTo(5,62,68,-25);ctx.quadraticCurveTo(5,76,-65,-28);ctx.fill();ctx.restore();
 for(let i=0;i<8;i++){const a=i*Math.PI/4,r=12+p*33,xx=Math.cos(a)*r,yy=Math.sin(a)*r;ctx.strokeStyle=colors[kind];ctx.fillStyle=colors[kind];ctx.lineWidth=2;
 if(kind===0){ctx.fillStyle=i%2?'#ffd57c':'#ed694c';ctx.beginPath();ctx.moveTo(xx,yy-13*(1-p));ctx.quadraticCurveTo(xx-12,yy+9,xx,yy+11);ctx.quadraticCurveTo(xx+10,yy+4,xx,yy-13*(1-p));ctx.fill();}
 else if(kind===1){ctx.beginPath();ctx.moveTo(xx*.5,yy*.5);ctx.lineTo(xx*.75+5,yy*.75-5);ctx.lineTo(xx-4,yy+3);ctx.lineTo(xx*1.4,yy*1.4);ctx.stroke();}
 else if(kind===2){ctx.lineWidth=4;ctx.beginPath();ctx.arc(xx*.5,yy*.5,r*.65,a+p*2,a+p*2+1.7);ctx.stroke();ctx.strokeStyle='#eafcff';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.ellipse(xx,yy,2,4,a,0,7);ctx.fill();}
 else if(kind===3){ctx.beginPath();ctx.ellipse(0,0,r,r*.4,a+p*3,0,1.7);ctx.stroke();}
 else{ctx.globalAlpha=(1-p)*.16;ctx.beginPath();ctx.ellipse(xx*.7,yy*.55,19,9,a,0,7);ctx.fill();ctx.globalAlpha=1-p;ctx.beginPath();ctx.moveTo(xx-9,yy+8);ctx.lineTo(xx+12,yy-12);ctx.stroke();}}
 star(0,0,22*(1-p),colors[kind]);ctx.restore();}
// Both sides use the same damage-to-radius curve; finishers add trails, not arbitrary size.
const impactScale=damage=>Math.max(.35,Math.min(1.7,Math.sqrt(Math.max(0,damage)/30)));
function impact(x,y,p,damage,color='#ffe0a1'){
 if(p<0||p>1)return;const k=impactScale(damage);ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.globalAlpha=1-p;
 star(0,0,18*(1-p*.5),color);star(0,0,8*(1-p),'#fff7df');
 ctx.strokeStyle=color;ctx.lineWidth=2;for(let i=0;i<6;i++){const a=i*Math.PI/3,r=9+p*26;ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(a)*(r+6),Math.sin(a)*(r+6));ctx.stroke();}ctx.restore();}
function drawBattle(){if(!battle)return;const b=battle,now=performance.now(),t=(now-b.start)/1000,age=(now-(b.hitAt||-1e8))/1000,charge=!b.done&&(b.legendary&&b.round===1||b.monsterHp<=b.damage&&b.next-now<1000);
 const scale=Math.min(1,(cv.width/dpr-20)/380,(cv.height/dpr-20)/270);if(scale<=0)return;
 ctx.save();ctx.fillStyle='rgba(4,8,16,.55)';ctx.fillRect(0,0,cv.width,cv.height);ctx.translate(cv.width/2,cv.height/2);ctx.scale(dpr*scale,dpr*scale);
 chamber();ctx.textAlign='center';ctx.font='600 14px sans-serif';ctx.fillStyle='#e7edda';ctx.fillText(b.m.boss?'심연의 수호자 · 보스전':b.m.name+' 등장!',0,-111);
 ctx.font='11px sans-serif';ctx.fillText('주민 · 토큰 체력',-95,-95);ctx.fillText(b.m.name,95,-95);
 bar(-160,-89,b.hp,b.maxHp,'#a8d89b');bar(30,-89,b.monsterHp,b.maxMonsterHp,'#dba0ca');

 const unit=96/Math.max(b.size,b.monsterSize),as=b.size*unit,ms=b.monsterSize*unit,hit=Math.max(0,1-Math.max(0,age)/(b.done&&b.won?1.2:.5)),counter=Math.max(0,1-(now-(b.playerHitAt||-1e8))/700),preCounter=b.counterAt?Math.max(0,Math.min(1,1-(b.counterAt-now)/300)):0,mx=85+hit*7-Math.max(preCounter,counter)*55;
 const windup=!b.done&&b.next-now<300?Math.max(0,Math.min(1,1-(b.next-now)/300)):0,px=-83+Math.max(windup,hit)*100-counter*22;
 ctx.save();ctx.translate(px,87);ctx.rotate(counter?-.18*counter:charge?Math.sin(t*16)*.05:0);ctx.globalAlpha=counter>.1?.65+.35*Math.abs(Math.sin(counter*24)):1;drawTile(ctx,'dungeon',b.a.idx,-as/2,-as,as/16);ctx.restore();
 equipment(b.a,px,87,as,{sword:charge?-.1:hit*.95-.3},1,b.legendary&&(charge||b.done&&b.won),b.size<b.monsterSize);
 const finishAge=b.done&&b.won?(now-b.ended)/1000:-1;
 ctx.save();if(finishAge>=0){ctx.globalAlpha=Math.max(0,1-Math.max(0,finishAge-.2)/1.05);ctx.translate(mx,87);ctx.scale(1+Math.min(.18,finishAge*.15),Math.max(.3,1-finishAge*.45));ctx.translate(-mx,-87);}monster(b.m,mx,87-hit*9,ms,t);ctx.restore();
 if(finishAge>=0&&finishAge<1.5){ctx.save();ctx.globalAlpha=1-finishAge/1.5;for(let i=0;i<18;i++){const a=i*2.4,r=finishAge*43;star(mx+Math.cos(a)*r,87-ms*.5+Math.sin(a)*r-finishAge*12,i%3?2:4,'#e6c8ff');}ctx.restore();}
 if(charge){ctx.save();ctx.globalAlpha=.65;for(let i=0;i<8;i++){const a=i*Math.PI/4+t*3,r=18+((b.next-now)/1000%1)*28;star(px+Math.cos(a)*r,87-as*.5+Math.sin(a)*r,2,'#ffe4ad');}ctx.restore();}
 if(finishAge>=1.15){const q=Math.min(1,(finishAge-1.15)/2.5),fly=Math.max(0,(q-.5)*2),ix=85+(-83-85)*fly,iy=35-Math.sin(q*Math.PI)*53+fly*30;
  ctx.save();ctx.globalAlpha=q>.9?(1-q)*10:1;ctx.shadowColor='#ffe4a5';ctx.shadowBlur=14;star(ix,iy,b.rewardLabel==='별가루 +1'?10:16,b.m.boss?'#efb4ed':'#ffe0a0');ctx.shadowBlur=0;star(ix,iy,5,'#fff8df');ctx.textAlign='center';ctx.font='600 14px sans-serif';ctx.fillStyle='#ffe5ab';ctx.fillText(b.rewardLabel+' 획득!',0,0);ctx.restore();}

 if(b.done&&b.won){star(px,87-as-12,7,'#ffe19b');}
 if(counter>0){impact(px,87-as*.5,1-counter,b.receivedDamage,'#ffba98');ctx.fillStyle='#ffb8a7';ctx.font='bold 18px sans-serif';ctx.fillText('−'+b.receivedDamage,px,65-as-(1-counter)*28);}
 if(age>=0&&age<1.2){const k=impactScale(b.inflictedDamage||b.damage)*(b.done&&b.won?1.55:1);ctx.save();ctx.translate(mx,87-ms*.45);ctx.scale(k,k);if(b.legendary&&b.done&&b.won)crescent(0,0,age/1.2);else if(b.done&&b.won)finisher(0,0,age/1.2,b.a.key);ctx.restore();if(!b.done)impact(mx,87-ms*.45,age/.5,b.inflictedDamage||b.damage);}
 ctx.fillStyle='#e8dfba';ctx.font='12px sans-serif';ctx.fillText(b.done?(b.won?elements[hashSeed(b.a.key)%5]+` 일격! 별가루 +${b.m.boss?8:1}`+(b.m.boss?' · 보스 배지 획득':''):'잠깐 쉬면 체력이 회복돼요'):charge?(b.legendary?'전설검 · 별빛을 모으는 중…':'마지막 일격 · 힘을 모으는 중…'):`${b.round+1}번째 공방`,0,116);
 ctx.restore();}
function equipment(a,x,y,size,pose,face,legendary=false,shield=false){ctx.save();ctx.translate(x,y);ctx.scale(face,1);sword(size*.27,-size*.48,legendary?size*2.5:size*.62,pose.sword??-.3,legendary?3:gear(a),performance.now()/1000);
 if(shield){ctx.fillStyle='#efcc83';ctx.beginPath();ctx.arc(-size*.28,-size*.3,size*.24,0,7);ctx.fill();ctx.fillStyle='#84aabd';ctx.beginPath();ctx.arc(-size*.28,-size*.3,Math.max(1,size*.24-2),0,7);ctx.fill();star(-size*.28,-size*.3,size*.1,'#ffeac2');}ctx.restore();}
// Quiet floors and one furnished alcove keep the tiny rooms readable.
// Layout reference: World of NoeL's Dungeon Interior; artwork below is drawn locally.
function roomInterior(room,ix,iy,scale){
 ctx.save();ctx.translate(ix,iy);ctx.scale(scale,scale);
 const role=room.role,wood=['waiting','meeting'].includes(role);
 const colors={plan:['#48485b','#80758f'],research:['#434f5c','#8b9da4'],design:['#51475c','#aa8ebc'],meeting:['#665747','#b39975'],explore:['#424e50','#839d90'],frontend:['#3f5361','#89b5c5'],backend:['#55494a','#b5866b'],infra:['#464d57','#929fac'],qa:['#435650','#92b69a'],release:['#554e60','#ae98c2'],waiting:['#6a5548','#c09c7c'],done:['#45544b','#9fb59b']};
 const [floor,accent]=colors[role]||colors.plan;
 const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 rect(0,0,96,80,floor);
 // Broad, almost tonal paving avoids a checkerboard at half-window size.
 ctx.globalAlpha=.12;
 for(let y=16;y<80;y+=16){rect(0,y,96,1,'#d8ddd5');if(!wood)for(let x=(y%32?16:0);x<96;x+=32)rect(x,y-15,1,14,'#d8ddd5');}
 ctx.globalAlpha=1;
 rect(0,0,96,3,'#1a24364d');rect(0,3,2,77,'#1a243633');
 const rug=(x,y,w,h)=>{rect(x,y,w,h,accent+'50');rect(x+2,y+2,w-4,h-4,floor);rect(x+4,y+4,w-8,h-8,accent+'19');};
 const shelf=(x,y,w)=>{rect(x+1,y+2,w,15,'#17212b55');rect(x,y,w,14,'#372f37');rect(x,y,w,2,'#99806a');rect(x,y+12,w,2,'#99806a');for(let i=0;i<Math.floor((w-4)/4);i++){rect(x+3+i*4,y+3,3,8,['#a58d78','#859c9d','#a292b1','#b1a67f'][i%4]);}rect(x+2,y+10,w-4,1,'#54434c');};
 const table=(x,y,w)=>{rect(x+3,y+11,3,4,'#352f32');rect(x+w-6,y+11,3,4,'#352f32');rect(x,y,w,12,'#8b7060');rect(x+1,y+1,w-2,2,'#b99a7c');rect(x+2,y+4,w-4,6,'#9e826a');};
 const book=(x,y)=>{rect(x,y,13,8,'#e1d2ad');rect(x+6,y,1,8,'#9c8c79');rect(x+2,y+2,3,1,'#af9c88');rect(x+8,y+4,3,1,'#af9c88');};
 const crystal=(x,y,c)=>{rect(x-8,y+11,17,3,'#263440');ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x+6,y);ctx.lineTo(x+4,y+11);ctx.lineTo(x-5,y+11);ctx.lineTo(x-7,y);ctx.closePath();ctx.fill();ctx.fillStyle='#edf1eb99';ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x,y+10);ctx.lineTo(x-5,y);ctx.fill();};
 const pot=(x,y)=>{rect(x+2,y+7,8,7,'#8e7767');rect(x,y+6,12,3,'#af9275');rect(x+4,y-1,4,9,'#92ad8b');rect(x,y+1,5,4,'#6f987e');rect(x+7,y-3,5,6,'#779f89');};
 const lamp=(x,y)=>{rect(x-2,y+2,4,6,'#5c5149');rect(x-3,y-3,6,7,'#d7b785');rect(x-1,y-2,2,5,'#fff0c5');};
 if(role==='plan'){shelf(6,6,30);table(52,8,33);book(61,10);rug(16,34,64,32);}
 else if(role==='research'){shelf(6,5,84);table(8,23,26);book(14,25);rug(42,34,38,31);}
 else if(role==='design'){rect(29,5,38,20,'#393442');rect(32,7,32,15,'#695879');crystal(48,13,'#be9acc');lamp(12,11);lamp(84,11);rug(23,37,50,26);}
 else if(role==='meeting'){table(20,9,56);book(41,11);for(const x of [26,58]){rect(x,24,10,7,'#493d38');rect(x+1,24,8,3,'#a28b73');}rug(17,39,62,27);}
 else if(role==='explore'){rect(7,6,34,18,'#303e43');rect(10,8,28,13,'#808f80');rect(15,10,2,8,'#c3ba98');rect(17,16,13,2,'#c3ba98');pot(76,10);rug(17,35,62,29);}
 else if(role==='frontend'){rect(12,5,72,20,'#304653');crystal(32,12,'#85c5d2');crystal(64,12,'#99b0dd');rug(22,38,52,25);}
 else if(role==='backend'){rect(10,4,31,22,'#2f3039');rect(14,7,23,15,'#754c40');rect(19,11,13,10,'#d89360');rect(22,14,7,6,'#f3cf8b');table(56,12,27);rect(61,10,17,5,'#a0a4a5');rect(65,15,8,5,'#535865');rug(20,40,58,25);}
 else if(role==='infra'){rect(8,6,80,19,'#343e49');for(const x of [16,42,68]){rect(x,9,12,12,'#74868e');rect(x+2,11,8,5,'#a7b7b3');rect(x+5,17,2,3,'#ced2bc');}rug(20,38,56,28);}
 else if(role==='qa'){rect(8,6,80,19,'#33473e');pot(15,11);pot(41,11);pot(67,11);rug(18,38,60,26);}
 else if(role==='release'){rect(28,4,40,21,'#3d354c');rect(35,8,26,14,'#957c61');rect(35,8,26,3,'#c5a875');rect(46,13,4,5,'#f0d592');lamp(13,13);lamp(83,13);rug(24,36,48,29);}
 else if(role==='waiting'){table(9,8,33);book(16,10);rect(59,6,27,17,'#493a3a');rect(61,7,23,5,'#b69984');rect(61,13,23,8,'#997575');pot(9,48);rug(27,36,55,29);}
 else{rect(10,7,76,18,'#34483e');pot(14,12);pot(70,12);rect(37,9,22,12,'#788e87');rect(39,11,18,8,'#95b8b2');rug(20,38,56,26);}
 ctx.restore();}
function loot(a,x,y,size){ctx.save();const t=performance.now()/1000;if(equipped==='halo'){ctx.strokeStyle='#ffe1a3';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-size-5,size*.27,size*.08,0,0,7);ctx.stroke();}if(equipped==='wings'){ctx.fillStyle='#b9e9efaa';for(const dir of [-1,1]){ctx.beginPath();ctx.ellipse(x+dir*size*.4,y-size*.5,size*.25,size*.14,dir*(.5+Math.sin(t*4)*.18),0,7);ctx.fill();}}if(equipped==='orbit')star(x+Math.cos(t*2)*size*.65,y-size*.6+Math.sin(t*2)*size*.2,size*.12,'#d9c4ff');ctx.restore();const r=record(a);if(r.kills<3&&!r.bosses)return;ctx.save();star(x+size*.45,y-size*.6,size*.1,r.bosses?'#efacd8':r.kills>=10?'#c5b4ff':'#ffe09b');ctx.restore();}
const panel=document.createElement('details');panel.id='adventure-log';panel.innerHTML='<summary>⚔ 모험</summary><div class="adventure-body"><button type="button"></button><p></p><div class="adventure-shop"></div></div>';
const style=document.createElement('style');style.textContent='#adventure-log{position:absolute;left:9px;top:9px;z-index:4;color:#e4edd8;font:12px sans-serif;max-width:230px}#adventure-log summary{cursor:pointer;background:#203b32;border:1px solid #647e63;border-radius:8px;padding:7px 10px;list-style:none}#adventure-log .adventure-body{background:#203b32;padding:12px;border-radius:8px;line-height:1.7}#adventure-log button{font:inherit;background:#354f3a;color:#e4edd8;border:1px solid #89a17a;border-radius:6px;padding:6px 10px}#adventure-log p{margin:8px 0 0;white-space:pre-line}';document.head.append(style);document.getElementById('map-stage').append(panel);
function renderLog(){const all=Object.values(records),kills=all.reduce((s,r)=>s+r.kills,0),bosses=all.reduce((s,r)=>s+r.bosses,0);panel.querySelector('button').textContent=enabled?'모험 켜짐 · 끄기':'모험 꺼짐 · 켜기';panel.querySelector('p').textContent=`몬스터 ${kills}마리 · 보스 ${bosses}마리\n별가루 ${balance()}개 (보스 +8)\n주민별 3마리: 별 장식\n10마리: 보라 별 장식\n보스 처치: 분홍 보스 배지`;const shop=panel.querySelector('.adventure-shop');shop.innerHTML='<strong>✦ 별가루 상점</strong><small style="display:block">모든 주민에게 함께 장착돼요</small>'+catalog.map(i=>`<button style="display:block;margin-top:6px;width:100%" data-item="${i.id}" ${!owned.has(i.id)&&balance()<i.price?'disabled':''}>${equipped===i.id?'✓ ':''}${i.name} · ${owned.has(i.id)?equipped===i.id?'해제':'장착':i.price+'개'}</button>`).join('');}
panel.onclick=event=>{const id=event.target.closest?.('[data-item]')?.dataset.item;if(id)buy(id);};
panel.querySelector('button').onclick=()=>{enabled=!enabled;save('codextown.adventureEnabled',enabled);if(!enabled){cancel();monsters.length=0;}else nextSpawn=performance.now()+4000;renderLog();};renderLog();
window.townAdventure={impactScale,buy,balance,get equipped(){return equipped;},wander,finisher,caveWalls,caveDoor,step,drawMap,drawBattle,roomInterior,equipment,loot,hpFor,spawn,begin,cancel,record,reward,get active(){return battle;},get monsters(){return monsters;},busy:a=>battle?.a===a,resting:a=>performance.now()<(rest.get(a.key)||0),duelTime:d=>{const t=(performance.now()-d.start)/1000;return d.legendary&&t>=2.5?t<4.5?2.5:t-2:t;},crescent};
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
