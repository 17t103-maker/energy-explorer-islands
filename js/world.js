import * as T from 'three';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const positions=[
 {id:'center',x:0,z:0,r:9.2},
 {id:'island-02',x:-26,z:-9,r:8.2},
 {id:'island-03',x:-14,z:25,r:8.6},
 {id:'island-04',x:20,z:24,r:8.8},
 {id:'island-05',x:28,z:-9,r:8.4}
];

export async function createWorld(host,labelHost,data,hooks,settings){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setSize(innerWidth,innerHeight);
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
 renderer.shadowMap.enabled=!settings.low;
 renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;
 renderer.toneMappingExposure=.98;
 host.append(renderer.domElement);

 const scene=new T.Scene();
 scene.fog=new T.FogExp2('#b5d5d5',.0028);
 const camera=new T.PerspectiveCamera(innerWidth<600?55:innerWidth/innerHeight<1.1?50:38,innerWidth/innerHeight,.1,500);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.dampingFactor=.07;controls.maxPolarAngle=Math.PI*.47;controls.minDistance=12;controls.maxDistance=155;controls.enablePan=false;

 const sun=new T.DirectionalLight('#fff0d5',3);
 sun.position.set(-25,55,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.camera.far=150;
 sun.shadow.normalBias=.08;sun.shadow.bias=-.00015;scene.add(sun);
 const hemi=new T.HemisphereLight('#c4e9ff','#6e6266',2);scene.add(hemi);
 const moonLight=new T.PointLight('#ffd48b',30,30,1.5);moonLight.position.set(0,7,0);scene.add(moonLight);

 const materials=new Map(),staticMeshes=[],animations=[],colliders=[],pickables=[],animals=[],lights=[],clouds=[],birds=[],boats=[],fireflies=[];
 let low=settings.low,reduced=settings.reduced,clockMode='realtime',themeMode='auto',sceneHour=12,time=0,last=0,hidden=false,cinema=null,tour=null,walk=false,yaw=0,pitch=-.05,drag=null,player=null,route=[],routeIndex=0,follow=false,selected=null,held=new Set(),bubbleTarget=null,qualitySlow=0,frames=0,fpsTime=0,fps=60,disposed=false;
 let seed=442;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};

 function mat(color,opts={}){
  const key=color+JSON.stringify(opts);
  if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.88,flatShading:true,...opts}));
  return materials.get(key);
 }
 const grass=mat('#91b793'),sand=mat('#cabc91'),rock=mat('#728287'),wood=mat('#8e6955'),darkwood=mat('#5d594c'),cream=mat('#f5e9d0'),roof=mat('#487e78'),pink=mat('#d9a6b5'),leaf=mat('#678b71'),leafLight=mat('#8fa881'),water=mat('#52b6cf',{transparent:true,opacity:.82,roughness:.25}),metal=mat('#d5b978',{metalness:.3,roughness:.5}),steel=mat('#607d8b',{metalness:.35,roughness:.45}),orange=mat('#e07a3c'),teal=mat('#2f7a6b'),blue=mat('#2b6cb0'),yellow=mat('#f6c343',{emissive:'#d49b1f',emissiveIntensity:.35}),windowMat=new T.MeshBasicMaterial({color:'#ffd27d'});

 const sphereGeo=new T.IcosahedronGeometry(1,1),boxGeo=new T.BoxGeometry(1,1,1);
 function mesh(geo,material,parent,x=0,y=0,z=0,sx=1,sy=sx,sz=sx,dyn=false){
  const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(!dyn)staticMeshes.push(m);return m;
 }
 function box(parent,x,y,z,sx,sy,sz,m=wood,dyn=false){return mesh(boxGeo,m,parent,x,y,z,sx,sy,sz,dyn)}
 function ball(parent,x,y,z,sx,sy,sz,m=leaf,dyn=false){return mesh(sphereGeo,m,parent,x,y,z,sx,sy,sz,dyn)}
 function cyl(parent,x,y,z,rt,rb,h,m=wood,n=12,dyn=false){return mesh(new T.CylinderGeometry(rt,rb,h,n),m,parent,x,y,z,1,1,1,dyn)}
 function beam(parent,a,b,r,m=wood,dyn=false){
  const d=b.clone().sub(a);
  const o=mesh(new T.CylinderGeometry(r,r,d.length(),6),m,parent,...a.clone().add(b).multiplyScalar(.5).toArray(),1,1,1,dyn);
  o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o;
 }
 function group(parent,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g}

 function terrain(g,r){
  const n=40,radii=Array.from({length:n},(_,i)=>r*(.93+.06*Math.sin(i*1.7)+.04*Math.cos(i*2.6)));
  function layer(y1,y2,k1,k2,m){
   const v=[];
   for(let i=0;i<n;i++){
    const j=(i+1)%n,a=i/n*Math.PI*2,b=j/n*Math.PI*2;
    const A=[Math.cos(a)*radii[i]*k1,y1,Math.sin(a)*radii[i]*k1],B=[Math.cos(b)*radii[j]*k1,y1,Math.sin(b)*radii[j]*k1],C=[Math.cos(a)*radii[i]*k2,y2,Math.sin(a)*radii[i]*k2],D=[Math.cos(b)*radii[j]*k2,y2,Math.sin(b)*radii[j]*k2];
    v.push(...A,...C,...B,...B,...C,...D,...A,...B,0,y1,0);
   }
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.computeVertexNormals();mesh(geo,m,g);
  }
  layer(.25,-.65,1,1.04,grass);layer(-.65,-1.5,1.04,.94,sand);layer(-1.5,-4.3,.94,.65,mat('#82928c'));layer(-4.3,-7,.65,.35,mat('#697b7b'));layer(-7,-10,.35,.035,mat('#526a71'));
  for(let k=0;k<12;k++){const a=k/12*Math.PI*2;ball(g,Math.cos(a)*r*.66,-7-random()*3,Math.sin(a)*r*.66,.2+random()*.5,.4+random(),.25+random()*.4,rock)}
  for(let k=0;k<22;k++){const a=random()*Math.PI*2,rr=Math.sqrt(random())*r*.85;const patch=cyl(g,Math.cos(a)*rr,.29,Math.sin(a)*rr,.5+random()*.8,.5+random()*.8,.025,k%2?mat('#9dbd96'):mat('#80a889'),6);patch.rotation.y=random()*6}
 }
 function tree(g,x,z,type=0,scale=1){
  const t=group(g,x,.3,z);t.scale.setScalar(scale);cyl(t,0,1,0,.16,.23,2,darkwood,7);
  if(type===0){ball(t,0,2.6,0,1.1,1.25,1,leaf);ball(t,.6,2.3,.15,.75,.8,.8,leafLight);ball(t,-.5,2.4,-.1,.7,.9,.75,leaf)}
  else if(type===1){cyl(t,0,2.1,0,0,1.1,2.1,leaf,8);cyl(t,0,2.9,0,0,.8,1.8,leafLight,8)}
  else{for(let k=0;k<5;k++)ball(t,Math.sin(k*2)*.6,2.4+random()*.6,Math.cos(k*2)*.6,.85,.65,.9,k%2?pink:mat('#ecc5cb'))}
  return t;
 }
 function house(g,x,z,color=roof,scale=1){
  const h=group(g,x,.35,z);h.scale.setScalar(scale);box(h,0,1,0,2.2,1.9,1.9,cream);
  const rg=new T.ConeGeometry(1.85,1.3,4);const r=mesh(rg,color,h,0,2.5,0);r.rotation.y=Math.PI/4;
  box(h,0,.6,0.98,.6,1.2,.06,darkwood);
  for(const xx of [-.7,.7]){box(h,xx,1.2,0.99,.38,.5,.06,windowMat);lights.push(h.children.at(-1))}
  colliders.push({x:g.position.x+x,z:g.position.z+z,r:1.6*scale});return h;
 }
 function flowers(g,x,z){for(let k=0;k<16;k++){const xx=x+(random()-.5)*2,zz=z+(random()-.5)*1.7;cyl(g,xx,.47,zz,.025,.025,.4,leaf,4);ball(g,xx,.72,zz,.12,.09,.12,[pink,cream,mat('#dfb76b')][k%3])}}
 function lamp(g,x,z){cyl(g,x,1.4,z,.07,.1,2.8,darkwood,7);box(g,x,2.75,z,.45,.5,.45,windowMat);cyl(g,x,3.1,z,0,.4,.25,roof,4);lights.push(g.children.at(-2))}
 function waterfall(g,r){
  const falls=group(g,-r*.65,-.4,-r*.55);
  for(let j=0;j<6;j++){const w=box(falls,j*.2,-5,0,.17,10,.22,water,true);animations.push((dt,t)=>{w.scale.y=10+.3*Math.sin(t*2+j);w.position.y=-5-.2*Math.sin(t+j)})}
  for(let j=0;j<8;j++){const d=ball(falls,random()*1.4,-random()*12,0,.07,.2,.08,cream,true);animations.push((dt,t)=>d.position.y=-((t*3+j*1.5)%12))}
 }
 function flag(g,x,z,c='#df987d'){cyl(g,x,1.6,z,.04,.04,3.2,wood,6);const fl=box(g,x+.45,2.9,z,.9,.5,.04,mat(c),true);animations.push((dt,t)=>fl.rotation.y=Math.sin(t*2+x)*.2)}

 // Bolt shape helper for 3D lightning icon
 function createLightningMesh(scale=1){
  const bolt=new T.Shape();
  bolt.moveTo(.15,1.2);bolt.lineTo(-.55,.1);bolt.lineTo(-.05,.1);bolt.lineTo(-.35,-1.1);bolt.lineTo(.6,.2);bolt.lineTo(.08,.2);bolt.closePath();
  const geo=new T.ExtrudeGeometry(bolt,{depth:.22,bevelEnabled:false});
  const m=new T.Mesh(geo,yellow);m.scale.setScalar(scale);m.castShadow=true;return m;
 }

 const islandGroups=new Map();
 for(const [idx,pos] of positions.entries()){
  const g=group(scene,pos.x,0,pos.z);islandGroups.set(pos.id,g);
  terrain(g,pos.r);waterfall(g,pos.r);
  // Peripheral trees & flowers leaving a spacious center plaza for the giant thematic 3D landmark
  tree(g,-pos.r*.76,-1.2,2,1);
  tree(g,pos.r*.74,-1.8,0,1.1);
  tree(g,-pos.r*.62,-pos.r*.6,1,.95);
  flowers(g,-pos.r*.62,2.2);flowers(g,pos.r*.58,2.4);
  for(let k=0;k<12;k++){
   const a=k/12*Math.PI*2,rr=pos.r*.9;
   ball(g,Math.cos(a)*rr,.4,Math.sin(a)*rr,.25,.2,.3,rock);
  }
  for(let k=-5;k<=5;k++)box(g,k*.65,.33,3.6,.56,.08,.65,k%2?mat('#c1c5ac'):mat('#b1bba5'));
  lamp(g,-2.3,4.1);lamp(g,2.3,4.1);flag(g,4.8,1.8);

  if(idx===0){
   // === 中央岛：总复习大岛（巨型旋转能量星象仪 + 四航线能量柱） ===
   cyl(g,0,.55,0,3.2,3.4,.5,cream,24);
   cyl(g,0,.95,0,2.5,2.8,.35,metal,24);
   const globe=group(g,0,3.2,0);
   ball(globe,0,0,0,1.3,1.3,1.3,mat('#74c7b8',{metalness:.2,roughness:.35}),true);
   for(let j=0;j<3;j++){
    const ring=mesh(new T.TorusGeometry(2.1+j*.32,.07,8,44),j===1?orange:metal,globe,0,0,0,1,1,1,true);
    ring.rotation.x=j*Math.PI/3;ring.rotation.y=j*.7;
   }
   const topBolt=createLightningMesh(0.9);topBolt.position.set(0,3.1,0);globe.add(topBolt);
   animations.push(dt=>{globe.rotation.y+=dt*.35;topBolt.rotation.y-=dt*.7});
   // Four energy pillars around the observatory
   for(const [pi,[px,pz,col]] of [[-3.8,-2.8,'#edb85d'],[3.8,-2.8,'#6cc7bb'],[-3.8,2.2,'#8daee2'],[3.8,2.2,'#e99b7a']].entries()){
    cyl(g,px,1.5,pz,.35,.42,2.4,cream,10);
    const orb=ball(g,px,3.1,pz,.42,.42,.42,mat(col,{emissive:col,emissiveIntensity:.25}),true);
    animations.push((dt,t)=>orb.position.y=3.1+Math.sin(t*2+pi)*.18);
   }
   colliders.push({x:0,z:0,r:3.2});

  }else if(idx===1){
   // === 01 生活能量岛（10.1 常见能量）：巨型立体电池能量塔 + 旋转风力发电机 + 太阳能板 + 燃烧营火与运动环 ===
   // 1. 巨型立体电池塔（代表电能与电池储存的化学能）
   const bat=group(g,0,.35,-.5);
   cyl(bat,0,2.1,0,1.45,1.45,4.2,teal,20);
   cyl(bat,0,3.7,0,1.48,1.48,.9,orange,20);
   cyl(bat,0,4.45,0,.55,.55,.6,metal,16); // 电池正极帽
   // Glowing level rings on the battery tower
   for(let j=0;j<3;j++){
    const ring=mesh(new T.TorusGeometry(1.48,.06,6,28),windowMat,bat,0,1.1+j*1.0,0,1,1,1,true);
    ring.rotation.x=Math.PI/2;
   }
   const bolt=createLightningMesh(1.15);bolt.position.set(0,2.3,1.52);bat.add(bolt);
   const floatingBolt=createLightningMesh(0.75);floatingBolt.position.set(0,5.6,0);bat.add(floatingBolt);
   animations.push((dt,t)=>{floatingBolt.rotation.y+=dt*1.2;floatingBolt.position.y=5.6+Math.sin(t*2.5)*.22});

   // 2. 大型现代白色风力发电机（代表机械能与发电）
   const wt=group(g,-3.8,.35,-1.8);
   cyl(wt,0,2.6,0,.18,.38,5.2,cream,12);
   box(wt,0,5.2,.1,.45,.45,.8,cream);
   const rotor=group(wt,0,5.2,.55);
   for(let j=0;j<3;j++){
    const b=group(rotor);b.rotation.z=j*Math.PI*2/3;
    box(b,0,1.35,0,.22,2.6,.06,cream,true);
    box(b,0,2.4,0,.24,.45,.07,orange,true);
   }
   animations.push(dt=>rotor.rotation.z+=dt*1.1);

   // 3. 蓝色阵列太阳能板与电动车充电站（代表光能、电能转化）
   const solar=group(g,3.6,.35,-1.4);
   cyl(solar,0,.7,0,.15,.2,1.4,steel,8);
   const panelMesh=box(solar,0,1.45,0,2.6,.12,1.7,blue);
   panelMesh.rotation.x=.45;
   // Mini electric car beside charger
   box(g,3.2,.75,1.2,1.5,.55,.9,orange,true);
   box(g,3.2,1.15,1.2,.9,.45,.8,cream,true);

   // 4. 燃烧的化学能营火与果树（代表食物/燃料的化学能）
   for(let j=0;j<5;j++){
    const log=cyl(g,-3.2,.45,1.8,.1,.1,1.1,wood,6);
    log.rotation.z=Math.PI/2;log.rotation.y=j*.6;
   }
   const flame=mesh(new T.ConeGeometry(.45,1.1,7),orange,g,-3.2,.95,1.8,1,1,1,true);
   animations.push((dt,t)=>{flame.scale.y=1+Math.sin(t*7)*.22;flame.rotation.y+=dt*2});
   colliders.push({x:pos.x,z:pos.z-.5,r:2.6});

  }else if(idx===2){
   // === 02 机械能实验岛（10.2 机械能）：巨型双轨斜面滚球撞击木块实验台 + 高处落球沙坑塔架 + 巨型弯曲拉弓 ===
   // 1. 双轨斜面滚球实验台（直接对应 Ek.html 的红蓝双赛道 A / B 撞击木块 C）
   const labBase=box(g,-.4,.55,-.4,6.4,.35,3.4,mat('#cfd8dc'));
   for(const [ti,zz,ballCol,boxCol,hStart] of [[0,-1.0,'#e74c3c','#d98880',2.9],[1,0.4,'#3498db','#85c1e9',2.0]]){
    // Support pillars for ramp
    cyl(g,-3.1,.7+hStart/2,zz,.14,.16,hStart,steel,8);
    // Inclined ramp plank
    const ramp=box(g,-1.8,.7+hStart/2,zz,3.2,.18,.95,wood);
    ramp.rotation.z=-Math.atan2(hStart,2.8);
    // Horizontal track
    box(g,1.1,.72,zz,3.2,.14,.95,cream);
    // Rolling experiment ball & target block C
    const expBall=ball(g,-3.0,1.0+hStart,zz,.38,.38,.38,mat(ballCol),true);
    const blockC=box(g,.8,1.05,zz,.68,.62,.68,mat(boxCol),true);
    animations.push((dt,t)=>{
     const u=((t*0.42+ti*0.35)%1);
     if(u<0.45){
      const k=u/0.45;
      expBall.position.set(-3.0+k*2.7,1.0+hStart*(1-k),zz);
      blockC.position.x=0.2;
     }else if(u<0.85){
      const k=(u-0.45)/0.4;
      const push=(ti===0?2.1:1.3)*k;
      expBall.position.set(-0.3+push,1.05,zz);
      blockC.position.x=0.35+push;
     }else{
      expBall.position.set(-0.3+(ti===0?2.1:1.3),1.05,zz);
      blockC.position.x=0.35+(ti===0?2.1:1.3);
     }
    });
   }

   // 2. 高处重力势能落球沙坑塔架（直接对应 Ep.html 与橡皮泥撞钉子实验）
   const epTower=group(g,3.3,.35,-1.8);
   cyl(epTower,-.7,2.4,0,.12,.14,4.8,steel,8);
   cyl(epTower,.7,2.4,0,.12,.14,4.8,steel,8);
   box(epTower,0,4.8,0,1.8,.22,.5,steel);
   // Sand pit box at bottom
   box(epTower,0,.35,.3,2.0,.5,1.5,mat('#e6c994'));
   const dropBall=ball(epTower,0,4.2,.3,.42,.42,.42,orange,true);
   animations.push((dt,t)=>{
    const u=(t*0.6)%1;
    dropBall.position.y=u<0.65?(4.3-u/0.65*3.6):0.7;
   });

   // 3. 巨型弹性势能弯曲弓箭装置（对应“拉开的弓”与“弯曲的撑杆”）
   const bowG=group(g,-3.8,1.8,1.6);
   const bowArc=mesh(new T.TorusGeometry(1.35,.1,8,24,Math.PI),orange,bowG,0,0,0,1,1,1,true);
   bowArc.rotation.z=-Math.PI/2;
   animations.push((dt,t)=>bowArc.scale.x=1+Math.sin(t*3)*.15);
   colliders.push({x:pos.x,z:pos.z,r:3.2});

  }else if(idx===3){
   // === 03 能量守恒岛（10.3 能量守恒）：巨型水库拦河大坝 + 奔流瀑布水道 + 大型旋转水轮机 + 发电机厂房 + 输电铁塔 + 巨型发光灯泡 ===
   // 1. 高耸水库大坝与高处蓄水池（水的重力势能）
   box(g,-2.4,2.1,-1.8,3.6,3.6,2.8,mat('#7f9096'));
   box(g,-2.4,4.0,-1.8,3.2,.18,2.4,water); // 坝顶水库水面
   // 倾斜引水压力管道（水的动能）
   const pipe=box(g,-.4,2.1,-.5,3.2,.65,1.2,water,true);
   pipe.rotation.z=-.55;
   for(let j=0;j<5;j++){
    const drop=ball(g,-1.5,3.2,-.5,.18,.18,.18,cream,true);
    animations.push((dt,t)=>{
     const u=((t*1.1+j/5)%1);
     drop.position.set(-1.6+u*2.4,3.4-u*2.1,-.5+(j%2-.5)*.35);
    });
   }

   // 2. 巨型红色旋转水轮机（水轮机机械能）
   const wheel=group(g,1.0,1.5,.4);
   mesh(new T.TorusGeometry(1.45,.15,8,24),orange,wheel,0,0,0,1,1,1,true);
   cyl(wheel,0,0,0,.35,.35,.4,metal,12,true).rotation.x=Math.PI/2;
   for(let j=0;j<10;j++){
    const paddle=box(wheel,0,0,0,3.1,.16,.35,wood,true);
    paddle.rotation.z=j*Math.PI/5;
   }
   animations.push(dt=>wheel.rotation.z-=dt*1.25);

   // 3. 发电机厂房（机械能 → 电能）
   box(g,1.5,1.5,-1.7,2.4,2.4,2.2,cream);
   box(g,1.5,2.8,-1.7,2.6,.3,2.4,roof);

   // 4. 高压输电铁塔与发光巨型灯泡（电能 → 光能与内能）
   const tower=group(g,4.1,.35,-1.2);
   beam(tower,V(-.7,0,-.7),V(0,4.8,0),.08,steel);
   beam(tower,V(.7,0,-.7),V(0,4.8,0),.08,steel);
   beam(tower,V(-.7,0,.7),V(0,4.8,0),.08,steel);
   beam(tower,V(.7,0,.7),V(0,4.8,0),.08,steel);
   box(tower,0,3.2,0,1.9,.12,.12,steel);
   box(tower,0,4.1,0,1.4,.12,.12,steel);
   // Giant glowing bulb monument next to tower
   const bulbG=group(g,3.8,.35,1.8);
   cyl(bulbG,0,.6,0,.45,.55,1.2,steel,12);
   const bulbGlass=ball(bulbG,0,1.8,0,.95,1.1,.95,yellow,true);
   animations.push((dt,t)=>bulbGlass.scale.setScalar(1+Math.sin(t*4)*.06));
   colliders.push({x:pos.x,z:pos.z,r:3.3});

  }else{
   // === 04 功与功率岛（10.4 功与功率）：巨型双臂对比起重机吊塔（一快一慢直观展示功率快慢） + 瓦特齿轮计时钟塔 ===
   // 1. 高耸工业起重机主塔架
   const crane=group(g,-.5,.35,-.8);
   for(const xx of [-1.2,1.2]){
    cyl(crane,xx,3.0,0,.18,.24,6.0,orange,10);
    for(let k=0;k<5;k++)beam(crane,V(xx-.35,.6+k*1.1,0),V(xx+.35,1.5+k*1.1,0),.06,steel);
   }
   // Top horizontal twin boom arm (W = Fs)
   box(crane,0,6.0,0,6.2,.42,.9,orange);
   box(crane,0,6.4,0,2.2,.5,.8,steel);

   // Left Cargo A: High Power (fast lift) vs Right Cargo B: Lower Power (slow lift)
   const loadA=box(crane,-2.2,2.0,.3,1.2,.95,1.2,teal,true);
   const ropeA=box(crane,-2.2,4.0,.3,.07,3,.07,darkwood,true);
   const loadB=box(crane,2.2,2.0,.3,1.2,.95,1.2,blue,true);
   const ropeB=box(crane,2.2,4.0,.3,.07,3,.07,darkwood,true);
   animations.push((dt,t)=>{
    // Fast crane A completes lift twice as fast as crane B (P = W/t)
    const yA=2.2+Math.sin(t*1.8)*1.3;
    loadA.position.y=yA;ropeA.position.y=(6.0+yA)/2;ropeA.scale.y=6.0-yA;
    const yB=2.2+Math.sin(t*0.7)*1.3;
    loadB.position.y=yB;ropeB.position.y=(6.0+yB)/2;ropeB.scale.y=6.0-yB;
   });

   // 2. 瓦特齿轮计时钟塔（代表功率 P = W/t 的时间测量）
   const clockTower=group(g,3.5,.35,1.2);
   box(clockTower,0,1.6,0,1.6,3.2,1.6,cream);
   cyl(clockTower,0,3.6,0,0,1.35,1.0,roof,4).rotation.y=Math.PI/4;
   const dial=cyl(clockTower,0,2.2,.85,.65,.65,.12,metal,20);dial.rotation.x=Math.PI/2;
   const hand=box(clockTower,0,2.2,.95,.08,.55,.06,darkwood,true);
   animations.push(dt=>hand.rotation.z-=dt*1.5);
   colliders.push({x:pos.x,z:pos.z,r:3.0});
  }
 }

 // Catenary bridges connecting center island to the 4 course islands
 const bridges=[];function bridgeY(t){return .3-Math.sin(Math.PI*t)*1.1}
 for(const pos of positions.slice(1)){
  const dir=V(pos.x,0,pos.z).normalize();
  const a=dir.clone().multiplyScalar(8.2),b=V(pos.x,0,pos.z).addScaledVector(dir,-pos.r*.88);
  const len=a.distanceTo(b),side=V(-dir.z,0,dir.x),n=Math.ceil(len/.5);
  for(let k=0;k<=n;k++){
   const t=k/n,pt=a.clone().lerp(b,t);pt.y=bridgeY(t);
   const plank=box(scene,pt.x,pt.y,pt.z,1.8,.15,.43,wood);plank.rotation.y=Math.atan2(dir.x,dir.z);
   if(k%4===0)for(const ss of [-1,1]){const pp=pt.clone().addScaledVector(side,ss*.9);cyl(scene,pp.x,pp.y+.6,pp.z,.04,.04,1.4,wood,5)}
   if(k<n)for(const ss of [-1,1]){const pp=pt.clone().addScaledVector(side,ss*.9);pp.y+=1.15;const qq=a.clone().lerp(b,(k+1)/n).addScaledVector(side,ss*.9);qq.y=bridgeY((k+1)/n)+1.15;beam(scene,pp,qq,.035,cream)}
  }
  bridges.push({a,b,id:pos.id,dir,len,side});
  for(let k=1;k<7;k++){
   const t=k/7,pt=a.clone().lerp(b,t).addScaledVector(side,.93);pt.y=bridgeY(t)+1.1;
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-.2,0,0,.2,0,0,0,-.4,0],3));geo.computeVertexNormals();
   const fl=mesh(geo,mat(k%2?'#ddad79':'#a6c0a0',{side:T.DoubleSide}),scene,pt.x,pt.y,pt.z,1,1,1,true);
   animations.push((dt,t)=>fl.rotation.y=Math.sin(t*2+k)*.25);
  }
 }

 // Lighthouse and rainbow
 const lg=islandGroups.get('island-05');
 cyl(lg,4.8,2.5,-3.2,.55,.85,4.2,cream,12);cyl(lg,4.8,2.6,-3.2,.6,.7,.7,mat('#c97d70'),12);cyl(lg,4.8,4.8,-3.2,.85,.7,.5,roof,12);ball(lg,4.8,5.1,-3.2,.4,.35,.4,windowMat);
 const sweep=group(scene,32.8,5.1,-12.2);
 const cone=mesh(new T.ConeGeometry(2.5,17,12,1,true),new T.MeshBasicMaterial({color:'#f8d88b',transparent:true,opacity:.06,side:T.DoubleSide,depthWrite:false}),sweep,0,0,8.5,1,1,1,true);
 cone.rotation.x=Math.PI/2;animations.push(dt=>sweep.rotation.y+=dt*.25);

 const rainbow=group(scene,-4,4,-30);
 for(let i=0;i<5;i++)mesh(new T.TorusGeometry(15+i*.22,.12,5,60,Math.PI),new T.MeshBasicMaterial({color:['#e5a59b','#edc28b','#e7d9a1','#a9c8b0','#9fbac9'][i],transparent:true,opacity:.5}),rainbow,0,0,0,1,1,1,true);

 // Sky dome and clouds
 const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#89b6cf')},bottom:{value:new T.Color('#e6e9d7')}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v;uniform vec3 top;uniform vec3 bottom;void main(){float f=smoothstep(-.8,.4,normalize(v).y);gl_FragColor=vec4(mix(bottom,top,f),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
 const sky=new T.Mesh(new T.SphereGeometry(220,24,16),skyMat);scene.add(sky);
 for(let k=0;k<16;k++){const a=k/16*Math.PI*2;const m=cyl(scene,Math.cos(a)*115,-24,Math.sin(a)*115,0,10+random()*8,10+random()*9,mat('#94afb4'),7);m.rotation.y=random()*6}
 const cloudMat=new T.MeshStandardMaterial({color:'#e0ebdf',roughness:1,flatShading:true});
 for(let k=0;k<50;k++){const a=random()*Math.PI*2,rr=k<16?20+random()*35:35+random()*65;const cl=group(scene,Math.cos(a)*rr,-13-random()*7,Math.sin(a)*rr);for(let j=0;j<4;j++)ball(cl,(j-1.5)*3,random(),random()*3,5,1.3,3.8,cloudMat,true);clouds.push(cl)}
 for(let k=0;k<10;k++){const a=k/10*Math.PI*2;const cl=group(scene,Math.cos(a)*76,13+random()*8,Math.sin(a)*76);for(let j=0;j<4;j++)ball(cl,j*2,random(),0,3,1.4,1.8,cloudMat,true);clouds.push(cl)}

 function glowTexture(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'#fff');gr.addColorStop(.15,'#fff9');gr.addColorStop(1,'#fff0');x.fillStyle=gr;x.fillRect(0,0,64,64);return new T.CanvasTexture(c)}
 const glow=glowTexture();
 const sunSprite=new T.Sprite(new T.SpriteMaterial({map:glow,color:'#ffe0a0',transparent:true,depthWrite:false}));sunSprite.scale.set(24,24,1);sunSprite.position.set(-50,45,-65);scene.add(sunSprite);
 const moonSprite=new T.Sprite(new T.SpriteMaterial({map:glow,color:'#c6ddeb',transparent:true,depthWrite:false}));moonSprite.scale.set(15,15,1);moonSprite.position.set(40,48,-60);scene.add(moonSprite);
 for(const pos of positions){for(const xx of [-2.3,2.3]){const spr=new T.Sprite(new T.SpriteMaterial({map:glow,color:'#ffcf7c',transparent:true,opacity:.7,depthWrite:false}));spr.position.set(pos.x+xx,2.8,pos.z+4.1);spr.scale.set(2.5,2.5,1);scene.add(spr);lights.push(spr)}}
 const starGeo=new T.BufferGeometry(),starV=[];for(let k=0;k<350;k++){const a=random()*Math.PI*2,y=20+random()*100;starV.push(Math.cos(a)*140,y,Math.sin(a)*140)}starGeo.setAttribute('position',new T.Float32BufferAttribute(starV,3));const stars=new T.Points(starGeo,new T.PointsMaterial({color:'#e3e9d7',size:.32,transparent:true}));scene.add(stars);
 for(const pos of positions)for(let j=0;j<8;j++){const ff=new T.Sprite(new T.SpriteMaterial({map:glow,color:'#e7e7a1',depthWrite:false}));ff.position.set(pos.x+(random()-.5)*9,1+random()*2,pos.z+(random()-.5)*9);ff.scale.setScalar(.3);scene.add(ff);fireflies.push({obj:ff,base:ff.position.clone()})}

 // Player & Mascot Robot "小亮" (sub-item residents removed as requested)
 function human(color='#6a9c8f',avatar=0){
  const g=new T.Group(),skin=mat('#e7bd95'),cloth=mat(color);
  ball(g,0,1.15,0,.22,.25,.22,skin,true);box(g,0,.7,0,.4,.5,.28,cloth,true);cyl(g,0,1.38,0,.25,.27,.13,cloth,10,true);
  if(avatar===1)box(g,.15,1.47,0,.07,.2,.07,metal,true);
  if(avatar===2)ball(g,0,1.44,0,.19,.13,.2,cloth,true);
  for(const xx of [-.08,.08])ball(g,xx,1.18,.19,.025,.027,.025,darkwood,true);
  const limbs=[];
  for(const xx of [-1,1]){
   const arm=group(g,xx*.27,.86,0);box(arm,0,-.18,0,.11,.4,.13,cloth,true);ball(arm,0,-.4,0,.07,.07,.07,skin,true);
   const leg=group(g,xx*.12,.48,0);box(leg,0,-.2,0,.13,.4,.15,darkwood,true);box(leg,0,-.4,.04,.16,.12,.24,darkwood,true);
   limbs.push(arm,leg);
  }
  g.userData.limbs=limbs;return g;
 }
 function robot(){
  const g=new T.Group(),rBlue=mat('#71bed1');
  ball(g,0,.75,0,.34,.4,.28,rBlue,true);ball(g,0,1.3,0,.38,.32,.3,rBlue,true);box(g,0,1.3,.27,.48,.19,.05,cream,true);
  for(const xx of [-.12,.12])ball(g,xx,1.31,.31,.035,.045,.025,darkwood,true);
  cyl(g,0,1.65,0,.025,.025,.18,metal,5,true);ball(g,0,1.76,0,.08,.08,.08,metal,true);box(g,0,.85,-.3,.36,.42,.2,wood,true);
  const limbs=[];
  for(const ss of [-1,1]){const arm=group(g,ss*.4,.95,0);ball(arm,0,-.17,0,.08,.22,.08,rBlue,true);const leg=group(g,ss*.16,.4,0);ball(leg,0,-.18,0,.1,.23,.12,rBlue,true);limbs.push(arm,leg)}
  g.userData.limbs=limbs;return g;
 }
 const mascot=robot();
 mascot.position.set(-2.2,.35,4.2);mascot.scale.setScalar(1.15);
 mascot.userData={...mascot.userData,type:'mascot',id:'mascot',name:'小亮'};
 scene.add(mascot);pickables.push(mascot);

 // Animals
 function animal(type,color){
  const g=new T.Group(),m=mat(color),black=mat('#384d4a');
  if(type==='butterfly'){ball(g,0,.25,0,.08,.1,.25,black,true);const wings=[];for(const ss of [-1,1]){const wing=ball(g,ss*.25,.25,0,.28,.035,.3,mat(ss<0?'#dda981':'#e7c8a2'),true);wings.push(wing)}g.userData.wings=wings}
  else if(type==='whale'||type==='seal'){ball(g,0,.4,0,.7,.48,type==='whale'?1.5:.85,m,true);ball(g,0,.48,.7,.55,.4,.6,m,true);for(const ss of [-1,1]){const fin=ball(g,ss*.6,.25,-.3,.5,.08,.35,m,true);fin.rotation.z=ss*.3}for(const ss of [-1,1])ball(g,ss*.35,.5,-1.3,.5,.08,.45,m,true);for(const ss of [-1,1])ball(g,ss*.45,.65,1,.05,.05,.05,black,true)}
  else if(type==='crab'){ball(g,0,.25,0,.4,.2,.3,m,true);for(const ss of [-1,1]){for(let j=0;j<3;j++)beam(g,V(ss*.3,.2,-.2+j*.2),V(ss*.65,.06,-.3+j*.3),.045,m,true);ball(g,ss*.48,.4,.35,.15,.12,.18,m,true);ball(g,ss*.15,.48,.18,.04,.07,.04,black,true)}}
  else{ball(g,0,.5,0,.3,.32,.58,m,true);ball(g,0,.85,.5,.3,.28,.3,m,true);const legs=[];for(const x of [-.22,.22])for(const z of [-.36,.36]){const l=box(g,x,.2,z,.12,.4,.13,m,true);legs.push(l)}g.userData.legs=legs;for(const ss of [-1,1]){const ear=mesh(new T.ConeGeometry(.12,.28,4),m,g,ss*.18,1.1,.5,1,1,1,true);ear.rotation.z=ss*.3;ball(g,ss*.12,.9,.75,.035,.035,.03,black,true)}beam(g,V(0,.65,-.5),V(.13,.95,-.8),.06,m,true);if(type==='cow'){ball(g,-.21,.65,-.05,.14,.22,.27,black,true);ball(g,.18,.55,-.28,.18,.2,.2,black,true);for(const ss of [-1,1])cyl(g,ss*.22,1.18,.45,.03,.07,.25,cream,6,true)}if(type==='deer'){for(const ss of [-1,1]){beam(g,V(ss*.15,1,.4),V(ss*.3,1.6,.35),.035,wood,true);beam(g,V(ss*.24,1.35,.37),V(ss*.5,1.48,.35),.03,wood,true)}}if(type==='dog'){for(const ss of [-1,1])ball(g,ss*.27,.85,.45,.12,.25,.15,wood,true)}}
  return g;
 }
 const animalDefs=[['butterfly','蝴蝶','#e6b589',1],['cat','猫咪','#d9b898',0],['cow','乳牛','#e6e4d4',1],['dog','小狗','#b88d68',2],['seal','海豹','#a8bcc0',3],['whale','鲸鱼','#779eaa',0],['crab','螃蟹','#d48c71',4],['deer','小鹿','#bd9974',4]];
 for(const [type,name,color,i] of animalDefs){
  const a=animal(type,color),pos=positions[i];
  a.position.set(pos.x+4.2,.4,pos.z+2.8);
  if(type==='butterfly')a.position.y=2.2;
  if(type==='whale'){a.scale.setScalar(3);a.position.set(20,-9,-25)}
  a.userData={...a.userData,type:'animal',id:type,name};scene.add(a);pickables.push(a);animals.push({obj:a,base:a.position.clone(),type,name});
 }

 for(let flock=0;flock<3;flock++){
  const g=group(scene,0,15+flock*2,0);
  for(let j=0;j<7;j++){
   const b=group(g,Math.sign(j%2-.5)*Math.ceil(j/2)*1.3,0,Math.ceil(j/2)*1.2);
   ball(b,0,0,0,.12,.1,.35,cream,true);const wings=[];for(const ss of [-1,1]){const w=box(b,ss*.35,0,0,.7,.035,.2,cream,true);wings.push(w)}
   birds.push({obj:b,wings,flock:g,index:flock});
  }
 }
 function boat(){const b=new T.Group();ball(b,0,0,0,.65,.35,1.6,wood,true);cyl(b,0,1,0,.04,.06,2.6,wood,6,true);const sail=box(b,.5,1.3,0,1,.95,.04,cream,true);sail.rotation.y=.2;return b}
 for(let k=0;k<2;k++){const b=boat();b.scale.setScalar(1.7);scene.add(b);boats.push(b)}

 function mergeLocal(g,exclude=[]){
  g.updateWorldMatrix(true,true);const inv=g.matrixWorld.clone().invert(),buckets=new Map();
  for(const m of [...g.children]){
   if(!m.isMesh||exclude.includes(m))continue;
   let geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();
   geo.applyMatrix4(inv.clone().multiply(m.matrixWorld));geo.deleteAttribute('uv');
   if(!buckets.has(m.material))buckets.set(m.material,[]);buckets.get(m.material).push(geo);g.remove(m);
  }
  for(const [material,geos]of buckets){const geo=mergeGeometries(geos,false);geos.forEach(x=>x.dispose());const m=new T.Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;g.add(m)}
 }
 clouds.forEach(cl=>{mergeLocal(cl);cl.traverse(o=>o.castShadow=false)});
 animals.forEach(a=>mergeLocal(a.obj,[...(a.obj.userData.legs||[]),...(a.obj.userData.wings||[])]));
 boats.forEach(b=>mergeLocal(b));

 scene.updateMatrixWorld(true);const batches=new Map();
 for(const m of staticMeshes){
  const geo=m.geometry.clone();geo.applyMatrix4(m.matrixWorld);geo.deleteAttribute('uv');
  if(geo.index){const expanded=geo.toNonIndexed();geo.dispose();batches.has(m.material)||batches.set(m.material,[]);batches.get(m.material).push(expanded);m.parent.remove(m);continue}
  batches.has(m.material)||batches.set(m.material,[]);batches.get(m.material).push(geo);m.parent.remove(m);
 }
 for(const [m,geos]of batches){const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(!merged)continue;const obj=new T.Mesh(merged,m);obj.castShadow=true;obj.receiveShadow=true;scene.add(obj)}

 const labelEntries=positions.map((pos,n)=>{
  const b=document.createElement('button');b.className='island-label';
  const title=n===0?data.center.name:data.islands[n-1].name;
  b.innerHTML=`<b>${n===0?'✦':String(n).padStart(2,'0')}</b>${title}<span class="label-state"></span>`;
  b.setAttribute('aria-label','前往'+title);b.onclick=()=>hooks.select(pos.id);
  labelHost.append(b);
  return {button:b,pos,point:V(pos.x,5.5,pos.z)};
 });

 function overviewPosition(){
  const mobile=innerWidth<600;
  return {position:mobile?V(95,100,135):innerWidth/innerHeight<1.1?V(85,80,115):V(65,55,78),target:mobile?V(1,5,4):innerWidth/innerHeight<1.1?V(1,3,4):V(-5,0,6)};
 }
 function setOverview(instant=false){
  walk=false;follow=false;route=[];held.clear();hooks.walk?.(false);
  const o=overviewPosition();
  if(instant||reduced){camera.position.copy(o.position);controls.target.copy(o.target);controls.enabled=true;cinema=null;controls.update()}
  else fly(o.position,o.target,1.5);
  selected=null;
 }
 function fly(pos,target,duration,done,epic=false){
  if(reduced){camera.position.copy(pos);controls.target.copy(target);controls.update();done?.();return}
  cinema={from:camera.position.clone(),fromTarget:controls.target.clone(),to:pos.clone(),target:target.clone(),duration,start:time,done,epic};
  controls.enabled=false;
 }
 function skip(){if(cinema){const c=cinema;camera.position.copy(c.to);controls.target.copy(c.target);cinema=null;controls.enabled=!walk;controls.update();c.done?.()}hooks.cinema?.(false)}
 function intro(){setOverview(true);const o=overviewPosition();camera.position.set(-100,88,-90);controls.target.set(0,0,0);hooks.cinema?.(true);fly(o.position,o.target,innerWidth<600?3.5:5,()=>hooks.cinema?.(false),true)}
 function focus(id,callback){
  const p=positions.find(x=>x.id===id);selected=id;
  const offset=innerWidth<600?V(16,18,22):V(18,17,23),target=V(p.x,1.6,p.z);
  if(innerWidth>=600)target.x+=4.5;
  fly(V(p.x,0,p.z).add(offset),target,innerWidth<600?1.3:1.9,callback,true);
 }
 function walkable(x,z){
  for(const p of positions)if(Math.hypot(x-p.x,z-p.z)<p.r*.86)return {y:.35,id:p.id};
  for(const b of bridges){const v=V(x,0,z).sub(b.a),t=v.dot(b.dir)/b.len;if(t>=-.05&&t<=1.05&&Math.abs(v.dot(b.side))<.72)return {y:bridgeY(Math.max(0,Math.min(1,t)))+.15,id:b.id}}
  return null;
 }
 function allowed(x,z){const land=walkable(x,z);if(!land)return null;if(colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.3))return null;return land}
 function findPath(start,end){
  const step=.5,key=(x,z)=>x+','+z,sx=Math.round(start.x/step),sz=Math.round(start.z/step),ex=Math.round(end.x/step),ez=Math.round(end.z/step),startKey=key(sx,sz);
  const open=[{x:sx,z:sz,g:0,f:0}],best=new Map([[startKey,0]]),parents=new Map(),closed=new Set();let found=null;
  for(let n=0;open.length&&n<22000;n++){
   let idx=0;for(let j=1;j<open.length;j++)if(open[j].f<open[idx].f)idx=j;
   const cur=open.splice(idx,1)[0],ck=key(cur.x,cur.z);if(closed.has(ck))continue;closed.add(ck);
   if(Math.hypot(cur.x-ex,cur.z-ez)<1.1){found=ck;break}
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
    const nx=cur.x+dx,nz=cur.z+dz,nk=key(nx,nz);
    if(closed.has(nk)||!allowed(nx*step,nz*step)||dx&&dz&&(!allowed((cur.x+dx)*step,cur.z*step)||!allowed(cur.x*step,(cur.z+dz)*step)))continue;
    const ng=cur.g+Math.hypot(dx,dz);if(ng>=(best.get(nk)??Infinity))continue;
    best.set(nk,ng);parents.set(nk,ck);open.push({x:nx,z:nz,g:ng,f:ng+Math.hypot(nx-ex,nz-ez)});
   }
  }
  if(!found)return[];
  const path=[];for(let k=found;k&&k!==startKey;k=parents.get(k)){const [x,z]=k.split(',').map(Number);path.unshift(V(x*step,allowed(x*step,z*step).y,z*step))}
  return path;
 }
 function pathTo(id){
  if(!player)return;const p=positions.find(p=>p.id===id);
  route=findPath(player.position,V(p.x,.35,p.z+3.6));routeIndex=0;
  if(reduced&&route.length){player.position.copy(route.at(-1));route=[]}follow=false;
 }
 function addPlayer(avatar){
  if(player)scene.remove(player);
  player=human(['#73b2a2','#b78966','#8e9eb9'][avatar]||'#73b2a2',avatar);
  player.scale.setScalar(1.2);player.position.set(0,.35,5);scene.add(player);return player;
 }
 function startWalk(){skip();tour=null;route=[];walk=true;follow=false;held.clear();controls.enabled=false;camera.position.set(0,2,5.5);yaw=Math.PI;pitch=0;hooks.walk?.(true);hooks.tour?.(null)}
 function updateTour(){if(!tour||tour.paused||cinema)return;if(time-tour.arrived>5){if(tour.index===data.islands.length-1){stopTour();return}tour.index++;tourGo()}}
 function tourGo(){const island=data.islands[tour.index];hooks.tour?.({...tour,island});focus(island.id,()=>{if(tour)tour.arrived=time})}
 function stopTour(){tour=null;hooks.tour?.(null);setOverview()}

 const raycaster=new T.Raycaster();
 function project(pos){const p=pos.clone().project(camera);return {x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight,z:p.z}}
 function pick(event){
  const xy={x:event.clientX,y:event.clientY};
  raycaster.setFromCamera(new T.Vector2(xy.x/innerWidth*2-1,-xy.y/innerHeight*2+1),camera);
  let best=null;
  for(const o of pickables){
   if(!o.visible)continue;
   const sp=project(o.getWorldPosition(V()).add(V(0,.8,0)));
   const d=Math.hypot(sp.x-xy.x,sp.y-xy.y);
   if(sp.z<1&&d<(innerWidth<600?27:20)&&(!best||d<best.d))best={o,d};
  }
  if(best){
   const o=best.o;bubbleTarget=o;
   if(o.userData.type==='animal'){o.userData.hopStart=time;o.userData.hopBase=o.position.y;o.lookAt(camera.position.x,o.position.y,camera.position.z)}
   hooks.pick?.(o.userData,project(o.getWorldPosition(V())));return;
  }
  hooks.empty?.();if(walk)return;
  const plane=new T.Plane(V(0,1,0),-.35),hit=V();
  if(raycaster.ray.intersectPlane(plane,hit)){
   const p=positions.find(p=>Math.hypot(hit.x-p.x,hit.z-p.z)<p.r);
   if(p){if(player&&p.id===selected&&allowed(hit.x,hit.z)){route=findPath(player.position,hit);routeIndex=0;return}hooks.select(p.id)}
  }
 }
 let skippedPointer=false;
 const skipOnPointer=e=>{if(cinema){skippedPointer=true;e.preventDefault();e.stopImmediatePropagation();skip()}};
 const skipClick=e=>{if(skippedPointer){skippedPointer=false;e.preventDefault();e.stopImmediatePropagation()}};
 document.addEventListener('pointerdown',skipOnPointer,true);document.addEventListener('click',skipClick,true);
 const down=e=>{drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};if(cinema){skip();drag=null;return}if(tour){tour.paused=true;hooks.tour?.({...tour,island:data.islands[tour.index]})}};
 const move=e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(walk){yaw-=(e.clientX-drag.lastX)*.004;pitch=Math.max(-1,Math.min(.8,pitch-(e.clientY-drag.lastY)*.003));drag.lastX=e.clientX;drag.lastY=e.clientY}};
 const up=e=>{if(drag&&!drag.moved)pick(e);drag=null};
 renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);
 renderer.domElement.addEventListener('wheel',()=>{if(tour){tour.paused=true;hooks.tour?.({...tour,island:data.islands[tour.index]})}},{passive:true});

 const keydown=e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;
  if(e.key==='Escape'){if(tour){skip();stopTour()}else if(walk)setOverview();else if(cinema)skip();return}
  if(cinema){skip();return}
  const m={w:'forward',ArrowUp:'forward',s:'back',ArrowDown:'back',a:'left',ArrowLeft:'left',d:'right',ArrowRight:'right'}[e.key];
  if(m&&(walk||player)&&!document.body.classList.contains('panel-open')){e.preventDefault();held.add(m);route=[];follow=!walk}
 };
 const keyup=e=>{const m={w:'forward',ArrowUp:'forward',s:'back',ArrowDown:'back',a:'left',ArrowLeft:'left',d:'right',ArrowRight:'right'}[e.key];held.delete(m)};
 addEventListener('keydown',keydown);addEventListener('keyup',keyup);addEventListener('blur',()=>held.clear());

 function updateLights(dt){
  let hr=sceneHour;
  if(clockMode==='realtime'){const d=new Date();hr=d.getHours()+d.getMinutes()/60}
  else if(clockMode==='auto'){if(!reduced)hr=(sceneHour+dt*24/160)%24}
  else hr={day:12,dusk:18,night:23}[clockMode];
  sceneHour=hr;
  const period=hr>=6&&hr<16?'day':hr>=16&&hr<19||hr>=5&&hr<6?'dusk':'night';
  hooks.clock?.({hour:hr,period,mode:clockMode});
  const theme=themeMode==='auto'?period:themeMode;
  hooks.theme?.(theme);
  const night=period==='night',dusk=period==='dusk';
  const f=reduced?1:Math.min(1,dt*1.2);
  const palette={day:['#6ba9c4','#d8e9df'],dusk:['#b0bacb','#e9c6ad'],night:['#102238','#253e56']}[theme];
  skyMat.uniforms.top.value.lerp(new T.Color(palette[0]),f);skyMat.uniforms.bottom.value.lerp(new T.Color(palette[1]),f);
  scene.fog.color.lerp(new T.Color(palette[1]),f);
  sun.intensity=T.MathUtils.lerp(sun.intensity,night?.28:dusk?1.7:3,f);
  hemi.intensity=T.MathUtils.lerp(hemi.intensity,night?.95:1.9,f);
  sun.color.lerp(new T.Color(dusk?'#ffd2a5':night?'#a0b8eb':'#fff0d5'),f);
  sun.position.x=T.MathUtils.lerp(sun.position.x,dusk?40:-25,f);sun.position.y=T.MathUtils.lerp(sun.position.y,dusk?14:55,f);
  cloudMat.color.lerp(new T.Color(night?'#758995':dusk?'#d5c5bc':'#e2e9dc'),f);
  windowMat.color.lerp(new T.Color(night?'#ffd18b':'#b8c9b0'),f);
  moonLight.intensity=T.MathUtils.lerp(moonLight.intensity,night?30:0,f);
  stars.visible=night;moonSprite.visible=night;sunSprite.visible=!night;rainbow.visible=!night;sweep.visible=night;
  for(const l of lights)if(l.isSprite)l.visible=night;
  for(const ff of fireflies)ff.obj.visible=night;
  for(const b of birds)b.flock.visible=!night;
  return {night};
 }

 function animateAnimals(dt,night){
  animals.forEach((a,i)=>{
   const talking=bubbleTarget===a.obj;
   if(!night&&!talking){
    if(a.type==='whale'){
     a.obj.position.set(Math.cos(time*.045)*43,-10+Math.sin(time*.4)*1.3+Math.pow(Math.max(0,Math.sin(time*.3)),20)*5,Math.sin(time*.045)*40);
     a.obj.rotation.y=-time*.045;a.obj.rotation.z=Math.sin(time*.5)*.06;
    }else if(a.type==='butterfly'){
     a.obj.position.copy(a.base).add(V(Math.sin(time)*1.3,Math.sin(time*2)*.4,Math.cos(time)*.8));
     a.obj.userData.wings.forEach((w,j)=>w.rotation.z=Math.sin(time*16)*(j?1:-1));
    }else{
     a.obj.position.x=a.base.x+Math.sin(time*.25+i)*.7;a.obj.position.z=a.base.z+Math.cos(time*.25+i)*.4;
     a.obj.rotation.y=time*.25+i+Math.PI/2;a.obj.position.y=a.base.y+Math.abs(Math.sin(time*5))*.04;
     a.obj.userData.legs?.forEach((l,j)=>l.rotation.x=Math.sin(time*5+j*Math.PI)*.25);
    }
   }else if(talking){
    const u=Math.min(1,(time-(a.obj.userData.hopStart??time))/.6);
    a.obj.position.y=(a.obj.userData.hopBase??a.base.y)+Math.sin(u*Math.PI)*.5;
    a.obj.lookAt(camera.position.x,a.obj.position.y,camera.position.z);
   }else{
    a.obj.position.copy(a.base);a.obj.userData.legs?.forEach(l=>l.rotation.x=0);
   }
  });
 }

 function labels(){
  const boxes=[];
  for(const entry of labelEntries){
   const p=project(entry.point),el=entry.button;
   let x=p.x,y=p.y;const w=el.offsetWidth||150,h=el.offsetHeight||40;
   x=Math.max(w/2+8,Math.min(innerWidth-w/2-8,x));
   let show=p.z<1&&p.z>-1&&x>10&&x<innerWidth-10&&y>75&&y<innerHeight-75&&!walk;
   for(let k=0;k<5&&boxes.some(b=>Math.abs(b.x-x)<(b.w+w)/2+6&&Math.abs(b.y-y)<(b.h+h)/2+4);k++)y+=(innerWidth<600?1:-1)*(h+7);
   show=show&&y>75;el.style.visibility=show?'visible':'hidden';
   if(show){x=Math.max(w/2+8,Math.min(innerWidth-w/2-8,x));el.style.left=x+'px';el.style.top=y+'px';boxes.push({x,y,w,h})}
  }
  if(bubbleTarget)hooks.bubblePosition?.(project(bubbleTarget.getWorldPosition(V()).add(V(0,2,0))));
 }

 function tick(now){
  if(disposed)return;requestAnimationFrame(tick);
  if(hidden){last=now;return}
  const dt=Math.min((now-last)/1000||.016,.05);last=now;time+=dt;frames++;fpsTime+=dt;
  if(fpsTime>2){fps=frames/fpsTime;frames=0;fpsTime=0;if(fps<24)qualitySlow+=2;else qualitySlow=0;if(qualitySlow>=6&&!low){setQuality(true);hooks.quality?.(true)}}
  const {night}=updateLights(dt);
  if(!reduced){
   animations.forEach(fn=>fn(dt,time));
   mascot.userData.limbs[0].rotation.z=-0.9+Math.sin(time*5)*.25;
   clouds.forEach(cl=>{cl.position.x+=dt*.08;if(cl.position.x>100)cl.position.x=-100});
   animateAnimals(dt,night);
   birds.forEach((b,i)=>{b.flock.position.set(Math.cos(time*.07+b.index*2)*48,14+b.index*2,Math.sin(time*.07+b.index*2)*48);b.flock.rotation.y=-time*.07-b.index*2;b.wings.forEach((w,j)=>w.rotation.z=Math.sin(time*6+i)*(j?1:-1)*.5)});
   boats.forEach((b,i)=>{b.position.set(Math.cos(time*.025+i*Math.PI)*55,-7,Math.sin(time*.025+i*Math.PI)*48);b.rotation.y=-time*.025-i*Math.PI;b.rotation.z=Math.sin(time+i)*.05});
   fireflies.forEach((ff,i)=>ff.obj.position.copy(ff.base).add(V(Math.sin(time+i)*.25,Math.cos(time*.7+i)*.2,0)));
  }
  if(cinema){
   const c=cinema,u=Math.min(1,(time-c.start)/c.duration),e=u*u*(3-2*u);
   camera.position.copy(c.from).lerp(c.to,e);
   if(c.epic){
    const a=c.from.clone().sub(c.target),b=c.to.clone().sub(c.target),angleA=Math.atan2(a.x,a.z),angleB=Math.atan2(b.x,b.z);
    let delta=angleB-angleA;while(delta>Math.PI)delta-=Math.PI*2;while(delta<-Math.PI)delta+=Math.PI*2;
    const angle=angleA+delta*e,radius=T.MathUtils.lerp(Math.hypot(a.x,a.z),Math.hypot(b.x,b.z),e)+Math.sin(Math.PI*u)*9;
    camera.position.x=c.target.x+Math.sin(angle)*radius;camera.position.z=c.target.z+Math.cos(angle)*radius;camera.position.y+=Math.sin(Math.PI*u)*16;
   }
   controls.target.copy(c.fromTarget).lerp(c.target,e);camera.lookAt(controls.target);
   if(u===1){cinema=null;controls.enabled=!walk;c.done?.()}
  }else if(walk){
   const forward=(held.has('forward')?1:0)-(held.has('back')?1:0),side=(held.has('right')?1:0)-(held.has('left')?1:0);
   const nx=camera.position.x+(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*dt*4,nz=camera.position.z+(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*dt*4;
   const land=allowed(nx,nz);if(land){camera.position.x=nx;camera.position.z=nz;camera.position.y=land.y+1.65}
   camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);
  }else{
   if(player&&route.length){
    const target=route[routeIndex],d=target.clone().sub(player.position),dist=d.length();
    if(dist<.15){routeIndex++;if(routeIndex>=route.length)route=[]}
    else{player.position.addScaledVector(d.normalize(),Math.min(dist,dt*5));player.rotation.y=Math.atan2(d.x,d.z);player.userData.limbs.forEach((l,j)=>l.rotation.x=reduced?0:Math.sin(time*8+j*Math.PI)*.5)}
   }
   if(player&&held.size){
    const forward=(held.has('forward')?1:0)-(held.has('back')?1:0),side=(held.has('right')?1:0)-(held.has('left')?1:0),nx=player.position.x+side*dt*4,nz=player.position.z-forward*dt*4;
    const land=allowed(nx,nz);if(land){player.position.set(nx,land.y,nz);player.rotation.y=Math.atan2(side,-forward)}
   }
   if(follow&&player){controls.target.lerp(player.position,.05);camera.position.lerp(player.position.clone().add(V(10,12,16)),.025)}
   controls.update();
  }
  labels();updateTour();renderer.render(scene,camera);
 }

 function setQuality(v){
  low=v;renderer.shadowMap.enabled=!v;renderer.setPixelRatio(Math.min(devicePixelRatio,v?1:1.6));
  clouds.forEach((o,i)=>o.visible=!v||i%2===0);fireflies.forEach((o,i)=>{if(v&&i%2)o.obj.visible=false});
  sun.shadow.mapSize.set(v?1024:2048,v?1024:2048);
 }
 const resize=()=>{
  camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<600?55:innerWidth/innerHeight<1.1?50:38;
  camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
  if(innerWidth<600&&!low){setQuality(true);hooks.quality?.(true)}
  if(!selected&&!walk&&!cinema)setOverview(true);
 };
 addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{hidden=document.hidden});
 setQuality(low);setOverview(true);tick(performance.now());

 return {
  scene,camera,renderer,positions,animals,bridges,colliders,controls,walkable,allowed,
  focus,overview(){tour=null;hooks.tour?.(null);setOverview()},intro,skip,addPlayer,
  removePlayer(){if(player)scene.remove(player);player=null;route=[]},movePlayer:pathTo,findPath,
  setReduced(v){reduced=v;if(v){skip();if(player&&route.length)player.position.copy(route.at(-1));route=[];mascot.userData.limbs.forEach(l=>{l.rotation.x=0;l.rotation.z=0})}},
  setQuality,setClock(v){clockMode=v},setTheme(v){themeMode=v},startWalk,
  startTour(){walk=false;hooks.walk?.(false);tour={index:0,paused:false,arrived:time};tourGo()},
  tourAction(action){if(!tour)return;if(action==='stop'){stopTour();return}if(action==='pause')tour.paused=!tour.paused;else{tour.index=Math.max(0,Math.min(data.islands.length-1,tour.index+(action==='next'?1:-1)));tourGo()}hooks.tour?.({...tour,island:data.islands[tour.index]})},
  hold(dir,on){if(on)held.add(dir);else held.delete(dir)},clearBubble(){bubbleTarget=null},
  setStamps(stamps){labelEntries.forEach(e=>e.button.querySelector('.label-state').textContent=stamps.includes(e.pos.id)?'✓':'')},
  get debug(){return {fps,low,reduced,walk,cinema:!!cinema,tour,player:player?.position.toArray(),sceneHour,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,animals:animals.length}},
  dispose(){document.removeEventListener('click',skipClick,true);document.removeEventListener('pointerdown',skipOnPointer,true);disposed=true;renderer.dispose();controls.dispose();removeEventListener('resize',resize);removeEventListener('keydown',keydown);removeEventListener('keyup',keyup)}
 };
}
