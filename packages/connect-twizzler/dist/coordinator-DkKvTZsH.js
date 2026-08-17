//#region src/shared/worker.ts?worker&inline
var e = "const e=/^#[0-9a-f]{6}$/i;function t(e){return Math.min(1,Math.max(0,e))}function n(e){return typeof e==`number`&&Number.isFinite(e)}function r(t,n){return typeof t==`string`&&e.test(t)?t.toLowerCase():typeof n==`string`&&e.test(n)?n.toLowerCase():`#f46021`}function i(e){let t=r(e,`#f46021`).slice(1);return{r:Number.parseInt(t.slice(0,2),16),g:Number.parseInt(t.slice(2,4),16),b:Number.parseInt(t.slice(4,6),16)}}function a(e,t){return[{id:`far`,x:0,y:.5,offset:0,color:r(e,`#fea700`)},{id:`near`,x:1,y:.5,offset:1,color:r(t,`#f46021`)}]}function o(e,t,n){return[{id:`far`,x:.08,y:.78,offset:.08,color:r(e,`#fea700`)},{id:`peak`,x:.5,y:.16,offset:.5,color:r(n,`#e92e28`)},{id:`near`,x:.92,y:.72,offset:.92,color:r(t,`#f46021`)}]}function s(e){return[...e].sort((e,t)=>e.x-t.x||e.y-t.y||e.id.localeCompare(t.id))}function c(e){return Number(t(e).toFixed(4))}function l(e,t,i){if(!e||typeof e!=`object`)return null;let a=e,o=n(a.x)?a.x:n(a.offset)?a.offset:null;if(o===null)return null;let s=c(o),l=n(a.y)?c(a.y):.5;return{id:typeof a.id==`string`&&a.id.trim()?a.id.trim():`g${t}`,x:s,y:l,offset:s,color:r(a.color,i)}}function u(e,t,n){let i=r(t,`#fea700`),o=r(n,`#f46021`),c=Array.isArray(e)?e:[],u=[],d=new Set;for(let e=0;e<c.length;e+=1){let t=l(c[e],e,e===0?i:o);if(!t)continue;let n=t.id;if(d.has(n)&&(n=`${t.id}-${u.length}`),d.add(n),u.push({...t,id:n}),u.length>=16)break}return u.length<1?a(i,o):s(u)}function d(e){return JSON.stringify(s(e).map(e=>({id:e.id,x:c(e.x),y:c(e.y),offset:c(e.offset),color:e.color})))}function f(e,t,n){if(Array.isArray(e))return u(e,t,n);if(typeof e!=`string`||e.trim()===``)return a(t,n);try{return u(JSON.parse(e),t,n)}catch{return a(t,n)}}function p(e){return e.length>0?[...e]:a(`#fea700`,`#f46021`)}function m(e,n,r){let a=p(e),o=t(n),s=t(r);if(a.length===1)return i(a[0].color);let c=0,l=0,u=0,d=0;for(let e of a){let t=o-e.x,n=s-e.y,r=t*t+n*n;if(r<=1e-12)return i(e.color);let a=1/r**(2/2),f=i(e.color);c+=a*f.r,l+=a*f.g,u+=a*f.b,d+=a}return d<=0?i(a[0].color):{r:c/d,g:l/d,b:u/d}}function h(e){let n=s(p(e)),r=[],i=-1;for(let e of n){let n=t(e.offset);n<=i&&(n=Math.min(1,i+1e-4)),r.push({...e,offset:n,x:n}),i=n}return r}function g(e,n){for(let r of h(n))e.addColorStop(t(r.offset),r.color)}function _(e,t,n){let r=Math.max(1,Math.round(t)),i=Math.max(1,Math.round(n)),a=new Uint8ClampedArray(r*i*4);for(let t=0;t<i;t+=1){let n=(t+.5)/i;for(let i=0;i<r;i+=1){let o=m(e,(i+.5)/r,n),s=(t*r+i)*4;a[s]=o.r,a[s+1]=o.g,a[s+2]=o.b,a[s+3]=255}}return a}const v=[`solid`,`sharedLinear`,`sharedGradient`,`fiberGradient`,`baked`];function y(e){switch(e){case`sharedGradient`:case`fiberGradient`:return!0;case`solid`:case`sharedLinear`:case`baked`:return!1;default:return e}}const b={color:`#f46021`,colorFar:`#fea700`,colorNear:`#f46021`,colorEdge:`#e92e28`,gradientStops:o(`#fea700`,`#f46021`,`#e92e28`),opacity:1,scale:1,centerY:.5,amplitude:1,lineCount:56,lineWidth:2.3,pointSpacing:10,leftHeight:.58,rightHeight:.32,edgeFluctuation:0,edgeSpeed:0,edgeTaper:.08,wrinkles:1.8,wrinkleStrength:.032,bendPosition:.2,bendAmount:0,bend2Position:.4,bend2Amount:0,bend3Position:.75,bend3Amount:0,depthPosition:.86,depthAmount:1.15,depthWidth:.36,depth2Position:.42,depth2Amount:.2,depth2Width:.12,depthSpread:1.05,depthLift:.85,depthTerrain:0,twist:1.15,rotateXDeg:12,rotateYDeg:-18,rotateZDeg:0,fov:1.05,camDist:10.5,perspectiveWidth:1.8,minLineWidth:.4,maxLineWidth:3.2,gradientsEnabled:!0,ribbonColorMode:`sharedGradient`,gradientXEnabled:!0,gradientXMix:1,gradientYEnabled:!0,gradientYMix:.85,gradientZEnabled:!0,gradientZStrength:.75,gradientZCenter:0,gradientZWidth:.95,backgroundColor:`#ffffff`,noiseScaleX:4e-4,noiseScaleY:.01,speed:1,drift:.02,stippleSize:0,stippleGap:.8,rotateX:0,rotateY:0,rotateZ:0,panX:0,panY:0,panZ:0,viewDistance:30};function x(e,t,n,r){return typeof e==`number`&&Number.isFinite(e)?Math.max(n,Math.min(r,e)):t}function S(e,t,n){let r=t-e;if(Math.abs(r)<1e-12)return n<e?0:1;let i=Math.max(0,Math.min(1,(n-e)/r));return i*i*(3-2*i)}function C(e,t=b.color){return typeof e==`string`&&/^#[0-9a-f]{6}$/i.test(e)?e.toLowerCase():typeof t==`string`&&/^#[0-9a-f]{6}$/i.test(t)?t.toLowerCase():b.color}function w(e){let t=e.ribbonColorMode;return typeof t==`string`&&v.includes(t)?t:typeof e.gradientsEnabled==`boolean`?e.gradientsEnabled?`baked`:`solid`:b.ribbonColorMode}function T(e){return w(e)===`baked`?e.gradientXEnabled||e.gradientYEnabled||e.gradientZEnabled&&e.gradientZStrength>0:!1}function E(e){let t=e&&typeof e==`object`?e:{},n=C(t.color,b.color),r=w(t),i=C(t.colorFar,b.colorFar),a=C(t.colorNear??t.color,b.colorNear),o=f(t.gradientStops,i,a),s=o[0]?.color??i,c=o[o.length-1]?.color??a;return{color:r===`solid`?a:n,colorFar:s,colorNear:c,colorEdge:C(t.colorEdge,b.colorEdge),gradientStops:o,opacity:x(t.opacity,b.opacity,0,1),scale:x(t.scale,b.scale,.01,50),centerY:x(t.centerY,b.centerY,-2,3),amplitude:x(t.amplitude,b.amplitude,0,20),lineCount:Math.round(x(t.lineCount,b.lineCount,1,800)),lineWidth:x(t.lineWidth,b.lineWidth,.01,80),pointSpacing:Math.round(x(t.pointSpacing,b.pointSpacing,1,400)),leftHeight:x(t.leftHeight,b.leftHeight,-10,10),rightHeight:x(t.rightHeight,b.rightHeight,-10,10),edgeFluctuation:x(t.edgeFluctuation,b.edgeFluctuation,0,10),edgeSpeed:x(t.edgeSpeed,b.edgeSpeed,0,40),edgeTaper:x(t.edgeTaper,b.edgeTaper,0,1),wrinkles:x(t.wrinkles,b.wrinkles,0,200),wrinkleStrength:x(t.wrinkleStrength,b.wrinkleStrength,0,10),bendPosition:x(t.bendPosition,b.bendPosition,0,1),bendAmount:x(t.bendAmount,b.bendAmount,-20,20),bend2Position:x(t.bend2Position,b.bend2Position,0,1),bend2Amount:x(t.bend2Amount,b.bend2Amount,-20,20),bend3Position:x(t.bend3Position,b.bend3Position,0,1),bend3Amount:x(t.bend3Amount,b.bend3Amount,-20,20),depthPosition:x(t.depthPosition,b.depthPosition,0,1),depthAmount:x(t.depthAmount,b.depthAmount,0,40),depthWidth:x(t.depthWidth,b.depthWidth,.01,10),depth2Position:x(t.depth2Position,b.depth2Position,0,1),depth2Amount:x(t.depth2Amount,b.depth2Amount,0,40),depth2Width:x(t.depth2Width,b.depth2Width,.01,10),depthSpread:x(t.depthSpread,b.depthSpread,0,40),depthLift:x(t.depthLift,b.depthLift,0,20),depthTerrain:Math.round(x(t.depthTerrain,b.depthTerrain,0,5)),twist:x(t.twist,b.twist,0,80),rotateXDeg:x(t.rotateXDeg,b.rotateXDeg,-720,720),rotateYDeg:x(t.rotateYDeg,b.rotateYDeg,-720,720),rotateZDeg:x(t.rotateZDeg,b.rotateZDeg,-720,720),fov:x(t.fov,b.fov,.05,20),camDist:x(t.camDist,b.camDist,.25,200),perspectiveWidth:x(t.perspectiveWidth,b.perspectiveWidth,0,40),minLineWidth:x(t.minLineWidth,b.minLineWidth,.01,40),maxLineWidth:x(t.maxLineWidth,b.maxLineWidth,.01,120),ribbonColorMode:r,gradientsEnabled:r!==`solid`,gradientXEnabled:typeof t.gradientXEnabled==`boolean`?t.gradientXEnabled:b.gradientXEnabled,gradientXMix:x(t.gradientXMix,b.gradientXMix,0,1),gradientYEnabled:typeof t.gradientYEnabled==`boolean`?t.gradientYEnabled:b.gradientYEnabled,gradientYMix:x(t.gradientYMix,b.gradientYMix,0,1),gradientZEnabled:typeof t.gradientZEnabled==`boolean`?t.gradientZEnabled:b.gradientZEnabled,gradientZStrength:x(t.gradientZStrength,b.gradientZStrength,0,10),gradientZCenter:x(t.gradientZCenter,b.gradientZCenter,-10,10),gradientZWidth:x(t.gradientZWidth,b.gradientZWidth,.01,20),backgroundColor:C(t.backgroundColor,b.backgroundColor),noiseScaleX:x(t.noiseScaleX,b.noiseScaleX,1e-5,1),noiseScaleY:x(t.noiseScaleY,b.noiseScaleY,1e-4,2),speed:x(t.speed,b.speed,0,40),drift:x(t.drift,b.drift,0,20),stippleSize:x(t.stippleSize,b.stippleSize,0,80),stippleGap:x(t.stippleGap,b.stippleGap,0,80),rotateX:x(t.rotateX,b.rotateX,-89,89),rotateY:x(t.rotateY,b.rotateY,-180,180),rotateZ:x(t.rotateZ,b.rotateZ,-720,720),panX:x(t.panX,b.panX,-400,400),panY:x(t.panY,b.panY,-400,400),panZ:x(t.panZ,b.panZ,-20,20),viewDistance:x(t.viewDistance,b.viewDistance,.1,1e3)}}const D=-1.8,O=2.8,k=6.8;function A(e){let t=e.replace(`#`,``);return{r:Number.parseInt(t.slice(0,2),16),g:Number.parseInt(t.slice(2,4),16),b:Number.parseInt(t.slice(4,6),16)}}function j(e,t,n){return e+(t-e)*n}function M(e,t,n){return{r:j(e.r,t.r,n),g:j(e.g,t.g,n),b:j(e.b,t.b,n)}}function N(e){let t=e=>Math.round(Math.max(0,Math.min(255,e))).toString(16).padStart(2,`0`);return`#${t(e.r)}${t(e.g)}${t(e.b)}`}function P(e,t,n,r=1,i=k){let a=0;a+=.42*Math.sin(e*.42+t*.3+n*.09),a+=.28*Math.sin(e*.95-t*.48+n*.06+1),a+=.16*Math.sin(e*1.65+t*.95-n*.14+.5),a+=.11*Math.sin(e*2.3-t*1.35+n*.11-.7),a+=.07*Math.sin(e*3.1+t*1.8-n*.2+1.8),a+=.045*Math.sin(e*4.2-t*2.4+n*.26+.9),a+=.025*Math.sin(e*5.6+t*3.1-n*.33),a+=.015*Math.sin(e*7-t*3.8+n*.41),a+=.05*Math.sin(t*1.9+n*.19)*Math.sin(e*.3+.4),a+=.03*Math.sin(t*2.9-n*.27)*Math.cos(e*.45);let o=8.5/k*i,s=3.8/k*i,c=Math.max(0,Math.min(1,(o-Math.abs(e))/Math.max(1e-6,o-s)));return a*=c*c*(3-2*c),a*r}function F(e,t){let n=Math.cos(t),r=Math.sin(t);return{x:e.x,y:e.y*n-e.z*r,z:e.y*r+e.z*n}}function I(e,t){let n=Math.cos(t),r=Math.sin(t);return{x:e.x*n+e.z*r,y:e.y,z:-e.x*r+e.z*n}}function L(e,t){let n=Math.cos(t),r=Math.sin(t);return{x:e.x*n-e.y*r,y:e.x*r+e.y*n,z:e.z}}function R(e,t){return e*t}function z(e,t,n){return(Number.isFinite(e)?e:0)+(Number.isFinite(t)?Math.max(0,t):0)*(Number.isFinite(n)?Math.max(0,n):0)}function B(e,t,n,r=b){let i=Math.max(1,Math.round(e)),a=Math.max(1,Math.round(t)),o=E(r),s=R(n,o.speed),c=Math.max(1,o.lineCount),l=Math.max(160,Math.min(720,Math.round(i/Math.max(2,o.pointSpacing)))),u=o.rotateXDeg*Math.PI/180,d=o.rotateYDeg*Math.PI/180,f=o.rotateZDeg*Math.PI/180,p=k,m=o.camDist,h=o.fov,g=o.scale,_=[];for(let e=0;e<c;e+=1){let t=c<=1?.9999999999999998*.5:D+(O-D)*e/(c-1),n=[];for(let e=0;e<l;e+=1){let r=l<=1?0:e/(l-1)*2-1,i=r*p,a=P(i,t,s,o.amplitude,p),c={x:i,y:a,z:t};c=F(c,u),c=I(c,d),c=L(c,f),n.push({...c,u:r,origX:i,origY:a,origZ:t})}_.push(n)}let v=1/0,y=-1/0;for(let e of _)for(let t of e){let e=m+t.z;if(e<.4)continue;let n=t.x/e*h;n<v&&(v=n),n>y&&(y=n)}let x=Math.max(.001,y-v),C=1.88*g/Math.max(.001,x),w=(v+y)*.5,j=A(o.colorFar),z=A(o.colorNear),B=A(o.colorEdge),V=A(o.colorNear),H=A(o.color),U=A(o.backgroundColor),W=[];for(let e=0;e<_.length;e+=1){let t=_[e],n=c<=1?0:e/(c-1)*2-1,r=[],s=0,l=0,u=0,d=0,f=0,v=0;for(let e=0;e<t.length;e+=1){let n=t[e],c=m+n.z;if(c<.4)continue;let _=S(3.2,.3,Math.abs(n.origZ+.15));_*=S(1.12,.58,Math.abs(n.u)),_*=S(.2,1,c/14);let y=T(o),b=1;if(y&&o.gradientZEnabled){let e=(n.origZ-D)/(O-D)*2-1;e=(e-o.gradientZCenter)/Math.max(.05,o.gradientZWidth),b=Math.max(0,Math.min(1,S(1.2,-.2,e)))}let x={...H};if(y&&o.gradientXEnabled){let e=n.origX/p*.5+.5,t=M(j,z,Math.max(0,Math.min(1,e)));x=M(x,t,o.gradientXMix)}if(y&&o.gradientYEnabled&&o.gradientYMix>0){let e=n.origY/(.55*o.amplitude+.01),t=S(.15,.7,Math.min(1,Math.abs(e)))*o.gradientYMix;t>.001&&(x=M(x,e>=0?B:V,t))}if(y&&o.gradientZEnabled&&o.gradientZStrength>0){let e=(1-b)*Math.min(1,o.gradientZStrength);x=M(x,U,e)}if(_<.008)continue;let E=(n.x/c*h-w)*C,k=n.y/c*h*1.25*g,A=(E*.5+.5)*i,P=(.5-k*.5)*a,F=Math.max(0,Math.min(1,1-(c-8)/6)),I=N(x);r.push({x:A,y:P,depth:c,along:(n.u+1)*.5,nearness:F,alpha:_,color:I}),s+=_,l+=c,u+=x.r,d+=x.g,f+=x.b,v+=1}if(r.length<2)continue;let y=s/Math.max(1,v);if(y<.01)continue;let b=l/Math.max(1,v),x=m/Math.max(.4,b),E=o.lineWidth*(1+(x-1)*o.perspectiveWidth),k=Math.max(o.minLineWidth,Math.min(o.maxLineWidth,E)),A=Math.max(0,Math.min(1,1-(b-8)/6)),P=N({r:u/v,g:d/v,b:f/v});W.push({across:n,opacity:Math.min(1,y*1.45)*o.opacity,color:P,nearness:A,strokeWidth:k,points:r})}let G=a*o.centerY;for(let e=0;e<4;e+=1){let e=0,t=0;for(let n of W)for(let r of n.points)r.y>=0&&r.y<=a&&(e+=r.y,t+=1);if(t<=0)break;let n=G-e/t;if(Math.abs(n)<.25)break;for(let e of W)for(let t of e.points)t.y+=n}let K=Math.max(.05,Math.min(20,Math.exp(-o.panZ*.35))),q=i*.5,J=a*o.centerY;if(K!==1||o.panX!==0||o.panY!==0)for(let e of W)for(let t of e.points)t.x=q+(t.x-q)*K+o.panX,t.y=J+(t.y-J)*K+o.panY;return{settings:o,lines:W}}function V(e,t){if(e.length<2||t<=0)return null;let n=t*.5,r=[],i=[];for(let t=0;t<e.length;t+=1){let a=e[t],o=e[Math.max(0,t-1)],s=e[Math.min(e.length-1,t+1)],c=s.x-o.x,l=s.y-o.y,u=Math.hypot(c,l);u<1e-8?(c=1,l=0):(c/=u,l/=u),r.push({x:a.x+-l*n,y:a.y+c*n}),i.push({x:a.x- -l*n,y:a.y-c*n})}return[...r,...i.reverse()]}function H(e){return e.getContext(`2d`)}function U(e,t){if(typeof document<`u`){let n=document.createElement(`canvas`);return n.width=e,n.height=t,n}return new OffscreenCanvas(e,t)}function W(e,t,n){let r=V(t,n);if(!(!r||r.length<3)){e.beginPath(),e.moveTo(r[0].x,r[0].y);for(let t=1;t<r.length;t+=1)e.lineTo(r[t].x,r[t].y);e.closePath(),e.fill()}}function G(e,t){if(e.length===0)return null;let n=1/0,r=1/0,i=-1/0,a=-1/0;for(let t of e)t.x<n&&(n=t.x),t.y<r&&(r=t.y),t.x>i&&(i=t.x),t.y>a&&(a=t.y);let o=Math.max(0,t)*.5,s=n-o,c=r-o;return{x1:s,y1:c,x2:Math.max(i+o,s+.001),y2:Math.max(a+o,c+.001)}}let K=null,q=null;function J(e){let t=d(e);if(K&&K.key===t)return K.canvas;let n=K?.canvas??U(160,100);n.width=160,n.height=100;let r=H(n);if(!r)return null;let i=_(e,n.width,n.height),a=r.createImageData(n.width,n.height);return a.data.set(i),r.putImageData(a,0,0),K={key:t,canvas:n},q=null,n}function Y(e,t,n){let r=J(e);if(!r)return null;let i=d(e);if(q&&q.key===i&&q.width===t&&q.height===n)return q.canvas;let a=q?.canvas??U(t,n);a.width!==t&&(a.width=t),a.height!==n&&(a.height=n);let o=H(a);return o?(o.clearRect(0,0,t,n),o.drawImage(r,0,0,t,n),q={key:i,width:t,height:n,canvas:a},a):null}function X(e,t,n){let r=V(t,n);if(!r||r.length<3)return!1;e.beginPath(),e.moveTo(r[0].x,r[0].y);for(let t=1;t<r.length;t+=1)e.lineTo(r[t].x,r[t].y);return e.closePath(),e.clip(),!0}function Z(e,t,n,r,i=b){let a=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.width!==a&&(e.width=a),e.height!==o&&(e.height=o);let s=H(e);if(!s)return;let{settings:c,lines:l}=B(a,o,r,i);s.clearRect(0,0,a,o),s.save(),s.lineJoin=`round`,s.lineCap=`butt`,s.setLineDash([]);let u=[...l].sort((e,t)=>e.nearness-t.nearness),d=w(c),f=c.gradientStops,p=y(d)?J(f):null,m=d===`sharedLinear`?(()=>{let e=s.createLinearGradient(0,0,a,0);return g(e,f),e})():null;if(d===`sharedGradient`&&p){let e=Y(f,a,o)??p;for(let e of u){if(e.points.length<2)continue;let t=Math.max(c.minLineWidth,e.strokeWidth);s.globalAlpha=Math.max(.01,Math.min(1,e.opacity)),s.fillStyle=`#ffffff`,W(s,e.points,t)}s.globalAlpha=1,s.globalCompositeOperation=`source-in`,s.drawImage(e,0,0,a,o),s.globalCompositeOperation=`source-over`,s.restore();return}for(let e of u){if(e.points.length<2)continue;let t=Math.max(c.minLineWidth,e.strokeWidth);switch(s.lineWidth=t,d){case`solid`:s.strokeStyle=e.color,s.globalAlpha=Math.max(.01,Math.min(1,e.opacity)),s.beginPath(),s.moveTo(e.points[0].x,e.points[0].y);for(let t=1;t<e.points.length;t+=1)s.lineTo(e.points[t].x,e.points[t].y);s.stroke();break;case`sharedLinear`:s.fillStyle=m??c.colorNear,s.globalAlpha=Math.max(.01,Math.min(1,e.opacity)),W(s,e.points,t);break;case`sharedGradient`:s.save(),s.globalAlpha=Math.max(.01,Math.min(1,e.opacity)),p&&X(s,e.points,t)?s.drawImage(p,0,0,a,o):(s.fillStyle=c.colorNear,W(s,e.points,t)),s.restore();break;case`fiberGradient`:{let n=G(e.points,t);s.save(),s.globalAlpha=Math.max(.01,Math.min(1,e.opacity)),p&&n&&X(s,e.points,t)?s.drawImage(p,n.x1,n.y1,n.x2-n.x1,n.y2-n.y1):(s.fillStyle=c.colorNear,W(s,e.points,t)),s.restore();break}case`baked`:for(let t=1;t<e.points.length;t+=1){let n=e.points[t-1],r=e.points[t],i=n.alpha??e.opacity,a=r.alpha??e.opacity;if(i<.008||a<.008)continue;let o=Math.min(1,(i+a)*.5*1.45*c.opacity);o<.01||(s.strokeStyle=N(M(A(n.color??e.color),A(r.color??e.color),.5)),s.globalAlpha=o,s.beginPath(),s.moveTo(n.x,n.y),s.lineTo(r.x,r.y),s.stroke())}break;default:break}}s.restore()}const Q=self,$=new Map;function ee(e,t,n){if(!t.visible||t.reducedMotion&&!t.dirty)return;let r=t.maxFps>0?1e3/t.maxFps:0;if(!t.dirty&&r>0&&n-t.lastFrameAt<r-1)return;let i=t.lastTickAt>0?Math.min(.1,Math.max(0,n-t.lastTickAt)/1e3):0;t.lastTickAt=n,t.reducedMotion||(t.animationTime=z(t.animationTime,i,t.settings.speed)),Z(t.canvas,t.canvas.width,t.canvas.height,t.animationTime,{...t.settings,speed:1}),t.lastFrameAt=n,t.dirty=!1;let a=t.canvas.transferToImageBitmap();Q.postMessage({type:`frame`,id:e,frame:a,width:t.canvas.width,height:t.canvas.height},[a])}function te(e){switch(e.type){case`register`:$.set(e.id,{canvas:new OffscreenCanvas(e.width,e.height),settings:E(e.settings),visible:!1,reducedMotion:e.reducedMotion,maxFps:e.maxFps,lastFrameAt:-1/0,lastTickAt:0,animationTime:0,dirty:!0});return;case`resize`:{let t=$.get(e.id);if(!t)return;t.canvas.width!==e.width&&(t.canvas.width=e.width),t.canvas.height!==e.height&&(t.canvas.height=e.height),t.dirty=!0;return}case`settings`:{let t=$.get(e.id);if(!t)return;t.settings=E(e.settings),t.dirty=!0;return}case`visibility`:{let t=$.get(e.id);if(!t)return;t.visible=e.visible,t.lastTickAt=0,e.visible&&(t.dirty=!0);return}case`reducedMotion`:{let t=$.get(e.id);if(!t)return;t.reducedMotion=e.reducedMotion,t.dirty=!0;return}case`tick`:for(let[t,n]of $)ee(t,n,e.now);Q.postMessage({type:`tock`});return;case`unregister`:$.delete(e.id);return;case`terminate`:$.clear(),Q.close();return}}Q.addEventListener(`message`,e=>{try{te(e.data)}catch(t){let n=`id`in e.data?e.data.id:void 0;Q.postMessage({type:`error`,id:n,message:t instanceof Error?t.message:String(t)}),e.data.type===`tick`&&Q.postMessage({type:`tock`})}});", t = typeof self < "u" && self.Blob && new Blob(["URL.revokeObjectURL(import.meta.url);", e], { type: "text/javascript;charset=utf-8" });
function n(n) {
	let r;
	try {
		if (r = t && (self.URL || self.webkitURL).createObjectURL(t), !r) throw "";
		let e = new Worker(r, {
			type: "module",
			name: n?.name
		});
		return e.addEventListener("error", () => {
			(self.URL || self.webkitURL).revokeObjectURL(r);
		}), e;
	} catch {
		return new Worker("data:text/javascript;charset=utf-8," + encodeURIComponent(e), {
			type: "module",
			name: n?.name
		});
	}
}
//#endregion
//#region src/shared/coordinator.ts
var r = /* @__PURE__ */ new Map(), i = null, a = null, o = 0, s = 0, c = !1;
function l() {
	return typeof Worker < "u" && typeof OffscreenCanvas < "u";
}
function u(e, t) {
	i && (t?.length ? i.postMessage(e, t) : i.postMessage(e));
}
function d() {
	return [...r.values()].some((e) => e.visible && !e.paused);
}
function f(e) {
	s = requestAnimationFrame(f), !(c || !d()) && (c = !0, u({
		type: "tick",
		now: e
	}));
}
function p() {
	r.size > 0 && !s && (s = requestAnimationFrame(f)), r.size === 0 && s && (cancelAnimationFrame(s), s = 0, c = !1);
}
function m() {
	if (i) return i;
	let e = new n();
	return a = (e) => {
		let t = e.data;
		if (t.type === "tock") {
			c = !1;
			return;
		}
		if (t.type === "error") {
			console.error(`[connect-twizzler] ${t.id ?? "worker"}: ${t.message}`);
			return;
		}
		let n = r.get(t.id);
		if (!n) {
			t.frame.close();
			return;
		}
		let { canvas: i, context: a } = n;
		i.width !== t.width && (i.width = t.width), i.height !== t.height && (i.height = t.height), a.clearRect(0, 0, t.width, t.height), a.drawImage(t.frame, 0, 0), t.frame.close(), n.ready || (n.ready = !0, n.onReady?.());
	}, e.addEventListener("message", a), i = e, e;
}
function h() {
	i && (u({ type: "terminate" }), a && i.removeEventListener("message", a), i.terminate(), i = null, a = null);
}
function g(e, t) {
	let n = e.getBoundingClientRect(), r = Math.min(t, Math.max(1, window.devicePixelRatio || 1));
	return {
		width: Math.max(1, Math.round((n.width || e.clientWidth || 320) * r)),
		height: Math.max(1, Math.round((n.height || e.clientHeight || 180) * r))
	};
}
function _(e) {
	if (!l()) return {
		supported: !1,
		setPaused() {},
		setSettings() {},
		unregister() {}
	};
	m();
	let t = `twizzler-${o++}`, n = e.canvas.getContext("2d", { colorSpace: "display-p3" });
	if (!n) return {
		supported: !1,
		setPaused() {},
		setSettings() {},
		unregister() {}
	};
	let i = Math.max(1, e.maxDpr ?? 1.5), a = g(e.canvas, i), s = matchMedia("(prefers-reduced-motion: reduce)");
	u({
		type: "register",
		id: t,
		width: a.width,
		height: a.height,
		settings: e.settings,
		maxFps: Math.max(1, e.maxFps ?? 30),
		reducedMotion: s.matches
	});
	let c = {
		id: t,
		canvas: e.canvas,
		context: n,
		onReady: e.onReady,
		ready: !1,
		visible: !1,
		paused: e.paused ?? !1,
		maxDpr: i
	}, d = new IntersectionObserver(([e]) => {
		c.visible = e?.isIntersecting ?? !1, u({
			type: "visibility",
			id: t,
			visible: c.visible && !c.paused
		});
	}, { rootMargin: e.rootMargin ?? "160px" }), f = new ResizeObserver(() => {
		let n = g(e.canvas, c.maxDpr);
		u({
			type: "resize",
			id: t,
			width: n.width,
			height: n.height
		});
	}), _ = (e) => {
		u({
			type: "reducedMotion",
			id: t,
			reducedMotion: e.matches
		});
	};
	return c.observer = d, c.resizeObserver = f, c.motionQuery = s, c.motionListener = _, r.set(t, c), d.observe(e.canvas), f.observe(e.canvas), s.addEventListener("change", _), p(), {
		supported: !0,
		setPaused(e) {
			c.paused = e, u({
				type: "visibility",
				id: t,
				visible: c.visible && !e
			});
		},
		setSettings(e) {
			u({
				type: "settings",
				id: t,
				settings: e
			});
		},
		unregister() {
			d.disconnect(), f.disconnect(), s.removeEventListener("change", _), u({
				type: "unregister",
				id: t
			}), r.delete(t), p(), r.size === 0 && h();
		}
	};
}
//#endregion
export { _ as registerSharedTwizzler };
