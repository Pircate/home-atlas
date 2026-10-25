import * as T from 'three';
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
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;container.appendChild(renderer.domElement);
 const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment();
 const environmentMap=pmrem.fromScene(environment,.04);scene.environment=environmentMap.texture;scene.environmentIntensity=.3;environment.dispose();pmrem.dispose();
 const camera=new T.PerspectiveCamera(38,1,.1,120);camera.position.set(12.6,14.4,19.2);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(4.88,.1,5.52);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=4;controls.maxDistance=34;controls.minPolarAngle=.02;controls.maxPolarAngle=Math.PI*.46;
 const home=new T.Group();scene.add(home);
 const hemi=new T.HemisphereLight('#eef2ff','#a09078',1.1);scene.add(hemi);
 const sun=new T.DirectionalLight('#fff2dc',2.3);sun.position.set(-5,12,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13});sun.shadow.normalBias=.035;scene.add(sun);
 const cache=new Map();
 function mat(color,roughness=.8,metalness=0){const key=`${color}/${roughness}/${metalness}`;if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color,roughness,metalness}));return cache.get(key);}
 // 配色按参照效果图（俯视剖切渲染）对齐：深红棕木地板与门扇、白墙、深炭灰沙发、
 // 橄榄绿单人椅与地毯、灰白床品。wood 是浅一档的橡木（桌板、椅腿），
 // walnut 是深红棕樱桃木（门扇、厨房柜门、电视柜），卧室衣柜统一用白色。
 const cream=mat('#efeae0'),white=mat('#f5f3ef'),wood=mat('#7b5230'),walnut=mat('#5a2e1e'),
   sage=mat('#879781'),dark=mat('#333c36'),brass=mat('#ac8952',.3,.65),black=mat('#202829',.35),
   fabric=mat('#c9c5bf'),sofa=mat('#3f4442'),steel=mat('#b7bbba',.3,.55);
 function box(parent,x,y,z,w,h,d,m,r=0){const mesh=new T.Mesh(r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function cylinder(parent,x,y,z,rt,rb,h,m){const mesh=new T.Mesh(new T.CylinderGeometry(rt,rb,h,24),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function ball(parent,x,y,z,r,m,scale=[1,1,1]){const mesh=new T.Mesh(new T.SphereGeometry(r,20,12),m);mesh.position.set(x,y,z);mesh.scale.set(...scale);mesh.castShadow=true;parent.add(mesh);return mesh;}
 function texture(kind){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');let seed=37;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
  if(kind==='wood'){
   // 深红棕人字拼：短板长宽比 4:1，正交咬合后整体转 45°。
   // 每块板的随机种子按贴图周期重复，接缝两侧的颜色和木纹保持一致。
   const width=512/(8*Math.SQRT2),length=width*4;
   const plank=(x,y,vertical,key)=>{
    seed=key+37;ctx.save();ctx.translate(x,y);if(vertical)ctx.rotate(Math.PI/2);
    ctx.fillStyle=`hsl(${13+rand()*5},${36+rand()*7}%,${20+rand()*6}%)`;ctx.fillRect(.5,.5,length-1,width-1);
    for(let i=0;i<28;i++){const y=rand()*width;ctx.strokeStyle=`rgba(43,18,12,${.06+rand()*.16})`;ctx.lineWidth=.3+rand()*.6;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(length*.3,y+rand()*3,length*.7,y-rand()*3,length,y);ctx.stroke();}
    ctx.strokeStyle='rgba(239,186,137,.13)';ctx.lineWidth=.7;ctx.strokeRect(1,1,length-2,width-2);ctx.restore();
   };
   ctx.fillStyle='#42261e';ctx.fillRect(0,0,512,512);ctx.translate(256,256);ctx.rotate(Math.PI/4);
   for(let row=-13;row<=13;row++)for(let col=-4;col<=4;col++){
    const x=(-row+col*8)*width,y=row*width,key=(((row%8)+8)%8)*2+((col%2)+2)%2;
    plank(x,y,false,key*113+1);plank(x+length+width,y,true,key*113+53);
   }
  }else if(kind==='stripe'){
   // 客厅地毯：绿底米色竖条，条上再压一排横向短划线，和参照图的条纹地毯一致。
   const green='#454f33',pale='#c9bfa0';let x=0,i=0;
   while(x<512){const w=i%2?36:92;ctx.fillStyle=i%2?pale:green;ctx.fillRect(x,0,w,512);
    if(i%2===0){ctx.fillStyle='rgba(233,228,214,.42)';for(let y=26;y<512;y+=74)ctx.fillRect(x+18,y,w-36,9);}
    x+=w;i++;}
  }
  const t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.setScalar(kind==='wood'?1:2);t.anisotropy=renderer.capabilities.getMaxAnisotropy();t.colorSpace=T.SRGBColorSpace;return t;
 }
 const timber=new T.MeshStandardMaterial({map:texture('wood'),roughness:.72});
 const rugStripe=new T.MeshStandardMaterial({map:texture('stripe'),roughness:1});
 function floor(x,z,w,d,type='wood'){
  box(home,x+w/2,-.18,z+d/2,w,.34,d,mat('#d0c8b8'),.025);const surface=box(home,x+w/2,.005,z+d/2,w,.03,d,type==='wood'?timber:mat(type==='bath'?'#e2ded4':'#5c6162'));
  // 按全屋坐标铺纹理，保持 9×36 厘米的板幅，地面分块不会拉伸或重置拼缝。
  if(type==='wood'){const pos=surface.geometry.attributes.position,uv=surface.geometry.attributes.uv,tile=.09*8*Math.SQRT2;
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
 const walls=[];
 function wall(x1,z1,x2,z2){
  const {length,items}=openingsOf(x1,z1,x2,z2);
  const group=new T.Group();group.position.set((x1+x2)/2,0,(z1+z2)/2);group.rotation.y=-Math.atan2(z2-z1,x2-x1);home.add(group);
  const wm=mat('#f2f1ed').clone();wm.transparent=true;const pieces=[];
  const TH=WALL_THICKNESS,BASE=.195,TOP=2.645;   // 墙厚 / 墙身上沿、下沿，下面 .195 让给墙脚
  // 注意别把墙厚命名成 T：外层是 `import * as T from 'three'`，函数里再 const T 会遮蔽它，
  // 而本函数开头就要用 T.Group / T.Box3，直接踩 TDZ（构建后报 “Cannot access 'N' before initialization”）。
  const L=t=>t-length/2;                        // 沿墙距离 → 组内局部坐标
  // 墙脚整段拉通（含洞口下方），对应墙身的实心段则按洞口切分。
  box(group,0,.095,0,length,.19,.13,cream);
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
 function plant(parent,x,z,height=1){cylinder(parent,x,.18,z,.15,.11,.36,mat('#baa78d'));for(let i=0;i<8;i++){const a=i*2.4;const stem=cylinder(parent,x,.4+height*.2,z,.01,.012,height*.65,wood);stem.rotation.z=Math.sin(a)*.2;const leaf=ball(parent,x+Math.sin(a)*.16,.44+height*(.25+i*.045),z+Math.cos(a)*.17,.17,mat(i%2?'#657b52':'#81916b'),[.65,1.65,.7]);leaf.rotation.z=Math.sin(a)*.6;}}
 function bed(parent,x,z,w,color,length=2.02,headboard=true){const group=new T.Group();group.position.set(x,0,z);parent.add(group);box(group,0,.22,0,w,.32,length+.01,wood,.06);box(group,0,.46,0,w,.25,length,white,.075);box(group,0,.57,-.3*length/2.02,w+.06,.16,1.4*length/2.02,mat(color),.065);if(headboard)box(group,0,.77,length/2-.01,w+.1,1.12,.16,fabric,.06);
  for(const px of w<=1.2?[0]:[-w*.25,w*.25])box(group,px,.65,length/2-.32,w*(w<=1.2?.65:.42),.17,.43,white,.075);for(let i=0;i<7;i++)box(group,-w/2+.06+i*(w-.12)/6,.656,-.38*length/2.02,.014,.006,.9*length/2.02,mat(color),.003);
 }
 function wardrobe(parent,x,z,w,d){box(parent,x,1.1,z,w,2.16,d,white,.025);for(let i=-w/2+.43;i<w/2;i+=.48){box(parent,x+i,1.1,z+d/2+.006,.009,2.04,.009,mat('#d3d2ce'));box(parent,x+i-.065,1.06,z+d/2+.03,.02,.29,.027,brass);}}
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
 furnishing('bed-b',g=>bed(g,0,0,1.8,'#7e8974',2));
 furnishing('bed-c',g=>bed(g,0,0,1.2,'#b49c86',2,false));
 furnishing('bed-a',g=>bed(g,0,0,1.5,'#889c98',1.8));
 furnishing('wardrobe-a',g=>wardrobe(g,0,0,1,.5));
 // 柜体与门洞共用同一组尺寸，两侧预留 5 厘米，门扇可以完全打开。
 function northWardrobe(g,id,overhead=false){
  const [x,,w]=ROOMS.find(r=>r.id===id).extent;
  const opening=OPENINGS.find(o=>o.id===({b:'u-ssaMtxkP8I6YOZ',c:'u-WF4N16KP8i6X1b'})[id]);
  const r={x:x+WALL_THICKNESS/2,w:w-WALL_THICKNESS},d={x:opening.cx-opening.len/2,w:opening.len},anchor=layout.get(`wardrobe-${id}`);
  for(const [left,right] of [[r.x,d.x-.05],[d.x+d.w+.05,r.x+r.w]]){
   if(right-left>=.18)wardrobe(g,(left+right)/2-anchor.x,0,right-left,.6);
  }
  if(overhead){box(g,0,2.41,0,r.w,.46,.6,white,.025);for(let x=-r.w/2+.48;x<r.w/2;x+=.48)box(g,x,2.41,.306,.009,.38,.009,mat('#d3d2ce'));}
 }
 furnishing('wardrobe-b',g=>northWardrobe(g,'b',true));
 furnishing('wardrobe-c',g=>northWardrobe(g,'c'));
// 入户玄关：实测全景里门厅西侧是一排白色矮柜，柜面放钥匙盘。深度 0.32 让出过道净宽，
// rot 270 表示柜门朝西（面向室内），柜背贴着厨房那面墙。
furnishing('hall-cabinet',g=>{
 const body=mat('#fbfaf5',.85),face=mat('#e6e3d8',.8);
 box(g,0,.52,0,.90,1.04,.32,body,.02);
 box(g,0,.10,0,.86,.02,.28,face,.01);
 for(const x of [-.30,0,.30]){box(g,x,.17,-.158,.24,.012,.012,brass);box(g,x,.78,-.158,.24,.012,.012,brass);}
 box(g,0,.86,-.02,.86,.012,.26,mat('#d9d5c8',.7));
 cylinder(g,-.24,1.10,0,.09,.075,.09,mat('#cfd6cd',.5));
});
 // 储物间：西墙开放式自行车架及展示层板，北窗下木色电脑桌，南侧留出开门空间。
 furnishing('bike-cabinet',g=>{
  const tyre=mat('#2b2f30',.55),alloy=mat('#6f7674',.35,.5);
  box(g,0,.04,0,.40,.08,2.20,walnut,.01);
  box(g,-.19,1.03,0,.02,1.98,2.20,walnut);
  // 展示层板只放在车身两端，不穿过车架和车轮。
  for(const z of [-.91,.91])for(const y of [.45,1.02,1.62]){
   box(g,-.025,y,z,.35,.035,.32,wood,.008);
   cylinder(g,-.03,y+.10,z,.065,.055,.17,cream);
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
 furnishing('desk-gaming',g=>{
  const steel=mat('#4a5350',.4,.4),dark=mat('#2b2f30',.5,.2);
  box(g,0,.72,0,1.36,.045,.75,wood,.02);                                          // 桌面 1.36×0.75
  for(const x of [-.62,.62])for(const z of [-.30,.30])box(g,x,.36,z,.05,.72,.05,steel);
  box(g,0,.10,0,1.20,.03,.06,steel);
  for(const x of [-.30,.30])for(const z of [-.28,.28])box(g,x,.02,z,.09,.05,.09,dark);
  box(g,0,.79,-.30,.11,.16,.09,dark);box(g,0,.90,-.30,.05,.32,.05,dark);box(g,0,1.12,-.30,.62,.36,.02,mat('#1c2422',.4));   // 显示器
  box(g,0,.752,.02,.46,.02,.15,dark,.01);                                            // 键盘
  box(g,.42,.752,.05,.07,.025,.10,dark,.025);                                      // 鼠标
  cylinder(g,-.52,.79,-.18,.055,.045,.11,cream);
  const chair=new T.Group();chair.position.set(.16,0,.50);g.add(chair);              // 主位椅子
  for(let i=0;i<5;i++){const a=i*1.2566;const arm=box(chair,Math.sin(a)*.16,.05,Math.cos(a)*.16,.05,.03,.30,dark,.012);arm.rotation.y=-a;}
  cylinder(chair,0,.25,0,.035,.035,.34,mat('#5a6360',.4,.5));
  box(chair,0,.45,0,.48,.09,.46,mat('#3a4340',.6),.04);                              // 坐垫
  box(chair,0,.78,.24,.44,.66,.09,mat('#3a4340',.6),.045);                           // 靠背朝南，人面向北边的桌子
  for(const x of [-.25,.25])box(chair,x,.60,0,.05,.16,.04,dark);
 });
 // 客厅软装：深炭灰沙发贴东墙，白色圆茶几配木色圆边几，橄榄绿单人椅在地毯南端。
 furnishing('sofa',g=>{
  box(g,-.01,.23,0,.86,.3,2.68,walnut,.07);box(g,.33,.66,0,.2,.83,2.73,sofa,.08);
  for(const z of [-.89,0,.89]){box(g,-.08,.45,z,.7,.24,.86,sofa,.08);box(g,.2,.79,z,.23,.57,.78,sofa,.07);}
  for(const z of [-1.37,1.37])box(g,-.01,.53,z,.9,.55,.2,sofa,.065);
  for(const [z,color] of [[-.96,'#7f8a63'],[.08,'#f0ece2'],[.82,'#cec8ba']]){const cushion=box(g,-.09,.74,z,.21,.4,.44,mat(color),.055);cushion.rotation.z=.25;cushion.rotation.x=.14;}
  box(g,0,.26,1.70,.72,.50,.50,walnut,.035);                                      // 南端木色边柜与落地灯相邻
 });
 furnishing('coffee',g=>{cylinder(g,0,.40,0,.43,.43,.07,white);cylinder(g,0,.19,0,.055,.055,.36,mat('#3f4442',.5,.3));
  // 木色圆边几，落在茶几西南侧
  cylinder(g,-.12,.27,.62,.21,.21,.05,walnut);cylinder(g,-.12,.13,.62,.19,.19,.27,mat('#5f3624',.7));
  // 茶几上那盆小绿植
  cylinder(g,.04,.445,.02,.075,.06,.11,mat('#cfc8ba'));
  for(let i=0;i<6;i++){const a=i*1.05;ball(g,.04+Math.cos(a)*.085,.575,.02+Math.sin(a)*.085,.075,mat(i%2?'#6f7f57':'#81916b'),[.7,1.5,.7]);}});
 furnishing('tv-unit',g=>{box(g,0,.29,0,.43,.48,2.42,walnut,.045);for(const z of [-.83,0,.83])box(g,.224,.33,z,.008,.01,.65,brass);
  // 参照图里客厅西墙这条长柜就是绿植柜：电视两侧各摆一盆，柜前地上一盆。
  for(const z of [-1.02,1.02]){cylinder(g,0,.585,z,.09,.07,.13,mat('#cfc8ba'));
   for(let i=0;i<6;i++){const a=i*1.05;ball(g,Math.cos(a)*.1,.72,z+Math.sin(a)*.1,.085,mat(i%2?'#6f7f57':'#81916b'),[.7,1.5,.7]);}}
 });
 // 岛台独立于橱柜，南面台板悬挑配两把吧椅，不再另放圆餐桌。
 furnishing('dining',g=>{
  box(g,0,.44,-.08,1.55,.84,.54,walnut,.025);box(g,0,.91,0,1.65,.08,.80,white,.025);
  for(const x of [-.39,.39]){
   box(g,x,.44,.195,.012,.74,.012,brass);
   const chair=new T.Group();chair.position.set(x,0,.79);g.add(chair);
   const shell=new T.Group();shell.position.y=.25;shell.scale.set(.65,.8,.65);shell.rotation.y=Math.PI;chair.add(shell);podChair(shell,'#e6dfd0','#c9c5bf');
   for(const dx of [-.17,.17])for(const dz of [-.16,.16])box(chair,dx,.29,dz,.035,.58,.035,wood);
  }
  cylinder(g,-.48,1.01,-.06,.075,.06,.14,cream);
  for(let i=0;i<5;i++){const a=i*1.26;ball(g,-.48+Math.sin(a)*.07,1.16,-.06+Math.cos(a)*.07,.07,sage,[.6,1.6,.7]);}
  cylinder(g,.44,.975,0,.14,.13,.04,dark);for(const x of [.36,.46,.55])ball(g,x,1.03,0,.055,sage);
 });
// 单人椅：参照图里地毯南端那把橄榄绿扶手椅，靠背朝南、面向茶几。
furnishing('armchair',g=>{const green=mat('#66724a',.92);
 box(g,0,.19,0,.78,.38,.72,green,.07);box(g,0,.60,.28,.74,.72,.16,green,.07);
 for(const x of [-.34,.34])box(g,x,.42,0,.10,.30,.70,green,.06);
 box(g,0,.40,-.06,.56,.10,.50,green,.05);
 const cushion=box(g,0,.58,.14,.40,.34,.10,mat('#76805a'),.05);cushion.rotation.x=-.18;});
// 圆壳椅：参照图里地毯北端那把奶油色桶形椅，壳口环抱、内衬绿坐垫，面朝南边的茶几。
// 半环靠背用 TorusGeometry 的 PI 段：绕 X 转 -90° 后正好扣在 -z 一侧，也就是椅背朝北。
function podChair(g,shell,pad){
 const c=mat(shell,.95);
 cylinder(g,0,.20,0,.40,.36,.40,c);
 cylinder(g,0,.43,0,.40,.40,.05,c);
 cylinder(g,0,.35,0,.29,.29,.09,mat(pad,.95));
 const back=new T.Mesh(new T.TorusGeometry(.37,.085,10,26,Math.PI),c);
 back.rotation.x=-Math.PI/2;back.position.set(0,.53,.06);back.castShadow=true;g.add(back);
}
furnishing('armchair-n',g=>podChair(g,'#e6dfd0','#7f8a63'));
 furnishing('plants-l',g=>plant(g,0,0,1.1));
 furnishing('plants-bal',g=>plant(g,0,0,.8));
 furnishing('kitchen-counter',g=>{
  // 北侧水槽台和东侧灶台以端面拼接成 L 形，南端空位放冰箱。
  box(g,0,.45,-.95,2.0328,.88,.56,walnut,.02);box(g,0,.91,-.95,2.0928,.06,.60,white,.02);
  box(g,.7464,.45,.035,.54,.88,1.37,walnut,.02);box(g,.7464,.91,.035,.60,.06,1.37,white,.02);
  for(const x of [-.68,0,.68])box(g,x,.55,-.659,.014,.56,.018,brass);
  for(const z of [-.40,.30])box(g,.467,.55,z,.018,.02,.29,brass);
  box(g,0,.949,-.95,.76,.014,.43,steel,.02);
  for(const x of [-.19,.19])box(g,x,.96,-.95,.32,.016,.33,dark,.025);
  cylinder(g,0,1.08,-1.16,.018,.018,.25,steel);box(g,0,1.205,-1.08,.035,.035,.19,steel,.01);
  box(g,0,1.36,-1.235,2.0328,.76,.018,cream);
  box(g,0,2.03,-1.10,2.0328,.62,.30,cream,.02);
  for(const x of [-.68,0,.68])box(g,x,2.03,-.944,.012,.55,.012,brass);
 });
 // 卫生间门内北侧淋浴、东侧马桶；洗手台放门外东侧凹位，干湿分离。
 furnishing('bath-fixtures',g=>{
  const chrome=mat('#c3c7c6',.2,.85),stone=mat('#e3dfd7',.55);
  const glass=new T.MeshStandardMaterial({color:'#bcd2cd',roughness:.08,transparent:true,opacity:.22,depthWrite:false});
  box(g,-.23,.035,-.46,1.04,.035,.72,stone,.012);
  for(const z of [-.73,-.55,-.37,-.19])box(g,-.23,.058,z,.98,.006,.012,mat('#c9c5bb',.7));
  box(g,.30,1.02,-.46,.025,1.92,.72,glass,.004);                          // 东侧固定玻璃，南侧进出
  cylinder(g,-.35,2.12,-.69,.13,.13,.028,chrome);
  cylinder(g,-.35,1.60,-.79,.018,.018,1.04,chrome);
 });
 furnishing('bath-toilet',g=>{
  const porcelain=mat('#f8f7f4',.22);
  box(g,.26,.42,0,.18,.62,.46,porcelain,.04);
  cylinder(g,0,.20,0,.20,.22,.40,porcelain);ball(g,0,.50,0,.25,porcelain,[1.25,.28,.86]);
 });
 furnishing('bath-vanity',g=>{
  const chrome=mat('#c3c7c6',.2,.85);
  box(g,0,.035,0,.54,.03,.72,cream,.01);
  box(g,0,.41,0,.50,.76,.64,walnut,.02);box(g,0,.82,0,.54,.06,.68,white,.02);
  ball(g,-.04,.87,0,.20,mat('#fbfaf7',.2),[.9,.30,1.25]);
  cylinder(g,.17,.96,0,.016,.016,.20,chrome);box(g,.11,1.05,0,.14,.025,.025,chrome,.005);
  box(g,.262,1.41,0,.015,.78,.60,mat('#cfd6d3',.15,.6),.01);
  cylinder(g,.06,.91,-.25,.045,.04,.12,cream);
 });
 const visuals=new Map(),clickable=[];let devices=initialDevices;
 for(const d of devices){
  // 台灯、电视、电磁灶挂在对应家具上，由场景图的父子变换带动旋转，无需手工换算偏移。
  const host=d.attach?furniture.find(f=>f.id===d.attach):null;
  const group=new T.Group();group.position.set(host?d.x-host.x:d.x,d.y,host?d.z-host.z:d.z);(host?host.group:home).add(group);let glow,light,screen,rotor;
  if(d.type==='light'){
   const low=d.id==='floor-light';
   if(low){const bottom=0;cylinder(group,0,bottom-d.y+.02,0,.16,.19,.05,dark);cylinder(group,0,(bottom-d.y)/2,0,.015,.015,d.y-bottom,brass);glow=cylinder(group,0,0,0,.16,.25,.26,white.clone());}
   else{cylinder(group,0,.14,0,.014,.014,.28,brass);glow=cylinder(group,0,0,0,d.room==='living'?.3:.2,d.room==='living'?.38:.23,.12,white.clone());}
   glow.castShadow=false;light=new T.SpotLight('#ffd19a',0,5,Math.PI*.42,.8,1.7);light.position.set(0,-.17,0);light.target.position.set(0,-d.y,0);light.castShadow=true;light.shadow.mapSize.set(256,256);light.shadow.normalBias=.04;group.add(light,light.target);
  }else if(d.type==='tv'){
   box(group,0,0,0,.08,1.01,1.63,black,.04);screen=box(group,.047,0,0,.01,.88,1.49,mat('#192b29').clone(),.01);box(group,0,-.56,0,.23,.045,.63,black,.02);
  }else if(d.type==='ac'){
   if(['ac-b','ac-c'].includes(d.id))group.rotation.y=Math.PI/2; // 北墙柜占用原机位，空调改挂西墙、出风朝东。
   const side=d.room==='living';box(group,0,0,0,side?.24:1.03,.31,side?1.03:.24,white,.06);for(let i=0;i<5;i++)box(group,side?-.125:0,-.085+i*.02,side?0:.125,side?.012:.87,.007,side?.87:.012,mat('#b0b8ac'));glow=ball(group,side?-.13:.39,.07,side?.38:.13,.02,mat('#6aac8c').clone());
  }else if(d.type==='fridge'){
   group.rotation.y=-Math.PI/2; // 冰箱背靠东墙，向西开门，位于灶台南端。
   box(group,0,0,0,.67,1.9,.66,mat('#9ea9a2',.34,.45),.045);box(group,0,.2,.334,.015,1.37,.012,dark);box(group,0,-.5,.335,.61,.014,.01,dark);for(const x of [-.065,.065])box(group,x,.16,.36,.025,.48,.03,dark,.01);
  }else if(d.type==='washer'){
   box(group,0,0,0,.67,.88,.63,white,.04);const door=cylinder(group,0,-.03,.335,.237,.237,.055,black);door.rotation.x=Math.PI/2;rotor=new T.Group();rotor.position.set(0,-.03,.371);group.add(rotor);const drum=cylinder(rotor,0,0,0,.18,.18,.02,mat('#6e8983',.15,.65));drum.rotation.x=Math.PI/2;for(let i=0;i<3;i++){const fin=box(rotor,Math.cos(i*2.094)*.07,Math.sin(i*2.094)*.07,.015,.025,.14,.012,mat('#c0ccc3',.3,.5),.008);fin.rotation.z=i*2.094;}box(group,-.17,.32,.329,.12,.05,.013,dark);ball(group,.2,.32,.34,.04,brass);
  }else if(d.type==='hood'){
   box(group,0,0,0,.52,.14,.68,steel,.025);box(group,.08,.26,0,.32,.48,.34,dark,.015);
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
  hemi.intensity=T.MathUtils.lerp(hemi.intensity,night?.13:1.1,ease);sun.intensity=T.MathUtils.lerp(sun.intensity,night?.04:2.3,ease);scene.environmentIntensity=T.MathUtils.lerp(scene.environmentIntensity,night?.06:.3,ease);
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
  top(){tween={position:new T.Vector3(4.88,22,5.53),target:new T.Vector3(4.88,0,5.52)};},zoom(factor){tween=null;const offset=camera.position.clone().sub(controls.target);offset.setLength(T.MathUtils.clamp(offset.length()*factor,4,30));camera.position.copy(controls.target).add(offset);},stats(){return {drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,walls:walls.length,hiddenWalls:walls.filter(w=>w.target<1).length};},dispose(){observer.disconnect();renderer.setAnimationLoop(null);controls.dispose();environmentMap.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});renderer.dispose();renderer.domElement.remove();}};
}
