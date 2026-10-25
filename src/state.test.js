import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevices,applyScene,power,restore,slabs,furnitureDefaults,extentOf,clampToLayout,resolveMove,restoreLayout,LAYOUT_VERSION} from './state.js';
import {plan,doorways,wallSegments} from './plan.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`期望 ${a} 接近 ${b}`);
test('每台设备标识唯一，客厅三盏灯可以独立控制',()=>{const devices=createDevices();assert.equal(new Set(devices.map(d=>d.id)).size,21);const lamps=devices.filter(d=>d.room==='living'&&d.type==='light');assert.equal(lamps.length,3);lamps[0].on=false;assert(lamps[1].on);});
test('离家关闭非必要设备，保留冰箱与热水器原状态',()=>{const devices=createDevices();const next=applyScene(devices,'away');assert(next.filter(d=>!['fridge','heater'].includes(d.type)).every(d=>!d.on&&!d.running));assert(next.find(d=>d.type==='fridge').on);assert(devices[0].on);});
test('松弛夜晚保留45%亮度的落地灯',()=>{const lit=applyScene(createDevices(),'relax').filter(d=>d.type==='light'&&d.on);assert.deepEqual(lit.map(d=>d.id),['floor-light']);assert(lit.every(d=>d.brightness===45));});
test('状态恢复限制参数和移动设备坐标，固定设备使用新模型位置',()=>{const next=restore(createDevices(),[null,{id:'living-main',name:'错误',x:999,z:-5,brightness:999,on:false},{id:'fridge',x:999,z:-5},{id:'ac-b',x:1.55,z:4.82}]);assert.equal(next[0].name,'客厅吊灯');assert.equal(next[0].x,7.74);assert.equal(next[0].z,6.5);assert.equal(next[0].brightness,100);assert.equal(next[0].on,false);assert.equal(next.find(d=>d.id==='fridge').x,plan.width);assert.equal(next.find(d=>d.id==='fridge').z,0);assert.equal(next.find(d=>d.id==='ac-b').x,.12);assert.equal(next.find(d=>d.id==='ac-b').z,5.92);});
test('未存档的设备保留默认坐标',()=>{const next=restore(createDevices(),[{id:'fridge',on:false}]);assert.equal(next.find(d=>d.id==='fridge').x,7.755);assert.equal(next.find(d=>d.id==='tv').x,6.223);});
test('模拟灯光功率随亮度变化',()=>{assert.equal(power([{on:true,type:'light',watts:20,brightness:50},{on:false,watts:900}]),10);});
test('家具标识唯一，且与设备标识不冲突',()=>{const furniture=furnitureDefaults(),ids=furniture.map(f=>f.id);assert.equal(new Set(ids).size,furniture.length);const deviceIds=new Set(createDevices().map(d=>d.id));assert(ids.every(id=>!deviceIds.has(id)));});
test('旋转后的包围盒宽深互换',()=>{const e=extentOf({w:1.6,d:2.03,rot:90});close(e.w,2.03);close(e.d,1.6);const f=extentOf({w:1.6,d:2.03,rot:0});close(f.w,1.6);close(f.d,2.03);});
test('各室内门洞与开放通道连续，家具可以跨房间搬动',()=>{
 for(const [id,d] of Object.entries(doorways)){
  if(id==='entry')continue;
  const x=d.x+(d.vertical?0:d.w/2),z=d.z+(d.vertical?d.w/2:0);
  assert(clampToLayout(x,z,{w:.3,d:.3}),`${id} 门洞必须连通`);
 }
 for(const [x,z] of [[5.943,4.1],[7.7,8.464],[7.3,2]])assert(clampToLayout(x,z,{w:.3,d:.3}));
});
test('房间隔墙和户型凹口不允许跨越',()=>{
 for(const [x,z] of [[3.267,6.5],[2.018,3],[5.943,6.5],[1,1],[5,0]])assert.equal(clampToLayout(x,z,{w:.3,d:.3}),null);
 assert(clampToLayout(2.018,4.129,{w:.5,d:.5}),'储物间门洞应连通');
});
test('目标越界时贴墙走到最远处，而不是原地不动',()=>{const foot={w:.5,d:.5},from={x:1,z:6.5};
 const south=resolveMove(2,9,foot,from);
 assert(south.x>from.x&&south.z>from.z,'朝目标方向前进了一段');
 assert(clampToLayout(south.x,south.z,foot),'停下时位置仍然合法');
 assert(south.z<8.4,'没有越过南墙');
 const east=resolveMove(3.5,6.5,foot,from);
 assert(east.x>from.x&&east.z===from.z,'向东走了一段后被卧室 B/C 之间的隔墙挡住');
 assert(clampToLayout(east.x,east.z,foot),'停下时位置仍然合法');});
test('合法位置原样返回，且允许家具转出边界时留在原地',()=>{assert.deepEqual(clampToLayout(1.6,6.5,{w:.5,d:.5}),{x:1.6,z:6.5});assert.equal(clampToLayout(0,0,{w:2.7,d:2.8}),null);});
test('家具存档为空或损坏时回落到完整默认摆位',()=>{const full=furnitureDefaults();for(const bad of [null,undefined,{},'x',{items:null},{version:1},{items:{'不存在的家具':{x:1,z:1}}}])assert.deepEqual(restoreLayout(bad),full);});
test('家具存档只覆盖改动项并归一化角度',()=>{const next=restoreLayout({version:LAYOUT_VERSION,items:{sofa:{x:6,z:6.5,rot:-90},'卧室B大床组':{rot:450}}});assert.deepEqual(next.find(f=>f.id==='sofa'),{id:'sofa',name:'客厅沙发',room:'living',x:6,z:6.5,rot:270,rotatable:true});assert.equal(next.find(f=>f.id==='bed-b').x,1.07);assert.equal(next.find(f=>f.id==='bed-b').rot,270);});
test('旧版本的家具存档被整体丢弃，不按 id 套用到重排后的家具上',()=>{const next=restoreLayout({version:LAYOUT_VERSION-1,items:{'wardrobe-s':{x:.35,z:3.42},sofa:{x:6,z:6.5}}});
 assert.deepEqual(next,furnitureDefaults(),'旧版本存档应回落到默认摆位');});
test('非数值的坐标与角度被忽略',()=>{const next=restoreLayout({items:{sofa:{x:'远',z:NaN,rot:'转'}}});assert.equal(next.find(f=>f.id==='sofa').x,8.928);assert.equal(next.find(f=>f.id==='sofa').rot,0);});
test('只有卫生间洁具因净宽不足不可旋转',()=>{const off=furnitureDefaults().filter(f=>!f.rotatable).map(f=>f.id);assert.deepEqual(off,['bath-fixtures']);});
test('每组家具的默认摆位都落在可行走区域内',()=>{for(const f of furnitureDefaults())assert(clampToLayout(f.x,f.z,{w:.3,d:.3}),`${f.name} 的默认锚点越界`);});
test('地面矩形的尺寸与类型完整',()=>{for(const s of slabs){assert(s.w>0&&s.d>0,`${s.room} 尺寸非法`);assert(['wood','tile','bath',undefined].includes(s.type));}});

test('房间尺寸匹配第二张户型图的主要标注',()=>{
 for(const [id,w,d] of [['b',3.197,3.697],['c',2.536,3.697],['a',2.048,2.686],['storage',1.948,2.405],['kitchen',2.093,2.582],['balcony',3.45,1.217]]){
  const r=slabs.find(s=>s.room===id);close(r.w,w);close(r.d,d);
 }
});
test('北侧过道保留台阶形凹口和独立入口',()=>{
 assert(slabs.some(s=>s.room==='entry'));assert(clampToLayout(6.5,.3,{w:.3,d:.3}));
 assert.equal(clampToLayout(5.6,1.1,{w:.3,d:.3}),null,'浴室与过道 A 的隔墙不能填成地面');
 assert(wallSegments.some(s=>s[0]===5.426&&s[1]===-.07),'保留北侧过道外墙');
});
