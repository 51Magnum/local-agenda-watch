import {expect,it} from "vitest";
import {placeProjectCard} from "./popup-position";
const viewport={width:1200,height:650},desired={width:600,height:450};
it("places a card beside the outline with a gap, inside the map",()=>{
 const project={left:120,right:290,top:150,bottom:350};const card=placeProjectCard(viewport,project,desired);
 expect(card.reframe).toBe(false);expect(card.x).toBeGreaterThan(project.right);expect(card.x+card.width).toBeLessThanOrEqual(1184);expect(card.y).toBeGreaterThanOrEqual(16);
});
it("uses the left side for a project near the right edge",()=>{
 const card=placeProjectCard(viewport,{left:940,right:1100,top:170,bottom:430},desired);expect(card.side).toBe("left");expect(card.x+card.width).toBeLessThan(940);
});
it("uses space above or below wide projects",()=>{
 const card=placeProjectCard(viewport,{left:100,right:1100,top:80,bottom:180},desired);expect(card.side).toBe("bottom");expect(card.y).toBeGreaterThan(180);expect(card.reframe).toBe(false);
});
it("reserves room and reframes when the project fills the map",()=>{
 const card=placeProjectCard(viewport,{left:30,right:1170,top:20,bottom:630},desired);expect(card.reframe).toBe(true);expect(card.width).toBeLessThan(600);
});
it("uses a bounded bottom card on small screens",()=>{
 const card=placeProjectCard({width:390,height:500},{left:15,right:375,top:30,bottom:480},desired);expect(card.side).toBe("bottom");expect(card.reframe).toBe(true);expect(card.width).toBe(358);expect(card.height).toBeLessThanOrEqual(210);
});

it("keeps a pinned card inside the canvas when its project is panned offscreen",()=>{
 for(const project of [{left:-600,right:-200,top:100,bottom:300},{left:1500,right:1700,top:100,bottom:300}]){
 const card=placeProjectCard(viewport,project,desired);expect(card.x).toBeGreaterThanOrEqual(16);expect(card.x+card.width).toBeLessThanOrEqual(1184);expect(card.y).toBeGreaterThanOrEqual(16);expect(card.y+card.height).toBeLessThanOrEqual(634);
 }
});
