import * as THREE from 'three';
import {V, clamp, lerp, smooth} from './util.js';

// A single evaluator supplies the shell, deck boundary, trim, rails, and every hull-mounted fitting.
export class HullSculptor{
  constructor(d,overrides={}){
    Object.assign(this,{L:d.L,B:d.B,D:d.D,F:d.F,bowRise:d.bowRise,fullness:d.fullness,sternWidth:d.sternWidth,bowRake:d.bowRake,sternRake:d.sternRake,flare:d.flare,bilge:d.bilge,shoulder:d.shoulder,entrance:d.entrance,maxBeamAt:d.maxBeamAt,sternRound:d.sternRound||0,sheerKink:d.sheerKink||0,bowProfile:d.bowProfile||'raked'},overrides);
    this.stations=d.craft?.stations?(()=>{const sr=d.stream('stations');return d.craft.stations.map(([t,w])=>{let ww=t===0?Math.max(w,this.sternWidth*.4):w;if(t>0&&t<1)ww=clamp(ww*sr.range(.86,1.12),.05,1);return[t,ww];});})():[[0,this.sternWidth],[.10,.94],[this.maxBeamAt,1],[.49,.99],[this.shoulder,.85],[this.entrance,.56],[.95,.25],[1,0]];this.waterBand=this.D*.075;this.mesh=null;this.openTop=false;this.sectionCount=d.tier===0?64:128;this.sections=[];for(let i=0;i<=96;i++)this.sections.push(this.section(i/96));
  }
  widthAt(t){
    const a=this.stations;let i=0;while(i<a.length-2&&t>a[i+1][0])i++;const [x0,y0]=a[i],[x1,y1]=a[i+1],h=x1-x0,s=(y1-y0)/h;
    const tangent=j=>{if(j===0)return(a[1][1]-a[0][1])/(a[1][0]-a[0][0]);if(j===a.length-1)return(a[j][1]-a[j-1][1])/(a[j][0]-a[j-1][0]);const l=(a[j][1]-a[j-1][1])/(a[j][0]-a[j-1][0]),r=(a[j+1][1]-a[j][1])/(a[j+1][0]-a[j][0]);return l*r<=0?0:2*l*r/(l+r);};
    let m0=tangent(i),m1=tangent(i+1);if(s===0)m0=m1=0;else{const q=Math.hypot(m0/s,m1/s);if(q>3){m0*=3/q;m1*=3/q;}}
    const u=clamp((t-x0)/h,0,1),u2=u*u,u3=u2*u,w=(2*u3-3*u2+1)*y0+(u3-2*u2+u)*h*m0+(-2*u3+3*u2)*y1+(u3-u2)*h*m1;
    return this.B*.5*Math.pow(clamp(w,Math.min(y0,y1),Math.max(y0,y1)),this.fullness);
  }
  section(t){t=clamp(t,0,1);let w=this.widthAt(t);if(this.sternRound&&t<.14){const k=1-t/.14;w*=1-this.sternRound*k*k*.7;}
    if(t>.72){const k=smooth((t-.72)/.28);if(this.bowProfile==='fine')w*=lerp(1,.52,k);else if(this.bowProfile==='bluff')w*=lerp(1,1.16,k);}
    // Dory-style sheer rises again at the stern; pure sweep otherwise.
    const sternLift=this.sheerKink*this.F*Math.pow(1-t,3);
    return{t,z:(t-.5)*this.L,width:w,sheer:this.F+this.bowRise*Math.pow(smooth(clamp((t-.55)/.45,0,1)),1.3)+this.F*.045*Math.pow(1-t,7)+sternLift,bottom:-this.D+this.D*(.18*Math.pow(1-t,7)+.55*Math.pow(t,8))};}
  point(t,q,side=1){const s=this.section(t);q=clamp(q,0,1);const th=Math.acos(clamp(1-Math.pow(q,1/this.bilge),-1,1));return V(side*s.width*Math.sin(th)*(1-this.flare*(1-q)),lerp(s.bottom,s.sheer,q),s.z+this.sternRake*this.D*(1-q)*Math.pow(1-t,9)-this.bowRake*this.D*(1-q)*Math.pow(t,9));}
  atY(t,y,side=1){const s=this.section(t);return this.point(t,clamp((y-s.bottom)/(s.sheer-s.bottom),0,1),side);}
  normal(t,q,side=1){const e=.0001,a=this.point(clamp(t+e,0,1),q,side).sub(this.point(clamp(t-e,0,1),q,side)),b=this.point(t,clamp(q+e,0,1),side).sub(this.point(t,clamp(q-e,0,1),side)),n=a.cross(b).normalize();if(n.x*side<0)n.negate();return n.lengthSq()>0?n:V(side,0,0);}
  measure(z){return this.section(clamp(z/this.L+.5,0,1));}
  deckHeight(z,x=0){const s=this.measure(z);return s.sheer+this.B*.018*(s.width/(this.B*.5))*Math.max(0,1-Math.abs(x)/(s.width||1));}
  perimeter(q=1,height=0,inset=0){const pts=[],n=80;for(let i=0;i<n;i++){const t=i/n,s=this.section(t),v=this.point(t,q,1);v.x-=Math.min(inset,s.width*.2);v.y+=height;pts.push(v);}const bow=this.point(1,q,1);bow.y+=height;pts.push(bow);for(let i=n-1;i>=0;i--){const t=i/n,s=this.section(t),v=this.point(t,q,-1);v.x+=Math.min(inset,s.width*.2);v.y+=height;pts.push(v);}const port=pts.at(-1),star=pts[0];for(let k=1;k<8;k++)pts.push(port.clone().lerp(star,k/8));return pts;}
  build(p,m,parent,timber=false){
    const pos=[],uv=[],faces=[[],[],[],[]],rings=[],N=this.sectionCount;let levels=0;
    const vertex=(v,u,vv)=>{const id=pos.length/3;pos.push(v.x,v.y,v.z);uv.push(u,vv);return id;};
    const tri=(a,b,c,mat)=>{if(a===b||b===c||c===a)return;const ax=pos[b*3]-pos[a*3],ay=pos[b*3+1]-pos[a*3+1],az=pos[b*3+2]-pos[a*3+2],bx=pos[c*3]-pos[a*3],by=pos[c*3+1]-pos[a*3+1],bz=pos[c*3+2]-pos[a*3+2];if(Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)<1e-11)return;faces[mat].push(a,b,c);};
    const materialAt=y=>y<-.000001?1:y<this.waterBand-.000001?2:0;
    for(let i=0;i<=N;i++){
      const t=i/N,s=this.section(t),ys=[];for(let k=0;k<=14;k++)ys.push(lerp(s.bottom,0,k/14));for(let k=1;k<=2;k++)ys.push(this.waterBand*k/2);for(let k=1;k<=16;k++)ys.push(lerp(this.waterBand,s.sheer,k/16));levels=ys.length;
      const ids=[],bowMap=new Map();
      for(let j=0;j<levels*2-1;j++){const k=j<levels?levels-1-j:j-(levels-1),side=j<levels?-1:1,v=this.atY(t,ys[k],side);let id;if(i===N&&bowMap.has(k))id=bowMap.get(k);else{id=vertex(v,t*6,j/(levels*2-2));if(i===N)bowMap.set(k,id);}ids.push(id);}
      const center=V(0,s.sheer+this.B*.018*(s.width/(this.B*.5)),s.z);ids.push(i===N?ids[0]:vertex(center,t*6,.5));rings.push({ids,ys});
    }
    const ringSize=levels*2;
    for(let i=0;i<N;i++)for(let j=0;j<ringSize;j++){
      const next=(j+1)%ringSize,a=rings[i].ids[j],b=rings[i+1].ids[j],c=rings[i].ids[next],e=rings[i+1].ids[next];
      const mat=j>=ringSize-2?3:materialAt((pos[a*3+1]+pos[c*3+1])*.5);tri(a,c,b,mat);tri(c,e,b,mat);
    }
    const r=rings[0].ids,port=k=>r[levels-1-k],star=k=>r[levels-1+k];
    for(let k=0;k<levels-1;k++){const mat=materialAt((rings[0].ys[k]+rings[0].ys[k+1])*.5);tri(port(k),port(k+1),star(k),mat);tri(port(k+1),star(k+1),star(k),mat);}tri(port(levels-1),r.at(-1),star(levels-1),3);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const indices=[];for(let k=0;k<faces.length;k++){g.addGroup(indices.length,faces[k].length,k);indices.push(...faces[k]);}g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const mats=timber?[m.wood,m.wood,m.wood,m.floor]:[m.hull,m.bottom,m.boot,m.deck];const mesh=p.mesh(g,mats,[0,0,0],null,parent);mesh.name='Continuous welded hull and deck';mesh.userData.hull=true;this.mesh=mesh;return mesh;
  }
  // Original KEEL section-object point: theta sweeps -PI/2 (port sheer) through
  // the keel to PI/2 (starboard sheer); a positive inset pulls the surface inward.
  pointSection(s,theta,inset=0){
    const q=Math.pow(1-Math.cos(theta),this.bilge);
    return [Math.sin(theta)*Math.max(.001,s.width-inset)*(1-this.flare*(1-q)),lerp(s.bottom+inset,s.sheer,q),s.z+this.sternRake*this.D*(1-q)*Math.pow(1-s.t,9)-this.bowRake*this.D*(1-q)*Math.pow(s.t,9)];
  }
  // Original KEEL wooden shell: a single-material, open-top hull closed by a
  // transom cap and a bow cap. Used by the primitive craft (tier zero) path.
  shell(p,mat,parent,inset=0){
    const pos=[],uv=[],indices=[],n=40,N=this.sections.length-1;
    for(let i=0;i<=N;i++){const s=this.sections[i];for(let j=0;j<=n;j++){pos.push(...this.pointSection(s,-Math.PI/2+Math.PI*j/n,inset));uv.push(i/N,j/n);}}
    for(let i=0;i<N;i++)for(let j=0;j<n;j++){const a=i*(n+1)+j,b=a+n+1;indices.push(a,a+1,b,a+1,b+1,b);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const mesh=p.mesh(g,mat,[0,0,0],null,parent);mesh.name='Wooden hull shell';mesh.userData.hull=true;
    if(!this.mesh)this.mesh=mesh;this.openTop=true;
    for(const end of [0,N]){
      const s=this.sections[end],ring=[];
      for(let j=0;j<=n;j++)ring.push(this.pointSection(s,-Math.PI/2+Math.PI*j/n,inset));
      const center=ring.reduce((v,a)=>v.add(V(...a)),V()).multiplyScalar(1/ring.length).toArray(),capPos=[],capUv=[];
      for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length];capPos.push(...center,...(end===0?b:a),...(end===0?a:b));capUv.push(.5,.5,0,j/n,1,(j+1)/n);}
      const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(capPos,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(capUv,2));cap.computeVertexNormals();
      p.mesh(cap,mat,[0,0,0],null,parent);
    }
    return mesh;
  }
}
