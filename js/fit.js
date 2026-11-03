import * as THREE from 'three';
import {V} from './util.js';

export function visibleBounds(root){const box=new THREE.Box3();root.updateMatrixWorld(true);root.traverseVisible(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});return box;}
export function collectFitPoints(root,box){const points=[];root.traverseVisible(o=>{if(!o.isMesh)return;const pos=o.geometry.getAttribute('position'),step=Math.max(1,Math.ceil(pos.count/96));for(let i=0;i<pos.count;i+=step)points.push(V().fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld));});const center=box.getCenter(V());points.push(V(center.x,box.max.y,center.z),V(center.x,box.min.y,center.z));return points;}
