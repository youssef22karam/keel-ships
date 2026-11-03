import * as THREE from 'three';
import {VesselBuilder} from '../vessel-builder.js';

Object.assign(VesselBuilder.prototype,{
  // A CHEAP COASTAL BOAT'S INTERIOR: painted steel shelf, open lockers, vinyl bench,
  // logbook, thermos, a clock and a fire bottle. Honest, simple, and worth its budget.
  workboatInterior(g,o){
    const{W,D,H,u,doorW,consoleZ}=o,p=this.p,m=this.m,d=this.dna,back=-D*.5+.07*u,S=d.helmSide;
    const bw=Math.min(W*.34,1.30*u),bx=-S*(doorW*.60+bw*.5);
    // Wall shelf with stanchions:
    p.round(bw,.034*u,.27*u,bx,1.24*u,back+.16*u,m.metal,g,.009*u);
    for(const s of[-1,1])p.rod([bx+s*bw*.44,1.09*u,back+.26*u],[bx+s*bw*.44,1.24*u,back+.09*u],.013*u,m.metal,g);
    // Shelf contents: deck log, thermos, spare VHF battery:
    p.round(.25*u,.058*u,.18*u,bx-bw*.22,1.285*u,back+.15*u,m.bookMats[1],g,.008*u,[0,.14,0]);
    p.cylinder(.044*u,.044*u,.155*u,bx+bw*.22,1.34*u,back+.15*u,m.metal,g,null,16);
    p.cylinder(.048*u,.048*u,.010*u,bx+bw*.22,1.42*u,back+.15*u,m.dark,g,null,16);
    p.round(.17*u,.115*u,.12*u,bx+bw*.02,1.31*u,back+.15*u,m.dark,g,.013*u);
    // Open wire basket below with a coiled line:
    p.round(bw,.40*u,.33*u,bx,.29*u,back+.20*u,m.metal,g,.013*u);
    p.round(bw*.94,.014*u,.28*u,bx,.48*u,back+.20*u,m.dark,g,.005*u);
    const rope=[];for(let i=0;i<110;i++){const a=i*.29,rr=.115*u*(.45+.55*i/109);rope.push([bx+Math.cos(a)*rr,.52*u+Math.abs(Math.sin(a*.5))*.012*u,back+.20*u+Math.sin(a)*rr]);}p.pipe(rope,.011*u,m.rope,g,false,140);
    this.colliders.push({x:bx,z:back+.20*u,w:bw+.10*u,d:.45*u});
    // Vinyl bench opposite the helm:
    const lx=-S*(doorW*.60+bw*.5),len=Math.min(W*.34,1.30*u);
    p.round(len,.36*u,.46*u,lx,.24*u,back+.25*u,m.metal,g,.016*u);
    p.round(len-.04*u,.11*u,.42*u,lx,.47*u,back+.25*u,m.leather,g,.045*u);
    p.round(len-.04*u,.44*u,.11*u,lx,.76*u,back+.07*u,m.leather,g,.040*u,[-.06,0,0]);
    for(const s of[-1,1])p.rod([lx+s*len*.42,.47*u,back+.06*u],[lx+s*len*.42,.96*u,back+.05*u],.015*u,m.metal,g);
    this.colliders.push({x:lx,z:back+.24*u,w:len+.10*u,d:.55*u});
    // Practical bulkhead items:
    this.wallClock(-S*W*.20,H*.66,back+.04*u,.115*u,g,'clock');
    this.extinguisher(S*doorW*.60,.40*u,back+.09*u,.78*u,g);
    // Oilskin jacket on hooks:
    const ox=S*doorW*.30;
    for(const e of[-1,1])p.rod([ox+e*.09*u,1.66*u,back+.04*u],[ox+e*.09*u,1.61*u,back+.13*u],.011*u,m.metal,g);
    p.box(.30*u,.50*u,.075*u,ox,1.36*u,back+.09*u,m.orange,g);
    p.round(.21*u,.13*u,.09*u,ox,1.66*u,back+.09*u,m.orange,g,.03*u);
  },
  // Working gear stowed against the wheelhouse bulkhead: coiled lines, bucket, deck brush.
  gearStowage(g,o){
    const{W,D,H,u,doorW}=o,p=this.p,m=this.m,S=this.dna.helmSide,back=-D*.5+.07*u;
    const x=-S*(W*.30);
    p.rod([x,1.34*u,back+.03*u],[x,1.50*u,back+.03*u],.015*u,m.metal,g);
    const coil=[];for(let i=0;i<140;i++){const a=i*.28,rr=.13*u*(.4+.6*i/139);coil.push([x+Math.cos(a)*rr,1.10*u+Math.sin(a)*rr,back+.075*u]);}p.pipe(coil,.011*u,m.rope,g,false,170);
    p.cylinder(.10*u,.115*u,.20*u,x-.34*u,.10*u,back+.22*u,m.accent,g,null,20);
    p.torus(.10*u,.010*u,x-.34*u,.20*u,back+.22*u,m.dark,g,[Math.PI/2,0,0]);
    p.rod([x-.34*u,.06*u,back+.22*u],[x-.30*u,.66*u,back+.30*u],.014*u,m.wood,g);
    p.round(.17*u,.028*u,.11*u,x-.30*u,.68*u,back+.31*u,m.dark,g,.008*u);
  },
  fineJoinery(g,o){
    const{W,D,H,u,seatZ,doorW}=o,p=this.p,m=this.m,d=this.dna,r=this.fitR,back=-D*.5+.09*u,sideRun=W*.365-doorW*.66;
    if(sideRun<.65*u)return;
    const S=d.helmSide; // settee opposite the helm, navigator's desk behind the skipper
    const length=Math.min(sideRun-.10*u,2.15*u)*r.range(.91,1),cx=S*(doorW*.65+length*.5),depth=.55*u;

    if(d.hasSettee){
      p.round(length,.38*u,depth,cx,.28*u,back+depth*.5,m.wood,g,.040*u);
      p.round(length+.012*u,.060*u,depth+.01*u,cx,.48*u,back+depth*.5,m.trim,g,.022*u);
      const n=Math.max(2,Math.round(length/(.60*u)));
      for(let i=0;i<n;i++){
        const xx=cx+(i-(n-1)*.5)*length/n,sw=length/n-.016*u;
        p.round(sw,.12*u,.50*u,xx,.57*u,back+.30*u,m.leather,g,.055*u);
        p.round(sw,.46*u,.11*u,xx,.88*u,back+.10*u,m.leather,g,.050*u,[-.07,0,0]);
      }
      // Framed seascape oil painting above the settee:
      const frameW=Math.min(length*.82,1.45*u),frameH=frameW*.62,fy=Math.min(H-.52*u,1.88*u);
      p.round(frameW+.09*u,frameH+.09*u,.040*u,cx,fy,back-.015*u,m.trim,g,.010*u);
      p.round(frameW+.05*u,frameH+.05*u,.048*u,cx,fy,back+.001*u,m.wood,g,.009*u);
      // Oil painting only aboard the yachts; a standard boat gets a framed tide table.
      p.mesh(new THREE.PlaneGeometry(frameW,frameH),d.grade==='luxury'?m.artwork(r):m.chartPaper(),[cx,fy,back+.028*u],null,g);
      this.colliders.push({x:cx,z:back+.28*u,w:length+.10*u,d:.65*u});
    }else{
      // Alternative: tall stowage lockers and oilskin hanging rail
      p.round(length,1.62*u,.44*u,cx,.81*u,back+.24*u,m.wood,g,.030*u);
      for(let k=0;k<3;k++)p.round(length*.92,.030*u,.028*u,cx,.42*u+k*.52*u,back+.47*u,m.trim,g,.008*u);
      this.colliders.push({x:cx,z:back+.26*u,w:length+.10*u,d:.55*u});
    }

    // Navigator's chart table, library and instruments:
    const dw=Math.min(sideRun-.10*u,1.60*u),dx=-S*(doorW*.65+dw*.5),dz=back+.28*u;
    if(d.hasChartTable){
      this.chartTable(dx,dz,dw,.55*u,u,g);
      this.bookshelf(dx,1.44*u,back+.09*u,Math.min(dw,1.20*u),u,g);
      this.deskLamp(dx+dw*.35,.92*u,dz-.15*u,u,g);
      this.plant(dx-dw*.34,.92*u,dz-.12*u,.75*u,g);
      this.colliders.push({x:dx,z:dz,w:dw+.08*u,d:.66*u});
    }
    this.wallClock(dx-.20*u,Math.min(H-.34*u,2.15*u),back+.04*u,.12*u,g,'clock');
    this.wallClock(dx+.19*u,Math.min(H-.34*u,2.15*u),back+.04*u,.11*u,g,'barometer');
    this.extinguisher(-S*doorW*.62,.40*u,back+.10*u,.82*u,g);
  }
});
