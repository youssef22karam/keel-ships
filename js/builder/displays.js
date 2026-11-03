import {TAU} from '../util.js';
import {canvasText, drawNauticalChart} from '../charts.js';
import {VesselBuilder} from '../vessel-builder.js';

Object.assign(VesselBuilder.prototype,{
  drawDisplays(time){
    const throttle=this.throttle;
    for(const display of this.m.displays){const{ctx:c,canvas,kind,texture}=display,w=canvas.width,h=canvas.height;
      if(kind==='chart'){drawNauticalChart(c,w,h,time,false);texture.needsUpdate=true;continue;}
      if(kind==='overhead'){
        c.fillStyle='#101e1b';c.fillRect(0,0,w,h);const labels=['HEADING / MAG','SPEED / KNOTS','DEPTH / METERS','PORT / RPM','STBD / RPM','FUEL / PERCENT'],vals=[(34.2+this.steering*12).toFixed(1),(3+throttle*13).toFixed(1),'124.6',String(Math.round(420+throttle*1050)),String(Math.round(420+throttle*1040)),'86'];
        for(let i=0;i<6;i++){const xx=(i+.12)*w/6;c.strokeStyle='#344337';c.lineWidth=1;c.beginPath();c.moveTo((i+1)*w/6-6,12);c.lineTo((i+1)*w/6-6,h-12);c.stroke();canvasText(c,labels[i],xx,h*.26,h*.12,'#7b977e');canvasText(c,vals[i],xx,h*.70,h*.35,i===0?'#d1bd86':'#c2d0ae');c.fillStyle='#304334';c.fillRect(xx,h*.84,w/6*.75,2);c.fillStyle='#8fa574';c.fillRect(xx,h*.84,w/6*(i===5?.64:.40+throttle*.2),2);}texture.needsUpdate=true;continue;
      }
      c.save();c.scale(w/768,h/512);c.fillStyle='#0c211e';c.fillRect(0,0,768,512);c.fillStyle='#122b24';c.fillRect(0,0,768,47);canvasText(c,kind==='radar'?'KEEL / X-BAND RADAR':'KEEL / DUAL-FREQUENCY SOUNDER',19,29,13,'#b8c8a6');canvasText(c,kind==='radar'?'TX / ACTIVE':'200 kHz / ACTIVE',748,28,10,'#87aa87','right');
      if(kind==='radar'){
        const cx=300,cy=282,R=193;c.strokeStyle='#28483a';c.lineWidth=1;
        for(let i=1;i<=4;i++){c.beginPath();c.arc(cx,cy,R*i/4,0,TAU);c.stroke();}for(let i=0;i<72;i++){const a=i*TAU/72,rr=i%6?R-4:R-10;c.beginPath();c.moveTo(cx+Math.sin(a)*rr,cy-Math.cos(a)*rr);c.lineTo(cx+Math.sin(a)*R,cy-Math.cos(a)*R);c.stroke();}for(let i=0;i<12;i++){const a=i*TAU/12;c.beginPath();c.moveTo(cx+Math.sin(a)*20,cy-Math.cos(a)*20);c.lineTo(cx+Math.sin(a)*R,cy-Math.cos(a)*R);c.stroke();}
        const angle=time*.52;for(let i=0;i<48;i++){const a=angle-i*.012;c.strokeStyle=`rgba(117,183,107,${.32*(1-i/48)})`;c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.sin(a)*R,cy-Math.cos(a)*R);c.stroke();}
        for(let i=0;i<12;i++){const a=i*2.47+.4,rr=(42+(i*37)%122)*6/this.radarRange;if(rr>R)continue;const age=((angle-a)%TAU+TAU)%TAU,xx=cx+Math.sin(a)*rr,yy=cy-Math.cos(a)*rr;c.fillStyle=`rgba(180,209,137,${.3+.7*Math.exp(-age*.7)})`;c.fillRect(xx,yy,4+i%3,3);if(i<3){c.strokeStyle='#688b63';c.strokeRect(xx-7,yy-6,18,16);}}
        c.fillStyle='#dadcb2';c.beginPath();c.moveTo(cx,cy-9);c.lineTo(cx-5,cy+6);c.lineTo(cx+5,cy+6);c.closePath();c.fill();canvasText(c,'N',cx,cy-R-14,11,'#9fb28f','center');canvasText(c,'W',cx-R-16,cy+4,11,'#718e70','center');canvasText(c,'E',cx+R+16,cy+4,11,'#718e70','center');
        canvasText(c,'RANGE',565,86,11,'#718f72');canvasText(c,this.radarRange.toFixed(1)+' NM',565,117,27,'#d4c89c');canvasText(c,'HEADING / MAG',565,162,10,'#789577');canvasText(c,(34.2+this.steering*12).toFixed(1),565,193,28,'#c3d4af');
        const metrics=[['GAIN','76 %'],['SEA CLUTTER','AUTO'],['RAIN','OFF'],['TRAILS','3 MIN'],['TARGETS','12']];for(let i=0;i<metrics.length;i++){canvasText(c,metrics[i][0],565,239+i*30,10,'#6b896f');canvasText(c,metrics[i][1],748,239+i*30,11,'#afc09b','right');}canvasText(c,'CLICK DISPLAY / CHANGE RANGE',20,495,10,'#8caa83');
      }else{
        c.fillStyle='#102b29';c.fillRect(16,63,700,397);for(let xx=0;xx<700;xx+=3){const x=xx+time*13,depth=315+Math.sin(x*.013)*27+Math.sin(x*.041)*11;const grad=c.createLinearGradient(0,depth-20,0,470);grad.addColorStop(0,'#d4bf72');grad.addColorStop(.2,'#b27945');grad.addColorStop(.7,'#9c5b39');grad.addColorStop(1,'#6e5038');c.fillStyle=grad;c.fillRect(16+xx,depth,3,470-depth);c.fillStyle='#739369';c.fillRect(16+xx,depth-5,3,5);c.fillStyle='#b3b76d';c.fillRect(16+xx,depth,3,3);}
        c.strokeStyle='#34514a';c.lineWidth=1;for(let i=0;i<5;i++){const yy=89+i*85;c.beginPath();c.moveTo(16,yy);c.lineTo(718,yy);c.stroke();canvasText(c,String(i*50),740,yy+4,11,'#809d83','center');}
        for(let i=0;i<10;i++){const xx=100+(i*73)%590,yy=161+Math.sin(i*1.7)*42;c.strokeStyle=i%3===0?'#c7a56a':'#637f63';c.lineWidth=i%3===0?3:1.5;c.beginPath();c.ellipse(xx,yy,12+i%3*4,7,0,Math.PI,TAU);c.stroke();}
        c.fillStyle='#102923e8';c.fillRect(28,76,205,92);canvasText(c,'124.6',40,128,46,'#d0d6ad');canvasText(c,'METERS / BOTTOM LOCK',42,152,10,'#90aa87');canvasText(c,'FREQUENCY 200 kHz',20,494,10,'#8da887');canvasText(c,'RANGE 200 m',743,494,10,'#b3c3a0','right');
      }
      c.restore();texture.needsUpdate=true;
    }
  }
});
