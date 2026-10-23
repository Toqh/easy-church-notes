import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const values=Object.fromEntries(readFileSync(".dev.vars","utf8").split(/\r?\n/).filter(line=>line.includes("=")).map(line=>{const position=line.indexOf("=");return [line.slice(0,position),line.slice(position+1).trim()];}));
const secrets=["YOUVERSION_APP_KEY","API_BIBLE_KEY"].map(key=>({key,value:values[key]})).filter(item=>item.value);
const files=execFileSync("git",["ls-files","--cached","--others","--exclude-standard","-z"],{encoding:"utf8"}).split("\0").filter(Boolean);
const matches=[];
for(const file of new Set(files)){const bytes=readFileSync(file);for(const secret of secrets)if(bytes.includes(Buffer.from(secret.value)))matches.push({file,key:secret.key});}
if(matches.length){console.error(JSON.stringify({error:"Remove secrets before committing",matches}));process.exitCode=1;}
else console.log(`Source check passed: ${new Set(files).size} files contain no configured Bible API secrets.`);
