"use client";
import {useCallback,useEffect,useRef} from "react";
import type {PointerEvent,MouseEvent,FocusEvent,KeyboardEvent} from "react";
/** Hover on pointer devices; tap/outside-tap on touch, with keyboard dismissal. */
export function useMapMenu(open:boolean,onChange:(open:boolean)=>void){
 const trigger=useRef<HTMLElement|null>(null),panel=useRef<HTMLElement|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),hoverOpened=useRef(false);
 const cancel=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=undefined;},[]);
 const inside=useCallback((target:EventTarget|null)=>target instanceof Node&&!!(trigger.current?.contains(target)||panel.current?.contains(target)),[]);
 const triggerRef=useCallback((node:HTMLElement|null)=>{trigger.current=node;},[]);
 const panelRef=useCallback((node:HTMLElement|null)=>{panel.current=node;},[]);
 function enter(event:PointerEvent<HTMLElement>){
  if(event.pointerType==="touch"||!matchMedia("(hover: hover)").matches)return;
  cancel();if(!open)hoverOpened.current=true;onChange(true);
 }
 function leave(event:PointerEvent<HTMLElement>){
  if(!open||event.pointerType==="touch"||!matchMedia("(hover: hover)").matches||inside(event.relatedTarget))return;
  cancel();timer.current=setTimeout(()=>onChange(false),180);
 }
 function blur(event:FocusEvent<HTMLElement>){
  if(event.relatedTarget&&!inside(event.relatedTarget)){cancel();onChange(false);}
 }
 function key(event:KeyboardEvent<HTMLElement>){
  if(event.key==="Escape"){
   event.preventDefault();event.stopPropagation();cancel();onChange(false);trigger.current?.focus();
  }
 }
 function click(event:MouseEvent<HTMLElement>){
  event.preventDefault();cancel();
  // A pointer click following hover should not immediately close the new menu.
  if(event.detail!==0&&hoverOpened.current){hoverOpened.current=false;onChange(true);return;}
  hoverOpened.current=false;onChange(!open);
  if(!open&&event.detail===0)requestAnimationFrame(()=>{
   const target=panel.current?.querySelector<HTMLElement>('button,input,a,summary,[tabindex="0"]')??panel.current;
   target?.focus();
  });
 }
 useEffect(()=>{
  if(!open){cancel();return;}
  const outside=(event:globalThis.PointerEvent)=>{if(!inside(event.target)){cancel();onChange(false);}};
  document.addEventListener("pointerdown",outside);
  return()=>{document.removeEventListener("pointerdown",outside);cancel();};
 },[open,onChange,cancel,inside]);
 return {
  triggerProps:{ref:triggerRef,onPointerEnter:enter,onPointerLeave:leave,onBlur:blur,onKeyDown:key,onClick:click},
  panelProps:{tabIndex:-1,ref:panelRef,onPointerEnter:(event:PointerEvent<HTMLElement>)=>{hoverOpened.current=false;enter(event);},onPointerLeave:leave,onBlur:blur,onKeyDown:key},
 };
}
