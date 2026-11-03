import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {TAU, V, clamp, lerp} from './util.js';
import {Materials, Parts} from './materials.js';
import {HullSculptor} from './hull-sculptor.js';
import {collectFitPoints, visibleBounds} from './fit.js';

function batchStatics(root){
  root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),buckets=new Map(),remove=[],old=new Set();
  root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.userData.live)return;for(let q=o.parent;q&&q!==root;q=q.parent)if(q.userData.live)return;let g=o.geometry.clone();if(g.index){const n=g.toNonIndexed();g.dispose();g=n;}g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!g.attributes.normal)g.computeVertexNormals();const key=o.material.uuid+':'+o.castShadow+':'+o.receiveShadow;if(!buckets.has(key))buckets.set(key,{material:o.material,cast:o.castShadow,receive:o.receiveShadow,geos:[]});buckets.get(key).geos.push(g);remove.push(o);old.add(o.geometry);});
  remove.forEach(o=>o.removeFromParent());old.forEach(g=>g.dispose());for(const b of buckets.values()){const geo=mergeGeometries(b.geos,false);b.geos.forEach(g=>g.dispose());if(!geo)throw new Error('A static assembly could not be merged.');const mesh=new THREE.Mesh(geo,b.material);mesh.name=b.material.name;mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;root.add(mesh);}
}
export function disposeVessel(v){if(!v)return;const geos=new Set(),mats=new Set(v.m?.all||[]),tex=new Set(v.m?.textures||[]);v.root.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));if(o.isInstancedMesh)o.dispose();});for(const m of mats){for(const value of Object.values(m))if(value?.isTexture)tex.add(value);m.dispose();}geos.forEach(g=>g.dispose());tex.forEach(t=>t.dispose());v.root.removeFromParent();}
export class VesselBuilder{
  constructor(d){this.dna=d;this.root=new THREE.Group();this.root.name=`KEEL / ${d.name}`;this.m=new Materials(d);this.p=new Parts(this.root);this.hull=new HullSculptor(d,d.tier===4?{B:d.B*.48}:{});this.hulls=[this.hull];this.r=d.stream('outfitting');this.fitR=d.stream('fine-fitout:'+d.revision);this.animators=[];this.hitTargets=[];this.roofs=[];this.lights=[];this.colliders=[];this.railAudit=[];this.equipment=new Set();this.parts=[];this.radarRange=6;this.steering=0;this.throttle=.42;this.layoutFits=false;this.doors=[];}
  solveArrangement(){
    const d=this.dna;if(d.tier===0)return;const margin=Math.min(.4,this.hull.B*.055),desired=d.bridgeW,baseFactor=d.levels?1.14:1.04,len=d.bridgeL*(d.levels?1.1:1.03);
    for(let reduction=1;reduction>=.48;reduction-=.035)for(let k=0;k<=18;k++){
      const z=lerp(d.bridgeZ,d.L*.015,k/18),w=Math.min(desired*reduction,(this.hull.B-margin*2)/baseFactor),plan=this.p.footprint(w*baseFactor,len,.12);let fits=true;
      for(let j=0;j<plan.length;j++){const a=plan[j],b=plan[(j+1)%plan.length];for(let n=0;n<=5;n++){const x=lerp(a[0],b[0],n/5),zz=z+lerp(a[1],b[1],n/5);if(Math.abs(zz)>d.L*.46||Math.abs(x)+margin>this.hull.measure(zz).width)fits=false;}}
      if(fits){this.W=w;this.D=d.bridgeL;this.H=d.bridgeH;this.houseW=w*baseFactor;this.houseL=len;this.bridgeZ=z;this.layoutFits=true;return;}
    }throw new Error('The bridge footprint could not be fitted safely inside the deck.');
  }
  build(){
    const d=this.dna;this.solveArrangement();
    // Original primitive craft path: a wooden open shell, then the skiff outfitter.
    if(d.tier===0)this.hull.shell(this.p,this.m.wood,this.root);
    else this.hull.build(this.p,this.m,this.root,false);
    if(d.tier===0)this.skiff();else{if(d.tier===4)this.multihull();this.rails(this.hull);this.livery();this.superstructure();this.propulsion();this.deckEquipment();this.safety();this.fishingRig();this.deckHardware();}
    if(d.tier>0)this.lifeAboard();
    this.identity();
    this.parts=d.tier===0?[
      {name:'Hull form',detail:`${d.L.toFixed(1)} m / ${d.material}`},
      {name:'Keel & skeg',detail:'faired displacement line'},
      {name:'Rowing rig',detail:'bronze oarlocks, feathering oars'},
      {name:'Timber frames',detail:'steam-bent ribs'},
      ...(d.cost>4200?[{name:'Outboard engine',detail:'tiller steered'}]:[])
    ]:[{name:'Continuous hull',detail:'Welded stem, closed transom, shared deck boundary'},{name:'Bow and rails',detail:'Unbroken perimeter, no attached bulb'},{name:'Surface-mounted fittings',detail:'Aligned to the true shell normal'},{name:'Bridge fit-out',detail:d.finish+' / revision '+d.revision},{name:'Navigation suite',detail:'Chartplotter, X-band radar, echo sounder'}];
    let detachedBulbs=0;this.root.traverse(o=>{if(o.geometry?.type==='SphereGeometry'&&[this.m.hull,this.m.bottom,this.m.boot].includes(o.material))detachedBulbs++;});this.bowAudit={detachedBulbs};
    const moving=[];this.root.traverse(o=>{if(o.isGroup&&o.userData.live)moving.push(o);});for(const group of moving.reverse())batchStatics(group);batchStatics(this.root);
    this.root.scale.setScalar(d.scale);this.root.userData={engine:'KEEL 2.0',cost:d.cost,seed:d.seed,dna:d.id,name:d.name,finish:d.finish,revision:d.revision,conceptOnly:true};this.root.updateMatrixWorld(true);this.bounds=visibleBounds(this.root);this.fitPoints=collectFitPoints(this.root,this.bounds);this.drawDisplays(0);return this;
  }
  liveGroup(name,parent=this.root,pos=[0,0,0],action=null){const g=new THREE.Group();g.name=name;g.userData.live=true;g.position.set(...pos);if(action){g.userData.action=action;this.hitTargets.push(g);}parent.add(g);return g;}
  rails(h,parent=this.root){
    const p=this.p,m=this.m,d=this.dna,u=clamp(d.L/38,.62,2.7),height=clamp(.9+d.L*.001,.9,1.3),r=.026*u;
    for(const hh of [height,height*.48]){const pts=h.perimeter(1,hh,.045*u),mesh=p.pipe(pts,hh===height?r:r*.76,m.rail,parent,true,480);mesh.name='Unbroken bow-to-transom rail';this.railAudit.push(mesh.userData.pathAudit);}
    const gunwale=p.pipe(h.perimeter(1,.025,.02*u),.07*u,m.dark,parent,true,480);this.railAudit.push(gunwale.userData.pathAudit);
    const posts=Math.min(88,Math.max(14,Math.ceil(h.L/1.45)));
    for(const side of [-1,1])for(let i=0;i<posts;i++){const t=i/posts,s=h.section(t),v=h.point(t,1,side);v.x-=side*Math.min(.045*u,s.width*.2);p.rod(v,v.clone().add(V(0,height,0)),r,m.rail,parent,8);p.cylinder(.055*u,.055*u,.035*u,v.x,v.y+.018,v.z,m.metal,parent,null,12);}
    const stem=h.point(1,1);p.rod(stem,stem.clone().add(V(0,height,0)),r,m.rail,parent,8);const stern=h.section(0);for(const x of [-.5,0,.5])p.rod([x*stern.width,stern.sheer,stern.z],[x*stern.width,stern.sheer+height,stern.z],r,m.rail,parent,8);
  }
  livery(){
    const h=this.hull,p=this.p,m=this.m,d=this.dna,u=clamp(d.L/38,.5,2.5),s=d.liveryScheme||'accent';
    const add=(q,r,mat)=>{const mesh=p.pipe(h.perimeter(q,0,0),r*u,mat,this.root,true,480);this.railAudit.push(mesh.userData.pathAudit);};
    if(s==='accent'||s==='two'||s==='checker')add(.865,.052,m.accent);
    if(s==='two')add(.74,.03,m.rail);
    if(s==='boot'){add(.62,.06,m.body);add(.56,.025,m.dark);}
    if(s==='checker'){const n=Math.round(clamp(d.L/2.2,8,30));for(let i=0;i<n;i++){if(i%2)continue;const t=.08+.84*i/n;for(const side of[-1,1]){const g=new THREE.Group();this.root.add(g);this.attach(g,t,.78,side,.01);p.round(d.L*.84/n*.9,d.F*.16,.012,0,0,0,m.body,g,.005);}}}
    const plate=m.label('K-'+d.id,'#dde2d4',null,8);p.label('K-'+d.id,d.L*.11,d.L*.017,0,d.F*.42,h.section(0).z-.10*u,plate,this.root,[0,Math.PI,0]);
  }
  attach(g,t,q,side,offset=.015){const h=this.hull,n=h.normal(t,q,side);g.position.copy(h.point(t,q,side).addScaledVector(n,offset));g.quaternion.setFromUnitVectors(V(0,0,1),n);return g;}
  identity(){
    const d=this.dna,h=this.hull,p=this.p,m=this.m,w=d.L*.19,hh=w*.095,tc=.73,yc=d.F*.66,mat=m.label(d.name.toUpperCase(),d.tier===0?'#eee5d0':d.palette.body);
    for(const side of [-1,1]){const pos=[],uv=[],ids=[],steps=48;for(let i=0;i<=steps;i++)for(let j=0;j<2;j++){const t=tc+(i/steps-.5)*w/d.L*side,y=yc+(j-.5)*hh,s=h.section(t),q=clamp((y-s.bottom)/(s.sheer-s.bottom),.05,.97),v=h.point(t,q,side).addScaledVector(h.normal(t,q,side),.016);pos.push(...v.toArray());uv.push(1-i/steps,j);}for(let i=0;i<steps;i++){const a=i*2;ids.push(a,a+1,a+2,a+1,a+3,a+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();const mesh=p.mesh(g,mat);mesh.name='Conformal hull lettering';mesh.castShadow=false;}
  }
  superstructure(){
    const d=this.dna,p=this.p,m=this.m,W=this.W,D=this.D,H=this.H,z=this.bridgeZ,base=this.p.footprint(this.houseW,this.houseL,.12);let low=Infinity,high=-Infinity;
    for(const a of base){low=Math.min(low,this.hull.deckHeight(z+a[1],a[0]));high=Math.max(high,this.hull.deckHeight(z+a[1],a[0]));}low=Math.min(low,this.hull.deckHeight(z));high=Math.max(high,this.hull.deckHeight(z));
    const cr=d.stream('casing'),casingH=(d.tier>=3?3.15:d.tier===2?2.25:.16)*(d.tier>=2?cr.range(.72,1.28):1),top=high+casingH,g=new THREE.Group();g.position.z=z;g.name='Deck-conforming bridge foundation';this.root.add(g);
    p.slab(base,low-.16,top-low+.16,m.body,g,.025);p.slab(this.p.footprint(this.houseW+.12,this.houseL+.12,.12),top-.02,.11,m.body,g,.025);p.slab(base.map(a=>[a[0]*1.002,a[1]*1.002]),low+.15,.08,m.accent,g,.01);
    if(d.levels){const count=clamp(Math.floor(D/1.6),2,5);for(const side of [-1,1])for(let j=0;j<count;j++){const zz=lerp(-D*.30,D*.30,j/(count-1)),x=side*(this.houseW*.5+.024),y=top-casingH*.46;p.round(.04,.56,.76,x,y,zz,m.dark,g,.02);for(let k=0;k<6;k++)p.box(.067,.025,.69,x+side*.016,y-.21+k*.084,zz,m.metal,g,[0,0,side*.4]);}this.stairs(-W*.32,z-this.houseL*.5-1.05,high,casingH,.68);}
    this.bridgeFloor=top+.13;const cabin=new THREE.Group();cabin.name='Finely fitted walk-in wheelhouse';cabin.position.set(0,this.bridgeFloor,z);this.root.add(cabin);this.bridge=cabin;this.cabin(cabin);
    this.mast();this.equipment.add('Continuous displacement hull and fitted deck');this.equipment.add(d.cabinStyle==='console'?'Open center-console helm':d.cabinStyle==='pilothouse'?'Compact '+d.finish+' pilothouse':'Full walk-in '+d.finish+' wheelhouse');this.equipment.add('Live radar, chartplotter and echo sounder');this.equipment.add(d.cabinStyle==='console'?'T-top, leaning post and rod rockets':'Sculpted helm and suspension seating');this.equipment.add(d.cabinStyle==='console'?'Mooring cleats and deck hardware':'Fitted joinery, chart table and almanacs');
  }
  stairs(x,z,y,height,width){const p=this.p,m=this.m,n=Math.ceil(height/.24),run=2.1;for(let i=0;i<n;i++)p.round(width,.07,run/n+.035,x,y+(i+1)*height/n,z-run/2+i*run/n,m.metal,this.root,.012);for(const s of [-1,1]){p.rod([x+s*width*.46,y+.1,z-run/2],[x+s*width*.46,y+height,z+run/2],.034,m.dark);p.rod([x+s*width*.46,y+.93,z-run/2],[x+s*width*.46,y+height+.9,z+run/2],.024,m.rail);for(let k=0;k<=3;k++)p.rod([x+s*width*.46,y+height*k/3,z-run/2+run*k/3],[x+s*width*.46,y+height*k/3+.9,z-run/2+run*k/3],.02,m.rail);}}
  mast(){
    const d=this.dna,p=this.p,m=this.m,u=clamp(d.L/38,.7,2.6),g=this.roofs[0],y=(this.roofMount?.y??this.H+.12*u)+.04*u,h=clamp(d.L*.12,2.2,10),z=-this.D*.16;
    p.cylinder(.055*u,.13*u,h,0,y+h*.5,z,m.body,g,null,16);p.cylinder(.17*u,.22*u,.10*u,0,y,z,m.dark,g);
    for(const s of [-1,1]){p.rod([s*this.W*.22,y+.1,z],[0,y+h*.58,z],.034*u,m.body,g);p.rod([0,y+h*.85,z],[s*this.W*.32,y+.1,-this.D*.30],.008*u,m.metal,g);p.rod([s*1.05*u,y+h*.59,z],[s*1.05*u,y+h*.59+1.2*u,z],.012*u,m.dark,g);}
    p.round(2.5*u,.09*u,.15*u,0,y+h*.59,z,m.body,g,.03*u);const radar=this.liveGroup('Rotating navigation scanner',g,[0,y+h*.45,z+1.20*u]);p.round(.38*u,.22*u,.32*u,0,.1*u,0,m.body,radar,.05*u);
    if(d.radarStyle==='array'){p.round(1.9*u,.13*u,.19*u,0,.30*u,0,m.rail,radar,.045*u);p.box(1.65*u,.028*u,.012*u,0,.30*u,.099*u,m.dark,radar);this.animators.push({kind:'radar',object:radar,speed:.45});}else{p.cylinder(.43*u,.43*u,.12*u,0,.24*u,0,m.dark,radar,null,32);p.sphere(.46*u,.30*u,.46*u,0,.33*u,0,m.rail,radar);}
    p.round(.22*u,.06*u,1.2*u,0,y+h*.45-.04*u,z+.60*u,m.body,g,.016*u);p.rod([0,y+h*.2,z],[0,y+h*.45,z+1.20*u],.035*u,m.body,g);
    const flagMat=m.label('K',d.palette.body,d.palette.hull,1.6,600),fg=new THREE.PlaneGeometry(.68*u,.43*u,12,5);fg.translate(.34*u,0,0);const flag=p.mesh(fg,flagMat,[.02*u,y+h*.85,z],[0,Math.PI/2,0],g);flag.userData.live=true;this.animators.push({kind:'flag',object:flag,width:.68*u});
    p.cylinder(.09*u,.13*u,.15*u,0,y+h+.05*u,z,m.dark,g);p.cylinder(.075*u,.075*u,.07*u,0,y+h+.15*u,z,m.led,g);
    // Navigation sidelights are mounted directly on the mast yardarm (where real ships
    // carry them), physically welded to the cross-arm. Never floating in mid-air!
    for(const side of [-1,1]){
      const yardX = side * 1.18 * u;
      const yardY = y + h * .59;
      p.round(.08*u, .11*u, .07*u, yardX, yardY + .06*u, z, m.dark, g, .01*u);
      p.cylinder(.034*u, .034*u, .06*u, yardX, yardY + .06*u, z + .01*u, side===1?m.green:m.port, g, [Math.PI/2, 0, 0], 16);
    }
    if(d.tier>=2)for(const side of [-1,1]){const sx=side*this.W*.30,sz=-this.D*.30,eh=1.8*u;p.cylinder(.16*u,.22*u,eh,sx,y+eh*.5,sz,m.body,g);p.cylinder(.18*u,.18*u,.16*u,sx,y+eh*.76,sz,m.accent,g);p.cylinder(.175*u,.175*u,.16*u,sx,y+eh-.05*u,sz,m.rubber,g);p.torus(.17*u,.012*u,sx,y+eh+.03*u,sz,m.metal,g,[Math.PI/2,0,0]);}
    if(d.tier>=3)for(const side of [-1,1]){p.cylinder(.5*u,.5*u,.13*u,side*this.W*.31,this.H+.22,-this.D*.25,m.dark,g);p.sphere(.5*u,.52*u,.5*u,side*this.W*.31,this.H+.38,-this.D*.25,m.rail,g);}
  }
  propulsion(){
    const d=this.dna,p=this.p,m=this.m;if(d.tier===1){this.outboard();return;}const R=Math.min(d.B*.085,d.D*.32),z=-d.L*.505,y=-d.D*.74;
    for(const side of [-1,1]){const x=side*this.hull.B*.19;p.rod([x,-d.D*.49,-d.L*.365],[x,y,z],R*.075,m.chrome);p.rod([x,-d.D*.38,z+R*.5],[x,y,z+.08],R*.075,m.dark);
      const prop=this.liveGroup('Counter-rotating bronze screw',this.root,[x,y,z]);this.propeller(prop,R,side);this.animators.push({kind:'propeller',object:prop,speed:side*1.2});
      const rudder=new THREE.Shape([new THREE.Vector2(0,0),new THREE.Vector2(R*.6,-R*.1),new THREE.Vector2(R*.74,-R*1.5),new THREE.Vector2(-R*.35,-R*1.5),new THREE.Vector2(-R*.3,-R*.3)]);const mesh=p.mesh(new THREE.ExtrudeGeometry(rudder,{depth:R*.06,bevelEnabled:true,bevelSize:R*.025,bevelThickness:R*.025,bevelSegments:2,steps:1}),m.bottom,[x,y+R*.75,z-R*.48],[0,Math.PI/2,0]);mesh.name='Faired rudder';p.rod([x,y+R*.9,z-R*.45],[x,-d.D*.16,z-R*.45],R*.035,m.metal);
    }this.equipment.add('Twin bronze screws and faired rudders');
  }
  propeller(g,R,hand=1){const p=this.p,m=this.m;p.cylinder(R*.16,R*.22,R*.55,0,0,0,m.bronze,g,[Math.PI/2,0,0]);p.sphere(R*.16,R*.16,R*.23,0,0,-R*.32,m.bronze,g);
    for(let k=0;k<this.dna.propellerBlades;k++){const pos=[],uv=[],ids=[],nr=10,nc=6;for(let i=0;i<=nr;i++){const t=i/nr,rr=lerp(R*.16,R,t),chord=R*(.5*Math.sin(Math.PI*lerp(.10,.99,t))+.035),sweep=R*.24*t*t;for(let j=0;j<=nc;j++){const c=(j/nc-.5)*chord;pos.push(c*Math.cos(.4)+sweep,rr,c*Math.sin(.4)*hand+Math.sin(j/nc*Math.PI)*R*.025);uv.push(j/nc,t);}}for(let i=0;i<nr;i++)for(let j=0;j<nc;j++){const a=i*(nc+1)+j,b=a+nc+1;ids.push(a,b,a+1,a+1,b,b+1);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ids);geo.computeVertexNormals();if(!m.blade)m.blade=m.std('Curved bronze propeller blades','#b69258',{metalness:.86,roughness:.28,side:THREE.DoubleSide});const blade=p.mesh(geo,m.blade,[0,0,0],null,g);blade.rotation.z=k*TAU/this.dna.propellerBlades;}
  }
  outboard(){const d=this.dna,p=this.p,m=this.m,u=clamp(d.L/13,.6,1.4),n=d.cost>80000?2:1;for(let i=0;i<n;i++){const x=n===1?0:(i-.5)*d.B*.30,z=-d.L*.515,y=this.hull.deckHeight(-d.L*.49);p.round(.49*u,.68*u,.68*u,x,y+.10*u,z,m.dark,this.root,.12*u);p.round(.50*u,.09*u,.54*u,x,y+.23*u,z-.03*u,m.body,this.root,.03*u);p.round(.11*u,.95*u,.18*u,x,y-.61*u,z+.04*u,m.dark,this.root,.03*u);p.cylinder(.08*u,.1*u,.33*u,x,y-1.07*u,z,m.dark,this.root,[Math.PI/2,0,0]);const g=this.liveGroup('Outboard screw',this.root,[x,y-1.07*u,z-.19*u]);this.propeller(g,.17*u);this.animators.push({kind:'propeller',object:g,speed:1.4});p.round(.28*u,.20*u,.43*u,x,y-.10*u,z+.40*u,m.metal,this.root,.025*u);}this.equipment.add(n===2?'Twin commercial outboards':'Single commercial outboard');}
  deckEquipment(){
    const d=this.dna,p=this.p,m=this.m,u=clamp(d.L/38,.5,2.8),workZ=d.forward?-d.L*.27:d.L*.24,deck=this.hull.deckHeight(workZ);
    this.windlass(0,this.hull.deckHeight(d.L*.34),d.L*.34,u);
    for(const z of [-d.L*.425,d.L*.32])for(const s of [-1,1]){const x=s*this.hull.measure(z).width*.74,y=this.hull.deckHeight(z,x);p.round(.46*u,.07*u,.26*u,x,y+.06,z,m.dark,this.root,.025*u);for(const dx of [-.13,.13]){p.cylinder(.05*u,.06*u,.25*u,x+dx*u,y+.20*u,z,m.metal);p.cylinder(.075*u,.075*u,.04*u,x+dx*u,y+.33*u,z,m.chrome);}}
    if(d.tier===1){p.round(d.B*.43,.36*u,d.L*.095,0,deck+.18*u,workZ,m.body,this.root,.06*u);p.round(d.B*.44,.045*u,d.L*.096,0,deck+.38*u,workZ,m.wood,this.root,.02*u);this.ropeCoil(d.B*.22,deck+.035,workZ,.22*u);return;}
    const span=Math.min(this.hull.B*.62,5.5*u),R=.7*u;const winch=this.liveGroup('Net-recovery drum',this.root,[0,deck+.95*u,workZ]);p.cylinder(R,R,span*.66,0,0,0,m.net,winch,[0,0,Math.PI/2],32);for(const s of [-1,1]){p.cylinder(R*1.14,R*1.14,.11*u,s*span*.35,0,0,m.accent,winch,[0,0,Math.PI/2],32);p.round(.16*u,1.22*u,1.16*u,s*span*.39,deck+.61*u,workZ,m.accent,this.root,.04*u);p.round(.6*u,.12*u,1.45*u,s*span*.39,deck+.06*u,workZ,m.dark,this.root,.025*u);}for(let j=0;j<18;j++)p.torus(R+.01,.017*u,-span*.32+j*span*.64/17,0,0,m.rope,winch,[0,Math.PI/2,0]);this.animators.push({kind:'drum',object:winch,speed:.07});
    const hatchZ=workZ*.43,hatchY=this.hull.deckHeight(hatchZ);if(Math.abs(hatchZ-this.bridgeZ)>this.D*.6){p.round(this.hull.B*.32,.15*u,d.L*.07,0,hatchY+.09*u,hatchZ,m.dark,this.root,.04*u);p.round(this.hull.B*.30,.13*u,d.L*.065,0,hatchY+.22*u,hatchZ,m.body,this.root,.04*u);for(const s of [-1,1])for(const e of [-1,1])p.round(.12*u,.06*u,.25*u,s*this.hull.B*.13,hatchY+.31*u,hatchZ+e*d.L*.021,m.metal,this.root,.018*u);}
    if(d.forward){const gz=-d.L*.405,gy=this.hull.deckHeight(gz),gw=this.hull.measure(gz).width*1.66,gh=clamp(d.L*.13,3.5,13);for(const s of [-1,1]){p.round(.60*u,.15*u,.82*u,s*gw*.5,gy+.08*u,gz,m.dark,this.root,.03*u);p.rod([s*gw*.5,gy+.1,gz],[s*gw*.47,gy+gh,gz+.28*u],.12*u,m.accent);p.rod([s*gw*.5,gy+.1,gz+1.3*u],[s*gw*.47,gy+gh*.72,gz+.2*u],.055*u,m.accent);for(let i=0;i<10;i++)p.rod([s*gw*.5-.12*u,gy+.3+i*gh*.08,gz-.13*u],[s*gw*.5+.12*u,gy+.3+i*gh*.08,gz-.13*u],.016*u,m.metal);}p.round(gw*.95,.27*u,.34*u,0,gy+gh,gz+.28*u,m.accent,this.root,.04*u);for(const s of [-1,1]){p.torus(.18*u,.045*u,s*gw*.23,gy+gh-.25*u,gz+.28*u,m.dark,this.root,[0,Math.PI/2,0]);p.rod([s*gw*.23,gy+gh-.25*u,gz+.28*u],[s*gw*.2,deck+R*1.6,workZ],.012*u,m.rope);}}
    this.crane(this.hull.B*.27,this.hull.deckHeight(workZ*.63),workZ*.63,u);this.crates(-this.hull.B*.28,this.hull.deckHeight(workZ*.72),workZ*.72,u);this.ropeCoil(this.hull.B*.24,deck+.03,workZ-.7*u,.29*u);this.equipment.add('Hydraulic crane and powered trawl winch');this.equipment.add('Hold hatch, ventilated fish boxes and mooring gear');
    if(d.tier>=3){const zz=-d.L*.37,yy=this.hull.deckHeight(zz)+.12,ww=this.hull.B*.65,ll=d.L*.115;p.slab(this.p.footprint(ww,ll,.16),yy,.12,m.dark);const mat=m.label('H','#e1e3cc',null,1,500);p.label('H',Math.min(ww,ll)*.62,Math.min(ww,ll)*.62,0,yy+.135,zz,mat,this.root,[-Math.PI/2,0,0]);p.torus(Math.min(ww,ll)*.40,.045*u,0,yy+.14,zz,m.rail,this.root,[Math.PI/2,0,0]);this.equipment.add('Stern landing platform and communications domes');}
  }
  crane(x,y,z,u){const p=this.p,m=this.m,g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=Math.PI-.4;this.root.add(g);p.cylinder(.39*u,.47*u,.16*u,0,.08*u,0,m.dark,g);p.cylinder(.34*u,.34*u,.08*u,0,.20*u,0,m.metal,g);for(let k=0;k<8;k++){const a=k*TAU/8;p.cylinder(.022*u,.022*u,.035*u,Math.sin(a)*.4*u,.18*u,Math.cos(a)*.4*u,m.metal,g,null,6);}p.round(.50*u,1.15*u,.55*u,0,.78*u,0,m.accent,g,.06*u);const a=[0,1.32*u,0],b=[0,2.9*u,.95*u],c=[0,3.3*u,2.75*u];p.rod(a,b,.14*u,m.accent,g,8);p.rod(b,c,.105*u,m.accent,g,8);for(const q of [a,b]){p.cylinder(.19*u,.19*u,.5*u,...q,m.dark,g,[0,0,Math.PI/2]);p.cylinder(.09*u,.09*u,.515*u,...q,m.metal,g,[0,0,Math.PI/2]);}p.rod([.15*u,1.4*u,.02*u],[.15*u,2.5*u,.75*u],.07*u,m.dark,g);p.rod([.15*u,2*u,.4*u],[.15*u,2.72*u,.86*u],.034*u,m.chrome,g);p.pipe([[.20*u,.3*u,0],[.2*u,1.6*u,.1*u],[.19*u,2.95*u,.96*u],[.16*u,3.35*u,2.7*u]],.018*u,m.rubber,g);const hook=this.liveGroup('Suspended crane hook',g,c);p.rod([0,0,0],[0,-1.25*u,0],.011*u,m.rope,hook);p.torus(.095*u,.024*u,0,-1.32*u,0,m.dark,hook,[0,0,.55],Math.PI*1.67);this.animators.push({kind:'hook',object:hook,phase:this.r.range(0,6)});}
  windlass(x,y,z,u){const p=this.p,m=this.m;p.round(1.02*u,.11*u,.67*u,x,y+.07,z,m.dark,this.root,.04*u);for(const s of [-1,1]){p.round(.10*u,.39*u,.4*u,x+s*.38*u,y+.25*u,z,m.body,this.root,.025*u);p.cylinder(.17*u,.17*u,.28*u,x+s*.25*u,y+.4*u,z,m.metal,this.root,[0,0,Math.PI/2]);p.cylinder(.21*u,.21*u,.05*u,x+s*.39*u,y+.4*u,z,m.dark,this.root,[0,0,Math.PI/2]);}p.round(.33*u,.25*u,.36*u,x,y+.41*u,z,m.accent,this.root,.05*u);for(let k=0;k<14;k++){const zz=z+.3*u+k*.07*u,yy=this.hull.deckHeight(zz)+.04;p.torus(.033*u,.010*u,x,yy,zz,m.metal,this.root,k%2?[0,Math.PI/2,0]:[Math.PI/2,0,0]);}
    for(const s of [-1,1]){const g=new THREE.Group();this.root.add(g);this.attach(g,.855,.75,s,.022*u);p.torus(.115*u,.027*u,0,.24*u,0,m.dark,g);p.rod([0,.15*u,.015*u],[0,-.35*u,.025*u],.031*u,m.metal,g);p.rod([-.22*u,-.16*u,.025*u],[0,-.38*u,.025*u],.034*u,m.dark,g);p.rod([.22*u,-.16*u,.025*u],[0,-.38*u,.025*u],.034*u,m.dark,g);for(const e of [-1,1])p.round(.12*u,.16*u,.03*u,e*.19*u,-.18*u,.03*u,m.dark,g,.015*u,[0,0,e*-.45]);}
  }
  ropeCoil(x,y,z,r,parent=this.root){const pts=[];for(let i=0;i<170;i++){const a=i*.24,rr=r*lerp(.35,1,i/169);pts.push([x+Math.cos(a)*rr,y+.018,z+Math.sin(a)*rr]);}this.p.pipe(pts,.012*clamp(r/.25,.5,2),this.m.rope,parent,false,220);}
  crates(x,y,z,u){const p=this.p,m=this.m;for(let ix=0;ix<2;ix++)for(let level=0;level<3;level++){const xx=x+ix*.72*u,yy=y+level*.34*u;p.box(.62*u,.045*u,.48*u,xx,yy+.035*u,z,m.bookMats[0]);for(const s of [-1,1])for(let k=0;k<3;k++){p.box(.62*u,.045*u,.026*u,xx,yy+.1*u+k*.085*u,z+s*.23*u,m.bookMats[0]);p.box(.025*u,.045*u,.48*u,xx+s*.30*u,yy+.1*u+k*.085*u,z,m.bookMats[0]);}for(const a of [-1,1])for(const b of [-1,1])p.box(.035*u,.30*u,.035*u,xx+a*.29*u,yy+.18*u,z+b*.22*u,m.bookMats[0]);}}
  safety(){const d=this.dna,p=this.p,m=this.m,u=clamp(d.L/38,.55,2.4);for(const s of [-1,1]){const g=new THREE.Group();if(d.cabinStyle==='console'){const t=clamp(this.bridgeZ/d.L+.5,.05,.95),n=this.hull.normal(t,.96,s);g.position.copy(this.hull.point(t,.96,s).addScaledVector(n,.035*u));g.quaternion.setFromUnitVectors(V(0,0,1),n);}else{g.position.set(s*(this.W*.5+.06),this.bridgeFloor+.65,this.bridgeZ-this.D*.24);g.rotation.y=s*Math.PI/2;}this.root.add(g);p.torus(.255*u,.065*u,0,0,0,m.orange,g);for(let k=0;k<4;k++)p.torus(.255*u,.067*u,0,0,0,m.rail,g,[0,0,k*Math.PI/2-.13],.26);p.torus(.345*u,.008*u,0,0,-.018*u,m.rope,g);p.rod([-.2*u,-.19*u,-.08*u],[.2*u,-.19*u,-.08*u],.02*u,m.metal,g);
      for(let i=0;i<3;i++){const t=.12+i*.11,h=this.hull.section(t),v=this.hull.point(t,.91,s),yy=Math.max(.25*u,h.sheer-.55*u);v.x+=s*.08*u;p.rod([v.x,h.sheer+.05,v.z],[v.x,yy+.19*u,v.z],.01*u,m.rope);p.round(.22*u,.48*u,.24*u,v.x,yy,v.z,m.rubber,this.root,.1*u);p.cylinder(.03*u,.05*u,.1*u,v.x,yy+.28*u,v.z,m.rubber);}
      const zz=this.bridgeZ-this.D*.37,xs=s*this.hull.measure(zz).width*.76,yy=this.hull.deckHeight(zz,xs)+.28*u;if(Math.abs(xs)+.28*u<this.hull.measure(zz).width){p.mesh(new THREE.CapsuleGeometry(.25*u,.67*u,5,20),m.rail,[xs,yy,zz],[Math.PI/2,0,0]);for(const e of [-1,1]){p.torus(.26*u,.016*u,xs,yy,zz+e*.22*u,m.dark);p.round(.58*u,.06*u,.12*u,xs,yy-.26*u,zz+e*.22*u,m.metal,this.root,.012*u);}}}
    for(const side of [-1,1])for(const t of [.725,.77]){const g=new THREE.Group();this.root.add(g);this.attach(g,t,.63,side,.015);p.torus(.105*u,.019*u,0,0,0,m.bronze,g);p.cylinder(.088*u,.088*u,.015*u,0,0,0,m.glass,g,[Math.PI/2,0,0],24);}this.equipment.add('Rail-mounted life rings and capsule life rafts');}
  fishingRig(){ this.buildRig(clamp(this.dna.L/35,.65,3.1),2,3); }
  // Original KEEL fishing rig: paired outrigger booms + gunwale rod holders.
  // Each piece pivots at its own mount so the rig telescopes in and out of its holders.
  buildRig(u,outriggerSides=2,holders=3){
    const d=this.dna,p=this.p,m=this.m,G=d.outrigger;
    if(d.tier===0)return;
    const g=this.liveGroup('Fishing rod rig');this.rigGroup=g;this.rigNodes=[];
    this.outriggerAudit=[];this.rodAudit=[];
    const node=(b)=>{const n=this.liveGroup('Rig node',g,b);this.rigNodes.push(n);return n;};
    const Ls=Math.min(d.L,24),Bs=Math.min(d.B,7.5),reach=Bs*.40*G.reach,lift=Ls*.24*G.lift;
    for(const side of (outriggerSides?[-1,1]:[])){
      const z=-d.L*.12,s=this.hull.measure(z),b=[side*s.width*.86,this.hull.deckHeight(z)+.06,z];
      // Fixed deck base stays put; the boom is the moving node.
      p.cylinder(.07*u,.09*u,.12*u,b[0],b[1]+.06*u,b[2],m.dark,g);
      const n=node(b),tip=[side*reach,lift,-Ls*.18];
      if(G.style==='carbon'){
        p.rod([0,0,0],tip,.022*u,m.dark,n);
        for(let k=1;k<5;k++){const t=k/5;p.torus(.035*u,.008*u,tip[0]*t,tip[1]*t,tip[2]*t,m.metal,n);}
      }else if(G.style==='telescopic'){
        const a=tip.map(v=>v*.45),bb=tip.map(v=>v*.78);
        p.rod([0,0,0],a,.032*u,m.metal,n);p.rod(a,bb,.022*u,m.metal,n);p.rod(bb,tip,.014*u,m.metal,n);
        p.cylinder(.04*u,.04*u,.06*u,...a,m.dark,n);p.cylinder(.03*u,.03*u,.05*u,...bb,m.dark,n);
      }else{
        const heel=[side*reach*.15,lift*.10,Ls*.05];
        p.rod([0,0,0],tip,.028*u,m.metal,n);p.rod(heel,tip,.02*u,m.metal,n);p.rod(heel,[0,0,0],.02*u,m.metal,n);
        for(let k=1;k<5;k++){const t=k/5;p.rod([tip[0]*t,tip[1]*t,tip[2]*t],[lerp(heel[0],tip[0],t),lerp(heel[1],tip[1],t),lerp(heel[2],tip[2],t)],.01*u,m.metal,n);}
      }
      // Halyard and release clip running back to the rail.
      p.rod(tip,[side*reach*.25,.9*u,-Ls*.20],.004*u,m.rope,n);
      p.sphere(.035*u,.05*u,.035*u,side*reach*.25,.9*u,-Ls*.20,m.orange,n);
      this.outriggerAudit.push({length:reach,mount:b,tip});
    }
    const count=Math.max(holders,G.rods),span=d.L*(d.tier>1?.20:.30);
    for(const side of [-1,1])for(let i=0;i<count;i++){
      const zz=-d.L*.36+i*span/Math.max(1,count-1);if(Math.abs(zz)>d.L*.42)continue;
      const s=this.hull.measure(zz),b=[side*s.width*.93,s.sheer+.02,zz];
      p.cylinder(.03,.034,.24,b[0],b[1]+.08,b[2],m.metal,g,[-.35,0,side*.25]);
      const n=node(b),rodLen=lerp(1.9,2.8,(i%3)/2)*Math.min(1.2,u),tip=[side*rodLen*.42,rodLen*.82,-rodLen*.38];
      p.rod([0,0,0],[side*.05,.3,-.12],.02,m.rubber,n);
      p.cylinder(.045,.045,.07,side*.05,.24,-.11,m.metal,n,[0,0,Math.PI/2]);
      p.rod([side*.05,.3,-.12],tip,.011,m.dark,n);
      for(let k=1;k<5;k++){const t=k/5;p.torus(.014,.004,lerp(side*.05,tip[0],t),lerp(.3,tip[1],t),lerp(-.12,tip[2],t),m.metal,n);}
      // Line running from the tip down into the water.
      const water=[tip[0]+side*(1.2+i*.3),-b[1]+.05,tip[2]-1.5];
      p.pipe([tip,[lerp(tip[0],water[0],.5),lerp(tip[1],water[1],.62),lerp(tip[2],water[2],.5)],water],.0035,m.rope,n,false,12);
      this.rodAudit.push({length:rodLen,mount:b});
    }
    this.equipment.add(d.tier===1?'Paired outriggers and rod holders':'Fishing rod rig and outriggers');
  }
  multihull(){const d=this.dna,p=this.p,m=this.m;for(const s of [-1,1]){const g=new THREE.Group();g.position.set(s*d.B*.395,0,-d.L*.015);this.root.add(g);const h=new HullSculptor(d,{L:d.L*.85,B:d.B*.19,D:d.D*.76,F:d.F*.66,bowRise:d.F*.30,sternWidth:.65,fullness:1.1});h.build(p,m,g);this.hulls.push(h);p.pipe(h.perimeter(1,.03),Math.max(.055,d.L*.0003),m.dark,g,true,480);}const plan=[[-d.B*.43,-d.L*.22],[-d.B*.18,-d.L*.30],[d.B*.18,-d.L*.30],[d.B*.43,-d.L*.22],[d.B*.43,d.L*.18],[d.B*.18,d.L*.29],[-d.B*.18,d.L*.29],[-d.B*.43,d.L*.18]];p.slab(plan,d.F*.77,d.F*.12,m.dark);this.equipment.add('Three continuous wave-piercing hulls');}
  // Original KEEL primitive craft: a clinker-built open boat with an inner
  // lining, floorboards, steam-bent frames, timber thwarts, rowing oars,
  // a handline, mooring rope and a crate - plus a tiller outboard above $4,200.
  skiff(){
    const d=this.dna,p=this.p,m=this.m,h=this.hull;
    // Half-width of the planking at an arbitrary height. Anything mounted inside the
    // hull must be sized from this, never from the sheer width: the bilge narrows
    // quickly going down, so sheer-sized parts punch straight through the planking.
    const insideHalf=(z,y,pad=0)=>{
      const s=h.measure(z),q=clamp((y-s.bottom)/(s.sheer-s.bottom),.02,.98);
      const th=Math.acos(1-Math.pow(q,1/h.bilge));
      return Math.max(.05,Math.sin(th)*s.width*(1-h.flare*(1-q))-pad);
    };
    h.shell(p,m.innerWood,this.root,.045);
    // The inner bottom is sized from the planking width AT THE FLOOR HEIGHT. Using a
    // share of the sheer width here pushed the slab out through the bow and stern,
    // where the hull tapers hard and the bilge sits far inboard of the sheer.
    const floorY=d.F*.05,floor=[];
    for(let i=0;i<=18;i++){const z=lerp(-d.L*.40,d.L*.41,i/18);floor.push([-insideHalf(z,floorY,.03),z]);}
    for(let i=18;i>=0;i--){const z=lerp(-d.L*.40,d.L*.41,i/18);floor.push([insideHalf(z,floorY,.03),z]);}
    p.slab(floor,floorY,.055,m.wood);
    for(const side of [-1,1]){
      for(let j=1;j<=6;j++){
        const theta=side*(.44+j*.155),line=h.sections.filter((_,i)=>i%3===0).map(s=>h.pointSection(s,theta,-.006));
        p.pipe(line,.006,m.innerWood);
      }
      p.pipe(h.sections.filter((_,i)=>i%3===0).map(s=>[side*s.width,s.sheer+.018,s.z]),.035,m.hull);
    }
    const count=d.L>5?3:2;
    for(let i=0;i<count;i++){
      const z=lerp(-d.L*.25,d.L*.22,count===1?.5:i/(count-1));
      // Thwarts are sized from the planking width AT THEIR OWN HEIGHT so their ends
      // stay inside the hull instead of sticking out through the sides.
      const ty=d.F*.70,half=insideHalf(z,ty,.04);
      const w=half*1.92;
      p.box(w,.075,d.L*.065,0,ty,z,m.wood);
      const sy=d.F*.26;
      for(const side of [-1,1]){
        const sx=side*w*.40;
        if(Math.abs(sx)<insideHalf(z,sy,.02)*.96)p.box(.05,ty-sy+.05,.07,sx,(sy+ty)*.5,z,m.innerWood);
      }
    }
    for(let i=0;i<8;i++){
      const z=lerp(-d.L*.35,d.L*.34,i/7),s=h.measure(z),points=[];
      for(let j=0;j<=18;j++){
        const a=-1.4+2.8*j/18,q=Math.pow(1-Math.cos(a),d.bilge);
        const y=lerp(s.bottom+.06,s.sheer-.03,q);
        // Clamp each rib point to the planking half-width at its own height.
        points.push([Math.sin(a)*insideHalf(z,y,.02),y,z]);
      }
      p.pipe(points,.022,m.innerWood);
    }
    const rowing=d.stream('rowing'),strokePhase=rowing.range(0,1);
    for(const side of [-1,1]){
      // Keep each oar in its bronze lock at the actual port/starboard sheer.
      // The grip is inboard; the loom and paddle reach out over the water.
      const oz=d.L*.06,s=h.measure(oz),lockX=side*s.width,lockY=s.sheer+.09;
      const lock=new THREE.Group();lock.position.set(lockX,s.sheer+.015,oz);this.root.add(lock);
      p.cylinder(.055,.055,.022,0,0,0,m.bronze,lock,null,16);
      for(const dz of [-.042,.042])p.rod([0,.015,dz],[0,.068,dz],.010,m.bronze,lock,8);
      p.torus(.044,.010,0,.066,0,m.bronze,lock,[Math.PI/2,0,0]);

      const grip=clamp(d.B*.34,.35,.60),outboard=clamp(d.L*.38,1.18,2.08);
      const bladeLength=clamp(outboard*.26,.30,.48),bladeWidth=clamp(d.B*.15,.15,.28);
      const pivot=this.liveGroup('Rowing oar',this.root,[lockX,lockY,oz]);
      pivot.rotation.y=-side*.28;pivot.rotation.z=side*.06;
      p.rod([-side*grip,0,0],[side*(outboard-bladeLength*.6),0,0],.021,m.wood,pivot,12);
      p.rod([-side*grip,0,0],[-side*grip*.52,0,0],.024,m.innerWood,pivot,12);
      p.cylinder(.024,.024,.04,0,0,0,m.bronze,pivot,[0,0,Math.PI/2],14);
      const blade=this.liveGroup('Feathering oar blade',pivot,[side*(outboard-bladeLength),0,0]);
      p.slab([[0,-bladeWidth*.22],[side*bladeLength*.22,-bladeWidth*.40],
        [side*bladeLength*.75,-bladeWidth*.48],[side*bladeLength,-bladeWidth*.20],
        [side*bladeLength,bladeWidth*.20],[side*bladeLength*.75,bladeWidth*.48],
        [side*bladeLength*.22,bladeWidth*.40],[0,bladeWidth*.22]],
        -.011,.022,m.wood,blade,.004);
      p.rod([0,.014,0],[side*bladeLength*.70,.014,0],.005,m.innerWood,blade,8);
      const dip=Math.asin(clamp((s.sheer+.06)/(outboard-bladeLength*.5),.10,.55));
      this.animators.push({kind:'oar',object:pivot,blade,side,dip,phase:strokePhase});
    }
    this.ropeCoil(insideHalf(d.L*.26,floorY+.07,.16)*.55,floorY+.05,d.L*.26,d.B*.13);
    p.cylinder(.075,.075,.11,-insideHalf(-d.L*.24,d.F*.78,.07),d.F*.78,-d.L*.24,m.rope);
    // Keep the small gear locker on the cockpit centreline. Its permissible beam is
    // sampled at both top and bottom of the box and across its fore/aft footprint;
    // the hull pinches at the bilge, so positioning it near the sheer can push it out.
    const crateZ=-d.L*.20,crateY=floorY+.055+.12,crateDepth=Math.min(.34,d.L*.085);
    let crateHalf=.5;
    for(const dz of[-crateDepth*.5,0,crateDepth*.5])for(const cy of[crateY-.12,crateY+.12])
      crateHalf=Math.min(crateHalf,insideHalf(crateZ+dz,cy,.035));
    const crateWidth=clamp(crateHalf*1.8,.10,.30);
    p.round(crateWidth,.24,crateDepth,0,crateY,crateZ,m.innerWood,this.root,.018);
    // Two narrow cover battens make it read as a secured timber gear locker, not a floating white block.
    for(const x of[-1,1])p.round(.022,.018,crateDepth*.86,x*crateWidth*.34,crateY+.126,crateZ,m.dark,this.root,.006);
    if(d.cost>4200){this.outboard();this.equipment.add('Single tiller outboard');}else this.equipment.add('Hand-carved rowing oars');
    this.equipment.add('Clinker planking and bent frames');this.equipment.add('Timber rowing benches');this.equipment.add('Handline and mooring rope');
    this.helm={group:this.root,start:V(0,d.F*.65+1.02,-d.L*.19),minX:-d.B*.22,maxX:d.B*.22,minZ:-d.L*.30,maxZ:d.L*.20,unit:1,open:true};
    this.tourViews=[{name:'Cockpit',group:this.root,eye:this.helm.start.clone(),minX:this.helm.minX,maxX:this.helm.maxX,minZ:this.helm.minZ,maxZ:this.helm.maxZ,fixedY:null,unit:1,title:'THE OPEN COCKPIT',hint:'Drag to look. WASD to step along the planks.'}];
  }
  // PROCEDURAL OBJECT GENERATOR: every call invents a new shape from random control points,
  // so bottles, jars, lamps, cans, cases and stacks are never repeated across vessels.
  trinket(x,y,z,u,g,r,kind=null){
    const p=this.p,m=this.m,mats=[m.ceramic,m.metal,m.bronze,m.orange,m.accent,m.dark,m.red,m.rubber],mat=r.pick(mats),k=kind??r.int(0,4);
    if(k<=1){
      const h=r.range(.07,.30)*u,n=r.int(4,8),base=r.range(.025,.085)*u,freq=r.range(.5,2.2),amp=r.range(-.45,.55),neck=r.range(.25,1),pts=[new THREE.Vector2(0,0)];
      for(let i=0;i<=n;i++){const t=i/n;let w=base*(1+Math.sin(t*Math.PI*freq)*amp);if(t>.7)w*=lerp(1,neck,(t-.7)/.3);pts.push(new THREE.Vector2(Math.max(.004*u,w),t*h));}
      pts.push(new THREE.Vector2(0,h));
      p.mesh(new THREE.LatheGeometry(pts,r.pick([6,8,12,28])),mat,[x,y,z],null,g);
      if(r.next()>.45){const top=pts[pts.length-2].x;p.cylinder(top*1.08,top*1.08,r.range(.01,.03)*u,x,y+h,z,r.pick(mats),g,null,16);}
      if(r.next()>.7)p.torus(base*.6,.004*u,x+base*1.1,y+h*.55,z,mat,g,[0,0,Math.PI/2]);
    }else if(k===2){
      const w=r.range(.10,.42)*u,h=r.range(.05,.26)*u,dd=r.range(.08,.32)*u,yaw=r.range(-.7,.7);
      p.round(w,h,dd,x,y+h/2,z,mat,g,Math.min(w,h,dd)*r.range(.05,.35),[0,yaw,0]);
      if(r.next()>.4)p.round(w*r.range(.3,.6),.018*u,.028*u,x,y+h+.01*u,z,m.dark,g,.007*u,[0,yaw,0]);
      if(r.next()>.6)p.round(w*1.01,h*.12,dd*1.01,x,y+h*.72,z,r.pick(mats),g,.004*u,[0,yaw,0]);
    }else if(k===3){
      let yy=y;const c=r.int(2,5);
      for(let i=0;i<c;i++){const w=r.range(.11,.26)*u,h=r.range(.018,.06)*u;p.round(w,h,w*r.range(.6,1.3),x+r.range(-.01,.01)*u,yy+h/2,z,r.pick(m.bookMats),g,.004*u,[0,r.range(-.45,.45),0]);yy+=h;}
    }else{
      // Jerrycan / fuel can with a generated handle and spout
      const w=r.range(.16,.30)*u,h=r.range(.22,.38)*u,dd=r.range(.08,.16)*u;
      p.round(w,h,dd,x,y+h/2,z,r.pick([m.red,m.orange,m.accent,m.dark]),g,.02*u);
      p.rod([x-w*.3,y+h+.03*u,z],[x+w*.1,y+h+.03*u,z],.012*u,m.dark,g);
      p.cylinder(.018*u,.022*u,.06*u,x+w*.32,y+h+.02*u,z,m.dark,g,[0,0,-.4],10);
    }
  }
  // OPEN CENTER-CONSOLE HELM for affordable coastal boats: no walls, an unobstructed
  // view of the bow and the sea, a T-top for shade, and gear scaled to the budget.
  openConsole(g){
    const d=this.dna,p=this.p,m=this.m,W=this.W,D=this.D,H=this.H,u=H/2.2,h=this.hull,z=this.bridgeZ;
    const dw=Math.min(W,h.measure(z).width*.92),dd=D;
    p.slab(p.footprint(dw*1.55,dd*2.1,.10),-.02,.05,m.deck,g,.012);
    const cwid=dw*.78,cdep=.55*u,cz=dd*.22;
    p.round(cwid,.78*u,cdep,0,.39*u,cz,m.console,g,.05*u);
    p.round(cwid*1.02,.05*u,cdep+.07*u,0,.80*u,cz,m.top,g,.02*u);
    p.round(cwid*.88,.028*u,.02*u,0,.835*u,cz-cdep*.52,m.trim,g,.008*u);
    const scr=d.screenCount>=2?2:1,sw=Math.min(.58*u,(cwid-.1*u)/scr*.8);
    for(let i=0;i<scr;i++)this.monitor(i===0?'radar':'chart',(i-(scr-1)/2)*(sw+.09*u),.84*u+sw*.3,cz+.02*u,sw,sw*.66,u,g);
    const hx=d.helmSide*cwid*.30;
    if(d.steeringStyle!=='sport'){this.steeringWheel(hx,.98*u,cz-cdep*.5-.30*u,u,g);p.rod([hx,.64*u,cz-cdep*.42],[hx,.98*u,cz-cdep*.5-.28*u],.045*u,m.dark,g);}
    const th=this.liveGroup('Engine throttle',g,[-d.helmSide*cwid*.36,.82*u,cz-.16*u],'throttle');
    p.round(.13*u,.03*u,.17*u,0,0,0,m.chrome,th,.015*u);p.rod([0,.02*u,.04*u],[0,.25*u,-.08*u],.013*u,m.chrome,th);p.round(.052*u,.042*u,.095*u,0,.26*u,-.085*u,m.rubber,th,.02*u);
    this.compass(hx-d.helmSide*.3*u,.83*u,cz-.1*u,u,g);
    const lz=cz-1.2*u;
    p.round(cwid*.72,.52*u,.42*u,0,.30*u,lz,m.dark,g,.05*u);p.round(cwid*.68,.10*u,.38*u,0,.57*u,lz,m.leather,g,.045*u);p.round(cwid*.68,.42*u,.10*u,0,.88*u,lz-.15*u,m.leather,g,.04*u,[-.12,0,0]);
    this.colliders.push({x:0,z:cz,w:cwid+.2*u,d:cdep+.5*u},{x:0,z:lz,w:cwid*.8,d:.6*u});
    const ttop=this.liveGroup('T-top frame and canvas',g);this.roofs.push(ttop);this.roof=ttop;
    const tw=cwid*1.3,td=dd*1.45,ty=H*.95;
    for(const sx of[-1,1])for(const sz of[-1,1])p.rod([sx*tw*.42,.035*u,cz+sz*td*.42],[sx*tw*.40,ty,cz+sz*td*.42],.024*u,m.metal,ttop);
    const fp=[[-tw*.5,ty,cz-td*.5],[tw*.5,ty,cz-td*.5],[tw*.5,ty,cz+td*.5],[-tw*.5,ty,cz+td*.5]];
    p.frame(fp,.024*u,m.metal,ttop,true);
    p.slab(fp.map(a=>[a[0]*.96,a[2]*.96]),ty+.015*u,.028*u,m.dark,ttop,.02*u);
    this.roofMount={width:tw*.70,z:cz-td*.24,y:ty+.043*u,u};ttop.userData.mountSurface='T-top canopy';
    for(let k=0;k<4;k++){const rx=lerp(-tw*.32,tw*.32,k/3);p.cylinder(.032*u,.036*u,.28*u,rx,ty+.14*u,cz+td*.44,m.dark,ttop,[-.2,0,0]);}
    p.cylinder(.05*u,.07*u,.5*u,0,ty+.25*u,cz,m.body,ttop,null,12);
    // Realistic combination bi-color navigation light mounted directly on the bow deck:
    const bowSec=this.hull.section(.96),bowY=this.hull.deckHeight(bowSec.z,0)+.012*u;
    p.round(.09*u,.028*u,.11*u,0,bowY,bowSec.z,m.chrome,this.root,.014*u);
    p.cylinder(.020*u,.020*u,.028*u,-.022*u,bowY+.016*u,bowSec.z,m.port,this.root,[Math.PI/2,0,0],16);
    p.cylinder(.020*u,.020*u,.028*u,.022*u,bowY+.016*u,bowSec.z,m.green,this.root,[Math.PI/2,0,0],16);
    const rail=p.pipe([[-dw*.72,.06*u,-dd*.95],[dw*.72,.06*u,-dd*.95],[dw*.72,.06*u,dd*.95],[-dw*.72,.06*u,dd*.95],[-dw*.72,.06*u,-dd*.95]],.018*u,m.rail,g,true,80);this.railAudit.push(rail.userData.pathAudit);
    for(let i=0;i<2+(d.motif%3);i++){const side=i%2?-1:1;this.trinket(side*dw*.5,.06*u,lerp(-dd*.8,dd*.7,this.fitR.next()),u,g,this.fitR);}
    const be=new THREE.Group();this.root.add(be);this.attach(be,.965,.5,1,.012);p.torus(.055*u,.015*u,0,0,0,m.metal,be);
    this.helm={group:g,start:V(hx*.35,1.62*u,lz-.78*u),minX:-dw*.68,maxX:dw*.68,minZ:-dd*.92,maxZ:dd*.92,unit:u};
    this.equipment.add('Open center-console helm with T-top');
  }
  // MOORING AND DRAINAGE HARDWARE at seeded positions: cleats, bow eye, scuppers.
  deckHardware(){
    const d=this.dna,p=this.p,m=this.m,r=d.stream('hardware'),u=clamp(d.L/38,.5,2.2);
    const n=r.int(4,8);
    for(let i=0;i<n;i++){
      const t=i%2===0?r.range(.6,.92):r.range(.04,.32),side=i<n/2?1:-1,s=this.hull.section(t),x=side*s.width*.80,z=s.z,y=this.hull.deckHeight(z,x)+.012*u,g=new THREE.Group();g.position.set(x,y,z);this.root.add(g);
      const cw=r.range(.16,.32)*u;p.round(cw,.032*u,.055*u,0,.022*u,0,m.metal,g,.012*u);for(const e of[-1,1])p.round(.04*u,.065*u,.055*u,e*cw*.42,.005*u,0,m.metal,g,.012*u);
      p.round(cw*1.18,.012*u,.085*u,0,.006*u,0,m.dark,g,.004*u);
    }
    const bow=this.hull.section(.98),be=new THREE.Group();be.position.set(0,this.hull.deckHeight(bow.z,0)+.012*u,bow.z);this.root.add(be);p.torus(.06*u,.016*u,0,.025*u,0,m.metal,be);p.round(.14*u,.018*u,.09*u,0,.008*u,0,m.dark,be,.006*u);
    for(let i=0;i<r.int(2,4);i++){const g=new THREE.Group();this.root.add(g);this.attach(g,r.range(.12,.5),.08,i%2?1:-1,.004);p.cylinder(.032*u,.032*u,.018*u,0,0,0,m.dark,g,[Math.PI/2,0,0],12);}
    this.equipment.add('Mooring cleats, bow eye and deck scuppers');
  }
  lifeAboard(){
    const d=this.dna,p=this.p,m=this.m,r=this.r;if(d.tier===4)return;
    const u=d.tier===0?.72:clamp(d.L/38,.45,2.2),items=(d.tier===0?3:2)+(d.motif%4)+(d.tier>=2?2:0);
    const lr=d.stream('life-aboard');
    for(let i=0;i<items;i++){
      const t=0.12+((d.hash+i*97)%80)/100*0.7,s=this.hull.section(t),side=((d.ornament+i)%2)?-1:1;
      const x=side*s.width*r.range(.15,.55),z=s.z,y=this.hull.deckHeight(z,x)+.04;
      // Only keep clear of a real wheelhouse; open boats have none.
      if(d.tier>0&&Math.abs(z-(this.bridgeZ??d.bridgeZ))<(this.houseL||d.bridgeL)*.6)continue;
      if(lr.next()>.45){this.trinket(x,y,z,u,this.root,lr);continue;}
      const kind=(d.motif+i+d.layoutBit)%7;
      if(kind===0){p.round(.28*u,.22*u,.36*u,x,y+.11*u,z,m.crate,this.root,.04*u);p.round(.26*u,.04*u,.34*u,x,y+.23*u,z,m.dark,this.root,.02*u);}
      else if(kind===1){p.cylinder(.11*u,.13*u,.22*u,x,y+.11*u,z,r.pick([m.orange,m.accent,m.rubber]),this.root);p.torus(.12*u,.012*u,x,y+.22*u,z,m.rope,this.root,[Math.PI/2,0,0]);}
      else if(kind===2){p.round(.34*u,.18*u,.22*u,x,y+.09*u,z,m.dark,this.root,.03*u);p.round(.32*u,.04*u,.20*u,x,y+.19*u,z,m.accent,this.root,.02*u);}
      else if(kind===3){p.cylinder(.09*u,.08*u,.28*u,x,y+.14*u,z,m.metal,this.root);p.sphere(.09*u,.05*u,.09*u,x,y+.30*u,z,m.metal,this.root);}
      else if(kind===4){this.ropeCoil(x,y,z,.16*u);}
      else if(kind===5){p.round(.16*u,.12*u,.16*u,x,y+.06*u,z,m.orange,this.root,.04*u);p.cylinder(.03*u,.03*u,.18*u,x,y+.18*u,z,m.wood,this.root);}
      else {p.round(.20*u,.10*u,.14*u,x,y+.05*u,z,m.bookMats[i%5],this.root,.02*u);}
    }
    this.equipment.add('Seeded working clutter unique to this brief');
  }
}
