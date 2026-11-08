const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
const PatchDSP=new Function(src+';return PatchDSP;')();
const sr=48000, d=new PatchDSP(sr);
const vols=[100,85,95,105,90,95,92,100,98,105,100,110,112,96];
d.handle({t:'vols',v:vols});
d.handle({t:'steps',w:'gab',v:[120,0,250,60,0,180,400,0,90,300,0,140,220,0,480,40]});
d.handle({t:'steps',w:'ann',v:[500,0,300,0,150,500,0,400,0,0,250,500,0,100]});
d.handle({t:'steps',w:'bass',v:[60,60,0,90,45,0,120,60,30,0,75,150,60,0,45,240]});
d.handle({t:'filt',f:[180,320,560,900,1500,2400,3600,4800],q:Array(8).fill(30),g:Array(8).fill(0.6)});
const smp=new Float32Array(sr/2);for(let n=0;n<smp.length;n++){const t=n/sr;smp[n]=Math.sin(2*Math.PI*180*t+3*Math.sin(2*Math.PI*523*t))*Math.exp(-t*9)*0.8}
d.handle({t:'sample',v:smp});
let ui=null;d.post=m=>ui=m;
d.reset();
const N=128, L=new Float32Array(N),R=new Float32Array(N);
let peak=0,sum=0,nan=0,clips=0,tot=0;
for(let b=0;b<sr*20/N;b++){d.process(L,R,N);for(let i=0;i<N;i++){const v=L[i];if(!isFinite(v)||isNaN(R[i]))nan++;peak=Math.max(peak,Math.abs(v));sum+=v*v;if(Math.abs(v)>=1)clips++;tot++;}}
console.log({peak,rms:Math.sqrt(sum/tot),nan,clipFrac:clips/tot,ui});
// solo each voice
for(let k=0;k<14;k++){const e=new PatchDSP(sr);e.handle({t:'vols',v:vols.map((v,i)=>i==k?127:0)});
 ['gab','ann','bass'].forEach(w=>e[w].set(d[w]));e.bands=d.bands.map(b=>({...b,x1:0,x2:0,y1:0,y2:0}));e.buf=smp;e.reset();e.master=1;
 let s=0,p=0,c=0;for(let b=0;b<sr*10/N;b++){for(let j=0;j<20;j++){} e.process(L,R,N);for(let i=0;i<N;i++){s+=L[i]*L[i]+R[i]*R[i];p=Math.max(p,Math.abs(L[i]),Math.abs(R[i]));c++;}}
 console.log(k,'rms',Math.sqrt(s/c/2).toFixed(3),'peak',p.toFixed(3));}
