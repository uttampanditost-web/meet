# How to Use a Custom Domain for Your Permanent Smart Join Links

Right now, your permanent link is:
`https://be10x-meet-track.vercel.app/join/soudeep`

You can change this so students and mentors see your official company domain instead, for example:
👉 **`https://join.be10x.in/join/soudeep`**  
or  
👉 **`https://meet.be10x.in/join/soudeep`**

---

### Step 1: Add your Custom Subdomain in Vercel (Takes 2 Minutes)
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click on your project: **`be10x-meet-track`**.
3. Go to **Settings** > **Domains**.
4. In the text box, type your desired subdomain, for example:
   `join.be10x.in` (or whatever domain your company owns).
5. Click **Add**.
6. Vercel will give you a DNS record to add in your domain registrar (GoDaddy / Cloudflare / Namecheap):
   - **Type**: `CNAME`
   - **Name / Host**: `join`
   - **Value / Target**: `cname.vercel-dns.com`
7. Once added, Vercel will verify it and issue a free SSL certificate automatically within 1–5 minutes!

---

### Step 2: Set the Custom Domain in Your Admin Dashboard
1. Open your Admin Dashboard (`/admin`).
2. Go to the **Mentors** tab.
3. In the top banner, you will see:
   **"Smart Join Link Base URL"**
4. Click **"Set Custom Domain"** and paste:
   `https://join.be10x.in`
5. Click **Save**.

Now, whenever you click **"Copy Permanent Tracking Link"**, it will automatically copy:
`https://join.be10x.in/join/soudeep`!

---

### How Security Works Now:
1. **Public Default**: Anyone who visits the website directly without `/admin` (or if they strip `/join/soudeep` from the URL) is automatically served the **Live Class Session Portal**. They can **never** see your admin dashboard, mentors list, or attendance records.
2. **Admin Access**:
   - Access the dashboard at `/admin` (or by clicking the discrete "Admin Access" link at the bottom of the portal).
   - Sign in using your authorized SuperAdmin Google email or enter your **Admin Master PIN** (default: `1010`).
   - You can change your Master PIN anytime inside the **Access & Role Management** modal!
