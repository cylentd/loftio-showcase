// Fight results for the end screen: stars, time, best combo, damage, and who dealt it. Camera experiment only. The owner asked for
// them (2026-11-09) so balance numbers come off the screen instead of from memory; the per-source split is also how a player can
// judge which resident to swap out. Since 2026-11-10 it is one results card that covers the game's own "Won in" card.
(function(root){
  'use strict';
  const settings=Object.freeze({
    minute:60,percent:100,
    // Stars: a grade for how fast the fight was won (owner, 2026-11-09). Win within starTimes[0] seconds for 3 stars, within
    // starTimes[1] for 2; any win is 1 and a loss is 0. At 4800 HP the owner's skilled fight took 46 s and a casual one about
    // 120 s, so 1:00 keeps 3 stars for skilled play and 2:30 lets a casual win still earn 2.
    starTimes:[60,150],
    // The card, in arena units (the arena is 360 wide). Heights of its bands from top to bottom, then sizes inside them.
    margin:14,side:18,radius:16,pad:16,
    titleBand:32,starBand:46,captionBand:20,headlineBand:50,factsBand:36,sectionBand:22,rowBand:58,footerBand:26,gap:10,
    maxRows:4,          // damage rows that fit, one per resident; more than this fold into one last row
    factFont:15,
    detailDrop:22,playDrop:35,detailMin:8, // the two detail lines sit this far under the row's text line; each shrinks to fit, but never under this size
    titleFont:24,valueFont:22,rowFont:13,smallFont:11,
    starOuter:17,starInner:7.5,starGap:44,starPoints:5,
    barHeight:5,barDrop:9, // the bar's thickness, and how far under the row's text line it sits
    coats:3,            // the card colour is see-through; this many coats hide the game's own result card underneath
  });
  const best=settings.starTimes.length+1;
  function stars(seconds,won){
    if(!won)return 0;
    return best-settings.starTimes.filter(limit=>seconds>limit).length;
  }
  // Called for every damage event. owner is the resident it belongs to; part is the ability's name, or nothing for the
  // resident's own hit. An ability belongs to the resident whose ability it is, not to the one whose launch set it off.
  const open=s=>s.cameraScene.stats??={hits:0,sources:{},marks:{},biggest:null};
  // weak: the hit landed on the weak spot.
  function record(s,owner,part,amount,weak){
    const stats=open(s),parts=stats.sources[owner]??={},entry=parts[part??'']??={damage:0,hits:0};
    stats.hits+=1;entry.damage+=amount;entry.hits+=1;
    if(!stats.biggest||amount>stats.biggest.amount)stats.biggest={amount,owner};
    if(weak)mark(s,owner,'weak');
  }
  // Counts one thing a resident did that is not damage: 'launches', 'perfects' (Perfect releases) or 'weak' (weak-spot hits).
  function mark(s,owner,what){
    const marks=open(s).marks[owner]??={};
    marks[what]=(marks[what]??0)+1;
  }
  const total=(list,key)=>list.reduce((sum,item)=>sum+item[key],0);
  function summary(s){
    const stats=s.cameraScene.stats??{hits:0,sources:{},marks:{},biggest:null};
    const grouped=[...new Set([...Object.keys(stats.sources),...Object.keys(stats.marks)])].map(name=>{
      const parts=Object.entries(stats.sources[name]??{}).map(([part,entry])=>({name:part||null,...entry})).sort((left,right)=>right.damage-left.damage);
      const {launches=0,perfects=0,weak=0}=stats.marks[name]??{},dealt=total(parts,'damage');
      return {name,damage:dealt,hits:total(parts,'hits'),parts,launches,perfects,weak,perLaunch:launches?Math.round(dealt/launches):0};
    }).sort((left,right)=>right.damage-left.damage);
    const damage=total(grouped,'damage');
    const sources=grouped.map(source=>({...source,share:damage?Math.round(source.damage/damage*settings.percent):0}));
    const extra={biggest:stats.biggest,perfects:total(sources,'perfects'),breaks:Object.values(s.hitBreaks??{}).reduce((sum,count)=>sum+count,0)};
    return {...extra,seconds:s.time,won:!!s.won,stars:stars(s.time,s.won),peak:s.hitsPeak,hits:stats.hits,damage,perSecond:s.time>0?Math.round(damage/s.time):0,sources};
  }
  const clock=seconds=>Math.floor(seconds/settings.minute)+':'+String(Math.floor(seconds%settings.minute)).padStart(2,'0');
  const nextStarTime=result=>settings.starTimes[best-result.stars-1];
  // Plain-text form of the results, one fact a line. The card shows the same facts; this is what the tests and a log read.
  function starLine(result,copy){
    const row=copy.star.repeat(result.stars)+copy.noStar.repeat(best-result.stars);
    if(!result.won)return row;
    if(result.stars===best)return `${row} · ${copy.topStars}`;
    return `${row} · ${result.stars+1} ${copy.nextStar} ${clock(nextStarTime(result))}`;
  }
  function lines(result,copy){
    return [starLine(result,copy),`${copy.time} ${clock(result.seconds)}`,`${copy.peak} ${result.peak}`,`${copy.hits} ${result.hits}`,
      `${copy.damage} ${result.damage} · ${result.perSecond}${copy.perSecond}`,
      ...(result.biggest?[`${copy.biggest} ${result.biggest.amount} · ${result.biggest.owner}`]:[]),
      `${copy.perfects} ${result.perfects}`,`${copy.breaks} ${result.breaks}`,
      ...result.sources.flatMap(source=>[`${source.name} ${source.damage} · ${source.share}%`,'  '+playText(source,copy),
        ...source.parts.map(part=>'  '+partText(part,copy))])];
  }
  // How a resident was played: "Launches 12 · Perfect 7 · Weak spot 9 · Per launch 228". Per launch counts its abilities' damage too.
  const playText=(source,copy)=>`${copy.launches} ${source.launches} · ${copy.perfect} ${source.perfects} · ${copy.weak} ${source.weak} · ${copy.perLaunch} ${source.perLaunch}`;
  // One part of a resident's damage: "Seed burst 992 ×73" is 992 damage over 73 hits.
  const partText=(part,copy)=>`${part.name??copy.ownHits} ${part.damage} ${copy.hitMark}${part.hits}`;
  // The damage rows the card draws: one per resident, biggest first, with its bar length against the biggest and its parts on
  // one line of detail. The overflow folds into one last row.
  function rows(result,copy){
    let list=result.sources;
    if(list.length>settings.maxRows){
      const rest=list.slice(settings.maxRows-1),damage=total(rest,'damage');
      list=[...list.slice(0,settings.maxRows-1),{name:copy.other,damage,share:Math.round(damage/result.damage*settings.percent),parts:[]}];
    }
    const top=Math.max(0,...list.map(source=>source.damage));
    return list.map(source=>({...source,fill:top?source.damage/top:0,detail:source.parts.map(part=>partText(part,copy)).join(' · '),
      play:source.launches===undefined?'':playText(source,copy)}));
  }
  const cardHeight=count=>settings.pad*2+settings.titleBand+settings.starBand+settings.captionBand+settings.gap+settings.headlineBand
    +settings.factsBand+settings.gap+settings.sectionBand+settings.rowBand*count+settings.footerBand;

  function star(ctx,x,y){
    ctx.beginPath();
    for(let index=0;index<settings.starPoints*2;index++){
      const radius=index%2?settings.starInner:settings.starOuter,angle=index*Math.PI/settings.starPoints-Math.PI/2;
      ctx.lineTo(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius);
    }
    ctx.closePath();
  }
  function caption(result,copy){
    if(!result.won)return copy.lossHint;
    return result.stars===best?copy.topCaption:`${copy.nextStarAt} ${clock(nextStarTime(result))}`;
  }
  // One card in the middle of the play area: result, stars, three headline numbers, then who dealt the damage.
  function draw(game,font,copy){
    const {ctx,s,C,colors}=game,result=summary(s),list=rows(result,copy);
    const width=s.w-settings.side*2,height=cardHeight(list.length),x=settings.side,centre=s.w/2;
    let y=C.hudTop+(s.h-C.hudTop-C.hudBottom-height)/2;
    const text=(value,size,colour,tx,ty,align='center',weight='bold')=>{
      ctx.font=weight+' '+size+'px '+font;ctx.fillStyle=colors[colour];ctx.textAlign=align;ctx.fillText(value,tx,ty);};
    ctx.save();ctx.textBaseline='middle';
    for(let coat=0;coat<settings.coats;coat++){ctx.fillStyle=colors.card;ctx.beginPath();ctx.roundRect(x,y,width,height,settings.radius);ctx.fill();}
    ctx.strokeStyle=colors.border;ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x,y,width,height,settings.radius);ctx.stroke();
    y+=settings.pad;
    text(result.won?copy.victory:copy.defeat,settings.titleFont,result.won?'warning':'danger',centre,y+settings.titleBand/2);
    y+=settings.titleBand;
    for(let index=0;index<best;index++){
      star(ctx,centre+(index-(best-1)/2)*settings.starGap,y+settings.starBand/2);
      ctx.fillStyle=index<result.stars?colors.warning:colors.track;ctx.fill();
      ctx.strokeStyle=index<result.stars?colors.warning:colors.border;ctx.lineWidth=1.5;ctx.stroke();
    }
    y+=settings.starBand;
    text(caption(result,copy),settings.smallFont+1,'muted-foreground',centre,y+settings.captionBand/2,'center','normal');
    y+=settings.captionBand+settings.gap;
    const headline=[[clock(result.seconds),copy.time],[String(result.peak),copy.bestCombo],[String(result.perSecond),copy.perSecondLabel]];
    headline.forEach(([value,label],index)=>{
      const column=x+width*(index*2+1)/(headline.length*2);
      text(value,settings.valueFont,'foreground',column,y+settings.valueFont/2+2);
      text(label,settings.smallFont,'muted-foreground',column,y+settings.headlineBand-settings.smallFont,'center','normal');
    });
    y+=settings.headlineBand;
    const facts=[[String(result.biggest?.amount??0),result.biggest?`${copy.biggest} · ${result.biggest.owner}`:copy.biggest],
      [String(result.perfects),copy.perfects],[String(result.breaks),copy.breaks]];
    facts.forEach(([value,label],index)=>{
      const column=x+width*(index*2+1)/(facts.length*2);
      text(value,settings.factFont,'foreground',column,y+settings.factFont/2+1);
      text(label,settings.smallFont,'muted-foreground',column,y+settings.factsBand-settings.smallFont,'center','normal');
    });
    y+=settings.factsBand+settings.gap;
    const left=x+settings.pad,right=x+width-settings.pad,span=right-left;
    ctx.strokeStyle=colors.border;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y-settings.gap/2);ctx.lineTo(right,y-settings.gap/2);ctx.stroke();
    text(copy.dealt,settings.smallFont,'muted-foreground',left,y+settings.sectionBand/2,'left','normal');
    text(`${result.damage} ${copy.total}`,settings.smallFont,'muted-foreground',right,y+settings.sectionBand/2,'right','normal');
    y+=settings.sectionBand;
    list.forEach((row,index)=>{
      const line=y+settings.rowBand*index+settings.rowFont/2+2,bar=line+settings.barDrop;
      text(row.name,settings.rowFont,'foreground',left,line,'left');
      text(`${row.damage}  ·  ${row.share}%`,settings.rowFont,'foreground',right,line,'right','normal');
      ctx.fillStyle=colors.track;ctx.beginPath();ctx.roundRect(left,bar,span,settings.barHeight,settings.barHeight/2);ctx.fill();
      ctx.fillStyle=index?colors.primary:colors.warning;ctx.beginPath();ctx.roundRect(left,bar,Math.max(settings.barHeight,span*row.fill),settings.barHeight,settings.barHeight/2);ctx.fill();
      // The detail shrinks to the row's width: a resident with an ability and a special has three parts to name.
      for(const [words,drop] of [[row.detail,settings.detailDrop],[row.play,settings.playDrop]]){
        ctx.font='normal '+settings.smallFont+'px '+font;
        const size=Math.max(settings.detailMin,Math.min(settings.smallFont,settings.smallFont*span/Math.max(1,ctx.measureText(words).width)));
        text(words,size,'muted-foreground',left,line+drop,'left','normal');
      }
    });
    y+=settings.rowBand*list.length;
    text(copy.again,settings.smallFont+1,'muted-foreground',centre,y+settings.footerBand/2+2,'center','normal');
    ctx.restore();
  }
  root.LoftRumbleStats={settings,stars,record,mark,summary,lines,rows,cardHeight,draw};
})(globalThis);
