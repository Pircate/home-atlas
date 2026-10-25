import {plan} from './plan.js';
export {slabs} from './plan.js';
import {slabs} from './plan.js';
export const rooms = [
 {id:'all',name:'全屋',area:72.7,x:4.73,z:4.88},
 {id:'living',name:'客厅',area:21.4,x:7.74,z:5.6},
 {id:'b',name:'卧室 B',area:11.8,x:1.6,z:6.55},
 {id:'c',name:'卧室 C',area:9.4,x:4.6,z:6.55},
 {id:'a',name:'卧室 A',area:5.5,x:3.112,z:2.136},
 {id:'kitchen',name:'厨房',area:5.4,x:8.42,z:1.29},
 {id:'bath',name:'卫生间',area:2.7,x:5,z:1.7},
 {id:'storage',name:'储物间',area:4.7,x:.974,z:3.35},
 {id:'entry',name:'过道 A',area:2.3,x:6.4,z:.7},
 {id:'hall',name:'过道 B',area:5.3,x:4,z:4.1},
 {id:'balcony',name:'阳台',area:4.2,x:7.74,z:9.14},
];
// 家具分组：每组作为整体移动旋转，锚点是组内局部坐标的原点。
export function furnitureDefaults(){return [
  ['bed-b','卧室 B 大床 2×1.8米','b',1.07,7.444,1,270],['bed-c','卧室 C 大床 2×1.8米','c',4.407,7.444,1,270],
  ['bed-a','卧室 A 床 1.8×1.5米','a',3.058,1.593,1,270],['wardrobe-a','卧室 A 一米衣柜','a',2.338,2.979,1,90],
  ['wardrobe-b','卧室 B 北墙整墙柜','b',1.5985,4.997,1],['wardrobe-c','卧室 C 北墙衣柜','c',4.605,4.997,1],
  ['wardrobe-s','储物间衣柜','storage',.2,2.612,1],['bike-cabinet','自行车停车柜','storage',.2,3.957,1],
  ['desk-gaming','电竞桌椅','storage',1.25,2.742,1],
  ['sofa','客厅沙发','living',8.928,6.58,1],['coffee','客厅茶几','living',7.59,6.64,1],
  ['tv-unit','电视柜','living',6.293,6.48,1],['dining','餐桌与餐椅','living',7.55,4.29,1],
  ['plants-l','客厅绿植','living',8.96,3.11,1],['plants-bal','阳台绿植','balcony',7.4,9.4,1],
  ['kitchen-counter','厨房橱柜','kitchen',9.108,1.3,1],['bath-fixtures','卫浴洁具','bath',5.06,1.7,0],
].map(([id,name,room,x,z,rotatable,rot=0])=>({id,name,room,x,z,rot,rotatable:!!rotatable}));}
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
// inset 默认为 0：地面矩形的边界本身就是「墙内面 / 墙中线 / 墙里」三种情况的混合，
// 再加固定内缩会把原本贴墙的默认摆位判成非法（选中后拖不动，看着像卡死）。
// 不穿墙由未覆盖的墙体条带保证，不依赖内缩。
export function clampToLayout(x,z,footprint,inset=0){
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
// 家具摆位的存档版本。房间重排、旧摆位不再适用时递增，
// 让旧存档整体失效一次——否则按 id 套用旧坐标会和重排后的家具重叠。
export const LAYOUT_VERSION=5;
export function restoreLayout(saved){
  const items=saved&&saved.version===LAYOUT_VERSION&&saved.items&&typeof saved.items==='object'?saved.items:null;
  return furnitureDefaults().map(f=>{
    const v=items?items[f.id]:null;if(!v||typeof v!=='object')return f;
    const result={...f};
    for(const key of ['x','z'])if(Number.isFinite(v[key]))result[key]=v[key];
    if(Number.isFinite(v.rot))result.rot=((v.rot%360)+360)%360;
    return result;
  });
}
// 挂在家具上的设备随之移动旋转；fixed 是装在墙面或天花板上的，都不参与拖动。
const attachments={'tv':'tv-unit','stove':'kitchen-counter'};
const fixedDevices=new Set(['living-main','dining-light','b-main','c-main','a-main','k-main','bath-main','storage-light','hall-light','ac-living','ac-b','ac-c','hood','heater','balcony-light']);
export function createDevices(){return [
 ['living-main','客厅吊灯','living','light',7.74,2.25,6.5,true,38],
 ['dining-light','餐厅吊灯','living','light',7.55,2.18,3.85,true,22],
 ['floor-light','沙发落地灯','living','light',8.91,1.5,7.85,true,9],
 ['tv','客厅电视','living','tv',6.223,1.15,6.5,false,110],
 ['ac-living','客厅空调','living','ac',9.283,2.2,4.7,true,820],
 ['speaker','无线音箱','living','speaker',6.3,.68,5.55,false,12],
 ['b-main','卧室 B 主灯','b','light',1.65,2.35,6.35,false,24],
 ['ac-b','卧室 B 空调','b','ac',.12,2.18,5.92,false,620],
 ['c-main','卧室 C 主灯','c','light',4.605,2.35,6.4,false,20],
 ['ac-c','卧室 C 空调','c','ac',3.457,2.18,5.92,false,580],
 ['a-main','卧室 A 主灯','a','light',3.112,2.35,2.2,false,18],
 ['k-main','厨房吸顶灯','kitchen','light',8.42,2.35,1.4,true,20],
 ['fridge','双门冰箱','kitchen','fridge',7.755,.99,.4,true,85],
 ['hood','抽油烟机','kitchen','hood',9.028,1.72,1.06,false,180],
 ['stove','电磁灶','kitchen','stove',9.008,.95,1.06,false,1200],
 ['bath-main','浴室灯','bath','light',5.06,2.35,1.7,false,18],
 ['heater','热水器','bath','heater',5.2,1.95,.98,true,1500],
 ['storage-light','储物间灯','storage','light',.974,2.35,3.35,false,14],
 ['hall-light','过道灯','hall','light',3.65,2.35,4.15,true,12],
 ['balcony-light','阳台壁灯','balcony','light',9.283,1.85,9.15,false,8],
 ['washer','洗衣机','balcony','washer',6.42,.49,9.15,false,450],
].map(([id,name,room,type,x,y,z,on,watts])=>({id,name,room,type,x,y,z,on,watts,attach:attachments[id]||null,fixed:fixedDevices.has(id),brightness:80,colorTemperature:3000,temperature:26,volume:35,mode:'自动',running:false}));}
export function applyScene(devices,scene){return devices.map(d=>{
 if(d.type==='light')return {...d,on:(scene==='home'?['living-main','dining-light','floor-light','hall-light','k-main']:scene==='relax'?['floor-light']:[]).includes(d.id),brightness:scene==='relax'?45:80};
 if(scene==='away'&&!['fridge','heater'].includes(d.type))return {...d,on:false,running:false};
 return {...d};
});}
export function power(devices){return Math.round(devices.reduce((s,d)=>s+(d.on?d.watts*(d.type==='light'?d.brightness/100:1):0),0));}
export function restore(devices,saved){return devices.map(d=>{
 const v=Array.isArray(saved)?saved.find(s=>s&&s.id===d.id):null;if(!v)return d;
 const result={...d,on:typeof v.on==='boolean'?v.on:d.on};
 for(const [key,min,max] of [['brightness',1,100],['colorTemperature',2700,6500],['temperature',16,30],['volume',0,100],['x',0,plan.width],['z',0,plan.depth]])if(Number.isFinite(v[key])&&(!d.fixed||!['x','z'].includes(key)))result[key]=Math.min(max,Math.max(min,v[key]));
 if(['自动','制冷','送风'].includes(v.mode))result.mode=v.mode;
 return result;
});}
