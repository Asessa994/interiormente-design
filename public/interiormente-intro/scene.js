(async()=>{
'use strict';
/* A continuous wrist bend with unit centerline speed. The palm and fingers
   rotate together beyond the wrist; no independent scaling of finger bones. */
const Motion=(()=>{
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const ease=x=>{const t=clamp(x);return t*t*t*(10+t*(-15+6*t))};
const arms=[{id:'left',row:0,side:1,center:.171,finger:{x:1491/1536,y:229/1536},indexBase:{x:1330/1536,y:216/1536},startAngle:-1.05},{id:'right',row:1,side:-1,center:.158,finger:{x:1504/1536,y:(700-512)/1536},indexBase:{x:1345/1536,y:(688-512)/1536},startAngle:1.05}];
function curve(angle,center){
 const n=384,dx=1/n,xs=new Float64Array(n+1),ys=new Float64Array(n+1);ys[0]=center;
 for(let i=1;i<=n;i++){const th=angle*smooth(.61,.80,(i-.5)/n);xs[i]=xs[i-1]+Math.cos(th)*dx;ys[i]=ys[i-1]+Math.sin(th)*dx;}
 return{angle,center,n,xs,ys};
}
function bend(p,c){const f=clamp(p.x)*c.n,i=Math.min(c.n-1,Math.floor(f)),t=f-i,th=c.angle*smooth(.61,.80,p.x),d=p.y-c.center;return{x:c.xs[i]+(c.xs[i+1]-c.xs[i])*t-Math.sin(th)*d,y:c.ys[i]+(c.ys[i+1]-c.ys[i])*t+Math.cos(th)*d};}
function phases(p,t={ingressoInizio:7,ingressoFine:35,gestoInizio:29,gestoFine:62,zoomInizio:68}){return{enter:smooth(t.ingressoInizio/100,t.ingressoFine/100,p),gesture:ease(clamp((p-t.gestoInizio/100)/((t.gestoFine-t.gestoInizio)/100))),portal:smooth(t.zoomInizio/100,1,p),sides:1-smooth(Math.max(0,t.gestoInizio/100-.05),t.gestoFine/100,p)*.78};}
function portal(p,letter,w,h,centerBy=.42){
 const radius=Math.max(.1,Math.min(letter.width*(288/888),letter.height*(340/728))*.82),endScale=Math.max(1,Math.hypot(w,h)/(2*radius)*1.08),scale=Math.exp(Math.log(endScale)*p),centering=smooth(0,centerBy,p);
 const ox=letter.x+letter.width/2,oy=letter.y+letter.height/2,cx=ox+(w/2-ox)*centering,cy=oy+(h/2-oy)*centering;
 return{scale,tx:cx-ox,ty:cy-oy,width:letter.width*scale,height:letter.height*scale,x:cx-letter.width*scale/2,y:cy-letter.height*scale/2,cx,cy,radius};
}
return{clamp,smooth,ease,arms,curve,bend,phases,portal};
})();

/* Three supplied columns on each side, opening outwards like a curtain.
   Approved hands, spark and O timing is unchanged. */
const IntroMotion=(()=>{
 const clamp=x=>Math.max(0,Math.min(1,x));
 const smooth=(a,b,p)=>{const t=clamp((p-a)/(b-a));return t*t*(3-2*t)};
 function curtain(p,index=0,mobile=false,end=.25){
  const delay=(index%3)*.026;if(end<=0)return{open:1,recede:1,count:6};
  const open=smooth(.025+delay,.83+delay,p/Math.max(.05,end));
  return{open,recede:open*open,count:6};
 }
 function column(p,index,mobile=false,end=.25,aspect=390/844){
  if(index<0||index>=6)throw Error('Invalid column index');
  const rank=index%3,side=index<3?-1:1,spec={start:side*[.18,.52,.86][rank],edge:[.84,.97,1.1][rank],height:[1,.96,.92][rank],z:[1.2,.5,-.2][rank],endZ:[-4.5,-6.3,-8][rank]};
  const phase=curtain(p,index,mobile,end),q=phase.open,start=mobile?side*[.29,.61,.93][rank]:spec.start,z=spec.z+(spec.endZ-spec.z)*phase.recede,cameraZ=mobile?10.4:12.7;
  const mobileScale=mobile?Math.min(.52,.44*aspect/(390/844)):1;
  return{...phase,side,rank,x:start+(side*spec.edge-start)*q,z,height:spec.height*mobileScale,scale:spec.height*mobileScale*(cameraZ-spec.z)/(cameraZ-z),rotation:side*(-.025+.095*q)};
 }
 const reveal=(p,end=.25)=>end<=0?1:smooth(end*.12,end*.88,p);
 return{curtain,column,reveal};
})();

/* All editable animation values are declared here and exported verbatim. */
const Preferences=(()=>{
const fields=[
 ['mani.sinistraInizioGradi','Inclinazione iniziale sinistra',0,60,1,'°','start'],
 ['mani.destraInizioGradi','Inclinazione iniziale destra',0,60,1,'°','start'],
 ['mani.sinistraFinaleGradi','Inclinazione finale sinistra',-12,12,1,'°','end'],
 ['mani.destraFinaleGradi','Inclinazione finale destra',-12,12,1,'°','end'],
 ['mani.scalaDesktop','Dimensione su desktop',.95,1.4,.01,'×','end'],
 ['mani.scalaMobile','Dimensione su mobile',.8,1.3,.01,'×','end'],
 ['mani.altezzaPercento','Altezza mani rispetto alla O',-12,12,.5,'%','end'],
 ['mani.distanzaDitaPx','Spazio finale tra le dita',2,24,1,'px','end'],
 ['tempi.durataSecondi','Durata totale della sequenza',2.5,12,.1,'s','keep'],
 ['tempi.ingressoInizio','Inizio ingresso dai lati',0,25,1,'%','entry'],
 ['tempi.ingressoFine','Fine ingresso dai lati',10,50,1,'%','entry'],
 ['tempi.gestoInizio','Inizio rotazione delle mani',10,60,1,'%','start'],
 ['tempi.gestoFine','Fine rotazione delle mani',35,82,1,'%','end'],
 ['tempi.scintilla','Momento della scintilla',40,88,1,'%','spark'],
 ['tempi.zoomInizio','Inizio passaggio nella O',50,94,1,'%','zoom'],
 ['tempi.pausaScintillaMs','Pausa sulla scintilla',0,1500,50,'ms','spark'],
 ['scintilla.intensita','Luminosità del lampo',.2,2.5,.05,'×','spark'],
 ['scintilla.alonePx','Ampiezza dell’alone',20,140,1,'px','spark'],
 ['scintilla.durataMs','Durata del lampo',200,2400,50,'ms','spark'],
 ['scintilla.scariche','Piccole scariche',0,6,1,'','spark'],
 ['scintilla.luceResidua','Luce dopo il lampo',0,.6,.01,'×','spark'],
 ['portale.curvaZoom','Accelerazione dello zoom',.6,2,.05,'×','zoom'],
 ['portale.centraturaPercento','Centra la O entro',10,90,1,'%','zoom'],
 ['scorrimento.schermate','Lunghezza dello scroll',2,5,.05,'schermate','keep'],
 ['scorrimento.morbidezzaMs','Morbidezza dello scroll',0,400,10,'ms','keep']
];
const storageKey='interiormente.gesto.settings.v1.36633da4a9a5';
const defaults=()=>({"versione":1,"mani":{"sinistraInizioGradi":0,"destraInizioGradi":11,"sinistraFinaleGradi":-12,"destraFinaleGradi":-1,"scalaDesktop":1,"scalaMobile":0.97,"altezzaPercento":0,"distanzaDitaPx":7},"tempi":{"durataSecondi":3,"ingressoInizio":25,"ingressoFine":35,"gestoInizio":29,"gestoFine":63,"scintilla":78,"zoomInizio":80,"pausaScintillaMs":450},"scintilla":{"intensita":2.5,"alonePx":41,"durataMs":1850,"scariche":2,"luceResidua":0.43},"portale":{"curvaZoom":1.05,"centraturaPercento":50},"scorrimento":{"schermate":2.05,"morbidezzaMs":400}});
const get=(o,path)=>path.split('.').reduce((v,k)=>v&&v[k],o);
function set(o,path,value){const keys=path.split('.');o[keys[0]][keys[1]]=value;}
const copy=o=>JSON.parse(JSON.stringify(o));
function normalize(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('I parametri devono essere un oggetto JSON.');
 if(raw.versione!==undefined&&raw.versione!==1)throw Error('Versione dei parametri non supportata.');
 const value=defaults(),adjusted=[];
 for(const [path,,min,max,step]of fields){const input=get(raw,path);if(input===undefined)continue;if(typeof input!=='number'||!Number.isFinite(input))throw Error('Valore numerico non valido: '+path);const n=Math.max(min,Math.min(max,input)),rounded=Number((Math.round(n/step)*step).toFixed(4));set(value,path,rounded);if(rounded!==input)adjusted.push(path);}
 const t=value.tempi,previous=JSON.stringify(t);
 t.ingressoFine=Math.max(t.ingressoFine,t.ingressoInizio+5);
 t.gestoInizio=Math.max(t.gestoInizio,t.ingressoInizio);
 t.gestoFine=Math.max(t.gestoFine,t.gestoInizio+8,t.ingressoFine+3);
 t.scintilla=Math.max(t.scintilla,t.gestoFine);
 t.zoomInizio=Math.max(t.zoomInizio,t.scintilla+2);
 t.pausaScintillaMs=Math.min(t.pausaScintillaMs,Math.floor(t.durataSecondi*450/50)*50);
 if(JSON.stringify(t)!==previous)adjusted.push('tempi');
 return{value,adjusted};
}
return{fields,storageKey,defaults,get,set,copy,normalize};
})();

/* Approved mobile layout. Desktop ignores these transforms. */
const MobileLayout=(()=>{
 const columnIds=['colonnaLabbra','colonnaRossetti','colonnaJoker','colonnaCartaDaParati','colonnaTomJerry','colonnaSerpenti'];
 const specs=[
  ['colonnato','Tutte le colonne','Colonne','start'],
  ['colonneSinistra','Gruppo sinistro','Colonne','start'],['colonneDestra','Gruppo destro','Colonne','start'],
  ['colonnaLabbra','Labbra · sinistra interna','Colonne','start'],['colonnaRossetti','Rossetti · sinistra centrale','Colonne','start'],['colonnaJoker','Joker · sinistra esterna','Colonne','start'],
  ['colonnaCartaDaParati','Carta da parati · destra interna','Colonne','start'],['colonnaTomJerry','Tom e Jerry · destra centrale','Colonne','start'],['colonnaSerpenti','Serpenti · destra esterna','Colonne','start'],
  ['logo','Logo','Testata','start'],['saltaIntro','Salta intro','Testata','start'],['ricomincia','Ricomincia','Testata','start'],
  ['titolo','Scritta Interiormente','Titoli e luce','title'],['letteraO','Lettera O / portale','Titoli e luce','title'],['motto','Eredità classica / estetica moderna','Titoli e luce','title'],['design','Scritta Design','Titoli e luce','title'],['bagliore','Bagliore dall’alto','Titoli e luce','start'],
  ['mani','Entrambe le braccia','Gesto','hands'],['manoSinistra','Braccio sinistro','Gesto','hands'],['manoDestra','Braccio destro','Gesto','hands'],['scintilla','Scintilla','Gesto','spark'],
  ['freccia','Freccia di scroll','Interfaccia','start'],['barraAvanzamento','Linea di avanzamento','Interfaccia','start'],
  ['ingresso','Tutto il contenuto dopo la O','Dopo la O','inside'],['titoloIngresso','Titolo dopo la O','Dopo la O','inside'],['descrizioneIngresso','Descrizione dopo la O','Dopo la O','inside'],['etichettaIngresso','Benvenuto in Interiormente','Dopo la O','inside'],['rivediIntro','Rivedi l’intro','Dopo la O','inside'],['notaIngresso','Nota dell’anteprima','Dopo la O','inside'],['arcoIngresso','Arco decorativo','Dopo la O','inside'],['scrittaSfondo','Scritta sullo sfondo','Dopo la O','inside']
 ];
 const identity=()=>({xPercento:0,yPercento:0,scala:1});
 const approved={"versione":1,"elementi":{"colonnato":{"xPercento":0,"yPercento":-9,"scala":0.99},"colonneSinistra":{"xPercento":0,"yPercento":0,"scala":1},"colonneDestra":{"xPercento":0,"yPercento":0,"scala":1},"colonnaLabbra":{"xPercento":0,"yPercento":0,"scala":1},"colonnaRossetti":{"xPercento":0,"yPercento":0,"scala":1},"colonnaJoker":{"xPercento":0,"yPercento":0,"scala":1},"colonnaCartaDaParati":{"xPercento":0,"yPercento":0,"scala":1},"colonnaTomJerry":{"xPercento":0,"yPercento":0,"scala":1},"colonnaSerpenti":{"xPercento":0,"yPercento":0,"scala":1},"logo":{"xPercento":29,"yPercento":0,"scala":1},"saltaIntro":{"xPercento":0,"yPercento":0,"scala":1.07},"ricomincia":{"xPercento":0,"yPercento":0,"scala":1},"titolo":{"xPercento":0,"yPercento":1.25,"scala":1.19},"letteraO":{"xPercento":0,"yPercento":0,"scala":1},"motto":{"xPercento":0,"yPercento":0,"scala":1},"design":{"xPercento":0,"yPercento":0,"scala":1.55},"bagliore":{"xPercento":0,"yPercento":0,"scala":1},"mani":{"xPercento":0,"yPercento":0,"scala":1},"manoSinistra":{"xPercento":0,"yPercento":0,"scala":1},"manoDestra":{"xPercento":0,"yPercento":0,"scala":1},"scintilla":{"xPercento":0,"yPercento":0,"scala":1},"freccia":{"xPercento":0,"yPercento":0,"scala":1},"barraAvanzamento":{"xPercento":0,"yPercento":0,"scala":1},"ingresso":{"xPercento":0,"yPercento":0,"scala":1},"titoloIngresso":{"xPercento":0,"yPercento":0,"scala":1},"descrizioneIngresso":{"xPercento":0,"yPercento":0,"scala":1},"etichettaIngresso":{"xPercento":0,"yPercento":0,"scala":1},"rivediIntro":{"xPercento":0,"yPercento":0,"scala":1},"notaIngresso":{"xPercento":0,"yPercento":0,"scala":1},"arcoIngresso":{"xPercento":0,"yPercento":0,"scala":1},"scrittaSfondo":{"xPercento":0,"yPercento":0,"scala":1}}};
 const defaults=()=>JSON.parse(JSON.stringify(approved));
 function normalize(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Layout mobile non valido.');
  if(raw.versione!==undefined&&raw.versione!==1)throw Error('Versione del layout mobile non supportata.');
  const value=defaults();
  for(const [id]of specs){const input=raw.elementi?.[id];if(input===undefined)continue;if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Elemento mobile non valido: '+id);
   for(const key of ['xPercento','yPercento','scala']){const n=input[key];if(n===undefined)continue;if(typeof n!=='number'||!Number.isFinite(n))throw Error('Valore mobile non valido: '+id+'.'+key);const min=key==='scala'?.1:-100,max=key==='scala'?3:100,step=key==='scala'?.01:.25;value.elementi[id][key]=Number((Math.round(Math.max(min,Math.min(max,n))/step)*step).toFixed(4));}
  }
  return value;
 }
 const get=(config,id)=>config?.elementi?.[id]||identity();
 function combine(config,ids){const out=identity();for(const id of ids){const v=get(config,id);out.xPercento+=v.xPercento;out.yPercento+=v.yPercento;out.scala*=v.scala;}return out;}
 function column(config,index){const group=combine(config,['colonnato',index<3?'colonneSinistra':'colonneDestra']),own=get(config,columnIds[index]);return{xPercento:group.xPercento+own.xPercento,yPercento:group.yPercento+own.yPercento,groupScale:group.scala,scala:group.scala*own.scala};}
 return{specs,columnIds,identity,defaults,normalize,get,combine,column,storageKey:'interiormente.mobile-layout.v1.17f91b5df3ba'};
})();

const reviewMode=document.querySelector('[data-interiormente-intro]')?.dataset.editor!=='false'||new URLSearchParams(location.search).has('editor');
const approvedConfig=JSON.parse(document.getElementById('parametri-scelti')?.textContent||'{}');
let settings=Preferences.normalize(approvedConfig).value,mobileSettings=MobileLayout.normalize(approvedConfig.layoutMobile||MobileLayout.defaults()),heldTime=null;
try{const saved=localStorage.getItem(MobileLayout.storageKey);if(reviewMode&&saved)mobileSettings=MobileLayout.normalize(JSON.parse(saved));}catch{}
try{const saved=localStorage.getItem(Preferences.storageKey);if(reviewMode&&saved)settings=Preferences.normalize(JSON.parse(saved)).value;}catch{}
const $=id=>document.getElementById(id),track=$('track'),stage=$('stage'),word=$('wordmark'),letter=$('letter-o'),aperture=$('aperture'),outline=$('portal-outline'),outlinePath=$('outline-path'),portalVisual=$('portal-visual'),entry=$('progetti'),header=$('header'),atlas=$('atlas'),controls=$('controls'),live=$('live'),progressBar=$('progress-bar');
const {clamp,smooth,ease}=Motion,reduced=matchMedia('(prefers-reduced-motion:reduce)');
document.body.classList.toggle('preview-mobile',reviewMode);
const clone=entry.cloneNode(true);clone.removeAttribute('id');clone.removeAttribute('aria-labelledby');clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));clone.querySelectorAll('button').forEach(e=>e.setAttribute('tabindex','-1'));portalVisual.appendChild(clone);
let canvas=$('arms'),gl=null,ctx=null,program=null,texture=null,loc={},w=1,h=1,dpr=1,mobile=false,ready=false,p=0,target=0,raf=0,lastTime=0,auto=0,visible=true,metrics=null,burst=-1e6,latched=false,frame=0,architecture=null;
const columnSource=$('column-data'),columnRaw=columnSource.dataset.src?await fetch(columnSource.dataset.src).then(response=>{if(!response.ok)throw Error('Geometria colonne non disponibile');return response.arrayBuffer();}).catch(error=>{console.warn('[Interiormente] Uso delle colonne compatibili.',error);return null;}):columnSource.textContent.trim();
const columnAssets=JSON.parse($('column-assets').textContent),columnImages=[...document.querySelectorAll('.column-texture')];
const fallbackColumns=columnAssets.map(model=>{const c=document.createElement('div');c.className='fallback-column';c.dataset.model=model.id;c.style.backgroundImage='url("'+model.fallback+'")';$('architecture-fallback').appendChild(c);return c;});
function recoverArchitecture(error){
 const host=$('architecture');host.classList.remove('architecture-live');host.dataset.renderer='fallback';stage.dataset.architectureError=String(error?.message||error);
 try{architecture?.dispose?.();}catch{}host.querySelectorAll('canvas').forEach(c=>c.remove());architecture=null;
 console.warn('[Interiormente] Colonne 3D non disponibili; continuo con la vista compatibile.',error);
}
const actors=Motion.arms.map(a=>({...a,mesh:null,curve:null,tip:{x:0,y:0}}));
const energy=$('energy'),fx=energy.getContext('2d');
const scrollRange=()=>Math.max(1,track.offsetHeight-stage.offsetHeight),startY=()=>track.getBoundingClientRect().top+window.scrollY;
function sync(){const r=track.getBoundingClientRect();stage.style.left=r.left+'px';stage.style.top='0px';header.style.left=r.left+'px';header.style.right='auto';header.style.width=w+'px';target=clamp((window.scrollY-startY())/scrollRange());}
// Offsets use viewport percentages; scale is uniform. Desktop clears all overrides.
function applyMobileDOM(){
 const targets=[['logo',header.querySelector('.brand'),'left top'],['saltaIntro',$('skip-intro'),'center'],['ricomincia',header.querySelector('[data-reset]'),'center'],['titolo',word.parentElement,'center'],['letteraO',letter,'center'],['motto',$('eyebrow'),'center'],['design',$('design'),'center'],['freccia',$('scroll-cue'),'center'],['barraAvanzamento',progressBar.parentElement,'center'],['bagliore',$('overhead-glow'),'center']];
 const entries={ingresso:'.copy',titoloIngresso:'h2',descrizioneIngresso:'.description',etichettaIngresso:'.kicker',rivediIntro:'.replay',notaIngresso:'.demo-note',arcoIngresso:'.entry-arch',scrittaSfondo:'.back-word'};
 for(const root of[entry,clone])for(const [id,selector]of Object.entries(entries))targets.push([id,root.querySelector(selector),'center']);
 for(const [id,node,origin]of targets){if(!node)continue;const v=MobileLayout.get(mobileSettings,id),parentScale=id==='letteraO'?MobileLayout.get(mobileSettings,'titolo').scala:['titoloIngresso','descrizioneIngresso','etichettaIngresso','rivediIntro','notaIngresso'].includes(id)?MobileLayout.get(mobileSettings,'ingresso').scala:1;
  node.style.transform=mobile?`translate3d(${v.xPercento*w/100/parentScale}px,${v.yPercento*h/100/parentScale}px,0) scale(${v.scala})`:'';
  node.style.transformOrigin=mobile?origin:'';
 }
}
function measure(){if(!ready)return;const old=word.style.transform;word.style.transform='none';const sr=stage.getBoundingClientRect(),wr=word.getBoundingClientRect(),r=letter.getBoundingClientRect(),parentScale=mobile?MobileLayout.get(mobileSettings,'titolo').scala:1;metrics={letter:{x:r.left-sr.left,y:r.top-sr.top,width:r.width,height:r.height},parentScale,originX:(r.left-wr.left+r.width/2)/parentScale,originY:(r.top-wr.top+r.height/2)/parentScale};word.style.transformOrigin=metrics.originX+'px '+metrics.originY+'px';word.style.transform=old;}
function size(){w=track.clientWidth;stage.style.width=w+'px';h=stage.clientHeight;mobile=w<700;word.style.fontSize=Math.min(mobile?48:94,Math.max(mobile?26:34,w*(mobile?.0735:.057)))+'px';stage.classList.toggle('mobile',mobile);header.classList.toggle('mobile',mobile);entry.classList.toggle('mobile',mobile);clone.classList.toggle('mobile',mobile);applyMobileDOM();dpr=Math.min(devicePixelRatio||1,mobile?1.6:2);canvas.width=energy.width=Math.round(w*dpr);canvas.height=energy.height=Math.round(h*dpr);if(gl)gl.viewport(0,0,canvas.width,canvas.height);try{architecture?.resize(w,h,mobile);}catch(error){recoverArchitecture(error);}sync();measure();wake();}
function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function renderer(){
 if(new URLSearchParams(location.search).get('renderer')!=='canvas')try{
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'});
  if(gl){const vs=compile(gl.VERTEX_SHADER,'attribute vec2 a_position;attribute vec2 a_uv;uniform vec2 u_resolution;varying vec2 v_uv;void main(){gl_Position=vec4((a_position/u_resolution*2.-1.)*vec2(1.,-1.),0.,1.);v_uv=a_uv;}'),fs=compile(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D u_image;varying vec2 v_uv;void main(){gl_FragColor=texture2D(u_image,v_uv);}');program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);loc={position:gl.getAttribLocation(program,'a_position'),uv:gl.getAttribLocation(program,'a_uv'),resolution:gl.getUniformLocation(program,'u_resolution')};texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}
 }catch(e){stage.dataset.gpuFallback=String(e.message);gl=null;}
 if(!gl){const c=canvas.cloneNode();canvas.replaceWith(c);canvas=c;ctx=canvas.getContext('2d');}
 stage.dataset.renderer=gl?'webgl':'canvas';
}
function buildMesh(a){
 const aspect=atlas.naturalHeight/2/atlas.naturalWidth,sn=128,sh=48,sample=document.createElement('canvas');sample.width=sn;sample.height=sh;const sc=sample.getContext('2d',{willReadFrequently:true});sc.drawImage(atlas,0,a.row*atlas.naturalHeight/2,atlas.naturalWidth,atlas.naturalHeight/2,0,0,sn,sh);const alpha=sc.getImageData(0,0,sn,sh).data,integral=new Uint32Array((sn+1)*(sh+1));
 for(let y=0;y<sh;y++){let sum=0;for(let x=0;x<sn;x++){sum+=alpha[(y*sn+x)*4+3]>2?1:0;integral[(y+1)*(sn+1)+x+1]=sum+integral[y*(sn+1)+x+1];}}
 const occupied=(x,y,z,t)=>{const x0=Math.max(0,Math.floor(x*sn)-1),x1=Math.min(sn,Math.ceil(z*sn)+1),y0=Math.max(0,Math.floor(y/aspect*sh)-1),y1=Math.min(sh,Math.ceil(t/aspect*sh)+1),at=(i,j)=>integral[j*(sn+1)+i];return at(x1,y1)-at(x0,y1)-at(x1,y0)+at(x0,y0)>0;};
 const uv=[],source=[],indices=[],keys=new Map(),poses=[Motion.curve(1.05,a.center),Motion.curve(-1.05,a.center)];
 function vertex(x,y){const k=x+','+y;if(keys.has(k))return keys.get(k);const i=uv.length;keys.set(k,i);uv.push({x,y});source.push({x:x*atlas.naturalWidth,y:a.row*atlas.naturalHeight/2+y*atlas.naturalWidth});return i;}
 function cell(x,y,z,t,depth){if(!occupied(x,y,z,t))return;const mx=(x+z)/2,my=(y+t)/2,pts=[{x,y},{x:z,y},{x,y:t},{x:z,y:t},{x:mx,y},{x:z,y:my},{x:mx,y:t},{x,y:my},{x:mx,y:my}];let error=0;if(depth<7)for(const c of poses){const q=pts.map(v=>Motion.bend(v,c));for(const [m,i,j]of[[4,0,1],[5,1,3],[6,2,3],[7,0,2],[8,1,2]])error=Math.max(error,Math.hypot(q[m].x-(q[i].x+q[j].x)/2,q[m].y-(q[i].y+q[j].y)/2));}if(depth<7&&error>.0006){cell(x,y,mx,my,depth+1);cell(mx,y,z,my,depth+1);cell(x,my,mx,t,depth+1);cell(mx,my,z,t,depth+1);}else{const i=vertex(x,y),j=vertex(z,y),k=vertex(x,t),l=vertex(z,t);indices.push(i,j,k,j,l,k);}}
 for(let y=0;y<4;y++)for(let x=0;x<8;x++)cell(x/8,y/4*aspect,(x+1)/8,(y+1)/4*aspect,3);
 const mesh={uv,source,indices,points:uv.map(()=>({x:0,y:0})),positions:new Float32Array(uv.length*2)};
 if(gl){mesh.positionBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,mesh.positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.positions.byteLength,gl.DYNAMIC_DRAW);mesh.uvBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,mesh.uvBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(source.flatMap(v=>[v.x/atlas.naturalWidth,v.y/atlas.naturalHeight])),gl.STATIC_DRAW);mesh.elementBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.elementBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);}
 a.mesh=mesh;stage.dataset[a.id+'Triangles']=String(indices.length/3);
}
function triangle(s0,s1,s2,p0,p1,p2){
 const x0=s0.x,y0=s0.y,x1=s1.x,y1=s1.y,x2=s2.x,y2=s2.y,det=x0*(y1-y2)+x1*(y2-y0)+x2*(y0-y1);if(Math.abs(det)<.0001)return;
 const a=(p0.x*(y1-y2)+p1.x*(y2-y0)+p2.x*(y0-y1))/det,b=(p0.y*(y1-y2)+p1.y*(y2-y0)+p2.y*(y0-y1))/det,c=(p0.x*(x2-x1)+p1.x*(x0-x2)+p2.x*(x1-x0))/det,d=(p0.y*(x2-x1)+p1.y*(x0-x2)+p2.y*(x1-x0))/det,e=(p0.x*(x1*y2-x2*y1)+p1.x*(x2*y0-x0*y2)+p2.x*(x0*y1-x1*y0))/det,f=(p0.y*(x1*y2-x2*y1)+p1.y*(x2*y0-x0*y2)+p2.y*(x0*y1-x1*y0))/det;
 const cx=(p0.x+p1.x+p2.x)/3,cy=(p0.y+p1.y+p2.y)/3,expand=p=>{const dx=p.x-cx,dy=p.y-cy,len=Math.hypot(dx,dy)||1;return{x:p.x+dx/len*.65,y:p.y+dy/len*.65}},q=[p0,p1,p2].map(expand);
 ctx.save();ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);ctx.lineTo(q[1].x,q[1].y);ctx.lineTo(q[2].x,q[2].y);ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,e,f);const sx=Math.max(0,Math.min(x0,x1,x2)-3),sy=Math.max(0,Math.min(y0,y1,y2)-3),sw=Math.min(atlas.naturalWidth-sx,Math.max(x0,x1,x2)-sx+3),sh=Math.min(atlas.naturalHeight-sy,Math.max(y0,y1,y2)-sy+3);ctx.drawImage(atlas,sx,sy,sw,sh,sx,sy,sw,sh);ctx.restore();
}
function renderActor(a,phase,time){
 const hand=settings.mani,startAngle=(a.side>0?-hand.sinistraInizioGradi:hand.destraInizioGradi)*Math.PI/180,endAngle=(a.side>0?-hand.sinistraFinaleGradi:hand.destraFinaleGradi)*Math.PI/180;
 const cx=metrics.letter.x+metrics.letter.width/2,cy=metrics.letter.y+metrics.letter.height/2-h*hand.altezzaPercento/100,slide=(1-phase.enter)*(w*.61+40),idle=reduced.matches?0:Math.sin((heldTime??time)*.0007+(a.row?1:0))*.003*(1-phase.gesture),anchor=Motion.bend(a.finger,Motion.curve(endAngle,a.center));
 const adjustment=mobile?MobileLayout.combine(mobileSettings,['mani',a.side>0?'manoSinistra':'manoDestra']):MobileLayout.identity();
 const width=adjustment.scala*Math.max((mobile?w*.75*hand.scalaMobile:w*.57*hand.scalaDesktop),((a.side>0?cx:w-cx)+25)/Math.max(.1,anchor.x));
 a.curve=Motion.curve(startAngle*(1-phase.gesture)+endAngle*phase.gesture+idle,a.center);
 const world=v=>({x:cx+adjustment.xPercento*w/100-a.side*hand.distanzaDitaPx/2+a.side*width*(v.x-anchor.x)-a.side*slide,y:cy+adjustment.yPercento*h/100+width*(v.y-anchor.y)}),m=a.mesh;
 a.tip=world(Motion.bend(a.finger,a.curve));a.direction=(()=>{const q=world(Motion.bend(a.indexBase,a.curve));return{x:a.tip.x-q.x,y:a.tip.y-q.y}})();
 m.uv.forEach((v,i)=>{const q=world(Motion.bend(v,a.curve));m.points[i]=q;m.positions[i*2]=q.x;m.positions[i*2+1]=q.y;});
 if(gl){gl.bindBuffer(gl.ARRAY_BUFFER,m.positionBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,m.positions);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.uvBuffer);gl.enableVertexAttribArray(loc.uv);gl.vertexAttribPointer(loc.uv,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.elementBuffer);gl.drawElements(gl.TRIANGLES,m.indices.length,gl.UNSIGNED_SHORT,0);}
 else for(let k=0;k<m.indices.length;k+=3){const i=m.indices[k],j=m.indices[k+1],l=m.indices[k+2];triangle(m.source[i],m.source[j],m.source[l],m.points[i],m.points[j],m.points[l]);}
}
function spark(time){burst=time;stage.dataset.strikes=String((Number(stage.dataset.strikes)||0)+1);live.textContent='Le dita si sfiorano: la scintilla apre la O di Interiormente.';}
function drawEnergy(time,phase,distance){
 fx.setTransform(dpr,0,0,dpr,0,0);fx.clearRect(0,0,w,h);const duration=settings.scintilla.durataMs/1000,gap=settings.mani.distanzaDitaPx,age=(time-burst)/1000,flash=age>=0&&age<duration?Math.pow(1-age/duration,1.7):0,near=(1-smooth(gap,gap+23,distance))*smooth(settings.tempi.gestoInizio/100,settings.tempi.scintilla/100,p),baseStrength=Math.max(flash,near*settings.scintilla.luceResidua),strength=baseStrength*settings.scintilla.intensita*(1-smooth(.02,.32,phase.portal));if(strength<.008)return;
 const a=actors[0].tip,b=actors[1].tip,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,adjustment=mobile?MobileLayout.get(mobileSettings,'scintilla'):MobileLayout.identity();
 fx.save();fx.translate(cx+adjustment.xPercento*w/100,cy+adjustment.yPercento*h/100);fx.scale(adjustment.scala,adjustment.scala);fx.translate(-cx,-cy);
 const r=14+(settings.scintilla.alonePx-14)*Math.min(baseStrength,1),g=fx.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,`rgba(255,250,223,${strength*.95})`);g.addColorStop(.12,`rgba(255,225,151,${strength*.48})`);g.addColorStop(.50,`rgba(239,171,67,${strength*.16})`);g.addColorStop(1,'rgba(220,148,45,0)');fx.globalCompositeOperation='lighter';fx.fillStyle=g;fx.fillRect(cx-r,cy-r,r*2,r*2);
 if(!reduced.matches&&distance<gap+24){const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,distance),nx=-dy/len,ny=dx/len,tick=Math.floor(time/65),amplitude=Math.min(3.2,distance*.15);fx.beginPath();fx.moveTo(a.x,a.y);for(let i=1;i<=10;i++){const t=i/10,j=Math.sin(i*13.37+tick*2.7)*Math.sin(t*Math.PI)*amplitude;fx.lineTo(a.x+dx*t+nx*j,a.y+dy*t+ny*j);}fx.lineWidth=.9;fx.strokeStyle=`rgba(255,249,223,${near*.85})`;fx.shadowBlur=8;fx.shadowColor='#f6cb82';fx.stroke();if(flash>.15)for(let i=0;i<settings.scintilla.scariche;i++){const angle=i*Math.PI*2/Math.max(1,settings.scintilla.scariche)+.36,len=(12+flash*19)*(i===1?.7:1);fx.beginPath();fx.moveTo(cx,cy);for(let j=1;j<=5;j++){const t=j/5,s=Math.sin(j*4.9+tick+i)*2*Math.sin(t*Math.PI);fx.lineTo(cx+Math.cos(angle)*len*t-Math.sin(angle)*s,cy+Math.sin(angle)*len*t+Math.cos(angle)*s);}fx.lineWidth=.7;fx.strokeStyle=`rgba(255,232,181,${flash*.73})`;fx.stroke();}}
 fx.shadowBlur=0;fx.beginPath();fx.arc(cx,cy,1.1+flash*1.8,0,Math.PI*2);fx.fillStyle=`rgba(255,255,242,${Math.min(1,strength*2.3)})`;fx.fill();fx.globalCompositeOperation='source-over';fx.restore();
}
function draw(time){
 if(!ready||!metrics||document.hidden){raf=0;return;}if(!visible&&p===target&&Number(stage.dataset.progress)===target){raf=0;return;}if(!gl&&time-lastTime<30){raf=requestAnimationFrame(draw);return;}const renderStart=performance.now(),dt=Math.min(100,time-lastTime||33);lastTime=time;p=!visible||reduced.matches||settings.scorrimento.morbidezzaMs===0?target:p+(target-p)*(1-Math.exp(-dt/settings.scorrimento.morbidezzaMs));if(Math.abs(p-target)<.0001)p=target;
 // Native scroll owns the handoff. Never slide a lagging intro over the next scene.
 if(target===1)p=1;
 const phase=Motion.phases(p,settings.tempi),zoom=reduced.matches?0:Math.pow(phase.portal,settings.portale.curvaZoom),complete=p>.999,curtainEnd=settings.tempi.ingressoInizio/100;
 try{architecture?.render(p,curtainEnd,IntroMotion,zoom,reduced.matches,mobileSettings,MobileLayout);}catch(error){recoverArchitecture(error);}
 $('architecture').style.opacity=String(1-smooth(.03,.55,zoom));
 fallbackColumns.forEach((c,i)=>{const pose=IntroMotion.column(reduced.matches?curtainEnd:p,i,mobile,curtainEnd,w/h);c.style.zIndex=String(6-pose.rank);const v=mobile?MobileLayout.column(mobileSettings,i):{xPercento:0,yPercento:0,groupScale:1,scala:1},x=pose.x*w/2*v.groupScale+v.xPercento*w/100,y=mobile?h*.35*(v.groupScale-1)+v.yPercento*h/100:0;c.style.transform=`translate3d(calc(-50% + ${x}px),${y}px,0) scale(${pose.scale*v.scala})`;});
 const reveal=reduced.matches?1:IntroMotion.reveal(p,curtainEnd);$('wordmark').parentElement.style.opacity=String(reveal);
 if(gl){gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2f(loc.resolution,w,h);}else{ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);}
 if(phase.enter>.001&&zoom<.35&&!reduced.matches)actors.forEach(a=>renderActor(a,phase,time));else{const cx=metrics.letter.x+metrics.letter.width/2,cy=metrics.letter.y+metrics.letter.height/2-h*settings.mani.altezzaPercento/100,gap=settings.mani.distanzaDitaPx;actors[0].tip={x:cx-gap/2,y:cy};actors[1].tip={x:cx+gap/2,y:cy};}
 const distance=Math.hypot(actors[1].tip.x-actors[0].tip.x,actors[1].tip.y-actors[0].tip.y),near=p>=settings.tempi.scintilla/100&&distance<settings.mani.distanzaDitaPx+9;
 if(near&&!latched){spark(time);latched=true;}if(p<(settings.tempi.gestoInizio+settings.tempi.gestoFine)/200){latched=false;burst=-1e6;}
 drawEnergy(time,{...phase,portal:zoom},distance);editor.drawGuides(zoom);
 const fade=1-smooth(.01,.20,zoom);canvas.style.opacity=String(fade);$('eyebrow').style.opacity=$('design').style.opacity=String(reveal*(1-smooth(settings.tempi.ingressoInizio/100,Math.max(settings.tempi.ingressoInizio/100+.02,settings.tempi.gestoInizio/100),p))*(1-zoom));$('word-left').style.opacity=$('word-right').style.opacity=String(phase.sides*(1-smooth(.02,.22,zoom)));
 const warm=(1-smooth(0,settings.scintilla.durataMs/1000,(time-burst)/1000))*smooth(settings.tempi.gestoInizio/100,settings.tempi.scintilla/100,p)*(1-smooth(.10,.4,zoom));letter.style.color=latched?'#d7b77f':'';letter.style.filter=warm>.01?`drop-shadow(0 0 ${6+warm*19}px rgba(250,210,136,${warm*.8}))`:'';
 if(zoom>0){const z=Motion.portal(zoom,metrics.letter,w,h,settings.portale.centraturaPercento/100);word.style.transform=`translate3d(${z.tx/metrics.parentScale}px,${z.ty/metrics.parentScale}px,0) scale(${z.scale})`;const matrix=`matrix(${z.width} 0 0 ${z.height} ${z.x} ${z.y})`;aperture.setAttribute('transform',matrix);outlinePath.setAttribute('transform',matrix);outline.style.visibility='visible';letter.style.visibility='hidden';portalVisual.style.visibility='visible';portalVisual.style.clipPath=complete?'none':'url(#o-aperture)';}
 else{word.style.transform='none';outline.style.visibility='hidden';letter.style.visibility='visible';portalVisual.style.visibility='hidden';portalVisual.style.clipPath='url(#o-aperture)';}
 const controlOpacity=1-smooth(settings.tempi.scintilla/100+.01,settings.tempi.zoomInizio/100+.05,p);controls.style.opacity=String(controlOpacity);controls.style.pointerEvents=controlOpacity<.1?'none':'auto';controls.inert=controlOpacity<.1;
 const headerOpacity=zoom<.65?1-smooth(.01,.22,zoom):smooth(.86,1,zoom);header.style.opacity=String(headerOpacity);header.style.pointerEvents=headerOpacity<.1?'none':'auto';header.inert=headerOpacity<.1;
 document.body.classList.toggle('inside',complete);stage.style.opacity=complete?'0':'1';stage.style.pointerEvents=complete?'none':'auto';stage.inert=complete;track.style.pointerEvents=complete?'none':'auto';
 progressBar.style.transform=`scaleX(${p})`;
 stage.dataset.progress=p.toFixed(3);stage.dataset.portal=zoom.toFixed(3);stage.dataset.fingerDistance=distance.toFixed(2);stage.dataset.phase=complete?'inside':zoom>0?'portal':near?'spark':phase.gesture>0?'gesture':phase.enter>0?'entry':p>0?'curtain':'start';stage.dataset.tips=JSON.stringify(actors.map(a=>[+a.tip.x.toFixed(1),+a.tip.y.toFixed(1)]));if(frame%10===0){stage.dataset.renderMs=(performance.now()-renderStart).toFixed(1);stage.dataset.directions=JSON.stringify(actors.map(a=>a.direction?{x:+a.direction.x.toFixed(2),y:+a.direction.y.toFixed(2)}:null));}
 const chapter=stage.dataset.phase,labels={start:'Il colonnato',curtain:'Il sipario',entry:'Il gesto',gesture:'Il gesto',spark:'La scintilla',portal:'Dentro la O',inside:'Benvenuto'};$('chapter-label').textContent=labels[chapter];$('chapter-label').style.opacity=String(1-smooth(.01,.25,zoom));
 if(!reduced.matches)$('help').textContent=p<curtainEnd?'Scorri per aprire il colonnato.':p<settings.tempi.scintilla/100?'Il gesto dà forma all’inaspettato.':'Una scintilla. Un altro spazio.';
 editor.syncFrame(p,chapter);
 frame++;if(Math.abs(p-target)<.0001&&!auto&&(time-burst)>settings.scintilla.durataMs){raf=0;return;}raf=requestAnimationFrame(draw);
}
function wake(){if(ready&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
function cancel(){if(auto){cancelAnimationFrame(auto);auto=0;}}
function go(value,duration=1000){cancel();heldTime=null;const from=window.scrollY,to=startY()+scrollRange()*clamp(value),then=performance.now();if(reduced.matches){window.scrollTo(0,to);sync();wake();return;}const step=now=>{const t=clamp((now-then)/duration);window.scrollTo(0,from+(to-from)*ease(t));if(t<1)auto=requestAnimationFrame(step);else auto=0;};auto=requestAnimationFrame(step);wake();}
function playSequence(){
 cancel();heldTime=null;if(reduced.matches){go(1);return;}window.scrollTo(0,startY());p=target=0;latched=false;burst=-1e6;
 const t=settings.tempi,intro=t.ingressoInizio>0?1600:0,total=intro+t.durataSecondi*1000,hold=t.pausaScintillaMs,moving=t.durataSecondi*1000-hold,then=performance.now(),times=[0,intro,intro+moving*.24,intro+moving*.57,intro+moving*.57+hold,total],meet=(t.scintilla+t.zoomInizio)/200,values=[0,t.ingressoInizio/100,t.ingressoFine/100,meet,meet,1];
 const step=now=>{const elapsed=now-then;let i=1;while(i<times.length-1&&elapsed>times[i])i++;const span=times[i]-times[i-1],t=span>0?clamp((elapsed-times[i-1])/span):1,value=values[i-1]+(values[i]-values[i-1])*ease(t);window.scrollTo(0,startY()+scrollRange()*value);if(elapsed<times.at(-1))auto=requestAnimationFrame(step);else auto=0;};auto=requestAnimationFrame(step);wake();
}
$('skip-intro').addEventListener('click',()=>{cancel();window.scrollTo(0,startY()+scrollRange());p=target=1;wake();});
document.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click',()=>{cancel();burst=-1e6;latched=p>=settings.tempi.scintilla/100;go(0);live.textContent='Il passaggio ricomincia.';}));
window.addEventListener('scroll',()=>{sync();wake();},{passive:true});window.addEventListener('wheel',e=>{if(!e.target.closest?.('#tuner'))cancel();},{passive:true});window.addEventListener('touchstart',e=>{if(!e.target.closest?.('#tuner'))cancel();},{passive:true});window.addEventListener('keydown',e=>{if(e.target.closest?.('#tuner'))return;if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))cancel();});
const editor=(()=>{
 const panel=$('tuner'),launcher=$('tune-launch'),fields=new Map();let view=reviewMode?'mobile':'auto',selected='colonnato',lastPhase='';
 const poseStart=()=>settings.tempi.gestoFine/100;
 const zoomFrame=()=>settings.tempi.zoomInizio/100+(1-settings.tempi.zoomInizio/100)*.47;
 function message(text,error=false){$('tune-message').textContent=text;$('tune-message').classList.toggle('error',error);}
 function snapshot(){return{...Preferences.copy(settings),layoutMobile:structuredClone(mobileSettings),riferimento:{vista:mobile?'mobile':'desktop',larghezza:w,altezza:h,fotogrammaPercento:Number((p*100).toFixed(1))}};}
 const json=()=>JSON.stringify(snapshot(),null,2);
 function updateJSON(force=false){if(force||document.activeElement!==$('tune-json'))$('tune-json').value=json();}
 function persist(){try{localStorage.setItem(MobileLayout.storageKey,JSON.stringify(mobileSettings));return true;}catch{return false;}}
 function seek(value){cancel();heldTime=performance.now();p=target=clamp(value);window.scrollTo(0,startY()+scrollRange()*p);sync();p=target;wake();updateJSON();}
 function flash(){seek(Math.min(settings.tempi.zoomInizio/100-.005,settings.tempi.scintilla/100+.006));latched=true;spark(performance.now());wake();}
 function previewSelected(){const spec=MobileLayout.specs.find(s=>s[0]===selected),kind=spec[3];if(kind==='spark')flash();else seek({start:0,title:settings.tempi.ingressoInizio/100-.005,hands:poseStart(),inside:1}[kind]??0);}
 function syncFields(){const v=MobileLayout.get(mobileSettings,selected);for(const [key,controls]of fields){const n=key==='scala'?Math.round(v[key]*100):v[key];controls.range.value=controls.number.value=String(n);}const notes={colonnato:'Sposta o ridimensiona tutte e sei le colonne insieme.',colonneSinistra:'Tre colonne a sinistra, senza modificare il gruppo destro.',colonneDestra:'Tre colonne a destra, senza modificare il gruppo sinistro.',mani:'Ridimensiona entrambe le braccia mantenendo il punto d’incontro. X e Y spostano il gesto.',scintilla:'Il lampo segue le dita. Questi valori aggiungono uno spostamento e una scala.',letteraO:'Modifica solo la O. La transizione riparte dal suo nuovo centro.',titolo:'La scritta si muove insieme alla O: anche le mani seguono il nuovo centro.',ricomincia:'Ricomincia è nascosto nell’intro mobile; la sua regolazione resta disponibile nel JSON.',ingresso:'Muove insieme i testi dopo la O. I controlli dei singoli testi si sommano a questo gruppo.'};$('tune-element-note').textContent=notes[selected]||'Regolazione indipendente, applicata solo su mobile.';updateJSON();}
 function setView(value){const previous=p;view=value;$('tune-view').value=value;document.body.classList.toggle('preview-mobile',value==='mobile');size();seek(previous);updateJSON();}
 function commit(next,{preview=false,text='Modifica mobile salvata.'}={}){mobileSettings=MobileLayout.normalize(next);persist();if(view!=='mobile')setView('mobile');const previous=p;size();seek(previous);syncFields();if(preview)previewSelected();else if(selected==='scintilla')flash();message(text);}
 function apply(raw){try{if(!raw||typeof raw!=='object'||(!raw.layoutMobile&&!raw.elementi))throw Error('Il JSON deve contenere layoutMobile o elementi.');const next=MobileLayout.normalize(raw.layoutMobile??raw);commit(next,{preview:true,text:'Layout mobile importato. Parametri dell’animazione invariati.'});updateJSON(true);return true;}catch(e){message(e.message||'Layout mobile non valido.',true);return false;}}
 function setOpen(open){const previous=p;document.body.classList.toggle('tuning-open',open);panel.inert=!open;panel.setAttribute('aria-hidden',String(!open));launcher.setAttribute('aria-expanded',String(open));size();seek(previous);}
 function createFields(){for(const [key,label,min,max,step,unit]of[['scala','Dimensione',10,300,1,'%'],['xPercento','Posizione orizzontale · X',-100,100,.25,'%'],['yPercento','Posizione verticale · Y',-100,100,.25,'%']]){const id='mobile-'+key,wrap=document.createElement('div');wrap.className='tune-field';const head=document.createElement('div');head.className='tune-field-head';const text=document.createElement('label');text.htmlFor=id;text.textContent=label;const value=document.createElement('span');value.className='tune-value';const number=document.createElement('input');Object.assign(number,{type:'number',min,max,step});number.setAttribute('aria-label','Valore: '+label);const suffix=document.createElement('span');suffix.textContent=unit;value.append(number,suffix);head.append(text,value);const range=document.createElement('input');Object.assign(range,{type:'range',id,min,max,step});range.dataset.mobileKey=key;wrap.append(head,range);$('tune-mobile-fields').append(wrap);fields.set(key,{range,number});const change=source=>{if(!source.value.trim()||!Number.isFinite(Number(source.value))){syncFields();message('Inserisci un numero valido.',true);return;}const next=structuredClone(mobileSettings);next.elementi[selected][key]=Number(source.value)/(key==='scala'?100:1);commit(next);};range.addEventListener('input',()=>change(range));number.addEventListener('change',()=>change(number));number.addEventListener('keydown',e=>{if(e.key==='Enter')number.blur();});}}
 function syncFrame(value,phase){$('tune-viewport').textContent=(mobile?'Mobile':'Desktop · sola anteprima')+' · '+Math.round(w)+' × '+Math.round(h)+' px';$('tune-frame').value=String(value*100);$('tune-frame-value').textContent=(value*100).toFixed(1).replace('.0','')+'%';const labels={start:'Colonnato chiuso',curtain:'Apertura del colonnato',entry:'Ingresso dai lati',gesture:'Avvicinamento delle dita',spark:'Scintilla',portal:'Dentro la O',inside:'Sezione successiva'};$('tune-phase').textContent=labels[phase]||'Pronto';$('tune-play').textContent=auto?'Pausa':'Riproduci';if(lastPhase!==phase&&!auto)updateJSON();lastPhase=phase;}
 function init(){const groups=new Map();for(const [id,label,group]of MobileLayout.specs){if(!groups.has(group)){const el=document.createElement('optgroup');el.label=group;groups.set(group,el);$('tune-element').append(el);}const option=document.createElement('option');option.value=id;option.textContent=label;groups.get(group).append(option);}createFields();syncFields();document.documentElement.style.setProperty('--track-screens',settings.scorrimento.schermate);launcher.hidden=panel.hidden=!reviewMode;setView(reviewMode?'mobile':'auto');setOpen(reviewMode&&window.innerWidth>760);
 launcher.addEventListener('click',()=>setOpen(true));$('tune-close').addEventListener('click',()=>setOpen(false));$('tune-element').addEventListener('change',e=>{selected=e.target.value;if(view!=='mobile')setView('mobile');syncFields();previewSelected();message('Regola l’elemento selezionato o scegli un altro fotogramma.');});$('tune-view').addEventListener('change',e=>setView(e.target.value));$('tune-frame').addEventListener('input',e=>seek(Number(e.target.value)/100));$('tune-play').addEventListener('click',()=>auto?seek(p):playSequence());$('tune-restart').addEventListener('click',()=>seek(0));$('tune-curtain').addEventListener('click',()=>seek(0));$('tune-pose').addEventListener('click',()=>seek(poseStart()));$('tune-flash').addEventListener('click',flash);$('tune-zoom').addEventListener('click',()=>seek(zoomFrame()));
 $('tune-reset-element').addEventListener('click',()=>{const next=structuredClone(mobileSettings);next.elementi[selected]=MobileLayout.defaults().elementi[selected];commit(next,{preview:true,text:'Elemento ripristinato.'});});$('tune-defaults').addEventListener('click',()=>commit(MobileLayout.defaults(),{preview:true,text:'Layout mobile ripristinato. Parametri dell’animazione invariati.'}));
 $('tune-copy').addEventListener('click',async()=>{const text=json();$('tune-json').value=text;try{if(!navigator.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(text);message('Parametri copiati. Incollali nella chat.');}catch{$('tune-json-details').open=true;$('tune-json').focus();$('tune-json').select();let copied=false;try{copied=document.execCommand('copy');}catch{}message(copied?'Parametri copiati. Incollali nella chat.':'Testo selezionato: premi Ctrl+C e incollalo nella chat.');}});
 $('tune-download').addEventListener('click',()=>{const blob=new Blob([json()+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='interiormente-parametri-mobile.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('JSON mobile scaricato.');});$('tune-apply-json').addEventListener('click',()=>{try{apply(JSON.parse($('tune-json').value));}catch{message('JSON non valido. Controlla parentesi, virgole e numeri.',true);}});$('tune-json-details').addEventListener('toggle',()=>{if($('tune-json-details').open)updateJSON();});
 }
 return{init,syncFrame,drawGuides(){},seek,poseStart,apply,message};
})();
editor.init();

window.addEventListener('interiormente:seek',event=>{const value=event.detail;if(typeof value==='number'&&Number.isFinite(value))editor.seek(value);});
new ResizeObserver(size).observe(track);new IntersectionObserver(([r])=>{visible=r.isIntersecting;wake();}).observe(stage);document.addEventListener('visibilitychange',wake);
function motionPreference(){document.body.classList.toggle('reduced',reduced.matches);$('help').textContent=reduced.matches?'Prosegui alla sezione successiva.':'Scorri: il gesto accende la scintilla e apre la O.';size();}
reduced.addEventListener('change',motionPreference);
Promise.all([atlas.decode(),document.fonts.ready,...columnImages.map(image=>image.decode())]).then(()=>{renderer();try{architecture=InteriormenteArchitecture.create($('architecture'),columnRaw,JSON.parse($('column-layout').textContent),wake,columnImages);}catch(error){recoverArchitecture(error);}actors.forEach(buildMesh);ready=true;stage.dataset.ready='true';motionPreference();size();editor.seek(!reviewMode&&document.querySelector('[data-interiormente-intro]')?.dataset.startAt==='giorno'?1:0);$('skip-intro').disabled=false;wake();}).catch(e=>{stage.dataset.ready='error';live.textContent='Impossibile caricare gli elementi della scena.';console.error(e);});size();
})();
