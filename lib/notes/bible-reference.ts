export const books: [string, number, string[]][] = [
  ["GEN",50,["Genesis","Gen","Ge"]],["EXO",40,["Exodus","Exod","Ex"]],["LEV",27,["Leviticus","Lev"]],["NUM",36,["Numbers","Num"]],["DEU",34,["Deuteronomy","Deut","Dt"]],
  ["JOS",24,["Joshua","Josh"]],["JDG",21,["Judges","Judg"]],["RUT",4,["Ruth","Ru"]],["1SA",31,["1 Samuel","1 Sam","1 Sa"]],["2SA",24,["2 Samuel","2 Sam","2 Sa"]],
  ["1KI",22,["1 Kings","1 Kgs","1 Ki"]],["2KI",25,["2 Kings","2 Kgs","2 Ki"]],["1CH",29,["1 Chronicles","1 Chron","1 Chr"]],["2CH",36,["2 Chronicles","2 Chron","2 Chr"]],
  ["EZR",10,["Ezra","Ezr"]],["NEH",13,["Nehemiah","Neh"]],["EST",10,["Esther","Est"]],["JOB",42,["Job"]],["PSA",150,["Psalms","Psalm","Psa","Ps"]],
  ["PRO",31,["Proverbs","Prov","Pr"]],["ECC",12,["Ecclesiastes","Eccles","Eccl","Ecc"]],["SNG",8,["Song of Solomon","Song of Songs","Song","Songs"]],
  ["ISA",66,["Isaiah","Isa"]],["JER",52,["Jeremiah","Jer"]],["LAM",5,["Lamentations","Lam"]],["EZK",48,["Ezekiel","Ezek","Eze"]],["DAN",12,["Daniel","Dan"]],
  ["HOS",14,["Hosea","Hos"]],["JOL",3,["Joel"]],["AMO",9,["Amos"]],["OBA",1,["Obadiah","Obad"]],["JON",4,["Jonah","Jon"]],["MIC",7,["Micah","Mic"]],
  ["NAM",3,["Nahum","Nah"]],["HAB",3,["Habakkuk","Hab"]],["ZEP",3,["Zephaniah","Zeph"]],["HAG",2,["Haggai","Hag"]],["ZEC",14,["Zechariah","Zech"]],["MAL",4,["Malachi","Mal"]],
  ["MAT",28,["Matthew","Matt","Mat","Mt"]],["MRK",16,["Mark","Mrk","Mk"]],["LUK",24,["Luke","Luk","Lk"]],["JHN",21,["John","Jhn","Jn"]],
  ["ACT",28,["Acts","Act"]],["ROM",16,["Romans","Rom","Ro"]],["1CO",16,["1 Corinthians","1 Cor","1 Co"]],["2CO",13,["2 Corinthians","2 Cor","2 Co"]],
  ["GAL",6,["Galatians","Gal"]],["EPH",6,["Ephesians","Eph"]],["PHP",4,["Philippians","Phil","Php"]],["COL",4,["Colossians","Col"]],
  ["1TH",5,["1 Thessalonians","1 Thess","1 Thes","1 Th"]],["2TH",3,["2 Thessalonians","2 Thess","2 Thes","2 Th"]],
  ["1TI",6,["1 Timothy","1 Tim","1 Ti"]],["2TI",4,["2 Timothy","2 Tim","2 Ti"]],["TIT",3,["Titus","Tit"]],["PHM",1,["Philemon","Philem","Phlm"]],
  ["HEB",13,["Hebrews","Heb"]],["JAS",5,["James","Jas","Jm"]],["1PE",5,["1 Peter","1 Pet","1 Pe"]],["2PE",3,["2 Peter","2 Pet","2 Pe"]],
  ["1JN",5,["1 John","1 Jn","1 Jhn"]],["2JN",1,["2 John","2 Jn","2 Jhn"]],["3JN",1,["3 John","3 Jn","3 Jhn"]],["JUD",1,["Jude"]],["REV",22,["Revelation","Revelations","Rev"]],
];
const aliases = books.flatMap(([id, chapters, names]) => names.map(name => ({ id, chapters, name, title: names[0] }))).sort((a,b) => b.name.length-a.name.length);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const bookPattern = aliases.map(a => escapeRegex(a.name).replace(/ /g,"\\s*")).join("|");
const referencePattern = new RegExp(`(?:^|[^a-zA-Z0-9])(${bookPattern})\\.?\\s+(\\d{1,3})\\s*:\\s*(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3}))?[\\s.,;!?)”"']*$`,"i");
export interface BibleReference { id: string; label: string }
export function detectReference(text: string): BibleReference | null {
  const match = text.match(referencePattern);
  if (!match) return null;
  const name = match[1].replace(/\s/g,"").toLowerCase();
  const book = aliases.find(a => a.name.replace(/\s/g,"").toLowerCase()===name);
  if (!book) return null;
  const chapter=Number(match[2]), verse=Number(match[3]), end=match[4]?Number(match[4]):null;
  if(chapter<1 || chapter>book.chapters || verse<1 || verse>176 || (end!==null && (end<verse || end>176))) return null;
  return { id: `${book.id}.${chapter}.${verse}${end!==null?`-${end}`:""}`, label:`${book.title} ${chapter}:${verse}${end!==null?`–${end}`:""}` };
}
export function validPassageId(id: string): boolean {
  const m=id.match(/^([1-3]?[A-Z]{2,3})\.(\d{1,3})(?:\.(\d{1,3})(?:-(\d{1,3}))?)?$/);
  if(!m) return false;
  const book=books.find(b=>b[0]===m[1]);
  return !!book && Number(m[2])>=1 && Number(m[2])<=book[1] && (!m[3] || (Number(m[3])>=1 && Number(m[3])<=176)) && (!m[4] || (Number(m[4])>=Number(m[3]) && Number(m[4])<=176));
}
