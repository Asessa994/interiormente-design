(()=>{
 const section=document.querySelector('#zona-notte');if(!section)return;
 const choices={
  luce:['Disegno una luce che non invade.','Preferisco punti di luce bassi e precisi: vicino al letto, su una superficie, dentro una nicchia. Così puoi leggere, prepararti o semplicemente fermarti, senza accendere tutta la stanza.'],
  materia:['Scelgo ciò che vorrai sentire vicino.','Faccio incontrare tessuti avvolgenti, superfici calde e colori profondi. Una testata morbida può dialogare con un comodino scultoreo: il contrasto resta, ma diventa più intimo.'],
  spazio:['Lascio spazio ai tuoi rituali.','Organizzo i passaggi e porto ordine negli elementi che usi ogni giorno. La stanza diventa semplice da vivere: quello che serve trova posto, quello che ami può farsi notare.']
 };
 const title=section.querySelector('[data-notte-title]'),copy=section.querySelector('[data-notte-copy]'),buttons=[...section.querySelectorAll('[data-notte-choice]')];
 buttons.forEach(button=>button.addEventListener('click',()=>{const choice=button.dataset.notteChoice,[heading,text]=choices[choice];title.textContent=heading;copy.textContent=text;section.dataset.choice=choice;buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
 section.dataset.choice='luce';
})();
