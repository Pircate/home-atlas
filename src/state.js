export const rooms = [
  {id:'all',name:'全屋',area:64,x:4.5,z:4.8},
  {id:'living',name:'客厅',area:21.7,x:7.3,z:5.7},
  {id:'b',name:'卧室 B',area:11.8,x:1.6,z:6.5},
  {id:'c',name:'卧室 C',area:9,x:4.4,z:6.5},
  {id:'a',name:'卧室 A',area:5.2,x:3,z:2.3},
  {id:'kitchen',name:'厨房',area:5.2,x:8,z:1.3},
  {id:'bath',name:'卫生间',area:2.7,x:4.8,z:1.9},
  {id:'storage',name:'储物间',area:4.5,x:1,z:3.4},
  {id:'hall',name:'过道',area:5,x:3.7,z:4.1},
  {id:'balcony',name:'阳台',area:4.2,x:7.3,z:9.1},
];
// 地面矩形：前半段是房间区块，后半段是四处门洞连接块。并集即可行走区域，
// 绘制地面与家具边界约束共用这一份数据。连接块不可省——没有它们，各房间之间
// 会留下 4~8 厘米的缝，家具在每个门口都会卡住，无法跨房间搬动。
export const slabs = [
  {room:'storage',x:0,z:2.25,w:1.95,d:2.35},{room:'a',x:2.02,z:.86,w:1.94,d:2.74},
  {room:'bath',x:4.04,z:.86,w:1.59,d:1.77,type:'bath'},{room:'hall',x:1.95,z:3.6,w:3.68,d:1.04,type:'tile'},
  {room:'bath',x:4.04,z:2.63,w:1.59,d:.97,type:'tile'},{room:'b',x:0,z:4.68,w:3.2,d:3.72},
  {room:'c',x:3.28,z:4.68,w:2.35,d:3.72},{room:'living',x:5.71,z:2.57,w:3.42,d:5.83,type:'tile'},
  {room:'living',x:5.71,z:1.67,w:1.2,d:.9,type:'tile'},{room:'kitchen',x:6.99,z:0,w:2.14,d:2.57,type:'tile'},
  {room:'balcony',x:5.71,z:8.46,w:3.42,d:1.2,type:'tile'},
  {room:'hall',x:5.63,z:3.63,w:.08,d:1.01,type:'tile'},{room:'living',x:5.71,z:8.4,w:3.42,d:.06,type:'tile'},
  {room:'c',x:4.32,z:4.64,w:.85,d:.04},{room:'b',x:2.13,z:4.6,w:.85,d:.08},
];
// 家具分组：每组作为整体移动旋转，锚点是组内局部坐标的原点。
export function furnitureDefaults(){return [
  ['bed-b','卧室 B 大床组','b',1.62,6.89,1],['bed-c','卧室 C 床组','c',4.41,6.89,1],
  ['bed-a','卧室 A 单人床','a',2.72,2.43,1],['desk-a','卧室 A 书桌椅','a',3.54,1.44,1],
  ['wardrobe-b','卧室 B 衣柜','b',.38,5.37,1],['wardrobe-c','卧室 C 衣柜','c',4.37,5.04,1],
  ['wardrobe-s','储物间衣柜','storage',.35,3.42,1],['dresser-s','储物间斗柜','storage',1.22,2.58,1],
  ['sofa','客厅沙发','living',8.57,6.58,1],['coffee','客厅茶几','living',7.23,6.64,1],
  ['tv-unit','电视柜','living',5.99,6.48,1],['dining','餐桌与餐椅','living',7.25,4.29,1],
  ['plants-l','客厅绿植','living',8.63,3.11,1],['plants-bal','阳台绿植','balcony',7.08,9.32,1],
  ['kitchen-counter','厨房橱柜','kitchen',8.75,1.28,1],['bath-fixtures','卫浴洁具','bath',4.85,1.76,0],
].map(([id,name,room,x,z,rotatable])=>({id,name,room,x,z,rot:0,rotatable:!!rotatable}));}
// 旋转后的轴对齐包围盒：rot 为 90 度时宽高互换。
export function extentOf({w,d,rot=0}){const c=Math.abs(Math.cos(rot*Math.PI/180)),s=Math.abs(Math.sin(rot*Math.PI/180));return {w:w*c+d*s,d:w*s+d*c};}
// 矩形是否被地面并集完全覆盖。按所有边界线切出网格逐格判定，比只测四角准确：
// 只测四角会让家具横跨两面墙之间的房间隔断（如卧室 B/C 之间 8 厘米的墙）而判定合法。
function covered(x0,x1,z0,z1){
  const xs=new Set([x0,x1]),zs=new Set([z0,z1]);
  for(const s of slabs){for(const v of [s.x,s.x+s.w])if(v>x0&&v<x1)xs.add(v);for(const v of [s.z,s.z+s.d])if(v>z0&&v<z1)zs.add(v);}
  const X=[...xs].sort((a,b)=>a-b),Z=[...zs].sort((a,b)=>a-b);
  for(let i=0;i<X.length-1;i++)for(let j=0;j<Z.length-1;j++){
    const cx=(X[i]+X[i+1])/2,cz=(Z[j]+Z[j+1])/2;
    if(!slabs.some(s=>cx>=s.x&&cx<=s.x+s.w&&cz>=s.z&&cz<=s.z+s.d))return false;
  }
  return true;
}
export function clampToLayout(x,z,footprint,inset=.08){
  const e=extentOf(footprint),hw=e.w/2+inset,hd=e.d/2+inset;
  return covered(x-hw,x+hw,z-hd,z+hd)?{x,z}:null;
}
// 目标位置非法时沿「当前位置 → 目标」的连线逐步试探，取能走到的最远点。
// 只有直接退回原位置会让快速拖动（一步就跨过墙体）表现为家具纹丝不动；
// 逐步试探则保证贴着墙也能滑到位。连线上完全无路可走时，再退化为只动 x、只动 z。
export function resolveMove(x,z,footprint,from){
  if(clampToLayout(x,z,footprint))return {x,z};
  let best=null;
  for(let i=1;i<=8;i++){const t=i/8;const spot=clampToLayout(from.x+(x-from.x)*t,from.z+(z-from.z)*t,footprint);if(!spot)break;best=spot;}
  return best||clampToLayout(x,from.z,footprint)||clampToLayout(from.x,z,footprint)||{x:from.x,z:from.z};
}
export function restoreLayout(saved){
  const items=saved&&typeof saved==='object'&&saved.items&&typeof saved.items==='object'?saved.items:null;
  return furnitureDefaults().map(f=>{
    const v=items?items[f.id]:null;if(!v||typeof v!=='object')return f;
    const result={...f};
    for(const key of ['x','z'])if(Number.isFinite(v[key]))result[key]=v[key];
    if(Number.isFinite(v.rot))result.rot=((v.rot%360)+360)%360;
    return result;
  });
}
// 挂在家具上的设备随之移动旋转；fixed 是装在墙面或天花板上的，都不参与拖动。
const attachments={'b-bed':'bed-b','c-bed':'bed-c','a-desk':'desk-a','tv':'tv-unit','stove':'kitchen-counter'};
const fixedDevices=new Set(['living-main','dining-light','b-main','c-main','a-main','k-main','bath-main','storage-light','hall-light','ac-living','ac-b','ac-c','hood','heater','balcony-light']);
export function createDevices(){return [
 ['living-main','客厅吊灯','living','light',7.3,2.25,6.5,true,38],
 ['dining-light','餐厅吊灯','living','light',7.25,2.18,3.85,true,22],
 ['floor-light','沙发落地灯','living','light',8.55,1.5,7.85,true,9],
 ['tv','客厅电视','living','tv',5.92,1.15,6.5,false,110],
 ['ac-living','客厅空调','living','ac',8.85,2.2,4.7,true,820],
 ['speaker','无线音箱','living','speaker',6,.68,5.55,false,12],
 ['b-main','卧室 B 主灯','b','light',1.65,2.35,6.35,false,24],
 ['b-bed','卧室 B 床头灯','b','light',.48,1.05,7.65,true,6],
 ['ac-b','卧室 B 空调','b','ac',1.55,2.18,4.82,false,620],
 ['c-main','卧室 C 主灯','c','light',4.45,2.35,6.4,false,20],
 ['c-bed','卧室 C 床头灯','c','light',5.12,1.02,7.65,false,6],
 ['ac-c','卧室 C 空调','c','ac',4.3,2.18,4.82,false,580],
 ['a-main','卧室 A 主灯','a','light',3,2.35,2.45,false,18],
 ['a-desk','书桌台灯','a','light',3.55,1.06,1.22,true,5],
 ['k-main','厨房吸顶灯','kitchen','light',7.85,2.35,1.4,true,20],
 ['fridge','双门冰箱','kitchen','fridge',7.2,.99,.47,true,85],
 ['hood','抽油烟机','kitchen','hood',8.67,1.72,1.04,false,180],
 ['stove','电磁灶','kitchen','stove',8.65,.95,1.04,false,1200],
 ['bath-main','浴室灯','bath','light',4.85,2.35,1.95,false,18],
 ['heater','热水器','bath','heater',5.05,1.95,1.06,true,1500],
 ['storage-light','储物间灯','storage','light',1,2.35,3.4,false,14],
 ['hall-light','过道灯','hall','light',3.65,2.35,4.15,true,12],
 ['balcony-light','阳台壁灯','balcony','light',8.84,1.85,9.1,false,8],
 ['washer','洗衣机','balcony','washer',6.16,.49,9.1,false,450],
].map(([id,name,room,type,x,y,z,on,watts])=>({id,name,room,type,x,y,z,on,watts,attach:attachments[id]||null,fixed:fixedDevices.has(id),brightness:80,colorTemperature:3000,temperature:26,volume:35,mode:'自动',running:false}));}
export function applyScene(devices,scene){return devices.map(d=>{
 if(d.type==='light')return {...d,on:(scene==='home'?['living-main','dining-light','floor-light','hall-light','k-main']:scene==='relax'?['floor-light','b-bed']:[]).includes(d.id),brightness:scene==='relax'?45:80};
 if(scene==='away'&&!['fridge','heater'].includes(d.type))return {...d,on:false,running:false};
 return {...d};
});}
export function power(devices){return Math.round(devices.reduce((s,d)=>s+(d.on?d.watts*(d.type==='light'?d.brightness/100:1):0),0));}
export function restore(devices,saved){return devices.map(d=>{
 const v=Array.isArray(saved)?saved.find(s=>s&&s.id===d.id):null;if(!v)return d;
 const result={...d,on:typeof v.on==='boolean'?v.on:d.on};
 for(const [key,min,max] of [['brightness',1,100],['colorTemperature',2700,6500],['temperature',16,30],['volume',0,100],['x',0,9.13],['z',0,9.66]])if(Number.isFinite(v[key]))result[key]=Math.min(max,Math.max(min,v[key]));
 if(['自动','制冷','送风'].includes(v.mode))result.mode=v.mode;
 return result;
});}
