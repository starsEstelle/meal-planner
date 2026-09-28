# Using Google Sheets as storage

1. Create a new Google Sheet (any name).
2. In the Sheet, go to **Extensions > Apps Script**.
3. Delete the placeholder code and paste in the contents of [Code.gs](Code.gs).
4. Click **Deploy > New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, and authorize it with your Google account when prompted.
5. Copy the **Web app URL** it gives you (ends in `/exec`).
6. On the meal planner site, click **Storage settings** (footer), paste the URL, and save.

The script auto-creates a `Plans` sheet with the right columns the first time it runs.

Notes:
- Re-deploying after editing the script requires **Deploy > Manage deployments > edit > New version**, otherwise your changes won't take effect.
- Since deployment is set to "Execute as: Me", the sheet stays private to you — the web app URL is what the site calls, and only you deployed it.
- If the site can't reach the script (offline, URL wrong, script not deployed), it automatically falls back to saving in the browser (localStorage) so it still works.
