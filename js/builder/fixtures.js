import * as THREE from 'three';
import {TAU, V} from '../util.js';
import {VesselBuilder} from '../vessel-builder.js';

Object.assign(VesselBuilder.prototype,{
  monitor(kind,x,y,z,w,h,u,g){
    const p=this.p,m=this.m;
    const screen=this.liveGroup(kind+' display',g,[x,y,z],kind==='radar'?'radar':kind==='chart'?'chart':null);
    // Face aft toward the helm and rake back 22 deg: panel normal points up-toward the captain.
    // YXZ order makes the 180-degree flip deterministic instead of Euler-order dependent.
    screen.rotation.order='YXZ';screen.rotation.set(-.38,Math.PI,0);
    p.round(w+.07*u,h+.09*u,.055*u,0,0,0,m.rubber,screen,.020*u);         // bezel
    p.round(w+.030*u,h+.032*u,.006*u,0,0,.030*u,m.dark,screen,.010*u);     // inner mask
    p.mesh(new THREE.PlaneGeometry(w,h),m.display(kind,w/h),[0,0,.034*u],null,screen);
    for(let k=0;k<3;k++)p.round(.014*u,.011*u,.005*u,(k-1)*w*.16,-h*.5-.020*u,.033*u,k===0?m.green:m.metal,screen,.004*u);
    p.cylinder(.020*u,.020*u,.014*u,w*.44,-h*.5-.018*u,.033*u,m.chrome,screen,[Math.PI/2,0,0],16);
    p.cylinder(.015*u,.015*u,.020*u,w*.44,-h*.5-.018*u,.038*u,m.dark,screen,[Math.PI/2,0,0],12);
    // Pedestal stanchion into the console top:
    p.round(.085*u,.10*u,.060*u,x,y-h*.46-.05*u,z-.015*u,m.dark,g,.016*u);
  },
  steeringWheel(x,y,z,u,g){
    const p=this.p,m=this.m,w=this.liveGroup('Helm steering wheel',g,[x,y,z],'wheel');
    w.rotation.x=-.18;this.wheel=w;
    const R=.24*u,classic=this.dna.steeringStyle==='classic';
    p.torus(R,.024*u,0,0,0,classic?m.wood:m.rubber,w);
    p.torus(R*.96,.005*u,0,0,-.020*u,m.trim,w);
    const spokes=classic?6:3;
    for(let i=0;i<spokes;i++){
      const a=i*TAU/spokes,tip=[Math.sin(a)*R,Math.cos(a)*R,0];
      p.rod([0,0,.022*u],tip,.012*u,m.chrome,w);
      if(classic){
        const profile=[new THREE.Vector2(.010*u,0),new THREE.Vector2(.018*u,.012*u),new THREE.Vector2(.016*u,.052*u),new THREE.Vector2(.010*u,.068*u)];
        const handle=p.mesh(new THREE.LatheGeometry(profile,14),m.wood,[Math.sin(a)*R,Math.cos(a)*R,0],null,w);
        handle.quaternion.setFromUnitVectors(V(0,1,0),V(Math.sin(a),Math.cos(a),0));
      }
    }
    p.cylinder(.055*u,.065*u,.060*u,0,0,.012*u,m.trim,w,[Math.PI/2,0,0],32);
    p.cylinder(.038*u,.038*u,.008*u,0,0,.048*u,m.dark,w,[Math.PI/2,0,0],24);
  },
  switchPanel(x,y,z,u,g,width){
    const p=this.p,m=this.m,panel=new THREE.Group();panel.position.set(x,y,z);panel.rotation.x=-Math.PI/2;g.add(panel);
    p.round(width,.21*u,.022*u,0,0,0,m.dark,panel,.016*u);
    for(let i=0;i<6;i++){
      const xx=(i-2.5)*width*.13;
      p.cylinder(.016*u,.016*u,.006*u,xx,.016*u,.016*u,m.chrome,panel,[Math.PI/2,0,0],16);
      p.rod([xx,.016*u,.018*u],[xx,.034*u,.050*u],.006*u,m.chrome,panel);
      p.round(.016*u,.011*u,.007*u,xx,-.058*u,.016*u,i===1?m.orange:m.green,panel,.004*u);
    }
    const label=m.label('NAV   DECK   PUMPS   BILGE   HORN   WIPER','#aeb9a0',null,16,400);
    p.label('Switches',width*.9,.040*u,0,-.025*u,.014*u,label,panel);
  },
  compass(x,y,z,u,g){
    const p=this.p,m=this.m;
    const[c,ctx]=m.canvas(512,512);ctx.fillStyle='#d6d9c1';ctx.fillRect(0,0,512,512);ctx.translate(256,256);
    for(let i=0;i<72;i++){const a=i*TAU/72;ctx.strokeStyle='#4c5b48';ctx.lineWidth=i%6?2:4;ctx.beginPath();ctx.moveTo(Math.sin(a)*(i%6?198:184),-Math.cos(a)*(i%6?198:184));ctx.lineTo(Math.sin(a)*217,-Math.cos(a)*217);ctx.stroke();}
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 39px Georgia';
    ['N','E','S','W'].forEach((s,i)=>ctx.fillText(s,Math.sin(i*Math.PI/2)*145,-Math.cos(i*Math.PI/2)*145));
    ctx.fillStyle='#a74e35';ctx.beginPath();ctx.moveTo(0,-112);ctx.lineTo(-21,64);ctx.lineTo(21,64);ctx.fill();
    const mat=m.std('Compass card','#ffffff',{map:m.texture(c),roughness:.5});
    p.cylinder(.078*u,.090*u,.045*u,x,y+.022*u,z,m.trim,g,null,32);
    p.mesh(new THREE.CircleGeometry(.068*u,48),mat,[x,y+.048*u,z],[-Math.PI/2,0,0],g);
    p.torus(.076*u,.008*u,x,y+.052*u,z,m.chrome,g,[Math.PI/2,0,0]);
    p.sphere(.070*u,.030*u,.070*u,x,y+.055*u,z,m.glass,g);
  },
  helmSeat(x,z,u,g){
    const p=this.p,m=this.m;
    if(this.dna.grade==='workboat'){
      // Simple tubular pedestal stool with a vinyl drop-in cushion:
      const stool=new THREE.Group();stool.position.set(x,0,z);g.add(stool);stool.name='Helm stool';
      p.cylinder(.21*u,.24*u,.035*u,0,.07*u,0,m.dark,stool,null,24);
      p.cylinder(.058*u,.075*u,.46*u,0,.31*u,0,m.metal,stool);
      p.cylinder(.09*u,.09*u,.10*u,0,.13*u,0,m.dark,stool);
      p.round(.50*u,.12*u,.46*u,0,.58*u,0,m.dark,stool,.035*u);
      p.round(.46*u,.14*u,.42*u,0,.66*u,0,m.leather,stool,.055*u);
      p.round(.46*u,.42*u,.12*u,0,.94*u,-.20*u,m.dark,stool,.05*u,[-.08,0,0]);
      p.round(.40*u,.36*u,.10*u,0,.95*u,-.15*u,m.leather,stool,.045*u,[-.08,0,0]);
      this.colliders.push({x,z,w:.60*u,d:.62*u});return;
    }
    const seat=new THREE.Group();seat.position.set(x,0,z);g.add(seat);seat.name='Captain suspension chair';
    p.cylinder(.22*u,.27*u,.042*u,0,.08*u,0,m.dark,seat,null,28);
    p.cylinder(.075*u,.10*u,.38*u,0,.28*u,0,m.chrome,seat);
    p.torus(.20*u,.015*u,0,.26*u,0,m.chrome,seat,[Math.PI/2,0,0]);
    p.round(.58*u,.10*u,.54*u,0,.58*u,0,m.dark,seat,.040*u);
    p.round(.54*u,.13*u,.50*u,0,.66*u,.014*u,m.leather,seat,.060*u);
    p.round(.56*u,.56*u,.15*u,0,.96*u,-.22*u,m.dark,seat,.065*u,[-.10,0,0]);
    p.round(.46*u,.50*u,.12*u,0,.98*u,-.16*u,m.leather,seat,.055*u,[-.10,0,0]);
    p.round(.34*u,.14*u,.13*u,0,1.32*u,-.25*u,m.leather,seat,.050*u);
    for(const s of [-1,1]){
      p.rod([s*.24*u,.58*u,-.06*u],[s*.30*u,.86*u,-.03*u],.017*u,m.chrome,seat);
      p.round(.08*u,.06*u,.34*u,s*.30*u,.88*u,.03*u,m.leather,seat,.028*u);
    }
    this.colliders.push({x,z,w:.68*u,d:.72*u});
  }
});
