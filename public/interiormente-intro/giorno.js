(()=>{
 'use strict';
 /* Short, reversible word → spatial overturn → corridor sequence. */
const GiornoMotion=(()=>{
 const clamp=x=>Math.max(0,Math.min(1,x));
 const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
 const corridor=Object.freeze({halfWidth:3.5,length:42,step:7,segments:6});
 const timing=Object.freeze({screens:3,smoothingMs:55,foldStart:.15,foldEnd:.47,tunnelStart:.43,tunnelEnd:.87});
 function word(p,index){const fold=smooth(.13,.39,p);return{opacity:(1-.11*index)*(1-smooth(.24,.39,p)),x:(index===1?32:-18)*fold,y:(1-index)*28*fold,z:-index*120*fold,scale:1-.37*fold,rotateX:-62*fold,rotateY:(index-1)*12*fold,rotateZ:-12*fold};}
 function state(raw){
  raw=clamp(raw);const pause=window.InteriormenteTunnelMenu?.settings.pauseAt??.5;
  const p=raw<=pause?raw*.47/pause:.47+(raw-pause)*.53/(1-pause),fold=smooth(.15,.47,p),passage=window.InteriormenteTunnelMenu.passageMotion(window.InteriormenteTunnelMenu.routeProgress(raw,pause)),travel=passage.travel;
  return{p,raw,fold,travel,field:smooth(.08,.17,p)*(1-smooth(pause+.015,pause+.085,raw)),tunnel:smooth(pause+.015,pause+.085,raw),arrival:passage.arrival,roll:0,phase:p<.15?'parole':raw<pause-.002?'capovolgimento':raw<=pause+.003?'menu':raw<pause+(1-pause)*.36?'ingresso-centrale':raw<.96?'tunnel':'giorno'};
 }
 // A desktop corridor has a square cross-section, regardless of the monitor ratio.
 function camera(travel,w,h){const focal=h*.9,halfW=corridor.halfWidth,halfH=w<700?halfW*h/w:halfW,fillDistance=2*halfW*focal/(w<700?w:Math.max(w,h));return{focal,halfW,halfH,fillDistance,z:corridor.length*clamp(travel),endZ:fillDistance+corridor.length,cx:w*.5,cy:h*.5,roll:0};}
 function fieldLayout(w){const halfW=1.65,halfH=w<700?2.05:1.65;return{columns:5,layers:3,halfW,halfH,depth:3.3,stepX:3.65,stepY:halfH*2+.35,stepZ:3.65,centerZ:13.3};}
 function fieldBoxes(w){const l=fieldLayout(w),boxes=[];
  for(let iz=0;iz<l.layers;iz++)for(let iy=-1;iy<=1;iy++)for(let ix=-2;ix<=2;ix++){
   const x=ix*l.stepX,y=iy*l.stepY,z=8+iz*l.stepZ,s=l.halfW,t=l.halfH,d=l.depth;
   const vertices=[[x-s,y+t,z],[x+s,y+t,z],[x+s,y-t,z],[x-s,y-t,z],[x-s,y+t,z+d],[x+s,y+t,z+d],[x+s,y-t,z+d],[x-s,y-t,z+d]];
   const menuIndex=iy===-1&&Math.abs(ix)<=1?iz*3+ix+1:-1;
   boxes.push({x,y,z,s,t,ix,iy,iz,index:boxes.length,front:menuIndex>=0,menuIndex,menuVertices:[vertices[3],vertices[2],vertices[6],vertices[7]],hero:ix===0&&iy===0&&iz===0,center:ix===0&&iy===0,vertices});
  }return boxes;
 }
 function fieldCamera(fold,w,h){const l=fieldLayout(w),center=l.centerZ,focal=h*1.7;
  const oldDistance=18+5*smooth(0,.65,fold)-2*smooth(.65,1,fold),spanX=w<700?10.6:17.9,spanY=10.6,frontZ=center-l.stepY-l.halfH;
  const finalDistance=Math.max(spanX*focal/(w*(w<700?.93:.96)),spanY*focal/(h*.72))+center-frontZ,settle=smooth(.58,1,fold),distance=oldDistance+(finalDistance-oldDistance)*settle;
  return{focal,z:center-distance,cx:w*.5,cy:h*.5,roll:.23*Math.sin(Math.PI*fold)};
 }
 function transformField(point,fold,centerZ=13.3){let[x,y,z]=point;z-=centerZ;const pitch=Math.PI*.5*smooth(.06,.95,fold),yaw=.3*Math.sin(Math.PI*fold),cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw),yy=y*cp-z*sp,zz=y*sp+z*cp;return[x*cy+zz*sy,yy,-x*sy+zz*cy+centerZ];}
 // Keep the projected grid bounds centered even while perspective changes its silhouette.
 function centeredFieldCamera(fold,w,h,boxes){const camera=fieldCamera(fold,w,h),centerZ=fieldLayout(w).centerZ,points=boxes.flatMap(b=>b.vertices).map(v=>project(...transformField(v,fold,centerZ),camera)).filter(Boolean);if(points.length){const xs=points.map(p=>p.x),ys=points.map(p=>p.y);camera.cx+=w/2-(Math.min(...xs)+Math.max(...xs))/2;camera.cy+=h/2-(Math.min(...ys)+Math.max(...ys))/2;}return camera;}
 const vocabulary=Object.freeze(['Luce','Materia','Volumi','Armonia','Texture','Proporzioni','Equilibrio','Colore','Spazio','Ritmo','Dettagli','Atmosfera','Forme','Comfort','Identità','Superfici']);
 const triad=Object.freeze(['Percezione','Stile','Esperienza']);
 function heroQuad(state,w,h,hero,camera){const centerZ=fieldLayout(w).centerZ,target=hero.vertices.slice(0,4).map(v=>project(...transformField(v,state.fold,centerZ),camera)),size=Math.max(w,h),from=[{x:(w-size)/2,y:(h-size)/2},{x:(w+size)/2,y:(h-size)/2},{x:(w+size)/2,y:(h+size)/2},{x:(w-size)/2,y:(h+size)/2}],t=smooth(.06,.25,state.p);return target.map((p,i)=>({x:from[i].x+(p.x-from[i].x)*t,y:from[i].y+(p.y-from[i].y)*t}));}
 function quadPoint(q,s,t){const [p0,p1,p2,p3]=q,dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x,dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y,den=dx1*dy2-dx2*dy1,g=Math.abs(den)>1e-9?(dx3*dy2-dx2*dy3)/den:0,k=Math.abs(den)>1e-9?(dx1*dy3-dx3*dy1)/den:0,d=g*s+k*t+1;return{x:((p1.x-p0.x+g*p1.x)*s+(p3.x-p0.x+k*p3.x)*t+p0.x)/d,y:((p1.y-p0.y+g*p1.y)*s+(p3.y-p0.y+k*p3.y)*t+p0.y)/d};}
 function project(x,y,z,c){const distance=z-c.z;if(distance<=.16)return null;const cr=Math.cos(c.roll||0),sr=Math.sin(c.roll||0);return{x:c.cx+(x*cr-y*sr)*c.focal/distance,y:c.cy-(x*sr+y*cr)*c.focal/distance};}
 return{clamp,smooth,timing,corridor,word,state,camera,fieldLayout,fieldBoxes,fieldCamera,centeredFieldCamera,transformField,project,vocabulary,triad,heroQuad,quadPoint};
})();

 /* Wall-mounted artworks: a small lateral sway around a fixed wall attachment. */
const GiornoGallery=(()=>{
 const limit=(x,a,b)=>Math.max(a,Math.min(b,x)),maxAngle=.067;
 function layout(camera,aspects){return aspects.map((aspect,index)=>{
  const side=index%2===0?-1:1;let width=1.6+(index%3)*.12,height=width/aspect;if(height>1.85){width*=1.85/height;height=1.85;}
  return{index,side,width,height,x:side*(camera.halfW-.025),y:[.28,-.38,.55,-.15][index%4],z:6+index*32/Math.max(1,aspects.length-1)};
 });}
 function frame(item,angle){
  const {x,y,z,width,height,side}=item,co=Math.cos(angle),si=Math.sin(angle),anchorY=y+height*.38,axis=-side;
  // The normal coordinate x never changes: all motion is inside the wall's Y/Z plane.
  const point=(s,t)=>{const u=(s-.5)*width,v=(.5-t)*height-height*.38;return[x,anchorY+u*si+v*co,z+axis*(u*co-v*si)];};
  return{corners:[point(0,0),point(1,0),point(1,1),point(0,1)],anchor:[x,anchorY,z]};
 }
 function createDynamics(count=8){
  const nodes=Array.from({length:count},()=>({angle:0,omega:0}));let previous=null,velocity=0;
  function reset(travel=0){previous=travel;velocity=0;nodes.forEach(n=>{n.angle=n.omega=0;});}
  function step(travel,dtMs){
   if(previous===null){reset(travel);return false;}const dt=limit(dtMs/1000,.001,.05),raw=limit((travel-previous)/dt,-2.4,2.4);previous=travel;
   const next=velocity+(raw-velocity)*(1-Math.exp(-dt/.07)),acceleration=limit((next-velocity)/dt,-28,28);velocity=next;
   // Small fixed substeps keep touch flings, reverse scroll and slow devices stable.
   const steps=Math.ceil(dt*120),delta=dt/steps;
   nodes.forEach((n,i)=>{const frequency=4.5+(i%3)*.38,damping=2.35+(i%2)*.18,drive=(i%2?-1:1)*(-acceleration*.018+velocity*.022);
    for(let j=0;j<steps;j++){n.omega+=(drive-frequency*frequency*n.angle-damping*n.omega)*delta;n.angle+=n.omega*delta;if(Math.abs(n.angle)>maxAngle){n.angle=limit(n.angle,-maxAngle,maxAngle);n.omega*=.25;}}
    if(Math.abs(n.angle)<.000025&&Math.abs(n.omega)<.00009&&Math.abs(velocity)<.0003)n.angle=n.omega=0;
   });return active();
  }
  function active(){return Math.abs(velocity)>.0003||nodes.some(n=>Math.abs(n.angle)>.000025||Math.abs(n.omega)>.00009);}
  return{nodes,step,reset,active};
 }
 // Scene position is tied to the document, independent of overflow/sticky quirks.
 function pin(scroll,start,range){const offset=scroll-start;return{mode:offset<0?'before':offset>range?'after':'fixed',top:offset<0?0:offset>range?range:0,progress:limit(offset/range,0,1)};}
 return{layout,frame,createDynamics,maxAngle,pin};
})();

 const section=document.querySelector('#progetti.im-giorno');if(!section)return;
 const stage=section.querySelector('[data-giorno-stage]'),canvas=section.querySelector('[data-giorno-canvas]'),ctx=canvas.getContext('2d',{alpha:false}),image=section.querySelector('[data-giorno-image]'),mobileImage=section.querySelector('[data-giorno-image-mobile]'),statements=[...section.querySelectorAll('[data-giorno-statement]')],words=[...section.querySelectorAll('[data-giorno-word]')],bottom=section.querySelector('.giorno-bottom'),depthLabel=section.querySelector('.giorno-depth-label'),root=document.querySelector('[data-interiormente-intro]'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const M=GiornoMotion,G=GiornoGallery,artImages=[...section.querySelectorAll('[data-giorno-art]')],dynamics=G.createDynamics(artImages.length);let w=1,h=1,dpr=1,p=0,target=0,raf=0,lastTime=0,inView=true,imageReady=false;let menu=null;
 function bounds(){return{start:section.getBoundingClientRect().top+scrollY,range:Math.max(1,section.offsetHeight-h)};}
 function sync(){const b=bounds(),scroll=menu&&!reduced.matches?menu.enforceScroll(scrollY,b):scrollY,pin=G.pin(scroll,b.start,b.range),fixed=!reduced.matches&&pin.mode==='fixed',rect=section.getBoundingClientRect();target=pin.progress;stage.style.position=reduced.matches?'relative':fixed?'fixed':'absolute';stage.style.top=reduced.matches?'':pin.top+'px';stage.style.left=fixed?rect.left+'px':'0px';stage.style.width=w+'px';section.dataset.giornoPin=pin.mode;wake();}
 function resize(){w=section.clientWidth;h=parseFloat(getComputedStyle(stage).getPropertyValue('--stage-height'))||stage.clientHeight;h=stage.clientHeight||h;dpr=Math.min(devicePixelRatio||1,w<700?1.6:1.8);section.classList.toggle('mobile',w<700);section.classList.toggle('is-canvas-triad',!reduced.matches);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);stage.style.setProperty('--giorno-image',`url("${w<700?mobileImage.src:image.src}")`);sync();const rect=stage.getBoundingClientRect();space.setTriadLayout(statements.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{text:el.textContent.trim(),x:r.left-rect.left,y:r.top-rect.top,height:r.height,font:s.font,spacing:s.letterSpacing,color:s.color};}));}
 /* Projected 3D wire volumes and lettering. Works without a WebGL context. */
function createGiornoSpace(ctx,M,getPhoto,onReady,artImages=[],G=null,dynamics=null,options={}){
 const textures=new Map(),artTextures=new Map(),labels=M.vocabulary;let visibleArt=0,renderDpr=1,artLayer=null,triadLayout=null,triadTexture=null;
 document.fonts.ready.then(()=>{textures.clear();onReady?.();});
 function texture(label){if(textures.has(label))return textures.get(label);const c=document.createElement('canvas');c.width=640;c.height=128;const t=c.getContext('2d');t.font='400 65px Aboreto,serif';t.textAlign='center';t.textBaseline='middle';t.fillStyle='#e9e7e2';t.fillText(label,320,67,616);textures.set(label,c);return c;}
 function triangle(photo,source,destination,alpha){const [s0,s1,s2]=source,[p0,p1,p2]=destination,x0=s0.x,y0=s0.y,x1=s1.x,y1=s1.y,x2=s2.x,y2=s2.y,det=x0*(y1-y2)+x1*(y2-y0)+x2*(y0-y1);if(Math.abs(det)<1e-8)return;const a=(p0.x*(y1-y2)+p1.x*(y2-y0)+p2.x*(y0-y1))/det,b=(p0.y*(y1-y2)+p1.y*(y2-y0)+p2.y*(y0-y1))/det,c=(p0.x*(x2-x1)+p1.x*(x0-x2)+p2.x*(x1-x0))/det,d=(p0.y*(x2-x1)+p1.y*(x0-x2)+p2.y*(x1-x0))/det,e=(p0.x*(x1*y2-x2*y1)+p1.x*(x2*y0-x0*y2)+p2.x*(x0*y1-x1*y0))/det,f=(p0.y*(x1*y2-x2*y1)+p1.y*(x2*y0-x0*y2)+p2.y*(x0*y1-x1*y0))/det;const points=[p0,p1,p2],orientation=Math.sign((p1.x-p0.x)*(p2.y-p0.y)-(p1.y-p0.y)*(p2.x-p0.x))||1,q=points.map((p,i)=>{const previous=points[(i+2)%3],next=points[(i+1)%3],ax=p.x-previous.x,ay=p.y-previous.y,bx=next.x-p.x,by=next.y-p.y,al=Math.hypot(ax,ay)||1,bl=Math.hypot(bx,by)||1,n1={x:orientation*ay/al,y:-orientation*ax/al},n2={x:orientation*by/bl,y:-orientation*bx/bl},amount=.8/Math.max(.000001,1+n1.x*n2.x+n1.y*n2.y);return{x:p.x+(n1.x+n2.x)*amount,y:p.y+(n1.y+n2.y)*amount};});ctx.save();ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);ctx.lineTo(q[1].x,q[1].y);ctx.lineTo(q[2].x,q[2].y);ctx.closePath();ctx.clip();ctx.globalAlpha=alpha;ctx.transform(a,b,c,d,e,f);ctx.drawImage(photo,0,0);ctx.restore();}
 function paintPlane(photo,origin,u,v,camera,alpha,w,h,warp=point=>point,cover=false,detail=3,minExtent=22){
  if(!photo?.width||!photo.height||alpha<.005)return;
  const point=(s,t)=>M.project(...warp(origin.map((x,i)=>x+u[i]*s+v[i]*t)),camera),corners=[point(0,0),point(1,0),point(1,1),point(0,1)];if(corners.some(v=>!v))return;
  if(corners.every(p=>p.x<-w)||corners.every(p=>p.x>w*2)||corners.every(p=>p.y<-h)||corners.every(p=>p.y>h*2))return;
  const extent=Math.hypot(corners[1].x-corners[0].x,corners[1].y-corners[0].y);if(extent<minExtent)return;
  let sx=0,sy=0,sw=photo.naturalWidth||photo.width,sh=photo.naturalHeight||photo.height;if(cover){const target=w/h,aspect=sw/sh;if(aspect>target){const crop=sh*target;sx=(sw-crop)/2;sw=crop;}else{const crop=sw/target;sy=(sh-crop)/2;sh=crop;}}
  ctx.save();ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
  const divisions=cover?6:detail;for(let i=0;i<divisions;i++){const s=i/divisions,t=(i+1)/divisions,q=[point(s,0),point(t,0),point(t,1),point(s,1)];if(q.some(v=>!v))continue;const uv=[{x:sx+sw*s,y:sy},{x:sx+sw*t,y:sy},{x:sx+sw*t,y:sy+sh},{x:sx+sw*s,y:sy+sh}];triangle(photo,[uv[0],uv[1],uv[2]],[q[0],q[1],q[2]],alpha);triangle(photo,[uv[0],uv[2],uv[3]],[q[0],q[2],q[3]],alpha);}
  ctx.restore();
 }
 function wire(vertices,edges,camera,alpha,warp=point=>point){const q=vertices.map(v=>M.project(...warp(v),camera));ctx.beginPath();for(const[a,b]of edges){if(!q[a]||!q[b])continue;ctx.moveTo(q[a].x,q[a].y);ctx.lineTo(q[b].x,q[b].y);}ctx.strokeStyle=`rgba(208,206,192,${alpha})`;ctx.lineWidth=.65;ctx.stroke();}
 const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
 function drawField(state,w,h){const boxes=M.fieldBoxes(w),layout=M.fieldLayout(w),camera=options.getFieldCamera?.(state,w,h,boxes)||M.centeredFieldCamera(state.fold,w,h,boxes),warp=point=>M.transformField(point,state.fold,layout.centerZ);boxes.forEach(b=>b.depth=warp([b.x,b.y,b.z+layout.depth/2])[2]);boxes.sort((a,b)=>b.depth-a.depth);
  for(const b of boxes){if(b.hero)continue;const{x,y,z,s,t,index,vertices}=b,fog=Math.max(.16,1-(b.depth-camera.z)/55),alpha=state.field*fog;wire(vertices,edges,camera,alpha*.19,warp);if(b.center||options.hideFieldWord?.(b,state))continue;paintPlane(texture(labels[index%labels.length]),[x-s*.92,y+.42,z],[s*1.84,0,0],[0,-.72,0],camera,alpha*(index%7===0?.78:.4),w,h,warp);if(index%2===0&&state.fold>.13)paintPlane(texture(labels[(index+5)%labels.length]),[x+s,y+.42,z+.2],[0,0,2.8],[0,-.72,0],camera,alpha*.32,w,h,warp);if(index%3===0&&state.fold>.22)paintPlane(texture(labels[(index+9)%labels.length]),[x-s*.92,y+t,z+.25],[s*1.84,0,0],[0,0,.7],camera,alpha*.17,w,h,warp);if(state.fold>.55)paintPlane(texture(labels[(index+3)%labels.length]),[x-s*.9,y-t,z+1.25],[s*1.8,0,0],[0,0,.66],camera,alpha*.58*M.smooth(.55,.95,state.fold),w,h,warp);}
  const hero=boxes.find(b=>b.hero),q=M.heroQuad(state,w,h,hero,camera),back=hero.vertices.slice(4).map(v=>M.project(...warp(v),camera));
  const fade=options.fieldFade||[.43,.52],area=q.reduce((sum,p,i)=>sum+p.x*q[(i+1)%4].y-q[(i+1)%4].x*p.y,0);
  ctx.save();ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#101010';ctx.globalAlpha=1-M.smooth(fade[0],fade[1],state.p);if(Math.abs(area)>2){ctx.fill();ctx.save();ctx.globalAlpha*=options.triadOpacity?.(state)??1;paintTriad(q,w,h);ctx.restore();}
  ctx.beginPath();for(let i=0;i<4;i++){ctx.moveTo(q[i].x,q[i].y);ctx.lineTo(q[(i+1)%4].x,q[(i+1)%4].y);if(back[i]){ctx.moveTo(q[i].x,q[i].y);ctx.lineTo(back[i].x,back[i].y);}}ctx.strokeStyle=`rgba(208,206,192,${state.field*.2})`;ctx.lineWidth=.7;ctx.stroke();ctx.restore();options.paintMenuFaces?.(state,w,h,camera,paintPlane);
 }
 function paintTriad(q,w,h){
  if(!triadTexture&&options.getSource)triadTexture=options.getSource(w,h);
  if(!triadTexture){const size=Math.max(w,h),c=document.createElement('canvas'),ratio=Math.min(1.5,2048/size);c.width=c.height=Math.round(size*ratio);const t=c.getContext('2d');t.scale(ratio,ratio);t.textAlign='left';t.textBaseline='alphabetic';
   const fallback=M.triad.map((text,i)=>({text,x:w*(i===1?.48:.17),y:h*(.38+i*.13),height:h*.12,font:`400 ${w<700?w*.087:w*.077}px Aboreto,serif`,spacing:'0px',color:'#e9e7e2'}));
   for(const line of triadLayout||fallback){t.font=line.font;t.letterSpacing=line.spacing||'0px';t.fillStyle=line.color;const metrics=t.measureText(line.text)||{},fontSize=Number(/([\d.]+)px/.exec(line.font)?.[1])||64,ascent=metrics.fontBoundingBoxAscent||fontSize*.8,descent=metrics.fontBoundingBoxDescent||fontSize*.2,baseline=line.y+(line.height-ascent-descent)/2+ascent;t.fillText(line.text,line.x+(size-w)/2,baseline+(size-h)/2);}triadTexture=c;
  }
  const n=14,size=triadTexture.width;ctx.save();ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();const alpha=ctx.globalAlpha;
  for(let i=0;i<n;i++){const a=i/n,b=(i+1)/n,corners=[M.quadPoint(q,a,0),M.quadPoint(q,b,0),M.quadPoint(q,b,1),M.quadPoint(q,a,1)],uv=[{x:a*size,y:0},{x:b*size,y:0},{x:b*size,y:size},{x:a*size,y:size}];triangle(triadTexture,[uv[0],uv[1],uv[2]],[corners[0],corners[1],corners[2]],alpha);triangle(triadTexture,[uv[0],uv[2],uv[3]],[corners[0],corners[2],corners[3]],alpha);}ctx.restore();
 }
 function coverPhoto(photo,x,y,width,height,alpha=1){if(!photo||photo.complete===false||!(photo.naturalWidth||photo.width))return;const pw=photo.naturalWidth||photo.width,ph=photo.naturalHeight||photo.height,a=pw/ph,b=width/height;let sw=pw,sh=ph,sx=0,sy=0;if(a>b){sw=sh*b;sx=(pw-sw)/2;}else{sh=sw/b;sy=(ph-sh)/2;}ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(photo,sx,sy,sw,sh,x,y,width,height);ctx.restore();}
 function artTexture(index){
  if(artTextures.has(index))return artTextures.get(index);const img=artImages[index];if(!img?.complete||!img.naturalWidth)return null;
  const crop=img.dataset?.artCrop?img.dataset.artCrop.split(',').map(Number):[0,0,img.naturalWidth,img.naturalHeight];if(crop.length!==4||crop.some(v=>!Number.isFinite(v))||crop[2]<=0||crop[3]<=0)return null;
  const [sx,sy,sw,sh]=crop,c=document.createElement('canvas'),border=12;c.width=sw+border*2;c.height=sh+border*2;const t=c.getContext('2d');
  t.fillStyle='#151513';t.fillRect(0,0,c.width,c.height);t.strokeStyle='#a38c62';t.lineWidth=2;t.strokeRect(1,1,c.width-2,c.height-2);t.strokeStyle='#40382b';t.lineWidth=4;t.strokeRect(6,6,c.width-12,c.height-12);t.drawImage(img,sx,sy,sw,sh,border,border,sw,sh);artTextures.set(index,c);return c;
 }
 function drawGallery(state,c,w,h){
  if(!G||!dynamics||!artImages.length)return;const alpha=state.tunnel*(1-M.smooth(.84,.9,state.p));if(alpha<.005)return;
  const pictures=artImages.map((_,index)=>artTexture(index)),aspects=pictures.map((p,i)=>p?p.width/p.height:(artImages[i].width||1)/(artImages[i].height||1));
  const items=G.layout(c,aspects).sort((a,b)=>b.z-a.z);
  for(const item of items){const photo=pictures[item.index],distance=item.z-c.z,opacity=alpha*M.smooth(.7,2.5,distance)*Math.max(.45,1-distance/90);if(!photo||opacity<.005)continue;
   const frame=G.frame(item,dynamics.nodes[item.index].angle),q=frame.corners.map(v=>M.project(...v,c));if(q.some(v=>!v)||q.every(v=>v.x<0)||q.every(v=>v.x>w)||q.every(v=>v.y<0)||q.every(v=>v.y>h)||Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y)<8)continue;
   const u=frame.corners[1].map((v,i)=>v-frame.corners[0][i]),v=frame.corners[3].map((v,i)=>v-frame.corners[0][i]);
   // A close contact shadow gives the frame depth without lifting it off the wall.
   ctx.save();ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x+item.side*2,p.y+2):ctx.moveTo(p.x+item.side*2,p.y+2));ctx.closePath();ctx.fillStyle=`rgba(0,0,0,${opacity*.55})`;ctx.fill();ctx.restore();
   // Composite opacity once for the entire frame. Applying it to every triangle
   // would leave bands where neighboring projection strips overlap.
   const left=Math.max(0,Math.floor(Math.min(...q.map(p=>p.x)))-2),top=Math.max(0,Math.floor(Math.min(...q.map(p=>p.y)))-2),right=Math.min(w,Math.ceil(Math.max(...q.map(p=>p.x)))+2),bottom=Math.min(h,Math.ceil(Math.max(...q.map(p=>p.y)))+2),lw=right-left,lh=bottom-top;
   if(lw<=0||lh<=0)continue;if(!artLayer)artLayer=document.createElement('canvas');artLayer.width=Math.max(1,Math.ceil(lw*renderDpr));artLayer.height=Math.max(1,Math.ceil(lh*renderDpr));const target=artLayer.getContext('2d'),main=ctx;target.setTransform(renderDpr,0,0,renderDpr,-left*renderDpr,-top*renderDpr);
   try{ctx=target;paintPlane(photo,frame.corners[0],u,v,c,1,w,h,point=>point,false,12,8);}finally{ctx=main;}
   ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(artLayer,left,top,lw,lh);ctx.restore();visibleArt++;
  }
 }
 function drawCorridor(state,w,h){const photo=getPhoto();if(state.travel>.9999){coverPhoto(photo,0,0,w,h);return;}const c=M.camera(state.travel,w,h),X=c.halfW,Y=c.halfH,tl=M.project(-X,Y,c.endZ,c),br=M.project(X,-Y,c.endZ,c);
  // The destination is upright and fills a square aperture; as it grows beyond the
  // screen height, reveal the wider photo without stretching or rotating it.
  if(tl&&br){const width=br.x-tl.x,height=br.y-tl.y,photoWidth=Math.min(width,w),photoHeight=Math.min(height,h);ctx.save();ctx.beginPath();ctx.rect(tl.x,tl.y,width,height);ctx.clip();coverPhoto(photo,c.cx-photoWidth/2,c.cy-photoHeight/2,photoWidth,photoHeight,M.smooth(.48,.7,state.p));ctx.restore();}
  for(let i=M.corridor.segments-1;i>=0;i--){const segmentZ=c.fillDistance+1.2+i*M.corridor.step,z=Math.max(segmentZ,c.z+.18),z2=Math.min(segmentZ+M.corridor.step,c.endZ+.1);if(z2<=z)continue;const v=[[-X,Y,z],[X,Y,z],[X,-Y,z],[-X,-Y,z],[-X,Y,z2],[X,Y,z2],[X,-Y,z2],[-X,-Y,z2]],alpha=(.1+.1*(1-state.travel))*state.tunnel;
   for(const side of[-1,1]){const wall=[[side*X,Y,z],[side*X,Y,z2],[side*X,-Y,z2],[side*X,-Y,z]].map(v=>M.project(...v,c));if(wall.every(Boolean)){ctx.save();ctx.beginPath();wall.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.globalAlpha=state.tunnel*.75;ctx.fillStyle='#151516';ctx.fill();ctx.restore();}}
   wire(v,edges,c,alpha);const fade=state.tunnel*(1-M.smooth(.79,.92,state.p)),sideY=Math.max(.35,Y*.38),label=labels[i%labels.length];
   paintPlane(texture(label),[-X,sideY,segmentZ+.25],[0,0,2.45],[0,-.68,0],c,fade*.29,w,h);
   paintPlane(texture(labels[(i+4)%labels.length]),[X,sideY,segmentZ+2.7],[0,0,-2.45],[0,-.68,0],c,fade*.29,w,h);
   paintPlane(texture(labels[(i+8)%labels.length]),[-X*.7,-Y,segmentZ+.3],[X*1.4,0,0],[0,0,.65],c,fade*.2,w,h);
   paintPlane(texture(labels[(i+4)%labels.length]),[-X*.7,Y,segmentZ+.95],[X*1.4,0,0],[0,0,-.65],c,fade*.15,w,h);
  }
  drawGallery(state,c,w,h);
 }
 return{render(state,w,h,dpr){visibleArt=0;renderDpr=dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;ctx.fillStyle='#101010';ctx.fillRect(0,0,w,h);if(state.tunnel>.001)drawCorridor(state,w,h);if(state.field>.001||state.p<(options.fieldFade?.[1]||.52))drawField(state,w,h);ctx.globalAlpha=1;},get visibleArt(){return visibleArt;},setTriadLayout(lines){triadLayout=lines;triadTexture=null;},clearText(){textures.clear();triadTexture=null;},clearArt(){artTextures.clear();}};
}

 const space=createGiornoSpace(ctx,M,()=>window.InteriormenteRoom?.poster(w,h)||(w<700?mobileImage:image),wake,artImages,G,dynamics,{getFieldCamera:(...args)=>menu?.fieldCamera(...args),triadOpacity:state=>menu?.triadOpacity(state)??1,hideFieldWord:(box,state)=>menu?.hideFieldWord(box,state),paintMenuFaces:(...args)=>menu?.paintFaces(...args)});
 menu=window.InteriormenteTunnelMenu?.create({section,stage,ctx,canvas,M,G,artImages,createSpace:createGiornoSpace,space,getBounds:bounds,jump,wake,setProgress:value=>{p=target=value;}})||null;
 function draw(time){raf=0;if(document.hidden)return;const view=section.getBoundingClientRect();inView=view.bottom>0&&view.top<innerHeight;const dt=Math.min(100,time-lastTime||16);lastTime=time;const tau=Math.max(p,target)>(menu?.pauseAt??.5)?130:M.timing.smoothingMs;p=reduced.matches?target:p+(target-p)*(1-Math.exp(-dt/tau));if(Math.abs(p-target)<.0001)p=target;
  if(target===0||(target===1&&!inView))p=target;
  const state=M.state(p);section.dataset.giornoProgress=p.toFixed(4);section.dataset.giornoPhase=state.phase;
  if(reduced.matches){menu?.showReduced();statements.forEach(el=>el.removeAttribute('aria-hidden'));return;}
  const menuRendered=menu?.render(time,state,w,h,dpr);
  let swinging=false;if(menuRendered)swinging=menu.animating;else if(inView&&state.tunnel>.01&&state.arrival<1)swinging=dynamics.step(state.travel,dt);else dynamics.reset(state.travel);
  canvas.style.opacity='1';if(inView&&!menuRendered)space.render(state,w,h,dpr);section.dataset.giornoRoll=String(state.roll);section.dataset.giornoFold=state.fold.toFixed(4);section.dataset.gallerySwing=String(swinging);section.dataset.galleryTilt=(menuRendered?menu.galleryTilt:Math.max(0,...dynamics.nodes.map(n=>Math.abs(n.angle)))).toFixed(5);section.dataset.galleryVisible=String(menuRendered?menu.visibleArt:space.visibleArt);section.dataset.firstFrameWords=M.triad.join(', ');
  depthLabel.style.opacity=String(M.smooth(.5,.54,p)*(1-M.smooth(.6,.65,p)));depthLabel.style.transform=`scale(${1+state.travel*.35})`;
  bottom.style.opacity=String(1-state.arrival);
  words.forEach(word=>word.classList.toggle('is-active',p<.18));
  if(Math.abs(p-target)>.0001||swinging)raf=requestAnimationFrame(draw);
 }
 function wake(){if(!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
 function jump(value){menu?.beforeJump(value);window.dispatchEvent(new CustomEvent('interiormente:seek',{detail:1}));const b=bounds();window.scrollTo({top:b.start+b.range*M.clamp(value),behavior:'auto'});p=target=M.clamp(value);dynamics.reset(M.state(p).travel);sync();wake();}
 if(root?.dataset.previewTools==='true'){
  const bar=document.createElement('nav');bar.className='giorno-preview';bar.setAttribute('aria-label','Controlli anteprima Zona Giorno');
  for(const [label,value]of[['Dalla O',null],['Parole',0],['Menu',window.InteriormenteTunnelMenu?.settings.pauseAt??.5],['Rotazione',.31],['Tunnel',.8],['Giorno','giorno'],['Arredata','arredata'],['Passaggio','passaggio'],['Notte','notte']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>value==='giorno'?window.InteriormenteRoom.seek(0):value==='arredata'?window.InteriormenteRoom.seek(.92):value==='passaggio'?window.dispatchEvent(new CustomEvent('interiormente:zone-seek',{detail:{to:'zona-notte',progress:0}})):value==='notte'?document.querySelector('#zona-notte').scrollIntoView({behavior:'auto'}):value===null?window.dispatchEvent(new CustomEvent('interiormente:seek',{detail:.78})):jump(value));bar.append(button);}
  const phone=document.createElement('button');phone.type='button';phone.textContent='Mobile';phone.setAttribute('aria-pressed','false');phone.addEventListener('click',()=>{const value=p,room=window.InteriormenteRoom,roomProgress=room?.active?room.progress:null,transition=document.querySelector('[data-zone-transition]'),transitionRect=transition.getBoundingClientRect(),zoneProgress=transitionRect.top<=0&&transitionRect.bottom>h?Number(transition.dataset.progress||0):null,on=!document.body.classList.contains('preview-mobile');document.body.classList.toggle('preview-mobile',on);phone.setAttribute('aria-pressed',String(on));requestAnimationFrame(()=>requestAnimationFrame(()=>{resize();window.dispatchEvent(new CustomEvent('interiormente:layout'));if(zoneProgress!==null)window.dispatchEvent(new CustomEvent('interiormente:zone-seek',{detail:{to:'zona-notte',progress:zoneProgress}}));else if(roomProgress!==null)room.seek(roomProgress);else jump(value);}));});bar.append(phone);document.body.append(bar);
 }
 Promise.all([image.decode(),mobileImage.decode()]).then(()=>{imageReady=true;stage.dataset.imageReady='true';wake();}).catch(()=>{stage.dataset.imageReady='error';});
 Promise.allSettled(artImages.map(img=>img.decode())).then(()=>{stage.dataset.galleryReady=String(artImages.filter(img=>img.complete&&img.naturalWidth).length);space.clearArt();wake();});
 document.fonts.ready.then(resize);
 window.addEventListener('interiormente:room-ready',wake);window.addEventListener('scroll',sync,{passive:true});window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{lastTime=0;dynamics.reset(M.state(p).travel);wake();});reduced.addEventListener('change',()=>{resize();wake();});
 new ResizeObserver(resize).observe(section);new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;if(inView)wake();}).observe(section);resize();
})();
