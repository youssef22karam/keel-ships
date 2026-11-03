import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {TAU, V} from './util.js';
import {jit} from './palettes.js';
import {drawNauticalChart} from './charts.js';

export class Materials{
  constructor(d){
    this.dna=d;this.all=[];this.textures=new Set();this.displays=[];const p=d.palette,r=d.stream('materials');
    const noise=this.noise(r);this.hull=this.std('Satin marine enamel',p.hull,{roughness:.4,metalness:.18,bumpMap:noise,bumpScale:.006});this.bottom=this.std('Faired antifouling',p.bottom,{roughness:.72,metalness:.08});this.boot=this.std('Continuous boot stripe',p.trim,{roughness:.48,metalness:.12});this.body=this.std('Marine superstructure enamel',p.body,{roughness:.35,metalness:.18});this.accent=this.std('Equipment enamel',p.accent,{roughness:.36,metalness:.22});this.dark=this.std('Graphite framing',p.trim,{roughness:.43,metalness:.35});this.deck=this.std('Fine non-slip deck',p.deck,{roughness:.92,bumpMap:noise,bumpScale:.018});
    this.metal=this.std('Brushed stainless steel','#b0b8ae',{metalness:.86,roughness:.28});this.chrome=this.std('Polished steel','#cbd1c6',{metalness:.94,roughness:.17});this.rail=this.std('Ivory powder-coated rail','#dedfd0',{metalness:.3,roughness:.38});this.rubber=this.std('Soft marine rubber','#24342e',{roughness:.92});this.rope=this.std('Braided flax line','#a79976',{roughness:1,bumpMap:noise,bumpScale:.018});this.net=this.std('Trawl net','#46594c',{roughness:1});this.bronze=this.std('Satin aged brass','#ae8a50',{metalness:.83,roughness:.29});this.orange=this.std('Safety vermilion','#c97040',{roughness:.55});this.red=this.std('Safety red','#a73c32',{roughness:.45});this.paper=this.std('Ivory chart paper','#e1dcc2',{roughness:.92});this.crate=this.std('Fish box','#b1b3a0',{roughness:.85});this.innerWood=this.std('Dark walnut joinery','#aa8c68',{roughness:.58,side:THREE.DoubleSide});
    this.green=this.std('Starboard navigation','#4a805b',{emissive:'#5ac389',emissiveIntensity:.6});this.port=this.std('Port navigation','#a4503e',{emissive:'#e65c44',emissiveIntensity:.6});this.led=this.std('Warm recessed light','#fff1d5',{emissive:'#ffe0ac',emissiveIntensity:1.7,roughness:.25});
    this.glass=new THREE.MeshPhysicalMaterial({name:'Low-iron marine glazing',color:'#91b5aa',roughness:.09,metalness:.04,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide,clearcoat:1,envMapIntensity:1.25});this.all.push(this.glass);
    // Budget-scaled surface language: painted plywood and vinyl on cheap boats,
    // joinery and brass only where the brief can afford it.
    const finish=d.finish,fit=d.stream('fitout-surfaces:'+d.revision+':'+d.tier);
    const surface={
      workboat:{wood:['#b09a74','#b6a07d','#a98f69'],head:'#c9cbc0',console:'#46584f',trim:'metal',seat:['#57676b','#5f6c68','#4f6167'],piping:'#98a39a',floor:'#a99b7c',rug:'#6d7365'},
      painted:{wood:['#d3c4a6','#cfc0a1','#c8bd9f'],head:'#e0e0d3',console:'#54635a',trim:'chrome',seat:['#68797a','#708079','#5f7173'],piping:'#c3c6b8',floor:'#bdb49a',rug:'#77806f'},
      teak:{wood:['#b79468','#bd9d74','#b08c60'],head:'#e7e3d5',console:'#263c38',trim:'bronze',seat:['#6c6956','#69705c','#59634f'],piping:'#b5a38b',floor:'#c4a77e',rug:'#5a6350'},
      walnut:{wood:['#896348','#936e50','#805e48'],head:'#e6e3d4',console:'#263c38',trim:'bronze',seat:['#59634f','#69705c','#6c6956'],piping:'#b5a38b',floor:'#c4a77e',rug:'#5a6350'},
      ivory:{wood:['#b79a70','#b79f7c','#bea783'],head:'#e6e3d4',console:'#d2d2bf',trim:'bronze',seat:['#5c6e72','#617879','#7b8173'],piping:'#b5a38b',floor:'#c4a77e',rug:'#5a6350'},
      graphite:{wood:['#72654f','#796f59','#686452'],head:'#6a7165',console:'#263c38',trim:'chrome',seat:['#444d45','#515e57','#525e62'],piping:'#848b79',floor:'#c4a77e',rug:'#4d5a4e'}
    }[finish]||{wood:['#896348','#936e50','#805e48'],head:'#e6e3d4',console:'#263c38',trim:'bronze',seat:['#59634f','#69705c','#6c6956'],piping:'#b5a38b',floor:'#c4a77e',rug:'#5a6350'};
    const bare=d.grade==='workboat';
    this.wood=this.std(bare?'Painted plywood joinery':'Quarter-sawn joinery',jit(fit.pick(surface.wood),fit,.03,.12,.09),{map:this.woodTexture(fit),roughness:bare?.78:.44,metalness:.02});
    this.floor=this.std(bare?'Non-slip painted sole':'Caulked teak floor',surface.floor,{map:this.plankTexture(fit),roughness:bare?.85:.7});
    this.ivory=this.std('Headliner',surface.head,{roughness:.88});
    this.console=this.std('Helm housing',surface.console,{roughness:bare?.58:.43,metalness:bare?.22:.15});
    this.top=this.std('Instrument surface','#28352f',{roughness:.7,bumpMap:noise,bumpScale:.007});
    this.trim=surface.trim==='chrome'?this.chrome:surface.trim==='metal'?this.metal:this.bronze;
    const fabric=this.fabricTexture(fit),seatColor=fit.pick(surface.seat);
    this.leather=this.std(bare?'Marine vinyl seat':'Stitched marine upholstery',seatColor,{roughness:bare?.70:.76,bumpMap:fabric,bumpScale:bare?.004:.009});
    this.piping=this.std('Upholstery piping',surface.piping,{roughness:.85});
    this.rug=this.std('Floor covering',surface.rug,{map:fabric,roughness:1});
    this.ceramic=this.std('Glazed stoneware',fit.pick(['#d5d5bf','#aebbb0','#c8bc9e']),{roughness:.22,metalness:.03});
    this.coffee=this.std('Coffee','#30221a',{roughness:.2});
    this.leaf=this.std('Botanical leaves','#405c35',{roughness:.7,side:THREE.DoubleSide});
    this.bookMats=['#596f68','#b59965','#a5684f','#314a52','#b5b4a0'].map((c,i)=>this.std('Cloth-bound almanac '+i,c,{roughness:.9}));
  }
  std(name,color,props={}){const mat=new THREE.MeshStandardMaterial({name,color,...props});this.all.push(mat);return mat;}
  texture(canvas,repeat=null){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);}this.textures.add(t);return t;}
  canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')];}
  noise(r){const[c,x]=this.canvas(128,128),im=x.createImageData(128,128);for(let i=0;i<im.data.length;i+=4){const v=r.int(109,146);im.data.set([v,v,v,255],i);}x.putImageData(im,0,0);const t=this.texture(c,[10,10]);t.colorSpace=THREE.NoColorSpace;return t;}
  woodTexture(r){const[c,x]=this.canvas(512,1024);x.fillStyle='#d2bd9e';x.fillRect(0,0,512,1024);for(let i=0;i<550;i++){const a=r.range(0,512);x.strokeStyle=`rgba(68,43,24,${r.range(.025,.13)})`;x.lineWidth=r.range(.3,1.3);x.beginPath();x.moveTo(a,0);x.bezierCurveTo(a+Math.sin(i)*12,320,a-8,670,a+5,1024);x.stroke();}for(let i=0;i<12;i++){const a=r.range(0,512),b=r.range(0,1024);x.strokeStyle='#51361c15';x.beginPath();x.ellipse(a,b,r.range(2,5),r.range(40,110),.03,0,TAU);x.stroke();}return this.texture(c,[1,1]);}
  plankTexture(r){const[c,x]=this.canvas(1024,1024);for(let j=0;j<12;j++){const px=j*1024/12;x.fillStyle=`hsl(${r.int(32,38)} 27% ${r.int(56,68)}%)`;x.fillRect(px,0,1024/12,1024);x.fillStyle='#4a4535';x.fillRect(px,0,2,1024);for(let i=0;i<32;i++){x.strokeStyle=`rgba(65,43,24,${r.range(.025,.11)})`;const a=px+r.range(4,79);x.beginPath();x.moveTo(a,0);x.bezierCurveTo(a+3,300,a-3,700,a+1,1024);x.stroke();}const yy=(j%3)*320+60;x.fillStyle='#68573c88';x.fillRect(px+2,yy,82,1);for(const dx of [8,73]){x.fillStyle='#8b7651';x.beginPath();x.arc(px+dx,yy+7,1.5,0,TAU);x.fill();}}return this.texture(c,[1.5,2]);}
  fabricTexture(r){const[c,x]=this.canvas(128,128);x.fillStyle='#b4b1a0';x.fillRect(0,0,128,128);for(let i=0;i<128;i+=2){x.strokeStyle=i%4?'#9c9d9055':'#e2dfc055';x.beginPath();x.moveTo(i,0);x.lineTo(i,128);x.moveTo(0,i);x.lineTo(128,i);x.stroke();}return this.texture(c,[9,9]);}
  label(text,color='#e0e5d2',bg=null,aspect=7,font=500){const[c,x]=this.canvas(1024,Math.round(1024/aspect));if(bg){x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);}x.fillStyle=color;x.font=`${font} ${c.height*.56}px Arial`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,512,c.height*.53,990);const mat=new THREE.MeshBasicMaterial({name:'Lettering: '+text,map:this.texture(c),transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});this.all.push(mat);return mat;}
  display(kind,aspect=1.5){const[c,x]=this.canvas(kind==='overhead'?1536:768,Math.round((kind==='overhead'?1536:768)/aspect)),texture=this.texture(c);const mat=new THREE.MeshBasicMaterial({name:'Live '+kind+' instrument',map:texture,toneMapped:false});this.all.push(mat);this.displays.push({kind,canvas:c,ctx:x,texture});return mat;}
  chartPaper(){const[c,x]=this.canvas(768,512);drawNauticalChart(x,768,512,0,true);return this.std('Printed coastal chart','#ffffff',{map:this.texture(c),roughness:.9});}
  dial(kind='clock'){const[c,x]=this.canvas(512,512);x.fillStyle='#dedbc7';x.fillRect(0,0,512,512);x.translate(256,256);for(let i=0;i<60;i++){const a=i*TAU/60;x.strokeStyle='#4c5648';x.lineWidth=i%5?2:4;x.beginPath();x.moveTo(Math.sin(a)*(i%5?211:198),-Math.cos(a)*(i%5?211:198));x.lineTo(Math.sin(a)*223,-Math.cos(a)*223);x.stroke();}x.textAlign='center';x.textBaseline='middle';x.fillStyle='#4c5648';x.font='27px Georgia';for(let i=1;i<=12;i++){const a=i*TAU/12;x.fillText(kind==='clock'?i:String(970+i*5),Math.sin(a)*166,-Math.cos(a)*166);}x.font='500 19px Arial';x.fillText(kind==='clock'?'KEEL / CHRONOMETER':'BAROMETRIC PRESSURE',0,76);x.font='13px Arial';x.fillText(kind==='clock'?'NORTH ATLANTIC':'CHANGE  /  FAIR',0,104);const mat=new THREE.MeshStandardMaterial({name:kind+' enamel dial',map:this.texture(c),roughness:.44});this.all.push(mat);return mat;}
  artwork(r){const[c,x]=this.canvas(768,480),g=x.createLinearGradient(0,0,0,480);g.addColorStop(0,'#91aaa9');g.addColorStop(.55,'#e0cdb0');g.addColorStop(.56,'#667e79');g.addColorStop(1,'#294a4d');x.fillStyle=g;x.fillRect(0,0,768,480);x.fillStyle='#f2ddaf';x.beginPath();x.arc(575,155,34,0,TAU);x.fill();for(let i=0;i<170;i++){const y=r.range(275,480);x.strokeStyle=`rgba(210,216,186,${r.range(.03,.3)})`;x.lineWidth=r.range(1,3);x.beginPath();const a=r.range(0,768);x.moveTo(a,y);x.lineTo(a+r.range(10,80),y);x.stroke();}x.fillStyle='#2f4544';x.beginPath();x.moveTo(205,319);x.lineTo(439,319);x.lineTo(405,355);x.lineTo(237,350);x.closePath();x.fill();x.fillStyle='#d4c8a6';x.fillRect(300,273,58,46);x.fillStyle='#3e5250';x.fillRect(308,283,17,18);x.fillRect(331,283,18,18);x.lineWidth=5;x.strokeStyle='#334a47';x.beginPath();x.moveTo(325,274);x.lineTo(325,207);x.lineTo(363,242);x.stroke();return this.std('Original procedural seascape','#ffffff',{map:this.texture(c),roughness:.87});}
}
export class Parts{
  constructor(root){this.root=root;}
  mesh(geo,mat,pos=[0,0,0],rot=null,parent=this.root){const a=new THREE.Mesh(geo,mat);a.position.set(...pos);if(rot)a.rotation.set(...rot);a.castShadow=!mat.transparent;a.receiveShadow=true;parent.add(a);return a;}
  box(w,h,d,x,y,z,mat,parent=this.root,rot=null){return this.mesh(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],rot,parent);}
  round(w,h,d,x,y,z,mat,parent=this.root,r=.03,rot=null){return this.mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.48,h*.48,d*.48)),mat,[x,y,z],rot,parent);}
  cylinder(rt,rb,h,x,y,z,mat,parent=this.root,rot=null,n=20){return this.mesh(new THREE.CylinderGeometry(rt,rb,h,n),mat,[x,y,z],rot,parent);}
  sphere(rx,ry,rz,x,y,z,mat,parent=this.root){const a=this.mesh(new THREE.SphereGeometry(1,24,16),mat,[x,y,z],null,parent);a.scale.set(rx,ry,rz);return a;}
  torus(r,t,x,y,z,mat,parent=this.root,rot=null,arc=TAU){return this.mesh(new THREE.TorusGeometry(r,t,8,40,arc),mat,[x,y,z],rot,parent);}
  rod(a,b,r,mat,parent=this.root,n=10){a=Array.isArray(a)?V(...a):a;b=Array.isArray(b)?V(...b):b;const delta=b.clone().sub(a);if(delta.lengthSq()<1e-12)return null;const o=this.cylinder(r,r,delta.length(),...a.clone().add(b).multiplyScalar(.5).toArray(),mat,parent,null,n);o.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());return o;}
  pipe(pts,r,mat,parent=this.root,closed=false,steps=null){const points=pts.map(a=>Array.isArray(a)?V(...a):a.clone());if(closed&&points[0].distanceToSquared(points.at(-1))<1e-10)points.pop();const c=new THREE.CatmullRomCurve3(points,closed,'centripetal'),segments=steps||Math.max(32,points.length*3),geo=new THREE.TubeGeometry(c,segments,r,8,closed),a=this.mesh(geo,mat,[0,0,0],null,parent);a.userData.closedPath=closed;if(closed){const pos=geo.getAttribute('position');let seam=0;for(let j=0;j<=8;j++)seam=Math.max(seam,V().fromBufferAttribute(pos,j).distanceTo(V().fromBufferAttribute(pos,segments*9+j)));a.userData.pathAudit={closed:true,start:c.getPoint(0),end:c.getPoint(1),seamError:seam};}return a;}
  quad(a,b,c,d,mat,parent=this.root){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...d],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return this.mesh(g,mat,[0,0,0],null,parent);}
  slab(points,y,h,mat,parent=this.root,bevel=0){const s=new THREE.Shape(points.map(a=>new THREE.Vector2(a[0],-a[1])));return this.mesh(new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:bevel>0,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:16}),mat,[0,y,0],[-Math.PI/2,0,0],parent);}
  footprint(w,d,cut=.12){return[[-w*.5,-d*(.5-cut)],[-w*(.5-cut),-d*.5],[w*(.5-cut),-d*.5],[w*.5,-d*(.5-cut)],[w*.5,d*(.5-cut)],[w*(.5-cut),d*.5],[-w*(.5-cut),d*.5],[-w*.5,d*(.5-cut)]];}
  label(text,w,h,x,y,z,mat,parent=this.root,rot=null){return this.mesh(new THREE.PlaneGeometry(w,h),mat,[x,y,z],rot,parent);}
  frame(points,r,mat,parent=this.root,closed=false){const a=closed?[...points,points[0]]:points;for(let i=1;i<a.length;i++)this.rod(a[i-1],a[i],r,mat,parent,8);return null;}
}
