let observer;
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused=false;try{paused=localStorage.getItem('noghrex-motion')==='paused';}catch{}
export function setupEffects(){observer?.disconnect();document.documentElement.classList.toggle('motion-paused',paused||reduced);for(const el of document.querySelectorAll('[data-parallax]')){el.onpointermove=e=>{if(paused||reduced||e.pointerType==='touch')return;const r=el.getBoundingClientRect();el.style.setProperty('--px',((e.clientX-r.left)/r.width-.5)*18+'px');el.style.setProperty('--py',((e.clientY-r.top)/r.height-.5)*14+'px');};el.onpointerleave=()=>{el.style.setProperty('--px','0px');el.style.setProperty('--py','0px');};}
 observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.target.tagName==='VIDEO'){if(e.isIntersecting&&!paused&&!reduced&&!e.target.dataset.userPaused)e.target.play().catch(()=>{});else e.target.pause();}}},{threshold:.25});document.querySelectorAll('[data-motion-video]').forEach(v=>observer.observe(v));
 document.querySelectorAll('[data-motion-gif]').forEach(img=>{img.src=paused||reduced?'/assets/silver-motion-poster.png':'/assets/silver-motion.gif';});}
export function toggleMotion(){paused=!paused;try{localStorage.setItem('noghrex-motion',paused?'paused':'playing');}catch{}setupEffects();return paused;}
export function toggleVideo(button){const v=button.parentElement.querySelector('video');if(v.paused){delete v.dataset.userPaused;v.play().catch(()=>{});}else{v.dataset.userPaused='true';v.pause();}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('video').forEach(v=>v.pause());else setupEffects();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{reduced=e.matches;setupEffects();});
