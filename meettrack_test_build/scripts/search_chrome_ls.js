import fs from "fs";
import path from "path";

const lsDir = "C:\\Users\\Admin\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Local Storage\\leveldb";

if (!fs.existsSync(lsDir)) {
  console.log("Local Storage directory does not exist:", lsDir);
  process.exit(0);
}

const files = fs.readdirSync(lsDir);
console.log("Local Storage files:", files);

for (const file of files) {
  if (file.endsWith(".ldb") || file.endsWith(".log")) {
    const full = path.join(lsDir, file);
    try {
      const content = fs.readFileSync(full, "latin1");
      if (content.includes("meettrack") || content.includes("attendance")) {
        console.log("Found match in file:", file);

        // Search for dates: 2026-09-12, 2026-09-13, 2026-09-14
        ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"].forEach(d => {
          const count = (content.match(new RegExp(d, "g")) || []).length;
          console.log(`  Date ${d} occurrences: ${count}`);
        });

        // Search for JSON arrays of logs
        const matches = content.match(/\[\{[^{}\]]*\"trainerName\"[^{}\]]*\}\]/g) || [];
        console.log("  Pattern matches:", matches.length);
        if (matches.length > 0) {
          console.log("  Sample:", matches[0].slice(0, 300));
        }
      }
    } catch (err) {
      console.error("Error reading file:", file, err.message);
    }
  }
}
