(function(root){
  'use strict';
  const look=root.LoftRumbleWhiplashLook,paint=root.LoftRumbleWhiplashPaint;
  const smooth=k=>k*k*(look.smoothstepEdge-2*k),mix=(a,b,k)=>a+(b-a)*k;
  // Owner 2026-11-18: the swing eases in, so it starts slow and ends at full speed.
  const ease=k=>Math.pow(Math.max(0,Math.min(1,k)),look.strikeEase);
  function pose(p,rig={}){
    const R=rig.radius??look.rigRadius,u=rig.upright??1,foot=R*(rig.foot??look.rigFoot)*u;
    const k=Math.min(1,p.phaseElapsed/(p.phaseDuration||1)),s=smooth(k);
    const prepare=p.phase==='prepare',strike=p.phase==='strike',recover=p.phase==='recover';
    const load=look.twistLoad+look.twistHold;
    const twist=prepare?-look.twistLoad*k:strike?-load+(load+look.twistFollow)*s:
      recover?look.twistFollow*(1-s):-look.twistLoad-look.twistHold*k;
    const restY=R*look.shoulderY*u-foot,restX=R*look.shoulderX;
    const shoulder={x:p.origin.x+Math.cos(twist)*restX-Math.sin(twist)*restY,
      y:p.origin.y+foot+Math.sin(twist)*restX+Math.cos(twist)*restY};
    const angle=strike?mix(p.startAngle,p.endAngle,ease(k)):recover?p.endAngle+look.coil*Math.sin(k*Math.PI):
      p.startAngle+(prepare?look.readyAngle+look.lift*(1-k):look.readyAngle*(1-k));
    // Recover retracts the branch back into the socket: the growth in reverse, no fade.
    const growth=prepare?mix(look.knot,look.grownAtWarning,s):recover?mix(1,0,s):strike?1:mix(look.grownAtWarning,1,s);
    const extension=prepare?mix(look.fold/2,look.fold,s):strike||recover?1:mix(look.fold,1,s);
    const length=Math.max(R,p.reach-R*look.shoulderX)*extension;
    const part=length/(1+2*look.join),pieces=[];
    for(const [name,offset,width] of [['branch',0,length],['base',0,part],['middle',part*look.join,part],['tip',2*part*look.join,part]]){
      const im=paint[name],fullHeight=Math.max(look.minimumThickness,width*im.height/im.width);
      // The branch rolls edge-on as it coils behind the socket; opacity remains one.
      const height=fullHeight;
      const visible=Math.max(0,Math.min(1,(growth*length-offset)/width));
      const count=recover||prepare||growth<1?look.bendSlices:1;
      for(let i=0;i<count;i++){
        const fraction=Math.min(1/count,visible-i/count);if(fraction<=0)break;
        const sourceX=im.width*i/count,sourceWidth=im.width*fraction;
        const taper=growth<1?Math.min(1,(growth*length-offset-width*i/count)/(look.minimumThickness*(1-growth))):1;
        const thickness=height*taper;
        const along=offset+width*(i/count-look.rootX);
        // Recover curls gently as it retracts, mirroring the growth; never fading it.
        const curl=recover?-s/look.liftBendRadius:prepare?-(1-s)/look.liftBendRadius:0;
        const bend=curl*along;
        const x=curl?Math.sin(bend)/curl:along,y=curl?(1-Math.cos(bend))/curl:0;
        const turn=angle+bend;
        pieces.push({name,sourceX,sourceWidth,x:shoulder.x+Math.cos(angle)*x-Math.sin(angle)*y,
          y:shoulder.y+Math.sin(angle)*x+Math.cos(angle)*y,angle:turn,
          width:width*fraction,height:thickness,top:-thickness*look.rootY,fullWidth:width});
      }
    }
    return {pieces,angle,length,twist,foot,shoulder,behind:false,rest:recover&&k>=1};
  }
  function polygons(p,rig){
    return pose(p,rig).pieces.flatMap(piece=>paint[piece.name].outlines.map(outline=>{
      const im=paint[piece.name],c=Math.cos(piece.angle),s=Math.sin(piece.angle);
      const polygon=outline.map(([x,y])=>{const dx=x/im.width*piece.fullWidth,dy=piece.top+y/im.height*piece.height;
        return {x:piece.x+c*dx-s*dy,y:piece.y+s*dx+c*dy};});
      polygon.group=piece.name;return polygon;
    }));
  }
  root.LoftRumbleWhiplashPose=Object.freeze({pose,polygons,ease});
})(globalThis);
