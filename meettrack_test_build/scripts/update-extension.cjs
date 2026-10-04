const fs = require("fs");
const path = require("path");

const contentPath = "C:\\Users\\Admin\\Downloads\\MeetTrack-Pro-Extension\\content.js";
let code = fs.readFileSync(contentPath, "utf8");

const target = "      // Reflect initial or restored state\n      updateControlBarUI();";
const replacement = `      // Reflect initial or restored state
      updateControlBarUI();

      // Automatically report mentor presence upon entering Google Meet room
      if (getActiveRole() === "mentor" && clean) {
        var reportKey = "meettrack_joined_" + clean;
        if (!sessionStorage.getItem(reportKey)) {
          sessionStorage.setItem(reportKey, "true");
          sendEvent({
            meetUrl: clean,
            role: "mentor",
            action: "mentor_join",
            participantName: getParticipantName(),
            participantEmail: getParticipantEmail(),
            timestamp: new Date().toISOString()
          }, true);
        }
      }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(contentPath, code, "utf8");
  console.log("✅ content.js updated successfully.");
} else {
  console.log("⚠️ Target string not found in content.js");
}
