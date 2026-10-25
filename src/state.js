import {ROOMS,WALLS,OPENINGS,WALL_THICKNESS} from './layout.js';
export {OPENINGS};   // 门洞表给测试与模型共用，避免两处各读一次 layout.js
// 房间表与地面矩形全部取自如视 VR 实测数据（见 layout.js），不再手工写死尺寸。
// 房间机位取每间最大一块地面的形心，L 形房间才不会把相机推到空处。
// 铺砖的房间只有阳台：参照效果图里客厅、厨房、过道都是通铺木地板，只有阳台是深灰大砖、
// 卫生间是浅色墙地砖。（原先这四处都当砖地处理，整屋看上去是灰白地面。）
const TILE=new Set(['balcony']);
export const rooms=[{id:'all',name:'全屋',area:72.7,x:4.88,z:5.52},
  ...ROOMS.map(r=>({id:r.id,name:r.name,area:r.area,x:r.label[0],z:r.label[1]}))].sort(
  // 保持原有导航顺序：客厅、三间卧室、厨房、卫生间、储物间、过道、阳台
  (a,b)=>['all','living','b','c','a','kitchen','bath','storage','hall','balcony'].indexOf(a.id)
        -['all','living','b','c','a','kitchen','bath','storage','hall','balcony'].indexOf(b.id));
// 地面矩形：实测房间多边形按格切分的结果。相邻房间在墙中线处严丝合缝，
// 并集即全屋可行走区域；绘制地面与家具边界约束共用这一份数据，不再需要额外的门洞连接块。
export const slabs=ROOMS.flatMap(r=>r.polys.map(([x,z,w,d])=>({room:r.id,x,z,w,d,
  ...(r.id==='bath'?{type:'bath'}:TILE.has(r.id)?{type:'tile'}:{})})));
// 阻滞带：每段墙沿中线左右各 6 厘米，洞口处挖空。
// 实测房间多边形在墙中线处相接，地面并集天然连成一片；「能不能站人、能不能穿过去」
// 由这一层决定——家具落在墙体上、或想从没有门洞的墙上跨过去，都会在这里被挡下。
const HALF=WALL_THICKNESS/2;
// 装修方案（参照效果图）把厨房做成了开放式：厨房南墙整段、以及西墙上那道门洞所在的南段都拆掉，
// 于是厨房与客厅连成一片，冰箱与灶台直接对着岛台。layout.js 是如视实测的原始户型，保持原样不动；
// 这里只声明「哪几段墙在建模与摆位时忽略」，留一份单一清单给两边共用——
// 免得模型里墙已经拆了、家具边界约束里还堵着一面看不见的墙。
export const REMOVED_WALLS=[[7.4503,3.2395,9.6631,3.2395],[7.4503,3.2395,7.4503,2.1453]];
const sameSeg=(a,b)=>(Math.abs(a[0]-b[0])<1e-6&&Math.abs(a[1]-b[1])<1e-6&&Math.abs(a[2]-b[2])<1e-6&&Math.abs(a[3]-b[3])<1e-6)
 ||(Math.abs(a[0]-b[2])<1e-6&&Math.abs(a[1]-b[3])<1e-6&&Math.abs(a[2]-b[0])<1e-6&&Math.abs(a[3]-b[1])<1e-6);
export const isWallRemoved=(x1,z1,x2,z2)=>REMOVED_WALLS.some(s=>sameSeg([x1,z1,x2,z2],s));
const barriers=WALLS.filter(([x1,z1,x2,z2])=>!isWallRemoved(x1,z1,x2,z2)).map(([x1,z1,x2,z2])=>Math.abs(x2-x1)>=Math.abs(z2-z1)
  ?{x0:Math.min(x1,x2),x1:Math.max(x1,x2),z0:z1-HALF,z1:z1+HALF}
  :{x0:x1-HALF,x1:x1+HALF,z0:Math.min(z1,z2),z1:Math.max(z1,z2)});
const gates=OPENINGS.map(o=>o.axis==='x'
  ?{x0:o.cx-o.len/2,x1:o.cx+o.len/2,z0:o.cz-HALF,z1:o.cz+HALF}
  :{x0:o.cx-HALF,x1:o.cx+HALF,z0:o.cz-o.len/2,z1:o.cz+o.len/2});
const within=(r,x,z)=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1;
// 门洞闸门按 1 毫米放宽：洞口坐标与墙中线各自取整后可能差最后一位小数，
// 不放宽就会在门边留一条盖不住的发丝缝，家具明明对着门却过不去。
const EPS=1e-3;
const gated=(g,x,z)=>x>=g.x0-EPS&&x<=g.x1+EPS&&z>=g.z0-EPS&&z<=g.z1+EPS;
const blocked=(x,z)=>barriers.some(b=>within(b,x,z))&&!gates.some(g=>gated(g,x,z));
// 全屋外轮廓（墙中线包围盒）：存档坐标的兜底边界，比写死数字更耐得住重新实测。
export const BOUNDS=WALLS.reduce((b,[x1,z1,x2,z2])=>({x0:Math.min(b.x0,x1,x2),x1:Math.max(b.x1,x1,x2),
  z0:Math.min(b.z0,z1,z2),z1:Math.max(b.z1,z1,z2)}),{x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity});
// 家具分组：每组作为整体移动旋转，锚点是组内局部坐标的原点。
// 卧室保留已确认布局，公共区域按效果图布置，均以实测墙内边界落位。
// 实测家具足迹仅作为原房源参考，装修方案的床宽与朝向以已确认布局为准。
// rot 是绕 Y 轴的度数，床组的「床头」在组内 +z 方向：0=床头朝南、90=朝东、180=朝北、270=朝西。
export function furnitureDefaults(){return [
  ['bed-b','卧室 B 大床 2×1.8米','b',1.25,8.1621,1,270],['bed-c','卧室 C 单人床 2×1.2米','c',4.1274,8.1068,1],
  ['bed-a','卧室 A 床 1.8×1.5米','a',3.2176,2.2709,1,270],['wardrobe-a','卧室 A 一米衣柜','a',2.4976,3.6569,1,90],
  ['wardrobe-b','卧室 B 北墙整墙柜','b',1.7785,5.7151,1],['wardrobe-c','卧室 C 北墙衣柜','c',4.7649,5.7151,1],
  ['bike-cabinet','西墙自行车与展示架','storage',.40,4.08,1],
  ['desk-gaming','电脑桌椅','storage',1.41,3.31,1],
  ['sofa','客厅沙发与边柜','living',9.13,7.14,1],['coffee','客厅茶几','living',8.05,7.10,1],
  ['armchair','客厅单人椅','living',8.10,8.56,1,25],['armchair-n','客厅圆壳椅','living',8.05,5.88,1],
  ['tv-unit','电视柜与绿植','living',6.39,7.20,1],['dining','独立岛台与双人吧椅','kitchen',7.95,3.93,1],
  ['plants-l','客厅绿植','living',9.19,5.13,1],['plants-bal','阳台绿植','balcony',7.52,10.13,1],
  ['kitchen-counter','L形橱柜与北侧水槽','kitchen',8.5567,1.8484,1],['bath-fixtures','淋浴房','bath',5.20,2.33,0],
  ['bath-toilet','马桶','bath',5.64,2.56,1],
  ['bath-vanity','卫生间外置洗手台','hall',5.76,3.80,1],
  ['hall-cabinet','玄关鞋柜','hall',7.22,1.10,1,270],
].map(([id,name,room,x,z,rotatable,rot=0])=>({id,name,room,x,z,rot,rotatable:!!rotatable}));}
// 旋转后的轴对齐包围盒：rot 为 90 度时宽高互换。
export function extentOf({w,d,rot=0}){const c=Math.abs(Math.cos(rot*Math.PI/180)),s=Math.abs(Math.sin(rot*Math.PI/180));return {w:w*c+d*s,d:w*s+d*c};}
// 矩形是否被地面并集完全覆盖，且不压在任何墙体上。按所有边界线（地面矩形、阻滞带、
// 洞口）切出网格逐格判定，比只测四角准确：只测四角会让家具横跨两面墙之间的房间隔断
// （如卧室 B/C 之间 12 厘米的墙）而判定合法；网格也保证洞口两侧不会被一格糊过去。
function covered(x0,x1,z0,z1){
  const xs=new Set([x0,x1]),zs=new Set([z0,z1]);
  const edges=rects=>{for(const r of rects){for(const v of [r.x0??r.x,r.x1??(r.x+r.w)])if(v>x0&&v<x1)xs.add(v);for(const v of [r.z0??r.z,r.z1??(r.z+r.d)])if(v>z0&&v<z1)zs.add(v);}};
  edges(slabs);edges(barriers);edges(gates);
  const X=[...xs].sort((a,b)=>a-b),Z=[...zs].sort((a,b)=>a-b);
  for(let i=0;i<X.length-1;i++)for(let j=0;j<Z.length-1;j++){
    const cx=(X[i]+X[i+1])/2,cz=(Z[j]+Z[j+1])/2;
    if(!slabs.some(s=>cx>=s.x&&cx<=s.x+s.w&&cz>=s.z&&cz<=s.z+s.d))return false;
    if(blocked(cx,cz))return false;
  }
  return true;
}
// inset 默认为 0：地面矩形的边界本身就是「墙内面 / 墙中线」两种情况的混合，
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
export const LAYOUT_VERSION=10;
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
 ['living-main','客厅吊灯','living','light',7.75,2.25,7.19,true,38],
 ['dining-light','岛台吊灯','kitchen','light',7.95,2.18,3.93,true,22],
 ['floor-light','沙发落地灯','living','light',9.13,1.5,8.84,true,9],
 ['tv','客厅电视','living','tv',6.37,1.15,7.20,false,110],
 ['ac-living','客厅空调','living','ac',9.45,2.2,5.31,true,820],
 ['speaker','无线音箱','living','speaker',6.4,.68,6.2,false,12],
 ['b-main','卧室 B 主灯','b','light',1.83,2.35,7.07,false,24],
 ['ac-b','卧室 B 空调','b','ac',.30,2.18,6.6381,false,620],
 ['c-main','卧室 C 主灯','c','light',4.76,2.35,7.12,false,20],
 ['ac-c','卧室 C 空调','c','ac',3.6169,2.18,6.6381,false,580],
 ['a-main','卧室 A 主灯','a','light',3.28,2.35,3.05,false,18],
 ['k-main','厨房吸顶灯','kitchen','light',8.34,2.35,2.01,true,20],
 ['fridge','双门冰箱','kitchen','fridge',9.25,.99,2.9784,true,85],
 ['hood','抽油烟机','kitchen','hood',9.2281,1.72,1.7984,false,180],
 ['stove','电磁灶','kitchen','stove',9.2481,.95,1.7984,false,1200],
 ['bath-main','浴室灯','bath','light',5.24,2.35,2.15,false,18],
 ['heater','热水器','bath','heater',5.46,1.95,1.7,true,1500],
 ['storage-light','储物间灯','storage','light',1.18,2.35,4.07,false,14],
 ['hall-light','过道灯','hall','light',4.14,2.35,4.8,true,12],
 ['balcony-light','阳台壁灯','balcony','light',9.45,1.85,9.88,false,8],
 ['washer','洗衣机','balcony','washer',6.56,.49,9.88,false,450],
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
 for(const [key,min,max] of [['brightness',1,100],['colorTemperature',2700,6500],['temperature',16,30],['volume',0,100],['x',BOUNDS.x0,BOUNDS.x1],['z',BOUNDS.z0,BOUNDS.z1]])if(Number.isFinite(v[key])&&(!d.fixed||!['x','z'].includes(key)))result[key]=Math.min(max,Math.max(min,v[key]));
 if(['自动','制冷','送风'].includes(v.mode))result.mode=v.mode;
 return result;
});}
