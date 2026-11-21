(function(root){
  'use strict';
  // Hosts the lab opens on: loopback, plus any host the optional, untracked rumble-lab-hosts.local.js lists in
  // globalThis.LoftRumbleLabHosts (owner 2026-11-20, "open the gate": play-test a lab stage on the phone). The owner's own host
  // never appears in a tracked file, because this file is exported and the exporter refuses a tailnet name. A published or
  // non-local-dev page refuses on every host.
  const LOOPBACK=Object.freeze(['localhost','127.0.0.1','[::1]']);
  const labHosts=()=>{const extra=root.LoftRumbleLabHosts;return [...LOOPBACK,...(Array.isArray(extra)?extra.filter(host=>typeof host==='string'):[])]};
  // A raw local-dev page on a lab host, with or without ?lab=1. A hidden stage (swarm) may run here in the shipped UI; ?lab=1
  // additionally keeps the lab chrome (owner 2026-11-20: the lab page showed the old UI).
  function local(location,element){
    if(element.hasAttribute('data-published-rumble'))return false;
    if(element.ownerDocument.querySelector('meta[name="rumble-runtime"]')?.getAttribute('content')!=='local-dev')return false;
    return labHosts().includes(new URL(location.href).hostname);
  }
  function allowed(location,element){
    return local(location,element)&&new URL(location.href).searchParams.get('lab')==='1';
  }
  root.LoftRumbleLabPolicy=Object.freeze({allowed,local});
})(globalThis);
