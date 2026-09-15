/* Village history survives individual sessions. Equipment and money never move between them. */
function createTownChronicle(storage) {
  const key = 'codextown.chronicle';
  let saved; try { saved = JSON.parse(storage.getItem(key)); } catch {}
  const number = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const modes = ['off', 'attack', 'tank', 'balanced'];
  const bosses = new Map(), relations = new Map(), auto = new Map();
  for (const row of Array.isArray(saved?.bosses) ? saved.bosses : []) if (row && typeof row.id === 'string') bosses.set(row.id, {...row, seen:number(row.seen),kills:number(row.kills),losses:number(row.losses),maxHit:number(row.maxHit)});
  for (const row of Array.isArray(saved?.relations) ? saved.relations : []) if (row && typeof row.aKey === 'string' && typeof row.bKey === 'string') relations.set(JSON.stringify([row.aKey,row.bKey].sort()), {...row,duels:number(row.duels),coops:number(row.coops)});
  for (const [id, mode] of Object.entries(saved?.auto || {})) if(modes.includes(mode)) auto.set(id, mode);
  const treasure = Object.fromEntries(['seen','caught','escaped','stars'].map(k=>[k,number(saved?.treasure?.[k])]));
  const raids = Object.fromEntries(['seen','won','lost'].map(k=>[k,number(saved?.raids?.[k])]));
  const snapshot = () => JSON.parse(JSON.stringify({bosses:[...bosses.values()],relations:[...relations.values()],treasure,raids,auto:Object.fromEntries(auto)}));
  function persist() { try { storage.setItem(key,JSON.stringify(snapshot())); } catch {} if(typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new Event('town:chronicle')); }
  function boss(m) { if(!m.boss) return null; const id=m.kind?.id||m.id||m.name; if(!id)return null; if(!bosses.has(id))bosses.set(id,{id,name:m.name,idx:m.idx,level:m.level||10,seen:0,kills:0,losses:0,maxHit:0,lastSeen:0});return bosses.get(id); }
  function pair(a,b) { if(!a?.key||!b?.key||a.key===b.key)return null; const [aa,bb]=[a,b].sort((x,y)=>x.key.localeCompare(y.key));const id=JSON.stringify([aa.key,bb.key].sort());if(!relations.has(id))relations.set(id,{aKey:aa.key,bKey:bb.key,aName:aa.title||aa.key,bName:bb.title||bb.key,duels:0,coops:0});return relations.get(id); }
  const score = (item, mode) => {const s=item?.stats||{};return mode==='attack'?(s.attack||0)*4+(s.crit||0)*180+(s.defense||0)*.3+(s.hp||0)*.03:mode==='tank'?(s.defense||0)*4+(s.hp||0)*.4+(s.attack||0)*.3+(s.crit||0)*10:(s.attack||0)*2+(s.defense||0)*2+(s.hp||0)*.2+(s.crit||0)*100;};
  return {
    snapshot,
    see(m){const row=boss(m);if(row){row.seen++;row.lastSeen=Date.now();persist();}},
    hit(m,damage){const row=boss(m);if(row && Number.isFinite(damage) && damage>row.maxHit){row.maxHit=Math.round(damage);persist();}},
    result(m,won){const row=boss(m);if(row){row[won?'kills':'losses']++;persist();}},
    duel(a,b){const row=pair(a,b);if(row){row.duels++;persist();}},
    cooperate(actors){for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){const row=pair(actors[i],actors[j]);if(row)row.coops++;}persist();},
    relation(a,b){return relations.get(JSON.stringify([a.key,b.key].sort()))||null;},
    autoMode(id){return auto.get(id)||'off';},
    setAuto(id,mode){if(typeof id!=='string'||!modes.includes(mode))return false;auto.set(id,mode);persist();return true;},
    treasure(event,stars=0){if(!['seen','caught','escaped'].includes(event))return;treasure[event]++;if(event==='caught')treasure.stars+=number(stars);persist();},
    raid(event){if(!['seen','won','lost'].includes(event))return;raids[event]++;persist();},
    chooseUpgrade(catalog,equipped,balance,mode,owned=[]){if(!modes.includes(mode)||mode==='off')return null;return catalog.filter(item=>(owned.includes(item.id)||item.price<=balance)&&score(item,mode)>score(catalog.find(i=>i.id===equipped[item.slot]),mode)+.001).sort((a,b)=>score(b,mode)-score(a,mode)||a.price-b.price)[0]||null;}
  };
}
if(typeof module !== 'undefined')module.exports={createTownChronicle};
