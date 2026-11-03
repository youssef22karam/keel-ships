import * as THREE from 'three';
import {V, clamp, lerp} from '../util.js';
import {VesselBuilder} from '../vessel-builder.js';

Object.assign(VesselBuilder.prototype,{
  // The wheelhouse silhouette itself is a gene: every seed gets a different cabin shape.
  cabinPlan(W,D,cut=.12){
    const base=this.p.footprint(W,D,cut),s=this.dna.cabinShape;
    return base.map(([x,z])=>{
      const t=clamp(z/(D*.5),-1,1);
      if(s==='tapered')return[x*lerp(1,.78,Math.max(0,t)),z];
      if(s==='raked')return[x*lerp(1,.74,Math.max(0,t)),z+(t>0?D*.05:0)];
      if(s==='flared')return[x*(t<-.1?1.05:1),z];
      return[x,z];
    });
  },
  cabin(g){
    const d=this.dna,p=this.p,m=this.m,W=this.W,D=this.D,H=this.H,u=H/2.75,plan=this.cabinPlan(W,D,.12),sill=d.stream('sill').range(.78,1.0)*u,top=H-.16*u,rake=d.cabinRake*u;
    this.unit=u;
    if(d.cabinStyle==='console'){this.openConsole(g);return;}
    // Flooring and carpet aisle:
    p.slab(plan,-.045,.095,m.floor,g,.012);
    if(d.floorCover!=='bare'){
      if(d.floorCover==='runner'){
        p.slab(p.footprint(W*.30,D*.58,.015),.053,.009,m.trim,g,.007);
        p.slab(p.footprint(W*.29,D*.57,.015),.064,.009,m.rug,g,.009);
      }else{
        p.slab(p.footprint(W*.44,D*.34,.05),.052,.009,m.rug,g,.010);
      }
    }

    const edge=(a,b,y,h,thick,mat,parent=g)=>p.round(Math.hypot(b[0]-a[0],b[1]-a[1])+.016*u,h,thick,(a[0]+b[0])*.5,y,(a[1]+b[1])*.5,mat,parent,.010*u,[0,-Math.atan2(b[1]-a[1],b[0]-a[0]),0]);
    const upper=a=>[a[0]*.985,top,a[1]+(a[1]>D*.15?rake:0)],doorW=Math.min(.88*u,W*.32),doorH=2.03*u;

    // BUILD WALL BULKHEADS, SILLS, HEADERS & CRYSTAL-CLEAR PANORAMIC WINDOWS:
    for(let i=0;i<plan.length;i++){
      const a=plan[i],b=plan[(i+1)%plan.length];
      const aft=a[1]===b[1]&&a[1]<-D*.44,front=(a[1]+b[1])*.5>D*.38;
      const spans=aft?[[a,[-doorW*.55,a[1]]],[[doorW*.55,a[1]],b]]:[[a,b]];

      for(const[A,B]of spans){
        const len=Math.hypot(B[0]-A[0],B[1]-A[1]),ang=-Math.atan2(B[1]-A[1],B[0]-A[0]);
        // Solid bulkhead sill up to window sill:
        edge(A,B,sill*.5,sill,.09*u,m.body);
        // Interior wainscot lining & capping ledge:
        const midX=(A[0]+B[0])*.5,midZ=(A[1]+B[1])*.5;
        p.round(len+.01*u,sill*.92,.026*u,midX,sill*.46,midZ,m.wood,g,.008*u,[0,ang,0]);
        p.round(len+.02*u,.038*u,.12*u,midX,sill,midZ,m.trim,g,.010*u,[0,ang,0]);

        if(aft){
          // Solid aft wall above sill:
          const hh=H-sill;
          edge(A,B,sill+hh*.5,hh,.09*u,m.body);
          p.round(len+.01*u,hh*.95,.026*u,midX,sill+hh*.5,midZ,m.wood,g,.008*u,[0,ang,0]);
          continue;
        }

        // WINDOW HEADER (structural beam above window opening):
        const headerH=H-top;
        edge(A,B,H-headerH*.5,headerH,.09*u,m.body);
        p.round(len+.01*u,headerH*.92,.026*u,midX,H-headerH*.5,midZ,m.ivory,g,.008*u,[0,ang,0]);

        // PANORAMIC MARINE GLAZING (Clean flat panels with slim vertical mullions - NO ARCHED PIPE LOOPS):
        const panes=front?d.windowCount:Math.max(1,Math.round(len/(1.45*u)));
        for(let k=0;k<panes;k++){
          const at=t=>[lerp(A[0],B[0],t),lerp(A[1],B[1],t)];
          const aa=at(k/panes),bb=at((k+1)/panes);
          const a0=[aa[0],sill,aa[1]],b0=[bb[0],sill,bb[1]];
          const a1=upper(aa),b1=upper(bb);

          // 1. Crystal-clear safety glass panel:
          const glass=p.quad(a0,b0,b1,a1,m.glass,g);
          glass.castShadow=false;glass.renderOrder=2;

          // 2. Clean horizontal glazing seals (top and bottom):
          p.rod(a0,b0,.016*u,m.dark,g,8);
          p.rod(a1,b1,.018*u,m.dark,g,8);

          // 3. ONE slim vertical mullion at each pane joint (no doubled posts):
          if(k>0)p.rod(a0,a1,d.mullionWidth*u,d.grade==='workboat'?m.dark:m.wood,g,8);

          // 4. Iconic Rotary Clear-View Screen on the skipper's primary forward window:
          if(front&&k===Math.floor(panes/2)&&d.tier>=2){
            const cx=(a0[0]+b0[0])*.5,cy=sill+(top-sill)*.52,cz=(a0[2]+a1[2])*.5;
            p.torus(.20*u,.010*u,cx,cy,cz,m.trim,g);
            p.cylinder(.038*u,.038*u,.026*u,cx,cy,cz,m.dark,g,[Math.PI/2,0,0],24);
            p.cylinder(.018*u,.018*u,.034*u,cx,cy,cz+.01*u,m.chrome,g,[Math.PI/2,0,0],16);
          }

          // 5. Heavy-duty pantograph wipers on outer windscreen:
          if(front&&k!==Math.floor(panes/2)){
            const cx=(a0[0]+b0[0])*.5,cy=sill+.05*u,cz=(a0[2]+b0[2])*.5+.045*u;
            const wiper=this.liveGroup('Pantograph wiper',g,[cx,cy,cz]);
            wiper.rotation.set(Math.atan2(rake,top-sill),0,1.48);
            const wlen=Math.min(Math.hypot(b0[0]-a0[0],b0[2]-a0[2])*.68,(top-sill)*.75);
            p.cylinder(.022*u,.026*u,.035*u,0,0,0,m.dark,wiper,[Math.PI/2,0,0],12);
            p.rod([0,0,.014*u],[0,wlen,.014*u],.008*u,m.dark,wiper);
            p.rod([0,wlen*.22,.026*u],[0,wlen*1.02,.026*u],.012*u,m.rubber,wiper);
            this.animators.push({kind:'wiper',object:wiper,park:1.48});
          }
        }
      }
      // A single clean structural corner pillar per plan vertex:
      const startP=V(a[0],.06,a[1]),endP=V(...upper(a));
      p.rod(startP,endP,d.grade==='workboat'?.030*u:d.grade==='luxury'?.040*u:.036*u,d.grade==='workboat'?m.body:m.wood,g,8);
    }

    // AFT DOORWAY & LIVE AUTOMATIC DOOR:
    const back=-D*.5;
    for(const s of [-1,1])p.round(.08*u,doorH,.13*u,s*doorW*.55,doorH*.5,back,m.wood,g,.02*u);
    p.round(doorW*1.15,.04*u,.22*u,0,.07*u,back,m.trim,g,.009*u);
    const door=this.liveGroup('Aft bridge door',g,[-doorW*.5,0,back-.015*u],'door');
    this.door=door;this.doors.push({object:door,x:0,z:back,open:0,width:doorW,unit:u});
    p.round(doorW,.98*u,.065*u,doorW*.5,.58*u,0,m.wood,door,.025*u);
    for(const s of [-1,1])p.round(.055*u,doorH,.065*u,doorW*(s+1)*.5,doorH*.5,0,m.wood,door,.018*u);
    p.round(doorW,.06*u,.07*u,doorW*.5,doorH-.025*u,0,m.wood,door,.015*u);
    p.round(doorW*.87,.055*u,.075*u,doorW*.5,1.1*u,0,m.trim,door,.012*u);
    p.box(doorW*.86,.82*u,.018*u,doorW*.5,1.56*u,0,m.glass,door);
    for(const zz of [-.06,.06])p.rod([doorW*.83,.84*u,zz*u],[doorW*.83,1.04*u,zz*u],.014*u,m.bronze,door);

    // REMOVABLE BRIDGE ROOF & ACOUSTIC HEADLINER:
    this.roof=this.liveGroup('Removable bridge roof',g);this.roofs.push(this.roof);
    const roofPlan=plan.map(a=>[a[0]*1.065,a[1]*1.065+(a[1]>D*.15?rake:0)]);
    p.slab(roofPlan,H-.04*u,.16*u,m.body,this.roof,.035*u);
    this.roofMount={width:W*.72,z:-D*.30,y:H+.12*u,u};this.roof.userData.mountSurface='wheelhouse roof';
    p.slab(plan.map(a=>[a[0]*1.01,a[1]*1.01+(a[1]>D*.15?rake:0)]),H-.10*u,.048*u,m.ivory,this.roof,.018*u);
    // Headliner character varies per vessel: teak battens, flush panels, or slim ribs.
    const beams=Math.max(3,Math.floor(D/(d.ceilingStyle==='ribs'?.52*u:.7*u)));
    for(let k=0;k<beams;k++){
      const zz=lerp(-D*.38,D*.38,k/(beams-1));
      if(d.ceilingStyle==='battens')p.round(W*.84,.040*u,.040*u,0,H-.115*u,zz,m.wood,this.roof,.010*u);
      else if(d.ceilingStyle==='ribs')p.round(W*.80,.018*u,.022*u,0,H-.108*u,zz,m.trim,this.roof,.006*u);
      else p.round(W*.82,.014*u,D*.30/beams,0,H-.106*u,zz,m.ivory,this.roof,.010*u);
    }
    // Recessed LED lights & overhead grab rails:
    for(const s of [-1,1]){
      p.round(.022*u,.016*u,D*.74,s*W*.36,H-.13*u,0,m.led,this.roof,.006*u);
      p.rod([s*W*.24,H-.24*u,-D*.24],[s*W*.24,H-.24*u,D*.20],.015*u,m.trim,this.roof);
    }
    for(const zz of [-D*.25,D*.08])for(const s of [-1,1]){
      p.cylinder(.07*u,.07*u,.018*u,s*W*.24,H-.135*u,zz,m.chrome,this.roof,null,20);
      p.cylinder(.055*u,.055*u,.020*u,s*W*.24,H-.145*u,zz,m.led,this.roof,null,20);
    }
    const lights=[[-W*.22,H-.32*u,D*.10],[W*.22,H-.32*u,-D*.24]];
    for(const pos of lights){
      const l=new THREE.PointLight('#ffe6bf',5.5*d.scale*d.scale,Math.max(W,D)*d.scale*1.4,2);
      l.position.set(...pos);g.add(l);this.lights.push({object:l,base:l.intensity});
    }
    // Sun-visor brow above the windscreen, proportioned by this vessel's own genes:
    const visorD=d.visorDepth*u,visorZ=D*.5+rake+visorD*.38;
    p.round(W*.92,.07*u,visorD,0,H+.04*u,visorZ,m.body,this.roof,.03*u,[-.10,0,0]);
    p.round(W*.92,.03*u,.02*u,0,H+.005*u,visorZ+visorD*.49,m.accent,this.roof,.008*u);

    // LOW-PROFILE COMMAND CONSOLE & ULTRA-CLEAR FORWARD VIEW OVER BOW:
    // Positioned so that looking over the console gives a clean, completely open panoramic view
    // of the entire foredeck, anchor windlass, bow rails, and breaking ocean waves!
    const consoleZ=D*.26,consoleW=W*this.fitR.range(.82,.86),helmX=d.helmSide*W*.20;
    const consoleY=(d.bridgeArchetype==='sportfish'?.86:d.bridgeArchetype==='command'?.93:.90)*u;
    const consolePlan=d.consoleStyle==='straight'
      ?[[-consoleW*.5,-.34*u],[-consoleW*.5,.36*u],[consoleW*.5,.36*u],[consoleW*.5,-.34*u]]
      :d.consoleStyle==='stepped'
      ?[[-consoleW*.5,-.36*u],[-consoleW*.5,.22*u],[-consoleW*.20,.42*u],[consoleW*.20,.42*u],[consoleW*.5,.22*u],[consoleW*.5,-.36*u]]
      :[[-consoleW*.5,-.36*u],[-consoleW*.5,.08*u],[-consoleW*.44,.40*u],[consoleW*.44,.40*u],[consoleW*.5,.08*u],[consoleW*.5,-.36*u]];
    const console=new THREE.Group();console.position.set(0,0,consoleZ);g.add(console);
    console.name='Low-profile command helm console';
    p.slab(consolePlan.map(a=>[a[0]*.94,a[1]*.88]),.08*u,.12*u,m.rubber,console,.030*u);
    p.slab(consolePlan,.18*u,consoleY-.18*u,m.console,console,.045*u);
    p.slab(consolePlan.map(a=>[a[0]*1.012,a[1]*1.05]),consoleY-.04*u,.055*u,m.wood,console,.020*u);
    p.slab(consolePlan.map(a=>[a[0]*.99,a[1]*1.015]),consoleY+.015*u,.026*u,m.top,console,.015*u);
    p.round(consoleW*.84,.022*u,.016*u,0,.22*u,-.39*u,m.led,console,.005*u);
    p.round(consoleW*.92,.022*u,.030*u,0,consoleY-.01*u,-.41*u,m.trim,console,.007*u);

    // WIDE-ASPECT GLASS COCKPIT MFDs (low profile, tilted back so the captain sees straight over them):
    const kinds=d.screenCount===2?['chart','radar']:d.screenCount===4?['chart','radar','sounder','chart']:['chart','radar','sounder'];
    const screenW=Math.min(.74*u,(consoleW-.16*u)/kinds.length*.92),screenH=screenW*.60;
    // Raise so the raked panel's lower edge lands exactly on the console top (no sinking, no floating):
    const screenY=consoleY+.05*u+screenH*.46,spacing=consoleW/(kinds.length+.25);
    kinds.forEach((kind,i)=>{
      this.monitor(kind,(i-(kinds.length-1)/2)*spacing,screenY,consoleZ+.04*u,screenW,screenH,u,g);
    });

    // STEERING HELM & DUAL Morse THROTTLES:
    this.steeringWheel(helmX,consoleY+.10*u,consoleZ-.56*u,u,g);
    p.rod([helmX,.65*u,consoleZ-.28*u],[helmX,consoleY+.09*u,consoleZ-.54*u],.050*u,m.dark,g);

    this.throttleGroup=this.liveGroup('Engine throttles',g,[-d.helmSide*consoleW*.38,consoleY+.06*u,consoleZ-.24*u],'throttle');
    const tg=this.throttleGroup;
    p.round(.26*u,.048*u,.26*u,0,0,0,m.chrome,tg,.030*u);
    p.round(.23*u,.035*u,.23*u,0,.030*u,0,m.dark,tg,.022*u);
    for(const s of [-1,1]){
      p.round(.030*u,.015*u,.19*u,s*.065*u,.052*u,0,m.rubber,tg,.010*u);
      p.rod([s*.065*u,.06*u,.03*u],[s*.065*u,.26*u,-.055*u],.014*u,m.chrome,tg);
      p.round(.070*u,.050*u,.095*u,s*.065*u,.27*u,-.060*u,s>0?m.dark:m.dark,tg,.022*u);
    }

    // SWITCHBOARD & MAGNETIC BINNACLE COMPASS:
    this.switchPanel(d.helmSide*Math.min(W*.06,.26*u),consoleY+.045*u,consoleZ-.23*u,u,g,Math.min(.86*u,W*.26));
    this.compass(helmX-d.helmSide*.38*u,consoleY+.05*u,consoleZ-.23*u,u,g);
    if(W>3.0*u){
      this.mug(-d.helmSide*W*.22,consoleY+.05*u,consoleZ-.22*u,u,g);
      this.binoculars(d.helmSide*W*.36,consoleY+.06*u,consoleZ-.11*u,u,g);
    }

    // OVERHEAD REPEATER DISPLAY POD (not fitted on every vessel):
    if(d.overheadPod){
      const overhead=this.liveGroup('Overhead instruments',this.roof,[0,H-.28*u,D*.30]);
      overhead.rotation.set(.12,Math.PI,0);
      p.round(W*.62,.22*u,.10*u,0,0,0,m.console,overhead,.025*u);
      p.mesh(new THREE.PlaneGeometry(W*.58,.165*u),m.display('overhead',W*.58/(.165*u)),[0,0,.054*u],null,overhead);
    }

    // CAPTAIN'S AND MATE'S SUSPENSION HELM SEATS:
    const seatZ=Math.max(-D*.5+.58*u,consoleZ-1.78*u);
    this.helmSeat(helmX,seatZ,u,g);
    if(d.seatCount>1&&W>4.2*u)this.helmSeat(-d.helmSide*W*.24,seatZ-.12*u,u,g);

    // INTERIOR FIT-OUT IS SELECTED BY BUDGET GRADE:
    if(d.grade==='workboat')this.workboatInterior(g,{W,D,H,u,doorW,consoleZ});
    else if(D>3.6*u&&W>3.1*u)this.fineJoinery(g,{W,D,H,u,seatZ,doorW});
    else{
      this.wallClock(-W*.24,H*.65,-D*.5+.075*u,.13*u,g,'clock');
      this.extinguisher(W*.32,.40*u,-D*.38,u,g);
    }
    if(d.gearRack)this.gearStowage(g,{W,D,H,u,doorW});
    this.vhf(d.helmSide*W*.38,H-.38*u,consoleZ-.08*u,u,g);
    // Unique seeded objects so no two bridges share the same clutter:
    const extra=(d.motif+d.ornament)%5;
    if(extra===0)this.mug(-d.helmSide*W*.18,consoleY+.05*u,consoleZ-.18*u,u,g);
    if(extra===1)this.plant(d.helmSide*W*.28,.92*u,-D*.18,u,g);
    if(extra===2){p.round(.16*u,.08*u,.22*u,-d.helmSide*W*.32,.04*u,-D*.12,m.bookMats[d.layoutBit%5],g,.02*u);}
    if(extra===3)this.binoculars(-d.helmSide*W*.22,consoleY+.06*u,consoleZ-.14*u,u,g);
    if(extra===4&&d.grade!=='workboat')this.deskLamp(d.helmSide*W*.16,consoleY+.02*u,consoleZ-.20*u,u,g);
    // Procedurally invented objects scattered on the console wings and the bridge sole: new shapes every vessel.
    const tr=d.stream('bridge-trinkets:'+d.revision),tc=tr.int(d.grade==='luxury'?4:2,d.grade==='luxury'?8:5);
    for(let i=0;i<tc;i++){
      const onConsole=tr.next()>.4;
      if(onConsole){const side=tr.pick([-1,1]);this.trinket(side*consoleW*tr.range(.30,.46),consoleY+.045*u,consoleZ-tr.range(.18,.30)*u,u*.85,g,tr);}
      else{const side=tr.pick([-1,1]);this.trinket(side*W*tr.range(.33,.42),.06*u,lerp(-D*.36,D*.05,tr.next()),u,g,tr);}
    }

    // CALIBRATED HELM CAMERA EYE POSITION (CLEAR PANORAMIC VIEW OUT THE FRONT):
    const minZ=-D*.5+.30*u,maxZ=consoleZ-.65*u,minX=-W*.5+.26*u,maxX=W*.5-.26*u;
    const helmEye=V(helmX,1.65*u,clamp(consoleZ-1.12*u,minZ+.10*u,maxZ-.05*u));
    this.helm={group:g,start:helmEye,minX,maxX,minZ,maxZ,unit:u};
    const archLabel={command:'Command bridge',panoramic:'Panoramic pilothouse',workboat:'Workboat wheelhouse',sportfish:'Sportfisher helm'}[d.bridgeArchetype];
    const winLabel={alaskan:'forward-raked Alaskan windscreen',sport:'swept sport windscreen',panoramic:'upright panoramic glazing'}[d.windowStyle]||'panoramic glazing';
    this.equipment.add(archLabel+' / '+d.windowCount+'-pane '+winLabel);
    this.equipment.add('Low-profile glass cockpit with clear sightlines over the bow');
    this.equipment.add('Helm to '+(d.helmSide<0?'port':'starboard')+', '+d.screenCount+' multifunction displays');
  }
});
