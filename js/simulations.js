import {escapeHTML as esc} from './state.js';

export function mountSimulation(host,id,{state,reduced=()=>false,openFullSim}={}){
 let disposed=false,raf=0,last=0,t=0,running=false,completed=false;
 let mode=id==='center'?'life':({'island-02':'life','island-03':'mechanical','island-04':'conserve','island-05':'work'}[id]||'life');
 let mechSub='ek'; // 'ek' | 'ep' | 'interactive'
 let kind='kinetic',m=50,h=10,f=10,s=2,seconds=4,phase=0,layer=true,labels=true,scene='car',deformation=3;
 let gateOpen=true,waterLevel=80,selectedNode=0,conserveScene='hydro';
 let workSub='calc',workCase='lift';
 let logs=state?.value.experiments[id]||[];

 const examples={
  car:{name:'运动小车 / 奔跑运动员',icon:'🚗',answer:'机械能',from:'化学能（燃料/食物）',to:'机械能（动能）',explain:'小车与奔跑的人由于运动具有动能，动能属于机械能。'},
  food:{name:'日常食物与燃料',icon:'🍎',answer:'化学能',from:'物质内部储存',to:'动能与内能（生命活动）',explain:'食物、煤炭、汽油中储存着化学能，可在化学反应时转化为其他形式的能量。'},
  kettle:{name:'工作的电热水壶',icon:'♨',answer:'电能',from:'电能（电网供电）',to:'内能（水升温沸腾）',explain:'电热水壶消耗电能，加热时把电能主要转化为水的内能（热能）。'},
  ev:{name:'电动车充电与行驶',icon:'🔋',answer:'电能',from:'电能（充电桩）',to:'化学能（电池）→ 机械能',explain:'充电时将电能转化为电池化学能；行驶时电动机把电能转化为机械能。'},
  spring:{name:'被拉开的弓 / 压缩弹簧',icon:'🏹',answer:'机械能',from:'外力做功产生形变',to:'机械能（弹性势能 → 箭的动能）',explain:'在弹性限度内，拉开的弓与压缩的弹簧具有弹性势能，属于机械能。'},
  bird:{name:'高空飞行的飞鸟 / 流星',icon:'🦅',answer:'机械能',from:'高处位置 + 高速飞行',to:'重力势能 + 动能（统称机械能）',explain:'高空飞鸟既有高度（重力势能）又在运动（动能），同时具有两种机械能！'}
 };

 const hydroNodes=[
  {name:'高处水库',energy:'水的重力势能',desc:'拦河大坝将水蓄在高处，水位越高、水量越大，储存的重力势能就越大。',x:105,y:135},
  {name:'进水口与水道',energy:'重力势能 → 水的动能',desc:'闸门打开后，高处的水沿着倾斜引水管道急速冲下，重力势能转化为水流的动能。',x:265,y:215},
  {name:'水轮机',energy:'水的动能 → 水轮机机械能',desc:'高速水流冲击水轮机叶片，推动水轮机飞速旋转，转化为水轮机的机械能。',x:415,y:255},
  {name:'发电机与输电塔',energy:'机械能 → 电能',desc:'水轮机带动发电机转子切割磁感线，将机械能转化为电能，并由高压输电铁塔送往电网。',x:545,y:175},
  {name:'千家万户（灯泡）',energy:'电能 → 光能与内能',desc:'电能进入家庭点亮灯泡，转化为光能和内能（热能）。整个过程能量总量保持守恒！',x:675,y:185}
 ];

 const workCases={
  wall:{name:'推墙而墙不动',work:false,reason:'有水平推力 F，但墙没有发生位移（s = 0），劳而无功，W = 0 J。'},
  lift:{name:'竖直提起书包',work:true,reason:'手对书包有竖直向上的提力 F，且书包沿提力方向向上移动了位移 s，提力做正功！'},
  walk:{name:'水平提书包匀速走（竖直提力）',work:false,reason:'提力方向竖直向上，而位移方向水平向前，力与位移互相垂直，在提力方向上没有位移，不做功！'},
  pull:{name:'水平拉动物体前进',work:true,reason:'物体受到水平拉力 F，且沿水平拉力方向移动了位移 s，拉力做功 W = Fs！'}
 };

 function render(){
  host.innerHTML=`<div class="sim">
   ${id==='center'?'<label for="observe-chapter">选择要观测的章节模型</label><select id="observe-chapter"><option value="life">10.1 常见能量（生活能量实验室）</option><option value="mechanical">10.2 机械能（实验模拟器与转化）</option><option value="conserve">10.3 能量守恒（水力发电动态模型）</option><option value="work">10.4 功与功率（起重对比与做功判定）</option></select>':''}
   <div id="sim-stage"></div>
  </div>`;
  if(id==='center'){
   host.querySelector('#observe-chapter').value=mode;
   host.querySelector('#observe-chapter').onchange=e=>{mode=e.target.value;running=false;phase=0;render()};
  }
  const stage=host.querySelector('#sim-stage');

  if(mode==='mechanical'){
   if(mechSub!=='ek'&&mechSub!=='ep')mechSub='ek';
   stage.innerHTML=`
    <div class="sim-subtabs" role="tablist" aria-label="机械能实验模拟器切换">
     <button type="button" class="${mechSub==='ek'?'active':''}" data-mech-sub="ek">⚡ 动能实验模拟器 (Ek)</button>
     <button type="button" class="${mechSub==='ep'?'active':''}" data-mech-sub="ep">⛰️ 重力势能实验模拟器 (Ep)</button>
    </div>
    <div id="mech-sub-body"></div>
   `;
   stage.querySelectorAll('[data-mech-sub]').forEach(b=>b.onclick=()=>{mechSub=b.dataset.mechSub;running=false;phase=0;render()});
   const subBody=stage.querySelector('#mech-sub-body');
   const file=mechSub==='ek'?'./sims/Ek.html':'./sims/Ep.html';
   const title=mechSub==='ek'?'动能探究模拟器（Ek.html）':'重力势能探究模拟器（Ep.html）';
   subBody.innerHTML=`
    <div class="actions" style="margin:0 0 10px">
     <span class="badge" style="margin:0;align-self:center">已嵌入课程提供的专属实验模拟器</span>
     <button type="button" class="primary" data-fullscreen-sim="${file}" data-title="${title}">⛶ 全屏放大操作模拟器</button>
    </div>
    <div class="embed-frame-wrap">
     <iframe class="embed-frame" src="${file}" title="${title}" loading="lazy"></iframe>
    </div>
    <p class="notice">${mechSub==='ek'?'提示：在上方模拟器中，可切换“单一变量探究模式”与“激情竞赛模式”，调节高度(h)和质量(m)后点击“释放小球 ▶”观察纸盒位移(s)。':'提示：在上方模拟器中，调节高度(h)和质量(m)后点击“释放小球 ▼”，观察并对比沙坑深度(cm)。'}</p>
   `;
   subBody.querySelector('[data-fullscreen-sim]')?.addEventListener('click',e=>{
    const btn=e.currentTarget;
    openFullSim?.(btn.dataset.fullscreenSim,btn.dataset.title);
   });
   return;
  }

  // Standard interactive canvas stage for life, conserve, work, or mechanical-interactive
  const targetContainer = (mode==='mechanical') ? stage.querySelector('#mech-sub-body') : stage;
  targetContainer.innerHTML=`
   <span class="badge">动态互动示意模型 · 点击画面元件可互动</span>
   <canvas width="760" height="400" role="img" aria-label="可操作的科学互动模型"></canvas>
   <div class="sim-controls"></div>
   <label class="check-label"><input type="checkbox" data-layer ${labels?'checked':''}>显示说明图层与数值标注</label>
   <p class="sim-result" role="status"></p>
  `;
  const box=targetContainer.querySelector('.sim-controls');

  if(mode==='life'){
   box.innerHTML=`
    <label for="life-scene">选择生活物品或情境（也可直接点击上方卡片）</label>
    <select id="life-scene">${Object.entries(examples).map(([k,v])=>`<option value="${k}">${v.icon} ${v.name}</option>`).join('')}</select>
    <div class="scene-grid">${Object.entries(examples).map(([k,v])=>`<button type="button" class="${scene===k?'active':''}" data-scene-btn="${k}"><span>${v.icon}</span>${v.name.split(' ')[0]}</button>`).join('')}</div>
    <p style="margin:8px 0"><strong>互动判断：这个情境主要强调哪一种能量？</strong></p>
    <div class="option-grid">${['机械能','化学能','电能'].map(v=>`<button type="button" data-category="${v}">${v}</button>`).join('')}</div>
   `;
   running=true;
   box.querySelector('#life-scene').value=scene;
   box.querySelector('#life-scene').onchange=e=>{scene=e.target.value;render()};
   box.querySelectorAll('[data-scene-btn]').forEach(b=>b.onclick=()=>{scene=b.dataset.sceneBtn;render()});
   box.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{
    const ex=examples[scene],ok=b.dataset.category===ex.answer;
    result(`${ok?'✅ 判断正确！':'💡 再想一想：'}${ex.explain}（能量路径：${ex.from} → ${ex.to}）`);
   });
   result(`当前观察：【${examples[scene].name}】——请选择它主要体现的能量类型，或点击画面查看能量流向。`);
  }

  if(mode==='mechanical'){
   box.innerHTML=`
    <label for="experiment-type">实验类型</label>
    <select id="experiment-type">
     <option value="kinetic">动能：小球滚下斜坡推动木块 C</option>
     <option value="potential">重力势能：高处橡皮泥撞击小桌钉子</option>
     <option value="elastic">弹性势能：拉弓/弹簧形变与篮球上抛转化</option>
    </select>
    <div id="experiment-inputs"></div>
    <div class="actions">
     <button type="button" class="primary" data-run>释放并记录</button>
     <button type="button" data-pause>暂停</button>
     <button type="button" data-reset>重置装置</button>
    </div>
    <p class="notice">一次只改变一个条件（控制变量法）。也可点击上方切换标签使用完整的 Ek / Ep 模拟器。</p>
    <div id="log"></div>
    <button type="button" data-clear>清空实验记录</button>
   `;
   const select=box.querySelector('#experiment-type');
   select.value=kind;
   select.onchange=e=>{kind=e.target.value;phase=0;running=false;mechanicalInputs();draw()};
   mechanicalInputs();renderLog();
  }

  if(mode==='conserve'){
   box.innerHTML=`
    <div class="sim-subtabs">
     ${[['hydro','💧 水力发电动态剖面'],['wind','🌬️ 风力发电'],['thermal','🔥 火力发电'],['photo','🌱 植物光合作用']].map(([k,n])=>`<button type="button" class="${conserveScene===k?'active':''}" data-conserve-scene="${k}">${n}</button>`).join('')}
    </div>
    ${slider('water-level','蓄水水库水位高度 (H)',waterLevel,30,100,5,'%')}
    <label for="flow-step">能量转化追踪节点 <output id="phase-value">${hydroNodes[selectedNode].name}</output></label>
    <input id="flow-step" type="range" min="0" max="4" step="0.02" value="${phase*4}">
    <label class="check-label"><input type="checkbox" data-energy ${layer?'checked':''}>显示能量形式转化标签</label>
    <div class="actions">
     <button type="button" class="primary" data-run>▶ 动态发电演示</button>
     <button type="button" data-gate>${gateOpen?'🚰 关闭进水闸门':'🚰 打开进水闸门'}</button>
     <button type="button" data-pause>暂停</button>
     <button type="button" data-reset>回到起点</button>
    </div>
    <p style="margin:12px 0 6px;font-weight:700">点击下方或画布中的对应部位，观察能量转化细节：</p>
    <div class="actions">${hydroNodes.map((n,i)=>`<button type="button" data-object="${i}">${i+1}. ${n.name}</button>`).join('')}</div>
   `;
   running=!reduced();
   box.querySelectorAll('[data-conserve-scene]').forEach(b=>b.onclick=()=>{conserveScene=b.dataset.conserveScene;draw();
    const map={
     hydro:'水力发电：水的重力势能 → 水的动能 → 水轮机机械能 → 发电机电能 → 灯泡光能与内能。',
     wind:'风力发电：流动空气的动能（机械能）推动风车叶片旋转 → 发电机转化为电能。',
     thermal:'火力发电：煤炭/燃料的化学能 → 燃烧转化为水蒸气内能 → 推动汽轮机机械能 → 发电机电能。',
     photo:'植物光合作用：太阳光能照射绿叶 → 转化为储存在有机物中的化学能。'
    };
    result(map[conserveScene]);
   });
   box.querySelector('#water-level').oninput=e=>{waterLevel=+e.target.value;box.querySelector('#water-level-out').textContent=waterLevel;draw()};
   box.querySelector('#flow-step').oninput=e=>{phase=+e.target.value/4;selectedNode=Math.min(4,Math.round(+e.target.value));explainObject(selectedNode,false);draw()};
   box.querySelector('[data-energy]').onchange=e=>{layer=e.target.checked;draw()};
   box.querySelector('[data-gate]').onclick=e=>{gateOpen=!gateOpen;e.currentTarget.textContent=gateOpen?'🚰 关闭进水闸门':'🚰 打开进水闸门';result(gateOpen?'已打开进水口闸门：高处水库的水流冲下推动水轮机发电！':'已关闭进水口闸门：水流停止，水库保持重力势能，水轮机逐渐停转。');draw()};
   box.querySelectorAll('[data-object]').forEach(b=>b.onclick=()=>explainObject(+b.dataset.object,true));
   explainObject(selectedNode,false);
  }

  if(mode==='work'){
   box.innerHTML=`
    <div class="sim-subtabs">
     <button type="button" class="${workSub==='calc'?'active':''}" data-work-sub="calc">🏗️ 功与功率起重/推箱实验室</button>
     <button type="button" class="${workSub==='judge'?'active':''}" data-work-sub="judge">🧭 “动动脑”四种情境做功判定器</button>
    </div>
    <div id="work-sub-controls"></div>
   `;
   box.querySelectorAll('[data-work-sub]').forEach(b=>b.onclick=()=>{workSub=b.dataset.workSub;running=false;phase=0;render()});
   const wbox=box.querySelector('#work-sub-controls');
   if(workSub==='calc'){
    wbox.innerHTML=`
     ${slider('force','沿位移方向的恒力 (F)',f,1,50,1,'N')}
     ${slider('distance','沿力方向的位移 (s)',s,0,10,.5,'m')}
     ${slider('time','完成做功所用时间 (t)',seconds,1,20,1,'s')}
     <div class="metric-row">
      <div class="metric"><strong id="work-value"></strong><small>功 W = Fs (J)</small></div>
      <div class="metric"><strong id="power-value"></strong><small>功率 P = W/t (W)</small></div>
      <div class="metric"><strong id="speed-value"></strong><small>速度 v = s/t (m/s)</small></div>
     </div>
     <div class="actions">
      <button type="button" class="primary" data-run>▶ 开始做功对比演示</button>
      <button type="button" data-pause>暂停</button>
      <button type="button" data-reset>重置演示</button>
     </div>
     <p class="notice">画面同时对比【你的实验车/起重机】与【参照组（固定4秒完成）】，直观观察“相同功所用时间越短，功率越大（做功越快）”。</p>
    `;
    for(const [key,fn] of [['force',v=>f=v],['distance',v=>s=v],['time',v=>seconds=v]]){
     wbox.querySelector('#'+key).oninput=e=>{fn(+e.target.value);wbox.querySelector('#'+key+'-out').textContent=e.target.value;phase=0;running=false;metrics();draw()};
    }
   }else{
    wbox.innerHTML=`
     <p style="margin:6px 0"><strong>点击切换教材“动动脑”的四种情境，观察力 F 的方向与位移 s 的关系：</strong></p>
     <div class="scene-grid" style="grid-template-columns:repeat(2,1fr)">
      ${Object.entries(workCases).map(([k,v])=>`<button type="button" class="${workCase===k?'active':''}" data-work-case="${k}">${v.name}</button>`).join('')}
     </div>
    `;
    running=!reduced();
    wbox.querySelectorAll('[data-work-case]').forEach(b=>b.onclick=()=>{
     workCase=b.dataset.workCase;
     const c=workCases[workCase];
     result(`${c.work?'✅ 做功：':'❌ 不做功：'}${c.reason}`);
     render();
    });
    const c=workCases[workCase];
    result(`${c.work?'✅ 做功：':'❌ 不做功：'}${c.reason}`);
   }
  }

  targetContainer.querySelector('[data-layer]')?.addEventListener('change',e=>{labels=e.target.checked;draw()});
  targetContainer.querySelector('[data-run]')?.addEventListener('click',()=>{if(phase>=1||completed)phase=0;completed=false;if(reduced()){phase=1;finish();draw()}else running=true});
  targetContainer.querySelector('[data-pause]')?.addEventListener('click',e=>{running=!running;if(reduced())running=false;e.currentTarget.textContent=running?'暂停':'继续'});
  targetContainer.querySelector('[data-reset]')?.addEventListener('click',()=>{running=false;phase=0;completed=false;result('已重置实验装置，可修改参数后再次测试。');draw()});
  targetContainer.querySelector('[data-clear]')?.addEventListener('click',()=>{logs=[];persist();renderLog()});
  targetContainer.querySelector('canvas')?.addEventListener('click',e=>{
   const r=e.target.getBoundingClientRect();
   const cx=(e.clientX-r.left)/r.width*760, cy=(e.clientY-r.top)/r.height*400;
   if(mode==='conserve'){
    let best=0,minD=1e9;
    hydroNodes.forEach((n,i)=>{const d=Math.hypot(cx-n.x,cy-n.y);if(d<minD){minD=d;best=i}});
    explainObject(best,true);
   }else if(mode==='life'){
    const keys=Object.keys(examples);
    scene=keys[(keys.indexOf(scene)+1)%keys.length];
    render();
   }
  });
  metrics();draw();
 }

 function slider(key,label,v,min,max,step,unit){
  return `<label for="${key}">${label}<output><span id="${key}-out">${v}</span> ${unit}</output></label><input type="range" id="${key}" min="${min}" max="${max}" step="${step}" value="${v}">`;
 }
 function mechanicalInputs(){
  const el=host.querySelector('#experiment-inputs');if(!el)return;
  el.innerHTML=kind==='elastic'?slider('deformation','弓弦/弹簧形变程度（相对单位）',deformation,1,5,1,''):slider('mass','小球/橡皮泥质量 (m)',m,20,200,10,'g')+slider('height','释放高度 (h)',h,5,60,1,'cm');
  for(const key of ['mass','height','deformation'])host.querySelector('#'+key)?.addEventListener('input',e=>{
   const v=+e.target.value;if(key==='mass')m=v;else if(key==='height')h=v;else deformation=v;
   host.querySelector('#'+key+'-out').textContent=v;running=false;phase=0;completed=false;draw();
  });
 }
 function result(msg){const el=host.querySelector('.sim-result');if(el)el.textContent=msg}
 function metrics(){
  if(mode!=='work'||workSub!=='calc')return;
  const wv=host.querySelector('#work-value'),pv=host.querySelector('#power-value'),sv=host.querySelector('#speed-value');
  if(wv)wv.textContent=(f*s).toFixed(1);
  if(pv)pv.textContent=(f*s/seconds).toFixed(1);
  if(sv)sv.textContent=(s/seconds).toFixed(2);
 }
 function persist(){if(state){state.value.experiments[id]=logs;state.save()}}
 function renderLog(){
  const el=host.querySelector('#log');if(!el)return;
  el.innerHTML=logs.length?`<table class="sim-table"><caption>最近6次实验记录 · 相对值对比</caption><thead><tr><th>类型</th><th>实验条件</th><th>观测结果</th></tr></thead><tbody>${logs.slice(-6).map(x=>`<tr><td>${esc(x.type)}</td><td>${esc(x.condition)}</td><td><strong>${esc(x.value)}</strong></td></tr>`).join('')}</tbody></table>`:'<p class="small">还没有实验记录。调整上方滑杆后点击“释放并记录”。</p>';
 }
 function finish(){
  running=false;completed=true;
  if(mode==='mechanical'){
   const val=kind==='elastic'?deformation*deformation/4:m*h/500;
   logs.push({type:{kinetic:'动能',potential:'重力势能',elastic:'弹性势能'}[kind],condition:kind==='elastic'?`形变程度 ${deformation}`:`${m} g / ${h} cm`,value:val.toFixed(2)});
   logs=logs.slice(-6);persist();renderLog();
   result('实验数据已记录！保持一个条件不变、改变另一个条件，对比表格中的观测结果。');
  }else if(mode==='work'&&workSub==='calc'){
   result(`实验完成：恒力 ${f} N 推动物体移动 ${s} m，做功 W = ${(f*s).toFixed(1)} J；耗时 ${seconds} s，平均功率 P = ${(f*s/seconds).toFixed(1)} W。`);
  }
 }
 function explainObject(n,jump=false){
  selectedNode=n;
  const node=hydroNodes[n];
  result(`【${node.name}】（${node.energy}）：${node.desc}`);
  if(jump)phase=n/4;
  const out=host.querySelector('#phase-value');if(out)out.textContent=node.name;
  const sl=host.querySelector('#flow-step');if(sl)sl.value=(phase*4).toFixed(2);
  draw();
 }

 function draw(){
  const canvas=host.querySelector('canvas');if(!canvas)return;
  const c=canvas.getContext('2d'),W=760,H=400;
  c.clearRect(0,0,W,H);

  // Soft sky & ground gradient
  const grad=c.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#e5f4f1');grad.addColorStop(1,'#f4f9f4');
  c.fillStyle=grad;c.fillRect(0,0,W,H);

  const text=(v,x,y,size=18,color='#1d3f3e',align='center',weight='bold')=>{
   c.fillStyle=color;c.font=`${weight} ${size}px "Microsoft YaHei",sans-serif`;c.textAlign=align;c.fillText(v,x,y);
  };
  const roundRect=(x,y,w,h,r,fill,stroke)=>{
   c.beginPath();c.roundRect(x,y,w,h,r);
   if(fill){c.fillStyle=fill;c.fill()}
   if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke()}
  };
  const line=(x1,y1,x2,y2,color='#4d7c73',width=4)=>{
   c.beginPath();c.strokeStyle=color;c.lineWidth=width;c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
  };
  const ball=(x,y,r,color='#d58d5d')=>{
   c.beginPath();c.fillStyle=color;c.arc(x,y,r,0,Math.PI*2);c.fill();
   c.beginPath();c.fillStyle='#ffffff55';c.arc(x-r*.28,y-r*.28,r*.32,0,Math.PI*2);c.fill();
  };

  if(mode==='life'){
   const ex=examples[scene];
   // Draw energy flow diagram: Input Box -> Animated Center Stage -> Output Box
   roundRect(35,120,185,155,16,'#ffffff','#83b8aa');
   text('能量来源 / 状态',127,155,15,'#527874');
   text(ex.from,127,205,16,'#204b46');

   roundRect(270,85,220,225,22,'#ffffff','#2f7a6b');
   // Animated rings around icon
   const pulse=1+Math.sin(t*3)*0.06;
   c.beginPath();c.arc(380,180,58*pulse,0,Math.PI*2);c.fillStyle='#2f7a6b18';c.fill();
   text(ex.icon,380,198,74);
   text(ex.name,380,262,17,'#1d3f3e');
   if(labels)text(`核心能量：${ex.answer}`,380,290,15,'#c85a17');

   roundRect(540,120,185,155,16,'#ffffff','#d99b66');
   text('转化或表现形式',632,155,15,'#8c5830');
   text(ex.to,632,205,15,'#b84d14');

   // Animated energy particles flowing along arrows
   line(220,198,270,198,'#2f7a6b',4);
   line(490,198,540,198,'#d9792f',4);
   for(let k=0;k<3;k++){
    const u=((t*0.9+k/3)%1);
    ball(220+u*50,198,5,'#2f7a6b');
    ball(490+u*50,198,5,'#d9792f');
   }
   if(labels){
    text('生活能量转化动态观测台（点击画布可切换下一个生活物品）',380,44,19,'#1d3f3e');
    text('同一物体可能同时具有多种能量（如高空飞鸟既有动能又有重力势能）',380,365,15,'#486b68','center','normal');
   }
  }

  if(mode==='mechanical'){
   if(kind==='kinetic'){
    const high=95+h*2.1;
    line(75,315-high,285,315,'#5e8c7e',10);
    line(285,315,700,315,'#5e8c7e',7);
    // Height dashed indicator
    c.setLineDash([5,4]);line(75,315-high,75,315,'#d9792f',2);c.setLineDash([]);
    const a=Math.min(phase/.55,1),travel=Math.min(m*h/500*14,220)*Math.max(0,(phase-.55)/.45);
    const x=75+210*a+(a>=1?travel:0),y=315-high*(1-a)-18;
    ball(x,y,14+m/22,'#d97236');
    roundRect(320+travel,265,56,50,6,'#b37d56','#6e472b');
    text('C',348+travel,296,20,'#fff');
    if(labels){
     text(`小球质量 m = ${m} g · 释放高度 h = ${h} cm`,380,45,19);
     text(`h=${h}cm`,115,315-high/2,15,'#c85a17');
     text('0 cm 起点',320,342,14,'#527874');
     if(travel>0)text(`推动距离 s ∝ ${(m*h/500).toFixed(2)}`,348+travel,248,16,'#c85a17');
     text('控制变量法：通过木块 C 被推动的距离反映小球动能大小',380,375,16);
    }
   }
   if(kind==='potential'){
    // Sand / table with nail A, B, C style
    roundRect(120,285,520,65,8,'#e3cba8','#8d6e63');
    const height=95+h*2;
    const dropY=285-height*(1-phase)-22;
    const sink=phase>=1?Math.min(48,m*h/220):0;
    // Nail & block
    line(380,255+sink,380,305+sink,'#37474f',6);
    line(362,255+sink,398,255+sink,'#37474f',5);
    roundRect(350,dropY-14+sink,60,28,6,'#4f86c6','#274b7a');
    text(`${m}g`,380,dropY+5+sink,14,'#fff');
    if(labels){
     text(`橡皮泥质量 m = ${m} g · 释放高度 h = ${h} cm`,380,45,19);
     if(phase>=1)text(`钉子下陷深度 D ∝ ${(m*h/500).toFixed(2)}`,520,275,17,'#c85a17');
     text('通过钉子下陷深度（或沙坑凹陷深度）反映重力势能大小',380,375,16);
    }
   }
   if(kind==='elastic'){
    // Left: spring/bow compression; Right: basketball toss energy bars
    const width=190-deformation*22*(1-phase);
    line(95,140,95,305,'#37474f',7);
    c.beginPath();c.strokeStyle='#2f7a6b';c.lineWidth=6;c.moveTo(95,225);
    for(let i=0;i<16;i++)c.lineTo(95+i/16*width,225+(i%2?26:-26));
    c.lineTo(95+width,225);c.stroke();
    const ballX=95+width+28+(phase>0.4?(phase-0.4)*260*deformation/3:0);
    ball(ballX,225,22,'#d9792f');
    if(labels){
     text(`同一弹簧/弓弦 · 形变程度 ${deformation}`,380,48,19);
     text('弹性形变越大，储存的弹性势能越多，释放时转化出的动能越大',380,365,16);
    }
   }
  }

  if(mode==='conserve'){
   if(conserveScene!=='hydro'){
    // Draw specialized scene for wind / thermal / photosynthesis
    roundRect(60,75,640,250,18,'#ffffff','#78b7a5');
    if(conserveScene==='wind'){
     // Wind turbine -> Generator -> Grid
     text('🌬️ 流动的风（动能/机械能）',160,140,18,'#2f7a6b');
     // Rotating windmill
     line(360,165,360,285,'#546e7a',8);
     for(let k=0;k<3;k++){
      const ang=t*2.5+k*Math.PI*2/3;
      line(360,165,360+Math.cos(ang)*58,165+Math.sin(ang)*58,'#2f7a6b',6);
     }
     ball(360,165,9,'#d9792f');
     text('⚙️ 风力发电机',360,310,16);
     text('⚡ 电能输出（点亮路灯）',580,190,18,'#c85a17');
     ball(580,240,24,'#ffd54f');
    }else if(conserveScene==='thermal'){
     text('🪨 燃料燃烧（化学能 → 内能）',185,175,17,'#c85a17');
     ball(185,235,24,'#ff7043');
     text('→ 💨 推动汽轮机（机械能） →',390,205,17,'#2f7a6b');
     text('⚡ 发电机（电能）',595,205,18,'#1565c0');
    }else{
     ball(160,150,34,'#ffb300');
     text('☀️ 太阳光（光能）',160,220,18,'#c85a17');
     text('→ 🌿 绿叶光合作用 →',380,185,18,'#2e7d32');
     text('🍎 有机物储存（化学能）',590,185,18,'#2e7d32');
    }
    text('能量守恒定律：能量形式发生转化，但总能量保持不变',380,45,19);
    return;
   }

   // Detailed interactive Hydro-Electric Dam Cross Section!
   // 1. Reservoir water on left
   const wTop=165-(waterLevel/100)*75;
   c.fillStyle='#64b5f6aa';
   c.fillRect(25,wTop,150,275-wTop);
   // Water ripples
   c.strokeStyle='#1e88e5';c.lineWidth=2;
   for(let k=0;k<3;k++){
    c.beginPath();c.moveTo(35+k*45,wTop+12+Math.sin(t*2+k)*3);c.lineTo(65+k*45,wTop+12+Math.sin(t*2+k)*3);c.stroke();
   }

   // 2. Concrete Dam Structure & Penstock pipe
   c.fillStyle='#90a4ae';
   c.beginPath();c.moveTo(175,75);c.lineTo(225,75);c.lineTo(340,260);c.lineTo(485,260);c.lineTo(485,345);c.lineTo(175,345);c.closePath();c.fill();

   // Penstock water channel (from intake to turbine)
   line(175,185,415,255,'#e1f5fe',24);
   if(gateOpen){
    line(175,185,415,255,'#29b6f6',18);
    // Flowing water particles
    for(let k=0;k<6;k++){
     const u=((t*0.85+k/6)%1);
     ball(175+u*240,185+u*70,6,'#ffffff');
    }
   }else{
    // Closed gate bar
    c.fillStyle='#d32f2f';c.fillRect(172,165,10,42);
   }

   // Tailrace river on right
   c.fillStyle='#4fc3f7aa';c.fillRect(415,285,320,45);

   // 3. Turbine Wheel at (415, 255)
   c.save();c.translate(415,255);
   const speed=gateOpen?(0.5+waterLevel/40):0;
   c.rotate(t*speed*2.5);
   c.strokeStyle='#1a237e';c.lineWidth=4;
   c.beginPath();c.arc(0,0,26,0,Math.PI*2);c.stroke();
   for(let k=0;k<8;k++){
    c.rotate(Math.PI/4);
    line(0,0,26,0,'#0d47a1',4);
   }
   c.restore();
   ball(415,255,8,'#ffca28');

   // 4. Powerhouse & Generator above turbine (415, 175)
   roundRect(370,125,95,82,10,'#eceff1','#455a64');
   line(415,207,415,230,'#37474f',6); // shaft
   roundRect(383,142,68,42,6,gateOpen?'#fff8e1':'#cfd8dc','#ff8f00');
   text('发电机',417,168,15,'#bf360c');

   // 5. Transmission Tower at (555, 175)
   line(555,110,530,275,'#455a64',4);
   line(555,110,580,275,'#455a64',4);
   line(532,145,578,145,'#455a64',3);
   line(525,180,585,180,'#455a64',3);
   line(538,215,572,215,'#455a64',3);
   // Power lines from generator to tower to bulb
   line(465,155,535,145,'#263238',2.5);
   line(575,145,675,165,'#263238',2.5);
   if(gateOpen){
    for(let k=0;k<4;k++){
     const u=((t*1.1+k/4)%1);
     const px=u<0.5?465+u*2*70:575+(u-0.5)*2*100;
     const py=u<0.5?155-u*2*10:145+(u-0.5)*2*20;
     ball(px,py,4.5,'#ffab00');
    }
   }

   // 6. Household Light Bulb at (675, 185)
   const glowR=gateOpen?(24+waterLevel*0.22+Math.sin(t*6)*3):0;
   if(glowR>0){
    c.beginPath();c.arc(675,190,glowR,0,Math.PI*2);c.fillStyle='#ffd54f55';c.fill();
   }
   ball(675,190,20,gateOpen?'#ffca28':'#b0bec5');
   c.fillStyle='#546e7a';c.fillRect(666,162,18,12);

   // Interactive node markers
   hydroNodes.forEach((n,i)=>{
    const active=i===selectedNode;
    c.beginPath();c.arc(n.x,n.y-42,active?15:12,0,Math.PI*2);
    c.fillStyle=active?'#d9792f':'#2f7a6b';c.fill();
    c.strokeStyle='#fff';c.lineWidth=2;c.stroke();
    text(String(i+1),n.x,n.y-37,13,'#fff');
    if(labels)text(n.name,n.x,n.y-62,14,active?'#c84b0f':'#1d3f3e');
    if(layer&&active){
     roundRect(140,14,480,36,10,'#ffffffdd','#d9792f');
     text(`${n.name}：${n.energy}`,380,38,16,'#c84b0f');
    }
   });
   text('点击图中 ①～⑤ 圆点或调节水位与闸门，实时追踪水力发电的能量转化',380,378,15,'#2c524f');
  }

  if(mode==='work'){
   if(workSub==='judge'){
    // 4 interactive work cases
    const cInfo=workCases[workCase];
    line(60,305,700,305,'#546e7a',5);
    const anim=(Math.sin(t*2)*0.5+0.5);
    if(workCase==='wall'){
     roundRect(470,130,65,175,4,'#90a4ae','#455a64');
     text('墙壁',502,220,17,'#fff');
     roundRect(360,215,65,90,10,'#2f7a6b');
     line(425,245,468,245,'#d9792f',6);
     text('推力 F →',410,200,17,'#c84b0f');
     text('位移 s = 0 m（有力无位移，不做功）',380,85,20,'#c62828');
    }else if(workCase==='lift'){
     const y=245-anim*105;
     roundRect(345,y,70,55,8,'#d9792f','#8c3d0f');
     text('书包',380,y+33,16,'#fff');
     line(380,y,380,y-48,'#2e7d32',6);
     text('↑ 竖直提力 F',465,y-20,17,'#2e7d32');
     text('↑ 位移 s 向上',275,y+20,17,'#1565c0');
     text('提力 F 与位移 s 同向（竖直向上） → 提力做功！',380,75,20,'#2e7d32');
    }else if(workCase==='walk'){
     const x=180+anim*320;
     roundRect(x,225,68,52,8,'#d9792f','#8c3d0f');
     text('书包',x+34,256,15,'#fff');
     line(x+34,225,x+34,160,'#c62828',5);
     text('↑ 竖直提力 F',x+34,145,16,'#c62828');
     line(x+68,252,x+135,252,'#1565c0',5);
     text('水平位移 s →',x+115,282,16,'#1565c0');
     text('竖直提力 F ⊥ 水平位移 s（力与位移垂直） → 竖直提力不做功！',380,75,19,'#c62828');
    }else{
     const x=150+anim*340;
     roundRect(x,235,80,70,8,'#2f7a6b','#1b4d42');
     text('木箱',x+40,275,16,'#fff');
     line(x+80,268,x+145,268,'#d9792f',6);
     text('水平拉力 F →',x+120,248,16,'#c84b0f');
     text('水平位移 s →',x+40,335,16,'#1565c0');
     text('水平拉力 F 与水平位移 s 同方向 → 拉力做功 W = Fs！',380,75,20,'#2e7d32');
    }
    return;
   }

   // Work & Power dual-track comparison
   // Track 1: User's configured crane/cart (time = seconds)
   // Track 2: Reference crane/cart (same work W, fixed time = 4 s)
   const x1=110+phase*s*46;
   const refPhase=Math.min(1,phase*(seconds/4));
   const x2=110+refPhase*s*46;

   // Track 1 (Top)
   roundRect(40,95,680,105,12,'#ffffffcc','#78b7a5');
   line(80,180,680,180,'#4d7c73',4);
   roundRect(x1,122,68,55,8,'#2f7a6b','#194d42');
   text(`${f}N`,x1+34,155,15,'#fff');
   line(x1+68,148,x1+68+Math.min(90,f*1.8),148,'#d9792f',5);

   // Track 2 (Bottom reference)
   roundRect(40,220,680,105,12,'#ffffffcc','#b0bec5');
   line(80,305,680,305,'#78909c',4);
   roundRect(x2,247,68,55,8,'#78909c','#455a64');
   text('参照4s',x2+34,280,14,'#fff');

   if(labels){
    text(`实验组（耗时 t = ${seconds} s）：功 W = ${(f*s).toFixed(1)} J，功率 P = ${(f*s/seconds).toFixed(1)} W`,380,115,15,'#194d42');
    text(`参照组（同功耗时 4 s）：功 W = ${(f*s).toFixed(1)} J，功率 P = ${(f*s/4).toFixed(1)} W`,380,240,15,'#455a64');
    text(`功 W = F × s = ${f} N × ${s} m = ${(f*s).toFixed(1)} J ｜ 平均功率 P = W / t = ${(f*s/seconds).toFixed(1)} W`,380,48,18,'#1d3f3e');
    text('做相同的功，所用时间越短，功率越大（做功越快）！',380,368,16,'#c84b0f');
   }
  }
 }

 function loop(now){
  if(disposed)return;
  const dt=Math.min((now-last)/1000||0,.05);last=now;t+=dt;
  if(!document.hidden){
   if(mode==='life'||mode==='conserve'||(mode==='work'&&workSub==='judge')){
    if(!reduced()){
     if(mode==='conserve'&&running&&gateOpen){
      phase=(phase+dt*0.12)%1;
      const sl=host.querySelector('#flow-step');if(sl)sl.value=(phase*4).toFixed(2);
     }
     draw();
    }
   }else if(running){
    if(reduced())running=false;
    else{
     phase+=dt/(mode==='work'?Math.min(seconds,6):2.2);
     if(phase>=1){phase=1;finish()}
     draw();
    }
   }
  }
  raf=requestAnimationFrame(loop);
 }
 render();raf=requestAnimationFrame(loop);
 return {
  dispose(){disposed=true;cancelAnimationFrame(raf)},
  pause(){running=false},
  get state(){return {mode,kind,mechSub,phase,running,logs}}
 };
}
