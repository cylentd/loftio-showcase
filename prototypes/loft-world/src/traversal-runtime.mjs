import {initialCharge,chargeTransition,carryLaunch} from './traversal-model.mjs';
import {impulse} from './contact-model.mjs';
import {TRAVERSAL as T} from './traversal-constants.mjs';
export function createTraversal(body) {
  let charge=initialCharge(),previous=new Set(),current=new Set(),serial=0,lastImpact=null;
  const history=[];
  function event(e){const before=charge.phase;charge=chargeTransition(charge,e);if(before!==charge.phase){history.push({from:before,to:charge.phase,event:e.type});if(history.length>T.historyLimit)history.shift();}}
  return {
    get charge(){return charge;},get ready(){return charge.phase==='ready';},get lastImpact(){return lastImpact;},history,
    reset(){charge=initialCharge();previous.clear();current.clear();serial=0;lastImpact=null;history.length=0;},
    release(shot){if(charge.phase!=='ready')return null;const v=carryLaunch(body.grounded?body.walkVel:body.vel,shot);if(v)event({type:'release'});return v;},
    support(e){if(e?.type==='support-contact')event(e);},
    tick(dt){event({type:'tick',dt,grounded:body.grounded,speed:body.grounded?body.walkVel.length():body.vel.length()});},
    begin(){current=new Set();},end(){previous=current;},
    contact(contactId,material,normal,velocity=body.vel,targetVelocity){
      const response=impulse(velocity,normal,material,targetVelocity);
      const fresh=!previous.has(contactId)&&!current.has(contactId);current.add(contactId);
      const qualifying=fresh&&response.incomingNormalSpeed>=T.contactSpeed;
      if(qualifying){lastImpact={id:++serial,contactId,material,...response};event({type:'impact',...response});}
      return {...response,fresh,qualifying};
    },
  };
}
