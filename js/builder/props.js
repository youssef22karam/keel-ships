import * as THREE from 'three';
import {TAU, V} from '../util.js';
import {VesselBuilder} from '../vessel-builder.js';

Object.assign(VesselBuilder.prototype,{
  chartTable(x,z,w,depth,u,g){
    const p=this.p,m=this.m;
    p.round(w,.75*u,depth,x,.48*u,z,m.wood,g,.024*u);
    p.round(w+.05*u,.052*u,depth+.05*u,x,.89*u,z,m.wood,g,.024*u);
    p.round(w*.95,.042*u,.024*u,x,.92*u,z+depth*.5,m.trim,g,.009*u);
    for(let k=0;k<3;k++){
      const y=.26*u+k*.20*u;
      p.round(w*.90,.17*u,.024*u,x,y,z+depth*.5+.012*u,m.wood,g,.007*u);
      p.rod([x-.09*u,y+.02*u,z+depth*.5+.040*u],[x+.09*u,y+.02*u,z+depth*.5+.040*u],.008*u,m.trim,g);
    }
    // Printed Admiralty navigation chart on table:
    const chart=m.chartPaper();
    p.mesh(new THREE.PlaneGeometry(w*.64,depth*.70),chart,[x-.05*u,.925*u,z+.020*u],[-Math.PI/2,0,-.03],g);
    p.rod([x-.20*u,.934*u,z+.04*u],[x+.16*u,.934*u,z+.09*u],.006*u,m.bronze,g); // Brass parallel ruler
    p.rod([x+.16*u,.934*u,z+.09*u],[x+.20*u,.934*u,z-.04*u],.005*u,m.chrome,g); // Chrome dividers
  },
  bookshelf(x,y,z,w,u,g){
    const p=this.p,m=this.m,r=this.fitR,d=this.dna,cap=d.grade==='luxury'?24:9;
    p.round(w+.05*u,.038*u,.23*u,x,y,z,m.wood,g,.010*u);
    for(const s of [-1,1])p.round(.024*u,.30*u,.23*u,x+s*w*.51,y+.13*u,z,m.wood,g,.007*u);
    p.rod([x-w*.5,y+.12*u,z+.11*u],[x+w*.5,y+.12*u,z+.11*u],.008*u,m.trim,g);
    const titles=['TIDES','PILOT','NORTH SEA','ALMANAC','LOGBOOK','BOWDITCH','SEAMANSHIP','WEATHER'];
    let bx=x-w*.46,index=0;
    while(bx<x+w*.44){
      const bw=r.range(.036,.064)*u,bh=r.range(.18,.26)*u,mat=m.bookMats[index%5],book=new THREE.Group();
      book.position.set(bx+bw*.5,y+.024*u+bh*.5,z+.004*u);g.add(book);
      p.round(bw,bh,.17*u,0,0,0,mat,book,.004*u);
      p.box(bw*.78,bh*.92,.14*u,0,0,-.013*u,m.paper,book);
      const label=m.label(titles[index%titles.length],'#ded3ad',null,12,500);
      p.label('Spine',bh*.68,bw*.48,0,0,.088*u,label,book,[0,0,Math.PI/2]);
      bx+=bw+.006*u;index++;if(index>cap)break;
    }
  },
  wallClock(x,y,z,R,g,kind){
    const p=this.p,m=this.m;
    p.cylinder(R*1.06,R*1.06,R*.20,x,y,z,m.trim,g,[Math.PI/2,0,0],40);
    p.torus(R,.011*(R/.12),x,y,z+R*.12,m.trim,g);
    p.mesh(new THREE.CircleGeometry(R*.88,40),m.dial(kind),[x,y,z+R*.12],null,g);
    const pivot=this.liveGroup(kind+' live hands',g,[x,y,z+R*.14]);
    if(kind==='clock'){
      const hour=this.liveGroup('Chronometer hour hand',pivot),minute=this.liveGroup('Chronometer minute hand',pivot);
      p.round(R*.050,R*.55,.003,0,R*.22,.003,m.dark,hour,R*.02);
      p.round(R*.032,R*.75,.003,0,R*.32,.005,m.dark,minute,R*.012);
      this.animators.push({kind:'clock',hour,minute});
    }else{
      pivot.rotation.z=-.65;p.rod([0,-R*.10,.003],[0,R*.65,.003],R*.016,m.dark,pivot);
    }
    p.cylinder(R*.050,R*.050,.010,0,0,.014,m.bronze,pivot,[Math.PI/2,0,0],16);
  },
  mug(x,y,z,u,g){
    const p=this.p,m=this.m;
    const profile=[[0,0],[.032,0],[.044,.014],[.046,.088],[.044,.096],[.038,.096],[.036,.024],[0,.024]].map(a=>new THREE.Vector2(a[0]*u,a[1]*u));
    p.mesh(new THREE.LatheGeometry(profile,28),m.ceramic,[x,y,z],null,g);
    p.torus(.025*u,.006*u,x+.056*u,y+.056*u,z,m.ceramic,g);
    p.cylinder(.036*u,.036*u,.003*u,x,y+.083*u,z,m.coffee,g,null,24);
    p.cylinder(.060*u,.060*u,.005*u,x,y+.003*u,z,m.wood,g,null,24);
  },
  binoculars(x,y,z,u,g){
    const p=this.p,m=this.m,group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=.15;g.add(group);
    for(const s of [-1,1]){
      p.cylinder(.034*u,.041*u,.15*u,s*.041*u,.036*u,0,m.rubber,group,[Math.PI/2,0,0],18);
      p.cylinder(.030*u,.030*u,.008*u,s*.041*u,.036*u,.080*u,m.glass,group,[Math.PI/2,0,0],18);
      p.torus(.037*u,.005*u,s*.041*u,.036*u,.078*u,m.chrome,group);
    }
    p.round(.065*u,.026*u,.038*u,0,.048*u,0,m.dark,group,.009*u);
  },
  vhf(x,y,z,u,g){
    const p=this.p,m=this.m;
    p.round(.20*u,.095*u,.095*u,x,y,z,m.dark,g,.014*u);
    p.round(.070*u,.032*u,.006*u,x+.046*u,y+.015*u,z-.050*u,m.green,g,.004*u);
    const coil=[];for(let i=0;i<65;i++){const a=i*TAU/7;coil.push([x+.09*u+Math.cos(a)*.012*u,y-.06*u-i*.0045*u,z+Math.sin(a)*.012*u]);}
    p.pipe(coil,.0042*u,m.rubber,g,false,90);
    p.round(.048*u,.100*u,.036*u,x+.09*u,y-.42*u,z,m.rubber,g,.011*u);
  },
  deskLamp(x,y,z,u,g){
    const p=this.p,m=this.m;
    p.cylinder(.080*u,.095*u,.022*u,x,y+.012*u,z,m.trim,g,null,28);
    p.rod([x,y+.022*u,z],[x,y+.26*u,z],.011*u,m.trim,g);
    p.rod([x,y+.26*u,z],[x-.11*u,y+.36*u,z+.050*u],.011*u,m.trim,g);
    p.sphere(.022*u,.022*u,.022*u,x,y+.26*u,z,m.trim,g);
    p.cylinder(.046*u,.095*u,.075*u,x-.11*u,y+.35*u,z+.050*u,m.trim,g,[0,0,-.3],28);
    p.cylinder(.078*u,.078*u,.005*u,x-.122*u,y+.315*u,z+.050*u,m.led,g,[0,0,-.3],28);
  },
  plant(x,y,z,u,g){
    const p=this.p,m=this.m;
    p.cylinder(.060*u,.046*u,.095*u,x,y+.048*u,z,m.ceramic,g,null,20);
    for(let i=0;i<9;i++){
      const a=i*2.4,tip=V(x+Math.cos(a)*.10*u,y+(.16+(i%3)*.025)*u,z+Math.sin(a)*.10*u);
      p.rod([x,y+.095*u,z],tip,.0024*u,m.leaf,g);
      const leaf=p.mesh(new THREE.SphereGeometry(1,8,5),m.leaf,tip.toArray(),null,g);
      leaf.scale.set(.030*u,.005*u,.068*u);leaf.rotation.set(.3,a,.4);
    }
  },
  extinguisher(x,y,z,u,g){
    const p=this.p,m=this.m;
    p.cylinder(.064*u,.060*u,.30*u,x,y,z,m.red,g,null,20);
    p.sphere(.064*u,.045*u,.064*u,x,y+.15*u,z,m.red,g);
    p.cylinder(.016*u,.017*u,.045*u,x,y+.19*u,z,m.chrome,g);
    p.round(.090*u,.016*u,.035*u,x+.024*u,y+.22*u,z,m.rubber,g,.007*u);
  }
});
