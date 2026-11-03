import * as THREE from 'three';
import {clamp} from './util.js';

export const PALETTES=[
  {name:'North Atlantic',hull:'#2d625b',body:'#edece0',accent:'#d57348',bottom:'#844538',deck:'#9da69a',trim:'#223530'},
  {name:'Bluewater',hull:'#284d69',body:'#f0ede0',accent:'#cf7548',bottom:'#824438',deck:'#9ba59f',trim:'#22333f'},
  {name:'Red ochre',hull:'#9e3e30',body:'#e9e6d5',accent:'#d4ad5d',bottom:'#423733',deck:'#a1a59a',trim:'#343a35'},
  {name:'Harbor gold',hull:'#bc8f38',body:'#eae5d7',accent:'#476e75',bottom:'#42413c',deck:'#9fa795',trim:'#323f3a'},
  {name:'Alaskan King',hull:'#1e4337',body:'#f4f2e8',accent:'#df582c',bottom:'#262d29',deck:'#95a298',trim:'#182822'},
  {name:'Pacific Blue',hull:'#1e5585',body:'#f5f3e9',accent:'#de6b2c',bottom:'#1d2b37',deck:'#96a1a3',trim:'#142d45'},
  {name:'Carolina Sportfisher',hull:'#467990',body:'#ffffff',accent:'#e39838',bottom:'#1e303b',deck:'#a5b3b5',trim:'#1e333e'},
  {name:'Lofoten Navy',hull:'#1a3449',body:'#eae7db',accent:'#cc4e33',bottom:'#211d1a',deck:'#9aa39f',trim:'#15222c'},
  {name:'New England Lobster',hull:'#334c44',body:'#f6f4eb',accent:'#c6863d',bottom:'#543c33',deck:'#a2aba3',trim:'#253630'},
  {name:'Cannery Yellow',hull:'#dfb433',body:'#2c3e53',accent:'#cb5530',bottom:'#36322b',deck:'#9ca396',trim:'#1c2a36'},
  {name:'Arctic Fox Signature',hull:'#dfb637',body:'#2e4259',accent:'#c8502a',bottom:'#3c3022',deck:'#9ea299',trim:'#1f2d3c'},
  {name:'Dutch Cutter',hull:'#224b73',body:'#f3eee0',accent:'#df582c',bottom:'#352620',deck:'#9ea7a5',trim:'#18324b'},
  {name:'Sage Passage',hull:'#677c6c',body:'#ede9dc',accent:'#ce804e',bottom:'#5b4f44',deck:'#abaa99',trim:'#2e3f37'},
  {name:'Ivory Expedition',hull:'#d4d9ce',body:'#f4f1e6',accent:'#b87f4c',bottom:'#305457',deck:'#b0a185',trim:'#2a4344'},
  {name:'Cornish Pilchard',hull:'#88372d',body:'#eee9da',accent:'#376370',bottom:'#2d2320',deck:'#9ea197',trim:'#25292b'},
  {name:'Barents Ice',hull:'#466f7d',body:'#f4f4ec',accent:'#e56d3b',bottom:'#35434a',deck:'#9eb0aa',trim:'#23363b'}
];
export const TIERS=[
  {name:'Primitive craft',range:'$100 to $10K',min:100,max:1e4,length:[3,7],beam:[.27,.36],draft:[.055,.082],freeboard:[.09,.12],material:'Clinker-planked timber',types:['Clinker-built skiff','Estuary rowboat','Open-water panga']},
  {name:'Coastal commercial',range:'$10K to $500K',min:1e4,max:5e5,length:[8,20],beam:[.245,.31],draft:[.05,.08],freeboard:[.08,.11],material:'Composite / aluminum',types:['Coastal sportfisher','Pilothouse longliner','Coastal fishing launch','Center-console dayboat','Downeast lobster boat','Bay shrimp skiff','Charter walkaround']},
  {name:'Deep-sea commercial',range:'$500K to $15M',min:5e5,max:1.5e7,length:[20,50],beam:[.23,.285],draft:[.075,.108],freeboard:[.078,.10],material:'Marine-grade steel',types:['North Atlantic trawler','Offshore longliner','Stern-net trawler','Crabber','Purse seiner','Combination dragger']},
  {name:'Industrial expedition',range:'$15M to $250M',min:1.5e7,max:2.5e8,length:[50,140],beam:[.175,.23],draft:[.055,.081],freeboard:[.052,.075],material:'High-tensile steel',types:['Factory expedition ship','Oceanic research trawler','Expedition fishing yacht','Freezer longliner']},
  {name:'Apex harvester',range:'$250M and beyond',min:2.5e8,max:1e9,length:[140,400],beam:[.225,.285],draft:[.045,.065],freeboard:[.042,.061],material:'Carbon composite',types:['Wave-piercing trimaran','Apex deep-sea harvester','Oceanic exploration vessel']}
];
export const NAMES=['Peregrine','Halcyon','Meridian','Northstar','Calypso','Kestrel','Solstice','Tideliner','Wayfarer','Aurora','Haven','Albatross','Mariner','Sundowner','Nomad','Arctic Fox','Ocean Pioneer','Sea Venture','Storm Bird','Silver Gull','Little Tern','Coot','Sprat','Mackerel Sky','Herring Lass','Saltbox','Puffin','Gannet','Curlew','Osprey'];
// Shift a colour in HSL space so no two vessels ever share an exact shade.
export const jit=(hex,r,dh=.04,ds=.12,dl=.08)=>{const c=new THREE.Color(hex),o={};c.getHSL(o);c.setHSL((o.h+r.range(-dh,dh)+1)%1,clamp(o.s+r.range(-ds,ds),0,1),clamp(o.l+r.range(-dl,dl),.06,.94));return '#'+c.getHexString();};
