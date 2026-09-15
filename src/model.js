import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {rooms,slabs,resolveMove,clampToLayout,LAYOUT_VERSION} from './state.js';

export function createHome(container,initialDevices,initialLayout,{onSelect,onFurniture,onLayout}={}){
 const layout=new Map(initialLayout.map(f=>[f.id,f]));
 const scene=new T.Scene();
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;container.appendChild(renderer.domElement);
 const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment();
 const environmentMap=pmrem.fromScene(environment,.04);scene.environment=environmentMap.texture;scene.environmentIntensity=.3;environment.dispose();pmrem.dispose();
 const camera=new T.PerspectiveCamera(38,1,.1,100);camera.position.set(12,13.7,18);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(4.5,.1,4.9);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=4;controls.maxDistance=30;controls.minPolarAngle=.02;controls.maxPolarAngle=Math.PI*.46;
 const home=new T.Group();scene.add(home);
 const hemi=new T.HemisphereLight('#eef2ff','#a09078',1.1);scene.add(hemi);
 const sun=new T.DirectionalLight('#fff2dc',2.3);sun.position.set(-5,12,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13});sun.shadow.normalBias=.035;scene.add(sun);
 const cache=new Map();
 function mat(color,roughness=.8,metalness=0){const key=`${color}/${roughness}/${metalness}`;if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color,roughness,metalness}));return cache.get(key);}
 const cream=mat('#e9e4d9'),white=mat('#f2eee5'),wood=mat('#a78159'),sage=mat('#879781'),dark=mat('#333c36'),brass=mat('#ac8952',.3,.65),black=mat('#202829',.35),fabric=mat('#cec5b4');
 function box(parent,x,y,z,w,h,d,m,r=0){const mesh=new T.Mesh(r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function cylinder(parent,x,y,z,rt,rb,h,m){const mesh=new T.Mesh(new T.CylinderGeometry(rt,rb,h,24),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function ball(parent,x,y,z,r,m,scale=[1,1,1]){const mesh=new T.Mesh(new T.SphereGeometry(r,20,12),m);mesh.position.set(x,y,z);mesh.scale.set(...scale);mesh.castShadow=true;parent.add(mesh);return mesh;}
 function texture(kind){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');let seed=37;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
  ctx.fillStyle=kind==='wood'?'#c2a17a':'#c7c1ae';ctx.fillRect(0,0,512,512);
  if(kind==='wood')for(let row=0;row<8;row++){ctx.fillStyle=`hsl(34,30%,${64+rand()*8}%)`;ctx.fillRect(0,row*64,512,63);for(let i=0;i<65;i++){ctx.strokeStyle=`rgba(93,63,31,${rand()*.13})`;const y=row*64+rand()*63;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(140,y+2,350,y-3,512,y);ctx.stroke();}ctx.fillStyle='#ab8d67';ctx.fillRect((row%3)*170,row*64,1,64);}
  else for(let i=0;i<512;i+=3){ctx.strokeStyle=i%2?'#a9a59044':'#f4efd455';ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();}
  const t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(2,2);t.colorSpace=T.SRGBColorSpace;return t;
 }
 const timber=new T.MeshStandardMaterial({map:texture('wood'),roughness:.78});const rugMaterial=new T.MeshStandardMaterial({map:texture('fabric'),roughness:1});
 function floor(x,z,w,d,type='wood'){
  box(home,x+w/2,-.18,z+d/2,w,.34,d,mat('#d0c8b8'),.025);box(home,x+w/2,.005,z+d/2,w,.03,d,type==='wood'?timber:mat(type==='bath'?'#adb8af':'#ded9cc'));
  if(type!=='wood'){for(let a=.6;a<w;a+=.6)box(home,x+a,.022,z+d/2,.007,.002,d,mat('#c4c4b8'));for(let a=.6;a<d;a+=.6)box(home,x+w/2,.022,z+a,w,.002,.007,mat('#c4c4b8'));}
 }
 // 以户型图北向为 -Z，各房间地面独立，保留不规则外轮廓。矩形同时是家具的可行走边界。
 for(const s of slabs)floor(s.x,s.z,s.w,s.d,s.type);
 const walls=[];
 function wall(x1,z1,x2,z2,window=false){const length=Math.hypot(x2-x1,z2-z1);const group=new T.Group();group.position.set((x1+x2)/2,0,(z1+z2)/2);group.rotation.y=-Math.atan2(z2-z1,x2-x1);home.add(group);
  const wm=mat('#e5e0d4').clone();wm.transparent=true;const pieces=[];
  box(group,0,.095,0,length,.19,.13,cream);pieces.push(box(group,0,window?.59:1.42,0,length,window?.8:2.45,.13,wm));pieces.push(box(group,0,2.66,0,length,.055,.15,wm));
  if(window){for(const x of [-length/2+.04,0,length/2-.04])pieces.push(box(group,x,1.82,0,.035,1.64,.06,wm));pieces.push(box(group,0,1.02,0,length,.055,.19,wm));const glass=new T.MeshStandardMaterial({color:'#a7c5be',roughness:.08,transparent:true,opacity:.12,depthWrite:false});pieces.push(box(group,0,1.82,0,length-.12,1.57,.02,glass));}
  const bounds=new T.Box3().setFromObject(group);walls.push({group,wm,pieces,bounds,target:1});
 }
 wall(0,2.25,0,8.4);wall(0,2.25,1.95,2.25,true);wall(1.98,.86,1.98,2.25);wall(1.98,.86,3.96,.86,true);wall(4.04,.86,5.63,.86,true);wall(4,.86,4,3.6);wall(5.67,.86,5.67,3.63);wall(4.04,2.65,4.43,2.65);wall(5.22,2.65,5.63,2.65);
 wall(2.02,3.62,2.84,3.62);wall(3.68,3.62,4,3.62);wall(1.98,2.25,1.98,3.7);wall(1.98,4.43,1.98,4.65);wall(0,4.64,2.13,4.64);wall(2.98,4.64,4.32,4.64);wall(5.17,4.64,5.67,4.64);wall(3.24,4.68,3.24,8.43);wall(5.67,4.64,5.67,8.43);
 wall(0,8.43,3.2,8.43,true);wall(3.28,8.43,5.63,8.43,true);wall(5.67,8.43,5.67,9.66);wall(5.67,9.66,9.13,9.66,true);wall(9.13,0,9.13,9.66);wall(6.99,0,9.13,0);wall(6.99,0,6.99,1.67,true);wall(6.99,2.43,6.99,2.57);wall(7.82,2.57,9.13,2.57);wall(5.67,1.67,6.99,1.67);
 box(home,7.42,.03,8.44,3.38,.04,.065,brass);
 // 地毯是贴地薄片，一旦并入床组或沙发组，包围盒会被撑到 2.7 米以上，在卧室里再也转不开，故作为固定装饰。
 function rug(x,z,w,d){box(home,x,.04,z,w,.035,d,rugMaterial,.04);}
 rug(1.65,6.8,2.7,2.8);rug(7.47,6.63,2.5,2.82);
 function plant(parent,x,z,height=1){cylinder(parent,x,.18,z,.15,.11,.36,mat('#baa78d'));for(let i=0;i<8;i++){const a=i*2.4;const stem=cylinder(parent,x,.4+height*.2,z,.01,.012,height*.65,wood);stem.rotation.z=Math.sin(a)*.2;const leaf=ball(parent,x+Math.sin(a)*.16,.44+height*(.25+i*.045),z+Math.cos(a)*.17,.17,mat(i%2?'#657b52':'#81916b'),[.65,1.65,.7]);leaf.rotation.z=Math.sin(a)*.6;}}
 function bed(parent,x,z,w,color){const group=new T.Group();group.position.set(x,0,z);parent.add(group);box(group,0,.22,0,w,.32,2.03,wood,.06);box(group,0,.46,0,w+.02,.25,2.02,white,.075);box(group,0,.57,-.3,w+.06,.16,1.4,mat(color),.065);box(group,0,.77,1,w+.14,1.12,.16,fabric,.06);
  for(const px of [-w*.25,w*.25])box(group,px,.65,.69,w*.42,.17,.43,white,.075);for(let i=0;i<7;i++)box(group,-w/2+.06+i*(w-.12)/6,.656,-.38,.014,.006,.9,mat(color),.003);
 }
 function wardrobe(parent,x,z,w,d){box(parent,x,1.1,z,w,2.16,d,cream,.025);for(let i=-w/2+.43;i<w/2;i+=.48){box(parent,x+i,1.1,z+d/2+.006,.009,2.04,.009,mat('#c5bcaa'));box(parent,x+i-.065,1.06,z+d/2+.03,.02,.29,.027,brass);}}
 // 家具按件分组：每组是一个整体，可一起移动和旋转，组内一律用相对锚点的局部坐标。
 // 名称、房间、可旋转性与锚点都取自 state.js 的 furnitureDefaults()，这里只负责造型，
 // 免得默认摆位在两边各写一份、日后必然走样。
 const furniture=[];
 function furnishing(id,build){
  const spec=layout.get(id);if(!spec)return;
  const group=new T.Group();group.position.set(spec.x,0,spec.z);group.rotation.y=spec.rot*Math.PI/180;home.add(group);build(group);
  const spin=group.rotation.y;group.rotation.y=0;group.updateMatrixWorld(true);
  const size=new T.Box3().setFromObject(group).getSize(new T.Vector3());group.rotation.y=spin;group.updateMatrixWorld(true);
  group.userData.furnishing=id;   // 拾取时沿父链回溯到这里就知道点中了哪件家具
  furniture.push({...spec,group,footprint:{w:size.x,d:size.z,h:size.y}});
 }
 furnishing('bed-b',g=>{bed(g,0,0,1.6,'#7e8974');box(g,-1.15,.31,.77,.52,.54,.49,wood,.03);box(g,1.11,.31,.77,.45,.54,.49,wood,.03);});
 furnishing('bed-c',g=>{bed(g,0,0,1.43,'#b49c86');box(g,.71,.3,.77,.42,.53,.46,wood,.03);});
 furnishing('bed-a',g=>bed(g,0,0,1.03,'#889c98'));
 furnishing('desk-a',g=>{box(g,0,.75,-.22,.63,.06,.54,wood,.025);for(const x of [-.23,.23])box(g,x,.37,-.22,.04,.75,.4,wood);box(g,.03,.4,.26,.38,.12,.38,sage,.035);box(g,.03,.6,.45,.38,.42,.07,sage,.03);});
 furnishing('wardrobe-b',g=>wardrobe(g,0,0,.61,1.1));
 furnishing('wardrobe-c',g=>wardrobe(g,0,0,1.95,.5));
 // 储物间按布局图改作电竞房：西南自行车柜、西北衣柜、东北电竞桌椅。
 // 衣柜贴着西墙，柜门要朝东开，所以套一层绕 Y 转 90 度的子组——wardrobe() 的柜门固定开在 +z 面。
 furnishing('wardrobe-s',g=>{const door=new T.Group();door.rotation.y=Math.PI/2;g.add(door);wardrobe(door,0,0,.92,.40);});
 furnishing('bike-cabinet',g=>{
  // 柜体用比墙面（#e5e0d4）更亮的白，背板压深一档，否则整柜会和墙糊成一片、读不出体积。
  const shell=mat('#fbfaf5',.85),shelf=mat('#eceae1',.85),back=mat('#dedbcf',.9),tyre=mat('#2b2f30',.55),alloy=mat('#6f7674',.35,.5);
  box(g,0,.02,0,.40,.04,1.20,shell,.01);box(g,0,1.99,0,.40,.03,1.20,shell,.01);      // 底板与顶板
  box(g,-.19,1,0,.02,1.97,1.20,back);for(const z of [-.59,.59])box(g,0,1,z,.40,1.97,.02,shell);   // 背板与侧板
  for(const y of [.62,1.18,1.74])box(g,0,y,0,.36,.02,1.16,shelf);                   // 层板
  // 立挂的公路车：先在「轮轴为 y=0」的局部系里造平面剪影，再整体绕 X 立起来，
  // 这样车头朝上、车身贴背板，和实拍里那辆车一致。
  const bike=new T.Group();bike.position.set(0,.98,0);bike.rotation.x=-Math.PI/2;g.add(bike);
  for(const z of [-.52,.52]){const wheel=new T.Mesh(new T.TorusGeometry(.335,.024,8,28),tyre);wheel.rotation.y=Math.PI/2;wheel.position.set(0,0,z);wheel.castShadow=true;bike.add(wheel);
   const hub=cylinder(bike,0,0,z,.03,.03,.045,alloy);hub.rotation.z=Math.PI/2;}
  const tube=(a,b,r)=>{const dir=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const len=dir.length();
   const m=new T.Mesh(new T.CylinderGeometry(r,r,len,8),mat('#f0efe9',.4,.25));m.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
   m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());m.castShadow=true;bike.add(m);};
  const bb=[0,-.06,-.05],seat=[0,.40,-.26],head=[0,.24,.40];
  tube([0,0,-.52],bb,.021);tube(bb,[0,0,.52],.021);tube(bb,seat,.018);tube(seat,[0,0,-.52],.015);tube(head,[0,0,.52],.018);tube(seat,head,.017);
  box(bike,0,.45,-.29,.05,.03,.26,tyre,.012);                                        // 坐垫
  const bar=cylinder(bike,0,.30,.42,.016,.016,.34,tyre);bar.rotation.z=Math.PI/2;    // 车把（横出车身平面）
 });
 furnishing('desk-gaming',g=>{
  const steel=mat('#4a5350',.4,.4),dark=mat('#2b2f30',.5,.2);
  box(g,0,.72,0,1.36,.045,.75,mat('#3a4340',.5,.15),.02);                            // 桌面 1.36×0.75
  for(const x of [-.62,.62])for(const z of [-.30,.30])box(g,x,.36,z,.05,.72,.05,steel);
  box(g,0,.10,0,1.20,.03,.06,steel);
  for(const x of [-.30,.30])for(const z of [-.28,.28])box(g,x,.02,z,.09,.05,.09,dark);
  box(g,.10,.79,-.52,.11,.16,.09,dark);box(g,.10,.90,-.52,.05,.32,.05,dark);box(g,.10,1.12,-.52,.62,.36,.02,mat('#1c2422',.4));   // 显示器
  box(g,.10,.752,-.20,.46,.02,.15,dark,.01);                                         // 键盘
  const chair=new T.Group();chair.position.set(.16,0,.39);g.add(chair);              // 主位椅子，落在 x≈1.35
  for(let i=0;i<5;i++){const a=i*1.2566;const arm=box(chair,Math.sin(a)*.16,.05,Math.cos(a)*.16,.05,.03,.30,dark,.012);arm.rotation.y=-a;}
  cylinder(chair,0,.25,0,.035,.035,.34,mat('#5a6360',.4,.5));
  box(chair,0,.45,0,.48,.09,.46,mat('#3a4340',.6),.04);                              // 坐垫
  box(chair,0,.78,.24,.44,.66,.09,mat('#3a4340',.6),.045);                           // 靠背朝南，人面向北边的桌子
  for(const x of [-.25,.25])box(chair,x,.60,0,.05,.16,.04,dark);
 });
 // 客厅软装，沙发靠东墙，电视面向沙发。
 furnishing('sofa',g=>{
  box(g,-.01,.23,0,.86,.3,2.68,wood,.07);box(g,.33,.66,0,.2,.83,2.73,fabric,.08);
  for(const z of [-.89,0,.89]){box(g,-.08,.45,z,.7,.24,.86,cream,.08);box(g,.2,.79,z,.23,.57,.78,cream,.07);}
  for(const z of [-1.37,1.37])box(g,-.01,.53,z,.9,.55,.2,fabric,.065);
  for(const [z,color] of [[-.96,'#7d8d72'],[.08,'#c2a581'],[.82,'#eee6d5']]){const cushion=box(g,-.09,.74,z,.21,.4,.44,mat(color),.055);cushion.rotation.z=.25;cushion.rotation.x=.14;}
 });
 furnishing('coffee',g=>{box(g,0,.37,.01,.92,.115,1.36,wood,.1);for(const z of [-.47,.44])cylinder(g,0,.18,z,.19,.23,.33,dark);
  box(g,.02,.447,.34,.3,.027,.35,cream);box(g,.05,.468,.34,.29,.018,.32,sage);cylinder(g,-.02,.53,-.32,.11,.075,.19,mat('#6e6351'));ball(g,-.02,.65,-.32,.15,sage,[1,.35,1]);});
 furnishing('tv-unit',g=>{box(g,0,.29,0,.43,.48,2.42,wood,.045);for(const z of [-.83,0,.83])box(g,.224,.33,z,.008,.01,.65,brass);});
 furnishing('dining',g=>{cylinder(g,0,.76,-.44,.64,.64,.08,wood);cylinder(g,0,.39,-.44,.16,.3,.72,dark);cylinder(g,0,.87,-.44,.085,.065,.18,cream);
  for(const [x,z,rotation] of [[-.88,-.44,-Math.PI/2],[.88,-.44,Math.PI/2],[0,.44,0]]){const chair=new T.Group();chair.position.set(x,0,z);chair.rotation.y=rotation;g.add(chair);box(chair,0,.43,0,.47,.12,.45,sage,.065);box(chair,0,.66,.21,.47,.48,.08,sage,.04);for(const dx of [-.16,.16])for(const dz of [-.15,.15])box(chair,dx,.2,dz,.035,.4,.035,wood);}});
 furnishing('plants-l',g=>plant(g,0,0,1.1));
 furnishing('plants-bal',g=>plant(g,0,0,.8));
 // 厨房柜体、工作台、水槽和卫生间。
 furnishing('kitchen-counter',g=>{box(g,.02,.45,0,.63,.88,2.33,sage,.025);box(g,0,.91,0,.71,.06,2.36,white,.025);for(const z of [-.85,-.01,.78])box(g,-.303,.56,z,.02,.018,.34,brass);
  box(g,-.04,.945,.77,.46,.016,.47,mat('#89988f',.26,.65),.04);box(g,-.04,.952,.77,.35,.018,.35,dark,.03);cylinder(g,.17,1.07,.77,.022,.022,.24,brass);box(g,.13,1.19,.77,.1,.035,.04,brass,.01);});
 furnishing('bath-fixtures',g=>{box(g,-.47,.42,-.61,.5,.76,.38,white,.06);cylinder(g,-.47,.27,-.13,.18,.21,.5,white);ball(g,-.47,.52,-.09,.28,white,[.88,.3,1.32]);
  box(g,.46,.7,.5,.51,.12,.46,white,.08);box(g,.5,1.44,.79,.43,.68,.03,mat('#a5beb2',.12,.88),.04);});
 const visuals=new Map(),clickable=[];let devices=initialDevices;
 for(const d of devices){
  // 台灯、电视、电磁灶挂在对应家具上，由场景图的父子变换带动旋转，无需手工换算偏移。
  const host=d.attach?furniture.find(f=>f.id===d.attach):null;
  const group=new T.Group();group.position.set(host?d.x-host.x:d.x,d.y,host?d.z-host.z:d.z);(host?host.group:home).add(group);let glow,light,screen,rotor;
  if(d.type==='light'){
   const low=d.id==='floor-light'||d.id.endsWith('-bed')||d.id==='a-desk';
   if(low){const bottom=d.id==='floor-light'?0:.6;cylinder(group,0,bottom-d.y+.02,0,.16,.19,.05,dark);cylinder(group,0,(bottom-d.y)/2,0,.015,.015,d.y-bottom,brass);glow=cylinder(group,0,0,0,.16,.25,.26,white.clone());}
   else{cylinder(group,0,.14,0,.014,.014,.28,brass);glow=cylinder(group,0,0,0,d.room==='living'?.3:.2,d.room==='living'?.38:.23,.12,white.clone());}
   glow.castShadow=false;light=new T.SpotLight('#ffd19a',0,5,Math.PI*.42,.8,1.7);light.position.set(0,-.17,0);light.target.position.set(0,-d.y,0);light.castShadow=true;light.shadow.mapSize.set(256,256);light.shadow.normalBias=.04;group.add(light,light.target);
  }else if(d.type==='tv'){
   box(group,0,0,0,.08,1.01,1.63,black,.04);screen=box(group,.047,0,0,.01,.88,1.49,mat('#192b29').clone(),.01);box(group,0,-.56,0,.23,.045,.63,black,.02);
  }else if(d.type==='ac'){
   const side=d.room==='living';box(group,0,0,0,side?.24:1.03,.31,side?1.03:.24,white,.06);for(let i=0;i<5;i++)box(group,side?-.125:0,-.085+i*.02,side?0:.125,side?.012:.87,.007,side?.87:.012,mat('#b0b8ac'));glow=ball(group,side?-.13:.39,.07,side?.38:.13,.02,mat('#6aac8c').clone());
  }else if(d.type==='fridge'){
   box(group,0,0,0,.67,1.9,.66,mat('#9ea9a2',.34,.45),.045);box(group,0,.2,.334,.015,1.37,.012,dark);box(group,0,-.5,.335,.61,.014,.01,dark);for(const x of [-.065,.065])box(group,x,.16,.36,.025,.48,.03,dark,.01);
  }else if(d.type==='washer'){
   box(group,0,0,0,.67,.88,.63,white,.04);const door=cylinder(group,0,-.03,.335,.237,.237,.055,black);door.rotation.x=Math.PI/2;rotor=new T.Group();rotor.position.set(0,-.03,.371);group.add(rotor);const drum=cylinder(rotor,0,0,0,.18,.18,.02,mat('#6e8983',.15,.65));drum.rotation.x=Math.PI/2;for(let i=0;i<3;i++){const fin=box(rotor,Math.cos(i*2.094)*.07,Math.sin(i*2.094)*.07,.015,.025,.14,.012,mat('#c0ccc3',.3,.5),.008);fin.rotation.z=i*2.094;}box(group,-.17,.32,.329,.12,.05,.013,dark);ball(group,.2,.32,.34,.04,brass);
  }else if(d.type==='hood'){
   box(group,0,0,0,.52,.14,.68,mat('#7c8a83',.3,.6),.025);box(group,.08,.26,0,.32,.48,.34,dark,.015);
  }else if(d.type==='stove'){
   box(group,0,0,0,.52,.025,.67,black,.015);glow=[];for(const z of [-.17,.17]){const ring=new T.Mesh(new T.TorusGeometry(.12,.008,8,28),brass.clone());ring.rotation.x=-Math.PI/2;ring.position.set(0,.025,z);group.add(ring);glow.push(ring);}
  }else if(d.type==='heater'){
   const tank=cylinder(group,0,0,0,.23,.23,.72,white);tank.rotation.z=Math.PI/2;box(group,0,-.17,.14,.21,.11,.06,dark,.02);
  }else if(d.type==='speaker'){
   cylinder(group,0,0,0,.11,.12,.27,dark);glow=cylinder(group,0,.139,0,.085,.085,.008,mat('#87b89f').clone());
  }
  // 命中盒是 group 的子节点，尺寸与中心必须换算到 group 的局部坐标系；挂载设备的父级带旋转，
  // 用世界坐标减去 group.position 会算错。
  group.updateMatrixWorld(true);const local=new T.Box3().setFromObject(group).applyMatrix4(new T.Matrix4().copy(group.matrixWorld).invert());
  const size=local.getSize(new T.Vector3()).max(new T.Vector3(.32,.24,.32)),center=local.getCenter(new T.Vector3());
  const hit=new T.Mesh(new T.BoxGeometry(size.x,size.y,size.z),new T.MeshBasicMaterial({visible:false}));hit.position.copy(center);hit.userData.device=d.id;group.add(hit);clickable.push(hit);visuals.set(d.id,{group,glow,light,screen,rotor});
 }
 // 家具不做包围盒命中体，直接拾取真实几何：包围盒会把家具之间的空隙也占满，
 // 从默认机位看储物间时，桌椅组的空盒子会挡住后面的衣柜，点衣柜反而选中桌子。
 // 多盏聚光灯的 ShadowMaterial 会把光锥外区域也计为阴影；底座仅使用柔和接触影。
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const shadowContext=shadowCanvas.getContext('2d');const shadowGradient=shadowContext.createRadialGradient(64,64,20,64,64,64);shadowGradient.addColorStop(0,'rgba(48,55,39,.2)');shadowGradient.addColorStop(.6,'rgba(48,55,39,.11)');shadowGradient.addColorStop(1,'rgba(48,55,39,0)');shadowContext.fillStyle=shadowGradient;shadowContext.fillRect(0,0,128,128);
 const ground=new T.Mesh(new T.PlaneGeometry(16,16),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));ground.rotation.x=-Math.PI/2;ground.position.set(4.5,-.36,4.8);scene.add(ground);
 const ring=new T.Mesh(new T.RingGeometry(.31,.335,60),new T.MeshBasicMaterial({color:'#b9944f',transparent:true,opacity:.95,side:T.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;ring.renderOrder=10;scene.add(ring);
 // 布置模式的选中环与旋转手柄。手柄位于家具正北方向的环上，拖动它即绕锚点旋转。
 const halo=new T.Mesh(new T.RingGeometry(.42,.455,72),new T.MeshBasicMaterial({color:'#b9944f',transparent:true,opacity:.9,side:T.DoubleSide,depthTest:false}));halo.rotation.x=-Math.PI/2;halo.renderOrder=11;halo.visible=false;scene.add(halo);
 const grip=new T.Group();grip.visible=false;scene.add(grip);ball(grip,0,0,0,.062,brass.clone());
 const gripHit=new T.Mesh(new T.SphereGeometry(.2,8,6),new T.MeshBasicMaterial({visible:false}));grip.add(gripHit);
 let night=false,wallMode='auto',selected=null,tween=null,down=null,lastTime=0,wallCounter=0,view='all';
 let layoutMode=false,focusFurniture=null,drag=null,rotDrag=null,wallDirty=true;
 const overviewPosition=()=>new T.Vector3(4.5,.1,4.9).add(new T.Vector3(7.5,13.6,13.1).multiplyScalar(Math.max(1,1.15/camera.aspect)));
 const pickRay=new T.Raycaster(),pointer=new T.Vector2(),dragPlane=new T.Plane(new T.Vector3(0,1,0),0),planeHit=new T.Vector3();
 const idleCursor=()=>layoutMode?'default':'grab';
 function aim(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);pickRay.setFromCamera(pointer,camera);}
 function pick(e){aim(e);return pickRay.intersectObjects(clickable,false)[0]?.object.userData.device;}
 // 沿父链回溯判定点中了谁。挂在柜子上的台灯、电视其祖先就是家具组，算作家具；
 // 而设备自己的不可见命中盒带 userData.device，遇到就跳过这一条交点、继续找下一个。
 function hitFurniture(e){aim(e);
  for(const h of pickRay.intersectObjects(furniture.map(f=>f.group),true)){
   let o=h.object;while(o&&!o.userData.furnishing&&!o.userData.device)o=o.parent;
   if(o?.userData.furnishing)return o.userData.furnishing;
  }
  return null;
 }
 // 贴地拖动只取交点的 x/z，各物体保持原有高度，吸顶灯与壁挂空调不会被拽到地面。
 // 视线接近水平时交点会跑到极远处甚至无解，此时丢弃该帧而不是把家具甩出去。
 function groundPoint(e){aim(e);return pickRay.ray.intersectPlane(dragPlane,planeHit)&&Math.abs(planeHit.x)<40&&Math.abs(planeHit.z)<40?{x:planeHit.x,z:planeHit.z}:null;}
 // 绕 Y 轴旋转 θ 后，局部 (0,0,-r) 的世界偏移是 (-r·sinθ,-r·cosθ)，反解即 atan2(-dx,-dz)。
 // 手柄绘制与角度计算必须共用这一套约定，否则拖动方向与鼠标相反。
 const bearing=(p,c)=>Math.atan2(-(p.x-c.x),-(p.z-c.z));
 const focused=()=>furniture.find(f=>f.id===focusFurniture);
 function syncFurniture(){const f=focused();halo.visible=!!f&&layoutMode;grip.visible=!!f&&layoutMode&&f.rotatable;wallDirty=true;
  if(!f)return;const r=Math.max(f.footprint.w,f.footprint.d)/2+.22,rot=f.group.rotation.y;
  halo.position.set(f.group.position.x,.07,f.group.position.z);halo.userData.base=r/.4375;halo.scale.setScalar(r/.4375);
  grip.position.set(f.group.position.x-Math.sin(rot)*r,.07,f.group.position.z-Math.cos(rot)*r);
 }
 function selectFurniture(id){focusFurniture=id;selected=null;ring.visible=false;syncFurniture();onFurniture?.(id);}
 // 旋转同样要守住边界，但贴着墙的家具（比如沙发默认就顶着东墙）在默认位一转身就会
 // 捅进墙里。直接禁止会让用户以为坏了，因此在附近由近及远找一个放得下的落点，边转边让位；
 // 实在腾不出地方才退回原角度。
 function fitNear(f,foot){const {x,z}=f.group.position;
  for(const d of [.1,.2,.3,.4,.5,.6,.7,.8])for(const [dx,dz] of [[-d,0],[d,0],[0,-d],[0,d],[-d,-d],[d,-d],[-d,d],[d,d]]){
   const spot=clampToLayout(x+dx,z+dz,foot);if(spot)return spot;}
  return null;
 }
 function spinTo(f,rot){const keep=f.group.rotation.y,foot={w:f.footprint.w,d:f.footprint.d,rot:rot*180/Math.PI};
  if(clampToLayout(f.group.position.x,f.group.position.z,foot)){f.group.rotation.y=rot;return true;}
  const spot=fitNear(f,foot);if(!spot)return false;
  f.group.position.set(spot.x,0,spot.z);f.group.rotation.y=rot;return true;}
 // 抓取家具时关掉 OrbitControls：它的 onPointerDown 此刻已经跑过（注册更早），但 onPointerMove
 // 每次都会重新检查 enabled，所以后续移动不会带动相机；onPointerUp 不做检查，仍能自行清理。
 function grab(e){controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing';}
 renderer.domElement.addEventListener('pointerdown',e=>{
  if(!e.isPrimary&&(drag||rotDrag)){drag=null;rotDrag=null;controls.enabled=true;}   // 第二根手指落下即放弃拖动，交还双指缩放
  down={x:e.clientX,y:e.clientY};tween=null;if(!layoutMode||e.button!==0)return;
  const f=focused();
  if(f&&f.rotatable){aim(e);if(pickRay.intersectObjects([gripHit],false).length){const p=groundPoint(e);if(p){rotDrag={f,start:bearing(p,f.group.position),base:f.group.rotation.y};grab(e);}return;}}
  const id=hitFurniture(e);if(!id)return;selectFurniture(id);
  const target=focused(),p=groundPoint(e);if(!p)return;
  drag={f:target,dx:target.group.position.x-p.x,dz:target.group.position.z-p.z};grab(e);
 });
 renderer.domElement.addEventListener('pointerup',e=>{
  if(drag||rotDrag){drag=null;rotDrag=null;controls.enabled=true;renderer.domElement.style.cursor=idleCursor();onLayout?.();}
  else if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<(renderer.domElement.clientWidth<520?9:6)){
   if(layoutMode){if(!hitFurniture(e))selectFurniture(null);}
   else{const id=pick(e);if(id)onSelect(id);}
  }
  down=null;
 });
 renderer.domElement.addEventListener('pointercancel',()=>{drag=null;rotDrag=null;down=null;controls.enabled=true;});
 renderer.domElement.addEventListener('pointermove',e=>{
  if(drag){const p=groundPoint(e);if(p){const f=drag.f,rot=f.group.rotation.y*180/Math.PI,next=resolveMove(p.x+drag.dx,p.z+drag.dz,{w:f.footprint.w,d:f.footprint.d,rot},{x:f.group.position.x,z:f.group.position.z});
   f.group.position.x=next.x;f.group.position.z=next.z;syncFurniture();}return;}
  if(rotDrag){const p=groundPoint(e);if(p){spinTo(rotDrag.f,rotDrag.base+bearing(p,rotDrag.f.group.position)-rotDrag.start);syncFurniture();}return;}
  if(down){renderer.domElement.style.cursor='grabbing';return;}   // 正在拖相机或拖家具，不必再做拾取
  renderer.domElement.style.cursor=layoutMode?(cursorOnGrip(e)?'grab':hitFurniture(e)?'move':'default'):pick(e)?'pointer':'grab';
 });
 function cursorOnGrip(e){const f=focused();if(!f||!f.rotatable)return false;aim(e);return pickRay.intersectObjects([gripHit],false).length>0;}
 function update(next){devices=next;wallDirty=true;for(const d of next){const v=visuals.get(d.id);if(!d.attach)v.group.position.set(d.x,d.y,d.z);for(const glow of (Array.isArray(v.glow)?v.glow:v.glow?[v.glow]:[])){const color=d.type==='stove'?'#ed602e':d.type==='light'?(d.colorTemperature>4500?'#dcecff':'#ffc278'):'#7abf98';glow.material.emissive.set(color);glow.material.emissiveIntensity=d.on?(d.type==='light'?d.brightness/70:.8):0;}
   if(v.light){v.light.userData.intensity=d.on?40*d.brightness/100:0;v.light.color.set('#ffd099').lerp(new T.Color('#deebff'),(d.colorTemperature-2700)/3800);}
   if(v.screen){v.screen.material.color.set(d.on?'#547f76':'#17221f');v.screen.material.emissive.set(d.on?'#548f7c':'#000000');v.screen.material.emissiveIntensity=d.on?.7:0;}
  }}
 function focus(id){view=id;const r=rooms.find(r=>r.id===id)||rooms[0];tween={target:new T.Vector3(r.x,.1,r.z),position:id==='all'?overviewPosition():new T.Vector3(r.x+3.3,7.5,r.z+5.3)};}
 function select(id){selected=id;focusFurniture=null;syncFurniture();onFurniture?.(null);const d=devices.find(d=>d.id===id);ring.visible=!!d;if(d)ring.position.set(d.x,.06,d.z);}
 const observer=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();if(width&&height){camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);if(view==='all'){camera.position.copy(overviewPosition());controls.target.set(4.5,.1,4.9);tween=null;}}});observer.observe(container);update(devices);
 const wallRay=new T.Ray(),direction=new T.Vector3(),point=new T.Vector3(),worldPos=new T.Vector3(),targets=[];
 // 墙体遮挡的判定点：房间四角、每台设备、每件家具。物体一旦移动就必须重建，
 // 否则判定点停在初始位置，会让已经不再遮挡视线的墙体继续渐隐。
 function rebuildTargets(){targets.length=0;
  for(const r of rooms)if(r.id!=='all')for(const x of [-.55,.55])for(const z of [-.55,.55])targets.push(new T.Vector3(r.x+x,.4,r.z+z));
  for(const d of devices){visuals.get(d.id).group.getWorldPosition(worldPos);targets.push(new T.Vector3(worldPos.x,d.y,worldPos.z));}
  for(const f of furniture)targets.push(new T.Vector3(f.group.position.x,.5,f.group.position.z));
  wallDirty=false;
 }
 rebuildTargets();
 renderer.setAnimationLoop(time=>{const dt=Math.min((time-lastTime)/1000,.05)||.016;lastTime=time;const ease=1-Math.exp(-dt*9);
  if(tween){camera.position.lerp(tween.position,ease);controls.target.lerp(tween.target,ease);if(camera.position.distanceTo(tween.position)<.02)tween=null;}controls.update();
  hemi.intensity=T.MathUtils.lerp(hemi.intensity,night?.13:1.1,ease);sun.intensity=T.MathUtils.lerp(sun.intensity,night?.04:2.3,ease);scene.environmentIntensity=T.MathUtils.lerp(scene.environmentIntensity,night?.06:.3,ease);
  if(wallDirty)rebuildTargets();
  if(wallCounter++%6===0)for(const w of walls){const hide=wallMode==='low'||(wallMode==='auto'&&targets.some(t=>{direction.subVectors(t,camera.position);const dist=direction.length();wallRay.set(camera.position,direction.normalize());return wallRay.intersectBox(w.bounds,point)&&point.distanceTo(camera.position)<dist-.3;}));w.target=hide?.055:1;}
  for(const w of walls){w.wm.opacity=T.MathUtils.lerp(w.wm.opacity,w.target,ease);w.wm.depthWrite=w.wm.opacity>.5;for(const p of w.pieces){p.castShadow=w.wm.opacity>.5;if(p.material!==w.wm)p.visible=w.wm.opacity>.5;}}
  for(const d of devices){const v=visuals.get(d.id);if(v.light){v.light.intensity=T.MathUtils.lerp(v.light.intensity,v.light.userData.intensity,ease);v.light.visible=v.light.intensity>.01;}if(v.rotor&&d.on&&d.running)v.rotor.rotation.z+=dt*3;}
  if(selected)ring.scale.setScalar(1+Math.sin(time*.002)*.025);
  if(halo.visible)halo.scale.setScalar(halo.userData.base*(1+Math.sin(time*.002)*.02));renderer.render(scene,camera);
 });
 return {update,focus,select,setNight(v){night=v;},setWalls(v){wallMode=v;},
  setLayout(on){layoutMode=on;drag=null;rotDrag=null;down=null;controls.enabled=true;if(!on){focusFurniture=null;onFurniture?.(null);}syncFurniture();renderer.domElement.style.cursor=idleCursor();},
  selectFurniture(id){selectFurniture(id);},
  // 键盘微移与旋转，和拖动共用 resolveMove 与同一套角度约定，保证两种操作手感一致。
  moveSelected(dx,dz){const f=focused();if(!f)return false;const from={x:f.group.position.x,z:f.group.position.z};
   const next=resolveMove(from.x+dx,from.z+dz,{w:f.footprint.w,d:f.footprint.d,rot:f.group.rotation.y*180/Math.PI},from);
   const moved=next.x!==from.x||next.z!==from.z;f.group.position.set(next.x,0,next.z);syncFurniture();if(moved)onLayout?.();return moved;},
  // 一次转不到目标角度就往后多试几档（最多 90 度）：床组这类大件在卧室里 15 度、45 度都放不下，
  // 却刚好能转 90 度，只按单步长试会永远卡在第一个放不下的角度上，看上去像按钮失灵。
  rotateSelected(deg){const f=focused();if(!f||!f.rotatable)return false;const step=deg*Math.PI/180;
   for(let i=1;i<=6;i++)if(spinTo(f,f.group.rotation.y+step*i)){syncFurniture();onLayout?.();return true;}
   return false;},
  applyLayout(list){for(const spec of list){const f=furniture.find(x=>x.id===spec.id);if(!f)continue;f.group.position.set(spec.x,0,spec.z);f.group.rotation.y=spec.rot*Math.PI/180;}syncFurniture();onLayout?.();},
  // 16 件家具的完整摆位，条数固定，无需比对默认值。
  layoutState(){const items={};for(const f of furniture)items[f.id]={x:+f.group.position.x.toFixed(3),z:+f.group.position.z.toFixed(3),rot:+((f.group.rotation.y*180/Math.PI%360+360)%360).toFixed(1)};return {version:LAYOUT_VERSION,items};},
  top(){tween={position:new T.Vector3(4.5,20,4.91),target:new T.Vector3(4.5,0,4.9)};},zoom(factor){tween=null;const offset=camera.position.clone().sub(controls.target);offset.setLength(T.MathUtils.clamp(offset.length()*factor,4,30));camera.position.copy(controls.target).add(offset);},stats(){return {drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,walls:walls.length,hiddenWalls:walls.filter(w=>w.target<1).length};},dispose(){observer.disconnect();renderer.setAnimationLoop(null);controls.dispose();environmentMap.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});renderer.dispose();renderer.domElement.remove();}};
}
