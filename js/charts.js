import {TAU} from './util.js';

export function canvasText(c,text,x,y,size=12,color='#97b5a1',align='left',font='monospace'){c.font=`${size}px ${font}`;c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y);}
export function drawNauticalChart(c,w,h,time=0,printed=false){
  c.save();c.scale(w/768,h/512);c.fillStyle=printed?'#e4ddc0':'#122c2c';c.fillRect(0,0,768,512);const sea=printed?'#d0d9c3':'#1f3b37',land=printed?'#d6cda7':'#687459',line=printed?'#9caa8c':'#41614e';
  c.fillStyle=sea;c.fillRect(12,printed?12:60,744,printed?488:403);c.save();c.beginPath();c.rect(12,printed?12:60,744,printed?488:403);c.clip();
  c.strokeStyle=printed?'#b5bca0':'#315044';c.lineWidth=.7;for(let i=0;i<14;i++){c.beginPath();c.moveTo(i*64,0);c.lineTo(i*64,512);c.stroke();}for(let i=0;i<10;i++){c.beginPath();c.moveTo(0,i*64);c.lineTo(768,i*64);c.stroke();}
  c.fillStyle=land;c.beginPath();c.moveTo(0,0);c.lineTo(220,0);for(let y=0;y<=540;y+=8)c.lineTo(138+Math.sin(y*.013)*54+Math.cos(y*.039)*24+Math.sin(y*.071)*7,y);c.lineTo(0,540);c.closePath();c.fill();
  for(let j=0;j<10;j++){c.strokeStyle=j<2?land:line;c.lineWidth=j<2?1.8:.8;c.beginPath();for(let y=0;y<=530;y+=5){const x=159+j*22+Math.sin(y*.013+j*.15)*54+Math.cos(y*.039+j*.08)*24+Math.sin(y*.071)*7;if(y===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
  for(const island of [[566,160,52,97],[638,328,37,58],[558,431,31,28]]){c.fillStyle=land;c.beginPath();for(let i=0;i<65;i++){const a=i*TAU/64,rr=1+Math.sin(a*5)*.09+Math.sin(a*9)*.04,x=island[0]+Math.cos(a)*island[2]*rr,y=island[1]+Math.sin(a)*island[3]*rr;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();c.strokeStyle=line;c.stroke();}
  for(let i=0;i<36;i++){const x=280+(i*67)%422,y=78+(i*73)%360;canvasText(c,(22+(i*13)%146).toFixed(0),x,y,10,printed?'#8a947e':'#78917b');}
  canvasText(c,'N O R T H  S E A',390,372,13,printed?'#83977d':'#698879');canvasText(c,'VESTLAND',45,273,12,printed?'#8a805e':'#abb88c');
  c.strokeStyle=printed?'#a76b59':'#c38e8e';c.lineWidth=2;c.setLineDash([7,5]);c.beginPath();c.moveTo(335,482);c.lineTo(391,299);c.lineTo(459,153);c.lineTo(474,48);c.stroke();c.setLineDash([]);
  for(const pt of [[391,299],[459,153],[474,48]]){c.strokeStyle=printed?'#a76b59':'#d2ada0';c.beginPath();c.arc(pt[0],pt[1],5,0,TAU);c.stroke();}
  c.strokeStyle=printed?'#5c948e':'#74b9b0';c.lineWidth=1.8;c.beginPath();c.moveTo(356,481);c.bezierCurveTo(345,400,380,380,390,319);c.stroke();
  c.save();c.translate(395,296);c.rotate(.34);c.fillStyle=printed?'#a06047':'#e4dfab';c.beginPath();c.moveTo(0,-14);c.lineTo(-7,9);c.lineTo(0,5);c.lineTo(7,9);c.closePath();c.fill();c.restore();
  const compassX=printed?665:698,compassY=printed?75:106;c.strokeStyle=printed?'#8e9b7f':'#8fa78b';c.lineWidth=.8;c.beginPath();c.arc(compassX,compassY,23,0,TAU);c.stroke();c.beginPath();c.moveTo(compassX,compassY-31);c.lineTo(compassX,compassY+30);c.moveTo(compassX-30,compassY);c.lineTo(compassX+30,compassY);c.stroke();canvasText(c,'N',compassX,compassY-35,11,printed?'#78876b':'#acbea0','center');
  c.restore();
  if(printed){canvasText(c,'KEEL / NORTH ATLANTIC',25,35,13,'#667360');canvasText(c,'COASTAL PASSAGE CHART / 1:40 000',25,490,10,'#7b856c');}
  else{c.fillStyle='#102724';c.fillRect(0,0,768,51);canvasText(c,'KEEL / COASTAL NAVIGATION',20,24,13,'#b7c6a6');canvasText(c,'NORTH UP',746,24,10,'#89a88f','right');canvasText(c,'58 21.842 N   006 14.096 E',20,45,10,'#7e9c85');c.fillStyle='#152e28';c.fillRect(0,466,768,46);canvasText(c,'COG 034.2',20,489,13,'#d3d5a5');canvasText(c,'SOG 08.4 kn',244,489,13,'#b3c7aa');canvasText(c,'DEPTH 124.6 m',500,489,13,'#b3c7aa');canvasText(c,'2 NM',745,452,10,'#c9cba3','right');}
  c.restore();
}
