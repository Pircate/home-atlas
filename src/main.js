import './style.css';
import {createIcons,House,Sun,Moon,Lightbulb,Snowflake,Tv,Refrigerator,WashingMachine,Wind,Flame,Speaker,X,Plus,Minus,RotateCcw,RotateCw,Undo2,Move,Layers,Maximize,ChevronRight,ArrowUpRight,Armchair,BedDouble,CookingPot,Bath,Package,Flower2,Footprints,Check,ChevronDown,SlidersHorizontal} from 'lucide';
import {createHome} from './model.js';
import {rooms,createDevices,applyScene,power,restore,furnitureDefaults,restoreLayout} from './state.js';

const icons={House,Sun,Moon,Lightbulb,Snowflake,Tv,Refrigerator,WashingMachine,Wind,Flame,Speaker,X,Plus,Minus,RotateCcw,RotateCw,Undo2,Move,Layers,Maximize,ChevronRight,ArrowUpRight,Armchair,BedDouble,CookingPot,Bath,Package,Flower2,Footprints,Check,ChevronDown,SlidersHorizontal};
const icon=name=>`<i data-lucide="${name}"></i>`;
const refreshIcons=()=>createIcons({icons,attrs:{'stroke-width':1.5}});
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const roomIcons={all:'house',living:'armchair',b:'bed-double',c:'bed-double',a:'bed-double',kitchen:'cooking-pot',bath:'bath',storage:'package',balcony:'flower-2',hall:'footprints'};
const typeIcons={light:'lightbulb',ac:'snowflake',tv:'tv',fridge:'refrigerator',washer:'washing-machine',hood:'wind',stove:'flame',heater:'flame',speaker:'speaker'};
let devices=createDevices();try{devices=restore(devices,JSON.parse(localStorage.getItem('habitat-v1')));}catch{}
let layout=furnitureDefaults();try{layout=restoreLayout(JSON.parse(localStorage.getItem('habitat-layout-v1')));}catch{}
const furnitureNames=new Map(furnitureDefaults().map(f=>[f.id,f.name]));
const rotatableFurniture=new Set(furnitureDefaults().filter(f=>f.rotatable).map(f=>f.id));
let room='all',selected=null,night=false,walls='auto',filter='all',sceneName='',lastFocus=null,layoutMode=false,furnitureFocus=null;

$('#app').innerHTML=`
 <aside class="sidebar"><a href="/" class="brand" aria-label="栖居首页"><span class="brand-symbol">${icon('house')}</span><span>栖居<small>HABITAT</small></span></a>
 <div class="home-title"><span class="eyebrow">MY SPACE / 01</span><h1>日常，自有光。</h1><p>三室一厅 <b>·</b> 约 64 m² 净空间</p></div>
 <div class="section-label">我的房间 <span>09</span></div><nav id="rooms" aria-label="房间导航"></nav>
 <div class="sidebar-footer"><span class="dot"></span><div>本地交互演示<small>所有设备状态仅存储于此浏览器</small></div><span>V.01</span></div></aside>
 <main><header><div class="breadcrumbs">我的家 ${icon('chevron-right')} <strong id="breadcrumb">全屋视图</strong></div><div class="header-right"><span id="saved">${icon('check')} 已保存</span><button id="about" class="avatar" aria-label="模型说明">家</button></div></header>
 <section class="workspace"><div class="view-heading"><div><span class="eyebrow">A LITTLE CLOSER TO HOME</span><h2 id="view-title">家的每一面</h2><p>转动视角，发现熟悉日常里的细节。</p></div><div class="day-switch" aria-label="环境光照"><button data-day="day" class="active" aria-pressed="true">${icon('sun')} 日间</button><button data-day="night" aria-pressed="false">${icon('moon')} 夜晚</button></div></div>
 <div id="canvas" aria-label="三维家庭模型：拖动旋转、滚轮缩放、右键平移，点击电器打开菜单"></div>
 <div class="model-caption"><span class="dot"></span>3D 实时空间<span class="divider"></span><span id="lit-count"></span></div><div class="compass">N<span>↑</span><small>北</small></div>
 <div class="view-tools"><button id="view-3d" class="active" title="三维视角">3D</button><button id="view-top" title="俯视户型">2D</button><span></span><button id="zoom-in" aria-label="放大">${icon('plus')}</button><button id="zoom-out" aria-label="缩小">${icon('minus')}</button><button id="reset-view" aria-label="重置视角">${icon('rotate-ccw')}</button><span></span><button data-layout="toggle" role="switch" aria-checked="false" aria-label="布置模式，开启后可移动和旋转家具" title="布置模式">${icon('move')}</button></div>
 <div class="wall-control"><button id="wall-mode">${icon('layers')}<span id="wall-label">墙体自动避让</span>${icon('chevron-down')}</button></div>
 <div class="canvas-help"><span>拖动旋转</span><b>·</b><span>滚轮缩放</span><b>·</b><span>右键平移</span><b>·</b><span>点击家电控制</span></div>
 <div class="scene-strip"><div class="scene-label">让家，懂此刻<small>一键切换生活场景</small></div><button data-scene="home"><span class="scene-icon">${icon('sun')}</span><span>温暖归家<small>点亮公共空间</small></span></button><button data-scene="relax"><span class="scene-icon">${icon('moon')}</span><span>松弛夜晚<small>留下柔和的光</small></span></button><button data-scene="away"><span class="scene-icon">${icon('arrow-up-right')}</span><span>安心离家<small>关闭灯光与影音</small></span></button><button data-layout="toggle" role="switch" aria-checked="false" aria-label="布置模式，开启后可移动和旋转家具"><span class="scene-icon">${icon('move')}</span><span>布置家具<small>拖动摆放与旋转</small></span></button></div>
 <div class="layout-bar" id="layout-bar" hidden><div class="layout-tip">${icon('move')}<span id="layout-tip-text">点击家具选中，拖动移动；捏住圆环上的手柄旋转</span></div>
 <div class="layout-actions" id="layout-actions" hidden><strong id="layout-name"></strong><button data-layout="left" aria-label="逆时针旋转 15 度" title="逆时针 15°">${icon('rotate-ccw')}</button><button data-layout="right" aria-label="顺时针旋转 15 度" title="顺时针 15°">${icon('rotate-cw')}</button><button data-layout="reset-item" aria-label="把这件家具放回原位" title="放回原位">${icon('undo-2')}</button></div>
 <button data-layout="reset-all" class="layout-reset">${icon('undo-2')} 恢复默认摆放</button></div>
 <button id="mobile-devices" class="mobile-devices">${icon('sliders-horizontal')} 设备</button></section></main>
 <aside class="device-sidebar" aria-label="设备列表"><div class="device-header"><div><span class="eyebrow">IN YOUR HOME</span><h2>空间里的温度</h2></div><span class="device-total">24</span><button id="close-devices" aria-label="关闭设备列表">${icon('x')}</button></div>
 <div class="summary"><div><span id="on-count" class="summary-value"></span><p>已开启设备</p></div><div><span id="power" class="summary-value"></span><p>模拟额定功率</p></div></div>
 <div class="list-heading"><h3 id="list-title">全屋设备</h3><span id="device-count"></span></div><div class="filter-tabs"><button data-filter="all" class="active">全部</button><button data-filter="light">灯光</button><button data-filter="appliance">家电</button></div><div id="device-list"></div><div class="device-bottom">${icon('lightbulb')} 点击灯具，试着点亮一个角落。</div></aside>
 <aside id="detail" class="detail-panel" aria-label="设备控制" hidden></aside><div id="toast" role="status"></div><div id="layout-say" class="sr-only" aria-live="polite" aria-atomic="true"></div>
 <dialog id="about-dialog"><button id="close-about" aria-label="关闭说明">${icon('x')}</button><span class="eyebrow">ABOUT THIS SPACE</span><h2>从一张户型图，到一个家。</h2><p>根据你提供的户型图，保留房间位置、门洞和主要尺寸关系。图中面积包含部分墙体，净空间约 64 m²。</p><p>当前只有户型图，家具、家电配置和装修材质为设计示意，尚未根据实拍照片校准，也不能用作施工图。</p><p>所有设备均为本地模拟，未连接真实智能家居。显示功率为演示用额定估算，不能代表实际用电量。</p></dialog>`;

let home;
try{home=createHome($('#canvas'),devices,layout,{onSelect:selectDevice,onFurniture:focusFurniture,onLayout:persistLayout});}catch(error){console.error(error);$('#canvas').innerHTML='<div class="webgl-error"><h2>当前无法显示三维空间</h2><p>请启用浏览器硬件加速或使用支持 WebGL 2 的浏览器。设备列表仍可使用。</p></div>';}
function renderRooms(){$('#rooms').innerHTML=rooms.map(r=>`<button class="room-item ${room===r.id?'active':''}" data-room="${r.id}" aria-pressed="${room===r.id}">${icon(roomIcons[r.id])}<span>${r.name}</span><small>${r.id==='all'?'24 个设备':r.area.toFixed(1)+' m²'}</small></button>`).join('');refreshIcons();}
function status(d){if(!d.on)return '已关闭';if(d.type==='light')return `${d.brightness}% · ${d.colorTemperature}K`;if(d.type==='ac')return `${d.temperature}°C · ${d.mode}`;if(d.type==='washer')return d.running?'洗涤中':'待机';if(d.type==='fridge')return '冷藏 4°C · 冷冻 −18°C';if(d.type==='speaker')return `音量 ${d.volume}%`;return '已开启';}
function renderDevices(){const visible=devices.filter(d=>(room==='all'||d.room===room)&&(filter==='all'||(filter==='light'?d.type==='light':d.type!=='light')));
 $('#device-list').innerHTML=visible.map(d=>`<div class="device-row ${selected===d.id?'selected':''}"><button class="device-open" data-device="${d.id}" aria-label="控制${d.name}"><span class="device-icon ${d.on?'on':''}">${icon(typeIcons[d.type])}</span><span class="device-text"><strong>${d.name}</strong><small>${status(d)}</small></span></button><button class="toggle ${d.on?'on':''}" data-toggle="${d.id}" role="switch" aria-checked="${d.on}" aria-label="${d.name}电源"><span></span></button></div>`).join('')||'<p class="empty">这个房间没有此类设备</p>';
 $('#device-count').textContent=visible.length+' 个';$('#on-count').innerHTML=devices.filter(d=>d.on).length+'<small>台</small>';$('#power').innerHTML=power(devices)+'<small>W</small>';$('#lit-count').textContent=devices.filter(d=>d.type==='light'&&d.on).length+' 盏灯已点亮';refreshIcons();
}
function commit(render=true){home?.update(devices);try{localStorage.setItem('habitat-v1',JSON.stringify(devices));$('#saved').innerHTML=icon('check')+' 已保存';}catch{$('#saved').textContent='本次会话有效';}renderDevices();if(render&&selected)renderDetail();}
let toastTimer;function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
// 家具摆位单独落盘，拖动过程中不调用，避免每帧写 localStorage 并重建设备列表。
function persistLayout(){try{localStorage.setItem('habitat-layout-v1',JSON.stringify(home.layoutState()));$('#saved').innerHTML=icon('check')+' 已保存';}catch{$('#saved').textContent='本次会话有效';}}
function announce(text){const el=$('#layout-say');if(el)el.textContent=text;}
function focusFurniture(id){furnitureFocus=id;renderLayoutBar();if(id)announce(`已选中${furnitureNames.get(id)}。方向键移动，Q E 旋转`);}
function renderLayoutBar(){const bar=$('#layout-bar');if(!bar)return;bar.hidden=!layoutMode;const actions=$('#layout-actions');
 if(!furnitureFocus){actions.hidden=true;return;}
 const rotatable=rotatableFurniture.has(furnitureFocus);actions.hidden=false;
 $('#layout-name').textContent=furnitureNames.get(furnitureFocus)||'';
 bar.querySelectorAll('[data-layout="left"],[data-layout="right"]').forEach(b=>b.disabled=!rotatable);
 $('#layout-tip-text').textContent=rotatable?'拖动移动；捏住圆环上的手柄旋转':'这件家具所处空间有限，只能拖动';
}
function setLayoutMode(on){layoutMode=on;home?.setLayout(on);document.body.classList.toggle('layout',on);
 $$('[data-layout="toggle"]').forEach(b=>{b.classList.toggle('active',on);b.setAttribute('aria-checked',on);});   // 工具条图标与场景条按钮同步状态
 if(!on)furnitureFocus=null;renderLayoutBar();announce(on?'已进入布置模式':'已退出布置模式');
 if(on)toast('布置模式：拖动家具换位置，捏住圆环手柄旋转');}
function selectDevice(id){if(!selected)lastFocus=document.activeElement;selected=id;home?.select(id);renderDevices();renderDetail();$('#close-detail').focus({preventScroll:true});}
function closeDetail(){selected=null;home?.select(null);$('#detail').hidden=true;renderDevices();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
function slider(key,label,min,max,value,unit){return `<label class="range-label" for="${key}"><span>${label}</span><strong id="${key}-value">${value}${unit}</strong></label><input type="range" id="${key}" data-setting="${key}" min="${min}" max="${max}" value="${value}" aria-label="${label}"><div class="range-limits"><span>${min}${unit}</span><span>${max}${unit}</span></div>`;}
function renderDetail(){const d=devices.find(d=>d.id===selected);if(!d)return;$('#detail').hidden=false;let content='';
 if(d.type==='light')content=slider('brightness','亮度',1,100,d.brightness,'%')+slider('colorTemperature','色温',2700,6500,d.colorTemperature,'K')+'<p class="detail-note">每盏灯独立控制。切换到夜晚，感受光线在房间里的变化。</p>';
 else if(d.type==='ac')content=`<div class="temperature"><button data-temp="-1" aria-label="降低温度">−</button><strong>${d.temperature}<small>°C</small></strong><button data-temp="1" aria-label="升高温度">+</button></div><div class="mode-options">${['自动','制冷','送风'].map(m=>`<button data-mode="${m}" class="${d.mode===m?'active':''}">${m}</button>`).join('')}</div>`;
 else if(d.type==='washer')content=`<div class="appliance-display"><span>棉麻 · 40°C</span><strong>${d.running?'正在洗涤':'等待启动'}</strong></div><button id="washer-start" class="primary-button" ${d.on?'':'disabled'}>${d.running?'暂停洗涤':'启动洗涤'}</button><p class="detail-note">模拟洗涤启停及滚筒动画，不执行实际洗涤。</p>`;
 else if(d.type==='speaker')content=slider('volume','音量',0,100,d.volume,'%')+'<p class="detail-note">模拟电源与音量，不播放音频。</p>';
 else if(d.type==='fridge')content='<div class="fridge-values"><div><small>冷藏室</small><strong>4°</strong></div><div><small>冷冻室</small><strong>−18°</strong></div></div><p class="detail-note">温度为演示设定，离家场景保留冰箱原电源状态。</p>';
 else content=`<div class="appliance-display"><span>独立电源控制</span><strong>${d.on?'已开启':'已关闭'}</strong></div><p class="detail-note">${d.type==='tv'?'开启电视后，三维空间中的屏幕会点亮。':'设备状态同步到列表，当前为本地模拟。'}</p>`;
 $('#detail').innerHTML=`<div class="detail-top"><span class="eyebrow">${rooms.find(r=>r.id===d.room).name} / 设备控制</span><button id="close-detail" aria-label="关闭设备菜单">${icon('x')}</button></div><div class="detail-title"><span class="large-icon">${icon(typeIcons[d.type])}</span><h2>${d.name}</h2></div><div class="power-row"><span><strong>设备电源</strong><small>${d.on?'已开启':'已关闭'} · 本地模拟</small></span><button class="toggle large ${d.on?'on':''}" data-toggle="${d.id}" role="switch" aria-checked="${d.on}" aria-label="${d.name}菜单电源"><span></span></button></div><div class="detail-content">${content}</div><button id="locate" class="locate">${icon('maximize')} 定位所在房间</button>`;refreshIcons();
}
function setRoom(id){room=id;home?.focus(id);renderRooms();renderDevices();const r=rooms.find(r=>r.id===id);$('#breadcrumb').textContent=id==='all'?'全屋视图':r.name;$('#view-title').textContent=id==='all'?'家的每一面':r.name;$('#list-title').textContent=id==='all'?'全屋设备':r.name+'设备';$('#view-3d').classList.add('active');$('#view-top').classList.remove('active');}
function setDay(value){night=value;home?.setNight(night);document.body.classList.toggle('night',night);$$('[data-day]').forEach(b=>{const active=(b.dataset.day==='night')===night;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});}
function clearScene(){sceneName='';$$('[data-scene]').forEach(b=>b.classList.remove('active'));}
document.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;
 if(btn.dataset.room)setRoom(btn.dataset.room);if(btn.dataset.device)selectDevice(btn.dataset.device);
 if(btn.dataset.toggle){const d=devices.find(d=>d.id===btn.dataset.toggle);d.on=!d.on;if(!d.on)d.running=false;clearScene();commit();toast(d.name+(d.on?'已开启':'已关闭'));}
 if(btn.dataset.day)setDay(btn.dataset.day==='night');
 if(btn.dataset.filter){filter=btn.dataset.filter;$$('[data-filter]').forEach(b=>b.classList.toggle('active',b===btn));renderDevices();}
 if(btn.dataset.scene){sceneName=btn.dataset.scene;devices=applyScene(devices,sceneName);if(sceneName==='relax')setDay(true);if(sceneName==='home')setDay(false);$$('[data-scene]').forEach(b=>b.classList.toggle('active',b===btn));commit();toast({home:'欢迎回家，灯已为你亮起',relax:'夜晚慢下来，留下两盏柔光',away:'已关闭灯光及影音，冰箱和热水器保持原状态'}[sceneName]);}
 if(btn.id==='close-detail')closeDetail();if(btn.id==='locate')setRoom(devices.find(d=>d.id===selected).room);
 if(btn.id==='view-top'){home?.top();$('#view-top').classList.add('active');$('#view-3d').classList.remove('active');}
 if(['view-3d','reset-view'].includes(btn.id))setRoom('all');if(btn.id==='zoom-in')home?.zoom(.85);if(btn.id==='zoom-out')home?.zoom(1.15);
 if(btn.id==='wall-mode'){walls=({auto:'low',low:'full',full:'auto'})[walls];home?.setWalls(walls);$('#wall-label').textContent=({auto:'墙体自动避让',low:'全部墙体隐藏',full:'完整墙体展示'})[walls];}
 if(btn.dataset.temp){const d=devices.find(d=>d.id===selected);d.temperature=Math.max(16,Math.min(30,d.temperature+Number(btn.dataset.temp)));commit();}
 if(btn.dataset.mode){devices.find(d=>d.id===selected).mode=btn.dataset.mode;commit();}
 if(btn.id==='washer-start'){const d=devices.find(d=>d.id===selected);if(d.on){d.running=!d.running;commit();}}
 if(btn.id==='about')$('#about-dialog').showModal();if(btn.id==='close-about')$('#about-dialog').close();
 if(btn.dataset.layout==='toggle')setLayoutMode(!layoutMode);
 if(btn.dataset.layout==='left')announce(home?.rotateSelected(-15)?'已逆时针旋转 15 度':'周围腾不出空间，先移开一点再旋转');
 if(btn.dataset.layout==='right')announce(home?.rotateSelected(15)?'已顺时针旋转 15 度':'周围腾不出空间，先移开一点再旋转');
 if(btn.dataset.layout==='reset-item'){const spec=furnitureDefaults().find(f=>f.id===furnitureFocus);if(spec){home?.applyLayout([spec]);announce(`已把${spec.name}放回原位`);}}
 if(btn.dataset.layout==='reset-all'){home?.applyLayout(furnitureDefaults());announce('已恢复默认家具摆放');toast('已恢复默认摆放');}
 if(btn.id==='mobile-devices')document.body.classList.add('devices-open');if(btn.id==='close-devices')document.body.classList.remove('devices-open');
});
document.addEventListener('input',e=>{const key=e.target.dataset.setting;if(key){const d=devices.find(d=>d.id===selected);d[key]=Number(e.target.value);$(`#${key}-value`).textContent=d[key]+(key==='colorTemperature'?'K':'%');clearScene();commit(false);}});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){document.body.classList.remove('devices-open');if(selected)closeDetail();else if(furnitureFocus)home?.selectFurniture(null);else if(layoutMode)setLayoutMode(false);return;}
 if(!layoutMode||!furnitureFocus||e.metaKey||e.ctrlKey||e.altKey)return;
 const step=e.shiftKey?.5:.1,key=e.key.toLowerCase();
 const moves={arrowup:['北',0,-step],arrowdown:['南',0,step],arrowleft:['西',-step,0],arrowright:['东',step,0]};
 // 家具在 DOM 里没有对应元素，键盘操作是纯增强：先点选，再用方向键与 Q/E 微调。
 if(moves[key]){e.preventDefault();const [dir,dx,dz]=moves[key];announce(home?.moveSelected(dx,dz)?`已向${dir}移动 ${step} 米`:'已到墙边，无法继续移动');return;}
 if(key==='q'||key==='e'){e.preventDefault();const deg=(key==='q'?-1:1)*(e.shiftKey?90:15);
  announce(home?.rotateSelected(deg)?`已${deg>0?'顺时针':'逆时针'}旋转 ${Math.abs(deg)} 度`:'这件家具所处空间有限，无法旋转');}
});
renderRooms();renderDevices();renderLayoutBar();refreshIcons();
if(import.meta.hot)import.meta.hot.dispose(()=>home?.dispose());
