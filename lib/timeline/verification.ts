import { DECISION_KEYS, LOW_STAKES_KEYS, type EvidenceField, type EvidenceState, type FieldKey, type PageText, type SourceDocument, type Speaker, type Verification } from "./types";
export const exactText = (s:string) => s.replace(/\s+/g," ").trim();
export function sourceBody(doc:SourceDocument): "pz"|"council"|"board"|undefined {
 const text=doc.meeting?.body || doc.title;
 if(/board|commissioners/i.test(text))return "board";
 if(/city council|\bcouncil\b/i.test(text))return "council";
 if(/p&z|p\s*&?\s*z commission|planning.*(?:zoning|commission)|hearing examiner/i.test(text))return "pz";
 if(doc.kind==="pz-decision")return "pz";
 if(doc.kind==="council-decision")return "council";
}
export function correctedKey(key:FieldKey,doc:SourceDocument):FieldKey {
 const body=sourceBody(doc);
 if((body==="council"||body==="board") && /^pz(?:Conditions|Speakers)/.test(key))return key.replace(/^pz/,"council") as FieldKey;
 return key;
}
export function bodyLabel(doc:SourceDocument){const b=sourceBody(doc);return doc.meeting?.body || (b==="board"?"Board of Commissioners":b==="council"?"City Council":b==="pz"?"Planning & Zoning":"Body unverified");}
export function fieldLabel(field:EvidenceField,label:string){return field.body?label.replace(/^Council\/Board|^P&Z/,field.body):label;}
export function countSpeakers(speakers:Speaker[],position:Speaker["position"]){return new Set(speakers.filter(s=>s.position===position).map(s=>s.name.trim().toLowerCase())).size;}
export function speakerPosition(key:FieldKey):Speaker["position"]|undefined {return /SpeakersFor$/.test(key)?"support":/SpeakersAgainst$/.test(key)?"oppose":/SpeakersNeutral$/.test(key)?"neutral":undefined;}
/** A meeting-wide case match is insufficient: resolve the quote's agenda section. */
export function caseMatchesQuote(field:EvidenceField,doc:SourceDocument,pages:PageText[]):boolean {
 if(doc.kind!=="minutes")return doc.caseIds.includes(field.caseId);
 const text=exactText(pages.map(p=>p.text).join(" ")).toLowerCase();
 const pageIndex=pages.findIndex(p=>p.page===field.page);if(pageIndex<0)return false;
 const before=exactText(pages.slice(0,pageIndex).map(p=>p.text).join(" ")).length;
 const local=exactText(pages[pageIndex].text).toLowerCase().indexOf(exactText(field.quote).toLowerCase());
 if(local<0)return false;const quoteIndex=before+(pageIndex?1:0)+local;
 const contexts=(doc.caseContexts??[]).filter(c=>c.caseIds.length);
 const headers=contexts.map(c=>{
  const title=exactText(c.title.split(/\s*\([^)]*\d[^)]*\)/)[0].split(/\s+[—–-]\s+/)[0]).toLowerCase();
  return {...c,index:title.length>=12?text.indexOf(title):-1};
 }).filter(c=>c.index>=0).sort((a,b)=>a.index-b.index);
 const section=headers.filter(c=>c.index<=quoteIndex).at(-1);
 if(section && headers.length===contexts.length)return section.caseIds.includes(field.caseId);
 // When the minutes contain case codes instead of titles, use the nearest preceding code.
 const anchors=doc.caseIds.flatMap(id=>{const result:{id:string;index:number}[]=[];let i=text.indexOf(id.toLowerCase());while(i>=0){result.push({id,index:i});i=text.indexOf(id.toLowerCase(),i+id.length);}return result;}).filter(a=>a.index<=quoteIndex).sort((a,b)=>a.index-b.index);
 return anchors.at(-1)?.id===field.caseId;
}
export function verifyCandidate(field:EvidenceField,doc:SourceDocument,pages:PageText[],extra:{speakers?:Speaker[];complete?:boolean;secondPass?:boolean}={}):Verification {
 const caseOK=caseMatchesQuote(field,doc,pages);
 const body=sourceBody(doc),stage=field.key.startsWith("pz")?"pz":field.key.startsWith("council")||field.key==="decisionDate"?"final":undefined;
 const bodyOK=!stage || (stage==="pz"?body==="pz":body==="council"||body==="board");
 const quoteOK=!!field.quote && pages.some(p=>(field.page===null||p.page===field.page)&&exactText(p.text).includes(exactText(field.quote)));
 const pos=speakerPosition(field.key),roster=extra.speakers;
 const rosterOK=!!roster && roster.every(s=>!!s.name.trim()&&exactText(s.quote).toLowerCase().includes(s.name.trim().toLowerCase())&&!roster.some(other=>other.name.trim().toLowerCase()===s.name.trim().toLowerCase()&&other.position!==s.position)&&pages.some(p=>p.page===s.page&&!!s.quote&&exactText(p.text).includes(exactText(s.quote)))&&(/neutrally|neutral/i.test(s.quote)?s.position==="neutral":s.position==="support"?/\b(?:support(?:ed|s)?|in favor)\b/i.test(s.quote)&&!(/\b(?:oppos|against)/i.test(s.quote)):s.position==="oppose"?/\b(?:oppos(?:ed|ition|ing)|against)\b/i.test(s.quote):false));
 const noOpposition=pos==="oppose"&&/no (?:members of the public|(?:public )?speakers|one).*?(?:oppos|against)/i.test(exactText(field.quote));
 const valueOK=pos ? (noOpposition&&field.value==="0") || (!!extra.complete&&rosterOK&&String(countSpeakers(roster!,pos))===field.value) : !!field.value.trim();
 const second=!DECISION_KEYS.has(field.key)||extra.secondPass===true;
 return {version:1,case:caseOK,body:bodyOK,quote:quoteOK,value:valueOK,secondPass:second,speakers:roster,checkedAt:new Date().toISOString(),reasons:[...(!caseOK?["case mismatch or section unverified"]:[]),...(!bodyOK?["body mismatch"]:[]),...(!quoteOK?["quote not found"]:[]),...(!valueOK?["speaker evidence incomplete or inconsistent"]:[]),...(!second?["passes disagree or second pass missing"]:[])]};
}
export function passing(field:EvidenceField){const v=field.verification;return !!v&&v.case&&v.body&&v.quote&&v.value&&v.secondPass&&field.confidence>=.9;}
export function canAutoApprove(field:EvidenceField){return LOW_STAKES_KEYS.has(field.key)&&passing(field);}
export function queueReasons(f:EvidenceField){return [...(f.verification?.reasons??["verification needed"]),...(DECISION_KEYS.has(f.key)&&!LOW_STAKES_KEYS.has(f.key)?["decision field"]:[]),...(f.confidence<.9?["confidence below 90%"]:[])];}
export function riskScore(f:EvidenceField){const v=f.verification;return (v?Number(!v.case)*10+Number(!v.body)*8+Number(!v.quote)*8+Number(!v.value)*6+Number(!v.secondPass)*3:4)+(1-f.confidence);}
/** Relabel legacy rows; never grandfather them into verified publication. */
export function reconcileFields(state:EvidenceState){let changed=0;
 for(const f of Object.values(state.fields)){
  const d=state.documents[f.documentId];if(!d||d.hash!==f.documentHash)continue;
  const key=correctedKey(f.key,d),label=bodyLabel(d);
  if(key!==f.key){f.key=key;f.status="pending";delete f.verification;changed++;}
  if(f.body!==label){f.body=label;changed++;}
  // A neutral quotation cannot remain a support count. Preserve it as neutral evidence,
  // and leave the zero support count pending until a complete roster is verified.
  if(/SpeakersFor$/.test(f.key)&&/spoke neutrally|spoke.*neutral/i.test(f.quote)&&!/(?:in support|in opposition|supported|opposed)/i.test(f.quote)&&f.value!=="0"){
   const neutralKey=f.key.replace(/For$/,"Neutral") as FieldKey;
   const id=f.id+"-neutral";
   state.fields[id]??={...f,id,key:neutralKey,value:"1",status:"pending",verification:undefined};
   f.originalValue??=f.value;f.value="0";f.status="pending";delete f.verification;changed++;
  }
 }
 return changed;
}
