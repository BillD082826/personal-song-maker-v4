// Display-only mascot companion. Never creates orders or starts music generation.
(() => {
  const messages={
    saving:['Saving your story','Your details are being saved before we create your preview.'],
    creating:['Your story is becoming a song','We’re creating your personalized preview. This can take several minutes.'],
    ready:['Your preview is ready','Listen below and hear your story come to life.'],
    error:['Your preview needs another try','Please read the message shown and try again when you’re ready.']
  };
  function show(stage,order={}){
    const box=document.getElementById('bopCreationStatus');if(!box||!messages[stage])return;
    const sensitive=/memori|tribute|bereave|funeral|loss|in memory/i.test(String(order.occasion||''));
    box.hidden=false;box.dataset.stage=stage;
    box.querySelector('img').hidden=sensitive;
    box.querySelector('[data-bop-title]').textContent=messages[stage][0];
    box.querySelector('[data-bop-message]').textContent=messages[stage][1];
  }
  function hide(){const box=document.getElementById('bopCreationStatus');if(box)box.hidden=true;}
  window.LyriBopHost={show,hide};
})();
