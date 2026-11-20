/* Clean redrawn HUD. All artwork is newly generated, not screenshot cutouts. */
(function installRedrawnHud(){
'use strict';
const atlasLayout={"bossBar": {"atlas": "frames", "rect": [53, 106, 676, 48]}, "playerBar": {"atlas": "frames", "rect": [813, 98, 669, 65]}, "timer": {"atlas": "frames", "rect": [196, 330, 412, 117]}, "badge": {"atlas": "frames", "rect": [1046, 258, 196, 245]}, "portraitRing": {"atlas": "frames", "rect": [278, 540, 211, 209]}, "slot": {"atlas": "frames", "rect": [1025, 520, 238, 236]}, "star": {"atlas": "frames", "rect": [295, 792, 177, 191]}, "keycap": {"atlas": "frames", "rect": [1038, 835, 210, 118]}, "portrait0": {"atlas": "icons", "rect": [145, 8, 283, 301]}, "portrait1": {"atlas": "icons", "rect": [616, 0, 303, 311]}, "portrait2": {"atlas": "icons", "rect": [1107, 8, 298, 302]}, "attack0": {"atlas": "icons", "rect": [135, 339, 269, 212]}, "attack1": {"atlas": "icons", "rect": [625, 330, 257, 219]}, "attack2": {"atlas": "icons", "rect": [1182, 330, 161, 234]}, "e0": {"atlas": "icons", "rect": [135, 613, 279, 171]}, "e1": {"atlas": "icons", "rect": [661, 590, 190, 195]}, "e2": {"atlas": "icons", "rect": [1116, 586, 266, 202]}, "dodge": {"atlas": "icons", "rect": [175, 827, 229, 168]}, "q": {"atlas": "icons", "rect": [664, 817, 208, 177]}, "element": {"atlas": "icons", "rect": [1154, 831, 212, 163]}};
const config={
  score:0,
  topInset:8,playerBarLift:42,
  portraitOrder:[0,1,2],
  layout:{scoreScale:.65,portraitScale:.80,actionScale:.78,healthScale:.82,margin:14,portraitBottom:48,actionBottom:49,healthBottom:32},
  // 보스 HUD (타이머 + 보스 문장·단계·이름·체력바·남은 체력줄 수) 배치.
  // timer...와 groupY는 960x600 화면 기준 픽셀 (화면이 커지면 같은 비율로 커짐). 카메라 배율이나 맵 크기와는 상관없음
  bossHud:{
   timerY:20,        // 타이머의 세로 중심
   timerH:20,        // 타이머 바탕의 높이
   timerFont:11.5,   // 타이머 숫자 크기
   timerGap:.22,     // 시계 그림과 숫자 사이 간격 (타이머 높이의 비율)
   timerPad:.30,     // (v168부터 안 씀 : 숫자 오른쪽 여백은 시계 왼쪽 여백과 같게 자동)
   timerClockScale:.9,   // 시계 아이콘 크기 (원래 그림 = 1). 둥근 끝 안에 여백이 남게 조금 줄임
   timerPadR:.14,        // 숫자 오른쪽에 더하는 여백 (타이머 높이의 비율)
   timerTextDY:-1.1,     // 숫자 세로 위치 보정 (- = 위로). 바탕 그림의 검은 안쪽이 바깥 테두리보다 약 1px 위에 있어서 그 가운데에 맞춤 (사용자 '조금 아래' 의견)
   timerTextDX:-1.2,     // 숫자 가로 위치 보정 (- = 왼쪽으로). 바탕 길이는 그대로 (사용자 '살짝 왼쪽' 의견)
   groupY:52,        // 보스 묶음 전체의 세로 기준. 예전 64에서 화면 높이의 2%(12)만큼 올림
   groupScale:.85,   // 보스 묶음 전체의 크기
   barDX:-12,        // 문장 그림을 기준으로 체력바를 왼쪽(-)으로 붙인 양 (그림 단위). 0 = 예전 위치
   barDY:-10.6,      // 문장 그림을 기준으로 체력바를 위(-)로 올린 양. 체력바의 뾰족한 왼쪽 끝이 문장과 단계 칸 사이에 끼워짐
   nameDX:26,        // 보스 이름이 시작하는 곳 : 체력바 왼쪽 끝에서 이만큼 (체력바 윗변이 시작하는 자리)
   nameSize:30,      // 보스 이름 글자 크기
   countSize:25      // 남은 체력줄 수(×N) 글자 크기
  }
};
const textures={};
for(const name of ['frames','icons']){
  const item={img:new Image(),ready:false,failed:false};
  item.img.onload=()=>{item.ready=true;};
  item.img.onerror=()=>{item.failed=true;console.error('[Redrawn HUD]',name+' atlas failed');};
  item.img.src='redrawn_ui/'+name+'_atlas.png?v=compact-1';
  textures[name]=item;
}
function status(){return{total:2,loaded:Object.values(textures).filter(a=>a.ready).length,failed:Object.entries(textures).filter(([,a])=>a.failed).map(([n])=>n)};}
// ----- 캐릭터별 Q·E 문양 : 몬길게임 폴더의 character_skill_icons_sheet.png (3열 × 2행. 윗줄 = Q, 아랫줄 = E) -----
//   시트의 열 순서는 오필리아·지원·프란시스 → 게임 번호(1번 오필리아, 2번 프란시스, 3번 지원)로는 colOf = [0, 2, 1]
//   불러올 때 한 번만 : 투명도 8 미만의 잔여 픽셀을 지운 사본을 만들고, 칸마다 실제 문양의 영역과 '마름모 반지름'(가운데에서 |가로|+|세로|가 가장 먼 픽셀)을 잼
//   → 그릴 때는 그 반지름이 다이아몬드 안쪽(inset만큼 여유)에 딱 맞게 키움. 비율 유지, 뾰족한 끝이 잘리지 않고 여섯 문양의 크기가 비슷해 보임
//   원본 파일은 바꾸지 않음. 파일을 직접 열어 픽셀을 못 읽으면 칸 전체를 씀. 문양을 다 불러오기 전에는 예전 문양이 나옴
const SKILL_GLYPH={file:'character_skill_icons_sheet.png',cols:3,rows:2,colOf:[0,2,1],cut:8,inset:10};   // inset = 다이아몬드 반지름에서 남기는 여유 (클수록 문양이 작아짐. 임시값)
const glyph={img:null,ready:false,cells:null};
(function loadSkillGlyphs(){
 const img=new Image();
 img.onload=()=>{
  const W=img.naturalWidth,H=img.naturalHeight,cw=W/SKILL_GLYPH.cols,ch=H/SKILL_GLYPH.rows;
  let c=null,d=null;
  try{
   c=document.createElement('canvas');c.width=W;c.height=H;
   const g=c.getContext('2d');g.drawImage(img,0,0);d=g.getImageData(0,0,W,H);
   for(let i=3;i<d.data.length;i+=4)if(d.data[i]<SKILL_GLYPH.cut){d.data[i]=0;}
   g.putImageData(d,0,0);
  }catch(e){c=null;d=null;}
  const cells=[];
  for(let r=0;r<SKILL_GLYPH.rows;r++)for(let col=0;col<SKILL_GLYPH.cols;col++){
   const x0=Math.round(col*cw),y0=Math.round(r*ch),x1=Math.round((col+1)*cw),y1=Math.round((r+1)*ch);
   let cell={sx:x0,sy:y0,sw:x1-x0,sh:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2,l1:Math.min(x1-x0,y1-y0)/2};
   if(d){
    let minx=1e9,maxx=-1,miny=1e9,maxy=-1;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(d.data[(y*W+x)*4+3]>=40){if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;}
    if(maxx>=0){
     const cx=(minx+maxx)/2,cy=(miny+maxy)/2;let l1=1;
     for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++)if(d.data[(y*W+x)*4+3]>=40){const v=Math.abs(x-cx)+Math.abs(y-cy);if(v>l1)l1=v;}
     const pad=4,sx=Math.max(x0,minx-pad),sy=Math.max(y0,miny-pad);
     cell={sx:sx,sy:sy,sw:Math.min(x1,maxx+pad+1)-sx,sh:Math.min(y1,maxy+pad+1)-sy,cx:cx,cy:cy,l1:l1};
    }
   }
   cells.push(cell);
  }
  glyph.img=c||img;glyph.cells=cells;glyph.ready=true;
 };
 img.onerror=()=>{console.error('[Redrawn HUD] skill glyph sheet failed: '+SKILL_GLYPH.file+' (예전 문양을 그대로 씁니다)');};
 img.src=encodeURI(SKILL_GLYPH.file);
})();
// row = 0(Q) / 1(E), who = 게임 캐릭터 번호, D = 문양의 마름모 반지름을 맞출 크기
function drawSkillGlyph(row,who,cx,cy,D,alpha){
 const cell=glyph.cells[row*SKILL_GLYPH.cols+SKILL_GLYPH.colOf[who]],k=D/cell.l1;
 ctx.save();ctx.globalAlpha*=alpha;
 ctx.drawImage(glyph.img,cell.sx,cell.sy,cell.sw,cell.sh,cx+(cell.sx-cell.cx)*k,cy+(cell.sy-cell.cy)*k,cell.sw*k,cell.sh*k);
 ctx.restore();
}
const api=window.HUD_REFERENCE={configuration:config,status,lastFrame:null,atlasLayout,artwork:'newly_generated'};
window.HUD_REDRAWN=api;
function polygon(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();}
function text(s,x,y,size=22,align='left',color='#fff',family='"Noto Sans KR","Malgun Gothic",Arial,sans-serif'){
 ctx.save();ctx.font='bold '+size+'px '+family;ctx.textAlign=align;ctx.textBaseline='middle';
 ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.85)';ctx.strokeText(String(s),x,y);ctx.fillStyle=color;ctx.fillText(String(s),x,y);ctx.restore();
}
function sprite(name,x,y,w,h,alpha=1){
 const a=atlasLayout[name],t=textures[a.atlas];if(!t.ready)return;
 ctx.save();ctx.globalAlpha*=alpha;ctx.drawImage(t.img,...a.rect,x,y,w,h);ctx.restore();
}
function fit(name,cx,cy,maxW,maxH,alpha=1){
 const a=atlasLayout[name],r=Math.min(maxW/a.rect[2],maxH/a.rect[3]);
 sprite(name,cx-a.rect[2]*r/2,cy-a.rect[3]*r/2,a.rect[2]*r,a.rect[3]*r,alpha);
}
function key(label,cx,cy){
 const w=label.length>1?63:32;
 sprite('keycap',cx-w/2,cy-13,w,26);
 text(label,cx,cy, label.length>1?18:23,'center','#efe7d4','Arial,"Noto Sans KR","Malgun Gothic",sans-serif');
}
function bar(name,x,y,w,h,hp,shown,max,color){
 sprite(name,x,y,w,h);
 const top=name==='bossBar'?.28:.31,bottom=name==='bossBar'?.72:.70;
 const points=[[x+w*.037,y+h*top],[x+w*.961,y+h*top],[x+w*.977,y+h*.5],[x+w*.961,y+h*bottom],[x+w*.037,y+h*bottom],[x+w*.021,y+h*.5]];
 const v=Math.max(0,Math.min(1,hp/max)),trail=Math.max(v,Math.min(1,shown/max));
 ctx.save();polygon(points);ctx.clip();ctx.fillStyle='#101923';ctx.fillRect(x,y,w,h);
 ctx.fillStyle='#b8414d';ctx.fillRect(x,y,w*trail,h);
 const g=ctx.createLinearGradient(0,y+h*top,0,y+h*bottom);g.addColorStop(0,color);g.addColorStop(1,'#069676');
 ctx.fillStyle=g;ctx.fillRect(x,y,w*v,h);ctx.restore();
}
// 보스 체력바 : 긴 바 하나에 여러 체력줄이 겹친 방식. 지금 줄이 깎인 자리에는 밑에 깔린 다음 줄의 색이 보임.
// 줄 수·남은 줄·색은 index.html의 bossBarInfo()가 계산함 (색 목록 = BOSS_BAR_COLORS)
function shade(hex,k){
 const n=parseInt(hex.slice(1),16);
 return 'rgb('+Math.round((n>>16&255)*k)+','+Math.round((n>>8&255)*k)+','+Math.round((n&255)*k)+')';
}
function bossBar(x,y,w,h){
 const info=bossBarInfo();
 sprite('bossBar',x,y,w,h);
 const top=.28,bottom=.72;
 const points=[[x+w*.037,y+h*top],[x+w*.961,y+h*top],[x+w*.977,y+h*.5],[x+w*.961,y+h*bottom],[x+w*.037,y+h*bottom],[x+w*.021,y+h*.5]];
 function layer(color,part){
  const g=ctx.createLinearGradient(0,y+h*top,0,y+h*bottom);g.addColorStop(0,color);g.addColorStop(1,shade(color,.6));
  ctx.fillStyle=g;ctx.fillRect(x,y,w*part,h);
 }
 ctx.save();polygon(points);ctx.clip();ctx.fillStyle='#101923';ctx.fillRect(x,y,w,h);
 if(info.nextColor){layer(info.nextColor,1);ctx.fillStyle='rgba(6,10,18,.32)';ctx.fillRect(x,y,w,h);}
 ctx.fillStyle='#f6f1df';ctx.fillRect(x,y,w*info.trail,h);
 layer(info.color,info.fill);
 if(info.fill>0&&info.fill<1){ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillRect(x+w*info.fill-2,y,2,h);}
 ctx.restore();
 return info;
}
// 점수 별 : 채워진 별은 금색, 아직 안 채워진 별은 흐린 회색. 채워진 개수는 index.html의 scoreStars()가 계산함 (SCORE_PER_STAR점당 1개)
// 금색 별은 별 그림(회색)에 금색을 입힌 사본을 한 번만 만들어 두고 씀
let goldStar=null;
function goldStarImage(){
 if(goldStar)return goldStar;
 const t=textures.frames;if(!t.ready)return null;
 const r=atlasLayout.star.rect,c=document.createElement('canvas');c.width=r[2];c.height=r[3];
 const g=c.getContext('2d');g.drawImage(t.img,r[0],r[1],r[2],r[3],0,0,r[2],r[3]);
 g.globalCompositeOperation='source-in';
 const grad=g.createLinearGradient(0,0,0,r[3]);grad.addColorStop(0,'#fff3b0');grad.addColorStop(.5,'#ffcf45');grad.addColorStop(1,'#e8941a');
 g.fillStyle=grad;g.fillRect(0,0,r[2],r[3]);
 goldStar=c;return c;
}
function scoreStar(cx,cy,w,h,filled){
 if(!filled){fit('star',cx,cy,w,h,.43);return;}
 const img=goldStarImage();if(!img){fit('star',cx,cy,w,h,1);return;}
 const k=Math.min(w/img.width,h/img.height),dw=img.width*k,dh=img.height*k;
 ctx.save();ctx.shadowColor='rgba(255,196,60,.9)';ctx.shadowBlur=6;ctx.drawImage(img,cx-dw/2,cy-dh/2,dw,dh);ctx.restore();
}
function topButton(cx,cy,kind){
 ctx.save();ctx.translate(cx,cy);polygon([[0,-31],[30,0],[0,31],[-30,0]]);ctx.fillStyle='rgba(18,23,32,.7)';ctx.fill();
 ctx.lineWidth=2;ctx.strokeStyle='#aeb5c5';ctx.stroke();ctx.strokeStyle='#e5e9ee';ctx.lineWidth=2.5;
 if(kind==='target'){
  ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-24,0);ctx.lineTo(-8,0);ctx.moveTo(8,0);ctx.lineTo(24,0);ctx.moveTo(0,-24);ctx.lineTo(0,-8);ctx.moveTo(0,8);ctx.lineTo(0,24);ctx.stroke();
 }else{
  ctx.strokeRect(-12,-18,20,36);ctx.beginPath();ctx.moveTo(3,0);ctx.lineTo(23,0);ctx.moveTo(16,-7);ctx.lineTo(23,0);ctx.lineTo(16,7);ctx.stroke();
 }
 ctx.restore();key(kind==='target'?'F12':'Esc',cx,cy+46);
}
function drawTop(k,ox){
 ctx.save();ctx.translate(ox,config.topInset);ctx.scale(k,k);
 // Top-left scoreboard.
 ctx.fillStyle='rgba(8,12,24,.66)';ctx.fillRect(31,67,316,132);
 const accent=ctx.createLinearGradient(0,67,0,199);accent.addColorStop(0,'#b56df0');accent.addColorStop(1,'#67dbe8');ctx.fillStyle=accent;ctx.fillRect(26,67,4,132);
 fit('star',27,43,27,29);text(BOSS_NAME,50,44,23);
 for(let row=0;row<2;row++)for(let col=0;col<10;col++){
   const i=row*10+col;scoreStar(52+31*col,88+22*row,30,31,i<scoreStars());
 }
 ctx.save();ctx.font='bold 58px Impact,"Arial Narrow",sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
 const scoreG=ctx.createLinearGradient(0,128,0,185);scoreG.addColorStop(0,'#b892ff');scoreG.addColorStop(.52,'#dae1ff');scoreG.addColorStop(1,'#65b7ef');
 ctx.strokeStyle='#0c1024';ctx.lineWidth=3;var shownScore=(typeof battleScore==='function'?battleScore():Math.floor(totalDamage)).toLocaleString('en-US');/* 총합 점수 = 피해량 × SCORE_PER_DAMAGE + 미션 점수 (index.html의 battleScore) */ctx.strokeText(shownScore,45,158);ctx.fillStyle=scoreG;ctx.fillText(shownScore,45,158);ctx.restore();
 // Timer, boss badge and HP are all registered from the game screen top edge.
 sprite('timer',845,10,270,77);
 text(formatBattleTime(battleTime),934,50,28,'left',battleTime>0?'#fff':'#ffabab','"Arial Narrow",Arial,sans-serif');
 text(BOSS_NAME,741,110,25);
 const bars=bossBar(716,125,620,44);
 // Empty auxiliary gauge; its gameplay rule has not been implemented.
 ctx.strokeStyle='#9ba3b4';ctx.lineWidth=1;polygon([[727,175],[1324,175],[1315,181],[720,181]]);ctx.fillStyle='rgba(11,17,26,.75)';ctx.fill();ctx.stroke();
 sprite('badge',644,70,85,106);text(combatStage,686,156,25,'center');
 text('×'+bars.left,1338,111,25,'right');
 fit('element',1295,203,67,51);
 topButton(1740,46,'target');topButton(1830,46,'exit');
 ctx.restore();
}
// ----- 스킬 표시 (값은 모두 index.html의 skillHudState()에서 읽음. 여기서는 그리기만 함) -----
// 작은 이름표 여러 개를 가로로 나란히. items = [{label, color}], align = 'center'(cx가 가운데) 또는 'left'(cx가 왼쪽 끝)
function chips(cx,y,items,size,align){
 if(!items.length)return;
 ctx.save();ctx.font='bold '+size+'px "Noto Sans KR","Malgun Gothic",Arial,sans-serif';
 const pad=size*.5,gap=size*.4,h=size*1.5;
 const widths=items.map(function(it){return ctx.measureText(it.label).width+pad*2;});
 let total=gap*(items.length-1);for(const w of widths)total+=w;
 let x=align==='left'?cx:cx-total/2;
 items.forEach(function(it,i){
  ctx.fillStyle='rgba(8,12,22,.78)';ctx.fillRect(x,y-h/2,widths[i],h);
  ctx.fillStyle=it.color;ctx.fillRect(x,y+h/2-3,widths[i],3);
  text(it.label,x+widths[i]/2,y,size,'center',it.color);
  x+=widths[i]+gap;
 });
 ctx.restore();
}
// 우리 쪽 강화 효과 : 플레이어 체력바 위에 이름과 남은 초
function buffChips(cx,y){
 const S=skillHudState(),items=[];
 if(current===0&&S.ice>0)items.push({label:'얼음 강화 '+Math.ceil(S.ice),color:ELEMENT_COLOR.ice});
 for(const b of S.buffs)items.push({label:b.label+' '+Math.ceil(b.t),color:b.color});
 chips(cx,y,items,24,'center');
}
// 보스에게 걸린 약화 : 보스 체력바 아래에 이름과 남은 초. 2번 평타가 쌓인 횟수도 여기에 표시
function debuffChips(x,y){
 const S=skillHudState(),items=[];
 for(const k of ['ice','earth','wind'])if(S.debuffs[k]>0)items.push({label:ELEMENT_NAME[k]+' 약화 '+Math.ceil(S.debuffs[k]),color:ELEMENT_COLOR[k]});
 if(S.fever>0)items.push({label:'약효 '+S.fever+'/'+S.feverMax,color:'#ffb35a'});
 chips(x,y,items,24,'left');
}
// 동그란 점 여러 개 (filled개까지 채워짐)
function pips(cx,y,count,filled,color){
 for(let i=0;i<count;i++){
  const x=cx+(i-(count-1)/2)*24;
  ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);
  ctx.fillStyle=i<filled?color:'rgba(10,16,28,.85)';ctx.fill();
  ctx.lineWidth=2.5;ctx.strokeStyle=i<filled?'#ffffff':'#7f8aa0';ctx.stroke();
 }
}
// E 칸의 추가 표시.
//  1번 : E를 이어 쓰는 동안 = 점 3개(몇 단까지 썼는지) + 칸 둘레의 밝은 선(다음 단을 이어 쓸 수 있는 남은 시간).
//        끝나면 점과 선이 사라지고 칸에 대기시간 숫자가 나옴
//  3번 : 모은 선율 개수
function skillMarks(S){
 const cx=1617,cy=983,r=40;
 if(current===0&&S.eStage>0){
  pips(cx,cy-r-18,3,S.eStage,'#8fd6ff');
  ctx.save();ctx.strokeStyle='#bfe9ff';ctx.lineWidth=6;ctx.lineCap='round';ctx.shadowColor='#8fd6ff';ctx.shadowBlur=10;
  ctx.beginPath();ctx.arc(cx,cy,r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(.001,Math.min(1,S.eWindow/S.eWindowMax)));ctx.stroke();ctx.restore();
 }else if(current===2){
  pips(cx,cy-r-18,S.melodyMax,S.melody,'#9dffd0');
 }
}
function portrait(i,cx,cy,slotIdx){   // i = 캐릭터 번호, slotIdx = 편성 슬롯(숫자키). 슬롯이 없으면 캐릭터 번호 그대로
 const active=current===i;
 sprite('portraitRing',cx-48,cy-48,96,96,active?1:.72);
 const source=atlasLayout['portrait'+config.portraitOrder[i]],t=textures.icons;
 if(t.ready){
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,39.5,0,Math.PI*2);ctx.clip();
  const scale=Math.max(80/source.rect[2],80/source.rect[3]);
  const w=source.rect[2]*scale,h=source.rect[3]*scale;
  ctx.drawImage(t.img,...source.rect,cx-w/2,cy-h/2,w,h);
  if(!active){ctx.fillStyle='rgba(8,12,22,.42)';ctx.fillRect(cx-41,cy-41,82,82);}ctx.restore();   // 쉬고 있는 캐릭터는 더 어둡게 → 출전 캐릭터가 또렷이 구분됨
 }
 // 교체 대기 중 : 초상화를 어둡게 하고 남은 초를 표시. 대기가 끝나면 둘 다 사라짐 (party = index.html의 캐릭터별 상태)
 // 대기시간은 새로 나온 캐릭터에게 걸리므로, 출전 중이든 쉬고 있든 대기시간이 남아 있으면 똑같이 어둡게 함
 // (출전 중인 캐릭터는 아래의 밝은 테두리로 구분됨)
 const pc=party[i],cooling=pc.swapCd>0;
 if(cooling){
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,39.5,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='rgba(4,8,16,.68)';ctx.fillRect(cx-41,cy-41,82,82);ctx.restore();
 }
 if(cooling){
  ctx.save();ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=6;   // 밝은 초상화 위에서도 숫자가 읽히게 어두운 그림자를 둠
  text(Math.ceil(pc.swapCd),cx,cy+1,36,'center','#ffffff','Arial,"Noto Sans KR","Malgun Gothic",sans-serif');
  ctx.restore();
 }
 if(active){ctx.save();ctx.shadowColor='#65eadf';ctx.shadowBlur=14;ctx.strokeStyle='#91fff0';ctx.lineWidth=4;   // 출전 중인 캐릭터 : 밝은 테두리를 굵게
 ctx.beginPath();ctx.arc(cx,cy,44,0,Math.PI*2);ctx.stroke();ctx.restore();}
 ctx.fillStyle='#061119';ctx.fillRect(cx-36,cy+35,73,13);
 ctx.fillStyle='#1cc2a0';ctx.fillRect(cx-34,cy+38,69*Math.max(0,Math.min(1,pc.hp/pc.maxHp)),7);   // 이 캐릭터 자신의 남은 체력
 if(pc.healFx>0){   // 방금 회복함 : 초상화 둘레가 잠깐 초록으로 빛남
  ctx.save();ctx.globalAlpha*=Math.min(1,pc.healFx/.3);ctx.strokeStyle='#8dffb0';ctx.lineWidth=4;ctx.shadowColor='#8dffb0';ctx.shadowBlur=12;
  ctx.beginPath();ctx.arc(cx,cy,44,0,Math.PI*2);ctx.stroke();ctx.restore();
 }
 key(String((slotIdx===undefined?i:slotIdx)+1),cx,cy+72);
}
// 궁극기 준비 완료 표시 (hud v178, 사용자 '쿨타임이 아닐 땐 금빛으로 빛나게, 움직여야 해'). 보이기만 함 (규칙과 무관). 값은 모두 임시값
//   숨쉬듯 밝아지는 금빛 테두리 + 바깥으로 퍼지며 사라지는 둘째 테두리 + 테두리를 따라 도는 밝은 빛 두 개 + 왼쪽 아래 금빛 선
const ULT_GLOW={size:.86,pulse:1.6,ripple:1.6,ripplePush:14,lap:2.4,tail:12,gold:'#ffd56a',hot:'#fff4c8'};
function ultReadyGlow(cx,cy,r){
 const G=ULT_GLOW,t=performance.now()/1000,R=r*G.size;
 const p=.5+.5*Math.sin(t*Math.PI*2/G.pulse);                 // 0~1 숨쉬기
 const dia=function(d){polygon([[cx,cy-d],[cx+d,cy],[cx,cy+d],[cx-d,cy]]);};
 ctx.save();
 ctx.save();dia(R);ctx.clip();                                  // 칸 안쪽이 은은하게 금빛
 const g=ctx.createRadialGradient(cx,cy,R*.2,cx,cy,R);g.addColorStop(0,'rgba(255,214,110,0)');g.addColorStop(1,'rgba(255,200,80,'+(.10+.14*p)+')');
 ctx.fillStyle=g;ctx.fillRect(cx-R,cy-R,R*2,R*2);ctx.restore();
 ctx.shadowColor=G.gold;ctx.shadowBlur=8+12*p;ctx.strokeStyle=G.gold;ctx.lineWidth=3;dia(R);ctx.stroke();   // 금빛 테두리
 ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,244,200,'+(.45+.45*p)+')';ctx.lineWidth=1.2;dia(R-3.5);ctx.stroke();
 const k=(t%G.ripple)/G.ripple;                                 // 바깥으로 퍼지며 사라지는 테두리
 ctx.save();ctx.globalAlpha*=(1-k)*(1-k)*.85;ctx.strokeStyle=G.gold;ctx.lineWidth=2;dia(R+3+k*G.ripplePush);ctx.stroke();ctx.restore();
 const edge=[[cx,cy-R],[cx+R,cy],[cx,cy+R],[cx-R,cy]];         // 테두리 위의 점 (u = 0~4, 꼭짓점 하나에 1씩)
 const at=function(u){u=((u%4)+4)%4;const i=Math.floor(u),f=u-i,a=edge[i],b=edge[(i+1)%4];return[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];};
 ctx.globalCompositeOperation='lighter';ctx.shadowColor=G.gold;ctx.shadowBlur=10;
 const head=(t/G.lap)*4;
 for(const off of [0,2])for(let i=0;i<G.tail;i++){             // 마주 보는 빛 두 개가 꼬리를 끌며 돔
  const q=at(head+off-i*.035);ctx.fillStyle=i?'rgba(255,214,110,'+(.55*(1-i/G.tail))+')':G.hot;
  ctx.beginPath();ctx.arc(q[0],q[1],i?2.6*(1-i/G.tail)+.8:3.2,0,Math.PI*2);ctx.fill();
 }
 ctx.globalCompositeOperation='source-over';ctx.shadowBlur=6+6*p;ctx.lineCap='round';   // 왼쪽 아래 바깥의 짧은 금빛 선 (참고 사진처럼)
 const o=8,a=at(2.25),b=at(2.75);ctx.strokeStyle=G.gold;ctx.lineWidth=3;
 ctx.beginPath();ctx.moveTo(a[0]-o*.707,a[1]+o*.707);ctx.lineTo(b[0]-o*.707,b[1]+o*.707);ctx.stroke();
 ctx.restore();
}
function slot(name,cx,cy,r,icon,enabled,left,total,keyLabel){
 sprite('slot',cx-r,cy-r,r*2,r*2,enabled?1:.62);
 if(icon&&icon.glyph!==undefined){   // Q·E : 캐릭터별 새 문양 (다 불러오기 전에는 예전 문양 하나만 나옴 → 둘이 겹치지 않음)
  if(glyph.ready)drawSkillGlyph(icon.glyph,current,cx,cy,r-SKILL_GLYPH.inset,enabled?1:.36);
  else fit(icon.old,cx,cy,r*1.16,r*1.34,enabled?1:.36);
 }else if(icon)fit(icon,cx,cy,r*1.16,r*1.34,enabled?1:.36);
 if(enabled&&left>0){
  ctx.save();polygon([[cx,cy-r+8],[cx+r-8,cy],[cx,cy+r-8],[cx-r+8,cy]]);ctx.clip();
  ctx.fillStyle='rgba(6,10,22,.72)';ctx.beginPath();ctx.moveTo(cx,cy);
  ctx.arc(cx,cy,r*1.5,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,left/Math.max(.001,total)));ctx.closePath();ctx.fill();ctx.restore();
  text(left.toFixed(1),cx,cy,26,'center');
 }
 if(name==='q'&&enabled&&!(left>0))ultReadyGlow(cx,cy,r);   // 궁극기 대기시간이 끝났으면 금빛으로 빛남 (hud v178)
 key(keyLabel,cx,1044);
}
function drawBottom(k,ox,oy){
 ctx.save();ctx.translate(ox,oy);ctx.scale(k,k);
 // Party symbol is drawn cleanly at runtime.
 ctx.save();ctx.translate(87,980);ctx.fillStyle='#e6edf6';
 for(const p of [[-11,0],[9,-6],[0,12]]){ctx.beginPath();ctx.arc(p[0],p[1]-9,7,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(p[0],p[1]+3,10,6,0,0,Math.PI*2);ctx.fill();}
 ctx.restore();
 [196,291,391].forEach(function(px,s){portrait(typeof partySlotChar==='function'?partySlotChar(s):s,px,977,s);});   // 편성 순서대로 (슬롯 → 캐릭터)
 // Lift only the middle player HP group, independently of portraits/actions.
 const y=977-config.playerBarLift;
 bar('playerBar',800,y,355,35,player.hp,player.shownHp,party[current].maxHp,'#40d8b4');   // 지금 출전 중인 캐릭터의 체력
 text(Math.ceil(player.hp)+' / '+party[current].maxHp,978,y+17,21,'center');
 buffChips(978,y-24);   // 강화 효과 이름표
 ctx.save();ctx.translate(731,y+17);ctx.beginPath();ctx.arc(0,0,29,0,Math.PI*2);ctx.fillStyle='rgba(119,49,20,.8)';ctx.fill();ctx.strokeStyle='#ed9f46';ctx.lineWidth=2;ctx.stroke();ctx.restore();
 // Reuse the newly drawn crest face from its atlas; do not use screenshot fragments.
 const b=atlasLayout.badge,t=textures.frames;
 if(t.ready)ctx.drawImage(t.img,b.rect[0],b.rect[1],b.rect[2],b.rect[3]*.68,708,y-8,46,50);
 const set=CHARACTER_UI[current],cd=skillCooldowns[current];
 const S=skillHudState();   // 스킬 상태 (index.html)
 slot('q',1528,985,44,{glyph:0,old:'q'},set.skillQ.enabled,S.ultLeft,S.ultTotal,'Q');            // 궁극기 : 캐릭터별 Q 문양, 남은 대기시간
 slot('e',1617,983,40,{glyph:1,old:'e'+current},set.skillE.enabled,S.eLeft,S.eTotal,'E');      // E 스킬 : 캐릭터별 E 문양, 남은 대기시간
 skillMarks(S);
 slot('attack',1719,981,53,'attack'+current,true,player.attackCd,ATTACK_COOLDOWN,'좌클릭');
 slot('dodge',1822,983,40,'dodge',true,player.cooldown,DODGE_COOLDOWN,'Space');
 ctx.restore();
}

// 그림을 3조각으로 그리기 : 왼쪽 끝(capL)과 오른쪽 끝(capR)은 비율 그대로 두고, 가운데만 가로로 늘리거나 줄임 (capL·capR = 그림 픽셀)
function sprite3(name,x,y,w,h,capL,capR){
 const a=atlasLayout[name],t=textures[a.atlas];if(!t.ready)return;
 const r=a.rect,k=h/r[3],l=capL*k,rr=capR*k;
 ctx.drawImage(t.img,r[0]+capL,r[1],r[2]-capL-capR,r[3],x+l-.5,y,w-l-rr+1,h);
 ctx.drawImage(t.img,r[0],r[1],capL,r[3],x,y,l,h);
 ctx.drawImage(t.img,r[0]+r[2]-capR,r[1],capR,r[3],x+w-rr,y,rr,h);
}
// 타이머 : (cx, cy)가 가운데. 표시 형식과 시간 계산은 그대로 (formatBattleTime, battleTime)
// v168 정렬 (사용자 요청 : 시계 아이콘·검은 바탕·숫자가 서로 안 맞음)
//   원래 그림은 시계가 왼쪽 둥근 끝의 중심보다 오른쪽(18px)에 그려져 있어 둥근 끝과 시계 고리가 어긋나 보였음 →
//   바탕은 시계가 없는 오른쪽 끝을 좌우로 뒤집어 왼쪽 끝으로 쓰고, 시계는 그림에서 떼어 내 왼쪽 둥근 끝과 같은 중심에 놓음.
//   숫자는 실제 글자 높이로 세로 가운데, 숫자 오른쪽 여백 = 시계 왼쪽 여백 (양쪽 대칭)
let timerClockArt=null;
function timerClock(){            // 시계 그림을 한 번만 떼어 둠 (바깥쪽은 부드럽게 투명 → 바탕과 이음새 없음)
 if(timerClockArt)return timerClockArt;
 const t=textures.frames,r=atlasLayout.timer.rect;if(!t.ready)return null;
 const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');
 g.drawImage(t.img,r[0]+28,r[1]+11,96,96,0,0,96,96);         // 시계 중심 (76, 59) 둘레 96px
 g.globalCompositeOperation='destination-in';
 const gr=g.createRadialGradient(48,48,40,48,48,45);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');   // 바탕 테두리가 섞여 들어오지 않게 45px 안쪽만
 g.fillStyle=gr;g.fillRect(0,0,96,96);
 timerClockArt=c;return c;
}
function drawTimer(cx,cy,unit){
 const G=config.bossHud,h=G.timerH*unit,k=h/117,t=textures.frames,r=atlasLayout.timer.rect;
 ctx.save();
 ctx.font='bold '+(G.timerFont*unit)+'px "Arial Narrow",Arial,sans-serif';
 ctx.textAlign='left';ctx.textBaseline='alphabetic';   // 글자 높이를 재기 전에 기준선을 먼저 정함 (안 그러면 앞에서 그린 글자의 기준선으로 재져서 숫자가 위아래로 어긋남)
 const wide=ctx.measureText('0:00.00').width;   // 숫자가 바뀌어도 바탕 길이가 흔들리지 않게 같은 자릿수의 폭으로 잼
 const m=ctx.measureText('0:00.00');
 const endC=58.5*k;                             // 둥근 끝의 중심 : 바탕 끝에서 높이의 절반 (그림에서 잰 값)
 const ringR=42*k*G.timerClockScale;            // 시계 고리 바깥 반지름 (그림 42px)
 const edge=endC-ringR;                         // 바탕 끝 ~ 시계 고리 사이 여백
 const textX=endC+ringR+G.timerGap*h;           // 숫자 시작 : 시계 고리 오른쪽 + 간격
 const w=textX+wide+edge+G.timerPadR*h;         // 숫자 오른쪽 여백 = 시계 왼쪽 여백 + 조금 (시계는 빛이 번져 보여서 숫자 쪽을 조금 더 띄움)
 const x=cx-w/2,y=cy-h/2;
 if(t.ready){
  const cap=66,cw=cap*k,sx=r[0]+r[2]-cap;
  ctx.drawImage(t.img,r[0]+180,r[1],160,r[3],x+cw-.5,y,w-cw*2+1,h);          // 가운데 (시계 없는 부분을 늘림)
  ctx.drawImage(t.img,sx,r[1],cap,r[3],x+w-cw,y,cw,h);                         // 오른쪽 둥근 끝
  ctx.save();ctx.translate(x+cw,y);ctx.scale(-1,1);ctx.drawImage(t.img,sx,r[1],cap,r[3],0,0,cw,h);ctx.restore();   // 왼쪽 둥근 끝 = 오른쪽을 뒤집음
  const ck=timerClock();
  if(ck){const s=96*k*G.timerClockScale;ctx.drawImage(ck,x+endC-s/2,cy-s/2,s,s);}   // 시계 : 왼쪽 둥근 끝과 같은 중심
 }
 ctx.textAlign='left';ctx.textBaseline='alphabetic';
 ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=2*unit;
 ctx.fillStyle=battleTime>0?'#fff':'#ffabab';
 ctx.fillText(formatBattleTime(battleTime),x+textX+G.timerTextDX*unit,cy+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2+G.timerTextDY*unit);
 ctx.restore();
 return{x:x,y:y,w:w,h:h};
}
// 단계 전환 때 보스 문장의 금빛 강조 (hud v179). 세기는 index.html의 stageFxEmblem() (0~1, 짧게 정점 → 빠르게 사라짐). 단계 숫자는 이 위에 그려져 선명함
function stageEmblemGlow(){
 const e=typeof stageFxEmblem==='function'?stageFxEmblem():0;if(e<=0)return;
 ctx.save();ctx.globalCompositeOperation='lighter';
 const g=ctx.createRadialGradient(686,112,4,686,112,74);g.addColorStop(0,'rgba(255,232,150,'+(.8*e)+')');g.addColorStop(.45,'rgba(255,196,80,'+(.4*e)+')');g.addColorStop(1,'rgba(255,170,40,0)');
 ctx.fillStyle=g;ctx.fillRect(612,38,148,148);
 ctx.globalAlpha=e;ctx.strokeStyle='#ffd877';ctx.lineWidth=2;const r=34+22*(1-e);polygon([[686,112-r],[686+r*.82,112],[686,112+r],[686-r*.82,112]]);ctx.stroke();   // 퍼지며 사라지는 금빛 마름모 테두리
 ctx.restore();
}
// 단계 숫자가 오를 때 숫자 자리가 금빛으로 반짝 (hud v185). 세기는 stageFxEmblem()과 같은 시간 (0~1)
function stageNumberSpark(){return typeof stageFxEmblem==='function'?stageFxEmblem():0;}
function stageNumberSparkFx(){
 const e=stageNumberSpark();if(e<=0)return;
 const cx=686,cy=156,t=performance.now()/1000;
 ctx.save();ctx.globalCompositeOperation='lighter';
 const g=ctx.createRadialGradient(cx,cy,2,cx,cy,30);g.addColorStop(0,'rgba(255,236,160,'+(.85*e)+')');g.addColorStop(.5,'rgba(255,200,70,'+(.4*e)+')');g.addColorStop(1,'rgba(255,170,30,0)');
 ctx.fillStyle=g;ctx.fillRect(cx-32,cy-32,64,64);
 const star=function(x,y,r,a){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();for(let i=0;i<8;i++){const rr=i%2?r*.18:r,an=i*Math.PI/4;ctx.lineTo(Math.cos(an)*rr,Math.sin(an)*rr);}ctx.closePath();ctx.fill();ctx.restore();};
 ctx.fillStyle='rgba(255,246,210,'+e+')';
 star(cx,cy,26*e+6,t*1.5);                                        // 가운데 큰 빛 (돌며 줄어듦)
 [[-17,-11,.9],[16,-14,.7],[18,10,.8],[-15,12,.6]].forEach(function(p,i){   // 둘레 작은 반짝임 (시간차로 깜빡)
  const k=Math.max(0,Math.sin(t*11+i*1.9))*e;if(k<.05)return;ctx.globalAlpha=k;star(cx+p[0]*(1.3-.3*e),cy+p[1]*(1.3-.3*e),7*p[2],0);});
 ctx.restore();
}
// 기믹이 시작할 때 보스 문장에서 짙은 빨간 불길이 화르륵 (hud v185). 상태는 index.html의 emblemFireState(). front=false : 문장 뒤 큰 불길, true : 문장 앞 옅은 불꽃
function bossEmblemFire(front){
 const s=typeof emblemFireState==='function'?emblemFireState():null;if(!s)return;
 const t=s.t,grow=Math.min(1,t/s.rise),fade=Math.min(1,Math.max(0,(s.T-t)/s.fade)),k=grow*fade;if(k<=0)return;
 // v186 사용자 '불이 좀 커, 빨간 보스 얼굴보다 아주 살짝 크게만' → 얼굴(약 x 664~708, y 86~130)을 감싸는 크기로 줄이고,
 //   문장 바탕에 가려지지 않게 불꽃은 문장 앞(front)에만 그림 (뒤는 아무것도 안 그림). 얼굴이 비쳐 보이게 반투명
 if(!front)return;
 const cx=686,base=134;
 ctx.save();
 // 불꽃 혀 하나 : 아래가 둥글고 넓게, 위로 갈수록 휘며 가늘어짐 (끝이 좌우로 일렁임)
 const tongue=function(x0,y0,w,h,sway,c0,c1,c2){
  const grad=ctx.createLinearGradient(0,y0,0,y0-h);grad.addColorStop(0,c0);grad.addColorStop(.45,c1);grad.addColorStop(1,c2);ctx.fillStyle=grad;
  ctx.beginPath();ctx.moveTo(x0-w,y0);
  ctx.bezierCurveTo(x0-w*1.15,y0-h*.35,x0-w*.3+sway*.6,y0-h*.62,x0+sway,y0-h);
  ctx.bezierCurveTo(x0+w*.45+sway*.6,y0-h*.6,x0+w*1.15,y0-h*.35,x0+w,y0);
  ctx.quadraticCurveTo(x0,y0+w*.5,x0-w,y0);ctx.closePath();ctx.fill();
 };
 const n=7, spread=50;                                            // 얼굴 폭(약 44)보다 살짝 넓게
 ctx.shadowColor='rgba(150,0,0,'+(.8*k)+')';ctx.shadowBlur=4;     // 불길 둘레가 부드럽게 번짐
 for(let i=0;i<n;i++){                                            // 위치·높이가 시간에 따라 일렁임 (난수 대신 사인값)
  const u=(i+.5)/n-.5, x0=cx+u*spread+Math.sin(t*5+i)*1.5;
  const flick=.72+.28*Math.sin(t*19+i*2.7)+.14*Math.sin(t*37+i*5.1);
  const h=74*(1-Math.abs(u)*.6)*flick*(.35+.65*grow);            // 얼굴 전체를 감싸고 위로 조금 넘침
  const w=8*(1-Math.abs(u)*.35);
  const sway=Math.sin(t*8+i*1.3)*3;
  tongue(x0,base,w,h,sway,'rgba(105,0,4,'+(.62*k)+')','rgba(165,8,8,'+(.5*k)+')','rgba(120,0,0,0)');
 }
 {                                                                // 안쪽 밝은 불씨 (짙은 빨강 속 주홍, 작게)
  ctx.shadowBlur=0;
  for(let i=0;i<n;i++){
   const u=(i+.5)/n-.5, x0=cx+u*spread+Math.sin(t*5+i)*2;
   const flick=.72+.28*Math.sin(t*19+i*2.7+.6);
   const h=58*(1-Math.abs(u)*.75)*flick*(.35+.65*grow)*.5, w=8*(1-Math.abs(u)*.35)*.45;
   tongue(x0,base,w,h,Math.sin(t*8+i*1.3)*2,'rgba(220,50,20,'+(.55*k)+')','rgba(200,30,15,'+(.35*k)+')','rgba(160,10,10,0)');
  }
 }
 ctx.restore();
}
function drawCompactLayout(){
 const unit=Math.min(W/960,H/600),base=Math.min(W/1920,H/1200),L=config.layout;   /* v276 16:9로 넓혀도(1067×600) HUD 크기는 예전(960×600)과 같게 : H/1080 → H/1200 */
 function place(x,y,factor,px,py,draw){
  ctx.save();ctx.translate(x,y);ctx.scale(base*factor,base*factor);ctx.translate(-px,-py);draw();ctx.restore();
 }
 const margin=L.margin*unit;
 place(margin,18*unit,L.scoreScale,14,28,function(){
 // Top-left scoreboard.
 ctx.fillStyle='rgba(8,12,24,.66)';ctx.fillRect(31,67,316,132);
 const accent=ctx.createLinearGradient(0,67,0,199);accent.addColorStop(0,'#b56df0');accent.addColorStop(1,'#67dbe8');ctx.fillStyle=accent;ctx.fillRect(26,67,4,132);
 fit('star',27,43,27,29);text(BOSS_NAME,50,44,23);
 for(let row=0;row<2;row++)for(let col=0;col<10;col++){
   const i=row*10+col;scoreStar(52+31*col,88+22*row,30,31,i<scoreStars());
 }
 ctx.save();ctx.font='bold 58px Impact,"Arial Narrow",sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
 const scoreG=ctx.createLinearGradient(0,128,0,185);scoreG.addColorStop(0,'#b892ff');scoreG.addColorStop(.52,'#dae1ff');scoreG.addColorStop(1,'#65b7ef');
 ctx.strokeStyle='#0c1024';ctx.lineWidth=3;var shownScore=(typeof battleScore==='function'?battleScore():Math.floor(totalDamage)).toLocaleString('en-US');/* 총합 점수 = 피해량 × SCORE_PER_DAMAGE + 미션 점수 (index.html의 battleScore) */ctx.strokeText(shownScore,45,158);ctx.fillStyle=scoreG;ctx.fillText(shownScore,45,158);ctx.restore();

 });
 // ----- 타이머 : 화면 위쪽 가운데, 보스 체력바 묶음의 위 -----
 const G=config.bossHud;
 const timerBox=drawTimer(W/2,G.timerY*unit,unit);
 // ----- 보스 묶음 : 문장 + 단계 숫자 + 이름 + 체력바 + 남은 체력줄 수. 모두 같은 기준점(groupY)을 같이 씀 -----
 // 문장 그림은 (644,70)에 두고, 체력바를 문장에 붙여서 놓음. 이름과 ×N은 체력바 위치를 따라감
 const barX=716+G.barDX,barY=125+G.barDY;
 place(W/2,G.groupY*unit,G.groupScale,982,125,function(){
 const bars=bossBar(barX,barY,620,44);
 // Empty auxiliary gauge; its gameplay rule has not been implemented.
 ctx.strokeStyle='#9ba3b4';ctx.lineWidth=1;polygon([[barX+11,barY+50],[barX+608,barY+50],[barX+599,barY+56],[barX+4,barY+56]]);ctx.fillStyle='rgba(11,17,26,.75)';ctx.fill();ctx.stroke();
 bossEmblemFire(false);sprite('badge',644,70,85,106);bossEmblemFire(true);stageEmblemGlow();   // 기믹 시작 불길(문장 뒤·앞) → 문장 → 단계 전환 금빛
 stageNumberSparkFx();                                             // 숫자 뒤 금빛 반짝 (숫자는 그 위에 그려 읽힘)
 {const sp=stageNumberSpark();text(combatStage,686,156,(String(combatStage).length>1?21:25)*(1+.28*sp),'center',sp>0?'#fff4cf':'#fff');}   // 단계 숫자 : 오를 때 살짝 커지며 금빛 (v185)
 text(BOSS_NAME,barX+G.nameDX,barY-G.nameSize/2,G.nameSize);                  // 보스 이름 : 체력바 윗변이 시작하는 자리부터
 text('×'+bars.left,barX+616,barY-G.countSize/2,G.countSize,'right');         // 남은 체력줄 수 : 체력바 오른쪽 끝에 맞춤
 fit('element',barX+579,barY+78,67,51);
 debuffChips(barX+10,barY+82);   // 보스에게 걸린 약화 이름표

 });
 place(W-60*unit,24*unit,.70,1740,46,function(){
  topButton(1740,46,'target');topButton(1830,46,'exit');
 });
 place(74*unit,H-L.portraitBottom*unit,L.portraitScale,196,977,function(){
 // Party symbol is drawn cleanly at runtime.
 ctx.save();ctx.translate(87,980);ctx.fillStyle='#e6edf6';
 for(const p of [[-11,0],[9,-6],[0,12]]){ctx.beginPath();ctx.arc(p[0],p[1]-9,7,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(p[0],p[1]+3,10,6,0,0,Math.PI*2);ctx.fill();}
 ctx.restore();
 [196,291,391].forEach(function(px,s){portrait(typeof partySlotChar==='function'?partySlotChar(s):s,px,977,s);});   // 편성 순서대로 (슬롯 → 캐릭터)

 });
 const barSourceY=977-config.playerBarLift;
 place(W/2,H-L.healthBottom*unit,L.healthScale,977.5,barSourceY+17.5,function(){
 const y=977-config.playerBarLift;
 bar('playerBar',800,y,355,35,player.hp,player.shownHp,party[current].maxHp,'#40d8b4');   // 지금 출전 중인 캐릭터의 체력
 text(Math.ceil(player.hp)+' / '+party[current].maxHp,978,y+17,21,'center');
 buffChips(978,y-24);   // 강화 효과 이름표
 ctx.save();ctx.translate(731,y+17);ctx.beginPath();ctx.arc(0,0,29,0,Math.PI*2);ctx.fillStyle='rgba(119,49,20,.8)';ctx.fill();ctx.strokeStyle='#ed9f46';ctx.lineWidth=2;ctx.stroke();ctx.restore();
 // Reuse the newly drawn crest face from its atlas; do not use screenshot fragments.
 const b=atlasLayout.badge,t=textures.frames;
 if(t.ready)ctx.drawImage(t.img,b.rect[0],b.rect[1],b.rect[2],b.rect[3]*.68,708,y-8,46,50);

 });
 place(W-margin,H-L.actionBottom*unit,L.actionScale,1870,983,function(){
 const set=CHARACTER_UI[current],cd=skillCooldowns[current];
 const S=skillHudState();   // 스킬 상태 (index.html)
 slot('q',1528,985,44,{glyph:0,old:'q'},set.skillQ.enabled,S.ultLeft,S.ultTotal,'Q');            // 궁극기 : 캐릭터별 Q 문양, 남은 대기시간
 slot('e',1617,983,40,{glyph:1,old:'e'+current},set.skillE.enabled,S.eLeft,S.eTotal,'E');      // E 스킬 : 캐릭터별 E 문양, 남은 대기시간
 skillMarks(S);
 slot('attack',1719,981,53,'attack'+current,true,player.attackCd,ATTACK_COOLDOWN,'좌클릭');
 slot('dodge',1822,983,40,'dodge',true,player.cooldown,DODGE_COOLDOWN,'Space');
 });

 return{
  timer:timerBox,
  score:{x:margin,y:18*unit,w:333*base*L.scoreScale,h:171*base*L.scoreScale},
  bossBar:{x:W/2+(barX-982)*base*G.groupScale,y:G.groupY*unit+(barY-125)*base*G.groupScale,w:620*base*G.groupScale,h:44*base*G.groupScale},
  playerBar:{x:W/2-355*base*L.healthScale/2,y:H-L.healthBottom*unit-35*base*L.healthScale/2,w:355*base*L.healthScale,h:35*base*L.healthScale}
 };
}
function drawRedrawnHud(){
 ctx.save();ctx.lineJoin='round';const bounds=drawCompactLayout();const s=status();   // 투명도는 index.html이 정함 (전투 종료 때 HUD가 서서히 사라지게)
 if(s.failed.length)text('UI 이미지 로드 실패: '+s.failed.join(', '),W/2,125,13,'center','#ffb9c5');
 else if(s.loaded<2)text('UI 이미지 불러오는 중',W/2,125,13,'center','#b8ecff');
 ctx.restore();
 api.lastFrame={current,portraitSource:config.portraitOrder[current],combatStage,battleTime,bossHp:boss.hp,bossMaxHp:BOSS_MAX_HP,bossBars:bossBarInfo(),totalDamage,playerHp:player.hp,party:party.map(function(c){return{hp:c.hp,maxHp:c.maxHp,swapCd:c.swapCd};}),attackCooldown:player.attackCd,dodgeCooldown:player.cooldown,loaded:s.loaded,total:2,failed:s.failed,topAnchors:{timer:bounds.timer.y,score:bounds.score.y,bossBar:bounds.bossBar.y},playerBarY:bounds.playerBar.y,bounds,layoutVersion:'compact-1',artwork:'newly_generated'};
}

drawHud=drawRedrawnHud;drawSlots=function(){};drawActionSlots=function(){};
showDebug=false;showHelp=false;document.title='크샬로스 · 3분 피해량 기록';
})();

