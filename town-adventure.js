/* Local dungeon adventures. No Codex session records are modified. */
(()=>{
'use strict';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const chronicle=typeof createTownChronicle==='function'?createTownChronicle(localStorage):null;
if(chronicle)chronicle.event=(type,action,stars=0)=>type==='treasure'?chronicle.treasure(action,stars):chronicle.raid(action);
const saved=read('codextown.adventure',{}),records={};
for(const [key,r] of Object.entries(saved&&typeof saved==='object'?saved:{}))if(r&&Number.isSafeInteger(r.kills)&&r.kills>=0){
 const bosses=Number.isSafeInteger(r.bosses)&&r.bosses>=0?r.bosses:0;
 // Preserve past earnings at the old 1/8 rate; future rewards accumulate separately.
 const earnedStardust=Number.isSafeInteger(r.earnedStardust)&&r.earnedStardust>=0?r.earnedStardust:r.kills+bosses*7;
 records[key]={duelWins:Number.isSafeInteger(r.duelWins)&&r.duelWins>=0?r.duelWins:0,duelStars:Number.isSafeInteger(r.duelStars)&&r.duelStars>=0?r.duelStars:0,kills:r.kills,bosses,earnedStardust,deaths:Number.isSafeInteger(r.deaths)&&r.deaths>=0?r.deaths:0,lossStreak:Number.isSafeInteger(r.lossStreak)&&r.lossStreak>=0?r.lossStreak:0};
}
const slots={weapon:'무기',shield:'방패',head:'머리',body:'몸',hands:'장갑',feet:'신발',charm:'장식',pet:'펫'};
const catalog=[
 {id:'steel',slot:'weapon',name:'기사의 검',price:8,rank:1,idx:104,icon:'⚔',desc:'금빛 손잡이의 넓은 강철 검'},
 {id:'frost',slot:'weapon',name:'강철 대검',price:18,rank:2,idx:106,icon:'❄',desc:'푸른 결정과 광채를 두른 묵직한 대검'},
 {id:'astral',slot:'weapon',name:'화염검',price:35,rank:3,idx:107,icon:'✧',desc:'금빛 날개 장식과 불꽃이 타오르는 검'},
 {id:'axe',slot:'weapon',name:'전투 도끼',price:14,rank:1,idx:118,desc:'초승달 날의 양손 도끼'},
 {id:'hammer',slot:'weapon',name:'드워프 망치',price:14,rank:1,idx:117,desc:'짧고 단단한 전투 망치'},
 {id:'staff',slot:'weapon',name:'수정 지팡이',price:16,rank:2,idx:129,desc:'분홍 수정이 박힌 마법 지팡이'},
 {id:'woodshield',slot:'shield',name:'모험가 방패',price:7,idx:101,desc:'몸 옆에 드는 작은 나무 방패'},
 {id:'ironshield',slot:'shield',name:'기사의 방패',price:12,idx:102,desc:'은빛으로 반짝이는 기사 방패'},
 {id:'halo',slot:'head',name:'별빛 왕관',price:5,icon:'♕',desc:'머리 위에 살포시 뜨는 금빛 고리'},
 {id:'crown',slot:'head',name:'날개 투구',price:10,icon:'♛',desc:'은빛 날개가 달린 기사의 투구'},
 {id:'wings',slot:'body',name:'요정 날개',price:12,icon:'ʚɞ',desc:'등 뒤에서 팔랑이는 작은 날개'},
 {id:'cape',slot:'body',name:'은빛 갑옷',price:9,icon:'◆',desc:'어깨와 몸을 감싸는 은빛 갑옷'},
 {id:'gloves',slot:'hands',name:'강철 장갑',price:6,icon:'✊',desc:'갑옷과 어울리는 강철 손보호대'},
 {id:'boots',slot:'feet',name:'탐험가 부츠',price:6,icon:'♟',desc:'발끝을 감싸는 갈색 부츠'},
 {id:'moonboots',slot:'feet',name:'달빛 신발',price:11,icon:'✦',desc:'은은한 푸른빛의 신발'},
 {id:'orbit',slot:'charm',name:'달빛 위성',price:20,icon:'✧',desc:'주민 곁을 맴도는 보랏빛 별'},
 {id:'fox',slot:'pet',name:'꼬마 박쥐',price:15,icon:'🦊',desc:'발치에서 폴짝이는 작은 박쥐'},
 {id:'wisp',slot:'pet',name:'이끼 정령',price:22,icon:'✺',desc:'둥실둥실 따라오는 초록빛 정령'},
 {id:'thunderblade',slot:'weapon',name:'뇌명 · 번개검',price:55,rank:3,idx:104,element:1,theme:'storm',desc:'칼날을 타고 황금 번개가 흐르는 쾌검'},
 {id:'tideblade',slot:'weapon',name:'해월 · 파도검',price:48,rank:3,idx:106,element:2,theme:'tide',desc:'물결과 달빛 결정이 감싸는 수호검'},
 {id:'eclipse',slot:'weapon',name:'월식 · 밤의 대검',price:70,rank:3,idx:106,element:4,theme:'eclipse',desc:'보랏빛 궤도와 별 조각을 두른 최상급 대검'},
 {id:'runemallet',slot:'weapon',name:'바람룬 망치',price:45,rank:3,idx:117,element:3,theme:'wind',desc:'바람의 룬으로 감싼 묵직한 전투 도구'},
 {id:'aegis',slot:'shield',name:'별수호 방패',price:32,idx:102,desc:'금빛 테두리로 빛나는 묵직한 수호 방패'},
 {id:'runecrown',slot:'head',name:'달의 관',price:25,desc:'푸른 별이 떠 있는 마법의 머리 고리'},
 {id:'warden',slot:'body',name:'숲지기 갑옷',price:30,desc:'이끼빛 강철로 몸을 지키는 중갑옷'},
 {id:'nightwings',slot:'body',name:'밤나비 날개',price:28,desc:'작고 보랏빛인 날개로 치명타를 높여요'},
 {id:'sungrip',slot:'hands',name:'태양 건틀릿',price:24,desc:'손끝에서 작은 금빛이 반짝이는 장갑'},
 {id:'runegloves',slot:'hands',name:'룬 세공 장갑',price:20,desc:'치명타를 노리는 청록빛 전투 장갑'},
 {id:'starboots',slot:'feet',name:'별길 부츠',price:23,desc:'발치에 작은 별이 따라오는 은빛 부츠'},
 {id:'compass',slot:'charm',name:'폭풍 나침반',price:26,desc:'황금 바늘이 돌며 공격과 치명타를 더해요'},
 {id:'lantern',slot:'charm',name:'온기 등불',price:24,desc:'은은한 불빛으로 체력과 방어를 보태요'},
 {id:'moonfox',slot:'pet',name:'달빛 꼬마 유령',price:35,desc:'동그란 유령 친구가 체력과 공격을 보태요'},
 {id:'cub',slot:'pet',name:'폭풍 아기 야수',price:42,desc:'폴짝이는 작은 야수가 공격과 방어를 보태요'},
 {id:'solaris',slot:'weapon',name:'태양왕의 성검',price:140,rank:4,idx:107,element:0,theme:'sun',desc:'금빛 광륜과 태양 불꽃을 두른 성검'},
 {id:'voidblade',slot:'weapon',name:'심연 · 별을 가르는 검',price:240,rank:5,idx:106,element:4,theme:'void',desc:'겹겹의 보라 궤도가 회전하는 최상급 검'},
 {id:'tempest',slot:'weapon',name:'천뢰 · 폭풍의 대검',price:180,rank:4,idx:104,element:1,theme:'storm',desc:'세 갈래 번개와 황금 룬의 대검'},
 {id:'bulwark',slot:'shield',name:'성좌의 대방패',price:80,idx:102,desc:'금빛 별무늬를 새긴 최상급 방패'},
 {id:'imperial',slot:'head',name:'별왕의 투구',price:75,desc:'보랏빛 금속과 빛나는 날개 투구'},
 {id:'celestial',slot:'body',name:'천공 기사 갑옷',price:110,desc:'황금빛 어깨 장식을 두른 중갑옷'},
 {id:'titanhand',slot:'hands',name:'거인의 건틀릿',price:70,desc:'붉은 룬으로 힘을 더하는 장갑'},
 {id:'cometboots',slot:'feet',name:'혜성 장화',price:70,desc:'발끝에서 보라 별 조각이 반짝여요'},
 {id:'heartlantern',slot:'charm',name:'불멸의 등불',price:90,desc:'강적 앞에서도 체력을 지키는 등불'},
 {id:'astrolabe',slot:'charm',name:'성좌 관측기',price:90,desc:'겹겹의 황금 궤도로 공격과 치명타를 높여요'},
 {id:'phoenix',slot:'pet',name:'꼬마 불사조',price:130,desc:'주황빛 날개로 따라오는 작은 불사조'},
 {id:'dragonling',slot:'pet',name:'꼬마 그림자룡',price:170,desc:'보랏빛 날개를 편 작은 용 친구'},
 {"id": "dawnbringer", "slot": "weapon", "name": "여명 · 태양을 깨우는 검", "price": 420, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent", "idx": 107, "rank": 6, "element": 0, "theme": "sun"},
 {"id": "thunderlord", "slot": "weapon", "name": "천벌 · 벼락 군주의 검", "price": 460, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent", "idx": 104, "rank": 6, "element": 1, "theme": "storm"},
 {"id": "abyssreaper", "slot": "weapon", "name": "심판 · 심연의 집행검", "price": 520, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent", "idx": 106, "rank": 6, "element": 4, "theme": "void"},
 {"id": "oathkeeper", "slot": "weapon", "name": "영원 · 별바다의 서약", "price": 400, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent", "idx": 106, "rank": 6, "element": 2, "theme": "tide"},
 {"id": "seraphshield", "slot": "shield", "name": "성역의 날개 방패", "price": 180, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent", "idx": 102},
 {"id": "auroracrown", "slot": "head", "name": "극광의 제왕관", "price": 160, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent"},
 {"id": "eternalplate", "slot": "body", "name": "영겁의 성기사 갑옷", "price": 220, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent"},
 {"id": "starforged", "slot": "hands", "name": "별을 벼린 건틀릿", "price": 150, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent"},
 {"id": "riftsteps", "slot": "feet", "name": "차원을 걷는 장화", "price": 150, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent"},
 {"id": "worldheart", "slot": "charm", "name": "세계수의 심장", "price": 200, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent"},
 {"id": "stardrake", "slot": "pet", "name": "꼬마 성운룡", "price": 240, "desc": "별빛 결정과 금빛 룬을 두른 초월 장비", "tier": "transcendent"}
];
const itemStats={steel:{attack:4},frost:{attack:10},astral:{attack:18,crit:.05},axe:{attack:8,crit:.03},hammer:{attack:8,defense:2},staff:{attack:9,hp:8},woodshield:{defense:4},ironshield:{defense:8},halo:{hp:10},crown:{defense:3,hp:12},wings:{defense:2,hp:8},cape:{defense:6,hp:20},gloves:{attack:3},boots:{defense:2,hp:8},moonboots:{defense:2,crit:.05},orbit:{crit:.08},fox:{attack:3},wisp:{hp:15,crit:.03}};
Object.assign(itemStats,{thunderblade:{attack:20,crit:.1},tideblade:{attack:16,hp:25},eclipse:{attack:24,crit:.03},runemallet:{attack:17,defense:4},aegis:{defense:11,hp:10},runecrown:{defense:3,hp:24},warden:{defense:9,hp:35},nightwings:{hp:18,crit:.08},sungrip:{attack:6},runegloves:{attack:3,crit:.07},starboots:{defense:3,hp:18},compass:{attack:3,crit:.07},lantern:{defense:3,hp:30},moonfox:{attack:3,hp:25},cub:{attack:5,defense:2}});
Object.assign(itemStats,{solaris:{attack:32,crit:.08},voidblade:{attack:40,crit:.1},tempest:{attack:34,crit:.15},bulwark:{defense:16,hp:25},imperial:{defense:6,hp:40},celestial:{defense:14,hp:60},titanhand:{attack:10,crit:.03},cometboots:{defense:6,hp:35},heartlantern:{defense:4,hp:50},astrolabe:{attack:6,crit:.1},phoenix:{attack:8,hp:35},dragonling:{attack:10,defense:4}});
Object.assign(itemStats,{"dawnbringer": {"attack": 72, "crit": 0.12}, "thunderlord": {"attack": 68, "crit": 0.22}, "abyssreaper": {"attack": 82, "crit": 0.14}, "oathkeeper": {"attack": 65, "hp": 80, "defense": 6}, "seraphshield": {"defense": 24, "hp": 60}, "auroracrown": {"defense": 12, "hp": 75}, "eternalplate": {"defense": 25, "hp": 110}, "starforged": {"attack": 20, "crit": 0.07}, "riftsteps": {"defense": 12, "hp": 65, "crit": 0.04}, "worldheart": {"attack": 8, "defense": 8, "hp": 95}, "stardrake": {"attack": 20, "defense": 8, "hp": 50}});
for(const item of catalog)item.stats=itemStats[item.id]||{};
const shopSaved=read('codextown.shop',{}),shopV2=read('codextown.shop.sessions',null),inventories=Object.create(null);
const validItems=items=>Array.isArray(items)?[...new Set(items.filter(id=>catalog.some(i=>i.id===id)))]:[];
for(const [key,r] of Object.entries(shopV2?.sessions||{})){if(!r||typeof r!=='object')continue;const owned=validItems(r.owned);const equipped={};for(const i of catalog)if(owned.includes(i.id)&&(r.equipped===i.id||r.equipped?.[i.slot]===i.id))equipped[i.slot]=i.id;inventories[key]={owned,spent:Number.isSafeInteger(r.spent)&&r.spent>=0?r.spent:0,equipped};}
let legacy=validItems(shopV2?shopV2.legacy:shopSaved?.owned),selectedSession='',shopFilter='all';
const inventory=key=>inventories[key]||{owned:[],spent:0,equipped:{}};
const persistShop=()=>save('codextown.shop.sessions',{sessions:inventories,legacy});
const equippedFor=(a,slot='head')=>inventory(typeof a==='string'?a:a.key).equipped[slot]||'';
const balance=(key=selectedSession)=>Math.max(0,(records[key]?.earnedStardust||0)-inventory(key).spent);
function buy(id,key=selectedSession){
 const item=catalog.find(i=>i.id===id);if(!item||!avatars[key])return false;
 const inv=inventory(key);if(!inv.owned.includes(id)){if(legacy.includes(id))legacy=legacy.filter(x=>x!==id);else{if(balance(key)<item.price)return false;inv.spent+=item.price;}inv.owned.push(id);}
 inv.equipped[item.slot]=inv.equipped[item.slot]===id?'':id;inventories[key]=inv;persistShop();renderLog();return true;
}
function autoEquip(a){
 if(!chronicle||battle?.a===a||a.duel||window.townEvents?.busy(a))return;
 const mode=chronicle.autoMode(a.key);if(mode==='off')return;
 for(let i=0;i<8;i++){const inv=inventory(a.key),item=chronicle.chooseUpgrade(catalog,inv.equipped,balance(a.key),mode,inv.owned);if(!item||!buy(item.id,a.key))break;}
}
function journal(){const data=chronicle?.snapshot()||{bosses:[],relations:[],treasure:{},raids:{}};return {...data,bosses:[...bossKinds,...eliteKinds].map(kind=>({id:kind.id,name:kind.name,idx:kind.idx,level:kind.level||10,seen:0,kills:0,losses:0,maxHit:0,lastSeen:0,...data.bosses.find(b=>b.id===kind.id)})),sessions:Object.values(avatars).map(a=>({key:a.key,title:state.sessionInfo[a.key]?.title||a.key,idx:a.idx,mode:chronicle?.autoMode(a.key)||'off'}))};}
const named=a=>({...a,title:state.sessionInfo[a.key]?.title||a.key});
let nextAuto=0;
const elementFor=a=>catalog.find(i=>i.id===equippedFor(a,'weapon'))?.element;
let lastElement=-1;
function nextElement(){lastElement=lastElement<0?Math.floor(Math.random()*5):(lastElement+1+Math.floor(Math.random()*4))%5;return lastElement;}
const monsters=[],rest=new Map();let battle=null,nextSpawn=performance.now()+12000,lastStep=0,enabled=read('codextown.adventureEnabled',true)!==false;
const hpFor=t=>80+Math.round(Math.min(120,Math.log10(1+Math.max(0,Number(t)||0)/1000)*24));
const record=a=>records[a.key]||{kills:0,bosses:0,earnedStardust:0,deaths:0,lossStreak:0};
function statsFor(a){const size=spriteScaleFor(a,layout.scale)/layout.scale,base={attack:18+Math.round(size*7),defense:2+Math.floor(Math.max(0,size-1)),hp:hpFor(tokensOf(a)),crit:.1},bonus={attack:0,defense:0,hp:0,crit:0};for(const id of Object.values(inventory(a.key).equipped)){const item=catalog.find(i=>i.id===id);if(item)for(const stat of Object.keys(bonus))bonus[stat]+=item.stats[stat]||0;}return {attack:base.attack+bonus.attack,defense:base.defense+bonus.defense,hp:base.hp+bonus.hp,crit:Math.min(.45,base.crit+bonus.crit),base,bonus};}
function rollDamage(attack,defense,critChance){const critical=Math.random()<critChance;return {damage:Math.max(1,Math.round(attack*(critical?1.75:1)-defense)),critical};}
const skillDuration=1.4;
function rollPlayerHit(attack,defense,critChance){const skill=Math.random()<.25,element=skill?Math.floor(Math.random()*5):null;return {...rollDamage(attack*(skill?1.6:1),defense,critChance),skill,element};}
function prepareBattleHit(b,readyAt){b.nextHit=rollPlayerHit(b.damage,b.monsterDefense,b.stats.crit);b.finishing=b.legendary&&b.round===1||b.monsterHp<=b.nextHit.damage;b.windup=b.finishing?(b.legendary?4800:3000):b.nextHit.skill?1200:220;b.next=readyAt+280+b.windup;if(b.finishing&&b.nextHit.skill&&!b.legendary)b.element=b.nextHit.element;}
// Each displayed hit is the actual damage event, including armor and critical hits.
const gradeFor=stats=>Math.max(1,Math.min(10,Math.ceil((stats.attack*2+stats.defense*3+stats.hp*.12-32)/35)));
function resolveDuel(a,b,legendary=null){
 const actors=[a,b],stats=actors.map(statsFor),hp=stats.map(s=>s.hp),snapshots=[hp.slice()],strikes=[];let rounds=0;
 while(hp[0]>0&&hp[1]>0&&rounds<600){
  rounds++;const first=Math.random()<.5?0:1;
  for(const attacker of [first,1-first]){
   const defender=1-attacker,fatigue=Math.max(0,rounds-8)*2;
   const hit=rollPlayerHit(stats[attacker].attack+fatigue,Math.max(0,stats[defender].defense-fatigue),stats[attacker].crit);
   const legend=legendary===actors[attacker]&&rounds>=3;
   const damage=legend?hp[defender]:Math.min(hit.damage,Math.max(0,hp[defender]-(legendary===actors[defender]?1:0)));
   hp[defender]-=damage;
   strikes.push({attacker,damage,skill:hit.skill&&!legend,element:hit.element,critical:hit.critical&&!legend,hp:hp.slice(),legendary:legend,fatigue});snapshots.push(hp.slice());
   if(!hp[defender])break;
  }
 }
 const winner=hp[0]>0?a:b,grades=stats.map(gradeFor);let at=1;
 for(let i=0;i<strikes.length;i++){const hit=strikes[i];hit.final=i===strikes.length-1;hit.chargeStart=at-.3;if(hit.final||hit.skill){hit.chargeStart=at;hit.chargeEnd=at+(hit.final?(legendary?4.8:3):1.2);at=hit.chargeEnd+.28;}hit.at=at;at+=hit.skill&&!hit.final?2.3:.85;}
 const finalAt=strikes.at(-1).at,resultAt=finalAt+(legendary?3.15:2.25);
 return {winner,stats,snapshots,strikes,grades,reward:grades[winner===a?1:0]*2,finalAt,resultAt,endAt:resultAt+2};
}
function duelPlayback(d,now=performance.now()){
 if(!d.combat?.strikes)return null;
 const raw=(now-d.start)/1000,c=d.combat,last=c.strikes.at(-1);let index=-1;
 for(let i=0;i<c.strikes.length;i++){if(c.strikes[i].at>raw)break;index=i;}
 const hit=index<0?null:c.strikes[index],age=hit?raw-hit.at:-1,charging=raw>=last.chargeStart&&raw<(last.chargeEnd??last.at),finalApproach=raw>=(last.chargeEnd??last.at)&&raw<last.at;
 const charge=charging?(raw-last.chargeStart)/((last.chargeEnd??last.at)-last.chargeStart):0,upcoming=c.strikes[index+1],skillCharging=Boolean(upcoming?.skill&&!upcoming.final&&raw>=upcoming.chargeStart&&raw<(upcoming.chargeEnd??upcoming.at)),skillCharge=skillCharging?(raw-upcoming.chargeStart)/((upcoming.chargeEnd??upcoming.at)-upcoming.chargeStart):0,skillApproach=Boolean(upcoming?.skill&&!upcoming.final&&raw>=(upcoming.chargeEnd??upcoming.at)&&raw<upcoming.at);
 let t;
 if(raw>=c.resultAt)t=3.6+raw-c.resultAt;
 else if(raw>=last.at)t=2.9+Math.min(.69,raw-last.at);
 else if(charging)t=2.5+Math.max(0,1-(last.at-raw)/.3)*.39;
 else if(!hit)t=Math.min(.99,raw);
 else t=age<.4?1+age/.4*.7:1.7+Math.min(1,(age-.4)/.45)*.8;
 return {raw,t,index,hit,hitAge:age,charging,charge,finalApproach,upcoming,skillCharging,skillCharge,skillApproach,hp:hit?.hp||c.stats.map(s=>s.hp),finalHitAge:raw-last.at,attacker:charging||finalApproach?last.attacker:skillCharging||skillApproach?upcoming.attacker:hit?.attacker,finished:raw>=c.endAt,result:raw>=c.resultAt};
}
function rewardDuel(d){if(d.lootAwarded||!d.combat)return;d.lootAwarded=true;chronicle?.duel(named(d.a),named(d.b));const r=record(d.winner);records[d.winner.key]={...r,duelWins:(r.duelWins||0)+1,duelStars:(r.duelStars||0)+d.combat.reward,earnedStardust:r.earnedStardust+d.combat.reward};save('codextown.adventure',records);renderLog();}
function drawDuelStats(d,t){if(!d.combat)return;const c=d.combat,values=d.playback?.hp||c.snapshots[Math.floor((c.snapshots.length-1)*(t<.96?0:t<1.9?.33:t<2.86?.66:1))];ctx.save();ctx.textAlign='center';ctx.font='10px sans-serif';for(let i=0;i<2;i++){const x=i?30:-160;ctx.fillStyle='#162726';ctx.fillRect(x,-71,130,5);ctx.fillStyle=i?'#caa7d9':'#a8d89b';ctx.fillRect(x,-71,130*values[i]/c.stats[i].hp,5);ctx.fillStyle='#e6ecda';ctx.fillText(`${values[i]} / ${c.stats[i].hp}`+(c.grades?' · '+c.grades[i]+'등급':''),x+65,-54);}ctx.restore();}
function defeat(a){const r=record(a);records[a.key]={...r,deaths:(r.deaths||0)+1,lossStreak:(r.lossStreak||0)+1};save('codextown.adventure',records);renderLog();}
const eligible=a=>avatars[a.key]===a&&!a.travelFrom&&!a.portal&&!a.route?.length&&!a.duel&&!window.townEvents?.busy(a)&&workerState(a)!=='done'&&!state.sessionInfo[a.key]?.needsInput&&performance.now()>=(rest.get(a.key)||0)&&displayedRooms.includes(ROOM_BY_ROLE[a.role]);
const weaponMastery=a=>{const wins=window.townUI?.winCount(a)||0;return wins>=25?3:wins>=10?2:wins>=3?1:0;};
const gear=a=>Math.max(weaponMastery(a),catalog.find(i=>i.id===equippedFor(a,'weapon'))?.rank||0);
const star=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,d=i%2?r*.3:r;ctx.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}ctx.closePath();ctx.fill();};
function reward(a,boss,stars=boss?10:1){const r=record(a);records[a.key]={...r,kills:r.kills+1,bosses:r.bosses+(boss?1:0),earnedStardust:r.earnedStardust+stars,lossStreak:0};save('codextown.adventure',records);renderLog();}
function cancel(){if(battle){battle.a.tx=battle.a.x;battle.a.ty=battle.a.y;rest.set(battle.a.key,performance.now()+20000);monsters.splice(monsters.indexOf(battle.m),1);}battle=null;nextSpawn=performance.now()+45000;}
const bossKinds=[
 {id:'ember',name:'잿불 마왕',idx:110,hp:370,attack:57,defense:10,crit:.18,speed:.38,size:2.5,color:'#ffae72',skill:'잿불 폭우'},
 {id:'frost',name:'서리 망령',idx:121,hp:390,attack:46,defense:19,crit:.15,speed:.32,size:2.3,color:'#a5e3ff',skill:'서리 파편'},
 {id:'storm',name:'폭풍 야수',idx:124,hp:345,attack:51,defense:11,crit:.32,speed:.52,size:2.4,color:'#ffe794',skill:'천둥 발톱'},
 {id:'moss',name:'이끼 군주',idx:108,hp:455,attack:47,defense:13,crit:.12,speed:.3,size:2.7,color:'#a8e39c',skill:'가시 정원'},
 {id:'dusk',name:'밤날개 군주',idx:122,hp:405,attack:52,defense:14,crit:.22,speed:.46,size:2.5,color:'#d6b0ff',skill:'달그림자 할퀴기'}
];
const monsterLevels=[
 {name:'꼬마 이끼',idx:108,hp:65,attack:12,defense:1,crit:.03,speed:.4,size:.9},
 {name:'길 잃은 유령',idx:121,hp:85,attack:15,defense:2,crit:.04,speed:.38,size:1},
 {name:'동굴 박쥐',idx:120,hp:110,attack:18,defense:3,crit:.06,speed:.7,size:1.1},
 {name:'들개 괴물',idx:123,hp:135,attack:22,defense:4,crit:.08,speed:.58,size:1.2},
 {name:'이끼 수호자',idx:108,hp:165,attack:26,defense:5,crit:.10,speed:.42,size:1.3},
 {name:'서고 망령',idx:121,hp:195,attack:30,defense:7,crit:.12,speed:.4,size:1.4},
 {name:'동굴 사냥꾼',idx:124,hp:225,attack:34,defense:9,crit:.14,speed:.6,size:1.5},
 {name:'붉은 송곳니',idx:123,hp:255,attack:38,defense:10,crit:.16,speed:.58,size:1.7},
 {name:'밤날개 파수꾼',idx:122,hp:290,attack:42,defense:12,crit:.18,speed:.5,size:1.9}
];
const eliteKinds=[
 {id:'eclipseLord',effect:'dusk',name:'월식의 군주',level:12,reward:24,idx:122,hp:580,attack:68,defense:20,crit:.16,speed:.45,size:2.8,color:'#d699ff',skill:'별을 가르는 날개'},
 {id:'stormTitan',effect:'storm',name:'폭풍 거수',level:14,reward:32,idx:124,hp:680,attack:74,defense:23,crit:.2,speed:.4,size:3,color:'#ffdb78',skill:'천둥 붕괴'},
 {id:'glacierKing',effect:'frost',name:'빙하의 망령왕',level:16,reward:40,idx:121,hp:800,attack:82,defense:26,crit:.24,speed:.32,size:3.2,color:'#99e3ff',skill:'영원의 빙결'}
];
let eliteIndex=0;
let bossBag=[],lastBoss='';
function nextBoss(){
 if(!bossBag.length){bossBag=bossKinds.slice();for(let i=bossBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bossBag[i],bossBag[j]]=[bossBag[j],bossBag[i]];}if(bossBag[0].id===lastBoss)[bossBag[0],bossBag[1]]=[bossBag[1],bossBag[0]];}
 const kind=bossBag.shift();lastBoss=kind.id;return kind;
}
function spawn(role,boss=false,elite=false){const room=ROOM_BY_ROLE[role];if(!room||monsters.filter(m=>m.role===role).length>=2)return null;
 boss=boss||elite;const kind=elite?eliteKinds[eliteIndex++%eliteKinds.length]:boss?nextBoss():null,level=elite?kind.level:boss?10:1+Math.floor(Math.random()*9),power=kind||monsterLevels[level-1];
 const m={role,gx:room.gx,gy:room.gy,x:room.gx+3.5,y:room.gy+4.4,boss,elite,kind,level,reward:kind?.reward||level,power,at:performance.now(),idx:power.idx,name:power.name};monsters.push(m);return m;}
function wander(m,now,dt){
 if(now<(m.pauseUntil||0))return;
 if(m.tx===undefined){m.tx=m.gx+1.35+Math.random()*4.3;m.ty=m.gy+2.75+Math.random()*2;}
 const dx=m.tx-m.x,dy=m.ty-m.y,d=Math.hypot(dx,dy),step=dt*(m.power?.speed??(m.boss?.38:.58));
 if(d<=step+.02){m.x=m.tx;m.y=m.ty;m.tx=undefined;m.pauseUntil=now+700+Math.random()*2200;}
 else{m.x+=dx/d*step;m.y+=dy/d*step;if(Math.abs(dx)>.02)m.face=dx>0?1:-1;}
}
function begin(a,m){if(battle||window.townEvents?.active||!eligible(a)||!monsters.includes(m)||a.role!==m.role||roomDuels.size)return false;
 const size=spriteScaleFor(a,layout.scale)/layout.scale,monsterSize=m.power.size;
 const stats=statsFor(a),maxHp=stats.hp,damage=stats.attack,monsterHp=m.power.hp,mercy=size<1.6&&(record(a).lossStreak||0)>=4;
 battle={a,m,size,monsterSize,stats,mercy,reward:m.reward??m.level,monsterAttack:m.power.attack,monsterDefense:m.power.defense,monsterCrit:m.power.crit,maxHp,hp:maxHp,monsterHp,maxMonsterHp:monsterHp,damage,start:performance.now(),next:performance.now()+1800,round:0,legendary:mercy||size<monsterSize&&Math.random()<.2,done:false};
 battle.element=elementFor(a)??nextElement();
 prepareBattleHit(battle,performance.now()+1100);m.encounterKey=null;m.encounterAt=0;
 chronicle?.see(m);clearDuelAftermath(a);a.tx=a.x;a.ty=a.y;a.roomAction=null;return true;}
function step(now){const dt=Math.min(.1,Math.max(0,(now-lastStep)/1000));lastStep=now;
 if(!enabled||window.townUI?.motionReduced){window.townEvents?.cancel();if(battle)cancel();monsters.length=0;nextSpawn=now+12000;return;}
 window.townEvents?.step(now);if(window.townEvents?.active)return;
 if(now>=nextAuto){nextAuto=now+4000;for(const a of Object.values(avatars))autoEquip(a);}
 for(let i=monsters.length-1;i>=0;i--){const m=monsters[i],r=ROOM_BY_ROLE[m.role];if(!displayedRooms.includes(r)||r.gx!==m.gx||r.gy!==m.gy||(now-m.at>180000&&battle?.m!==m)){if(battle?.m===m)cancel();else monsters.splice(i,1);}}
 for(const m of monsters)if(battle?.m!==m)wander(m,now,dt);
 if(battle){const b=battle;if(avatars[b.a.key]!==b.a||state.sessionInfo[b.a.key]?.needsInput||b.a.role!==b.m.role){cancel();return;}
  if(b.done){if(now-b.ended>(b.won?(b.legendary?5600:4600):2200)){rest.set(b.a.key,now+(b.won?45000:65000));if(b.won)monsters.splice(monsters.indexOf(b.m),1);else{b.m.pauseUntil=now+1500;b.a.summonAt=now;b.a.wanderAt=now+65000;}battle=null;nextSpawn=now+5000;const next=b.a.nextRole;b.a.nextRole=null;if(next&&next!==b.a.role)changeRoom(b.a,next);}return;}
  if(b.counterAt&&now>=b.counterAt){const hit=rollDamage(b.monsterAttack*(b.counterSpecial?3:1),b.stats.defense,b.monsterCrit);b.receivedSpecial=b.counterSpecial;b.receivedDamage=hit.damage;b.receivedCritical=hit.critical;b.hp=Math.max(b.legendary?1:0,b.hp-hit.damage);b.playerHitAt=now;b.counterAt=0;b.next=Math.max(b.next,now+(b.receivedSpecial?1510:760)+280+(b.windup||220));if(!b.hp){b.done=true;b.won=false;b.ended=now;chronicle?.result(b.m,false);defeat(b.a);}return;}
  if(now>=b.next){b.round++;b.hitAt=now;b.hitPlayer=false;const final=b.legendary&&b.round===2;const hit=b.nextHit;b.attackSkill=hit.skill&&!final;b.attackElement=hit.element??b.element;b.inflictedDamage=final?b.maxMonsterHp:hit.damage;b.dealtCritical=hit.critical&&!final;chronicle?.hit(b.m,Math.min(b.monsterHp,b.inflictedDamage));b.monsterHp=Math.max(0,b.monsterHp-b.inflictedDamage);
   if(b.monsterHp===0){if(hit.skill&&!final)b.element=hit.element;b.done=true;b.won=true;b.ended=now;const before=record(b.a),badge=b.m.boss&&!before.bosses?'보스 배지':before.kills===2?'별 장식':before.kills===9?'보라 별 장식':'';b.rewardLabel=`별가루 +${b.reward}`+(badge?' · '+badge:'');chronicle?.result(b.m,true);reward(b.a,b.m.boss,b.reward);}
   else{b.counterSpecial=Boolean(b.m.boss)&&Math.random()<.08;b.counterAt=now+(b.counterSpecial?2400:1200)+(b.attackSkill?900:0);b.counterStartedAt=b.counterAt-(b.counterSpecial?1400:200);prepareBattleHit(b,b.counterAt+(b.counterSpecial?1510:760));}
  }
 }else{
  const residents=Object.values(avatars).filter(eligible);
  const available=displayedRooms.filter(r=>r.role!=='done'&&monsters.filter(m=>m.role===r.role).length<2);
  if(now>=nextSpawn&&monsters.length<8&&available.length){const least=Math.min(...available.map(r=>monsters.filter(m=>m.role===r.role).length)),choices=available.filter(r=>monsters.filter(m=>m.role===r.role).length===least),room=choices[Math.floor(Math.random()*choices.length)];const boss=!monsters.some(m=>m.boss)&&Math.random()<.15;spawn(room.role,boss,boss&&Math.random()<.3);nextSpawn=now+(monsters.length<6?1200:12000+Math.random()*8000);}
  for(const m of monsters){if(now-m.at<1500)continue;const targets=residents.filter(a=>a.role===m.role);const a=targets.sort((a,b)=>Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y))[0];if(!a){m.encounterKey=null;m.encounterAt=0;continue;}
   const near=Math.hypot(a.x-m.x,a.y-m.y)<1.35;
   if(near){if(m.encounterKey!==a.key){m.encounterKey=a.key;m.encounterAt=now;}m.pauseUntil=now+150;a.tx=a.x;a.ty=a.y;if(now-m.encounterAt>=450&&begin(a,m))break;}else{m.encounterKey=null;m.encounterAt=0;}
  }
 }
}
function bossAura(kind,x,y,size,t){
 ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.fillStyle=kind.color;ctx.strokeStyle=kind.color;ctx.lineWidth=.025;
 if((kind.effect||kind.id)==='dusk'){
  for(const dir of [-1,1]){ctx.save();ctx.scale(dir,1);ctx.beginPath();ctx.moveTo(.18,-.65);ctx.quadraticCurveTo(.5,-1.05-Math.sin(t*4)*.1,.78,-.55);ctx.lineTo(.6,-.61);ctx.lineTo(.53,-.35);ctx.lineTo(.37,-.46);ctx.lineTo(.18,-.26);ctx.closePath();ctx.globalAlpha=.8;ctx.fillStyle='#8661b7';ctx.fill();ctx.stroke();ctx.restore();}
 }else if((kind.effect||kind.id)==='moss'){
  ctx.beginPath();ctx.ellipse(0,-.03,.55,.12,0,0,7);ctx.stroke();for(let i=0;i<5;i++){const a=-Math.PI+(i+1)*Math.PI/6;ctx.save();ctx.translate(Math.cos(a)*.35,-.84+Math.sin(a)*.2);ctx.rotate(a+.6);ctx.beginPath();ctx.ellipse(0,0,.09,.035,0,0,7);ctx.fill();ctx.restore();}
 }else if((kind.effect||kind.id)==='frost'){
  for(let i=0;i<5;i++){const a=t*.7+i*Math.PI*2/5,xx=Math.cos(a)*.57,yy=-.5+Math.sin(a)*.46;ctx.beginPath();ctx.moveTo(xx,yy-.1);ctx.lineTo(xx+.045,yy);ctx.lineTo(xx,yy+.1);ctx.lineTo(xx-.045,yy);ctx.closePath();ctx.fill();}
 }else if((kind.effect||kind.id)==='storm'){
  for(const dir of [-1,1]){const yy=Math.sin(t*7+dir)*.04;ctx.beginPath();ctx.moveTo(dir*.48,-.87+yy);ctx.lineTo(dir*.62,-.66+yy);ctx.lineTo(dir*.45,-.65+yy);ctx.lineTo(dir*.59,-.4+yy);ctx.stroke();}
 }else{
  for(let i=0;i<4;i++){const xx=(i%2?1:-1)*.43,yy=-.25-Math.floor(i/2)*.4,flame=.19+Math.sin(t*5+i)*.05;ctx.beginPath();ctx.moveTo(xx,yy-flame);ctx.quadraticCurveTo(xx-.14,yy+.08,xx,yy+.05);ctx.quadraticCurveTo(xx+.13,yy+.04,xx,yy-flame);ctx.fill();}
 }
 ctx.restore();
}
function monster(m,x,y,size,t,walking=true){ctx.save();if(window.townUI?.motionReduced)t=0;const hop=walking?Math.sin(t*3)*size*.035:0;ctx.fillStyle='#07120d80';ctx.beginPath();ctx.ellipse(x,y+3,size*.4,5,0,0,7);ctx.fill();
 if(m.elite){for(let i=0;i<3;i++)star(x+(i-1)*size*.25,y-size*(1.07+(i===1?.12:0)),Math.max(2,size*.05),m.kind.color);}
 if(m.boss){ctx.shadowColor=m.kind?.color||'#b77fd8';ctx.shadowBlur=size*.12;if(m.kind)bossAura(m.kind,x,y-hop,size,t);}drawTile(ctx,'dungeon',m.idx,x-size/2,y-size-hop,size/16);ctx.restore();}
function masonry(x,y,w,h,unit=18){ctx.fillStyle='#252c35';ctx.fillRect(x,y,w,h);ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();for(let row=0;row<Math.ceil(h/unit);row++)for(let col=-1;col<Math.ceil(w/(unit*1.7));col++){
 const xx=x+(col+(row%2)*.5)*unit*1.7,yy=y+row*unit;ctx.fillStyle=['#56606b','#636974','#4b5661'][(row+col+9)%3];ctx.fillRect(xx+1,yy+1,unit*1.7-2,unit-2);ctx.fillStyle='#7a818a';ctx.fillRect(xx+2,yy+2,unit*1.7-5,Math.max(1,unit*.12));ctx.fillStyle='#363f49';ctx.fillRect(xx+2,yy+unit-4,unit*1.7-4,2);
 }ctx.restore();}
function caveWalls(x,y,w,h,s){const p=16*s;masonry(x,y,w,p,s*8);masonry(x,y,p,h,s*8);masonry(x+w-p,y,p,h,s*8);masonry(x,y+h-p,w,p,s*8);}
function caveDoor(x,y,w,h,s,room){const p=16*s,cx=x+w/2,top=y+h-p*1.45,bottom=y+h;ctx.save();ctx.beginPath();ctx.moveTo(cx-p,bottom);ctx.lineTo(cx-p,top+p*.55);ctx.quadraticCurveTo(cx,top-p*.4,cx+p,top+p*.55);ctx.lineTo(cx+p,bottom);ctx.closePath();ctx.fillStyle='#080f15';ctx.fill();ctx.strokeStyle='#7a8085';ctx.lineWidth=3*s;ctx.stroke();ctx.clip();const leaf=p*(1-doorOpening(room));masonry(cx-p,top,leaf,p*1.5,4*s);masonry(cx+p-leaf,top,leaf,p*1.5,4*s);ctx.restore();}
function chamber(kind,width=380){
 const edge=width/2;
 ctx.fillStyle='#17202a';ctx.fillRect(-edge,-135,width,270);
 // Recessed arches, broken columns and a rune floor sit behind combatants.
 for(const x of [-113,70]){ctx.fillStyle='#0c121d';ctx.beginPath();ctx.moveTo(x-24,78);ctx.lineTo(x-24,-32);ctx.quadraticCurveTo(x+11,-86,x+46,-32);ctx.lineTo(x+46,78);ctx.fill();masonry(x-33,-33,12,119,12);masonry(x+44,-33,12,119,12);}
 ctx.fillStyle='#333841';ctx.fillRect(-edge+12,77,width-24,46);ctx.strokeStyle='#51565f';ctx.lineWidth=1;for(let y=79;y<123;y+=13){ctx.beginPath();ctx.moveTo(-edge+12,y);ctx.lineTo(edge-12,y);ctx.stroke();}
 ctx.strokeStyle=kind?.color||'#88759f';ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(0,99,117,15,0,0,7);ctx.stroke();ctx.beginPath();ctx.ellipse(0,99,89,10,0,0,7);ctx.stroke();ctx.globalAlpha=1;
 masonry(-edge,-135,width,14,12);masonry(-edge,121,width,14,12);masonry(-edge,-121,12,242,13);masonry(edge-12,-121,12,242,13);
 for(const x of [-edge+28,edge-34]){ctx.fillStyle='#41302b';ctx.fillRect(x,-37,6,23);star(x+3,-41,9,kind?.color||'#db9b65');star(x+3,-41,4,'#fff0b9');}
 for(const [x,y] of [[-174,109],[155,112],[-151,115]]){ctx.fillStyle='#687064';ctx.fillRect(x,y,11,5);ctx.fillStyle='#92a080';ctx.fillRect(x,y,7,2);}
}
function drawMap(){const P=TILE*layout.scale,t=performance.now()/1000;for(const m of monsters){
 const x=layout.offsetX+(m.x+.5)*P,y=layout.offsetY+(m.y+1)*P,color=m.kind?.color||(m.level>=7?'#d6b0ff':m.level>=4?'#a5d9ed':'#b4dbac');
 ctx.save();ctx.strokeStyle=color;ctx.lineWidth=layout.scale;ctx.beginPath();ctx.ellipse(x,y,P*.65,P*.18,0,0,7);ctx.stroke();monster(m,x,y,P*(m.elite?1.85:m.boss?1.5:.7+(m.level-1)*.055),t);
 const font=Math.max(8,7*layout.scale),label=m.elite?'E'+m.level:m.boss?'B10':'L'+m.level;ctx.font=`bold ${font}px sans-serif`;ctx.textAlign='center';const w=ctx.measureText(label).width+6;
 ctx.fillStyle='#101d22e6';ctx.fillRect(x-w/2,y+P*.15,w,font+4);ctx.fillStyle=color;ctx.fillText(label,x,y+P*.15+font+1);
 if(m.encounterKey&&!battle){ctx.font='bold 18px sans-serif';ctx.fillStyle='#ffe3a2';ctx.fillText('!',x,y-P*1.8);}ctx.restore();}}
function bar(x,y,value,max,color){ctx.fillStyle='#142726';ctx.fillRect(x,y,130,8);ctx.fillStyle=color;ctx.fillRect(x,y,130*Math.max(0,value/max),8);ctx.fillStyle='#e7edda';ctx.font='11px sans-serif';ctx.fillText(`${value} / ${max}`,x+65,y+22);}
function crescent(x,y,p){if(p<0||p>1)return;ctx.save();ctx.globalAlpha=1-p;ctx.translate(x,y-30);ctx.rotate(-.65);ctx.shadowColor='#d997ff';ctx.shadowBlur=14;ctx.fillStyle='#c48bee';ctx.beginPath();ctx.moveTo(-65,-20);ctx.quadraticCurveTo(0,55,65,-20);ctx.quadraticCurveTo(0,100,-65,-20);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff0c2';ctx.beginPath();ctx.moveTo(-65,-20);ctx.quadraticCurveTo(0,68,65,-20);ctx.quadraticCurveTo(0,86,-65,-20);ctx.fill();ctx.strokeStyle='#e6bbff';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,25,20+p*65,8+p*28,.25,0,7);ctx.stroke();for(let i=0;i<14;i++){const a=i*Math.PI/7,r=18+p*85;star(Math.cos(a)*r,25+Math.sin(a)*r*.6,3*(1-p),'#fff3c9');}ctx.restore();}
const finisherDuration=2.1;
const finishDuration=legendary=>legendary?3:finisherDuration;
// Finishers draw over the arena frame, with room for their arc, glow and particles.
function foregroundFinish(x,y,p,wanted=1.3,element=null){
 if(p<0||p>1)return;
 const m=ctx.getTransform(),pad=18*dpr,left=(pad-m.e)/m.a,right=(cv.width-pad-m.e)/m.a,top=(pad-m.f)/m.d,bottom=(cv.height-pad-m.f)/m.d;
 const bounds=element===null?[85,115,110,90]:[85,85,75,75];
 const scale=Math.min(wanted,(right-left)/(bounds[0]+bounds[1]),(bottom-top)/(bounds[2]+bounds[3]));
 if(scale<=0)return;
 const px=Math.max(left+bounds[0]*scale,Math.min(right-bounds[1]*scale,x)),py=Math.max(top+bounds[2]*scale,Math.min(bottom-bounds[3]*scale,y));
 ctx.save();ctx.translate(px,py);ctx.scale(scale,scale);if(element===null)crescent(0,0,p);else finisher(0,0,p,element);ctx.restore();
}
const finishFade=(age,legendary=false)=>Math.max(0,1-Math.max(0,age-.15)/(finishDuration(legendary)-.15));
const elements=['화염','번개','물','바람','안개'];
// Background-only anticipation: the same envelope carries into the impact, then clears.
function chargeAura(x,y,size,p,t,element,legendary=false){
 if(p<=0)return;const color=legendary?'#e6b8ff':['#ffbd76','#ffeb9c','#92dfff','#b8efcf','#d4c5f2'][element],reach=(legendary?95:65)+size*.2;
 ctx.save();ctx.translate(x,y-size*.38);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.3;ctx.shadowColor=color;ctx.shadowBlur=legendary?12:6;
 // Stars spiral inward, rather than bursting away before the actual hit.
 for(let i=0;i<(legendary?24:14);i++){const q=(t*.7+i*.071)%1,a=i*2.4+t*(legendary?2.3:1.5),r=reach*(1-q),xx=Math.cos(a)*r,yy=Math.sin(a)*r*.7;ctx.globalAlpha=p*q*.85;star(xx,yy,(legendary?3:2)*( .5+q),color);ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(Math.cos(a-.12)*(r+8),Math.sin(a-.12)*(r+8)*.7);ctx.stroke();}
 ctx.globalAlpha=p*.6;for(let i=0;i<2;i++){ctx.beginPath();ctx.ellipse(0,size*.4,reach*(.7-i*.2),10+i*4,-.1+i*.2,0,7);ctx.stroke();}
 ctx.globalAlpha=p*.3;const r=reach*(1-p*.8);ctx.beginPath();ctx.arc(0,0,r,t*2,t*2+Math.PI*1.7);ctx.stroke();
 if(legendary){for(let i=0;i<5;i++){const xx=(i-2)*28;ctx.globalAlpha=p*p*.14;ctx.fillRect(xx-2,-110,4,150);ctx.globalAlpha=p*.5;star(xx,-65+Math.sin(t*2+i)*12,3,'#fff0c4');}}
 ctx.restore();
}
function atmosphere(kind,p,t,width=380,floorY=99,legendary=false){
 if(p<=0)return;p=Math.min(1,p);const edge=width/2-14,top=-59,colors=['#ff9956','#ffe38c','#79dafa','#b0e6bc','#c4b9ed'],color=legendary?'#cca4ff':colors[kind];
 ctx.save();ctx.beginPath();ctx.rect(-edge,top,edge*2,floorY-top+4);ctx.clip();
 ctx.globalAlpha=p*.42;ctx.fillStyle=['#3e161a','#141a3e','#102d46','#15342d','#27243e'][kind];ctx.fillRect(-edge,top,edge*2,floorY-top+4);
 ctx.globalAlpha=p*.7;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.8;
 const line=(points)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
 if(kind===0){
  for(let i=0;i<11;i++){const x=-edge+12+i*(edge*2-24)/10,h=(18+p*38)*( .65+.35*Math.sin(t*4+i*1.7));ctx.globalAlpha=p*.38;ctx.fillStyle=i%2?'#ffbb68':'#ee774d';ctx.beginPath();ctx.moveTo(x-13,floorY);ctx.quadraticCurveTo(x-17,floorY-h*.4,x+Math.sin(t*3+i)*6,floorY-h);ctx.quadraticCurveTo(x+17,floorY-h*.25,x+13,floorY);ctx.fill();}
  ctx.globalAlpha=p*.8;for(let i=0;i<16;i++){const q=(t*.35+i*.061)%1;ctx.fillStyle=i%2?'#ffd58c':'#ff9672';ctx.fillRect(-edge+((i*83)%(edge*2)),floorY-q*130,2,3);}
 }else if(kind===1){
  for(let i=0;i<4;i++){const x=(i<2?-1:1)*(edge-20-(i%2)*48),pulse=.25+.75*Math.pow(.5+.5*Math.sin(t*6+i*1.9),4);ctx.globalAlpha=p*pulse;ctx.lineWidth=2.2;line([[x,top+3],[x-10,top+30],[x+5,top+26],[x-12,top+65],[x,top+60],[x-15,floorY-12]]);ctx.globalAlpha=p*.5;line([[x-10,top+30],[x-27,top+46],[x-22,top+62]]);}
  ctx.globalAlpha=p*.45;for(let i=0;i<8;i++){const x=-edge+20+i*(edge*2-40)/7,y=floorY-4-Math.sin(t*5+i)*3;line([[x-9,y],[x,y-4],[x+7,y+2]]);}
 }else if(kind===2){
  for(let j=0;j<4;j++){ctx.globalAlpha=p*(.18+j*.08);ctx.lineWidth=2+j*.4;ctx.beginPath();for(let x=-edge;x<=edge;x+=5){const y=floorY-5-j*8+Math.sin(x*.035-t*2+j)* (4+p*6);x===-edge?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}
  for(let i=0;i<10;i++){const q=(t*.2+i*.1)%1;ctx.globalAlpha=p*(1-q)*.5;ctx.beginPath();ctx.arc(-edge+20+(i*61)%(edge*2-40),floorY-q*115,2+i%3,0,7);ctx.stroke();}
 }else if(kind===3){
  for(let i=0;i<6;i++){const q=(t*.22+i/6)%1;ctx.globalAlpha=p*Math.sin(q*Math.PI)*.55;ctx.lineWidth=1+i%2;ctx.beginPath();ctx.ellipse(0,floorY-8-q*100,edge*(.7+q*.2),8+q*10,-.08,Math.PI*.12,Math.PI*1.87);ctx.stroke();}
  for(let i=0;i<10;i++){const q=(t*.3+i*.1)%1,x=-edge+q*edge*2,y=floorY-12-i*10+Math.sin(q*5+i)*5;ctx.globalAlpha=p*.65;ctx.save();ctx.translate(x,y);ctx.rotate(q*5);ctx.beginPath();ctx.ellipse(0,0,4,1.5,0,0,7);ctx.fill();ctx.restore();}
 }else{
  for(let i=0;i<7;i++){const x=Math.sin(t*.45+i*1.2)*edge*.7,y=floorY-10-i*17;ctx.globalAlpha=p*(.1+(i%2)*.03);ctx.beginPath();ctx.ellipse(x,y,edge*.65,12+Math.sin(t+i)*4,-.06,0,7);ctx.fill();}
  ctx.globalAlpha=p*.45;for(let i=0;i<10;i++){const q=(t*.18+i*.1)%1;star(-edge+20+(i*71)%(edge*2-40),floorY-q*130,1.5,color);}
 }
 // The floor seal brightens without covering faces or the health bars.
 ctx.globalAlpha=p*.6;ctx.strokeStyle=color;ctx.lineWidth=1+p;ctx.beginPath();ctx.ellipse(0,floorY-2,90+p*25,9+p*4,0,0,7);ctx.stroke();
 if(legendary){ctx.globalAlpha=p*.75;for(let i=0;i<7;i++){const a=t*.6+i*Math.PI*2/7;star(Math.cos(a)*125,floorY-50+Math.sin(a)*42,2+p*2,'#f0d8ff');}}
 ctx.restore();
}
function finisher(x,y,p,key){
 if(p<0||p>1)return;
 const kind=((typeof key==='number'?key:hashSeed(key))%5+5)%5,colors=['#ffac45','#ffe786','#5abde9','#a9e3b1','#dedee9'];
 const clamp=n=>Math.max(0,Math.min(1,n)),phase=(start,length)=>clamp((p-start)/length),fade=Math.min(1,(1-p)/.22);
 ctx.save();ctx.translate(x,y);ctx.globalAlpha*=fade;const opacity=ctx.globalAlpha;
 ctx.shadowColor=colors[kind];ctx.shadowBlur=5;ctx.lineCap='round';ctx.lineJoin='round';
 const stroke=(points,color,width,alpha=1)=>{ctx.globalAlpha=opacity*alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([xx,yy],i)=>i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy));ctx.stroke();};
 if(kind===0){
  // The ground splits first; a tall flame column erupts through the target and sheds embers.
  const rise=phase(0,.26),burst=phase(.2,.5),height=24+rise*80;
  ctx.strokeStyle='#ff7653';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,43,22+burst*37,4+burst*7,0,0,7);ctx.stroke();
  for(const [offset,width,ratio,color] of [[-23,17,.77,'#ef6745'],[24,16,.66,'#ff8d42'],[0,27,1,'#ffad46'],[0,12,.84,'#fff0bd']]){
   ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(offset-width,45);ctx.quadraticCurveTo(offset-width*1.3,12,offset+6*Math.sin(p*7+offset),45-height*ratio);ctx.quadraticCurveTo(offset+width*.15,4,offset+width,45);ctx.closePath();ctx.fill();
  }
  for(let i=0;i<12;i++){const a=i*2.4,q=(burst+i*.071)%1,xx=Math.sin(a)*(15+q*47),yy=34-q*91;ctx.globalAlpha=opacity*(1-q)*.9;ctx.fillStyle=i%2?'#fff0b2':'#ff8654';ctx.fillRect(xx,yy,2+i%2,5-q*3);}
 }else if(kind===1){
  // Separate forked strikes converge, followed by a thick, sustained finishing bolt.
  for(let i=0;i<3;i++){const q=phase(i*.13,.25);if(p<i*.13)continue;const xx=(i-1)*31,alpha=Math.max(.12,1-q*.86);
   stroke([[xx-9,-57],[xx+3,-29],[xx-7,-22],[xx+12,4],[xx-1,7],[xx+8,34]],'#f3bc4e',3.5,alpha);
   stroke([[xx+12,4],[xx+25,-5],[xx+20,-20]],'#fff2b5',1.5,alpha);
  }
  const strike=phase(.32,.18),power=p<.32?.26:1;
  stroke([[8,-59],[-12,-22],[7,-27],[-9,8],[14,1],[-4,49]],'#efb241',6+strike*6,power);
  stroke([[8,-59],[-12,-22],[7,-27],[-9,8],[14,1],[-4,49]],'#fffde6',2+strike*2,power);
  for(const dir of [-1,1])stroke([[0,11],[dir*24,0],[dir*20,17],[dir*52,7]],'#ffe898',2.5,power*.8);
  ctx.globalAlpha=opacity*power;ctx.strokeStyle='#ffeaa2';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(-4,49,15+strike*31,5+strike*3,0,0,7);ctx.stroke();
 }else if(kind===2){
  // Opposing waves curl around the body, then meet in an upward geyser.
  const wrap=phase(0,.42),jet=phase(.32,.28),tail=phase(.6,.4);
  for(const dir of [-1,1]){ctx.save();ctx.scale(dir,1);ctx.globalAlpha=opacity*(1-tail*.65);ctx.fillStyle='#3a9bd9';ctx.beginPath();ctx.moveTo(-60,30);ctx.bezierCurveTo(-65,-18,-36,-54,9,-33-wrap*12);ctx.bezierCurveTo(-21,-33,-35,-4,-19,17);ctx.quadraticCurveTo(8,36,27,28);ctx.quadraticCurveTo(-4,55,-60,30);ctx.fill();ctx.strokeStyle='#d6faff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-57,20);ctx.bezierCurveTo(-58,-13,-34,-42,3,-39);ctx.stroke();ctx.restore();}
  if(jet){ctx.globalAlpha=opacity;ctx.fillStyle='#80def1';ctx.beginPath();ctx.moveTo(-18,45);ctx.quadraticCurveTo(-9,3,-20,45-jet*99);ctx.lineTo(-3,45-jet*80);ctx.lineTo(9,45-jet*105);ctx.quadraticCurveTo(3,4,20,45);ctx.closePath();ctx.fill();stroke([[0,40],[1,0],[7,45-jet*96]],'#efffff',3);}
  for(let i=0;i<10;i++){const a=i*Math.PI/5,q=phase(.15+i%3*.04,.65),xx=Math.cos(a)*(25+q*33),yy=8+Math.sin(a)*q*45;ctx.globalAlpha=opacity*(1-q*.5);ctx.fillStyle='#bbf5ff';ctx.beginPath();ctx.ellipse(xx,yy,2,4,a,0,7);ctx.fill();}
 }else if(kind===3){
  // Three broad wind blades cross from different directions, leaving a rotating wake.
  for(let i=0;i<3;i++){const start=i*.14,q=phase(start,.4);if(p<start)continue;const angle=[-.62,.62,0][i],travel=-14+q*28;
   ctx.save();ctx.rotate(angle);ctx.translate(0,travel);ctx.globalAlpha=opacity*Math.max(.18,1-q*.7);ctx.fillStyle='#8acdb0';ctx.beginPath();ctx.moveTo(-59,-5);ctx.quadraticCurveTo(0,-18,59,-4);ctx.lineTo(24,5);ctx.quadraticCurveTo(-12,10,-59,-5);ctx.fill();ctx.strokeStyle='#f0ffe2';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-56,-4);ctx.quadraticCurveTo(0,-12,57,-4);ctx.stroke();ctx.restore();
  }
  const wake=phase(.3,.65);ctx.globalAlpha=opacity*.5;ctx.strokeStyle='#c9f3d1';ctx.lineWidth=2;
  for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,4,38+9*i,10+4*i,-.2+wake*.4,i*2+wake*3,i*2+wake*3+2);ctx.stroke();}
  for(let i=0;i<7;i++){const a=i*2.4+wake*2;ctx.save();ctx.translate(Math.cos(a)*(30+wake*28),Math.sin(a)*(20+wake*22));ctx.rotate(a);ctx.fillStyle='#dbffd8';ctx.beginPath();ctx.ellipse(0,0,4,1.5,0,0,7);ctx.fill();ctx.restore();}
 }else{
  // Mist conceals the first cut; delayed narrow cuts appear on the target from opposing angles.
  for(let i=0;i<4;i++){ctx.globalAlpha=opacity*.13;ctx.fillStyle=i%2?'#c1addf':'#edf0ff';ctx.beginPath();ctx.ellipse(Math.sin(p*3+i)*8,(i-1.5)*16,57,12+i%2*3,0,0,7);ctx.fill();}
  for(let i=0;i<4;i++){const start=[0,.2,.39,.56][i];if(p<start)continue;const q=phase(start,.36),angle=[-.58,.55,-.12,1.04][i];ctx.save();ctx.rotate(angle);ctx.translate(0,(i-1.5)*5);ctx.globalAlpha=opacity*Math.max(.18,1-q*.65);ctx.fillStyle='#a89dcc';ctx.beginPath();ctx.moveTo(-57,-2);ctx.lineTo(49,-5);ctx.lineTo(60,1);ctx.lineTo(-39,4);ctx.closePath();ctx.fill();stroke([[-56,-1],[57,0]],'#f5f0ff',i===3?3:1.7,Math.max(.22,1-q*.6));ctx.restore();}
  const linger=phase(.56,.4);for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.globalAlpha=opacity*(.65-linger*.3);ctx.fillStyle='#eee2ff';ctx.fillRect(Math.cos(a)*(18+linger*35),Math.sin(a)*(14+linger*28),2,2);}
 }
 ctx.restore();
}
// Both sides use the same damage-to-radius curve; finishers add trails, not arbitrary size.
const impactScale=damage=>Math.max(.35,Math.min(1.7,Math.sqrt(Math.max(0,damage)/30)));
function impact(x,y,p,damage,color='#ffe0a1'){
 if(p<0||p>1)return;const k=impactScale(damage);ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.globalAlpha=1-p;
 star(0,0,18*(1-p*.5),color);star(0,0,8*(1-p),'#fff7df');
 ctx.strokeStyle=color;ctx.lineWidth=2;for(let i=0;i<6;i++){const a=i*Math.PI/3,r=9+p*26;ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(a)*(r+6),Math.sin(a)*(r+6));ctx.stroke();}ctx.restore();}
const bossSpecialName=kind=>({ember:'멸겁의 화염비',frost:'절대영도',storm:'천벌의 뇌격',moss:'대지의 분노',dusk:'월식의 심판',eclipseLord:'영원의 월식',stormTitan:'하늘을 찢는 천벌',glacierKing:'빙하의 종말'})[kind.id]||kind.skill;
function bossSpecialStrike(kind,x,y,p,damage,width){
 if(p<0||p>=1)return;
 ctx.save();ctx.beginPath();ctx.rect(-width/2+14,-60,width-28,171);ctx.clip();
 // A quick expanding hit, then a longer afterglow, centered on the resident.
 const burst=Math.min(1,p/.16),fade=1-p;
 ctx.globalAlpha=fade*.24;ctx.fillStyle=kind.color;ctx.fillRect(-width/2+14,-60,width-28,171);
 ctx.globalAlpha=fade;ctx.strokeStyle=kind.color;ctx.shadowColor=kind.color;ctx.shadowBlur=18;ctx.lineWidth=3;
 for(let i=0;i<2;i++){ctx.beginPath();ctx.ellipse(x,y,12+burst*(58+i*19)+p*22,8+burst*(31+i*13),-.3,0,Math.PI*2);ctx.stroke();}
 ctx.translate(x,y);ctx.scale(1.3+burst*.25,1.3+burst*.25);
 bossStrike(kind,0,0,p,damage);
 ctx.strokeStyle=kind.color;ctx.lineWidth=2;ctx.globalAlpha=fade;
 for(let i=0;i<12;i++){const a=i*Math.PI/6,r=20+burst*36+p*22;ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r*.7);ctx.lineTo(Math.cos(a)*(r+12),Math.sin(a)*(r+12)*.7);ctx.stroke();}
 star(0,0,22*(1-burst*.6)*fade,'#fff5db');ctx.restore();
}
function bossStrike(kind,x,y,p,damage){
 if(p<0||p>1)return;const scale=impactScale(damage);ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=1-p;ctx.fillStyle=kind.color;ctx.strokeStyle=kind.color;ctx.lineWidth=2.5;ctx.shadowColor=kind.color;ctx.shadowBlur=7;
 if((kind.effect||kind.id)==='dusk'){
  for(let i=0;i<3;i++){const dx=(i-1)*14;ctx.beginPath();ctx.moveTo(dx+23,-35);ctx.quadraticCurveTo(dx-12,0,dx-23,32+p*10);ctx.stroke();}
 }else if((kind.effect||kind.id)==='storm'){
  for(let i=0;i<3;i++){const dx=(i-1)*20;ctx.beginPath();ctx.moveTo(dx+10,-48);ctx.lineTo(dx-5,-16);ctx.lineTo(dx+9,-20);ctx.lineTo(dx-11,17);ctx.lineTo(dx+4,12);ctx.lineTo(dx-5,39);ctx.stroke();}
 }else if((kind.effect||kind.id)==='moss'){
  for(let i=0;i<5;i++){const xx=(i-2)*14,h=22+Math.sin(i*2)*10;ctx.beginPath();ctx.moveTo(xx-7,29);ctx.quadraticCurveTo(xx+5,14,xx+(i-2)*4,-h);ctx.quadraticCurveTo(xx+15,16,xx+7,29);ctx.fill();}
 }else{
  for(let i=0;i<6;i++){const a=i*Math.PI/3,r=12+p*24,xx=Math.cos(a)*r,yy=Math.sin(a)*r;ctx.save();ctx.translate(xx,yy);
   if((kind.effect||kind.id)==='ember'){ctx.beginPath();ctx.moveTo(0,-20);ctx.quadraticCurveTo(-17,9,0,13);ctx.quadraticCurveTo(15,5,0,-20);ctx.fill();}
   else{ctx.rotate(a);ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(0,-5);ctx.lineTo(14,0);ctx.lineTo(0,5);ctx.closePath();ctx.fill();}ctx.restore();}
 }
 ctx.restore();
}
function battleMotion(b,now,as,ms){
 const smooth=value=>{const p=Math.max(0,Math.min(1,value));return p*p*(3-2*p);};
 const age=(now-(b.hitAt??-1e8))/1000,received=(now-(b.playerHitAt??-1e8))/1000;
 const impulse=t=>t<0||t>1?0:(1-Math.exp(-t/0.025))*Math.exp(-t/.2)*1.5;
 const chargedAttack=b.finishing||b.nextHit?.skill,arrive=b.next-(chargedAttack?80:(b.windup||220)),depart=Math.max(chargedAttack?b.next-280:arrive-280,(b.playerHitAt??-1e8)+(b.receivedSpecial?1250:700));
 const approach=!b.done&&!b.counterAt&&arrive>depart?smooth((now-depart)/(arrive-depart)):0;
 const held=b.done&&b.won?finishDuration(b.legendary):b.attackSkill?skillDuration:.5,returning=age>=0&&age<held+.26?1-smooth((age-held)/.26):0;
 const bossArrival=b.counterAt-(b.counterSpecial?1400:200),bossApproach=b.counterAt?smooth((now-(bossArrival-220))/220):0;
 const bossHold=b.receivedSpecial?1.25:.5,bossReturn=received>=0&&received<bossHold+.26?1-smooth((received-bossHold)/.26):0;
 const playerPush=impulse(received),bossPush=impulse(age),playerContact=85-(ms*.4+as*.35+22),bossContact=-83+(as+ms)*.46+6;
 const preSwing=!b.done&&approach===1?smooth(1-(b.next-now)/(chargedAttack?80:120)):0;
 const swing=age>=0&&age<.5?age<.08?1.45+.5*smooth(age/.08):1.95-1.47*smooth((age-.08)/.42):.48+.97*preSwing;
 return {px:-83+(playerContact+83)*Math.max(approach,returning)-playerPush*(b.receivedSpecial?28:18),mx:85+(bossContact-85)*Math.max(bossApproach,bossReturn)+bossPush*9,swing,approach,bossApproach,playerPush,bossPush,bossMoving:bossApproach>0&&bossApproach<1||bossReturn>0&&bossReturn<1,playerHop:Math.sin(approach*Math.PI)*Math.abs(Math.sin(approach*Math.PI*2))*Math.min(3,as*.04),bossHop:Math.sin(bossApproach*Math.PI)*Math.min(4,ms*.04)};
}
function drawBattle(){if(!battle)return;const b=battle,now=performance.now(),t=(now-b.start)/1000,age=(now-(b.hitAt||-1e8))/1000,charge=!b.done&&!b.counterAt&&b.finishing&&now>=b.next-280-(b.windup||3000)&&now<b.next-280,chargedMove=!b.done&&!b.counterAt&&(b.finishing||b.nextHit?.skill)&&now>=b.next-280&&now<b.next;
 const skillCharge=!b.done&&!b.counterAt&&!b.finishing&&b.nextHit?.skill&&now>=b.next-280-(b.windup||1200)&&now<b.next-280,cast=skillCharge?Math.max(0,Math.min(1,1-(b.next-280-now)/(b.windup||1200))):0,skillImpact=!b.done&&b.attackSkill&&age>=0&&age<skillDuration;
 const specialCharge=b.counterAt&&b.counterSpecial?Math.max(0,Math.min(1,(now-b.counterStartedAt)/1400)):0;
 const specialHit=b.receivedSpecial?Math.max(0,1-(now-(b.playerHitAt||-1e8))/1250):0;
 const bossMood=Math.max(specialCharge,specialHit),bossElement=({ember:0,storm:1,frost:2,moss:3,dusk:4})[b.m.kind?.effect||b.m.kind?.id]??4;
 const specialName=b.m.kind?bossSpecialName(b.m.kind):'';
 const width=cv.width/dpr-24,height=cv.height/dpr-24;if(width<=0||height<=0)return;
 const arenaWidth=Math.min(520,Math.max(380,width/height*270)),scale=Math.min(1.8,width/arenaWidth,height/270);
 const mood=chargedMove?1:charge?Math.min(1,Math.max(0,1-(b.next-280-now)/(b.windup||3000))):b.done&&b.won?finishFade(age,b.legendary):skillCharge?cast*.65:skillImpact?(1-age/skillDuration)*.6:0;
 ctx.save();ctx.fillStyle=`rgba(4,8,16,${.55+Math.max(mood,bossMood)*.25})`;ctx.fillRect(0,0,cv.width,cv.height);ctx.translate(cv.width/2,cv.height/2);ctx.scale(dpr*scale,dpr*scale);
 chamber(b.m.kind,arenaWidth);
 ctx.fillStyle=`rgba(2,4,12,${mood*.42})`;ctx.fillRect(-arenaWidth/2+14,-60,arenaWidth-28,181);
 atmosphere(bossMood?bossElement:skillCharge||chargedMove&&!b.finishing?b.nextHit.element:skillImpact?b.attackElement:b.element,Math.max(mood,bossMood),t,arenaWidth,99,b.legendary&&!bossMood&&!skillCharge&&!skillImpact&&(!chargedMove||b.finishing));ctx.textAlign='center';ctx.font='600 14px sans-serif';ctx.fillStyle='#e7edda';ctx.fillText(`${b.m.name} · ${b.m.level}단계`+(b.m.elite?' 정예 보스':b.m.boss?' 보스':''),0,-111);
 ctx.font='11px sans-serif';ctx.fillText('주민 · 토큰 체력',-95,-95);ctx.fillText(`처치 보상 · ✦ ${b.reward}`,95,-95);
 bar(-160,-89,b.hp,b.maxHp,'#a8d89b');bar(30,-89,b.monsterHp,b.maxMonsterHp,b.m.kind?.color||'#dba0ca');

 const unit=96/Math.max(b.size,b.monsterSize),as=b.size*unit,ms=b.monsterSize*unit,hit=Math.max(0,1-Math.max(0,age)/(b.done&&b.won?1.2:.5)),counter=Math.max(0,1-(now-(b.playerHitAt||-1e8))/(b.receivedSpecial?1250:700));
 const motion=battleMotion(b,now,as,ms),{px,mx}=motion,preCounter=motion.bossApproach,windup=motion.approach,playerY=87-motion.playerHop;
 const legendAmount=b.legendary?(charge||chargedMove&&b.finishing?Math.min(1,mood*1.35):b.done&&b.won?Math.max(0,1-Math.max(0,age-1.5)/1.4):0):0;
 if(specialCharge){ctx.save();ctx.beginPath();ctx.rect(-arenaWidth/2+14,-60,arenaWidth-28,171);ctx.clip();chargeAura(mx,87,ms,specialCharge,t,bossElement);ctx.restore();}
 if(charge){ctx.save();ctx.beginPath();ctx.rect(-arenaWidth/2+14,-60,arenaWidth-28,171);ctx.clip();chargeAura(px,87,as,mood,t,b.element,b.legendary);ctx.restore();}
 if(skillCharge)chargeAura(px,playerY,as,cast,t,b.nextHit.element,false);
 if(chargedMove)chargeAura(px,playerY,as,1,t,b.finishing?b.element:b.nextHit.element,b.legendary&&b.finishing);
 const defeated=b.done&&!b.won,fall=defeated?Math.max(0,Math.min(1,(now-b.playerHitAt-(b.receivedSpecial?1250:700))/500)):0,fallEase=fall*fall*(3-2*fall);
 const bodyPose={angle:fall>0?-.9*fallEase:counter?-.18*counter:charge?Math.sin(t*16)*.05:0,alpha:defeated?1:counter>.1?.65+.35*Math.abs(Math.sin(counter*24)):1};
 ctx.save();applyBattlePose(ctx,px,playerY,bodyPose);drawTile(ctx,'dungeon',b.a.idx,px-as/2,playerY-as,as/16);ctx.restore();
 drawOutfit(ctx,b.a,px,playerY,as,t,false,undefined,1,arenaWidth/2-20,bodyPose);
 const finishAge=b.done&&b.won?(now-b.ended)/1000:-1;
 const monsterFall=finishAge>=0?Math.max(0,Math.min(1,(finishAge-finishDuration(b.legendary))/.8)):0,monsterEase=monsterFall*monsterFall*(3-2*monsterFall);
 ctx.save();if(monsterFall>0)applyBattlePose(ctx,mx,87,{angle:.9*monsterEase,squash:1-.45*monsterEase,alpha:1-monsterFall});monster(b.m,mx,87-motion.bossHop-motion.bossPush*3,ms,t,motion.bossMoving);ctx.restore();
 const swing=motion.swing;
 equipment(b.a,px,playerY,as,{sword:swing,trail:hit},1,legendAmount>0,b.size<b.monsterSize,legendAmount,bodyPose);
 if(finishAge>=0&&finishAge<finishDuration(b.legendary)){ctx.save();ctx.globalAlpha=finishFade(finishAge,b.legendary);for(let i=0;i<18;i++){const a=i*2.4,r=finishAge*43;star(mx+Math.cos(a)*r,87-ms*.5+Math.sin(a)*r-finishAge*12,i%3?2:4,'#e6c8ff');}ctx.restore();}
 if(charge){ctx.save();ctx.globalAlpha=.65;for(let i=0;i<8;i++){const a=i*Math.PI/4+t*3,r=18+((b.next-now)/1000%1)*28;star(px+Math.cos(a)*r,87-as*.5+Math.sin(a)*r,2,'#ffe4ad');}ctx.restore();}


 if(b.done&&b.won){star(px,87-as-12,7,'#ffe19b');}
 if(b.m.kind&&preCounter>0)star(mx,87-ms*.5,4+preCounter*9,b.m.kind.color);
 if(specialHit)bossSpecialStrike(b.m.kind,px,87-as*.5,1-specialHit,b.receivedDamage,arenaWidth);
 if(counter>0){if(b.m.kind&&!b.receivedSpecial)bossStrike(b.m.kind,px,87-as*.5,1-counter,b.receivedDamage);impact(px,87-as*.5,1-counter,b.receivedDamage,b.m.kind?.color||'#ffba98');ctx.fillStyle='#ffb8a7';ctx.font='bold 18px sans-serif';ctx.fillText((b.receivedSpecial?'필살! ':'')+(b.receivedCritical?'치명타! ':'')+'−'+b.receivedDamage,px,65-as-(1-counter)*28);}
 if(age>=0&&age<(b.done&&b.won?finishDuration(b.legendary):1.2)){
  const k=impactScale(b.inflictedDamage||b.damage)*(b.done&&b.won?2:1);
  if(b.legendary&&b.done&&b.won)foregroundFinish(mx,87-ms*.45,age/finishDuration(true),k);
  else if(b.done&&b.won)foregroundFinish(mx,87-ms*.45,age/finisherDuration,k,b.element);
  if(!b.done&&!b.attackSkill)impact(mx,87-ms*.45,age/.5,b.inflictedDamage||b.damage);
 }
 if(skillImpact)foregroundFinish(mx,87-ms*.45,age/skillDuration,1.1,b.attackElement);
 if(skillCharge||skillImpact||chargedMove&&!b.finishing){ctx.fillStyle='#d8edfa';ctx.font='bold 13px sans-serif';ctx.fillText(elements[skillCharge||chargedMove?b.nextHit.element:b.attackElement]+(skillCharge?' 기술 · 힘을 모으는 중':chargedMove?' 기술 · 돌진!':' 기술!'),0,-39);}
 if(age>=0&&age<.9){ctx.fillStyle=b.dealtCritical?'#ffe190':'#e4eddf';ctx.font=b.dealtCritical?'bold 17px sans-serif':'13px sans-serif';ctx.fillText((b.dealtCritical?'치명타! ':'')+'−'+b.inflictedDamage,mx,70-ms*.6-age*20);}
 const lootAt=finishDuration(b.legendary)+.55;
 if(finishAge>=lootAt){const q=Math.min(1,(finishAge-lootAt)/2.5),fly=Math.max(0,(q-.5)*2),ix=85+(-83-85)*fly,iy=35-Math.sin(q*Math.PI)*53+fly*30;
  ctx.save();ctx.globalAlpha=q>.9?(1-q)*10:1;ctx.shadowColor='#ffe4a5';ctx.shadowBlur=14;star(ix,iy,8+b.reward*.8,b.m.boss?'#efb4ed':'#ffe0a0');ctx.shadowBlur=0;star(ix,iy,5,'#fff8df');ctx.textAlign='center';ctx.font='600 14px sans-serif';ctx.fillStyle='#ffe5ab';ctx.fillText(b.rewardLabel+' 획득!',0,-38);ctx.restore();}
 if(bossMood){ctx.fillStyle=b.m.kind.color;ctx.font='bold 15px sans-serif';ctx.fillText('필살기 · '+specialName,0,-48);}
 ctx.fillStyle='#e8dfba';ctx.font='12px sans-serif';ctx.fillText(specialCharge?'위험! '+specialName+' · 힘을 모으는 중…':specialHit?specialName+'!':b.done?(b.won?elements[b.element]+` 일격! 별가루 +${b.reward}`:'쓰러졌어요… 잠시 쉬고 다시 도전해요'):chargedMove?'힘을 모았어요 · 돌진!':charge?(b.legendary?(b.mercy?'불굴의 전설검 · 이번엔 이길 거야!':mood<.4?'전설검 · 별들이 모여요…':mood<.8?'전설검 각성 · 검이 깨어나요!':'하늘을 가르는 일격 · 준비!'):elements[b.element]+' 일격 · 힘을 모으는 중…'):b.m.kind&&(b.counterAt||counter>0)?b.m.kind.skill+'!':`${b.round+1}번째 공방`,0,116);
 if(b.m.boss&&t<1.1){const ease=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);},opacity=t<.15?ease(t/.15):1-ease((t-.8)/.3);ctx.save();ctx.globalAlpha*=opacity;const shift=(1-ease(t/.35))*arenaWidth;ctx.fillStyle='#111725ed';ctx.fillRect(-arenaWidth/2+12,-36,arenaWidth-24,83);ctx.fillStyle=b.m.kind?.color||'#d6b0ff';ctx.fillRect(-arenaWidth/2+12+shift,-36,Math.max(0,arenaWidth-24-shift),3);ctx.textAlign='center';ctx.font='900 34px sans-serif';ctx.fillText(b.m.elite?'ELITE BOSS':'BOSS',0,2);ctx.font='13px sans-serif';ctx.fillStyle='#f3e6d2';ctx.fillText(b.m.name,0,29);ctx.restore();}

 ctx.restore();}
const legendaryLength=size=>Math.min(155,Math.max(95,size*2.7));
function equipment(a,x,y,size,pose,face,legendary=false,shield=false,legendAmount=1,bodyPose=null){ctx.save();if(bodyPose)applyBattlePose(ctx,x,y,{...bodyPose,face:1});ctx.translate(x,y);ctx.scale(face,1);
 const item=catalog.find(i=>i.id===equippedFor(a,'weapon')),angle=Math.max(.48,Math.min(1.95,pose.sword??.48)),palmX=size*.42,palmY=-size*.22,grip=size*(item&&!legendary?.045:.11),handX=palmX+Math.sin(angle)*grip,handY=palmY-Math.cos(angle)*grip,t=performance.now()/1000;
 const length=legendary?size*.78+(legendaryLength(size)-size*.78)*legendAmount:item?Math.min(112,size*.82*(gear(a)>=3?1.26:gear(a)>=2?1.12:1.04))*.85:size*.78;
 const alpha=ctx.globalAlpha,trail=Math.max(0,Math.min(1,pose.trail??pose.flash??0));
 if(trail>0&&angle>.5){ctx.save();ctx.translate(handX,handY);ctx.globalAlpha=alpha*trail*.4;ctx.strokeStyle=legendary?'#d9a5ff':item?.id==='astral'?'#ffc681':'#bce8f5';ctx.lineWidth=Math.max(3,size*.09);ctx.beginPath();ctx.arc(0,0,length,Math.max(.48,angle-1.25)-Math.PI/2,angle-Math.PI/2);ctx.stroke();ctx.globalAlpha=alpha*trail*.85;ctx.strokeStyle='#fff5da';ctx.lineWidth=Math.max(1,size*.025);ctx.stroke();ctx.restore();}
 if(item&&!legendary)heldWeapon(ctx,item.idx,handX,handY,size*.82,angle,gear(a),t,item.theme);else sword(handX,handY,length,angle,legendary?3:gear(a),t,ctx,Math.max(.45,Math.min(1,size/64)));
 if(shield&&!equippedFor(a,'shield')){ctx.fillStyle='#efcc83';ctx.beginPath();ctx.arc(-size*.28,-size*.3,size*.24,0,7);ctx.fill();ctx.fillStyle='#84aabd';ctx.beginPath();ctx.arc(-size*.28,-size*.3,Math.max(1,size*.24-2),0,7);ctx.fill();star(-size*.28,-size*.3,size*.1,'#ffeac2');}ctx.restore();}
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
function heldWeapon(c,idx,x,y,size,angle,rank=0,t=0,theme){
 const span=Math.min(112,size*(rank>=3?1.26:rank>=2?1.12:1.04)),color=({storm:'#ffe68a',tide:'#77dfff',eclipse:'#d1a0ff',void:'#e0a5ff',sun:'#ffdb7d',wind:'#a9efc3'})[theme]||(idx===107?'#ffb55f':idx===129?'#dda4ff':'#a7ddff');
 const alpha=c.globalAlpha;c.save();c.translate(x,y);
 if(rank>=2&&angle>.35){for(let i=2;i>0;i--){c.save();c.rotate(angle-i*.16);c.globalAlpha=alpha*.12/i;drawTile(c,'dungeon',idx,-span/2,-span*.85,span/16);c.restore();}}
 c.rotate(angle);c.shadowColor=color;c.shadowBlur=rank>=3?12:rank>=2?7:3;
 c.save();c.scale(idx===107?1.05:theme?1.12:rank>=2?1.3:1.12,1);drawTile(c,'dungeon',idx,-span/2,-span*.85,span/16);c.restore();c.shadowBlur=0;
 if(rank){const wing=span*(rank>=3?.26:rank>=2?.2:.15);c.fillStyle='#edc77d';for(const dir of [-1,1]){c.beginPath();c.moveTo(0,-span*.045);c.lineTo(dir*wing*(dir<0?.68:1),-span*.15);c.lineTo(dir*wing*(dir<0?.5:.72),-span*.025);c.lineTo(0,span*.015);c.fill();}c.fillStyle=color;c.beginPath();c.moveTo(0,-span*.12);c.lineTo(span*.055,-span*.055);c.lineTo(0,span*.012);c.lineTo(-span*.055,-span*.055);c.fill();c.fillStyle='#fff3d7';c.fillRect(-1,-span*.072,2,2);}
 if(rank>=2){c.strokeStyle=color;c.lineWidth=Math.max(1,span*.016);c.globalAlpha=alpha*.45;c.beginPath();c.moveTo(-span*.11,-span*.1);c.quadraticCurveTo(-span*.25,-span*.48,-span*.04,-span*.8);c.stroke();c.globalAlpha=alpha;}
 if(idx===106&&rank>=2){c.fillStyle='#c6edff';c.shadowColor='#86cbff';c.shadowBlur=5;for(let i=0;i<3;i++){const dir=i%2?1:-1,xx=dir*span*.23,yy=-span*(.25+i*.2)+Math.sin(t*2+i)*2;c.beginPath();c.moveTo(xx,yy-span*.065);c.lineTo(xx+span*.035,yy);c.lineTo(xx,yy+span*.065);c.lineTo(xx-span*.035,yy);c.fill();}c.shadowBlur=0;}
 if(rank>=3&&idx===107){c.globalAlpha=alpha*.85;c.shadowColor='#ff974a';c.shadowBlur=7;for(let i=0;i<6;i++){const phase=(t*.6+i/6)%1,xx=span*((i%2?.24:.12)+Math.sin(t*3+i)*.025),yy=-span*(.16+phase*.62);c.fillStyle=i%2?'#ffe1a0':'#ff9863';c.beginPath();c.moveTo(xx,yy-span*.12);c.quadraticCurveTo(xx-span*.065,yy+span*.045,xx,yy+span*.05);c.quadraticCurveTo(xx+span*.06,yy+span*.025,xx,yy-span*.12);c.fill();}c.globalAlpha=alpha;c.shadowBlur=0;}
 if(theme){c.strokeStyle=color;c.fillStyle=color;c.lineWidth=Math.max(1,span*.025);c.shadowColor=color;c.shadowBlur=6;
  if(theme==='storm'){c.beginPath();c.moveTo(span*.09,-span*.15);for(let i=0;i<6;i++)c.lineTo(span*(i%2?.18:.06),-span*(.2+i*.105));c.stroke();}
  else if(theme==='tide'||theme==='wind'){for(let i=0;i<2;i++){c.beginPath();c.ellipse(span*.23,-span*(.3+i*.27),span*.14,span*.065,-.45+t*.2,0,Math.PI*1.65);c.stroke();}}
  else{c.beginPath();c.ellipse(span*.23,-span*.48,span*.15,span*.07,-.65,0,7);c.stroke();for(let i=0;i<3;i++){const xx=span*(.1+.1*Math.sin(t+i*2)),yy=-span*(.3+i*.2);c.fillRect(xx-1,yy-1,3,3);}}
  c.shadowBlur=0;}
 if(rank>=4){c.strokeStyle=color;c.lineWidth=Math.max(1,span*.025);for(let i=0;i<2;i++){c.beginPath();c.ellipse(span*.24,-span*(.35+i*.23),span*.15,span*.08,-.7+t*.2,0,7);c.stroke();}c.fillStyle='#fff2ba';c.fillRect(span*.16,-span*.82,span*.035,span*.14);}
 if(rank>=6){c.strokeStyle=color;c.lineWidth=Math.max(1,span*.02);c.shadowColor=color;c.shadowBlur=9;for(let i=0;i<4;i++){const xx=span*(.09+Math.sin(t+i*1.6)*.08),yy=-span*(.22+i*.15),r=span*.045;c.beginPath();c.moveTo(xx-r,yy);c.lineTo(xx,yy-r*2);c.lineTo(xx+r,yy);c.lineTo(xx,yy+r*2);c.closePath();c.stroke();}c.shadowBlur=0;}
 if(rank>=3){for(let i=0;i<3;i++){const p=(t*.45+i/3)%1,xx=Math.sin(t*2+i*2)*span*.15,yy=-span*(.12+p*.63),r=span*.035;c.fillStyle=i%2?'#fff1c5':color;c.beginPath();c.moveTo(xx-r,yy);c.lineTo(xx,yy-r);c.lineTo(xx+r,yy);c.lineTo(xx,yy+r);c.fill();}}
 c.restore();}

function applyBattlePose(c,x,y,{angle=0,face=1,squash=1,alpha=1}){
 c.translate(x,y);c.rotate(angle);c.scale(face,squash);c.translate(-x,-y);c.globalAlpha*=alpha;
}
function drawOutfit(c,a,x,y,size,t,weapon=true,outfit=inventory(a.key).equipped,petFacing=0,petEdge=Infinity,bodyPose=null){
 const eq={...outfit};const transcendent=Object.values(eq).some(id=>catalog.find(i=>i.id===id)?.tier==='transcendent');const relic=transcendent||Object.values(eq).some(id=>['bulwark','imperial','celestial','titanhand','cometboots','heartlantern','astrolabe','phoenix','dragonling'].includes(id));
 for(const [from,to] of Object.entries({seraphshield:'aegis',auroracrown:'crown',eternalplate:'cape',starforged:'sungrip',riftsteps:'starboots',worldheart:'lantern',stardrake:'fox',bulwark:'aegis',imperial:'crown',celestial:'cape',titanhand:'sungrip',cometboots:'starboots',heartlantern:'lantern',astrolabe:'compass',phoenix:'fox',dragonling:'fox'}))for(const slot of Object.keys(eq))if(eq[slot]===from)eq[slot]=to;
 c.save();if(bodyPose)applyBattlePose(c,x,y,bodyPose);
 if(relic){c.shadowColor='#d8b0ff';c.shadowBlur=3;}
 if(['celestial','eternalplate'].includes(outfit.body))c.filter='sepia(.8) saturate(1.4)';
 if(eq.body==='warden')c.filter='sepia(.5) hue-rotate(55deg) saturate(.8)';
 if(eq.body==='cape'||eq.body==='warden')drawTile(c,'equipment',226,x-size/2,y-size,size/16);
 c.filter='none';
 if(eq.body==='wings'||eq.body==='nightwings'){c.fillStyle=eq.body==='nightwings'?'#c0a4edbb':'#b9e9efbb';for(const dir of [-1,1]){c.beginPath();c.ellipse(x+dir*size*.42,y-size*.5,size*.22,size*.12,dir*(.5+Math.sin(t*4)*.18),0,7);c.fill();}}
 if(eq.head==='halo'||eq.head==='runecrown'){c.strokeStyle=eq.head==='runecrown'?'#9ce2ff':'#ffe1a3';c.lineWidth=Math.max(1,size*.04);c.beginPath();c.ellipse(x,y-size-5,size*.27,size*.08,0,0,7);c.stroke();}
 if(eq.head==='runecrown'){c.fillStyle='#dcf5ff';c.fillRect(x-1,y-size-9,3,3);}
 if(eq.head==='crown'){c.save();if(['imperial','auroracrown'].includes(outfit.head))c.filter='sepia(.5) hue-rotate(225deg)';drawTile(c,'equipment',352,x-size/2,y-size,size/16);c.restore();}
 if(['gloves','sungrip','runegloves'].includes(eq.hands)){c.save();if(eq.hands!=='gloves')c.filter=eq.hands==='sungrip'?'sepia(1) saturate(2)':'sepia(1) hue-rotate(120deg)';c.beginPath();c.rect(x-size*.5,y-size*.38,size*.2,size*.2);c.rect(x+size*.3,y-size*.38,size*.2,size*.2);c.clip();drawTile(c,'equipment',226,x-size/2,y-size,size/16);c.restore();}
 if(eq.feet)drawTile(c,'equipment',eq.feet==='boots'?58:166,x-size/2,y-size,size/16);
 if(eq.feet==='starboots'){c.fillStyle='#e5e9a8';for(let i=0;i<3;i++)c.fillRect(x-size*.3+i*size*.3,y+Math.sin(t*3+i)*2,2,2);}
 if(eq.charm==='orbit'){c.fillStyle='#d9c4ff';const sx=x+Math.cos(t*2)*size*.65,sy=y-size*.6+Math.sin(t*2)*size*.2;c.beginPath();for(let i=0;i<8;i++){const angle=i*Math.PI/4,r=size*(i%2?.04:.13);c.lineTo(sx+Math.cos(angle)*r,sy+Math.sin(angle)*r);}c.fill();}
 if(eq.charm==='compass'||eq.charm==='lantern'){const xx=x-size*.64,yy=y-size*.5+Math.sin(t*2)*size*.05;c.fillStyle='#d3ae70';c.strokeStyle='#ffdb99';c.lineWidth=Math.max(1,size*.025);if(eq.charm==='compass'){c.beginPath();c.arc(xx,yy,size*.12,0,7);c.stroke();c.beginPath();c.moveTo(xx-Math.cos(t)*size*.09,yy-Math.sin(t)*size*.09);c.lineTo(xx+Math.cos(t)*size*.09,yy+Math.sin(t)*size*.09);c.stroke();}else{c.fillRect(xx-size*.08,yy-size*.1,size*.16,size*.2);c.fillStyle='#fff0bc';c.fillRect(xx-size*.04,yy-size*.06,size*.08,size*.12);}}
 if(transcendent){c.strokeStyle='#a9f3ed';c.lineWidth=Math.max(1,size*.025);c.beginPath();c.ellipse(x,y-size*.1,size*.4,size*.09,0,0,7);c.stroke();}
 if(relic){const alpha=c.globalAlpha;c.fillStyle='#eac4ff';for(let i=0;i<3;i++){const q=(t*.3+i/3)%1;c.globalAlpha=alpha*(1-q);c.fillRect(x+size*(.55+q*.2),y-size*(.15+q*.7),2,2);}c.globalAlpha=alpha;}
 if(eq.shield){const item=catalog.find(i=>i.id===eq.shield);c.save();if(eq.shield==='aegis')c.filter='sepia(.8) saturate(1.4)';drawTile(c,'dungeon',item.idx,x-size*.72,y-size*.48,size*.5/16);c.restore();}
 if(weapon&&eq.weapon){const item=catalog.find(i=>i.id===eq.weapon);heldWeapon(c,item.idx,x+size*.32,y-size*.4,size*.85,.25,Math.max(item.rank,weaponMastery(a)),t,item.theme);}
 c.restore();
 if(eq.pet){
  const ps=size*(['dragonling','stardrake'].includes(outfit.pet)?.52:.42);
  // 전투에서는 상대 반대편 발치에 서고, 좁은 전투장에서도 테두리 안에 머문다.
  const center=petFacing?Math.max(-petEdge+ps/2,Math.min(petEdge-ps/2,x-petFacing*(size*.7+ps/2))):x+size*.5+ps/2;
  const floor=y+(petFacing?size*.12:0)+Math.sin(t*4)*size*.04;
  c.save();if(petFacing<0){c.translate(center,0);c.scale(-1,1);c.translate(-center,0);}
  if(outfit.pet==='phoenix')c.filter='sepia(1) saturate(3) hue-rotate(330deg)';if(['dragonling','stardrake'].includes(outfit.pet))c.filter='sepia(1) saturate(2) hue-rotate(210deg)';
  drawTile(c,'dungeon',({fox:120,wisp:108,moonfox:121,cub:124})[eq.pet],center-ps/2,floor-ps,ps/16);c.restore();
 }
}
function loot(a,x,y,size,petFacing=0,petEdge=Infinity,bodyPose=null){drawOutfit(ctx,a,x,y,size,window.townUI?.motionReduced?0:performance.now()/1000,false,undefined,petFacing,petEdge,bodyPose);const r=record(a);if(r.kills<3&&!r.bosses)return;ctx.save();if(bodyPose)applyBattlePose(ctx,x,y,bodyPose);star(x+size*.45,y-size*.6,size*.1,r.bosses?'#efacd8':r.kills>=10?'#c5b4ff':'#ffe09b');ctx.restore();}
const panel=document.createElement('details');panel.id='adventure-log';panel.innerHTML='<summary>⚔ 모험</summary><div class="adventure-body"><button type="button"></button><p></p></div>';
const style=document.createElement('style');style.textContent='#adventure-log{position:absolute;left:9px;top:9px;z-index:4;color:#e4edd8;font:12px sans-serif;max-width:230px}#adventure-log summary{cursor:pointer;background:#203b32;border:1px solid #647e63;border-radius:8px;padding:7px 10px;list-style:none}#adventure-log .adventure-body{background:#203b32;padding:12px;border-radius:8px;line-height:1.7}#adventure-log button{font:inherit;background:#354f3a;color:#e4edd8;border:1px solid #89a17a;border-radius:6px;padding:6px 10px}#adventure-log p{margin:8px 0 0;white-space:pre-line}';document.head.append(style);document.getElementById('map-stage').append(panel);
function renderLog(){const all=Object.values(records),kills=all.reduce((s,r)=>s+r.kills,0),bosses=all.reduce((s,r)=>s+r.bosses,0);panel.querySelector('button').textContent=enabled?'모험 켜짐 · 끄기':'모험 꺼짐 · 켜기';panel.querySelector('p').textContent=`몬스터 ${kills}마리 · 보스 ${bosses}마리\n일반 1~10개 · 정예 보스 24~40개\n주민전: 상대 등급 × 2개\n주민별 3마리: 별 장식\n10마리: 보라 별 장식\n보스 처치: 분홍 보스 배지`;renderShop();}
const shopButton=document.createElement('button');shopButton.id='open-stardust-shop';shopButton.type='button';shopButton.textContent='✦ 상점';
const shopDialog=document.createElement('dialog');shopDialog.id='stardust-shop';shopDialog.setAttribute('aria-labelledby','stardust-shop-title');shopDialog.setAttribute('closedby','any');
shopDialog.innerHTML=`<header class="shop-heading"><div><span class="shop-eyebrow">마을의 작은 장신구 가게</span><h2 id="stardust-shop-title">장비와 별가루 상점</h2></div><button type="button" class="shop-close" aria-label="상점 닫기" autofocus>×</button></header><div class="shop-layout"><aside class="shop-character"><label class="shop-session-label" for="shop-session">장비를 살 세션</label><select id="shop-session"></select><p class="shop-session-title"></p><div class="shop-wallet"><span>별가루 <strong></strong></span><small>일반 +1~10 · 정예 +24~40</small></div><div class="equipment-stats"></div><section class="equipment-overview" aria-label="현재 장비"><canvas id="equipment-preview" width="180" height="160" aria-label="선택한 캐릭터 착용 모습"></canvas><div class="equipment-slots"></div></section><p class="shop-intro">선택한 세션만 구매하고 착용해요.<br>장비 능력치가 전투에 더해져요.<br>주민전 승리: 상대 등급 × 2 별가루</p></aside><section class="shop-catalog" aria-label="구매할 아이템"><div class="shop-categories" aria-label="아이템 부위"></div><p class="shop-feedback" role="status" aria-live="polite"></p><div class="shop-items"></div><footer class="shop-footer">별가루와 장비는 세션마다 따로 보관돼요.<br>전투 중 바꾼 장비의 능력치는 다음 전투부터 적용돼요.</footer></section></div>`;
const adventureControls=document.createElement('div');adventureControls.id='adventure-controls';adventureControls.append(panel,shopButton);document.getElementById('map-stage').append(adventureControls,shopDialog);
const escapeShop=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderShop(){
 const keys=Object.keys(avatars);if(!keys.includes(selectedSession))selectedSession=keys.includes(window.townUI?.selectedKey)?window.townUI.selectedKey:keys[0]||'';
 if(!shopDialog.open)return;
 if(window.dispatchEvent)queueMicrotask(()=>window.dispatchEvent(new Event('town:shop')));
 const selector=shopDialog.querySelector('#shop-session');selector.innerHTML=keys.length?keys.map(key=>`<option value="${escapeShop(key)}">${escapeShop(state.sessionInfo[key]?.title||avatars[key].sid||key)} · ${escapeShop(avatars[key].proj||'세션')}</option>`).join(''):'<option value="">마을에 세션이 없어요</option>';selector.value=selectedSession;selector.disabled=!keys.length;shopDialog.querySelector('.shop-session-title').textContent=state.sessionInfo[selectedSession]?.title||'';
 const statsActor=avatars[selectedSession],stats=statsActor?statsFor(statsActor):null;shopDialog.querySelector('.equipment-stats').innerHTML=stats?['attack','defense','hp'].map(k=>`<div><span>${{attack:'공격력',defense:'방어력',hp:'체력'}[k]}</span><strong>${stats[k]}</strong><small>${stats.base[k]} + 장비 ${stats.bonus[k]}</small></div>`).join('')+`<p>${gradeFor(stats)}등급 · 치명타 ${Math.round(stats.crit*100)}% · 연속 패배 ${record(statsActor).lossStreak||0}/4</p>`:'';
 const inv=inventory(selectedSession),owned=new Set(inv.owned),equipped=inv.equipped;
 shopDialog.querySelector('.equipment-slots').innerHTML=Object.entries(slots).map(([slot,name])=>{const item=catalog.find(i=>i.id===equipped[slot]);return `<button type="button" data-slot="${slot}" aria-label="${name} 아이템 보기"><span>${name}</span><strong>${item?item.name:'미장착'}</strong></button>`;}).join('');
 shopDialog.querySelector('.shop-categories').innerHTML=Object.entries({all:'전체',...slots}).map(([slot,name])=>`<button type="button" data-slot="${slot}" aria-pressed="${shopFilter===slot}">${name}</button>`).join('');
 const preview=shopDialog.querySelector('#equipment-preview'),c=preview.getContext?.('2d'),actor=avatars[selectedSession];if(c){c.clearRect(0,0,180,160);c.imageSmoothingEnabled=false;if(actor){drawTile(c,'dungeon',actor.idx,54,50,4.5);drawOutfit(c,actor,90,122,72,0);}}
 shopDialog.querySelector('.shop-wallet strong').textContent=balance()+'개';
 const focused=document.activeElement?.dataset?.item;
 shopDialog.querySelector('.shop-items').innerHTML=catalog.filter(i=>shopFilter==='all'||i.slot===shopFilter).map(i=>{
 const have=owned.has(i.id),wear=equipped[i.slot]===i.id,transfer=!have&&legacy.includes(i.id),short=Math.max(0,i.price-balance());
 return `<article class="shop-item ${wear?'is-equipped':''}"><div class="shop-preview" aria-hidden="true"><canvas class="shop-item-canvas" data-preview="${i.id}" width="160" height="112"></canvas></div><div class="shop-item-copy"><h3>${i.name}</h3><p>${i.desc}</p><p class="item-stats">${Object.entries(i.stats).map(([k,v])=>`${{attack:'공격',defense:'방어',hp:'체력',crit:'치명타'}[k]} +${k==='crit'?Math.round(v*100)+'%':v}`).join(' · ')}</p><span class="shop-price">${wear?'✓ 장착 중':have?'보유 중':'✦ '+i.price+'개'}</span></div><button type="button" data-item="${i.id}" aria-label="${i.name} ${have?wear?'해제':'장착':'구매'}" ${!selectedSession||!have&&!transfer&&short?'disabled':''}>${!selectedSession?'세션이 필요해요':have?wear?'장비 해제':'장착하기':transfer?'기존 구매 장식 가져오기':short?short+'개 더 모으면 구매':'구매 · 바로 장착'}</button></article>`;
 }).join('');
 for(const canvas of shopDialog.querySelectorAll('.shop-item-canvas')){const c=canvas.getContext('2d'),item=catalog.find(i=>i.id===canvas.dataset.preview),actor=avatars[selectedSession]||{key:'',idx:84};c.imageSmoothingEnabled=false;drawTile(c,'dungeon',actor.idx,56,35,3);drawOutfit(c,actor,80,83,48,0,true,{...inv.equipped,[item.slot]:item.id});}
 if(focused)shopDialog.querySelector(`[data-item="${focused}"]`)?.focus();
}
shopDialog.querySelector('#shop-session').onchange=event=>{selectedSession=event.target.value;renderShop();shopDialog.querySelector('.shop-feedback').textContent='';};
function openEquipment(key){if(avatars[key])selectedSession=key;if(!shopDialog.open)shopDialog.showModal();renderShop();shopDialog.querySelector('.shop-feedback').textContent='';shopDialog.scrollTop=0;shopDialog.querySelector('.shop-catalog').scrollTop=0;shopDialog.querySelector('.shop-character').scrollTop=0;}
shopButton.onclick=()=>openEquipment(window.townUI?.selectedKey);
shopDialog.querySelector('.shop-close').onclick=()=>shopDialog.close();
shopDialog.onclick=event=>{
 const slot=event.target.closest?.('[data-slot]')?.dataset.slot;if(slot){shopFilter=slot;renderShop();shopDialog.querySelector('.shop-catalog').scrollTop=0;return;}
 const id=event.target.closest?.('[data-item]')?.dataset.item;
 if(id){const inv=inventory(selectedSession),have=inv.owned.includes(id),item=catalog.find(i=>i.id===id),wear=inv.equipped[item.slot]===id;if(buy(id))shopDialog.querySelector('.shop-feedback').textContent=wear?item.name+' 장비를 해제했어요.':item.name+(have?' 장착 완료!':' 구매 완료! 선택한 세션에 장착했어요.');}
 if(event.target===shopDialog){const r=shopDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)shopDialog.close();}
};
panel.querySelector('button').onclick=()=>{enabled=!enabled;save('codextown.adventureEnabled',enabled);if(!enabled){window.townEvents?.cancel();cancel();monsters.length=0;}else nextSpawn=performance.now()+4000;renderLog();};renderLog();
window.townAdventure={skillDuration,rollPlayerHit,battleMotion,chronicle,journal,catalog,autoEquip,autoMode:key=>chronicle?.autoMode(key)||'off',setAutoMode:(key,mode)=>{if(!avatars[key]||!chronicle?.setAuto(key,mode))return false;autoEquip(avatars[key]);return true;},get enabled(){return enabled;},eligible,monster,chamber,impact,defeat,applyBattlePose,foregroundFinish,chargeAura,finishDuration,gradeFor,duelPlayback,rewardDuel,finisherDuration,finishFade,elementFor,atmosphere,legendaryLength,resolveDuel,drawDuelStats,statsFor,rollDamage,nextElement,openEquipment,impactScale,buy,balance,equippedFor,get equipped(){return equippedFor(selectedSession);},wander,finisher,caveWalls,caveDoor,step,drawMap,drawBattle,roomInterior,equipment,loot,hpFor,spawn,begin,cancel,record,reward,get active(){return battle;},get monsters(){return monsters;},busy:a=>battle?.a===a||Boolean(window.townEvents?.busy(a)),resting:a=>performance.now()<(rest.get(a.key)||0),duelTime:d=>{const playback=duelPlayback(d);if(playback){d.playback=playback;return playback.t;}const t=(performance.now()-d.start)/1000;return d.legendary&&t>=2.5?t<4.5?2.5:t-2:t;},crescent};
function sword(x,y,length,angle,rank,t,paint=ctx,breadth=1){
paint.save();paint.translate(x,y);paint.rotate(angle);paint.scale(breadth,breadth);
const L=length/breadth;
paint.fillStyle=rank?'#543967':'#80664c';paint.fillRect(-3,0,6,15);
paint.fillStyle='#f1c875';for(let j=2;j<14;j+=4)paint.fillRect(-3,j,6,1);
if(rank===0){
 paint.fillStyle='#a8d9cd';paint.fillRect(-3,-L+5,6,L-9);paint.fillRect(-1,-L,2,5);
 paint.fillStyle='#e4f9e7';paint.fillRect(-1,-L+5,2,L-10);paint.fillStyle='#bba784';paint.fillRect(-8,-4,16,4);
}else if(rank===1){
 paint.fillStyle='#718baa';paint.beginPath();paint.moveTo(-7,-6);paint.lineTo(-7,-L+12);paint.lineTo(0,-L);paint.lineTo(7,-L+12);paint.lineTo(7,-6);paint.closePath();paint.fill();
 paint.fillStyle='#f1f8ff';paint.beginPath();paint.moveTo(0,-L);paint.lineTo(5,-L+12);paint.lineTo(5,-6);paint.lineTo(0,-6);paint.fill();
 paint.fillStyle='#efc574';paint.fillRect(-14,-5,28,5);paint.fillRect(-14,-10,5,6);paint.fillRect(9,-10,5,6);
}else if(rank===2){
 paint.shadowColor='#5de9ff';paint.shadowBlur=9;paint.fillStyle='#36b8d6';
 paint.beginPath();paint.moveTo(0,-L);paint.lineTo(12,-L*.65);paint.lineTo(9,-12);paint.lineTo(0,-5);paint.lineTo(-9,-12);paint.lineTo(-12,-L*.65);paint.closePath();paint.fill();paint.shadowBlur=0;
 paint.fillStyle='#b6ffff';paint.beginPath();paint.moveTo(0,-L);paint.lineTo(0,-8);paint.lineTo(-9,-15);paint.lineTo(-7,-L*.65);paint.closePath();paint.fill();
 paint.fillStyle='#efffff';paint.beginPath();paint.moveTo(0,-L);paint.lineTo(4,-L*.64);paint.lineTo(0,-10);paint.closePath();paint.fill();
 for(const dir of [-1,1]){star(dir*15,-7,7,'#6de4ef');star(dir*15,-7,3,'#efffff');}
 paint.fillStyle='#dbb877';paint.fillRect(-13,-5,26,5);star(0,-4,8,'#a585fa');star(0,-4,3,'#f8c9ff');
}else{
 paint.shadowColor='#d98cff';paint.shadowBlur=16;paint.fillStyle='#aa67e3';
 paint.beginPath();paint.moveTo(0,-L-3);paint.lineTo(13,-L*.72);paint.lineTo(10,-L*.4);paint.lineTo(15,-L*.28);paint.lineTo(8,-6);paint.lineTo(-8,-6);paint.lineTo(-15,-L*.28);paint.lineTo(-10,-L*.4);paint.lineTo(-13,-L*.72);paint.closePath();paint.fill();
 paint.shadowBlur=0;paint.fillStyle='#ffe9fa';paint.beginPath();paint.moveTo(0,-L-3);paint.lineTo(6,-L*.7);paint.lineTo(3,-8);paint.lineTo(-3,-8);paint.lineTo(-6,-L*.7);paint.closePath();paint.fill();
 paint.fillStyle='#ffd77d';for(const dir of [-1,1]){paint.beginPath();paint.moveTo(dir*5,-5);paint.lineTo(dir*23,-17);paint.lineTo(dir*19,-5);paint.lineTo(dir*10,2);paint.closePath();paint.fill();}
 star(0,-5,13,'#ffdf88');star(0,-5,7,'#ed8fd1');star(0,-5,3,'#fff7e1');
 for(let i=0;i<5;i++){const phase=(t*.55+i/5)%1;star(Math.sin(i*2+t*2)*(15+4*Math.sin(t)), -9-phase*(L-7),i%2?3:4,i%2?'#fce5aa':'#ffc9f6');}
 paint.strokeStyle='#ffe3a1';paint.lineWidth=2;paint.beginPath();paint.moveTo(-11,8);paint.quadraticCurveTo(-25,13,-16+Math.sin(t*5)*4,24);paint.stroke();
}
paint.fillStyle=rank===3?'#ffc7ed':'#c5ae85';paint.fillRect(-4,13,8,4);paint.restore();}

})();
