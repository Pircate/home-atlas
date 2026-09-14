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
 ].map(([id,name,room,type,x,y,z,on,watts])=>({id,name,room,type,x,y,z,on,watts,brightness:80,colorTemperature:3000,temperature:26,volume:35,mode:'自动',running:false}));}
export function applyScene(devices,scene){return devices.map(d=>{
 if(d.type==='light')return {...d,on:(scene==='home'?['living-main','dining-light','floor-light','hall-light','k-main']:scene==='relax'?['floor-light','b-bed']:[]).includes(d.id),brightness:scene==='relax'?45:80};
 if(scene==='away'&&!['fridge','heater'].includes(d.type))return {...d,on:false,running:false};
 return {...d};
});}
export function power(devices){return Math.round(devices.reduce((s,d)=>s+(d.on?d.watts*(d.type==='light'?d.brightness/100:1):0),0));}
export function restore(devices,saved){return devices.map(d=>{
 const v=Array.isArray(saved)?saved.find(s=>s&&s.id===d.id):null;if(!v)return d;
 const result={...d,on:typeof v.on==='boolean'?v.on:d.on};
 for(const [key,min,max] of [['brightness',1,100],['colorTemperature',2700,6500],['temperature',16,30],['volume',0,100]])if(Number.isFinite(v[key]))result[key]=Math.min(max,Math.max(min,v[key]));
 if(['自动','制冷','送风'].includes(v.mode))result.mode=v.mode;
 return result;
});}
