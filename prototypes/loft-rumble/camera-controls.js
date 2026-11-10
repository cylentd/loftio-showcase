(function (root) {
  'use strict';
  const copy=root.LoftRumbleCameraCopy;

  function select(id, label, options, handler) {
    const wrapper=document.createElement('label'),title=document.createElement('span'),input=document.createElement('select');
    title.textContent=label;input.id=id;
    for(const [value,text] of Object.entries(options))input.add(new Option(text,value));
    input.onchange=()=>handler(input.value);
    wrapper.append(title,input);
    return wrapper;
  }

  function mount(api) {
    const panel=document.createElement('details'),heading=document.createElement('summary'),body=document.createElement('div');
    panel.id='camera-tools';heading.textContent=copy.title;body.className='camera-controls';
    body.append(select('camera-mode',copy.mode,copy.modes,value=>api.mode(value)));
    body.append(select('camera-scene',copy.scene,copy.scenes,value=>api.scene(value)));
    body.append(select('camera-art',copy.art,copy.artPacks,value=>api.art(value)));
    body.append(select('camera-fire',copy.fire,copy.fires,value=>api.fire(value)));
    const tilt=document.createElement('label'),label=document.createElement('span'),range=document.createElement('input');
    label.textContent=copy.tilt;range.id='camera-tilt';range.type='range';range.min=root.LoftRumbleCameraConfig.minTilt;range.max=root.LoftRumbleCameraConfig.maxTilt;
    range.oninput=()=>api.tilt(range.value);tilt.append(label,range);body.append(tilt);
    const config=root.LoftRumbleCameraConfig,payoff=root.LoftRumblePayoff.settings;
    // Each tuning slider shows its live value in its label; show(value) is how it words that value.
    const sliders=[
      {key:'combo',id:'camera-combo',min:0,max:config.comboTestMax,step:1,set:api.combo,show:value=>value?value+' '+copy.comboHeld:copy.comboOff},
      {key:'timeout',id:'camera-timeout',min:config.comboTimeoutMin,max:config.comboTimeoutMax,step:config.sliderStep,set:api.timeout,show:value=>value+copy.seconds},
      {key:'payoff',id:'camera-payoff',min:payoff.peakMin,max:payoff.peakMax,step:config.sliderStep,set:api.payoff,show:value=>value>payoff.peakMin?value+copy.times:copy.payoffOff},
      {key:'bossHp',id:'camera-hp',min:config.bossHpMin,max:config.bossHpMax,step:config.bossHpStep,set:api.bossHp,show:value=>String(value)},
      {key:'seek',id:'camera-seek',min:root.LoftRumbleSeek.settings.min,max:root.LoftRumbleSeek.settings.max,step:config.seekStep,set:api.seek,show:value=>value?value+copy.degrees:copy.payoffOff},
    ];
    for(const slider of sliders){
      const wrapper=document.createElement('label');slider.label=document.createElement('span');slider.range=document.createElement('input');
      Object.assign(slider.range,{id:slider.id,type:'range',min:slider.min,max:slider.max,step:slider.step});
      slider.range.oninput=()=>slider.set(slider.range.value);wrapper.append(slider.label,slider.range);body.append(wrapper);
    }
    const debug=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');
    check.type='checkbox';check.id='camera-debug';text.textContent=copy.debug;check.onchange=()=>api.debug(check.checked);debug.append(check,text);body.append(debug);
    const buttons=document.createElement('div');buttons.className='camera-buttons';
    for(const [id,title,action] of [['camera-freeze',copy.freeze,()=>api.freeze(!api.status().frozen)],['camera-replay',copy.replay,()=>api.replay()],['camera-restore',copy.restore,()=>api.restore()]]) {
      const button=document.createElement('button');button.id=id;button.textContent=title;button.onclick=action;buttons.append(button);
    }
    body.append(buttons);
    for(const content of [copy.note,copy.legend]){const note=document.createElement('p');note.textContent=content;body.append(note);}
    panel.append(heading,body);document.body.append(panel);
    const sync=()=>{const state=api.status();document.getElementById('camera-mode').value=state.mode;document.getElementById('camera-scene').value=state.scene;
      document.getElementById('camera-art').value=state.artPack;document.getElementById('camera-fire').value=state.fire;
      for(const slider of sliders){slider.range.value=state[slider.key];slider.label.textContent=copy[slider.key]+': '+slider.show(state[slider.key]);}
      range.value=state.tilt;range.setAttribute('aria-label',copy.tilt+' '+state.tilt+'°');check.checked=state.debug;
      document.getElementById('camera-freeze').textContent=state.frozen?copy.resume:copy.freeze;};
    sync();
    return {sync};
  }
  root.LoftRumbleCameraControls={mount};
})(globalThis);
