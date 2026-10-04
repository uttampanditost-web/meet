import fs from "fs";

const file = "C:\\Users\\Admin\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Local Extension Settings\\cmfhopmhaagcfnjflfppceclmkenjkpc\\010837.log";
const content = fs.readFileSync(file, "utf8");

function printAround(date) {
  console.log(`=== Matches for ${date} ===`);
  let idx = 0;
  let count = 0;
  while ((idx = content.indexOf(date, idx)) !== -1) {
    count++;
    const start = Math.max(0, idx - 150);
    const end = Math.min(content.length, idx + 350);
    console.log(`[${count}]`, JSON.stringify(content.slice(start, end)));
    idx += date.length;
  }
}

printAround("2026-09-12");
