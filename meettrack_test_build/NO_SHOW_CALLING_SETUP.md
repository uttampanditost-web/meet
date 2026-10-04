# No-Show Calling — Test Mode (No Supabase Student Database)

This build intentionally **does not connect the new Students & Batches feature to Supabase**.

## How student data works in this test build

1. Open **Admin → Students**.
2. Upload a CSV/XLSX for each batch.
3. The student directory is stored in the browser's `localStorage`.
4. Click **Sync to Extension** after uploading/updating students.
5. The downloaded MeetTrack extension receives the directory in `chrome.storage.local`.
6. When a mentor clicks **Student Not Joined**, the extension asks for the booked student's name and looks up the phone locally.
7. The event is sent to the existing `/api/events/track` endpoint with `studentPhone`.
8. The server can then submit the Google Form if the calling environment variables are configured.

### Important test-mode limitation

Local student data is browser/extension-local. It is **not shared between different mentor computers** and is not durable server-side. This is intentional for the first test build. Once the workflow is validated, we can move the same student directory to Supabase (or another shared database) so every mentor's extension can use it.

## Google Form configuration

Set these server environment variables only when you are ready to test the actual form trigger:

```
GOOGLE_FORM_URL=https://docs.google.com/forms/d/e/1FAIpQLSfFPUBsEUbpoCqBtNc6GzngGj5ij9zXY3CJHhUikGE1UC9MjQ/formResponse
GOOGLE_FORM_ENTRY_CX_NAME=entry.xxxxx
GOOGLE_FORM_ENTRY_CX_PHONE=entry.xxxxx
GOOGLE_FORM_ENTRY_MENTOR_NAME=entry.xxxxx
GOOGLE_FORM_ENTRY_MEET_LINK=entry.xxxxx
NO_SHOW_CALLING_ENABLED=true
```

Keep `NO_SHOW_CALLING_ENABLED=false` while testing only the student lookup/extension flow.

## Extension flow

The generated extension now:

- receives the local student directory from the dashboard;
- stores it in `chrome.storage.local`;
- changes the Meet no-show action to **Student Not Joined**;
- asks the mentor for the booked student's name;
- resolves the phone number locally;
- sends the phone number with the no-show event.

No WhatsApp monitoring and no student Supabase table are required for this test build.
