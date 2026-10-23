import { makeNote, type Note } from "./types";
const paragraph=(text:string)=>({type:"paragraph",content:[{type:"text",text}]});
function plainText(value:unknown):string {
  if(!value||typeof value!=="object")return "";
  const node=value as {text?:unknown;content?:unknown};
  if(typeof node.text==="string")return node.text;
  return Array.isArray(node.content)?node.content.map(plainText).join(" "):"";
}
export function starterNotes():Note[] {
  const first=makeNote("study");
  return [{...first,topic:"Walking by faith",tags:["Faith","Trust"],content:{type:"doc",content:[paragraph("Faith doesn’t always come with a clear view of the road ahead. Sometimes, it begins with one small, obedient step."),{type:"heading",attrs:{level:2},content:[{type:"text",text:"A thought to carry with me"}]},paragraph("What would it look like to trust God with the part of my story I can’t see yet?"),{type:"bulletList",content:[{type:"listItem",content:[paragraph("Make room to listen before making a decision.")]},{type:"listItem",content:[paragraph("Remember the ways God has already been faithful.")]},{type:"listItem",content:[paragraph("Take the next step, even when the whole path isn’t clear.")]}]}, {type:"heading",attrs:{level:2},content:[{type:"text",text:"Scripture to explore"}]},paragraph("Try typing 2 Corinthians 5:7 and pressing Space to bring up the passage."),{type:"heading",attrs:{level:2},content:[{type:"text",text:"My prayer"}]},paragraph("Lord, help me to trust You in the waiting, and to recognise the next step You are asking me to take.")]},plain_text:"Faith doesn’t always come with a clear view of the road ahead. Sometimes, it begins with one small, obedient step."},
  {...makeNote("sermon"),topic:"A quieter heart",tags:["Peace","Prayer"],content:{type:"doc",content:[paragraph("A little less hurry. A little more space to hear from God."),paragraph("What stood out to me in today’s message?"),paragraph("Where can I make room for stillness this week?")]},plain_text:"A little less hurry. A little more space to hear from God."},
  {...makeNote("personal"),topic:"The practice of gratitude",tags:["Gratitude"],content:{type:"doc",content:[paragraph("Today, I’m making a little space to remember the good."),{type:"bulletList",content:[{type:"listItem",content:[paragraph("Something I’m thankful for…")]},{type:"listItem",content:[paragraph("A moment I don’t want to forget…")]}]}]},plain_text:"Today, I’m making a little space to remember the good."}].map((note,index)=>({...note,plain_text:plainText(note.content),created_at:new Date(Date.now()-index*86400000).toISOString(),updated_at:new Date(Date.now()-index*86400000).toISOString()}));
}
