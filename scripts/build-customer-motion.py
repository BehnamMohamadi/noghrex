"""Render original code-native silver geometry. No third-party footage or image edits.
Requires Pillow + numpy. Writes a VP8 WebM, small GIF and static poster.
"""
from pathlib import Path
from io import BytesIO
import math, struct
import numpy as np
from PIL import Image, ImageDraw

OUT=Path(__file__).resolve().parents[1]/'public/customer/assets'
OUT.mkdir(parents=True,exist_ok=True)
W,H,N,FPS=640,420,96,24
y,x=np.mgrid[0:H,0:W]
glow=np.exp(-(((x-380)/330)**2+((y-170)/260)**2))
bg=np.stack([8+glow*15,30+glow*35,35+glow*32],axis=-1).astype('uint8')
def rotation(a,b):
 ca,sa,cb,sb=math.cos(a),math.sin(a),math.cos(b),math.sin(b)
 return np.array([[ca,0,sa],[0,1,0],[-sa,0,ca]])@np.array([[1,0,0],[0,cb,-sb],[0,sb,cb]])
def mesh(t,offset,scale):
 nu,nv=72,18
 u,v=np.meshgrid(np.linspace(0,2*math.pi,nu,endpoint=False),np.linspace(0,2*math.pi,nv,endpoint=False),indexing='ij')
 radius=1+.12*np.sin(3*u+t)
 points=np.stack([(radius+.12*np.cos(v))*np.cos(u),(radius+.12*np.cos(v))*np.sin(u),.12*np.sin(v)],axis=-1)
 points=points@rotation(t*.35+offset,.7+.3*math.sin(t)).T*scale
 points[:,:,0]+=offset*.48
 polys=[]
 light=np.array([-.3,-.6,1]);light/=np.linalg.norm(light)
 for i in range(nu):
  for j in range(nv):
   p=np.array([points[i,j],points[(i+1)%nu,j],points[(i+1)%nu,(j+1)%nv],points[i,(j+1)%nv]])
   normal=np.cross(p[1]-p[0],p[3]-p[0]);normal/=np.linalg.norm(normal)
   if normal[2]<0:normal=-normal
   diffuse=max(0,float(normal@light));spec=max(0,float(normal@np.array([-.15,-.1,.983])))**24
   tone=min(255,60+diffuse*135+spec*80)
   color=(int(tone*.94),int(min(255,tone*1.01)),int(min(255,tone*1.025)))
   perspective=3.8/(3.8-p[:,2])
   xy=list(zip(W/2+p[:,0]*perspective*125,H/2+p[:,1]*perspective*125))
   polys.append((p[:,2].mean(),xy,color))
 return polys
frames=[]
for i in range(N):
 t=i/N*2*math.pi
 img=Image.fromarray(bg.copy());draw=ImageDraw.Draw(img)
 # Fine orbital guides belong to the abstract scene, not financial charts.
 draw.ellipse((95,32,563,389),outline=(39,73,73),width=1)
 draw.ellipse((61,79,597,344),outline=(29,62,64),width=1)
 polys=mesh(t,-.55,1.02)+mesh(-t,.9,.56)
 for z,xy,color in sorted(polys,key=lambda p:p[0]):draw.polygon(xy,fill=color)
 draw.text((27,28),'N O G H R E X   /   S I L V E R   I N   M O T I O N',fill=(134,170,163))
 draw.text((W-138,H-32),'PURE PERSPECTIVE',fill=(134,170,163))
 frames.append(img)
frames[0].save(OUT/'silver-motion-poster.png',optimize=True)
small=[im.resize((320,210),Image.Resampling.LANCZOS) for im in frames[::3]]
small[0].save(OUT/'silver-motion.gif',save_all=True,append_images=small[1:],duration=125,loop=0,optimize=True)
def vint(n):
 for width in range(1,9):
  if n<(1<<(7*width))-1:return (n|(1<<(7*width))).to_bytes(width,'big')
def element(tag,data):return bytes.fromhex(tag)+vint(len(data))+data
def uint(tag,n):return element(tag,n.to_bytes(max(1,(n.bit_length()+7)//8),'big'))
def string(tag,s):return element(tag,s.encode())
header=element('1a45dfa3',uint('4286',1)+uint('42f7',1)+uint('42f2',4)+uint('42f3',8)+string('4282','webm')+uint('4287',2)+uint('4285',2))
info=element('1549a966',uint('2ad7b1',1000000)+string('4d80','NOGHREX motion renderer')+string('5741','NOGHREX')+element('4489',struct.pack('>d',N/FPS*1000)))
track=element('1654ae6b',element('ae',uint('d7',1)+uint('73c5',1)+uint('83',1)+string('86','V_VP8')+uint('23e383',round(1e9/FPS))+element('e0',uint('b0',W)+uint('ba',H))))
blocks=[]
for i,im in enumerate(frames):
 b=BytesIO();im.save(b,format='WEBP',quality=80,method=4);raw=b.getvalue();pos=12;vp8=None
 while pos<len(raw):
  tag=raw[pos:pos+4];size=int.from_bytes(raw[pos+4:pos+8],'little');chunk=raw[pos+8:pos+8+size]
  if tag==b'VP8 ':vp8=chunk;break
  pos+=8+size+(size%2)
 if vp8 is None:raise RuntimeError('Expected lossy VP8 WebP frame')
 blocks.append(element('a3',b'\x81'+struct.pack('>h',round(i/FPS*1000))+b'\x80'+vp8))
cluster=element('1f43b675',uint('e7',0)+b''.join(blocks))
(OUT/'silver-motion.webm').write_bytes(header+element('18538067',info+track+cluster))
print({p.name:p.stat().st_size for p in OUT.glob('silver-motion*')})
