export type ProjectScreenBounds={left:number;right:number;top:number;bottom:number};
export type CardPlacement={x:number;y:number;width:number;height:number;side:"left"|"right"|"top"|"bottom";reframe:boolean};
/** Place against the project bounds, independent of where the pointer entered. */
export function placeProjectCard(viewport:{width:number;height:number},project:ProjectScreenBounds,desired:{width:number;height:number}):CardPlacement {
 const margin=16,gap=20,W=viewport.width,H=viewport.height;
 const width=Math.min(desired.width,W-2*margin),height=Math.min(desired.height,H-2*margin);
 const clamp=(v:number,limit:number)=>Math.max(margin,Math.min(limit,v));
 const cy=(project.top+project.bottom)/2,cx=(project.left+project.right)/2;
 const candidates:CardPlacement[]=[];
 const minWidth=Math.min(300,width),minHeight=Math.min(350,height);
 const left=project.left-gap-margin,right=W-margin-project.right-gap,top=project.top-gap-margin,bottom=H-margin-project.bottom-gap;
 if(right>=minWidth){const w=Math.min(width,right);candidates.push({x:clamp(project.right+gap,W-w-margin),y:clamp(cy-height/2,H-height-margin),width:w,height,side:"right",reframe:false});}
 if(left>=minWidth){const w=Math.min(width,left);candidates.push({x:clamp(project.left-gap-w,W-w-margin),y:clamp(cy-height/2,H-height-margin),width:w,height,side:"left",reframe:false});}
 if(bottom>=minHeight){const h=Math.min(height,bottom);candidates.push({x:clamp(cx-width/2,W-width-margin),y:clamp(project.bottom+gap,H-h-margin),width,height:h,side:"bottom",reframe:false});}
 if(top>=minHeight){const h=Math.min(height,top);candidates.push({x:clamp(cx-width/2,W-width-margin),y:clamp(project.top-gap-h,H-h-margin),width,height:h,side:"top",reframe:false});}
 if(candidates.length)return candidates.sort((a,b)=>b.width*b.height-a.width*a.height)[0];
 // A zoomed-in project can occupy the entire canvas. Reserve space for the card
 // and fit the outline in the remaining map instead of covering it.
 const side=cx<W/2?"right":"left",w=Math.min(width,W*.44);
 if(W<650){const h=Math.min(height,H*.42);return {x:margin,y:H-margin-h,width,height:h,side:"bottom",reframe:true};}
 return {x:side==="left"?margin:W-margin-w,y:margin,width:w,height,side,reframe:true};
}
