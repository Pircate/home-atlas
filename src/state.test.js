import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevices,applyScene,power,restore,slabs,furnitureDefaults,extentOf,clampToLayout,resolveMove,restoreLayout,LAYOUT_VERSION,BOUNDS,OPENINGS,REMOVED_WALLS,isWallRemoved} from './state.js';
import {ROOMS,WALLS,WALL_THICKNESS} from './layout.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`期望 ${a} 接近 ${b}`);
test('每台设备标识唯一，客厅三盏灯可以独立控制',()=>{const devices=createDevices();assert.equal(new Set(devices.map(d=>d.id)).size,21);const lamps=devices.filter(d=>d.room==='living'&&d.type==='light');assert.equal(lamps.length,3);lamps[0].on=false;assert(lamps[1].on);});
test('离家关闭非必要设备，保留冰箱与热水器原状态',()=>{const devices=createDevices();const next=applyScene(devices,'away');assert(next.filter(d=>!['fridge','heater'].includes(d.type)).every(d=>!d.on&&!d.running));assert(next.find(d=>d.type==='fridge').on);assert(devices[0].on);});
test('松弛夜晚保留45%亮度的落地灯',()=>{const lit=applyScene(createDevices(),'relax').filter(d=>d.type==='light'&&d.on);assert.deepEqual(lit.map(d=>d.id),['floor-light']);assert(lit.every(d=>d.brightness===45));});
test('状态恢复限制参数和移动设备坐标，固定设备使用新模型位置',()=>{const defaults=createDevices();const next=restore(defaults,[null,{id:'living-main',name:'错误',x:999,z:-5,brightness:999,on:false},{id:'fridge',x:999,z:-5},{id:'ac-b',x:1.55,z:4.82}]);assert.equal(next[0].name,'客厅吊灯');assert.equal(next[0].x,defaults[0].x);assert.equal(next[0].z,defaults[0].z);assert.equal(next[0].brightness,100);assert.equal(next[0].on,false);assert.equal(next.find(d=>d.id==='fridge').x,BOUNDS.x1);assert.equal(next.find(d=>d.id==='fridge').z,BOUNDS.z0);assert.deepEqual(next.find(d=>d.id==='ac-b'),defaults.find(d=>d.id==='ac-b'));});
test('未存档的设备保留默认坐标',()=>{const next=restore(createDevices(),[{id:'fridge',on:false}]);assert.equal(next.find(d=>d.id==='fridge').x,7.8951);assert.equal(next.find(d=>d.id==='tv').x,6.37);});
test('模拟灯光功率随亮度变化',()=>{assert.equal(power([{on:true,type:'light',watts:20,brightness:50},{on:false,watts:900}]),10);});
test('家具标识唯一，且与设备标识不冲突',()=>{const furniture=furnitureDefaults(),ids=furniture.map(f=>f.id);assert.equal(new Set(ids).size,furniture.length);const deviceIds=new Set(createDevices().map(d=>d.id));assert(ids.every(id=>!deviceIds.has(id)));});
test('旋转后的包围盒宽深互换',()=>{const e=extentOf({w:1.6,d:2.03,rot:90});close(e.w,2.03);close(e.d,1.6);const f=extentOf({w:1.6,d:2.03,rot:0});close(f.w,1.6);close(f.d,2.03);});
test('地面并集在门洞处连通，家具可以跨房间搬动',()=>{const onSlab=(x,z)=>slabs.some(s=>x>=s.x&&x<=s.x+s.w&&z>=s.z&&z<=s.z+s.d);
 let passable=0;
 for(const o of OPENINGS.filter(o=>o.sill===0)){
  const dx=o.axis==='x'?0:.2,dz=o.axis==='x'?.2:0;
  if(!onSlab(o.cx-dx,o.cz-dz)||!onSlab(o.cx+dx,o.cz+dz))continue;   // 入户门落在户界上，跨出去就是户外
  passable++;
  assert(clampToLayout(o.cx,o.cz,{w:.3,d:.3}),`门洞 ${o.id} @ ${o.cx},${o.cz} 应连通`);}
 assert.equal(passable,9,'除入户门外，其余 9 樘门洞都连通两间房');});
test('房间之间的墙体不可跨越，但同一道墙上的门洞可以穿过',()=>{assert.equal(clampToLayout(3.4369,7,{w:1,d:2}),null,'卧室 B/C 之间');
 assert.equal(clampToLayout(2.1876,3.5,{w:.6,d:.6}),null,'储物间与卧室 A 之间');
 assert(clampToLayout(2.1876,4.817,{w:.5,d:.5}),'储物间门洞（同一面墙上 z 4.42~5.22 的开口）应当能过去');});
test('开放式厨房：拆掉的两段墙在走位约束里也不再拦路',()=>{
 // 这两段必须在实测墙表里真的存在，否则「拆墙」会因为坐标写错而悄悄失效
 for(const [a,b,c,d] of REMOVED_WALLS)
  assert(WALLS.some(([x1,z1,x2,z2])=>(Math.abs(x1-a)<1e-9&&Math.abs(z1-b)<1e-9&&Math.abs(x2-c)<1e-9&&Math.abs(z2-d)<1e-9)
   ||(Math.abs(x1-c)<1e-9&&Math.abs(z1-d)<1e-9&&Math.abs(x2-a)<1e-9&&Math.abs(z2-b)<1e-9)),
   `被拆的墙段 ${a},${b}→${c},${d} 不在实测墙表里`);
 assert(clampToLayout(8.5,3.2395,{w:.6,d:.6}),'厨房南墙原址应已打通，家具能骑在这条线上');
 assert(clampToLayout(7.4503,2.7,{w:.6,d:.6}),'厨房西门洞原址应已打通，不再有门扇与墙挡住');
 assert(isWallRemoved(9.6631,3.2395,7.4503,3.2395)&&isWallRemoved(7.4503,2.1453,7.4503,3.2395),'墙段首尾颠倒也要认得出来');});
test('目标越界时贴墙走到最远处，而不是原地不动',()=>{const foot={w:.5,d:.5},from={x:1,z:6.5};
 const south=resolveMove(2,9,foot,from);
 assert(south.x>from.x&&south.z>from.z,'朝目标方向前进了一段');
 assert(clampToLayout(south.x,south.z,foot),'停下时位置仍然合法');
 assert(south.z<8.87,'没有越过卧室 B 的南墙（z 9.1723）');
 const east=resolveMove(3.5,6.5,foot,from);
 assert(east.x>from.x&&east.z===from.z,'向东走了一段后被卧室 B/C 之间的隔墙挡住');
 assert(clampToLayout(east.x,east.z,foot),'停下时位置仍然合法');});
test('合法位置原样返回，且允许家具转出边界时留在原地',()=>{assert.deepEqual(clampToLayout(1.6,6.5,{w:.5,d:.5}),{x:1.6,z:6.5});assert.equal(clampToLayout(0,0,{w:2.7,d:2.8}),null);});
test('家具存档为空或损坏时回落到完整默认摆位',()=>{const full=furnitureDefaults();for(const bad of [null,undefined,{},'x',{items:null},{version:1},{items:{'不存在的家具':{x:1,z:1}}}])assert.deepEqual(restoreLayout(bad),full);});
test('家具存档只覆盖改动项并归一化角度',()=>{const next=restoreLayout({version:LAYOUT_VERSION,items:{sofa:{x:6,z:6.5,rot:-90},'卧室B大床组':{rot:450}}});assert.deepEqual(next.find(f=>f.id==='sofa'),{id:'sofa',name:'客厅沙发',room:'living',x:6,z:6.5,rot:270,rotatable:true});assert.equal(next.find(f=>f.id==='bed-b').x,1.25);assert.equal(next.find(f=>f.id==='bed-b').rot,270);});
test('卧室保留已确认床位，按实测墙内边界落位',()=>{
 const furniture=furnitureDefaults();
 for(const [id,w,d,side] of [['b',1.8,2,'south'],['c',1.8,2,'south'],['a',1.5,1.8,'north']]){
  const bed=furniture.find(f=>f.id===`bed-${id}`),[x,z,rw,rd]=ROOMS.find(r=>r.id===id).extent;
  assert.equal(bed.rot,270,'床头均朝西');
  assert(clampToLayout(bed.x,bed.z,{w:w,d,rot:bed.rot}),`${id} 床垫必须留在房内`);
  assert(bed.x-(d/2+.07)>=x+WALL_THICKNESS/2-1e-6,`${id} 床头板不能穿过西墙`);
  assert(bed.x+(d+.01)/2<=x+rw-WALL_THICKNESS/2+1e-6,`${id} 床架不能穿过东墙`);
  const edge=side==='south'?z+rd-WALL_THICKNESS/2:z+WALL_THICKNESS/2;
  assert(Math.abs(bed.z+(side==='south'?1:-1)*(w+.1)/2-edge)<1e-3,`${id} 床侧贴窗且不穿墙`);
 }
 assert(furniture.some(f=>f.id==='wardrobe-a'&&f.rot===90),'卧 A 一米衣柜保留且柜门朝东');
 assert(furniture.some(f=>f.id==='bike-cabinet'),'保留自行车停车柜');
 assert(furniture.every(f=>f.id!=='desk-a'),'卧 A 不恢复书桌');
 assert(createDevices().every(d=>!['b-bed','c-bed','a-desk'].includes(d.id)),'不恢复已移除的台灯');
});
test('旧版本的家具存档被整体丢弃，不按 id 套用到重排后的家具上',()=>{const next=restoreLayout({version:LAYOUT_VERSION-1,items:{'wardrobe-s':{x:.35,z:3.42},sofa:{x:6,z:6.5}}});
 assert.deepEqual(next,furnitureDefaults(),'旧版本存档应回落到默认摆位');});
test('非数值的坐标与角度被忽略',()=>{const next=restoreLayout({items:{sofa:{x:'远',z:NaN,rot:'转'}}});assert.equal(next.find(f=>f.id==='sofa').x,9.08);assert.equal(next.find(f=>f.id==='sofa').rot,0);});
test('只有卫生间洁具因净宽不足不可旋转',()=>{const off=furnitureDefaults().filter(f=>!f.rotatable).map(f=>f.id);assert.deepEqual(off,['bath-fixtures']);});
test('每组家具的默认摆位都落在可行走区域内',()=>{for(const f of furnitureDefaults())assert(clampToLayout(f.x,f.z,{w:.3,d:.3}),`${f.name} 的默认锚点越界`);});
test('地面矩形的尺寸与类型完整',()=>{assert.equal(slabs.length,32);for(const s of slabs){assert(s.w>0&&s.d>0,`${s.room} 尺寸非法`);assert(['wood','tile','bath',undefined].includes(s.type));}});
test('每个门窗洞口都落在某段墙的中线上',()=>{for(const o of OPENINGS)
 assert(WALLS.some(([x1,z1,x2,z2])=>o.axis==='x'
  ?Math.abs(z1-z2)<1e-9&&Math.abs(z1-o.cz)<1e-6&&o.cx>=Math.min(x1,x2)-1e-9&&o.cx<=Math.max(x1,x2)+1e-9
  :Math.abs(x1-x2)<1e-9&&Math.abs(x1-o.cx)<1e-6&&o.cz>=Math.min(z1,z2)-1e-9&&o.cz<=Math.max(z1,z2)+1e-9),
  `洞口 ${o.id} 没挂在任何墙中线上，模型会静默丢掉它`);});
test('实测墙体横平竖直，端点都接在别的墙上（不悬空）',()=>{const onWall=(x,z)=>WALLS.some(([a,b,c,d])=>
  (Math.abs(c-a)>1e-6?Math.abs(z-b)<1e-3&&x>Math.min(a,c)-1e-3&&x<Math.max(a,c)+1e-3
                     :Math.abs(x-a)<1e-3&&z>Math.min(b,d)-1e-3&&z<Math.max(b,d)+1e-3));
 for(const [x1,z1,x2,z2] of WALLS){assert(Math.abs(x2-x1)<1e-6||Math.abs(z2-z1)<1e-6,`墙体 ${x1},${z1}→${x2},${z2} 不横平竖直`);
  assert(Math.hypot(x2-x1,z2-z1)>.1,`墙体 ${x1},${z1}→${x2},${z2} 是碎段`);}
 for(const [x1,z1,x2,z2] of WALLS)for(const [x,z] of [[x1,z1],[x2,z2]])
  assert(onWall(x,z),`墙端点 ${x},${z} 悬空`);});
