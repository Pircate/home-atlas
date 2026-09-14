import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {rooms} from './state.js';

export function createHome(container,initialDevices,onSelect){
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
 // 以户型图北向为 -Z，各房间地面独立，保留不规则外轮廓。
 floor(0,2.25,1.95,2.35);floor(2.02,.86,1.94,2.74);floor(4.04,.86,1.59,1.77,'bath');floor(1.95,3.6,3.68,1.04,'tile');floor(4.04,2.63,1.59,.97,'tile');
 floor(0,4.68,3.2,3.72);floor(3.28,4.68,2.35,3.72);floor(5.71,2.57,3.42,5.83,'tile');floor(5.71,1.67,1.2,.9,'tile');floor(6.99,0,2.14,2.57,'tile');floor(5.71,8.46,3.42,1.2,'tile');
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
 function rug(x,z,w,d){box(home,x,.04,z,w,.035,d,rugMaterial,.04);}
 function plant(x,z,height=1){cylinder(home,x,.18,z,.15,.11,.36,mat('#baa78d'));for(let i=0;i<8;i++){const a=i*2.4;const stem=cylinder(home,x,.4+height*.2,z,.01,.012,height*.65,wood);stem.rotation.z=Math.sin(a)*.2;const leaf=ball(home,x+Math.sin(a)*.16,.44+height*(.25+i*.045),z+Math.cos(a)*.17,.17,mat(i%2?'#657b52':'#81916b'),[.65,1.65,.7]);leaf.rotation.z=Math.sin(a)*.6;}}
 function bed(x,z,w,color){const group=new T.Group();group.position.set(x,0,z);home.add(group);box(group,0,.22,0,w,.32,2.03,wood,.06);box(group,0,.46,0,w+.02,.25,2.02,white,.075);box(group,0,.57,-.3,w+.06,.16,1.4,mat(color),.065);box(group,0,.77,1,w+.14,1.12,.16,fabric,.06);
  for(const px of [-w*.25,w*.25])box(group,px,.65,.69,w*.42,.17,.43,white,.075);for(let i=0;i<7;i++)box(group,-w/2+.06+i*(w-.12)/6,.656,-.38,.014,.006,.9,mat(color),.003);
 }
 rug(1.65,6.8,2.7,2.8);bed(1.62,6.89,1.6,'#7e8974');box(home,.47,.31,7.66,.52,.54,.49,wood,.03);box(home,2.73,.31,7.66,.45,.54,.49,wood,.03);
 bed(4.41,6.89,1.43,'#b49c86');box(home,5.12,.3,7.66,.42,.53,.46,wood,.03);bed(2.72,2.43,1.03,'#889c98');
 box(home,3.54,.75,1.22,.63,.06,.54,wood,.025);for(const x of [3.31,3.77])box(home,x,.37,1.22,.04,.75,.4,wood);box(home,3.57,.4,1.7,.38,.12,.38,sage,.035);box(home,3.57,.6,1.89,.38,.42,.07,sage,.03);
 function wardrobe(x,z,w,d){box(home,x,1.1,z,w,2.16,d,cream,.025);for(let i=-w/2+.43;i<w/2;i+=.48){box(home,x+i,1.1,z+d/2+.006,.009,2.04,.009,mat('#c5bcaa'));box(home,x+i-.065,1.06,z+d/2+.03,.02,.29,.027,brass);}}
 wardrobe(.38,5.37,.61,1.1);wardrobe(4.37,5.04,1.95,.5);wardrobe(.35,3.42,.55,1.88);box(home,1.22,.55,2.56,.85,1.06,.46,wood,.025);for(let i=0;i<3;i++){box(home,1.22,.3+i*.28,2.802,.74,.01,.012,brass);box(home,1.22,.34+i*.28,2.82,.24,.014,.02,brass);}
 // 客厅软装，沙发靠东墙，电视面向沙发。
 rug(7.47,6.63,2.5,2.82);box(home,8.56,.23,6.58,.86,.3,2.68,wood,.07);box(home,8.9,.66,6.58,.2,.83,2.73,fabric,.08);
 for(let z=5.69;z<7.5;z+=.89){box(home,8.49,.45,z,.7,.24,.86,cream,.08);box(home,8.77,.79,z,.23,.57,.78,cream,.07);}
 for(const z of [5.21,7.95])box(home,8.56,.53,z,.9,.55,.2,fabric,.065);
 for(const [z,color] of [[5.62,'#7d8d72'],[6.66,'#c2a581'],[7.4,'#eee6d5']]){const cushion=box(home,8.48,.74,z,.21,.4,.44,mat(color),.055);cushion.rotation.z=.25;cushion.rotation.x=.14;}
 box(home,7.23,.37,6.65,.92,.115,1.36,wood,.1);for(const z of [6.17,7.08])cylinder(home,7.23,.18,z,.19,.23,.33,dark);
 box(home,7.25,.447,6.98,.3,.027,.35,cream);box(home,7.28,.468,6.98,.29,.018,.32,sage);cylinder(home,7.21,.53,6.32,.11,.075,.19,mat('#6e6351'));ball(home,7.21,.65,6.32,.15,sage,[1,.35,1]);
 box(home,5.99,.29,6.48,.43,.48,2.42,wood,.045);for(const z of [5.65,6.48,7.31])box(home,6.214,.33,z,.008,.01,.65,brass);
 cylinder(home,7.25,.76,3.85,.64,.64,.08,wood);cylinder(home,7.25,.39,3.85,.16,.3,.72,dark);
 for(const [x,z,rotation] of [[6.37,3.85,-Math.PI/2],[8.13,3.85,Math.PI/2],[7.25,4.73,0]]){const chair=new T.Group();chair.position.set(x,0,z);chair.rotation.y=rotation;home.add(chair);box(chair,0,.43,0,.47,.12,.45,sage,.065);box(chair,0,.66,.21,.47,.48,.08,sage,.04);for(const dx of [-.16,.16])for(const dz of [-.15,.15])box(chair,dx,.2,dz,.035,.4,.035,wood);}
 cylinder(home,7.25,.87,3.85,.085,.065,.18,cream);plant(8.63,3.11,1.1);plant(7.08,9.32,.8);
 // 厨房柜体、工作台、水槽和卫生间。
 box(home,8.77,.45,1.28,.63,.88,2.33,sage,.025);box(home,8.75,.91,1.28,.71,.06,2.36,white,.025);for(const z of [.43,1.27,2.06])box(home,8.447,.56,z,.02,.018,.34,brass);
 box(home,8.71,.945,2.05,.46,.016,.47,mat('#89988f',.26,.65),.04);box(home,8.71,.952,2.05,.35,.018,.35,dark,.03);cylinder(home,8.92,1.07,2.05,.022,.022,.24,brass);box(home,8.88,1.19,2.05,.1,.035,.04,brass,.01);
 box(home,4.38,.42,1.15,.5,.76,.38,white,.06);cylinder(home,4.38,.27,1.63,.18,.21,.5,white);ball(home,4.38,.52,1.67,.28,white,[.88,.3,1.32]);box(home,5.31,.7,2.26,.51,.12,.46,white,.08);box(home,5.35,1.44,2.55,.43,.68,.03,mat('#a5beb2',.12,.88),.04);
 const visuals=new Map(),clickable=[];let devices=initialDevices;
 for(const d of devices){const group=new T.Group();group.position.set(d.x,d.y,d.z);home.add(group);let glow,light,screen,rotor;
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
  group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group),size=bounds.getSize(new T.Vector3()).max(new T.Vector3(.32,.24,.32));const center=bounds.getCenter(new T.Vector3()).sub(group.position);
  const hit=new T.Mesh(new T.BoxGeometry(size.x,size.y,size.z),new T.MeshBasicMaterial({visible:false}));hit.position.copy(center);hit.userData.device=d.id;group.add(hit);clickable.push(hit);visuals.set(d.id,{group,glow,light,screen,rotor});
 }
 // 多盏聚光灯的 ShadowMaterial 会把光锥外区域也计为阴影；底座仅使用柔和接触影。
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const shadowContext=shadowCanvas.getContext('2d');const shadowGradient=shadowContext.createRadialGradient(64,64,20,64,64,64);shadowGradient.addColorStop(0,'rgba(48,55,39,.2)');shadowGradient.addColorStop(.6,'rgba(48,55,39,.11)');shadowGradient.addColorStop(1,'rgba(48,55,39,0)');shadowContext.fillStyle=shadowGradient;shadowContext.fillRect(0,0,128,128);
 const ground=new T.Mesh(new T.PlaneGeometry(16,16),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));ground.rotation.x=-Math.PI/2;ground.position.set(4.5,-.36,4.8);scene.add(ground);
 const ring=new T.Mesh(new T.RingGeometry(.31,.335,60),new T.MeshBasicMaterial({color:'#b9944f',transparent:true,opacity:.95,side:T.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;ring.renderOrder=10;scene.add(ring);
 let night=false,wallMode='auto',selected=null,tween=null,down=null,lastTime=0,wallCounter=0;
 const pickRay=new T.Raycaster(),pointer=new T.Vector2();
 function pick(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);pickRay.setFromCamera(pointer,camera);return pickRay.intersectObjects(clickable,false)[0]?.object.userData.device;}
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};tween=null;});renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const id=pick(e);if(id)onSelect(id);}down=null;});renderer.domElement.addEventListener('pointercancel',()=>{down=null;});renderer.domElement.addEventListener('pointermove',e=>{renderer.domElement.style.cursor=down?'grabbing':pick(e)?'pointer':'grab';});
 function update(next){devices=next;for(const d of next){const v=visuals.get(d.id);for(const glow of (Array.isArray(v.glow)?v.glow:v.glow?[v.glow]:[])){const color=d.type==='stove'?'#ed602e':d.type==='light'?(d.colorTemperature>4500?'#dcecff':'#ffc278'):'#7abf98';glow.material.emissive.set(color);glow.material.emissiveIntensity=d.on?(d.type==='light'?d.brightness/70:.8):0;}
   if(v.light){v.light.userData.intensity=d.on?40*d.brightness/100:0;v.light.color.set('#ffd099').lerp(new T.Color('#deebff'),(d.colorTemperature-2700)/3800);}
   if(v.screen){v.screen.material.color.set(d.on?'#547f76':'#17221f');v.screen.material.emissive.set(d.on?'#548f7c':'#000000');v.screen.material.emissiveIntensity=d.on?.7:0;}
  }}
 function focus(id){const r=rooms.find(r=>r.id===id)||rooms[0];tween={target:new T.Vector3(r.x,.1,r.z),position:id==='all'?new T.Vector3(12,13.7,18):new T.Vector3(r.x+3.3,7.5,r.z+5.3)};}
 function select(id){selected=id;const d=devices.find(d=>d.id===id);ring.visible=!!d;if(d)ring.position.set(d.x,.06,d.z);}
 const observer=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();if(width&&height){camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);}});observer.observe(container);update(devices);
 const wallRay=new T.Ray(),direction=new T.Vector3(),point=new T.Vector3(),targets=[...rooms.filter(r=>r.id!=='all').flatMap(r=>[-.55,.55].flatMap(x=>[-.55,.55].map(z=>new T.Vector3(r.x+x,.4,r.z+z)))),...devices.map(d=>new T.Vector3(d.x,.5,d.z))];
 renderer.setAnimationLoop(time=>{const dt=Math.min((time-lastTime)/1000,.05)||.016;lastTime=time;const ease=1-Math.exp(-dt*9);
  if(tween){camera.position.lerp(tween.position,ease);controls.target.lerp(tween.target,ease);if(camera.position.distanceTo(tween.position)<.02)tween=null;}controls.update();
  hemi.intensity=T.MathUtils.lerp(hemi.intensity,night?.13:1.1,ease);sun.intensity=T.MathUtils.lerp(sun.intensity,night?.04:2.3,ease);scene.environmentIntensity=T.MathUtils.lerp(scene.environmentIntensity,night?.06:.3,ease);
  if(wallCounter++%6===0)for(const w of walls){const hide=wallMode==='low'||(wallMode==='auto'&&targets.some(t=>{direction.subVectors(t,camera.position);const dist=direction.length();wallRay.set(camera.position,direction.normalize());return wallRay.intersectBox(w.bounds,point)&&point.distanceTo(camera.position)<dist-.3;}));w.target=hide?.055:1;}
  for(const w of walls){w.wm.opacity=T.MathUtils.lerp(w.wm.opacity,w.target,ease);w.wm.depthWrite=w.wm.opacity>.5;for(const p of w.pieces){p.castShadow=w.wm.opacity>.5;if(p.material!==w.wm)p.visible=w.wm.opacity>.5;}}
  for(const d of devices){const v=visuals.get(d.id);if(v.light){v.light.intensity=T.MathUtils.lerp(v.light.intensity,v.light.userData.intensity,ease);v.light.visible=v.light.intensity>.01;}if(v.rotor&&d.on&&d.running)v.rotor.rotation.z+=dt*3;}
  if(selected)ring.scale.setScalar(1+Math.sin(time*.002)*.025);renderer.render(scene,camera);
 });
 return {update,focus,select,setNight(v){night=v;},setWalls(v){wallMode=v;},top(){tween={position:new T.Vector3(4.5,20,4.91),target:new T.Vector3(4.5,0,4.9)};},zoom(factor){tween=null;const offset=camera.position.clone().sub(controls.target);offset.setLength(T.MathUtils.clamp(offset.length()*factor,4,30));camera.position.copy(controls.target).add(offset);},stats(){return {drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,walls:walls.length,hiddenWalls:walls.filter(w=>w.target<1).length};},dispose(){observer.disconnect();renderer.setAnimationLoop(null);controls.dispose();environmentMap.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});renderer.dispose();renderer.domElement.remove();}};
}
