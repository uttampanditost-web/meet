import fs from "fs";
import path from "path";

const dir = "C:\\Users\\Admin\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Local Extension Settings\\cmfhopmhaagcfnjflfppceclmkenjkpc";
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.endsWith(".ldb") || file.endsWith(".log")) {
    const full = path.join(dir, file);
    try {
      const buffer = fs.readFileSync(full);
      const str = buffer.toString("utf8");
      
      // Look for dates like 2026-09-12, 2026-09-13, 2026-09-14
      const d12 = (str.match(/2026-09-12/g) || []).length;
      const d13 = (str.match(/2026-09-13/g) || []).length;
      const d14 = (str.match(/2026-09-14/g) || []).length;
      console.log(file, "Matches -> 12th:", d12, "13th:", d13, "14th:", d14);

      // Search for JSON snippets
      const matches = str.match(/\{"id":[^}]+\}/g) || [];
      console.log(file, "JSON objects found:", matches.length);
      matches.slice(0, 5).forEach((m) => console.log("  Object:", m));
    } catch (e) {
      console.error("Error reading", file, e.message);
    }
  }
}
