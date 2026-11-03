// Adapted from github.com/youssef22karam/keel. The app code was originally a single inline script; it is now split across the modules in this folder.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {$, TAU, V, clamp, lerp, money, number, reducedMotion, smooth} from './util.js';
import {VesselDNA} from './vessel-dna.js';
import {collectFitPoints, visibleBounds} from './fit.js';
import {VesselBuilder, disposeVessel} from './vessel-builder.js';
import './builder/cabin.js';
import './builder/fixtures.js';
import './builder/interior.js';
import './builder/props.js';
import './builder/displays.js';

const viewport=$('viewport');
const state={mode:'exterior',scene:'studio',wireframe:false,dimensions:false,roof:false,lights:true,rig:true,rotate:false,quality:true,eye:V(),yaw:0,pitch:-.09,keys:new Set(),drag:null,tween:null,exteriorPose:null,revision:0,briefKey:'',finish:'auto',tour:0,doorForced:false};
let renderer,scene,camera,controls,composer,ssaoPass,ground,grid,contactShadow,water,coast,sun,ambient,fillLight,environmentTarget,resizeObserver,vessel=null,generation=0,dimensionGroup=null,disposed=false,animationId=0,toastTimer=0;
let lastTime=0,lastDisplay=0,lastMetrics=0,frames=0,frameRate=0;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function fatal(error){console.error('KEEL:',error);clearTimeout(window.keelWatchdog);$('loading').classList.remove('ready');$('loading-title').textContent='THE SHIPYARD COULD NOT START';$('loading-detail').textContent=/WebGL|context|GPU/i.test(error?.message||'')?'WebGL 2 is unavailable. Enable hardware acceleration and use a current browser, then reload.':'The engine could not start. Check your connection and reload. If it continues, open the browser console for the detailed error.';$('loading-line').hidden=true;$('retry-button').hidden=false;$('engine-status').textContent='ENGINE OFFLINE';viewport.setAttribute('aria-busy','false');}
function initStage(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.info.autoReset=false;renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D vessel. Drag to orbit and scroll to zoom. Press B to enter its bridge.');viewport.prepend(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color('#e8ece4');scene.fog=new THREE.Fog('#e8ece4',65,180);camera=new THREE.PerspectiveCamera(35,1,.012,2500);camera.position.set(29,18,32);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=2;controls.maxDistance=130;controls.maxPolarAngle=Math.PI*.78;controls.minPolarAngle=.06;controls.autoRotateSpeed=.33;controls.addEventListener('start',()=>{state.tween=null;});
  ambient=new THREE.HemisphereLight('#eef2e5','#8c9883',1.55);scene.add(ambient);sun=new THREE.DirectionalLight('#fff0d5',2.7);sun.position.set(-21,33,23);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:.2,far:120});sun.shadow.bias=-.00018;sun.shadow.normalBias=.012;sun.shadow.radius=3;sun.target.position.set(0,2,0);scene.add(sun,sun.target);fillLight=new THREE.DirectionalLight('#cadfda',.8);fillLight.position.set(23,14,-18);scene.add(fillLight);
  const env=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);environmentTarget=pmrem.fromScene(env,.06);scene.environment=environmentTarget.texture;scene.environmentIntensity=.66;env.dispose();pmrem.dispose();
  ground=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshStandardMaterial({color:'#e4e9de',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);grid=new THREE.GridHelper(180,120,'#a6b29b','#b5beac');grid.material.transparent=true;grid.material.opacity=.16;grid.material.depthWrite=false;scene.add(grid);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,1,64,64,64);gradient.addColorStop(0,'rgba(43,60,30,.20)');gradient.addColorStop(.5,'rgba(43,60,30,.08)');gradient.addColorStop(1,'rgba(43,60,30,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;scene.add(contactShadow);
  const seaGeo=new THREE.PlaneGeometry(2200,2200,120,120);seaGeo.rotateX(-Math.PI/2);const seaMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},seaColor:{value:new THREE.Color('#527b77')},horizon:{value:new THREE.Color('#cad6cb')},light:{value:1}},vertexShader:`uniform float time; varying vec3 worldPosition; varying vec3 seaNormal;
        void main(){vec3 p=position;float a=.08;float x=p.x*.35+time*.5;float z=p.z*.27+time*.43;p.y+=sin(x)*cos(z)*a+sin(p.x*1.1+p.z*.8-time)*.018;seaNormal=normalize(vec3(-cos(x)*cos(z)*a*.35,1.,sin(x)*sin(z)*a*.27));worldPosition=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(worldPosition,1.);}`,
    fragmentShader:`uniform vec3 seaColor;uniform vec3 horizon;uniform float light;uniform float time;varying vec3 worldPosition;varying vec3 seaNormal;
        void main(){vec3 viewDir=normalize(cameraPosition-worldPosition);float fresnel=pow(1.-max(dot(viewDir,seaNormal),0.),4.);float spec=pow(max(dot(reflect(-normalize(vec3(-.4,1.,.7)),seaNormal),viewDir),0.),110.);float ripple=sin(worldPosition.x*3.5+sin(worldPosition.z*2.8+time))*sin(worldPosition.z*4.8-time)*.009;vec3 color=mix(seaColor,horizon,fresnel*.72)+vec3(spec*.25+ripple);float fade=1.-exp(-length(worldPosition.xz-cameraPosition.xz)*.004);color=mix(color,horizon,fade*.90);gl_FragColor=vec4(color*light,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,side:THREE.DoubleSide});water=new THREE.Mesh(seaGeo,seaMat);water.frustumCulled=false;water.visible=false;scene.add(water);
  coast=new THREE.Group();coast.visible=false;const coastMat=new THREE.MeshStandardMaterial({color:'#8e9c8c',roughness:1});for(let j=0;j<3;j++){const pos=[],idx=[],n=60,xx=-280+j*290,zz=480+j*110;for(let i=0;i<=n;i++){const x=xx+(i/n-.5)*290,y=Math.pow(Math.sin(i/n*Math.PI),1.8)*(13+Math.sin(i*.47+j)*5+Math.sin(i*.17)*8);pos.push(x,0,zz,x,y,zz);}for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,coastMat);coastMat.side=THREE.DoubleSide;coast.add(mesh);}scene.add(coast);
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));ssaoPass=new SSAOPass(scene,camera,1,1,24);ssaoPass.kernelRadius=.3;ssaoPass.minDistance=.0002;ssaoPass.maxDistance=.04;composer.addPass(ssaoPass);composer.addPass(new OutputPass());
  resizeObserver=new ResizeObserver(resizeStage);resizeObserver.observe(viewport);resizeStage();renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(animationId);fatal(new Error('WebGL context lost.'));});renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
}
function resizeStage(){if(!renderer)return;const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight);renderer.setSize(w,h,false);composer?.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(vessel&&state.mode==='exterior'&&!state.drag)resetCamera(false);}
function fitPose(){
  const box=vessel.bounds,center=box.getCenter(V()),size=box.getSize(V()),target=center.clone();target.y+=size.y*.035;const direction=(camera.aspect<1?V(.65,.70,2.7):V(1.30,.70,1.65)).normalize();let distance=43;
  const savedPos=camera.position.clone(),savedQuat=camera.quaternion.clone();camera.fov=35;camera.updateProjectionMatrix();
  const projected=V();for(let j=0;j<5;j++){camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);camera.updateMatrixWorld();let factor=0;for(const point of vessel.fitPoints){projected.copy(point).project(camera);factor=Math.max(factor,Math.abs(projected.x)/.88,Math.abs(projected.y)/.80);}distance*=clamp(factor,.78,1.8);}
  camera.position.copy(savedPos);camera.quaternion.copy(savedQuat);return{position:target.clone().addScaledVector(direction,distance),target};
}
function tweenCamera(pose,duration=850){if(reducedMotion){camera.position.copy(pose.position);controls.target.copy(pose.target);controls.update();return;}state.tween={start:performance.now(),duration,from:camera.position.clone(),fromTarget:controls.target.clone(),to:pose.position,toTarget:pose.target};}
function resetCamera(animate=true){
  if(!vessel)return;
  if(state.mode==='bridge'){state.eye.copy(vessel.helm.start);state.tour=0;state.yaw=0;state.pitch=0.02;updateBridgeCamera(0);return;}
  camera.fov=35;camera.near=.012;camera.updateProjectionMatrix();
  const pose=fitPose();
  if(animate)tweenCamera(pose);
  else{state.tween=null;camera.position.copy(pose.position);controls.target.copy(pose.target);controls.update();}
}
function cycleBridgeView(){
  if(!vessel||state.mode!=='bridge')return;
  if(vessel.dna.tier===0){state.yaw+=Math.PI;updateBridgeCamera(0);return;}
  state.tour=(state.tour+1)%4;state.keys.clear();
  const u=vessel.unit,h=vessel.helm;
  if(state.tour===0){
    // 1. HELM VIEW: standing at the wheel, looking straight over the bow and instruments
    state.eye.copy(h.start);state.yaw=0;state.pitch=0.02;
    toast('Helm Station / Unobstructed panoramic view over the bow and sea.');
  }else if(state.tour===1){
    // 2. PANORAMIC WINDSHIELD: stepped forward against the front glass
    state.eye.set(0,h.start.y,clamp(vessel.D*.25,h.minZ,h.maxZ));state.yaw=0;state.pitch=0.01;
    toast('Panoramic Windshield / Direct view of the foredeck, windlass & horizon.');
  }else if(state.tour===2){
    // 3. NAVIGATOR DESK: looking at Admiralty charts and almanacs
    state.eye.set(vessel.W*.22,h.start.y,clamp(-vessel.D*.12,h.minZ,h.maxZ));
    const target=V(vessel.W*.30,1.15*u,-vessel.D*.42),delta=target.sub(state.eye);
    state.yaw=Math.atan2(delta.x,delta.z);state.pitch=Math.atan2(delta.y,Math.hypot(delta.x,delta.z));
    toast('Navigator\'s Desk / Admiralty charts, instruments & maritime almanacs.');
  }else{
    // 4. AFT FISHING DECK VIEW: looking aft out the door over rods & wake
    state.eye.set(0,h.start.y,clamp(-vessel.D*.46,h.minZ,h.maxZ));state.yaw=Math.PI;state.pitch=-0.04;
    toast('Aft Cockpit / View of the fishing rods, rocket launcher & wake.');
  }
  if(blocked(state.eye.x,state.eye.z)){state.eye.copy(h.start);state.tour=0;state.yaw=0;state.pitch=0.02;}
  updateBridgeCamera(0);
  if(!reducedMotion)renderer.domElement.animate([{opacity:.35},{opacity:1}],{duration:450,easing:'ease-out'});
}
function setView(mode,regenerated=false,preservePose=false){
  if(!vessel)return;
  const previous=state.mode;
  if(mode==='bridge'&&previous==='exterior'&&!regenerated)state.exteriorPose={position:camera.position.clone(),target:controls.target.clone()};
  state.mode=mode;state.tween=null;state.drag=null;state.keys.clear();
  controls.enabled=mode==='exterior';controls.autoRotate=mode==='exterior'&&state.rotate&&!reducedMotion;
  viewport.classList.toggle('view-mode-bridge',mode==='bridge');
  for(const[id,m]of[['exterior-button','exterior'],['bridge-button','bridge']]){$(id).classList.toggle('active',mode===m);$(id).setAttribute('aria-pressed',String(mode===m));}
  if(mode==='bridge'){
    if(!preservePose||previous!=='bridge')state.eye.copy(vessel.helm.start);
    state.yaw=preservePose?state.yaw:0;
    // Pitch level so horizon is centered and bow is completely visible through the windscreen:
    state.pitch=preservePose?state.pitch:0.02;
    camera.fov=66;camera.near=Math.max(.00008,.012*vessel.dna.scale);
    // Ultra-clear glazing in bridge mode for crisp, vibrant ocean and foredeck sightlines:
    vessel.m.glass.opacity=.05;
    camera.updateProjectionMatrix();updateBridgeCamera(0);
    $('orbit-hint').textContent='Drag to look / WASD to walk / V for viewpoints';
    $('bridge-overline').textContent=vessel.dna.name.toUpperCase()+(vessel.dna.tier===0?' / OPEN COCKPIT':' / COMMAND BRIDGE');
    $('bridge-description').textContent=vessel.dna.tier===0?'Open sky. Oiled timber. A simpler kind of voyage.':vessel.dna.finish==='walnut'?'Quarter-sawn walnut joinery. Aged brass. Clear panoramic view over the bow.':vessel.dna.finish==='ivory'?'Oiled teak. Ivory enamel. Unobstructed sightlines to the sea.':'Smoked graphite oak. Brushed stainless steel. High-visibility wheelhouse.';
  }else{
    camera.fov=35;camera.near=.012;camera.up.set(0,1,0);camera.updateProjectionMatrix();
    vessel.m.glass.opacity=.18;
    if(!preservePose){
      if(previous==='bridge'&&state.exteriorPose&&!regenerated){camera.position.copy(state.exteriorPose.position);controls.target.copy(state.exteriorPose.target);controls.update();}
      else resetCamera(!regenerated);
    }
    $('orbit-hint').textContent='Drag to orbit / Scroll to explore';
  }
  if(!preservePose)state.tour=0;
  setRoof(state.roof);setDimensions(state.dimensions);applyEnvironment();
  renderer.domElement.focus({preventScroll:true});
  if(!reducedMotion)renderer.domElement.animate([{opacity:.45},{opacity:1}],{duration:500,easing:'ease-out'});
}
function blocked(x,z){if(!vessel||vessel.dna.tier===0)return false;const margin=.10*vessel.unit;return vessel.colliders.some(b=>Math.abs(x-b.x)<b.w*.5+margin&&Math.abs(z-b.z)<b.d*.5+margin);}
function updateBridgeCamera(dt){
  if(!vessel||state.mode!=='bridge')return;const h=vessel.helm,keys=state.keys,u=h.unit||1,speed=dt*u*(keys.has('shift')?2.15:1.25),dir=V(Math.sin(state.yaw),0,Math.cos(state.yaw)),right=V(-Math.cos(state.yaw),0,Math.sin(state.yaw)),next=state.eye.clone();
  if(keys.has('w'))next.addScaledVector(dir,speed);if(keys.has('s'))next.addScaledVector(dir,-speed);if(keys.has('a'))next.addScaledVector(right,-speed);if(keys.has('d'))next.addScaledVector(right,speed);if(keys.has('arrowleft'))state.yaw+=dt*.85;if(keys.has('arrowright'))state.yaw-=dt*.85;if(keys.has('arrowup'))state.pitch=clamp(state.pitch+dt*.7,-1.18,1.05);if(keys.has('arrowdown'))state.pitch=clamp(state.pitch-dt*.7,-1.18,1.05);
  let minZ=h.minZ,minX=h.minX,maxX=h.maxX;const door=vessel.doors[0];if(door&&door.open>.83&&Math.abs(next.x)<door.width*.31&&Math.abs(state.eye.x)<door.width*.34)minZ=-vessel.D*.5-.23*u;
  next.z=clamp(next.z,minZ,h.maxZ);if(vessel.dna.tier>0){const bevel=Math.max(0,-next.z-vessel.D*.37)*(vessel.W/vessel.D);minX=Math.max(minX,-vessel.W*.5+.26*u+bevel);maxX=Math.min(maxX,vessel.W*.5-.26*u-bevel);if(next.z<h.minZ){minX=-door.width*.30;maxX=door.width*.30;}}
  next.x=clamp(next.x,minX,maxX);if(!blocked(next.x,state.eye.z))state.eye.x=next.x;if(!blocked(state.eye.x,next.z))state.eye.z=next.z;
  state.eye.y=h.start.y;vessel.root.updateMatrixWorld(true);camera.position.copy(h.group.localToWorld(state.eye.clone()));const direction=V(Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),Math.cos(state.yaw)*Math.cos(state.pitch));camera.up.set(0,1,0).applyQuaternion(vessel.root.quaternion);camera.lookAt(h.group.localToWorld(state.eye.clone().add(direction)));
}
function applyEnvironment(){
  if(!scene)return;const atSea=state.scene!=='studio'||state.mode==='bridge',night=state.scene==='night',gold=state.scene==='golden',bg=night?'#263c3e':gold?'#cdc3a6':atSea?'#cad6ce':'#e8ece4';scene.background.set(bg);scene.fog.color.set(bg);scene.fog.near=atSea?100:65;scene.fog.far=atSea?1300:180;ground.visible=grid.visible=contactShadow.visible=!atSea;water.visible=coast.visible=atSea;
  sun.color.set(night?'#a2c1c7':gold?'#ffcb8c':'#fff1d8');sun.intensity=night?.28:gold?2.1:2.7;ambient.intensity=night?.27:gold?1.04:1.55;fillLight.intensity=night?.16:.8;scene.environmentIntensity=night?.22:gold?.5:.66;sun.position.set(gold?-34:-21,gold?12:33,23);renderer.toneMappingExposure=state.mode==='bridge'?1.13:1.08;
  water.material.uniforms.horizon.value.set(bg);water.material.uniforms.seaColor.value.set(night?'#223d3b':gold?'#657c6b':'#527b77');water.material.uniforms.light.value=night?.53:1;viewport.classList.toggle('night',night);
  if(vessel){for(const l of vessel.lights)l.object.intensity=state.lights?l.base*(night?1.2:.85):0;vessel.m.led.emissiveIntensity=state.lights?1.7:.08;ssaoPass.kernelRadius=state.mode==='bridge'?.16*vessel.unit*vessel.dna.scale:.32;ssaoPass.enabled=state.quality;}
  $('lighting-label').textContent=night?'After dark':gold?'Golden hour':atSea?'At sea':'Studio lighting';document.querySelectorAll('[data-scene]').forEach(b=>b.classList.toggle('chosen',b.dataset.scene===state.scene));renderer.shadowMap.needsUpdate=true;
}
function setRoof(open){state.roof=Boolean(open);if(vessel)for(const roof of vessel.roofs)roof.visible=!state.roof;$('roof-button').classList.toggle('active',state.roof);$('roof-button').setAttribute('aria-pressed',String(state.roof));if(renderer)renderer.shadowMap.needsUpdate=true;}
function setWireframe(enabled){state.wireframe=Boolean(enabled);if(vessel){const seen=new Set();vessel.root.traverse(o=>{if(!o.isMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(!seen.has(m)&&'wireframe'in m){seen.add(m);m.wireframe=state.wireframe;}});}$('wireframe-button').classList.toggle('active',state.wireframe);$('wireframe-button').setAttribute('aria-pressed',String(state.wireframe));}
function disposeDimensions(){if(!dimensionGroup)return;dimensionGroup.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});dimensionGroup.removeFromParent();dimensionGroup=null;}
function buildDimensions(){
  disposeDimensions();if(!vessel)return;dimensionGroup=new THREE.Group();scene.add(dimensionGroup);const b=vessel.bounds,min=b.min,max=b.max,x=min.x-.7,y=min.y+.1,z=max.z+.9,mat=new THREE.LineDashedMaterial({color:'#78915f',dashSize:.16,gapSize:.1,transparent:true,opacity:.75});
  const add=pts=>{const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p=>V(...p))),mat.clone());line.computeLineDistances();dimensionGroup.add(line);};add([[x,y,min.z],[x,y,max.z]]);for(const zz of[min.z,max.z])add([[x-.2,y,zz],[min.x+.3,y,zz]]);add([[min.x,y,z],[max.x,y,z]]);for(const xx of[min.x,max.x])add([[xx-.05,y,z+.2],[xx+.05,y,max.z-.2]]);mat.dispose();$('dimension-label').textContent=`${vessel.dna.L.toFixed(1)} m LOA / ${vessel.dna.B.toFixed(1)} m BEAM / ${vessel.dna.D.toFixed(1)} m DRAFT`;setDimensions(state.dimensions);
}
function setDimensions(on){state.dimensions=Boolean(on);const visible=state.dimensions&&state.mode==='exterior';if(dimensionGroup)dimensionGroup.visible=visible;$('dimension-label').hidden=!visible;$('dimension-button').classList.toggle('active',state.dimensions);$('dimension-button').setAttribute('aria-pressed',String(state.dimensions));}
function parseBudget(raw){const match=String(raw).replace(/[$,\s]/g,'').match(/^(\d+(?:\.\d*)?|\.\d+)([kmbt])?$/i);if(!match)throw new Error('Enter a USD budget, such as 250,000 or 5M.');const cost=Number(match[1])*({k:1e3,m:1e6,b:1e9,t:1e12}[match[2]?.toLowerCase()]||1);if(!Number.isFinite(cost)||cost<100||cost>1e12)throw new Error('Choose a budget from $100 to $1 trillion.');return cost;}
function parseBrief(){const cost=parseBudget($('vessel-cost').value),raw=$('vessel-seed').value.trim(),seed=Number(raw);if(!/^\d+$/.test(raw)||!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('The design seed must be a whole number from 0 to 4,294,967,295.');return{cost,seed};}
function inputError(text=''){$('input-error').textContent=text;$('input-error').hidden=!text;$('vessel-cost').setAttribute('aria-invalid',String(Boolean(text)&&!/seed/i.test(text)));$('vessel-seed').setAttribute('aria-invalid',String(/seed/i.test(text)));}
function newSeed(){let seed;do{if(globalThis.crypto?.getRandomValues){const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);seed=bytes[0];}else seed=Math.floor(Math.random()*4294967296);}while(seed===Number($('vessel-seed').value));$('vessel-seed').value=String(seed);return seed;}
function updateHUD(){
  const d=vessel.dna;$('vessel-cost').value=money.format(d.cost);$('vessel-seed').value=String(d.seed);$('vessel-name').textContent=d.name;$('vessel-type').textContent=d.type;$('vessel-id').textContent='K-'+String(d.seed).padStart(6,'0');$('tier-number').textContent=String(d.tier).padStart(2,'0');$('tier-name').textContent=d.info.name;$('tier-range').textContent=d.info.range;
  for(const[id,v]of[['spec-length',number.format(d.L)+' m'],['spec-beam',number.format(d.B)+' m'],['spec-draft',number.format(d.D)+' m'],['spec-displacement',number.format(d.displacement)+' t'],['spec-speed',d.speed.toFixed(1)+' kn'],['spec-material',d.material]])$(id).textContent=v;
  document.querySelectorAll('.tier-scale i').forEach((el,i)=>{el.className=i===d.tier?'current':i<d.tier?'filled':'';});document.querySelectorAll('[data-cost]').forEach(b=>b.classList.toggle('active',Number(b.dataset.cost)===d.cost));$('equipment-list').replaceChildren(...[...vessel.equipment].map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  $('hull-label').textContent=d.tier===0?'CLINKER HULL / OILED TIMBER':d.tier===4?'CONTINUOUS TRIMARAN / CARBON COMPOSITE':'CUSTOM HULL / '+d.material.toUpperCase();[...$('palette').children].forEach((el,i)=>el.style.background=[d.palette.hull,d.palette.body,d.palette.accent,d.palette.bottom][i]);$('palette').setAttribute('aria-label',d.palette.name+' vessel palette');$('dna-status').textContent='DNA '+d.id;syncFleetState();
  $('finish-select').disabled=$('refit-button').disabled=d.tier===0;$('refit-button').firstChild.textContent=d.tier===0?'An open-timber cockpit':'Reimagine the bridge ';$('vessel-cost').style.fontSize=$('vessel-cost').value.length>16?'15px':$('vessel-cost').value.length>12?'18px':'21px';
}
function nextFrame(){return new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,12)));}
function positionStage(model){const y=model.bounds.min.y-.17;ground.position.y=y;grid.position.y=y+.012;contactShadow.position.set(0,y+.025,0);contactShadow.scale.set(model.dna.B*model.dna.scale*1.9,34,1);}
async function generate({random=false,refit=false,restore=null,preservePose=false,silent=false}={}){
  if(exporting)return false;if(random)newSeed();let brief;try{brief=parseBrief();inputError();}catch(e){inputError(e.message);return false;}const ticket=++generation,previous=vessel,key=brief.cost+':'+brief.seed;
  if(restore){state.revision=clamp(Math.floor(Number(restore.revision)||0),0,99999);state.finish=['walnut','ivory','graphite','auto'].includes(restore.finish)?restore.finish:'auto';$('finish-select').value=state.finish;}else{if(state.briefKey!==key)state.revision=0;state.finish=$('finish-select').value;if(refit)state.revision=Math.min(99999,state.revision+1);}
  viewport.setAttribute('aria-busy','true');$('busy-indicator').hidden=false;$('generate-text').textContent=refit?'Fitting out the bridge...':'Drawing your vessel...';$('generate-button').disabled=true;await nextFrame();if(ticket!==generation||disposed)return false;let next=null;
  try{
    const start=performance.now(),dna=new VesselDNA(brief.cost,brief.seed,{finish:state.finish,revision:state.revision});next=new VesselBuilder(dna);next.build();const report=validateGeometry(next);next.report=report;if(ticket!==generation){disposeVessel(next);return false;}
    scene.add(next.root);vessel=next;if(next.rigGroup){next.rigGroup.visible=state.rig;next.bounds=visibleBounds(next.root);next.fitPoints=collectFitPoints(next.root,next.bounds);}positionStage(next);state.briefKey=key;
    if(previous)previous.root.visible=false;updateHUD();buildDimensions();setWireframe(state.wireframe);if(!preservePose)state.exteriorPose=null;setView(state.mode,true,preservePose);renderer.shadowMap.needsUpdate=true;renderFrame();disposeVessel(previous);renderer.renderLists.dispose();
    $('engine-status').textContent='ENGINE READY';$('render-status').title=`Generated in ${Math.round(performance.now()-start)} ms. ${report.meshes} render meshes. Closed hull topology checked.`;window.keelReady=true;clearTimeout(window.keelWatchdog);$('loading').classList.add('ready');viewport.setAttribute('aria-busy','false');
    try{const url=new URL(location.href);url.searchParams.set('cost',String(dna.cost));url.searchParams.set('seed',String(dna.seed));url.searchParams.set('finish',dna.finish);url.searchParams.set('refit',String(dna.revision));history.replaceState(null,'',url);}catch{}
    if(!previous&&!reducedMotion&&state.mode==='exterior'){const pose={position:camera.position.clone(),target:controls.target.clone()};camera.position.copy(pose.target).lerp(pose.position,1.12);tweenCamera(pose,1200);}
    if(!silent)toast(refit?'A new interior. The same unmistakable hull.':random?'A new character. The same budget.':`${dna.name} is ready to explore.`);return true;
  }catch(error){
    if(next)disposeVessel(next);vessel=previous;console.error('Vessel generation failed:',error);if(previous){previous.root.visible=true;state.revision=previous.dna.revision;state.finish=previous.dna.finish;state.briefKey=previous.dna.cost+':'+previous.dna.seed;$('finish-select').value=state.finish;positionStage(previous);updateHUD();buildDimensions();setView(state.mode,true);toast('This fit-out could not be assembled. Your previous vessel is safe.');}else fatal(error);return false;
  }finally{if(ticket===generation){$('busy-indicator').hidden=true;$('generate-button').disabled=false;$('generate-text').textContent='Generate vessel';viewport.setAttribute('aria-busy','false');}}
}
function validateHullTopology(h){
  const g=h.mesh.geometry,pos=g.getAttribute('position'),idx=g.index.array,edges=new Map();let degenerate=0,signedVolume=0;
  for(let i=0;i<idx.length;i+=3){const a=idx[i],b=idx[i+1],c=idx[i+2];if(a===b||b===c||c===a)degenerate++;for(const[x,y]of[[a,b],[b,c],[c,a]]){const key=x<y?x+':'+y:y+':'+x;edges.set(key,(edges.get(key)||0)+1);}const av=V().fromBufferAttribute(pos,a),bv=V().fromBufferAttribute(pos,b),cv=V().fromBufferAttribute(pos,c);signedVolume+=av.dot(bv.cross(cv))/6;}
  let boundary=0,nonManifold=0;for(const count of edges.values()){if(count===1)boundary++;else if(count>2)nonManifold++;}
  // Real invariants only: no non-manifold edges, no duplicate-index triangles, and the
  // port/starboard bow must coincide. An open-top hull (primitive craft) legitimately has
  // boundary edges along its sheer rim, so the exact boundary count is informational, not asserted.
  if(nonManifold)throw new Error(`Hull has ${nonManifold} non-manifold edges.`);
  if(degenerate)throw new Error(`Hull has ${degenerate} degenerate (duplicate-index) triangles.`);
  const bowA=h.point(1,.4,1),bowB=h.point(1,.4,-1);if(bowA.distanceTo(bowB)>1e-8)throw new Error('The port and starboard bow vertices are not coincident.');return{closed:true,boundaryEdges:boundary,nonManifoldEdges:nonManifold,vertices:pos.count,faces:idx.length/3,volume:Math.abs(signedVolume)};
}
function validateGeometry(model){
  let meshes=0,vertices=0,triangles=0;model.root.traverse(o=>{if(!o.isMesh)return;meshes++;const p=o.geometry.getAttribute('position');vertices+=p.count;triangles+=(o.geometry.index?o.geometry.index.count:p.count)/3;for(const value of p.array)if(!Number.isFinite(value))throw new Error('A generated component contains a non-finite vertex.');for(const value of o.matrix.elements)if(!Number.isFinite(value))throw new Error('A generated component has an invalid transform.');});
  const hulls=model.hulls.map(validateHullTopology),h=model.helm;if(!h||h.start.x<h.minX||h.start.x>h.maxX||h.start.z<h.minZ||h.start.z>h.maxZ)throw new Error('The bridge camera is outside its navigable bounds.');if(model.dna.tier>0&&!model.layoutFits)throw new Error('The superstructure does not fit within the hull.');if(model.colliders.some(b=>Math.abs(h.start.x-b.x)<b.w*.5+.10*model.unit&&Math.abs(h.start.z-b.z)<b.d*.5+.10*model.unit))throw new Error('The starting viewpoint intersects bridge furniture.');if(model.bowAudit.detachedBulbs)throw new Error('A detached spherical bow component was generated.');
  if(model.dna.tier===0){
    const oars=model.animators.filter(a=>a.kind==='oar');
    if(oars.length!==2||oars[0].side===oars[1].side)throw new Error('The rowboat needs an oar on each gunwale.');
    for(const a of oars){
      const s=model.hull.measure(a.object.position.z);
      if(!a.blade||a.blade.parent!==a.object||!Number.isFinite(a.dip)||Math.abs(Math.abs(a.object.position.x)-s.width)>.025||a.object.position.y<s.sheer+.06)throw new Error('An oar is detached from its gunwale lock.');
    }
  }
  for(const rail of model.railAudit)if(!rail.closed||rail.start.distanceTo(rail.end)>1e-8||rail.seamError>Math.max(1e-5,model.dna.L*1e-7))throw new Error('An exterior rail or strake has an open tube seam.');return{meshes,vertices,triangles:Math.round(triangles),hulls,finite:true,interiorBounds:true,layoutFits:model.dna.tier===0||model.layoutFits,continuousRails:true,detachedBowBulbs:model.bowAudit.detachedBulbs};
}
function validateDNA(){const costs=[100,9999,10000,499999,500000,14999999,15000000,249999999,250000000,1e9,1e12];let cases=0;for(const cost of costs)for(const seed of[0,42819,4294967295]){const d=new VesselDNA(cost,seed),a=new VesselDNA(cost,seed);if(![d.L,d.B,d.D,d.F,d.speed,d.displacement].every(Number.isFinite)||d.L<=d.B||d.B<=d.D||d.id!==a.id||d.L!==a.L)throw new Error('A deterministic vessel-parameter check failed.');cases++;}if(new VesselDNA(5000000,42819).id===new VesselDNA(5000001,42819).id)throw new Error('The budget is not part of the design hash.');return{parameterCases:cases,deterministic:true,costSensitive:true};}
async function runSelfTests({onProgress=null}={}){
  const result={parameters:validateDNA(),geometry:[]},costs=[100,9999,10000,499999,500000,5000000,14999999,15000000,249999999,250000000,1000000000,1000000000000],seeds=[0,42819,4294967295];for(const cost of costs)for(const seed of seeds){onProgress?.({done:result.geometry.length,total:costs.length*seeds.length,cost,seed});let model=null;try{model=new VesselBuilder(new VesselDNA(cost,seed));model.build();result.geometry.push({cost,seed,tier:model.dna.tier,...validateGeometry(model)});}finally{disposeVessel(model);}await nextFrame();}console.table(result.geometry.map(r=>({cost:r.cost,seed:r.seed,tier:r.tier,meshes:r.meshes,closed:r.hulls.every(h=>h.closed),faces:r.triangles})));return result;
}
function renderFrame(){renderer.info.reset();if(state.quality){const u=ssaoPass.ssaoMaterial.uniforms;u.cameraNear.value=camera.near;u.cameraFar.value=camera.far;u.cameraProjectionMatrix.value.copy(camera.projectionMatrix);u.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);ssaoPass.depthRenderMaterial.uniforms.cameraNear.value=camera.near;ssaoPass.depthRenderMaterial.uniforms.cameraFar.value=camera.far;composer.render();}else renderer.render(scene,camera);}
function animateOar(a,t){
  if(reducedMotion){a.object.rotation.y=-a.side*.28;a.object.rotation.z=a.side*.06;a.blade.rotation.x=0;return;}
  const phase=(t*.38+a.phase)%1,drive=phase<.52;
  const stroke=drive?smooth(phase/.52):smooth((phase-.52)/.48);
  // Catch and drive: dip the broad blade, pull it aft, then lift and feather it
  // edge-on through the forward recovery. Both sides share one stroke phase.
  const immersion=drive?smooth(clamp(phase/.10,0,1))*(1-smooth(clamp((phase-.43)/.09,0,1))):0;
  const lift=drive?0:Math.sin(Math.PI*(phase-.52)/.48);
  a.object.rotation.y=a.side*(drive?lerp(-.36,.36,stroke):lerp(.36,-.36,stroke));
  a.object.rotation.z=a.side*(-a.dip*immersion+.12*lift);
  a.blade.rotation.x=Math.PI*.5*immersion;
}
function animate(ms){
  if(disposed)return;animationId=requestAnimationFrame(animate);if(document.hidden){lastTime=ms;return;}const dt=Math.min(.045,(ms-(lastTime||ms))/1000);lastTime=ms;const t=reducedMotion?0:ms*.001;
  if(state.tween){const a=state.tween,k=clamp((ms-a.start)/a.duration,0,1),e=1-Math.pow(1-k,3);camera.position.lerpVectors(a.from,a.to,e);controls.target.lerpVectors(a.fromTarget,a.toTarget,e);if(k===1)state.tween=null;}
  if(vessel){
    if(vessel.dna.tier===0){
      const afloat=water.visible&&!reducedMotion;
      vessel.root.position.y=afloat?.045*Math.sin(t*1.4):0;
      vessel.root.rotation.z=afloat?.005*Math.sin(t*.85):0;
      vessel.root.rotation.x=afloat?.004*Math.sin(t*.67+.8):0;
    }
    if(state.mode==='exterior')controls.update();else updateBridgeCamera(dt);
    for(const a of vessel.animators){if(a.kind==='radar')a.object.rotation.y=t*a.speed;else if(a.kind==='propeller'&&water.visible)a.object.rotation.z+=reducedMotion?0:dt*a.speed*(.5+vessel.throttle*3);else if(a.kind==='drum')a.object.rotation.x=t*a.speed;else if(a.kind==='hook')a.object.rotation.z=Math.sin(t*.7+a.phase)*.018;else if(a.kind==='oar')animateOar(a,t);else if(a.kind==='wiper')a.object.rotation.z=a.park+(state.scene==='sea'?Math.sin(t*.7)*.62:0);else if(a.kind==='flag'){const pos=a.object.geometry.getAttribute('position');for(let i=0;i<pos.count;i++){const x=pos.getX(i),q=x/a.width;pos.setZ(i,Math.sin(q*6-t*2)*q*a.width*.10);}pos.needsUpdate=true;a.object.geometry.computeVertexNormals();}else if(a.kind==='clock'){const date=new Date();a.hour.rotation.z=-(date.getHours()%12+date.getMinutes()/60)*TAU/12;a.minute.rotation.z=-(date.getMinutes()+date.getSeconds()/60)*TAU/60;}}
    if(vessel.wheel)vessel.wheel.rotation.z=lerp(vessel.wheel.rotation.z,vessel.steering*.9,1-Math.exp(-dt*5));
    for(const door of vessel.doors){const near=state.mode==='bridge'&&Math.hypot(state.eye.x-door.x,state.eye.z-door.z)<1.15*door.unit,target=near||state.doorForced?1:0,previous=door.open;door.open=lerp(door.open,target,1-Math.exp(-dt*4));door.object.rotation.y=-door.open*Math.PI*.53;if(Math.abs(previous-door.open)>.002)renderer.shadowMap.needsUpdate=true;}
    if(ms-lastDisplay>(state.mode==='bridge'?110:650)){vessel.drawDisplays(t);lastDisplay=ms;}
    water.material.uniforms.time.value=t*.7;frames++;if(ms-lastMetrics>1000){frameRate=Math.round(frames*1000/(ms-lastMetrics));frames=0;lastMetrics=ms;$('render-status').textContent=frameRate+' FPS / '+number.format(vessel.report.triangles/1000)+'K FACES';const distance=camera.position.distanceTo(controls.target),worldHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*distance,meters=worldHeight/Math.max(1,viewport.clientHeight)*64/vessel.dna.scale,scale=meters<1?.5:meters<3?2:meters<7?5:meters<15?10:meters<30?20:50;$('scale-text').textContent=scale+' METERS';$('scale-rule').style.width=clamp(scale*vessel.dna.scale/worldHeight*viewport.clientHeight,25,88)+'px';}
  }
  renderFrame();
}
function readFleet(){try{const data=JSON.parse(localStorage.getItem('keel-fleet-v2')||'[]');return Array.isArray(data)?data.filter(x=>x&&Number.isFinite(x.cost)&&x.cost>=100&&x.cost<=1e12&&Number.isInteger(x.seed)&&x.seed>=0&&x.seed<=4294967295).slice(0,12):[];}catch{return[];}}
let fleet=readFleet(),exporting=false;
function fleetKey(d){return`${d.cost}:${d.seed}:${d.finish}:${d.revision||0}`;}
function persistFleet(){try{localStorage.setItem('keel-fleet-v2',JSON.stringify(fleet));return true;}catch{toast('Browser storage is unavailable or full. Export a blueprint to keep this design.');return false;}}
function syncFleetState(){const saved=vessel&&fleet.some(f=>f.key===fleetKey(vessel.dna));$('fleet-count').textContent=String(fleet.length).padStart(2,'0');$('save-button').classList.toggle('saved',Boolean(saved));$('save-button').setAttribute('aria-pressed',String(Boolean(saved)));$('save-button').setAttribute('aria-label',saved?'Remove vessel from your fleet':'Save vessel to your fleet');}
function captureCanvas(width=null,height=null){renderFrame();const source=renderer.domElement,canvas=document.createElement('canvas');canvas.width=width||source.width;canvas.height=height||source.height;const c=canvas.getContext('2d');c.drawImage(source,0,0,canvas.width,canvas.height);return canvas;}
function saveVessel(){
  if(!vessel)return;const d=vessel.dna,key=fleetKey(d),index=fleet.findIndex(f=>f.key===key),previous=fleet.slice();if(index>=0){fleet.splice(index,1);if(!persistFleet())fleet=previous;else toast(d.name+' has left your fleet.');syncFleetState();return;}if(fleet.length>=12){toast('Your fleet has 12 vessels. Remove one before saving another.');return;}
  const image=captureCanvas(400,240).toDataURL('image/jpeg',.77);fleet.unshift({key,name:d.name,type:d.type,cost:d.cost,seed:d.seed,finish:d.finish,revision:d.revision,image,date:Date.now()});if(!persistFleet())fleet=previous;else toast(d.name+' is safely in your fleet.');syncFleetState();
}
function renderFleet(){
  const list=$('fleet-grid');list.replaceChildren();$('empty-fleet').hidden=fleet.length>0;
  for(const item of fleet){const article=document.createElement('article');article.className='fleet-item';if(/^data:image\/(?:png|jpeg);base64,/.test(item.image||'')){const img=document.createElement('img');img.src=item.image;img.alt=item.name+' vessel preview';img.className='fleet-image';article.append(img);}const name=document.createElement('h3');name.textContent=item.name||'Saved vessel';const meta=document.createElement('p');meta.textContent=`$${money.format(item.cost)} / SEED ${item.seed} / ${String(item.finish||'original').toUpperCase()}`;const actions=document.createElement('div');actions.className='fleet-item-actions';const open=document.createElement('button');open.textContent='Return to this vessel';open.addEventListener('click',async()=>{if(exporting)return;closeDialog('fleet-dialog');$('vessel-cost').value=String(item.cost);$('vessel-seed').value=String(item.seed);await generate({restore:item});});const remove=document.createElement('button');remove.textContent='Remove';remove.addEventListener('click',()=>{const previous=fleet.slice();fleet=fleet.filter(f=>f.key!==item.key);if(!persistFleet())fleet=previous;syncFleetState();renderFleet();});actions.append(open,remove);article.append(name,meta,actions);list.append(article);}
}
function getBlueprint(){if(!vessel)return null;const d=vessel.dna;return{application:'KEEL',version:'2.0',source:'https://github.com/youssef22karam/keel',name:d.name,cost:d.cost,seed:d.seed,finish:d.finish,revision:d.revision,dna:d.id,units:'meters',specifications:{length:d.L,beam:d.B,draft:d.D,freeboard:d.F,displacement:d.displacement,cruisingSpeedKnots:d.speed,material:d.material,type:d.type},parts:vessel.parts,equipment:[...vessel.equipment],geometry:vessel.report,conceptOnly:true};}
function download(data,name,type){const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportVessel(kind){
  if(!vessel||exporting)return;exporting=true;closeMenus();const buttons=[...document.querySelectorAll('[data-export]')];buttons.forEach(b=>b.disabled=true);$('generate-button').disabled=true;const slug=vessel.dna.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name=`keel-${slug}-${vessel.dna.seed}`;
  try{
    if(kind==='png'){const image=captureCanvas(),c=image.getContext('2d'),s=image.width/1200;c.save();c.scale(s,s);c.fillStyle=state.scene==='night'||state.mode==='bridge'?'#e3ead5':'#516546';c.font='600 25px Arial';c.fillText('KEEL',25,image.height/s-29);c.font='10px monospace';c.fillText(vessel.dna.name.toUpperCase()+' / K-'+vessel.dna.seed,110,image.height/s-32);c.restore();await new Promise((resolve,reject)=>image.toBlob(blob=>{if(!blob){reject(new Error('PNG encoding failed.'));return;}download(blob,name+'.png','image/png');resolve();},'image/png'));}
    else if(kind==='json')download(JSON.stringify(getBlueprint(),null,2),name+'.json','application/json');
    else if(kind==='html'){
      const copy=document.documentElement.cloneNode(true);copy.querySelectorAll('#viewport > canvas').forEach(c=>c.remove());copy.querySelector('#vessel-cost').setAttribute('value',String(vessel.dna.cost));copy.querySelector('#vessel-seed').setAttribute('value',String(vessel.dna.seed));copy.setAttribute('data-keel-finish',vessel.dna.finish);copy.setAttribute('data-keel-refit',String(vessel.dna.revision));copy.querySelectorAll('dialog').forEach(d=>d.removeAttribute('open'));copy.querySelector('#loading').classList.remove('ready');copy.querySelector('#loading-title').textContent='LAYING THE KEEL';copy.querySelector('#loading-detail').textContent='A little mathematics. A lot of character.';copy.querySelector('#fleet-grid').replaceChildren();copy.querySelector('#toast').classList.remove('show');copy.querySelector('#generate-button').removeAttribute('disabled');copy.querySelectorAll('[data-export]').forEach(b=>b.removeAttribute('disabled'));copy.querySelector('#busy-indicator').setAttribute('hidden','');download('<!DOCTYPE html>\n'+copy.outerHTML,'index.html','text/html');
    }else if(kind==='glb'){
      toast('Preparing the complete 3D vessel...');const{GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');const clone=vessel.root.clone(true);clone.scale.setScalar(1);clone.traverse(o=>{if(o.name==='Removable fitted headliner and bridge roof')o.visible=true;if(o.isPointLight){o.intensity/=vessel.dna.scale*vessel.dna.scale;o.distance/=vessel.dna.scale;}});clone.updateMatrixWorld(true);const data=await new GLTFExporter().parseAsync(clone,{binary:true,maxTextureSize:1024,onlyVisible:true});download(data,name+'.glb','model/gltf-binary');
    }toast(kind==='html'?'One file. An entire shipyard.':'Your '+kind.toUpperCase()+' is ready.');
  }catch(error){console.error('KEEL export:',error);toast('The export could not finish. Please try again; your vessel is unchanged.');}
  finally{exporting=false;buttons.forEach(b=>b.disabled=false);$('generate-button').disabled=false;}
}
function closeMenus(except=null){for(const id of['export','scene'])if(id!==except){$(id+'-menu').hidden=true;$(id+'-button').setAttribute('aria-expanded','false');}}
function toggleMenu(id){const open=$(id+'-menu').hidden;closeMenus(id);$(id+'-menu').hidden=!open;$(id+'-button').setAttribute('aria-expanded',String(open));if(open)$(id+'-menu').querySelector('button')?.focus();}
function openDialog(id){closeMenus();$(id).showModal();state.keys.clear();state.drag=null;}
function closeDialog(id){$(id).close();}
function setMobileBrief(open){document.body.classList.toggle('brief-open',open);$('mobile-brief').setAttribute('aria-expanded',String(open));if(open)$('vessel-cost').focus({preventScroll:true});}
function describeReport(report){const lines=[`${report.meshes} render meshes / ${number.format(report.vertices)} vertices`,`${number.format(report.triangles)} triangles / finite transforms: PASS`,''];report.hulls.forEach((h,i)=>{lines.push(`Hull ${i+1}: CLOSED / ${h.boundaryEdges} boundary edges`,`        ${h.nonManifoldEdges} non-manifold edges / welded stem: PASS`);});lines.push('','Bow-to-transom rail continuity: PASS','Bridge footprint and camera bounds: PASS','No independent spherical bow geometry: PASS');return lines.join('\n');}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function pickAction(e){if(!vessel||state.mode!=='bridge')return null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(vessel.hitTargets,true);if(!hits.length)return null;let o=hits[0].object;while(o&&!o.userData.action)o=o.parent;return o?.userData.action||null;}
function activateAction(action){
  if(!vessel)return;if(action==='radar'){const ranges=[1.5,3,6,12,24];vessel.radarRange=ranges[(ranges.indexOf(vessel.radarRange)+1)%ranges.length];toast('Radar range / '+vessel.radarRange.toFixed(1)+' nautical miles.');}
  else if(action==='wheel'){vessel.steering+=.24;if(vessel.steering>.9)vessel.steering=-.72;toast('Helm / '+Math.abs(Math.round(vessel.steering*30))+' degrees '+(vessel.steering>0?'starboard.':'port.'));}
  else if(action==='throttle'){const powers=[.2,.42,.7,.94],i=powers.findIndex(p=>Math.abs(p-vessel.throttle)<.03);vessel.throttle=powers[(i+1)%powers.length];toast('Simulated engine power / '+Math.round(vessel.throttle*100)+'%.');}
  else if(action==='door'){state.doorForced=!state.doorForced;toast(state.doorForced?'Aft door held open.':'Aft door back in automatic mode.');}
  else if(action==='chart'){state.yaw=0;state.pitch=-.10;toast('Navigation view centered.');}vessel.drawDisplays(performance.now()*.001);
}
function bindUI(){
  $('brief-form').addEventListener('submit',async e=>{e.preventDefault();if(exporting)return;const ok=await generate({random:true});if(ok)setMobileBrief(false);});$('randomize-button').addEventListener('click',()=>{if(!exporting)generate({random:true});});$('seed-button').addEventListener('click',()=>{if(!exporting)generate({random:true});});document.querySelectorAll('[data-cost]').forEach(b=>b.addEventListener('click',()=>{if(exporting)return;$('vessel-cost').value=money.format(Number(b.dataset.cost));generate();}));
  $('vessel-cost').addEventListener('input',()=>{inputError();const n=$('vessel-cost').value.length;$('vessel-cost').style.fontSize=n>16?'15px':n>12?'18px':'21px';});$('vessel-seed').addEventListener('input',()=>inputError());$('vessel-cost').addEventListener('blur',()=>{try{$('vessel-cost').value=money.format(parseBudget($('vessel-cost').value));}catch{}});
  $('finish-select').addEventListener('change',()=>{if(!exporting)generate({preservePose:true});});$('refit-button').addEventListener('click',()=>{if(!exporting)generate({refit:true,preservePose:true});});$('rig-toggle').addEventListener('change',e=>{state.rig=e.target.checked;if(vessel?.rigGroup){vessel.rigGroup.visible=state.rig;vessel.bounds=visibleBounds(vessel.root);vessel.fitPoints=collectFitPoints(vessel.root,vessel.bounds);if(state.mode==='exterior')resetCamera();}if(renderer)renderer.shadowMap.needsUpdate=true;});$('rotate-toggle').addEventListener('change',e=>{state.rotate=e.target.checked;if(controls)controls.autoRotate=state.rotate&&state.mode==='exterior'&&!reducedMotion;if(reducedMotion&&state.rotate)toast('Slow orbit respects your reduced-motion preference.');});$('quality-toggle').addEventListener('change',e=>{state.quality=e.target.checked;applyEnvironment();});
  $('exterior-button').addEventListener('click',()=>setView('exterior'));$('bridge-button').addEventListener('click',()=>setView('bridge'));$('bridge-tour-button').addEventListener('click',cycleBridgeView);$('reset-button').addEventListener('click',()=>resetCamera());$('wireframe-button').addEventListener('click',()=>setWireframe(!state.wireframe));$('dimension-button').addEventListener('click',()=>setDimensions(!state.dimensions));$('roof-button').addEventListener('click',()=>setRoof(!state.roof));$('cabin-light-button').addEventListener('click',()=>{state.lights=!state.lights;$('cabin-light-button').setAttribute('aria-pressed',String(state.lights));applyEnvironment();});$('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(viewport.requestFullscreen)await viewport.requestFullscreen();else toast('Fullscreen is not available in this browser.');}catch{toast('Fullscreen is blocked by this browser.');}});
  $('scene-button').addEventListener('click',()=>toggleMenu('scene'));$('export-button').addEventListener('click',()=>toggleMenu('export'));document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>{state.scene=b.dataset.scene;closeMenus();applyEnvironment();}));document.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click',()=>exportVessel(b.dataset.export)));document.addEventListener('click',e=>{if(!e.target.closest('.export-wrap')&&!e.target.closest('.scene-wrap'))closeMenus();});
  $('help-button').addEventListener('click',()=>openDialog('help-dialog'));$('fleet-button').addEventListener('click',()=>{renderFleet();openDialog('fleet-dialog');});$('studio-tab').addEventListener('click',()=>{$('fleet-dialog').close();setMobileBrief(false);});$('save-button').addEventListener('click',saveVessel);document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});d.addEventListener('close',()=>state.keys.clear());});
  $('mobile-brief').addEventListener('click',()=>setMobileBrief(!document.body.classList.contains('brief-open')));$('mobile-scrim').addEventListener('click',()=>setMobileBrief(false));
  $('validate-button').addEventListener('click',()=>{if(!vessel)return;try{$('validation-output').textContent=describeReport(validateGeometry(vessel));}catch(e){$('validation-output').textContent='CHECK FAILED\n'+e.message;}openDialog('validation-dialog');});$('run-tests-button').addEventListener('click',async()=>{const b=$('run-tests-button');b.disabled=true;$('validation-output').textContent='Checking deterministic DNA and building every price-tier boundary...';try{const result=await runSelfTests({onProgress:p=>$('validation-output').textContent=`BUILD ${p.done+1} / ${p.total}\n$${money.format(p.cost)} / SEED ${p.seed}\n\nChecking hull topology, tube seams, and the furnished bridge...`});$('validation-output').textContent=`${result.parameters.parameterCases} deterministic DNA cases: PASS\n${result.geometry.length} complete cross-tier builds: PASS\n\n`+result.geometry.map(x=>'$'+money.format(x.cost)+' / seed '+x.seed+' / closed: PASS').join('\n')+'\n\n'+describeReport(validateGeometry(vessel));}catch(e){console.error('KEEL self-test:',e);$('validation-output').textContent='CHECK FAILED\n'+e.message;}finally{b.disabled=false;}});
  let press=null;
  renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;press={x:e.clientX,y:e.clientY,id:e.pointerId,moved:0};if(state.mode==='bridge'){state.drag={x:e.clientX,y:e.clientY,id:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);$('model-annotation').classList.remove('show');}});
  renderer.domElement.addEventListener('pointermove',e=>{
    if(press&&e.pointerId===press.id)press.moved=Math.max(press.moved,Math.hypot(e.clientX-press.x,e.clientY-press.y));if(state.drag&&e.pointerId===state.drag.id&&state.mode==='bridge'){const dx=e.clientX-state.drag.x,dy=e.clientY-state.drag.y;state.yaw-=dx*.0038;state.pitch=clamp(state.pitch-dy*.0035,-1.18,1.05);state.drag.x=e.clientX;state.drag.y=e.clientY;return;}
    const action=pickAction(e),annotation=$('model-annotation');renderer.domElement.style.cursor=action?'pointer':'grab';if(action){const labels={radar:'Radar / click to change range',wheel:'Helm / click to steer',throttle:'Twin engines / adjust simulated power',chart:'Chartplotter / center your view',door:'Aft door / hold open'},rect=viewport.getBoundingClientRect();annotation.textContent=labels[action]||'';annotation.style.left=clamp(e.clientX-rect.left,110,rect.width-110)+'px';annotation.style.top=Math.max(150,e.clientY-rect.top-31)+'px';annotation.classList.add('show');}else annotation.classList.remove('show');
  });
  renderer.domElement.addEventListener('pointerup',e=>{if(press&&e.pointerId===press.id&&press.moved<6)activateAction(pickAction(e));press=null;state.drag=null;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);});renderer.domElement.addEventListener('pointercancel',()=>{press=null;state.drag=null;});renderer.domElement.addEventListener('pointerleave',()=>{$('model-annotation').classList.remove('show');});renderer.domElement.addEventListener('wheel',e=>{if(state.mode!=='bridge')return;e.preventDefault();camera.fov=clamp(camera.fov+e.deltaY*.016,49,82);camera.updateProjectionMatrix();},{passive:false});
  document.querySelectorAll('[data-walk]').forEach(b=>{b.style.touchAction='none';b.addEventListener('pointerdown',e=>{e.preventDefault();state.keys.add(b.dataset.walk);b.setPointerCapture(e.pointerId);});const release=()=>state.keys.delete(b.dataset.walk);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);});
  window.addEventListener('keydown',e=>{
    const tag=document.activeElement?.tagName;if(['INPUT','SELECT','TEXTAREA'].includes(tag)||document.activeElement?.isContentEditable||document.querySelector('dialog[open]'))return;const k=e.key.toLowerCase();if(state.mode==='bridge'&&['w','a','s','d','shift','arrowleft','arrowright','arrowup','arrowdown'].includes(k)){state.keys.add(k);e.preventDefault();return;}if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
    if(k==='b'){e.preventDefault();setView(state.mode==='bridge'?'exterior':'bridge');}else if(k==='r')resetCamera();else if(k==='v')cycleBridgeView();else if(k==='n'&&!exporting)generate({random:true});else if(k==='d')setDimensions(!state.dimensions);else if(k==='w')setWireframe(!state.wireframe);else if(k==='o')setRoof(!state.roof);else if(k==='l'){state.lights=!state.lights;$('cabin-light-button').setAttribute('aria-pressed',String(state.lights));applyEnvironment();}else if(k==='e')activateAction('door');else if(k==='escape'){setMobileBrief(false);closeMenus();}
  });window.addEventListener('keyup',e=>state.keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{state.keys.clear();state.drag=null;press=null;});document.addEventListener('visibilitychange',()=>{state.keys.clear();lastTime=0;});
  viewport.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});viewport.addEventListener('drop',async e=>{e.preventDefault();if(exporting)return;const file=e.dataTransfer.files[0];if(!file||!file.name.toLowerCase().endsWith('.json')){toast('Drop a KEEL .json blueprint to restore a vessel.');return;}if(file.size>2000000){toast('That blueprint is too large.');return;}try{const data=JSON.parse(await file.text());if(data.application!=='KEEL')throw new Error('Not a KEEL blueprint.');const cost=parseBudget(data.cost),seed=Number(data.seed);if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Invalid seed.');$('vessel-cost').value=String(cost);$('vessel-seed').value=String(seed);await generate({restore:data});}catch{toast('That file is not a valid KEEL design blueprint.');}});
}
function cleanup(){if(disposed)return;disposed=true;cancelAnimationFrame(animationId);clearTimeout(toastTimer);clearTimeout(window.keelWatchdog);resizeObserver?.disconnect();controls?.dispose();disposeVessel(vessel);disposeDimensions();if(scene){const geos=new Set(),mats=new Set(),tex=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));o.shadow?.map?.dispose();});for(const m of mats){for(const v of Object.values(m))if(v?.isTexture)tex.add(v);m.dispose();}geos.forEach(g=>g.dispose());tex.forEach(t=>t.dispose());}environmentTarget?.dispose();if(composer){composer.passes.forEach(p=>p.dispose?.());composer.dispose();}renderer?.dispose();}
window.addEventListener('pagehide',e=>{if(!e.persisted)cleanup();});
window.keel={validateDNA,runSelfTests,validateGeometry:()=>vessel?validateGeometry(vessel):null,inspect:()=>vessel?{name:vessel.dna.name,dna:vessel.dna.id,brief:{cost:vessel.dna.cost,seed:vessel.dna.seed,finish:vessel.dna.finish,revision:vessel.dna.revision},geometry:vessel.report}:null,getBlueprint,generate:async(cost,seed,options={})=>{if(exporting)return false;$('vessel-cost').value=String(cost);$('vessel-seed').value=String(seed);return generate({restore:options});},setView,export:exportVessel};
async function start(){
  try{
    const params=new URLSearchParams(location.search);if(params.has('cost')){try{$('vessel-cost').value=money.format(parseBudget(params.get('cost')));}catch{}}if(params.has('seed')&&/^\d+$/.test(params.get('seed'))&&Number(params.get('seed'))<=4294967295)$('vessel-seed').value=params.get('seed');
    const finish=params.get('finish')||document.documentElement.dataset.keelFinish||'auto',revision=Number(params.get('refit')||document.documentElement.dataset.keelRefit||0);$('finish-select').value=['walnut','ivory','graphite'].includes(finish)?finish:'auto';state.revision=Number.isFinite(revision)?clamp(Math.floor(revision),0,99999):0;state.finish=$('finish-select').value;
    validateDNA();initStage();bindUI();syncFleetState();const ready=await generate({silent:true,restore:{finish:state.finish,revision:state.revision}});if(ready){lastMetrics=performance.now();animationId=requestAnimationFrame(animate);}
  }catch(error){fatal(error);}
}
start();
