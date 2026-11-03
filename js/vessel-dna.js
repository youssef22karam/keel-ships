import {Random, clamp, hash, lerp} from './util.js';
import {NAMES, PALETTES, TIERS, jit} from './palettes.js';

export class VesselDNA{
  constructor(cost,seed,options={}){
    this.cost=cost;this.seed=seed>>>0;this.key=`${cost}:${this.seed}:keel-v1`;this.hash=hash(this.key);this.id=this.hash.toString(16).toUpperCase().padStart(8,'0');
    const r=this.stream('architecture');this.tier=cost<1e4?0:cost<5e5?1:cost<1.5e7?2:cost<2.5e8?3:4;this.info=TIERS[this.tier];
    this.progress=clamp(Math.log(cost/this.info.min)/Math.log(this.info.max/this.info.min),0,1);const p=clamp(this.progress+r.range(-.095,.095),0,1);
    this.L=lerp(...this.info.length,p);if(this.tier===4&&cost>1e9)this.L+=230*Math.log10(cost/1e9);
    this.B=this.L*r.range(...this.info.beam);this.D=this.L*r.range(...this.info.draft);this.F=this.L*r.range(...this.info.freeboard);this.bowRise=this.F*r.range(.32,.78);this.fullness=r.range(.70,1.15);this.sternWidth=r.range(.62,.94);this.bowRake=r.range(.25,1.2);this.sternRake=r.range(.12,.65);this.flare=r.range(.03,.19);this.bilge=r.range(.62,1.05);this.shoulder=r.range(.60,.73);this.entrance=r.range(.81,.88);this.maxBeamAt=r.range(.22,.40);this.variant=r.int(0,this.info.types.length-1);this.type=this.info.types[this.variant];
    this.motif=this.hash%23;this.ornament=(this.hash>>>5)%11;this.layoutBit=(this.hash>>>11)%7;
    if(this.tier===0){
      // Original primitive craft mechanism: three archetypes from the tier list,
      // generic hull lines, stock name and palette - exactly the original project.
      this.craft=null;this.transom=null;this.plank=null;
      this.varnished=false;this.sternRound=0;this.liveryScheme='plain';this.sheerKink=0;this.bowProfile='raked';
    }else{
      this.craft=null;this.transom=r.pick(['square','square','wineglass']);this.plank=this.tier===1?r.pick(['fiberglass','aluminum']):'steel';
      this.varnished=false;
      // Section-shape genes for powered tiers.
      const sec=this.stream('sections');
      this.sternRound=this.transom==='wineglass'?sec.range(.3,.6):sec.range(0,.12);
      this.liveryScheme=sec.pick(['plain','accent','two','boot','checker']);
      this.sheerKink=sec.range(0,.15);
      this.bowProfile=sec.pick(['fine','fine','raked','bluff']);
    }
    // Bridge architecture must match the budget: cheap boats get open consoles or tiny pilothouses.
    this.cabinStyle=this.tier===0?'open':this.tier===1?(this.progress<.5?this.stream('cab').pick(['console','console','pilothouse','walkin']):this.stream('cab').pick(['pilothouse','walkin','walkin'])):'walkin';
    this.forward=this.tier<2||this.tier>2||r.next()>.23;this.bridgeZ=this.L*(this.forward?r.range(.10,.17):r.range(-.17,-.10));
    this.bridgeW=this.tier===1?Math.max(1.8,this.B*.64):this.tier===2?this.B*r.range(.60,.68):this.tier===3?clamp(this.B*.60,7,17):clamp(this.B*.42,12,24);
    this.bridgeL=this.tier===1?clamp(this.L*.27,2.65,5.4):this.tier===2?clamp(this.L*.21,4.2,9.4):this.tier===3?clamp(this.L*.14,7.5,13):clamp(this.L*.10,10,17);
    this.bridgeH=[1.5,2.35,2.80,3.10,3.40][this.tier]*r.range(.97,1.03);this.levels=this.tier>=2?1:0;this.scale=32/this.L;
    if(this.cabinStyle==='pilothouse'){this.bridgeW*=.72;this.bridgeL*=.80;this.bridgeH*=.88;}
    const identity=this.stream('identity');this.name=identity.pick(NAMES);this.palette=identity.pick(PALETTES);if(cost===5000000&&this.seed===42819){this.name='Arctic Fox';this.palette=PALETTES[10];}
    else if(this.tier>0){
      // Powered tiers get jittered livery and occasional name suffixes.
      const pal={...this.palette};for(const k of ['hull','body','accent','bottom','deck','trim'])pal[k]=jit(pal[k],identity,.05,.15,.08);
      this.palette=pal;
      if(identity.next()>.7)this.name+=' '+identity.pick(['II','III','IV','of Hull','of Cork','of Bergen','Rose','Star']);
    }
    // Primitive craft keep the stock name and palette, as in the original project.
    // INTERIOR GRADE IS SCALED TO THE BUDGET: a $20K boat must never get a yacht joinery shop.
    this.grade=this.tier<=1?'workboat':this.tier===2?'standard':'luxury';
    const interiorPool=this.grade==='workboat'?['workboat','workboat','workboat','painted']:this.grade==='standard'?['walnut','ivory','painted','teak'] :['walnut','walnut','ivory','graphite'];
    this.finish=options.finish&&options.finish!=='auto'&&this.finishAllowed(options.finish)?options.finish:cost===5000000&&this.seed===42819?'walnut':this.stream('interior').pick(interiorPool);
    this.revision=options.revision||0;
    this.material=this.info.material;this.speed=clamp(2.4*Math.sqrt(this.L)*r.range(.85,1.1),3,24);this.displacement=this.L*this.B*this.D*.55*1.025;this.hold=this.displacement*.22;
    const gene=this.stream('machinery');this.propellerBlades=gene.int(3,5);this.radarStyle=gene.pick(['array','array','dome']);
    const arch=this.stream('window-arch:'+this.finish);
    // Cheap coastal boats get modest 2-3 pane windscreens; deep-sea bridges get wide 5 pane arrays.
    this.windowCount=this.tier<=1?arch.pick([2,3]):this.tier===2?arch.pick([3,4]):arch.pick([4,5,5]);
    // Realistic window architectural language per budget and seed:
    this.windowStyle=this.tier>=2?arch.pick(['alaskan','alaskan','sport']):arch.pick(['sport','alaskan','panoramic']);
    this.cabinRake=this.windowStyle==='alaskan'?arch.range(-.26,-.15):this.windowStyle==='sport'?arch.range(.12,.24):arch.range(-.03,.03);
    this.steeringStyle=this.tier>=4?'sport':this.tier===1?gene.pick(['sport','classic']):gene.pick(['classic','classic','sport']);
    // Dedicated fishing rig genes:
    // OUTRIGGER BOOMS belong exclusively on sportfishing, tournament, and charter trolling vessels.
    // Commercial trawlers, longliners, crabbers, seiners, factory ships, and small workboats
    // do NOT have sportfishing outriggers!
    // Original KEEL rig genes: outrigger style + continuous shape parameters.
    const rig=this.stream('fishing-rig');
    this.outrigger={style:rig.pick(['carbon','telescopic','truss']),reach:rig.range(.8,1.25),lift:rig.range(.85,1.2),rods:rig.int(2,5)};
    // BRIDGE ARCHITECTURE GENES: every seed produces a genuinely different wheelhouse.
    const br=this.stream('bridge-architecture:'+(options.revision||0));
    this.bridgeArchetype=this.tier>=3?br.pick(['command','command','panoramic']):this.tier===2?br.pick(['workboat','command','panoramic']):br.pick(['workboat','workboat','pilothouse']);
    this.helmSide=br.pick([-1,1]);
    this.consoleStyle=this.grade==='workboat'?br.pick(['straight','wrap','center']):br.pick(['wrap','straight','stepped']);
    this.screenCount=this.grade==='workboat'?br.pick([1,2]):this.grade==='standard'?br.pick([2,3]):br.pick([3,3,4]);
    this.seatCount=this.grade==='workboat'?1:br.pick([1,2,2]);
    this.overheadPod=this.grade!=='workboat'&&br.next()>.28;
    this.hasSettee=this.grade==='luxury'?br.next()>.30:br.next()>.72;
    this.hasChartTable=this.grade==='workboat'?false:this.grade==='standard'?br.next()>.35:br.next()>.18;
    this.ceilingStyle=this.grade==='workboat'?br.pick(['plain','panels']):br.pick(['battens','panels','ribs']);
    this.mullionWidth=this.grade==='workboat'?br.range(.030,.046):br.range(.018,.028);
    this.visorDepth=br.range(.30,.56);
    // CABINET SHAPE GENES: the whole wheelhouse silhouette changes every click.
    this.cabinShape=this.grade==='workboat'?br.pick(['block','tapered','raked']):br.pick(['tapered','raked','block','flared']);
    this.floorCover=br.pick(['bare','runner','mat']);
    this.gearRack=br.next()>.45;   // coiled lines, fenders and buckets stowed against the bulkhead
    this.trimColourIndex=br.int(0,PALETTES.length-1);
  }
  finishAllowed(f){
    if(this.grade==='workboat')return['workboat','painted'].includes(f);
    if(this.grade==='standard')return['walnut','ivory','painted','teak'].includes(f);
    return['walnut','ivory','graphite'].includes(f);
  }
  stream(name){return new Random(hash(`${this.key}:${name}`));}
}
