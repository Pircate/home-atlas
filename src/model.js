import * as T from 'three';
import floorTextureUrl from './assets/wood-floor.png';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {rooms,slabs,resolveMove,clampToLayout,LAYOUT_VERSION,isWallRemoved} from './state.js';
import {ROOMS,WALLS,OPENINGS,WALL_HEIGHT,WALL_THICKNESS} from './layout.js';

export function createHome(container,initialDevices,initialLayout,{onSelect,onFurniture,onLayout}={}){
 const layout=new Map(initialLayout.map(f=>[f.id,f]));
 const scene=new T.Scene();
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;container.appendChild(renderer.domElement);
 const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment();
 const environmentMap=pmrem.fromScene(environment,.04);scene.environment=environmentMap.texture;scene.environmentIntensity=.34;environment.dispose();pmrem.dispose();
 const camera=new T.PerspectiveCamera(38,1,.1,120);camera.position.set(12.6,14.4,19.2);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(4.88,.1,5.52);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=4;controls.maxDistance=34;controls.minPolarAngle=.02;controls.maxPolarAngle=Math.PI*.46;
 const home=new T.Group();scene.add(home);
 // 环境光偏暖：奶油风的关键是整体色温偏暖、阴影不发灰。
 const hemi=new T.HemisphereLight('#f6efe2','#9c8a70',1.08);scene.add(hemi);
 const sun=new T.DirectionalLight('#fff0d6',2.25);sun.position.set(-5,12,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13});sun.shadow.normalBias=.035;scene.add(sun);
 const cache=new Map();
 function mat(color,roughness=.8,metalness=0){const key=`${color}/${roughness}/${metalness}`;if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color,roughness,metalness}));return cache.get(key);}
 // 奶油中古风：奶油白墙面打底，胡桃木与柚木做家具骨架，黄铜小件提亮，
 // 橄榄绿、铁锈红与芥末黄只作点缀。地板与家具布局沿用已确认方案，这里只改材质与造型。
 const cream=mat('#f2e9db'),white=mat('#faf5e9'),wood=mat('#8a5b38'),
   walnut=mat('#5f4231'),sage=mat('#6f7b52'),rust=mat('#a85a3c'),mustard=mat('#c0914a'),
   dark=mat('#2b2724'),brass=mat('#b08a55',.3,.62),black=mat('#241f1b',.4),
   fabric=mat('#d9c7ad'),sofa=mat('#e7dac4'),steel=mat('#b8b4ab',.32,.5),stone=mat('#ded2bf',.62);
 function box(parent,x,y,z,w,h,d,m,r=0){const mesh=new T.Mesh(r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function cylinder(parent,x,y,z,rt,rb,h,m){const mesh=new T.Mesh(new T.CylinderGeometry(rt,rb,h,24),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function ball(parent,x,y,z,r,m,scale=[1,1,1]){const mesh=new T.Mesh(new T.SphereGeometry(r,20,12),m);mesh.position.set(x,y,z);mesh.scale.set(...scale);mesh.castShadow=true;parent.add(mesh);return mesh;}
 // 中古家具的锥形腿：上粗下细，并以脚底为轴微微外撇。k 越大越外八。
 function legs(parent,xs,zs,h,m,k=.16){
  for(const x of xs)for(const z of zs){const g=new T.Group();g.position.set(x,0,z);g.rotation.set(-z*k,x*k,0);parent.add(g);cylinder(g,0,h/2,0,.026,.014,h,m);}
 }
// 实拍参考的直铺木地板，贴图对应约 2.4 米见方，板幅仅作比例示意。
// 全屋共用世界坐标 UV，房间与门洞处的木纹、拼缝连续。
 const PLANK_TEXTURE=2.4;
 const floorMap=new T.TextureLoader().load(floorTextureUrl);
 floorMap.wrapS=floorMap.wrapT=T.RepeatWrapping;
 floorMap.anisotropy=renderer.capabilities.getMaxAnisotropy();floorMap.colorSpace=T.SRGBColorSpace;
 function rugTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');let seed=37;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
   // 客厅地毯：奶油底手织羊毛毯，中间一条橄榄绿竖向织带压细菱格，
   // 四周一圈铁锈红细边；不做过密的花纹，蓝色调靠家具和绿植补。
   const base='#efe4d0',olive='#6f7b52',rust='#a85a3c';
   ctx.fillStyle=base;ctx.fillRect(0,0,512,512);
   for(let i=0;i<3000;i++){ctx.fillStyle=`rgba(255,249,236,${.06+rand()*.26})`;ctx.fillRect(rand()*512,rand()*512,1.5,1.5);}
   ctx.strokeStyle=olive;ctx.lineWidth=7;ctx.strokeRect(22,22,468,468);
   ctx.strokeStyle=rust;ctx.lineWidth=2.5;ctx.strokeRect(38,38,436,436);
   const band=(x,y,w,h)=>{ctx.fillStyle=olive;ctx.fillRect(x,y,w,h);};
   band(170,74,172,364);
   ctx.strokeStyle=base;ctx.lineWidth=2;
   for(let y=98;y<430;y+=44){ctx.beginPath();ctx.moveTo(170,y-14);ctx.lineTo(256,y+14);ctx.lineTo(342,y-14);ctx.stroke();}
   ctx.fillStyle=rust;ctx.fillRect(160,74,5,364);ctx.fillRect(347,74,5,364);
  const t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.setScalar(1);t.anisotropy=renderer.capabilities.getMaxAnisotropy();t.colorSpace=T.SRGBColorSpace;return t;
 }
 // 木材底层保持非金属，透明漆层提供实拍中的柔和反光。
 const timber=new T.MeshPhysicalMaterial({map:floorMap,roughness:.42,clearcoat:.65,clearcoatRoughness:.24});
 const rugStripe=new T.MeshStandardMaterial({map:rugTexture(),roughness:1});
 function floor(x,z,w,d,type='wood'){
  box(home,x+w/2,-.18,z+d/2,w,.34,d,mat('#d0c8b8'),.025);const surface=box(home,x+w/2,.005,z+d/2,w,.03,d,type==='wood'?timber:mat(type==='bath'?'#e2ded4':'#5c6162'));
  // 按全屋坐标铺纹理，板幅与贴图周期一致，地面分块不会拉伸或重置拼缝。
  if(type==='wood'){const pos=surface.geometry.attributes.position,uv=surface.geometry.attributes.uv,tile=PLANK_TEXTURE;
   for(let i=0;i<uv.count;i++)uv.setXY(i,(x+w/2+pos.getX(i))/tile,(z+d/2+pos.getZ(i))/tile);uv.needsUpdate=true;}
  if(type!=='wood'){for(let a=.6;a<w;a+=.6)box(home,x+a,.022,z+d/2,.007,.002,d,mat(type==='bath'?'#cfc9be':'#4a4f50'));for(let a=.6;a<d;a+=.6)box(home,x+w/2,.022,z+a,w,.002,.007,mat(type==='bath'?'#cfc9be':'#4a4f50'));}
 }
// 地面与墙体全部按如视 VR 实测数据生成（见 layout.js）。房间地面矩形就是墙中线围出的
// 轮廓，相邻房间严丝合缝；墙体是 39 段 12 厘米厚的中线墙，门洞、窗洞的位置、宽度、
// 窗台高与过梁高都取实测值，不再逐个手写坐标，也不再需要门洞处的补地缝。
for(const s of slabs)floor(s.x,s.z,s.w,s.d,s.type);
// 把洞口按所属墙线归位。洞口数据只记了中心与走向，用「同走向 + 横向坐标吻合 +
// 中心落在本段内」筛出来，再换算成沿墙的距离。
function openingsOf(x1,z1,x2,z2){
 const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
 const axis=Math.abs(dx)>=Math.abs(dz)?'x':'z';
 return {length,items:OPENINGS.filter(o=>o.axis===axis&&(axis==='x'?Math.abs(o.cz-z1):Math.abs(o.cx-x1))<.03)
  .map(o=>({...o,t:(o.cx-x1)*ux+(o.cz-z1)*uz}))
  .filter(o=>o.t>-.1&&o.t<length+.1)
  .sort((a,b)=>a.t-b.t)};
}
// 门扇开启方式：hinge 指铰链在哪一端（a=沿墙方向的小端、b=大端），nz 是开向墙法向的哪一侧
// （+1 为组内 +z 侧），angle 为开启角。参照效果图里每樘门都画成半开，这里按「往房间里开、
// 铰链侧让出通行宽度」的常规做法落位——铰链侧与开启角度是设计示意，不是实测值。
const doorSwing={
 'u-zDlW7cmtpya7j4':{hinge:'a',nz:1,angle:95},    // 入户门：铰链在西，向室内开，贴玄关西墙
 'u-179Q4kMTPyabL6':{hinge:'a',nz:1},             // 玄关与过道之间，往过道开
 'u-OfegM4kp8I6voC':{hinge:'b',nz:-1},            // 卧 A：往北开进卧室
 'u-CyZox0kp8I75Mu':{hinge:'a',nz:-1,angle:85},   // 卫生间：西侧铰链向内开，东侧留给马桶和外置洗手台
 'u-ssaMtxkP8I6YOZ':{hinge:'b',nz:1},             // 卧 B：往南开进卧室
 'u-WF4N16KP8i6X1b':{hinge:'b',nz:1},             // 卧 C：往南开进卧室
 'u-p4971IKp8i70r2':{hinge:'a',nz:-1},            // 储物间：往西开进储物间
 // 厨房那樘门（u-MmaJs6Kp8i7dXu）随厨房南墙一起拆掉了，改成开放式厨房，故不再列在这里。
};
// 客厅与过道之间保留门洞但不装门扇；该门洞与三间卧室、储物间都不做门槛。
const doorlessOpenings=new Set(['u-0KyCJFMTpYc0qg']);
const thresholdlessOpenings=new Set([
 ...doorlessOpenings,
 'u-OfegM4kp8I6voC',   // 卧室 A
 'u-ssaMtxkP8I6YOZ',   // 卧室 B
 'u-WF4N16KP8i6X1b',   // 卧室 C
 'u-p4971IKp8i70r2',   // 储物间
]);
 const walls=[];
 function wall(x1,z1,x2,z2){
  const {length,items}=openingsOf(x1,z1,x2,z2);
  const group=new T.Group();group.position.set((x1+x2)/2,0,(z1+z2)/2);group.rotation.y=-Math.atan2(z2-z1,x2-x1);home.add(group);
  const wm=mat('#f3ece0').clone();wm.transparent=true;const pieces=[];
  const TH=WALL_THICKNESS,BASE=.195,TOP=2.645;   // 墙厚 / 墙身上沿、下沿，下面 .195 让给墙脚
  // 注意别把墙厚命名成 T：外层是 `import * as T from 'three'`，函数里再 const T 会遮蔽它，
  // 而本函数开头就要用 T.Group / T.Box3，直接踩 TDZ（构建后报 “Cannot access 'N' before initialization”）。
  const L=t=>t-length/2;                        // 沿墙距离 → 组内局部坐标
  // 墙脚在普通门洞下方连续形成门槛，在指定门洞处断开，让地面通铺过去。
  const plinth=(a,b)=>{if(b-a<.004)return;box(group,L((a+b)/2),.095,0,b-a,.19,.13,cream);};
  let plinthCursor=0;
  for(const o of items)if(thresholdlessOpenings.has(o.id)){
   const a=o.t-o.len/2,b=o.t+o.len/2;
   plinth(plinthCursor,a);plinthCursor=b;
  }
  plinth(plinthCursor,length);
  const solid=(a,b)=>{if(b-a<.004)return;pieces.push(box(group,L((a+b)/2),(BASE+TOP)/2,0,b-a,TOP-BASE,TH,wm));};
  let cursor=0;
  for(const o of items){
   const a=o.t-o.len/2,b=o.t+o.len/2;
   solid(cursor,a);                                   // 洞口之前的实心墙
   if(o.head<TOP-.004)pieces.push(box(group,L((a+b)/2),(o.head+TOP)/2,0,b-a,TOP-o.head,TH,wm));   // 过梁
   if(o.sill>BASE+.004)pieces.push(box(group,L((a+b)/2),(BASE+o.sill)/2,0,b-a,o.sill-BASE,TH,wm)); // 窗下墙
   cursor=Math.max(cursor,b);
  }
  solid(cursor,length);
  pieces.push(box(group,0,2.66,0,length,.055,.15,wm));
  // 窗与阳台推拉门补玻璃、窗台板和竖梃。
  const glass=new T.MeshStandardMaterial({color:'#a7c5be',roughness:.08,transparent:true,opacity:.12,depthWrite:false});
  for(const o of items){
   if(o.kind==='door'||o.kind==='entry')continue;
   const a=o.t-o.len/2,b=o.t+o.len/2,mid=(o.sill+o.head)/2,h=o.head-o.sill;
   pieces.push(box(group,L((a+b)/2),o.sill-.025,0,o.len,.05,.19,wm));
   pieces.push(box(group,L((a+b)/2),mid,0,o.len-.06,h-.06,.02,glass));
   for(const f of [.03,.5,.97])pieces.push(box(group,L(a+o.len*f),mid,0,.04,h,.06,wm));
  }
  // 门扇：铰链处起一个 pivot，绕 Y 转出开启角。门的材质单独一份、跟墙身同步渐隐，
  // 否则切到俯视时墙已经淡出、门扇还孤零零立着。
  const dm=mat('#5a2e1e',.5,.05).clone();dm.transparent=true;
  for(const o of items){
   if(o.kind!=='door'&&o.kind!=='entry')continue;
   if(doorlessOpenings.has(o.id))continue;
   const spec=doorSwing[o.id]||{hinge:'a',nz:1,angle:75};
   const a=o.t-o.len/2,b=o.t+o.len/2,hingeAt=spec.hinge==='b'?b:a,side=spec.hinge==='b'?-1:1;
   const pivot=new T.Group();pivot.position.set(L(hingeAt),0,0);
   // 叶片沿 pivot 的 ±x 伸出：局部 +x 绕 Y 转 θ 后指向 −z，所以开向 +z 要取负角。
   pivot.rotation.y=-side*spec.nz*(spec.angle||75)*Math.PI/180;
   group.add(pivot);
   const leafW=o.len-.04,h=o.head-.04;
   pieces.push(box(pivot,side*leafW/2,h/2+.01,0,leafW,h,.045,dm,.006));
   for(const z of [-.032,.032])pieces.push(box(pivot,side*leafW*.82,1.02,z,.026,.026,.026,brass,.008));
  }
  const bounds=new T.Box3().setFromObject(group);walls.push({group,wm,dm,pieces,bounds,target:1});
 }
 // 实测墙线 39 段，位置与长度直接来自 VR 数据；其中被装修方案拆掉的（厨房南墙等）见 state.js 的
// REMOVED_WALLS，这里统一跳过，门洞随墙一起消失。
for(const [x1,z1,x2,z2] of WALLS)if(!isWallRemoved(x1,z1,x2,z2))wall(x1,z1,x2,z2);

 // 客厅地毯作为固定装饰，不计入沙发的移动边界。
 function rug(x,z,w,d,material){box(home,x,.04,z,w,.035,d,material,.04);}
 rug(8.08,7.36,2.70,3.26,rugStripe);
 function plant(parent,x,z,height=1){cylinder(parent,x,.17,z,.15,.10,.34,mat('#b0684a'));cylinder(parent,x,.345,z,.155,.15,.03,mat('#c98a6a'));
  for(let i=0;i<8;i++){const a=i*2.4;const stem=cylinder(parent,x,.4+height*.2,z,.01,.012,height*.65,wood);stem.rotation.z=Math.sin(a)*.2;const leaf=ball(parent,x+Math.sin(a)*.16,.44+height*(.25+i*.045),z+Math.cos(a)*.17,.17,mat(i%2?'#5d6b45':'#7c8a5c'),[.65,1.65,.7]);leaf.rotation.z=Math.sin(a)*.6;}}
 // 奶油中古风的床：胡桃木矮床架、外撇锥形腿、布艺软包床头，
 // 奶油色床品压一条撞色搭毯。轮廓与改造前的占地基本一致，摆位不用重算。
 function bed(parent,x,z,w,accent,length=2.02,headboard=true){
  const group=new T.Group();group.position.set(x,0,z);parent.add(group);
  for(const sx of [-1,1])for(const sz of [-1,1]){const leg=cylinder(group,sx*(w/2-.05),.11,sz*(length/2-.12),.02,.032,.22,walnut);leg.rotation.z=-sx*.07;leg.rotation.x=sz*.07;}
  box(group,0,.32,0,w,.20,length+.01,walnut,.025);                       // 床架
  box(group,0,.47,0,w-.02,.14,length-.08,white,.06);                      // 床垫
  box(group,0,.565,-.14*length/2,w+.02,.10,length*.58,mat('#f3ead9'),.055); // 奶油色被子
  box(group,0,.60,-.36*length/2,w+.03,.075,length*.16,mat(accent),.04);    // 床尾搭毯
  if(headboard){
   box(group,0,.66,length/2-.02,w+.1,.98,.13,fabric,.06);
   box(group,0,1.17,length/2-.03,w+.04,.09,.10,fabric,.045);               // 软包上沿
  }
  const pw=w<=1.2?w*.62:w*.4;                                              // 枕头：单人床一只，双人床两只
  for(const px of w<=1.2?[0]:[-w*.25,w*.25])box(group,px,.64,length/2-.34,pw,.16,.4,white,.07);
  if(w>1.2)box(group,0,.66,length/2-.62,.5,.12,.22,mat(accent),.05);        // 双人床加一只腰枕
  for(let i=0;i<6;i++)box(group,-w/2+.08+i*(w-.16)/5,.62,-.30*length/2.02,.012,.005,.72*length/2.02,mat('#e8dcc8'),.002);
 }
 // 奶油色柜体、黄铜圆钮、竖向分缝；木饰只做底踢脚，柜顶保持干净的奶油色台面。
 function wardrobe(parent,x,z,w,d){
  box(parent,x,1.1,z,w,2.16,d,mat('#f6eee0'),.02);
  box(parent,x,.075,z+d/2+.012,w,.15,.012,wood,.006);                            // 胡桃木踢脚线
  for(let i=-w/2+.43;i<w/2;i+=.48){box(parent,x+i,1.09,z+d/2+.005,.007,2.0,.006,mat('#e3d7c2'));ball(parent,x+i-.05,1.10,z+d/2+.026,.020,brass,[1,1,.55]);}
 }
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
 furnishing('bed-b',g=>bed(g,0,0,1.8,'#6f7b52',2));
 furnishing('bed-c',g=>bed(g,0,0,1.2,'#a9603f',2,false));
 furnishing('bed-a',g=>bed(g,0,0,1.5,'#b08a5e',1.8));
 furnishing('wardrobe-a',g=>wardrobe(g,0,0,1,.5));
 // 柜体与门洞共用同一组尺寸，两侧预留 5 厘米，门扇可以完全打开。
 function northWardrobe(g,id,overhead=false){
  const [x,,w]=ROOMS.find(r=>r.id===id).extent;
  const opening=OPENINGS.find(o=>o.id===({b:'u-ssaMtxkP8I6YOZ',c:'u-WF4N16KP8i6X1b'})[id]);
  const r={x:x+WALL_THICKNESS/2,w:w-WALL_THICKNESS},d={x:opening.cx-opening.len/2,w:opening.len},anchor=layout.get(`wardrobe-${id}`);
  for(const [left,right] of [[r.x,d.x-.05],[d.x+d.w+.05,r.x+r.w]]){
   if(right-left>=.18)wardrobe(g,(left+right)/2-anchor.x,0,right-left,.6);
  }
  if(overhead){box(g,0,2.41,0,r.w,.46,.6,mat('#f6eee0'),.025);
   for(let x=-r.w/2+.48;x<r.w/2;x+=.48){box(g,x,2.41,.306,.008,.38,.006,mat('#e0d3bd'));ball(g,x-.05,2.41,.332,.02,brass,[1,1,.55]);}}
 }
 furnishing('wardrobe-b',g=>northWardrobe(g,'b',true));
 furnishing('wardrobe-c',g=>northWardrobe(g,'c'));
// 玄关矮柜：胡桃木柜体配藤编柜门，奶油色石台面，柜上摆钥匙盘与一束干枝。
// rot 270 时局部 +z 指向西侧室内，柜门细节因此做在 +z 面，柜背贴东墙。
furnishing('hall-cabinet',g=>{
 const cane=mat('#c8a878',.95);
 box(g,0,.52,0,.90,1.04,.32,walnut,.02);
 box(g,0,.56,.163,.80,.72,.006,cane);                                    // 藤编门板，朝室内一侧
 box(g,0,1.06,0,.94,.04,.35,stone,.01);
 for(const x of [-.30,0,.30])ball(g,x,.56,.172,.02,brass,[1,1,.55]);
 box(g,0,.17,.20,.80,.14,.03,walnut,.008);                               // 柜下横档
 for(const x of [-.38,.38])cylinder(g,x,.09,.10,.018,.026,.18,walnut);
 cylinder(g,-.24,1.17,.02,.09,.078,.09,mat('#d9c9ae',.5));
 for(const [a,h] of [[-.4,1.5],[.2,1.8],[.9,1.3]]){const stick=cylinder(g,.24,1.22+h*.16,.06,.006,.008,h*.45,mat('#9a7752'));stick.rotation.z=a*.35;stick.rotation.x=a*.2;}
});
 // 储物间：西墙开放式自行车架及展示层板，北窗下木色电脑桌，南侧留出开门空间。
 furnishing('bike-cabinet',g=>{
  const tyre=mat('#2b2724',.6),alloy=mat('#b08a55',.3,.62);
  box(g,0,.05,0,.40,.10,2.20,walnut,.012);                                   // 落地的胡桃木底座
  box(g,-.19,1.03,0,.03,1.98,2.20,walnut);                                   // 背板
  // 展示层板：胡桃木搁板配黄铜托架，只放在车身两端，不穿过车架和车轮。
  for(const z of [-.91,.91])for(const y of [.45,1.02,1.62]){
   box(g,-.025,y,z,.35,.03,.32,wood,.006);
   for(const s of [-1,1])box(g,-.16,y-.07,z+s*.11,.02,.12,.012,brass);
   cylinder(g,-.03,y+.10,z,.065,.052,.17,cream);                             // 陶瓶
   if(y>.6)cylinder(g,.07,y+.06,z,.045,.05,.10,mustard);
  }
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
 // 电竞桌椅贴着北墙放：显示器收进桌板内侧，否则桌一贴墙、屏就扎进墙里。
 // 造型按中古书桌处理——柚木薄板桌面、锥形腿、一侧抽屉柜；椅子换成胡桃木框加奶油色软垫。
 furnishing('desk-gaming',g=>{
  const dark=mat('#2b2724',.5,.2);
  box(g,0,.73,0,1.36,.04,.75,wood,.015);                                          // 桌面 1.36×0.75
  legs(g,[-.60,.60],[-.30,.30],.71,walnut);
  box(g,.42,.52,-.06,.44,.42,.62,walnut,.02);                                      // 右侧抽屉柜
  for(const y of [.44,.62]){box(g,.42,y,.252,.42,.006,.02,mat('#4a3226'));ball(g,.42,y,.266,.018,brass,[1,1,.6]);}
  box(g,0,.80,-.30,.11,.16,.09,dark);box(g,0,.91,-.30,.05,.32,.05,dark);box(g,0,1.13,-.30,.62,.36,.02,mat('#1c1815',.4));   // 显示器
  box(g,0,.762,.02,.46,.02,.15,dark,.01);                                          // 键盘
  box(g,.42,.762,.05,.07,.025,.10,dark,.025);                                      // 鼠标
  cylinder(g,-.52,.80,-.18,.055,.045,.11,cream);
  // 椅子：胡桃木框 + 奶油色坐垫，靠背朝南，人面向北边的桌子。
  const chair=new T.Group();chair.position.set(.16,0,.50);g.add(chair);
  for(const x of [-.22,.22])for(const z of [-.20,.20]){const leg=cylinder(chair,x,.21,z,.016,.024,.42,walnut);leg.rotation.z=-x*.3;leg.rotation.x=z*.3;}
  box(chair,0,.44,0,.48,.09,.46,mat('#e8d9c1'),.04);
  box(chair,0,.78,.24,.44,.62,.09,mat('#7c6a4f'),.045);
  for(const x of [-.24,.24])box(chair,x,.64,0,.04,.02,.42,walnut,.01);
 });
 // 客厅软装：奶油色布艺三人沙发贴东墙，外露胡桃木锥形腿与木压顶；
 // 棕色系抱枕（橄榄绿、铁锈红、芥末黄）是这套配色的重音。
 furnishing('sofa',g=>{
  for(const z of [-1.22,1.22])for(const x of [-.28,.30]){const leg=cylinder(g,x,.11,z,.02,.032,.22,walnut);leg.rotation.z=-x*.18;leg.rotation.x=z*.06;}
  box(g,-.01,.32,0,.84,.24,2.62,sofa,.05);                                        // 座框
  box(g,.31,.68,0,.22,.76,2.66,sofa,.07);                                         // 靠背贴东墙
  box(g,.315,.845,0,.07,.055,2.66,walnut,.018);                                   // 靠背木压顶
  for(const z of [-1.32,1.32])box(g,-.01,.53,z,.88,.30,.14,sofa,.055);            // 扶手
  for(const z of [-.86,0,.86]){
   box(g,-.07,.47,z,.70,.14,.82,mat('#efe2cb'),.055);                             // 坐垫
   const back=box(g,.21,.72,z,.17,.42,.80,mat('#ecdec4'),.06);back.rotation.z=.14; // 靠垫
  }
  for(const [z,color,rot] of [[-.95,'#6f7b52',.16],[.04,'#a85a3c',-.12],[.88,'#c0914a',.08]]){
   const pillow=box(g,-.07,.66,z,.20,.36,.40,mat(color),.05);pillow.rotation.set(-.12,rot,.2);}
  box(g,0,.28,1.70,.72,.08,.50,walnut,.02);                                        // 南端边几
  for(const [x,z] of [[-.28,-.20],[.28,-.20],[-.28,.20],[.28,.20]])cylinder(g,x,.12,z,.014,.024,.24,walnut);
 });
 // 茶几：奶油色石面圆几，胡桃木三脚腿；旁边一只矮木边几，台面放陶罐与绿植。
 furnishing('coffee',g=>{
  cylinder(g,0,.40,0,.43,.43,.07,mat('#efe6d5',.5));
  cylinder(g,0,.375,0,.415,.415,.02,walnut);
  for(let i=0;i<3;i++){const a=i*2.094;const leg=cylinder(g,Math.sin(a)*.26,.19,Math.cos(a)*.26,.017,.026,.38,walnut);leg.rotation.z=-Math.sin(a)*.10;leg.rotation.x=Math.cos(a)*.10;}
  cylinder(g,-.13,.27,.62,.21,.21,.05,walnut);cylinder(g,-.13,.13,.62,.18,.19,.27,mat('#5f4633',.7));
  // 桌面：一只陶罐插枝，几本叠放的书。
  cylinder(g,.04,.50,.02,.075,.06,.11,mat('#c98a6a',.9));
  for(let i=0;i<6;i++){const a=i*1.05;ball(g,.04+Math.cos(a)*.085,.62,.02+Math.sin(a)*.085,.075,mat(i%2?'#5d6b45':'#7c8a5c'),[.7,1.5,.7]);}
  box(g,-.24,.452,-.16,.30,.028,.22,mustard,.004);box(g,-.24,.477,-.16,.27,.022,.20,mat('#6f7b52'),.004);
 });
 // 电视柜：胡桃木长柜做竖纹格栅柜门，两端摆陶盆绿植，与中古风的长条体量一致。
 furnishing('tv-unit',g=>{
  box(g,0,.29,0,.43,.46,2.42,walnut,.03);
  for(let z=-1.14;z<1.16;z+=.09)box(g,.222,.30,z,.008,.40,.026,mat('#805c41'),.003);   // 竖纹格栅
  box(g,0,.53,0,.45,.035,2.44,walnut,.012);                                             // 柜顶压边
  for(const z of [-.83,0,.83])cylinder(g,.238,.33,z,.014,.014,.012,brass);
  for(const z of [-1.02,1.02]){cylinder(g,0,.585,z,.09,.068,.13,mat('#b0684a'));
   for(let i=0;i<6;i++){const a=i*1.05;ball(g,Math.cos(a)*.1,.72,z+Math.sin(a)*.1,.085,mat(i%2?'#5d6b45':'#7c8a5c'),[.7,1.5,.7]);}}
  for(const [x,z] of [[-.16,-1.28],[.16,-1.28],[-.16,1.28],[.16,1.28]])cylinder(g,x,.09,z,.014,.024,.18,walnut);
 });
 // 岛台独立于橱柜，南面台板悬挑配两把吧椅，不再另放圆餐桌。
 // 柜体是胡桃木饰面，台面换奶油色石面；吧椅用奶油色软包加胡桃木锥形腿。
 furnishing('dining',g=>{
  // 岛台柜体做奶油色，只在台面下沿与踢脚收一道柚木边：整块柚木面朝南时背光，
  // 会压成一大片深棕；奶油色柜体更符合这套配色的明度。
  box(g,0,.44,-.08,1.55,.84,.54,mat('#f6eee0'),.02);
  box(g,0,.155,-.08,1.51,.05,.52,wood);                                           // 踢脚
  for(const y of [.30,.60])box(g,0,y,.183,1.47,.005,.008,mat('#e3d7c2'));          // 柜门横向分缝
  box(g,0,.865,-.08,1.57,.03,.56,wood,.006);                                       // 台下柚木收边
  box(g,0,.91,0,1.65,.08,.80,mat('#efe6d5',.5),.02);                              // 奶油色石台面
  for(const x of [-.39,.39]){
   box(g,x,.44,.195,.012,.74,.012,brass);
   const chair=new T.Group();chair.position.set(x,0,.79);g.add(chair);
   const shell=new T.Group();shell.position.y=.29;shell.scale.set(.62,.76,.62);shell.rotation.y=Math.PI;chair.add(shell);
   podChair(shell,'#ecdec4','#d8c7ab');
   for(const dx of [-.16,.16])for(const dz of [-.15,.15]){const leg=cylinder(chair,dx,.19,dz,.014,.024,.38,walnut);leg.rotation.z=-dx*.25;leg.rotation.x=dz*.25;}
   box(chair,0,.36,0,.40,.05,.40,walnut,.01);                                     // 脚踏横档
  }
  cylinder(g,-.48,1.01,-.06,.075,.06,.14,mat('#c98a6a'));
  for(let i=0;i<5;i++){const a=i*1.26;ball(g,-.48+Math.sin(a)*.07,1.16,-.06+Math.cos(a)*.07,.07,sage,[.6,1.6,.7]);}
  cylinder(g,.44,.975,0,.14,.13,.04,mat('#c98a6a',.9));for(const x of [.36,.46,.55])ball(g,x,1.03,0,.055,rust);
 });
// 单人椅：地毯南端的橄榄绿扶手椅，木框外露、坐垫与靠垫分开，靠背朝南面向茶几。
furnishing('armchair',g=>{const green=mat('#69714a',.95);
 for(const x of [-.32,.32])for(const z of [-.26,.26]){const leg=cylinder(g,x,.16,z,.015,.026,.32,walnut);leg.rotation.z=-x*.22;leg.rotation.x=z*.22;}
 box(g,0,.40,0,.74,.20,.68,green,.06);                                            // 座框
 box(g,0,.70,.29,.74,.62,.12,green,.06);                                          // 靠背
 box(g,0,.29,-.02,.60,.10,.56,mat('#d9c7ad'),.05);                                // 布艺坐垫
 const cushion=box(g,0,.62,.16,.46,.32,.10,mat('#7c8557'),.05);cushion.rotation.x=-.2;
 for(const x of [-.38,.38])box(g,x,.50,0,.06,.24,.62,walnut,.02);                  // 木扶手
});
// 桶形沙发椅：低矮的奶油色座身，后侧一圈弧形高靠背把肩背包住，内衬橄榄绿坐垫。
// 靠背是 PI 段圆环：绕 X 转 −90° 后正好立在 −z 一侧，也就是椅背朝北、开口朝南。
function podChair(g,shell,pad){
 const c=mat(shell,.95);
 cylinder(g,0,.20,0,.36,.33,.36,c);                                        // 座身
 cylinder(g,0,.39,0,.34,.34,.04,c);                                        // 座上沿收口
 cylinder(g,0,.35,0,.28,.28,.075,mat(pad,.95));                            // 坐垫
 const back=new T.Mesh(new T.TorusGeometry(.33,.09,12,32,Math.PI),c);      // 半环高靠背
 back.rotation.x=-Math.PI/2;back.position.set(0,.50,.02);back.castShadow=true;g.add(back);
}
// 壳椅做在胡桃木十字腿上：中古桶椅的典型做法，椅脚露出来比整块落地更轻。
furnishing('armchair-n',g=>{
 for(const x of [-.24,.24])for(const z of [-.20,.20]){const leg=cylinder(g,x,.11,z,.013,.026,.22,walnut);leg.rotation.z=-x*.22;leg.rotation.x=z*.22;}
 const shell=new T.Group();shell.position.y=.20;g.add(shell);podChair(shell,'#efe4cf','#6f7b52');
});
 furnishing('plants-l',g=>plant(g,0,0,1.1));
 furnishing('plants-bal',g=>plant(g,0,0,.8));
 furnishing('kitchen-counter',g=>{
  // 北侧水槽台和东侧灶台以端面拼接成 L 形，南端空位放冰箱。
  // 中古厨房的做法：柚木色下柜配奶油色石台面与墙裙砖，黄铜长拉手；
  // 柜体用比胡桃木浅一档的 wood，避免整片深棕压住奶油底色。
  const front=mat('#8c6444',.7);
  box(g,0,.45,-.95,2.0328,.88,.56,wood,.02);box(g,0,.91,-.95,2.0928,.06,.60,mat('#efe6d5',.45),.02);
  box(g,.7464,.45,.035,.54,.88,1.37,wood,.02);box(g,.7464,.91,.035,.60,.06,1.37,mat('#efe6d5',.45),.02);
  for(const x of [-.70,-.23,.23,.70])box(g,x,.52,-.657,.006,.72,.008,front);   // 柜门竖缝
  for(const z of [-.56,-.20,.16,.52])box(g,.4665,.52,z,.008,.72,.006,front);
  for(const x of [-.68,0,.68])box(g,x,.80,-.659,.42,.016,.02,brass);            // 横向长拉手
  for(const z of [-.40,.30]){const bar=box(g,.4665,.80,z,.02,.016,.36,brass);bar.rotation.y=Math.PI/2;}
  box(g,0,.949,-.95,.76,.014,.43,steel,.02);
  for(const x of [-.19,.19])box(g,x,.96,-.95,.32,.016,.33,dark,.025);
  cylinder(g,0,1.08,-1.16,.018,.018,.25,steel);box(g,0,1.205,-1.08,.035,.035,.19,steel,.01);
  // 北墙上的奶油色小方砖墙裙，砖缝压成细线；上方留白墙。
  box(g,0,1.36,-1.235,2.0328,.76,.018,mat('#efe7d6',.7));
  for(let x=-1.0;x<1.02;x+=.152)box(g,x,1.36,-1.226,.006,.76,.004,mat('#ded2be'));
  for(let y=.98;y<1.73;y+=.076)box(g,0,y,-1.226,2.03,.005,.004,mat('#ded2be'));
  box(g,0,2.03,-1.10,2.0328,.62,.30,mat('#f6eee0'),.02);                    // 吊柜
  for(let x=-.76;x<.8;x+=.38)box(g,x,2.03,-.944,.006,.54,.004,mat('#e3d7c2'));
  for(const x of [-.68,0,.68])ball(g,x,1.83,-.944,.022,brass,[1,1,.55]);
 });
 // 卫生间门内北侧淋浴、东侧马桶；洗手台放门外东侧凹位，干湿分离。
 furnishing('bath-fixtures',g=>{
  const chrome=mat('#c9bda6',.25,.8),tile=mat('#e8ddc9',.6);
  const glass=new T.MeshStandardMaterial({color:'#bcd2cd',roughness:.08,transparent:true,opacity:.22,depthWrite:false});
  box(g,-.23,.035,-.46,1.04,.035,.72,tile,.012);
  for(const z of [-.73,-.55,-.37,-.19])box(g,-.23,.058,z,.98,.006,.012,mat('#d6c9b2',.7));
  box(g,.30,1.02,-.46,.025,1.92,.72,glass,.004);                          // 东侧固定玻璃，南侧进出
  cylinder(g,-.35,2.12,-.69,.13,.13,.028,chrome);
  cylinder(g,-.35,1.60,-.79,.018,.018,1.04,chrome);
 });
 furnishing('bath-toilet',g=>{
  const porcelain=mat('#f6f1e7',.22);
  box(g,.26,.42,0,.18,.62,.46,porcelain,.04);
  cylinder(g,0,.20,0,.20,.22,.40,porcelain);ball(g,0,.50,0,.25,porcelain,[1.25,.28,.86]);
 });
 furnishing('bath-vanity',g=>{
  const chrome=mat('#c9bda6',.25,.8);
  box(g,0,.035,0,.54,.03,.72,mat('#e8ddc9',.6),.01);
  box(g,0,.41,0,.50,.76,.64,walnut,.02);box(g,0,.82,0,.54,.06,.68,mat('#efe6d5',.45),.02);
  ball(g,-.04,.87,0,.20,mat('#f8f1e4',.2),[.9,.30,1.25]);
  cylinder(g,.17,.96,0,.016,.016,.20,chrome);box(g,.11,1.05,0,.14,.025,.025,chrome,.005);
  box(g,.262,1.41,0,.015,.78,.60,mat('#d1cfc4',.18,.55),.01);
  cylinder(g,.06,.91,-.25,.045,.04,.12,mat('#c98a6a',.9));
 });
 const visuals=new Map(),clickable=[];let devices=initialDevices;
 for(const d of devices){
  // 台灯、电视、电磁灶挂在对应家具上，由场景图的父子变换带动旋转，无需手工换算偏移。
  const host=d.attach?furniture.find(f=>f.id===d.attach):null;
  const group=new T.Group();group.position.set(host?d.x-host.x:d.x,d.y,host?d.z-host.z:d.z);(host?host.group:home).add(group);let glow,light,screen,rotor;
  if(d.type==='light'){
   const low=d.id==='floor-light';
   if(low){const bottom=0;cylinder(group,0,bottom-d.y+.02,0,.17,.20,.05,brass);cylinder(group,0,(bottom-d.y)/2,0,.014,.014,d.y-bottom,brass);cylinder(group,0,.13,0,.05,.05,.02,walnut);
    glow=cylinder(group,0,0,0,.17,.25,.26,white.clone());}
   // 中古吊灯：细黄铜吊杆 + 上窄下宽的浅斗罩，罩内朝下的一面就是发光面。
   // 罩体做薄、开口朝下，灯亮时整片罩底透光，不会只剩顶上一圈黄铜发亮。
   else{const r=d.room==='living'?.30:.20;cylinder(group,0,.16,0,.012,.012,.32,brass);
    glow=cylinder(group,0,0,0,r*.5,r,.20,white.clone());       // 浅斗灯罩（外表面兼作发光面）
    cylinder(group,0,-.10,0,r*.965,r*.965,.012,mat('#fff6e0',.5));} // 罩口内侧的柔光片
   glow.castShadow=false;light=new T.SpotLight('#ffd19a',0,5,Math.PI*.42,.8,1.7);light.position.set(0,-.17,0);light.target.position.set(0,-d.y,0);light.castShadow=true;light.shadow.mapSize.set(256,256);light.shadow.normalBias=.04;group.add(light,light.target);
  }else if(d.type==='tv'){
   box(group,0,0,0,.08,1.01,1.63,mat('#2b2724',.45),.04);screen=box(group,.047,0,0,.01,.88,1.49,mat('#192b29').clone(),.01);
   box(group,0,-.56,0,.23,.045,.63,walnut,.02);                 // 胡桃木电视底座
  }else if(d.type==='ac'){
   if(['ac-b','ac-c'].includes(d.id))group.rotation.y=Math.PI/2; // 北墙柜占用原机位，空调改挂西墙、出风朝东。
   const side=d.room==='living';box(group,0,0,0,side?.24:1.03,.31,side?1.03:.24,mat('#f6eee0',.7),.06);
   for(let i=0;i<5;i++)box(group,side?-.125:0,-.085+i*.02,side?0:.125,side?.012:.87,.007,side?.87:.012,mat('#cbb99e'));
   glow=ball(group,side?-.13:.39,.07,side?.38:.13,.02,mat('#6aac8c').clone());
  }else if(d.type==='fridge'){
   group.rotation.y=-Math.PI/2; // 冰箱背靠东墙，向西开门，位于灶台南端。
   // 奶油色复古双门冰箱：大圆角柜体、黄铜横把手，顶面压一块胡桃木。
   box(group,0,-.02,0,.67,1.86,.66,mat('#efe2cb',.34,.08),.09);
   box(group,0,.26,.335,.60,.012,.008,mat('#ddceb6'));
   box(group,0,.16,.355,.03,.46,.03,brass,.012);
   box(group,0,-.52,.355,.26,.03,.03,brass,.012);
   box(group,0,.93,0,.68,.03,.67,walnut,.01);
  }else if(d.type==='washer'){
   box(group,0,0,0,.67,.88,.63,mat('#f3ead9',.55),.04);
   const ring=new T.Mesh(new T.TorusGeometry(.237,.022,10,32),brass);ring.position.set(0,-.03,.335);group.add(ring);
   const door=cylinder(group,0,-.03,.335,.225,.225,.055,black);door.rotation.x=Math.PI/2;
   rotor=new T.Group();rotor.position.set(0,-.03,.371);group.add(rotor);
   const drum=cylinder(rotor,0,0,0,.18,.18,.02,mat('#6e8983',.15,.65));drum.rotation.x=Math.PI/2;
   for(let i=0;i<3;i++){const fin=box(rotor,Math.cos(i*2.094)*.07,Math.sin(i*2.094)*.07,.015,.025,.14,.012,mat('#c0ccc3',.3,.5),.008);fin.rotation.z=i*2.094;}
   box(group,-.17,.32,.329,.12,.05,.013,walnut);ball(group,.2,.32,.34,.04,brass);
   box(group,0,.455,0,.68,.03,.64,walnut,.01);                   // 顶部木台面
  }else if(d.type==='hood'){
   box(group,0,0,0,.52,.14,.68,mat('#e8dcc6',.45,.25),.025);box(group,.08,.26,0,.32,.48,.34,mat('#d8c9ae',.5),.015);
  }else if(d.type==='stove'){
   box(group,0,0,0,.52,.025,.67,black,.015);glow=[];for(const z of [-.17,.17]){const ring=new T.Mesh(new T.TorusGeometry(.12,.008,8,28),brass.clone());ring.rotation.x=-Math.PI/2;ring.position.set(0,.025,z);group.add(ring);glow.push(ring);}
  }else if(d.type==='heater'){
   const tank=cylinder(group,0,0,0,.23,.23,.72,mat('#f3ead9',.55));tank.rotation.z=Math.PI/2;
   for(const z of [-.30,.30]){const band=new T.Mesh(new T.TorusGeometry(.232,.012,8,24),brass);band.rotation.y=Math.PI/2;band.position.z=z;group.add(band);}
   box(group,0,-.17,.14,.21,.11,.06,walnut,.02);
  }else if(d.type==='speaker'){
   // 书架音箱：胡桃木箱体配奶油色编织网罩，正是中古音响的样子。
   box(group,0,0,0,.26,.30,.22,walnut,.018);
   box(group,0,.005,.115,.22,.24,.006,mat('#ddceb4',.95));
   for(let y=-.09;y<.11;y+=.03)box(group,0,y,.119,.20,.004,.003,mat('#c9b795'));
   glow=box(group,.095,.128,.119,.022,.008,.003,mat('#87b89f').clone());
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
 const ground=new T.Mesh(new T.PlaneGeometry(18,18),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));ground.rotation.x=-Math.PI/2;ground.position.set(4.88,-.36,5.52);scene.add(ground);
 const ring=new T.Mesh(new T.RingGeometry(.31,.335,60),new T.MeshBasicMaterial({color:'#b9944f',transparent:true,opacity:.95,side:T.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;ring.renderOrder=10;scene.add(ring);
 // 布置模式的选中环与旋转手柄。手柄位于家具正北方向的环上，拖动它即绕锚点旋转。
 const halo=new T.Mesh(new T.RingGeometry(.42,.455,72),new T.MeshBasicMaterial({color:'#b9944f',transparent:true,opacity:.9,side:T.DoubleSide,depthTest:false}));halo.rotation.x=-Math.PI/2;halo.renderOrder=11;halo.visible=false;scene.add(halo);
 const grip=new T.Group();grip.visible=false;scene.add(grip);ball(grip,0,0,0,.062,brass.clone());
 const gripHit=new T.Mesh(new T.SphereGeometry(.2,8,6),new T.MeshBasicMaterial({visible:false}));grip.add(gripHit);
 let night=false,wallMode='auto',selected=null,tween=null,down=null,lastTime=0,wallCounter=0,view='all';
 let layoutMode=false,focusFurniture=null,drag=null,rotDrag=null,wallDirty=true;
 const overviewPosition=()=>new T.Vector3(4.88,.1,5.52).add(new T.Vector3(8,14.5,14).multiplyScalar(Math.max(1,1.15/camera.aspect)));
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
 const observer=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();if(width&&height){camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);if(view==='all'){camera.position.copy(overviewPosition());controls.target.set(4.88,.1,5.52);tween=null;}}});observer.observe(container);update(devices);
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
  hemi.intensity=T.MathUtils.lerp(hemi.intensity,night?.15:1.08,ease);sun.intensity=T.MathUtils.lerp(sun.intensity,night?.04:2.25,ease);scene.environmentIntensity=T.MathUtils.lerp(scene.environmentIntensity,night?.06:.34,ease);
  if(wallDirty)rebuildTargets();
  if(wallCounter++%6===0)for(const w of walls){const hide=wallMode==='low'||(wallMode==='auto'&&targets.some(t=>{direction.subVectors(t,camera.position);const dist=direction.length();wallRay.set(camera.position,direction.normalize());return wallRay.intersectBox(w.bounds,point)&&point.distanceTo(camera.position)<dist-.3;}));w.target=hide?.055:1;}
  for(const w of walls){w.wm.opacity=T.MathUtils.lerp(w.wm.opacity,w.target,ease);w.wm.depthWrite=w.wm.opacity>.5;
   w.dm.opacity=w.wm.opacity;w.dm.depthWrite=w.wm.opacity>.5;
   for(const p of w.pieces){p.castShadow=w.wm.opacity>.5;if(p.material!==w.wm&&p.material!==w.dm)p.visible=w.wm.opacity>.5;}}
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
  // 全部家具的完整摆位，条数固定，无需比对默认值。
  layoutState(){const items={};for(const f of furniture)items[f.id]={x:+f.group.position.x.toFixed(3),z:+f.group.position.z.toFixed(3),rot:+((f.group.rotation.y*180/Math.PI%360+360)%360).toFixed(1)};return {version:LAYOUT_VERSION,items};},
  top(){tween={position:new T.Vector3(4.88,22,5.53),target:new T.Vector3(4.88,0,5.52)};},zoom(factor){tween=null;const offset=camera.position.clone().sub(controls.target);offset.setLength(T.MathUtils.clamp(offset.length()*factor,4,30));camera.position.copy(controls.target).add(offset);},stats(){return {drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,walls:walls.length,hiddenWalls:walls.filter(w=>w.target<1).length};},dispose(){observer.disconnect();renderer.setAnimationLoop(null);controls.dispose();floorMap.dispose();rugStripe.map.dispose();environmentMap.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});renderer.dispose();renderer.domElement.remove();}};
}
