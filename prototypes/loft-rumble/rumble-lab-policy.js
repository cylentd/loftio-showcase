(function(root){
  'use strict';
  function allowed(location,element){
    if(element.hasAttribute('data-published-rumble'))return false;
    if(element.ownerDocument.querySelector('meta[name="rumble-runtime"]')?.getAttribute('content')!=='local-dev')return false;
    const url=new URL(location.href);
    return url.searchParams.get('lab')==='1'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  }
  root.LoftRumbleLabPolicy=Object.freeze({allowed});
})(globalThis);
