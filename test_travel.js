'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync(`${__dirname}/town.html`, 'utf8');
const body = html.match(/function roomRoute\(from, to, start, end\) \{([\s\S]*?)\n\}/)[1];
let checked = 0;
for (const cols of [2,3,4,6]) {
  const route = new Function('ROOM_W','ROOM_H','GUTTER_X','GUTTER_Y','MARGIN','ROOM_COLS',
    `return function(from,to,start,end){${body}}`)(8,7,1,1,1,cols);
  const rooms = Array.from({length:12},(_,i)=>({gx:1+i%cols*9,gy:1+Math.floor(i/cols)*8}));
  for (const from of rooms) for (const to of rooms) {
    if(from===to)continue;
    const start={x:from.gx+2,y:from.gy+4},end={x:to.gx+5,y:to.gy+4};
    const points=[start,...route(from,to,start,end).map(p=>({x:p.x+.5,y:p.y+1}))];
    assert.deepEqual(points.at(-1),end);
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i];
      const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*30);
      for(let j=0;j<=n;j++) {
        const x=a.x+(b.x-a.x)*j/n,y=a.y+(b.y-a.y)*j/n;
        for(const r of rooms) {
          if(x<=r.gx || x>=r.gx+8 || y<=r.gy || y>=r.gy+7)continue;
          const interior=x>=r.gx+1 && x<=r.gx+7 && y>=r.gy+1 && y<=r.gy+6;
          const door=x>=r.gx+3 && x<=r.gx+5 && y>=r.gy+6;
          assert.ok(interior||door,`route crosses wall at ${x},${y}`);
          assert.ok(r===from||r===to,'route crosses an unrelated room');
        }
      }
    }
    checked++;
  }
  assert.ok(route(null,rooms[0],null,{x:5,y:5}).length,'hidden source enters through destination door');
  assert.ok(route(rooms[0],null,{x:5,y:5},null).length,'hidden destination exits source door');
}
console.log(`Door and corridor routes: ${checked} room pairs pass`);
