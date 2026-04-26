# Biome Dashboard — Simple Step-by-Step Guide

This guide explains how to use the Biome admin dashboard. It is written in very simple language so anyone can follow along.

---

## What is this dashboard?

Think of this dashboard like the **security office at a shopping mall**.

- People send in requests ("Can I do this?")
- You (the admin) watch everything
- You say **Yes** (Approve) or **No** (Reject) to each request
- You can also delete things that should not be there

---

## Step 1: Open the website

Open your web browser (Chrome, Safari, or Firefox) and type:

```
http://localhost:3000
```

You will see the **Sign-in page** with the Biome logo.

---

## Step 2: Sign in

Use these login details:

- **Email:** `pecerep172@mugstock.com`
- **Password:** `syed123`

Steps:

1. Type the **email** above in the first box
2. Type the **password** above in the second box
3. Click the green **Sign in** button

If the password is correct, the dashboard opens. If wrong, a red message will tell you to try again.

---

## Step 3: Understand the screen

After signing in you will see:

- **Left side** — a list of all sections (sidebar menu)
- **Top right** — your profile picture (click to log out)
- **Middle** — whatever page you open

### Sidebar sections

| Section | What it does |
|---------|--------------|
| **Dashboard** | Home page with summary numbers |
| **Verification** | Approve users who want a blue tick |
| **BMID Content** | Approve posts that carry a BMID |
| **BMID Box** | Manage cross-platform posts shared into Biome |
| **Duality** | Joint-ownership content (two users share one post) |
| **Voting** | Watch live voting sessions |
| **Tagged Response** | Users reply to being tagged |
| **Moderation** | Review reports of bad content |
| **Users** | See all users in the system |
| **Posts** | Browse every post made by users |
| **Audit Logs** | History of every action admins did |
| **Reports** | Charts and reports |
| **Settings** | Change rules and defaults |

---

## Step 4: Do your first task — Approve a Verification

A verification is when a user asks "Please give me a blue tick."

1. Click **Verification** on the left sidebar
2. You see a list of requests. Each row = one user asking for verification
3. Find a row that says **PENDING** in the Status column
4. Click the row — a side panel opens on the right
5. Scroll down and read the details (their social account, their reason, their proof)
6. Decide:
   - If everything looks real → click the green **Approve** button
   - If something is fake → click the red **Reject** button
   - If you are not sure → close the panel and come back later

That's it! The user will now show a blue tick (once approved).

---

## Step 5: Search and filter

Every table has a **search box** at the top.

- Type any word (name, email, ID) and the table filters as you type
- Next to search you will see filter boxes (Status, Platform, etc.)
- Pick a value from a filter box to show only matching rows
- Click **Clear Filters** to see everything again

---

## Step 6: Select rows and do bulk actions

You can tick many rows at once and act on them together.

1. See the small checkboxes on the far left of each row
2. Click a checkbox to tick one row
3. Click the checkbox in the header to tick **all rows on this page**
4. When one or more rows are ticked, buttons appear at the top:
   - **Approve** — approve all ticked rows
   - **Reject** — reject all ticked rows
   - **Delete** — delete all ticked rows

5. Click the button you want. A confirmation box will pop up.
6. Click **Confirm** to finish, or **Cancel** to stop.

---

## Step 7: Delete one row at a time

Every row has a small **red trash icon** on the far right.

1. Click the trash icon on any row
2. A confirmation box pops up asking "Are you sure?"
3. Click **Delete** to confirm, or **Cancel** to stop

The row is gone after you confirm. Do not worry — the system asks twice before deleting, so mistakes are hard.

---

## Step 8a: BMID Content — Approve a post

BMID Content is where posts made inside Biome ask to carry the BMID mark. Think of it like: **a user took a photo inside the app and wants to stamp it with their blue tick.**

There are two kinds of requests here:

- **Own** — the user claims their own post.
- **Duality** — the user wants to share the post with another tagged user.

### How a BMID Content request flows

1. User submits the post inside the Biome app.
2. If it is **duality**, the tagged user must accept or decline first.
3. Once accepted (or if it is own), the request waits in **Admin Review**.
4. You (the admin) open it and read the details.
5. Click **Approve** → voting opens for the community.
6. Community casts Accept / Ignore / Refuse votes.
7. When voting closes, the final result is **Approved** or **Rejected**.
8. Approved posts now display the BMID stamp on the Biome app.

### Step-by-step (what you click)

1. Click **BMID Content** on the left menu.
2. In the **Requests** tab you see a list.
3. Find a row with status **Pending** or **In Review**.
4. Click the row — a side panel opens on the right.
5. Read:
   - The post title + preview image
   - The owner (and tagged user if duality)
   - The reason
6. Decide:
   - Click **Approve** to send it to voting.
   - Click **Reject** if it breaks the rules.
7. Later, open the **Voting** or **Audit** tab to watch the result.

### Difference between BMID Content and BMID Box

| | BMID Content | BMID Box |
|---|---|---|
| Source of post | **Inside** the Biome app | **Outside** (Instagram, TikTok, etc.) |
| How it arrives | User submits in-app post | User pastes a link |
| Flow stages | Pending → Admin Review → Voting → Approved/Rejected | Admin Review → Voting → Approved/Refused |
| Menu item | "BMID Content" | "BMID Box" |

---

## Step 8b: The BMID Box — Approve a content request

BMID Box is where content that links to another platform (Instagram, TikTok, YouTube, etc.) is checked.

1. Click **BMID Box** on the sidebar
2. On the **Requests** tab, you see a list of submissions
3. Find one that says **Pending Admin Review**
4. Click the row to open it — you go to a detail page
5. Read the content, check the owner, check the link
6. Click **Open Voting** if you want the community to decide
7. Click **Reject** if it is clearly against the rules

Once voting opens, users can Accept, Ignore, or Refuse the content. The final result becomes the answer.

---

## Step 9: Watch Voting sessions

1. Click **Voting** on the sidebar
2. You see all live voting sessions
3. Each row shows **Accept / Ignore / Refuse** counts
4. You can pick a voter and cast a quick vote using the **Record Vote** buttons
5. Or click a row to open the full voting details

---

## Step 10: Check Moderation reports

If a user sees something bad and reports it, the report shows up here.

1. Click **Moderation** on the sidebar
2. Pick the **Pending** tab
3. Open a report to see what was reported
4. Decide:
   - **Dismiss** if the report is not a real problem
   - **Action** if you need to punish the content
   - **Delete Content** if the content must be removed immediately

---

## Step 11: Read the Audit Log

The audit log is like a diary — it remembers every action every admin did.

1. Click **Audit Logs** on the sidebar
2. Each row = one thing that happened
3. You see: who did it, what they did, when, and to which request
4. Filter by Status, Type, or Source to narrow down
5. Click **Download CSV** at top right to save the list as a spreadsheet

---

## Step 12: Sign out

When you are done:

1. Click your **profile picture** at the top right
2. A small menu opens
3. Click **Logout**

You are back on the sign-in page. Close the browser when ready.

---

## Colors — what they mean

Colors are your friends. They tell you what is happening without reading words.

| Color | Meaning |
|-------|---------|
| Green | Good / Approved / Accepted |
| Amber (yellow-orange) | Waiting / Pending |
| Red | Rejected / Deleted / Danger |
| Blue | Information / BMID Number |
| Purple | Voting is open |
| Gray | Removed / Closed / Ignored |

---

## Common buttons — what they look like

- **Green pill with check** — Approve / Good
- **Red pill with X** — Reject / Delete
- **Amber button** — Warning (e.g., Remove Verification)
- **Red trash icon** — Delete this row

---

## Tips for new admins

1. **Go slow.** Read the full details before clicking Approve or Reject.
2. **Use filters.** They save time when the list is long.
3. **Use bulk actions.** If 20 items look the same, tick them all and act once.
4. **Double-check before deleting.** Deletes are permanent for most rows.
5. **Ask before you act.** If you are unsure, leave it pending and ask a senior admin.

---

## Something went wrong — what to do

- **Page looks broken** → refresh the browser (press F5 or Cmd+R)
- **Login keeps failing** → check your password carefully; your account may not have admin access
- **Button does nothing** → wait 2 seconds — the system is working; then try again
- **Error message pops up** → read the message, it usually tells you what to fix

---

## Glossary (simple words for tricky terms)

| Word | Meaning |
|------|---------|
| **BMID** | A unique ID number the system gives to verified users |
| **Duality** | A post owned by two users together |
| **Voting** | The community deciding yes or no together |
| **Audit** | A full history of who did what |
| **Moderation** | Keeping bad content out |
| **Verification** | Giving a user the blue tick |
| **Tagged user** | A user who someone else mentioned |
| **Status** | The current state of a request (pending, approved, etc.) |

---

That's the whole system. Go slow, ask questions, and you will do great.
