import * as THREE from 'three';

export const $=id=>document.getElementById(id),TAU=Math.PI*2,V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp,smooth=t=>t*t*(3-2*t);
export const money=new Intl.NumberFormat('en-US',{maximumFractionDigits:20}),number=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
export const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
export function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return(h^(h>>>16))>>>0;}
export class Random{constructor(seed){this.state=seed>>>0;}next(){let t=this.state+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}range(a,b){return lerp(a,b,this.next());}int(a,b){return Math.floor(this.range(a,b+1));}pick(a){return a[this.int(0,a.length-1)];}}
