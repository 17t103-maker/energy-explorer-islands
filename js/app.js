import {createState,storage,shuffle,escapeHTML as esc} from './state.js';
import {mountSimulation} from './simulations.js';

const $=s=>document.querySelector(s),modal=$('#modal'),body=$('#modal-body'),panel=$('#panel'),panelBody=$('#panel-body');
let data,state,world,simulation,current='center',tab='learn',quiz=null,avatar=0,lastFocus=null,lastLevel=1,toastTimer,worldFailed=false;

const preferences=storage.get(':preferences',{
 theme:'auto',
 clock:'realtime',
 fontSize:'md',
 musicOn:false,
 musicStyle:'piano',
 musicVolume:0.45,
 low:innerWidth<600,
 reduced:matchMedia('(prefers-reduced-motion: reduce)').matches
});
if(!preferences.fontSize)preferences.fontSize='md';
if(!preferences.musicStyle)preferences.musicStyle='piano';
if(typeof preferences.musicVolume!=='number')preferences.musicVolume=0.45;

function savePrefs(){storage.set(':preferences',preferences)}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4000)}
function openModal(html,wide=false){lastFocus=document.activeElement;modal.classList.toggle('modal-wide',wide);body.innerHTML=html;if(!modal.open)modal.showModal();setTimeout(()=>body.querySelector('input,button,select,textarea')?.focus(),50)}
function closeModal(){modal.classList.remove('modal-wide');modal.close();lastFocus?.focus?.()}
function island(id=current){return id==='center'?data.center:data.islands.find(i=>i.id===id)}

// --- Web Audio Ambient Study Music Engine ---
const musicEngine=(()=>{
 let ctx=null,timer=null,playing=false,step=0,masterGain=null;
 const chords={
  piano:[
   [261.63,329.63,392.00,523.25], // C maj7
   [220.00,261.63,329.63,440.00], // A min7
   [174.61,220.00,261.63,349.23], // F maj7
   [196.00,246.94,293.66,392.00]  // G6
  ],
  zen:[
   [293.66,369.99,440.00,587.33],
   [246.94,329.63,392.00,493.88],
   [261.63,329.63,392.00,523.25],
   [220.00,293.66,369.99,440.00]
  ],
  focus:[
   [261.63,311.13,392.00,466.16],
   [233.08,293.66,349.23,466.16],
   [207.65,261.63,311.13,392.00],
   [196.00,246.94,293.66,392.00]
  ]
 };
 const pentatonic=[523.25,587.33,659.25,783.99,880.00,1046.50];

 function ensureCtx(){
  if(!ctx){
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC)return null;
   ctx=new AC();
   masterGain=ctx.createGain();
   masterGain.gain.value=preferences.musicVolume*0.28;
   masterGain.connect(ctx.destination);
  }
  if(ctx.state==='suspended')ctx.resume().catch(()=>{});
  return ctx;
 }

 function playNote(freq,dur=2.4,vol=0.22,type='sine',delay=0){
  if(!ctx||!playing)return;
  const now=ctx.currentTime+delay;
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type=type;
  osc.frequency.setValueAtTime(freq,now);
  gain.gain.setValueAtTime(0.0001,now);
  gain.gain.linearRampToValueAtTime(vol,now+0.12);
  gain.gain.exponentialRampToValueAtTime(0.0008,now+dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now+dur+0.05);
 }

 function tick(){
  if(!playing||!ensureCtx())return;
  const style=preferences.musicStyle||'piano';
  const prog=chords[style]||chords.piano;
  const chord=prog[step%prog.length];
  // Warm pad chord
  chord.forEach((f,i)=>playNote(f,3.2,0.14/(i+1),style==='zen'?'sine':'triangle',i*0.08));
  // Gentle arpeggio melody notes
  const m1=pentatonic[(step*2)%pentatonic.length];
  const m2=pentatonic[(step*3+1)%pentatonic.length];
  playNote(m1,1.6,0.16,'sine',0.45);
  playNote(m2,1.8,0.13,'sine',1.35);
  if(style==='focus')playNote(chord[0]*0.5,1.2,0.18,'sine',0.9);
  step++;
 }

 function updateUI(){
  const btn=$('#music-button');
  if(!btn)return;
  btn.setAttribute('aria-pressed',String(playing));
  btn.textContent=playing?'🎵 音乐播放中':'🎵 轻音乐';
 }

 return {
  get playing(){return playing},
  start(){
   if(!ensureCtx()){toast('当前浏览器不支持音频合成。');return false}
   playing=true;
   preferences.musicOn=true;savePrefs();
   clearInterval(timer);
   tick();
   timer=setInterval(tick,2400);
   updateUI();
   return true;
  },
  stop(){
   playing=false;
   preferences.musicOn=false;savePrefs();
   clearInterval(timer);timer=null;
   updateUI();
  },
  toggle(){
   if(playing){this.stop();toast('已暂停岛上背景轻音乐。')}
   else if(this.start()){toast('已开启专注学习轻音乐（可在设置中切换曲风与音量）。')}
  },
  setVolume(v){
   preferences.musicVolume=Math.max(0,Math.min(1,+v));
   if(masterGain&&ctx)masterGain.gain.setValueAtTime(preferences.musicVolume*0.28,ctx.currentTime);
   savePrefs();
  },
  setStyle(s){
   preferences.musicStyle=s;savePrefs();
   if(playing)tick();
  },
  updateUI
 };
})();

function applyFontSize(size){
 preferences.fontSize=size;
 document.documentElement.dataset.font=size;
 savePrefs();
}

function cycleFontSize(){
 const order=['sm','md','lg','xl'];
 const names={sm:'小（16px）',md:'标准（18px）',lg:'大（20px）',xl:'特大（22px）'};
 const next=order[(order.indexOf(preferences.fontSize)+1)%order.length];
 applyFontSize(next);
 toast(`字体大小已切换为：${names[next]}`);
}

function openFullSim(src,title){
 openModal(`
  <span class="badge">全屏实验操作模式 · 按 Esc 或右上角 ✕ 返回课程</span>
  <h2>${esc(title)}</h2>
  <div class="embed-frame-wrap" style="flex:1;margin:0;min-height:0">
   <iframe class="embed-frame" style="height:100%" src="${esc(src)}" title="${esc(title)}"></iframe>
  </div>
 `,true);
}

function updateState(){
 if(!state)return;
 const s=state.value,lv=state.level();
 $('#profile-button').textContent=s.name?`${s.name} · Lv${lv}`:'建立冒险者';
 $('#mini-stamps').innerHTML=data.islands.map((i,n)=>`<span class="${s.stamps.includes(i.id)?'got':''}" title="${esc(i.name)}">${s.stamps.includes(i.id)?'✓':n+1}</span>`).join('');
 $('#progress-fill').style.width=s.stamps.length/4*100+'%';
 $('#progress-summary').textContent=s.name?`${s.stamps.length}/4 岛章 · ${state.exp()} EXP · 已探索 ${s.visited.length}/4 岛`:'从第一座岛开始，收集科学发现。';
 world?.setStamps(s.stamps);
 if(lv>lastLevel)toast(`升到 Lv${lv}！每一次认真观察，都让你更进一步。`);
 lastLevel=lv;
}

function createProfile(){
 openModal(`<span class="badge">不需要真实姓名</span><h2>你好，云端冒险者。</h2><p class="intro">选一个代号和伙伴造型，把每一次发现收进护照。</p><form id="profile-form"><label for="adventurer">冒险者代号 · 2～12个字</label><input id="adventurer" type="text" autocomplete="off" maxlength="24" placeholder="例如：追风实验员" value="${esc(state.value.name)}"><div class="avatar-options" role="group" aria-label="选择造型">${[['薄荷探险家','#73b2a2'],['日光观察员','#b78966'],['星空记录员','#8e9eb9']].map(([n,c],i)=>`<button type="button" data-avatar="${i}" class="${i===avatar?'selected':''}" aria-pressed="${i===avatar}"><span class="avatar" style="--suit:${c}"></span>${n}</button>`).join('')}</div><p id="profile-error" role="alert"></p><button class="primary" type="submit">出发，去发现</button></form>${state.names().length?`<label for="saved-profile">继续已有冒险</label><select id="saved-profile"><option value="">选择已保存的代号</option>${state.names().map(n=>`<option>${esc(n)}</option>`).join('')}</select>`:''}<div class="actions"><button data-action="guest">先逛逛，不玩</button><button data-action="save">导入接关码</button></div><p class="small">进度只保存在当前浏览器。清除浏览器数据会删除本机存档。</p>`);
 $('#profile-form').onsubmit=e=>{
  e.preventDefault();
  try{
   state.select($('#adventurer').value,avatar);
   world?.addPlayer(state.value.avatar);
   closeModal();
   document.body.classList.add('exploring');
   if(!storage.get(':introSeen',false)&&!preferences.reduced){world?.intro();storage.set(':introSeen',true)}
   else world?.overview();
   toast('欢迎，'+state.value.name+'。从生活能量岛开始吧。');
  }catch(err){$('#profile-error').textContent=err.message}
 };
 $('#saved-profile')?.addEventListener('change',e=>{
  if(e.target.value){state.select(e.target.value,0);world?.addPlayer(state.value.avatar);closeModal();toast('已恢复 '+state.value.name+' 的冒险。')}
 });
}

function listModal(){
 openModal(`<span class="badge">3D与文字清单，同样完整</span><h2 id="island-list">选择你的下一站</h2><label for="chapter-filter">筛选课程</label><select id="chapter-filter"><option value="all">全部章节</option>${data.islands.map(i=>`<option value="${i.id}">${esc(i.group)}</option>`).join('')}</select><div id="course-cards" class="island-cards" style="margin-top:16px"></div><p class="small">作者：教师 · 适合初中二年级<br>各岛含图文课程、互动实验模拟器与精选挑战题。</p>`);
 function cards(){
  const filter=$('#chapter-filter').value;
  $('#course-cards').innerHTML=[data.center,...data.islands].filter(i=>filter==='all'||i.id===filter).map(i=>`<button class="island-card" data-select="${i.id}"><span class="number">${i.id==='center'?'✦':i.order}</span><span><strong>${esc(i.name)}</strong><small>${esc(i.intro)} · ${esc(i.landmark||'中央互动观测台')}</small></span></button>`).join('');
 }
 cards();$('#chapter-filter').onchange=cards;
}

function closePanel(back=true){
 simulation?.dispose();simulation=null;quiz=null;panel.hidden=true;document.body.classList.remove('panel-open');
 if(back)world?.overview();
 $('#profile-button').focus();
}

function selectIsland(id,instant=false){
 if(!island(id))return;
 closeModalIfOpen();closeBubble();simulation?.dispose();simulation=null;quiz=null;current=id;tab='learn';
 state.visit(id);document.body.classList.add('exploring');world?.movePlayer(id);
 const show=()=>{panel.hidden=false;document.body.classList.add('panel-open');renderPanel();panel.querySelector('[data-action="close-panel"]').focus()};
 if(world&&!instant)world.focus(id,show);else show();
}

function closeModalIfOpen(){if(modal.open)closeModal()}

function renderSectionHTML(sec){
 // Support both new object format {title, html, diagrams} and legacy [title, text]
 if(Array.isArray(sec)){
  return `<section class="lesson-section"><h3>${esc(sec[0])}</h3><p>${esc(sec[1])}</p></section>`;
 }
 const diagramsHTML=sec.diagrams?.length?`<div class="diagram-grid">${sec.diagrams.map(d=>`<figure class="diagram-card"><img src="${esc(d.src)}" alt="${esc(d.caption)}" data-zoom-img="${esc(d.src)}" data-zoom-caption="${esc(d.caption)}"><figcaption>${esc(d.caption)}</figcaption></figure>`).join('')}</div>`:'';
 return `<section class="lesson-section"><h3>${esc(sec.title)}</h3>${sec.html}${diagramsHTML}</section>`;
}

function renderPanel(){
 simulation?.dispose();simulation=null;
 const i=island();
 $('#panel-kicker').textContent=i.id==='center'?'中央观测台 / 全章复习':i.group;
 panelBody.innerHTML=`
  <div class="eyebrow">${esc(i.kicker)}</div>
  <h2>${esc(i.name)}</h2>
  <p class="intro">${esc(i.intro)}</p>
  <div class="tabs" role="tablist" aria-label="课程内容分类">
   ${[['learn','📖 教材学习'],['experiment','🔬 探索实验'],['challenge','🏆 岛屿挑战']].map(([id,name])=>`<button role="tab" aria-selected="${tab===id}" data-tab="${id}">${name}</button>`).join('')}
  </div>
  <div id="tab-content" role="tabpanel"></div>
  <nav class="section-nav" aria-label="章节顺序"><button data-step="-1">← 上一座岛</button><button data-step="1">下一座岛 →</button></nav>
 `;
 const content=$('#tab-content');
 if(tab==='learn'){
  content.innerHTML=`
   <div class="goal-box"><strong>🎯 本岛学习目标</strong><p style="margin:6px 0 0">${esc(i.goal)}</p></div>
   ${i.sections.map(renderSectionHTML).join('')}
   <div class="actions">
    <button class="primary" data-tab="experiment">🔬 前往探索实验</button>
    <button data-tab="challenge">🏆 直接开始挑战</button>
   </div>
   <p class="source">内容依据：${esc(i.source)}。点击教材中的示意图可放大查看。</p>
  `;
 }else if(tab==='experiment'){
  simulation=mountSimulation(content,current,{state,reduced:()=>preferences.reduced,openFullSim});
 }else if(tab==='challenge'){
  renderChallengeHome();
 }
 panelBody.scrollTop=0;
 if(window.renderMathInElement)window.renderMathInElement(content);
}

function formatMathText(str){
 // Convert simple inline LaTeX markers like $A_{\text{质量大}}$ or $D_1$ or $\dfrac{W}{t}$ if present in content.json HTML
 return str
  .replace(/\$A_\{\\text\{([^}]+)\}\}\$/g,'<strong>A<sub>$1</sub></strong>')
  .replace(/\$s_\{\\text\{([^}]+)\}\}\$/g,'<strong>s<sub>$1</sub></strong>')
  .replace(/\$h_\{\\text\{([^}]+)\}\}\$/g,'<strong>h<sub>$1</sub></strong>')
  .replace(/\$D_([123])\$/g,'<strong>D<sub>$1</sub></strong>')
  .replace(/\$P = \\dfrac\{W\}\{t\} = Fv\$/g,'P = W / t = Fv')
  .replace(/\$([^$]+)\$/g,(_,m)=>m.replace(/\\cdot/g,'·').replace(/\\text\{([^}]+)\}/g,'$1').replace(/\\sim/g,'～').replace(/_([0-9a-zA-Z]+)/g,'<sub>$1</sub>'));
}

function renderChallengeHome(){
 const i=island(),center=current==='center';
 const totalQ=center?5:(i.questions?.length||3);
 $('#tab-content').innerHTML=`
  <span class="badge">精选课程挑战题 · 源自《练习题》与《补充练习》</span>
  <h3>${center?'全章最终挑战':'检验你的科学发现'}</h3>
  <p>${center?'从已获得岛章的课程岛题库中随机抽取 5 题，答对 4 题及以上即可通过最终挑战。':`本岛题库共 ${totalQ} 道精选练习题（已去除依赖原卷示意图的干扰，均为清晰情境题）。每次挑战抽取 3 题，答对 2 题及以上即可获得本岛岛章！`}</p>
  <div class="goal-box"><strong>💡 小亮提示：</strong>${esc(i.hint)}</div>
  ${!state.value.name?'<p class="notice">当前为自由浏览模式：可以正常答题和查看解析，但成绩不会存档。建立冒险者后可收集岛章与升级。</p><button data-action="profile">建立冒险者</button>':''}
  ${center&&!state.unlocked()?`<p class="notice">最终挑战尚未解锁：需要 3 枚岛章，目前已有 ${state.value.stamps.length} 枚。请先前往各座课程岛完成挑战。</p>`:`<button class="primary" data-action="start-quiz">${center?'开始最终挑战':'接受挑战（抽取3题）'}</button>`}
  ${!center&&totalQ>3?`<button data-action="start-quiz-all" style="margin-left:8px">练习本岛全部 ${totalQ} 题</button>`:''}
  ${center?`<div class="actions"><button data-action="certificate" ${state.certificate()?'':'disabled'}>🎓 领取学习证书</button></div><p class="small">领证需要四座岛全部获章，并通过最终挑战。</p>`:`<p class="small">本岛历史最佳答对题数：${state.value.best[current]??'尚未作答'}</p>`}
 `;
}

function startQuiz(allQuestions=false){
 if(current==='center'&&!state.unlocked())return;
 let qs;
 if(current==='center'){
  qs=shuffle(data.islands.filter(i=>state.value.stamps.includes(i.id)).flatMap(i=>i.questions)).slice(0,5);
 }else{
  const pool=island().questions;
  qs=allQuestions?pool:shuffle(pool).slice(0,3);
 }
 quiz={questions:qs,index:0,score:0,answered:false,answers:[]};
 renderQuestion();
}

function renderQuestion(){
 const q=quiz.questions[quiz.index];quiz.answered=false;
 $('#tab-content').innerHTML=`
  <span class="badge">课程挑战题</span>
  <div class="quiz-progress">第 ${quiz.index+1} / ${quiz.questions.length} 题</div>
  <h3 class="quiz-title">${esc(q.stem)}</h3>
  <div class="quiz-options">${shuffle(q.options).map(o=>`<button data-answer="${o.id}">${esc(o.text)}</button>`).join('')}</div>
  <div id="quiz-feedback" aria-live="polite"></div>
 `;
}

function answerQuiz(id){
 if(!quiz||quiz.answered)return;
 quiz.answered=true;
 const q=quiz.questions[quiz.index],correct=id===q.answer;
 quiz.answers.push({id:q.id,correct});
 if(correct)quiz.score++;
 state.answer(q.id,correct);
 document.querySelectorAll('[data-answer]').forEach(b=>{
  b.disabled=true;
  if(b.dataset.answer===q.answer)b.classList.add('correct');
  else if(b.dataset.answer===id)b.classList.add('wrong');
 });
 $('#quiz-feedback').innerHTML=`
  <div class="quiz-feedback"><strong>${correct?'✅ 答对了！':'💡 这次没有答对'}</strong><p style="margin:6px 0 0">${esc(q.explanation)}</p></div>
  <button class="primary" style="margin-top:14px" data-action="next-question">${quiz.index===quiz.questions.length-1?'查看挑战结果':'下一题 →'}</button>
 `;
}

function nextQuestion(){
 if(!quiz?.answered)return;
 if(quiz.index<quiz.questions.length-1){quiz.index++;renderQuestion();return}
 const count=quiz.questions.length,score=quiz.score,need=current==='center'?4:2,passed=score>=need;
 state.finish(current,score);
 $('#tab-content').innerHTML=`
  <span class="badge">本次挑战完成</span>
  <div class="result-score">${score}<small> / ${count}</small></div>
  <h3>${passed?'🎉 恭喜过关！科学发现已收入你的旅程':'再观察一次，也是一种进步'}</h3>
  <p>${passed?(state.value.name?(current==='center'?'最终挑战已通过！':'本岛岛章已点亮（重复过关不会重复盖章）。'):'练习已达标；建立冒险者后可记录岛章。'):'回到教材学习和探索实验区，结合解析再试一次吧。'}</p>
  <div class="actions">
   <button class="primary" data-action="start-quiz">再挑战一次</button>
   <button data-tab="experiment">返回实验</button>
   <button data-action="passport">查看护照</button>
  </div>
  ${current==='center'&&state.certificate()?'<button class="primary" data-action="certificate" style="margin-top:16px">🎓 领取学习证书</button>':''}
 `;
 quiz=null;
}

function settingsModal(){
 openModal(`
  <h2>设置 · 让探索与阅读更舒服</h2>
  <div class="setting-row">
   <p>字体大小（预设已放大为 18px）</p>
   <div class="theme-options">
    ${[['sm','小 (16px)'],['md','标准 (18px)'],['lg','大 (20px)'],['xl','特大 (22px)']].map(([id,n])=>`<button type="button" data-font-size="${id}" class="${preferences.fontSize===id?'selected':''}">${n}</button>`).join('')}
   </div>
   <small>也可随时点击课程面板右上角的“A+”按钮快速切换字号。</small>
  </div>
  <div class="setting-row">
   <p>🎵 岛上专注学习轻音乐</p>
   <div class="actions" style="margin-top:6px">
    <button type="button" class="${musicEngine.playing?'primary':''}" data-action="toggle-music">${musicEngine.playing?'⏸ 暂停轻音乐':'▶ 播放轻音乐'}</button>
    <select id="music-style" aria-label="选择轻音乐曲风" style="margin:0;flex:1">
     ${[['piano','🎹 舒缓钢琴与和弦'],['zen','🎐 空灵自然冥想'],['focus','⏱️ 专注学习律动']].map(([k,n])=>`<option value="${k}" ${preferences.musicStyle===k?'selected':''}>${n}</option>`).join('')}
    </select>
   </div>
   <label for="music-volume">音乐音量 <output id="music-vol-out">${Math.round(preferences.musicVolume*100)}%</output></label>
   <input id="music-volume" type="range" min="0" max="1" step="0.05" value="${preferences.musicVolume}">
  </div>
  <div class="setting-row">
   <p>界面底色</p>
   <div class="theme-options">${[['auto','🌅 自动'],['day','晨光'],['dusk','海雾'],['night','夜海']].map(([id,n])=>`<button type="button" data-theme="${id}" class="${preferences.theme===id?'selected':''}">${n}</button>`).join('')}</div>
   <small>自动模式跟随场景时段平滑切换；手动底色可与任意光线组合。</small>
  </div>
  <div class="setting-row">
   <label for="day-mode">3D 场景时段</label>
   <select id="day-mode">${[['realtime','跟现在时间同步'],['day','☀️ 白天'],['dusk','🌇 黄昏'],['night','🌙 夜晚'],['auto','⏱️ 自动流动 · 约160秒一天']].map(([v,n])=>`<option value="${v}" ${preferences.clock===v?'selected':''}>${n}</option>`).join('')}</select>
  </div>
  <div class="setting-row">
   <label><input id="low-quality" type="checkbox" ${preferences.low?'checked':''}> 低画质 · 关闭阴影，提升流畅度</label>
   <label><input id="reduced-motion" type="checkbox" ${preferences.reduced?'checked':''}> 减少动态 · 停止环境动画与镜头运镜</label>
  </div>
  <div class="actions"><button data-action="intro">🎬 重播开场运镜</button><button data-action="text-mode">📋 文字清单模式</button></div>
 `);
 $('#day-mode').onchange=e=>{preferences.clock=e.target.value;world?.setClock(preferences.clock);savePrefs()};
 $('#low-quality').onchange=e=>{preferences.low=e.target.checked;world?.setQuality(preferences.low);savePrefs()};
 $('#reduced-motion').onchange=e=>setReduced(e.target.checked);
 $('#music-style').onchange=e=>musicEngine.setStyle(e.target.value);
 $('#music-volume').oninput=e=>{
  musicEngine.setVolume(e.target.value);
  $('#music-vol-out').textContent=Math.round(e.target.value*100)+'%';
 };
}

function setReduced(v){preferences.reduced=v;document.documentElement.classList.toggle('reduce-motion',v);world?.setReduced(v);simulation?.pause();savePrefs()}

function passport(){
 openModal(`
  <span class="badge">科学探索护照</span>
  <h2>${state.value.name?esc(state.value.name):'还没有冒险者代号'}</h2>
  <p>Lv${state.level()} · ${state.exp()} EXP · ${state.value.stamps.length}/4 岛章</p>
  <div class="stamps-grid">${data.islands.map((i,n)=>`<div class="stamp ${state.value.stamps.includes(i.id)?'got':''}"><b>${state.value.stamps.includes(i.id)?'✦':String(n+1).padStart(2,'0')}</b>${esc(i.name)}<br><small>${state.value.stamps.includes(i.id)?'已获岛章':'尚未获得'}</small></div>`).join('')}</div>
  <p class="notice">${state.unlocked()?'中央最终挑战已解锁！':'再收集 '+Math.max(0,3-state.value.stamps.length)+' 枚岛章即可解锁中央最终挑战。'}${state.value.finalPassed?' 最终挑战已通过！':''}</p>
  <div class="actions"><button class="primary" data-select="center">前往总复习大岛</button><button data-action="save">保存与接关</button></div>
  <div class="actions"><button data-action="certificate" ${state.certificate()?'':'disabled'}>🎓 领取证书</button><button data-action="reset-progress">重置当前进度</button></div>
  <p class="small">计分规则：每岛首次探索+5 EXP；每题首次答对+10 EXP、重复答对+2 EXP；每岛首次过关+10 EXP。等级由答题与探索记录推算。</p>
 `);
}

function saveModal(){
 openModal(`
  <h2>把旅程带走 · 存档与接关码</h2>
  <p class="small">接关码用于更换电脑或手机时继续学习，不具防作弊功能。清除浏览器资料会删除本机存档。</p>
  <label for="save-code">你的接关码</label>
  <textarea id="save-code" readonly>${state.value.name?state.code():''}</textarea>
  <div class="actions"><button data-action="copy-code" ${state.value.name?'':'disabled'}>复制接关码</button><button data-action="export-json" ${state.value.name?'':'disabled'}>导出JSON</button></div>
  <label for="import-code">粘贴接关码</label>
  <textarea id="import-code" placeholder="ENERGYEX1.…"></textarea>
  <button class="primary" data-action="import-code">恢复这份存档</button>
  <label class="file-label">或导入JSON存档文件<input id="import-file" type="file" accept=".json,application/json"></label>
  <p id="save-error" role="alert"></p>
 `);
 $('#import-file').onchange=async e=>{
  try{
   const file=e.target.files[0];if(!file)return;
   if(file.size>200000)throw Error('存档文件过大。');
   state.import(JSON.parse(await file.text()));world?.addPlayer(state.value.avatar);toast('存档已恢复。');closeModal();
  }catch(err){$('#save-error').textContent=err.message}
 };
}

function positionBubble(p){
 if(!p||$('#bubble').hidden)return;
 const b=$('#bubble'),w=b.offsetWidth||300,h=b.offsetHeight||220;
 b.style.left=Math.max(12,Math.min(innerWidth-w-12,p.x-w/2))+'px';
 b.style.top=Math.max(85,Math.min(innerHeight-h-90,p.y-h-20))+'px';
}
function labelHostClass(v){document.body.classList.toggle('labels-dim',v)}
function closeBubble(){$('#bubble').hidden=true;world?.clearBubble();labelHostClass(false)}

function help(){
 openModal(`
  <span class="badge">欢迎来到能量探索群岛 · 第2版</span>
  <h2>立体观察，图文共读，专注实验。</h2>
  <section class="lesson-section">
   <h3>1. 立体主题导览与漫游</h3>
   <p>每座岛都建有与课程主题对应的立体造型（电池塔与风车、双轨斜面撞击实验台、水力发电大坝与铁塔、双臂起重机与瓦特钟塔）。点击底部“▷ 导览”或“♧ 漫游”即可近距离观察。</p>
  </section>
  <section class="lesson-section">
   <h3>2. 图文教材、字体调节与背景轻音乐</h3>
   <p>教材段落旁均配有对应示意图（点击图片可放大），重点关键字已加粗变色。点击顶部“🎵 轻音乐”可开启放松专注的学习音乐；点击面板右上角“A+”或“⚙ 设置”可自由调整字体大小。</p>
  </section>
  <section class="lesson-section">
   <h3>3. 实验模拟器与精选挑战</h3>
   <p>02 机械能实验岛内嵌了完整的动能（Ek）与重力势能（Ep）模拟器；各岛挑战题均精选自《练习题》与《补充练习》，集满岛章并通过最终挑战即可领取证书。</p>
  </section>
  <p class="notice">${data.notices.map(esc).join('<br>')}</p>
  <details><summary>教材来源与第2版更新说明</summary><p>${data.sources.map(esc).join('<br>')}</p><p>${data.editorial.map(esc).join('<br>')}</p></details>
  <button data-action="list" class="primary" style="margin-top:12px">打开课程清单</button>
 `);
}

function certificate(){
 if(!state.certificate()){toast('需要集齐四枚岛章并通过最终挑战。');return}
 openModal(`<span class="badge">记录你的学习旅程</span><h2>属于你的探索证书</h2><label for="certificate-name">证书上的名字</label><input id="certificate-name" type="text" maxlength="24" value="${esc(state.value.name)}"><canvas id="certificate-canvas" class="certificate-preview" width="1400" height="1000"></canvas><div class="actions"><button class="primary" data-action="download-certificate">下载PNG</button><button data-action="print-certificate">打印证书</button></div>`);
 drawCertificate();$('#certificate-name').oninput=drawCertificate;
}

function drawCertificate(){
 const canvas=$('#certificate-canvas'),c=canvas.getContext('2d');
 c.fillStyle='#f7f3e7';c.fillRect(0,0,1400,1000);
 c.strokeStyle='#729c87';c.lineWidth=3;c.strokeRect(40,40,1320,920);
 c.strokeStyle='#ceb27a';c.strokeRect(56,56,1288,888);
 const text=(s,y,size,color='#244d45')=>{c.textAlign='center';c.font=`${size}px "Microsoft YaHei",sans-serif`;c.fillStyle=color;c.fillText(s,700,y)};
 text('能量探索群岛',160,32);text('科学冒险 · 学习证书',290,60);
 const name=$('#certificate-name').value.trim()||state.value.name;
 text(name,420,54);text('完成了四座课程岛的探索，并通过全章最终挑战',510,28);
 text('常见能量 · 机械能 · 能量守恒 · 功与功率',570,28);
 text(`Lv${state.level()}     ${state.exp()} EXP     4 / 4 岛章`,690,30);
 text(new Date().toLocaleDateString('zh-CN'),765,24);
 text('本证书为学习记录，非官方认证',900,22,'#687b70');
 for(let j=0;j<4;j++){c.beginPath();c.arc(490+j*140,820,20,0,Math.PI*2);c.strokeStyle='#b9975e';c.stroke()}
 return canvas;
}

function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}

function showTour(t){
 const el=$('#tour-card');el.hidden=!t;if(!t)return;
 document.body.classList.add('exploring');
 el.innerHTML=`
  <small>自动导览 · 第 ${t.index+1} / ${data.islands.length} 站 · 立体地标：${esc(t.island.landmark||'')}</small>
  <h3>${esc(t.island.name)}</h3>
  <p>${esc(t.island.intro)}。${esc(t.island.points[0])}。</p>
  <div class="actions">
   <button data-tour="previous">上一站</button>
   <button data-tour="pause">${t.paused?'继续':'暂停'}</button>
   <button data-tour="next">下一站</button>
   <button data-select="${t.island.id}" class="primary">进入本岛课程</button>
   <button data-tour="stop">结束</button>
  </div>
 `;
}

async function action(name){
 switch(name){
  case'profile':createProfile();break;
  case'guest':state.guest();world?.removePlayer();closeModal();if(!storage.get(':introSeen',false)&&!preferences.reduced){world?.intro();storage.set(':introSeen',true)}toast('自由浏览模式：所有课程与实验都可阅读。');break;
  case'begin':if(!state.value.name)createProfile();else selectIsland(data.islands[0].id);break;
  case'list':listModal();break;
  case'close-modal':closeModal();break;
  case'close-panel':closePanel();break;
  case'overview':closeModalIfOpen();closePanel(false);closeBubble();world?.overview();document.body.classList.remove('exploring');break;
  case'settings':settingsModal();break;
  case'passport':passport();break;
  case'help':help();break;
  case'save':saveModal();break;
  case'toggle-music':musicEngine.toggle();if(modal.open&&$('#music-style'))settingsModal();break;
  case'font-cycle':cycleFontSize();break;
  case'start-quiz':startQuiz(false);break;
  case'start-quiz-all':startQuiz(true);break;
  case'next-question':nextQuestion();break;
  case'certificate':certificate();break;
  case'tour':closeModalIfOpen();closePanel(false);closeBubble();if(world)world.startTour();else toast('当前是文字模式，请用课程清单按顺序阅读。');break;
  case'walk':closePanel(false);closeBubble();if(world)world.startWalk();else toast('3D不可用；课程与实验不受影响。');break;
  case'intro':closeModal();closePanel(false);if(preferences.reduced)toast('减少动态已开启，开场直接切换到全景。');world?.intro();break;
  case'skip-cinema':world?.skip();break;
  case'text-mode':closeModal();closePanel(false);listModal();break;
  case'close-bubble':closeBubble();break;
  case'copy-code':try{await navigator.clipboard.writeText($('#save-code').value);toast('接关码已复制。')}catch{$('#save-code').select();toast('请按Ctrl+C，或长按选中文字复制。')}break;
  case'export-json':download(new Blob([state.json()],{type:'application/json'}),'能量探索群岛-存档.json');break;
  case'import-code':try{state.decode($('#import-code').value);world?.addPlayer(state.value.avatar);closeModal();toast('接关成功，欢迎回来。')}catch(e){$('#save-error').textContent=e.message}break;
  case'reset-progress':openModal('<h2>重置当前冒险？</h2><p>将清除当前代号的答题、岛章与实验记录，其他冒险者不受影响。建议先导出接关码。</p><div class="actions"><button data-action="save">先保存</button><button data-action="confirm-reset">确定重置</button><button data-action="close-modal">取消</button></div>');break;
  case'confirm-reset':state.reset();world?.overview();closePanel(false);closeModal();toast('当前冒险已重置。');break;
  case'download-certificate':drawCertificate().toBlob(b=>download(b,'能量探索群岛-学习证书.png'));break;
  case'print-certificate':{let img=$('#print-certificate');if(!img){img=document.createElement('img');img.id='print-certificate';img.style.display='none';document.body.append(img)}img.src=drawCertificate().toDataURL();await img.decode();window.print();break}
 }
}

document.addEventListener('click',e=>{
 const zoomImg=e.target.closest('[data-zoom-img]');
 if(zoomImg){
  openModal(`<span class="badge">教材示意图放大查看</span><h2>${esc(zoomImg.dataset.zoomCaption||'示意图')}</h2><div style="background:#fff;padding:16px;border-radius:16px;text-align:center"><img src="${esc(zoomImg.dataset.zoomImg)}" alt="${esc(zoomImg.dataset.zoomCaption||'')}" style="max-width:100%;max-height:65dvh;object-fit:contain"></div>`);
  return;
 }
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.action)action(b.dataset.action);
 if(b.dataset.select)selectIsland(b.dataset.select);
 if(b.dataset.tab){tab=b.dataset.tab;quiz=null;renderPanel()}
 if(b.dataset.avatar){avatar=+b.dataset.avatar;document.querySelectorAll('[data-avatar]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b)})}
 if(b.dataset.step){const ids=['center',...data.islands.map(i=>i.id)],n=ids.indexOf(current);selectIsland(ids[(n+ +b.dataset.step+ids.length)%ids.length])}
 if(b.dataset.answer)answerQuiz(b.dataset.answer);
 if(b.dataset.theme){preferences.theme=b.dataset.theme;world?.setTheme(preferences.theme);if(preferences.theme!=='auto')document.documentElement.dataset.theme=preferences.theme;savePrefs();settingsModal()}
 if(b.dataset.fontSize){applyFontSize(b.dataset.fontSize);settingsModal()}
 if(b.dataset.tour)world?.tourAction(b.dataset.tour);
});

document.querySelectorAll('[data-move]').forEach(b=>{
 b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);world?.hold(b.dataset.move,true)});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>world?.hold(b.dataset.move,false));
});

document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
  if(modal.open)return;
  if(!$('#bubble').hidden){closeBubble();return}
  if(!panel.hidden)closePanel();
 }
 if(e.key==='Tab'&&!panel.hidden&&!modal.open){
  const nodes=[...panel.querySelectorAll('button:not(:disabled),input,select,a,textarea')];
  const first=nodes[0],last=nodes.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
});

modal.addEventListener('click',e=>{
 if(e.target===modal){
  const r=modal.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();
 }
});

async function init(){
 try{
  applyFontSize(preferences.fontSize||'md');
  musicEngine.updateUI();
  const response=await fetch('./data/content.json');
  if(!response.ok)throw Error('课程数据未能加载');
  data=await response.json();
  // Clean inline math markup in sections so it renders cleanly without external KaTeX dependency
  for(const isl of [data.center,...data.islands]){
   isl.sections=isl.sections.map(s=>Array.isArray(s)?s:{...s,html:formatMathText(s.html)});
  }
  state=createState(data,updateState);
  lastLevel=state.level();
  updateState();
  setReduced(preferences.reduced);

  try{
   const {createWorld}=await import('./world.js');
   world=await createWorld($('#canvas-host'),$('#labels'),data,{
    select:selectIsland,
    empty:closeBubble,
    pick(obj,pos){
     if(obj.type==='mascot'){
      $('#bubble').innerHTML=`<button class="bubble-close" data-action="close-bubble" aria-label="关闭对话">✕</button><small>导览机器人 · 中央观测台</small><h3>小亮（焦耳仔）</h3><p>你好！每座岛上都有独特的立体实验地标。点击岛名可看图文教材与互动模拟器，也可以在顶部开启轻音乐、调整字号喔！</p><div class="actions"><button class="primary" data-action="list">打开课程清单</button><button data-action="tour">开始自动导览</button></div>`;
      $('#bubble').hidden=false;positionBubble(pos);labelHostClass(true);return;
     }
     if(obj.type==='animal'){
      const lines={
       butterfly:'我在花田上空飞翔。运动让我具有动能！',
       cat:'趴在高处晒太阳时，我具有重力势能。',
       cow:'青草里储存着丰富的化学能。',
       dog:'奔跑时我具有动能，停下来时能量转化成了内能。',
       seal:'浮空岛的水池真凉快，水从高处流下是重力势能转化为动能。',
       whale:'我在云海中巡航，欢迎来到能量探索群岛！',
       crab:'用力推沙球前进，我对沙球做了功（W = Fs）。',
       deer:'做实验记得用控制变量法，一次只改变一个条件。'
      };
      $('#bubble').innerHTML=`<button class="bubble-close" data-action="close-bubble" aria-label="关闭动物对话">✕</button><h3>${esc(obj.name)}</h3><span class="badge">科学小动物 · 示意</span><p>${esc(lines[obj.id])}</p>`;
      $('#bubble').hidden=false;positionBubble(pos);labelHostClass(true);
     }
    },
    bubblePosition:p=>positionBubble(p),
    tour:showTour,
    walk:v=>{$('#walk-ui').hidden=!v;document.body.classList.toggle('walking',v)},
    cinema:v=>{$('#cinema').hidden=!v},
    theme:v=>{document.documentElement.dataset.theme=v},
    clock({hour,period}){
     const hh=Math.floor(hour).toString().padStart(2,'0'),mm=Math.floor(hour%1*60).toString().padStart(2,'0');
     $('#clock').textContent=`${{day:'白天',dusk:'黄昏',night:'夜晚'}[period]} ${hh}:${mm}`;
    },
    quality:v=>{preferences.low=v;savePrefs();toast('已切换到低画质，让探索更流畅。')}
   },preferences);
   world.setClock(preferences.clock);
   world.setTheme(preferences.theme);
   if(state.value.name)world.addPlayer(state.value.avatar);
   updateState();
  }catch(err){
   worldFailed=true;document.body.classList.add('no-webgl');$('#fallback').hidden=false;$('#labels').innerHTML='';
   console.info('3D unavailable; accessible course mode enabled:',err.message);
  }
  $('#loading').hidden=true;
  if(!state.value.name&&!storage.get(':welcomed',false)){createProfile();storage.set(':welcomed',true)}
  window.islandApp={
   get world(){return world},
   get state(){return state},
   get data(){return data},
   get simulation(){return simulation},
   get music(){return musicEngine},
   selectIsland,action,applyFontSize,
   get current(){return current},
   get quiz(){return quiz},
   get preferences(){return preferences}
  };
 }catch(err){
  $('#loading').innerHTML='<h2>课程暂时未能加载</h2><p>请通过本地HTTP服务器或正式网址打开，而不是直接双击HTML文件。</p><button onclick="location.reload()">重新加载</button>';
  console.error(err);
 }
}
init();
