# Agency → client models in Sendible, SocialPilot and Planable (researched 2026-10-09)

Scope note: sources are official help centres, product pages and pricing pages where they could be retrieved. Several official pages were blocked or incomplete: support.sendible.com returned HTTP 403, the Sendible pricing page rendered without dollar amounts, two help.planable.io URLs returned 404 or 403, and socialpilot.co/pricing served Indian rupee pricing, probably because of geo-localisation. Third-party sources are labelled. None of the official pages fetched carried a visible "last updated" date, so "current" means what was served on 2026-10-09.

## Sendible: client connect flow, client dashboards, user roles per service/client, white-label, reports

### Takeaway
Sendible's model is **one workspace (formerly "service"/client dashboard) per client**, with each workspace carrying 6 social profiles. Clients link their own accounts through **Client Connect**, a widget you embed on your own website that uses OAuth. When a connection lapses, Sendible emails the client a reconnection link, so they never need a dashboard login. Clients who need to approve or view content get a **login-based "Client" user** scoped to their own dashboard, controlled with "Managed by", "Also has access to" and permission groups. White-label (custom domain, branded UI and emails) is a **paid add-on on Elite/Enterprise**. No public documentation was found for no-login approval links.

### Cited Findings
**Client Connect (onboarding without passwords)**
- Client Connect is "a widget that can be installed on your website. It allows your clients to connect their social media profiles themselves and authorize you to manage their accounts through Sendible" — [Sendible blog: Client Connect](https://sendible.com/insights/client-connect-a-safe-way-to-access-clients-social-media-accounts)
- Sendible uses OAuth 2.0, so the client authenticates directly with the social network and no passwords are passed to the agency — [Sendible blog: store client passwords securely](https://www.sendible.com/insights/store-client-social-media-passwords-securely)
- Accounts a client adds through the widget are immediately available to manage in the agency's Sendible account — [Sendible blog: Client Connect](https://sendible.com/insights/client-connect-a-safe-way-to-access-clients-social-media-accounts)
- When a connection needs renewing, Sendible automatically emails the client a reconnection link, and the client can reconnect without logging into the dashboard — [Sendible feature page: Client Connect](https://www.sendible.com/features/client-connect?hsLang=en)
- The feature page suggests agencies can "offer Client Connect as a premium service" in their packages. It does not list the supported networks or describe the widget's steps in detail — [Sendible feature page: Client Connect](https://www.sendible.com/features/client-connect?hsLang=en)
- The official pricing page shows Client Connect and client dashboards as included on every tier (Core, Plus, Premium, Elite, Enterprise) — [Sendible pricing](https://www.sendible.com/pricing)

**Client users, dashboards and per-client permissions**
- A Client account can only reach its own dashboard unless it is given more access through "Also has access to", or by being selected in another account's "Managed by" field. These details come from search snippets of the help article, because the page itself returned 403 to direct fetch — [Sendible support: Overview of user types](https://support.sendible.com/hc/en-us/articles/115000122783); [Sendible support: Set up clients](https://support.sendible.com/hc/en-us/articles/360014576251)
- "Managed by" limits which Team Members can see a client's dashboard, but every Admin on the account can see all client dashboards — [Sendible support: Set up clients](https://support.sendible.com/hc/en-us/articles/360014576251) (snippet)
- Clients see only posts made inside their own dashboard, so the agency must create a client's posts from within that client's dashboard — [Sendible support: Set up clients](https://support.sendible.com/hc/en-us/articles/360014576251) (snippet)
- Permission groups control which areas a user can see; for example, the Reports area can be removed for a group. A client can be assigned a permission group when custom permissions are available — [Sendible support: Set up a permissions group](https://support.sendible.com/hc/en-us/articles/208052696) (snippet)
- A client can be set to "require approval before publishing", which prevents that user from publishing directly — [Sendible support: Set up clients](https://support.sendible.com/hc/en-us/articles/360014576251) (snippet)
- Multiple users can manage one client through custom user hierarchies — [Sendible blog: custom user hierarchies](https://www.sendible.com/insights/feature-update-create-custom-user-hierarchies-multiple-users-can-now-manage-one-client)
- Third-party summary: Sendible splits access into team members, clients (who view and approve posts but cannot change setup) and admins — [search-result snippet, third-party review site; not verified against official docs]

**White-label**
- White-label covers the logo, brand colours, a custom domain, and system-generated email notifications, including "approval emails to your clients" — [Sendible white-label page](https://www.sendible.com/white-label-social-media-management-software)
- Under white-label, clients "can log in to your white label site themselves and view reports, send social media posts, track mentions and more" — [Sendible white-label page](https://www.sendible.com/white-label)
- Pricing page: white-label is a paid add-on on Elite and Enterprise only, and it is presented as "use your web domain" — [Sendible pricing](https://www.sendible.com/pricing)
- Conflicting price figures: one Sendible marketing page lists a starting price of "$268 ($315 with 15% annual discount)" (wording garbled in the source), while third-party reviews cite a $299/mo add-on fee. Treat both as unverified — [Sendible white-label page](https://www.sendible.com/white-label); third-party reviews (e.g. [Rebellink review](https://www.rebellink.com/tool/sendible-review/), [Elegant Themes review, 2025](https://www.elegantthemes.com/blog/business/sendible-review))

**Reports**
- Pricing page: standard reports are on every tier. Premium adds 2 custom reports per workspace and Elite adds 3. The page was truncated, so the Enterprise entry was not visible — [Sendible pricing](https://www.sendible.com/pricing)

**Plans and limits** (official page structure; prices from third parties because the official page did not render amounts)
- Core 1 workspace / 6 profiles; Plus 3 / 18; Premium 7 / 42; Elite 15 / 90; Enterprise 50 / 300. **Unlimited users** on all tiers. Annual billing saves 15% — [Sendible pricing](https://www.sendible.com/pricing)
- Approval workflows are inconsistent on the official page. The features tab lists approval features for Core, but the plan summary adds "Assignment & approvals" only from Plus — [Sendible pricing](https://www.sendible.com/pricing)
- Third-party monthly prices: Core $35, Plus $99, Premium $199, Elite $299, Enterprise $750. Annual-billed equivalents: $30, $84, $169, $254, $638 — [Blotato: Sendible pricing](https://www.blotato.com/blog/sendible-pricing); [Cloud Campaign answers (Aug 2026)](https://www.cloudcampaign.com/answers/sendible-alternatives-agencies). Conflicting: RecurPost lists Elite at $399 and Core at $29 — [RecurPost (updated Aug 6, 2026)](https://recurpost.com/social-media-tools/sendible)

### Inferences
- Sendible separates **account connection** (Client Connect widget plus emailed reconnect link, no login) from **content review** (client user login, optionally on a white-labelled domain). That is a useful split for Podo Social: connection and re-auth could also work through a single-purpose magic link.
- Pricing per workspace (6 profiles) with unlimited users means Sendible's real limit is clients, not seats. This is a pricing pattern an agency tool can copy.

### Gaps
- Whether Sendible offers **no-login approval links** at all. No official documentation was found; the evidence points to login-based client approval plus email notifications.
- Whether multi-level approval exists, and any **expiry, revocation or password settings** for client-facing links. None were found publicly.
- The exact current prices from Sendible itself, because amounts did not render. The detailed Client Connect widget steps and network list are also not public on the pages retrieved. The support.sendible.com articles returned 403, so the findings from them rest on search snippets only.

## SocialPilot: client management, client connect, client approval workflow, white-label reports, pricing tiers

### Takeaway
SocialPilot uses a **"Client" user role** with per-account access and toggleable permissions: View/Comment, Connect Accounts, Analytics, Inbox, Library, Approve, Auto-Approve and Publish. Agencies invite clients by email or with a **reusable Client Invite Link** that lets them sign up and connect their own accounts, optionally restricted by platform. The link can be disabled or refreshed, and refreshing invalidates the old one. Approval runs per account ("Need Client Approval"). Clients can approve without logging in through **"Approvals on the Go"** links, and **Auto-Approve** publishes posts still pending 1 hour before their scheduled time. White-label covers the logo, UI and PDF reports; "Advanced White Label" is Enterprise-only. No expiry or security model is documented for the approval links.

### Cited Findings
**Onboarding and connecting client accounts**
- Manual invite: Profile → Users → Invite User, enter the email, select the **Client** role, set permissions, link accounts, then Send Invite. A Client cannot later be converted to a team-member role — [SocialPilot help: How do I invite a client?](https://help.socialpilot.co/article/573-how-do-i-add-clients-to-my-team)
- **Client Invite Link**: available from the dropdown beside Invite User. One link can invite multiple clients, and only the Owner or Admin can add clients. Admins can restrict the link to certain platforms, so joining clients can connect only those platforms — [SocialPilot help: invite a client](https://help.socialpilot.co/article/573-how-do-i-add-clients-to-my-team)
- Invite-link controls: admins can **enable or disable the link for any period** and **refresh** it, which makes the old link inactive. Permission and platform settings apply to everyone who joins through that link. No fixed expiry is stated — [SocialPilot help: invite a client](https://help.socialpilot.co/article/573-how-do-i-add-clients-to-my-team)
- After signing up through the link, clients are directed to a page where they connect their social accounts. The link can be distributed by email or embedded on a website — [SocialPilot help category / product update: client & team invites](https://www.socialpilot.co/product-update/client-and-team-invites) (search snippet)
- Client Management mailer: you enter the client's name and email, choose which networks they should connect, and add your company logo and brand name to the invitation email — [SocialPilot: Client management (get started)](https://socialpilot.co/get-started/client-management/) (search snippet)
- Clients **cannot delete or disconnect** accounts once connected; they must contact the Account Manager. Connections stop once the plan's account cap is reached. Instagram *personal* profiles need credentials, but business profiles do not — [SocialPilot help: connect my client's account](https://help.socialpilot.co/article/434-how-do-i-connect-my-client-s-account-in-socialpilot) (search snippet)
- No feature named "Client Connect" was found in SocialPilot's documentation. The equivalent is the invite link or invite email plus the "Connect Accounts" permission — [SocialPilot help: invite a client](https://help.socialpilot.co/article/573-how-do-i-add-clients-to-my-team)

**Per-client permissions**
- Client permissions are View and Comment (default), Connect Accounts (optional), View Analytics, Social Inbox (Facebook/Instagram/GBP/LinkedIn), Library Access (view or edit per library), Approve Posts, Auto-Approve and Publish Post — [SocialPilot help: manage client access](https://help.socialpilot.co/article/343-how-do-i-manage-my-clients-access); [invite a client](https://help.socialpilot.co/article/573-how-do-i-add-clients-to-my-team)
- Adding a client to a social account gives them manager-level access to view that account's posts. Deleting an account from the client's side removes only the client's access — [SocialPilot help: manage client access](https://help.socialpilot.co/article/343-how-do-i-manage-my-clients-access)
- Clients with **Publish Post** count as team members and use a seat. The example given is the Agency plan with 5 team members plus the owner. No separate cap on clients is stated — [SocialPilot help: invite a client](https://help.socialpilot.co/article/573-how-do-i-add-clients-to-my-team)

**Approval workflow**
- Approval is configured per social account: Manage Accounts → edit → Account Details → "Need Client Approval" → Clients tab → Approver → Save. At least one client must be an Approver, and the client must already have access to that account — [SocialPilot help: manage client access](https://help.socialpilot.co/article/343-how-do-i-manage-my-clients-access)
- **Auto-Approve** publishes posts still awaiting client approval **1 hour before the scheduled time** — [SocialPilot help: manage client access](https://help.socialpilot.co/article/343-how-do-i-manage-my-clients-access)
- **Approvals on the Go**: direct approval links show all in-review content. Clients can review "with one click and without the need to log in", filter by account or platform, then "Approve to Publish" or "Send back" with comments. The links work on phone, tablet or PC. The page states no expiry, security or plan details. Its image paths suggest roughly September 2023, but no date is announced — [SocialPilot product update: Approvals on the Go](https://www.socialpilot.co/product-update/approvals-on-the-go)
- Clients "don't need login credentials to approve content", and links are sent by email — [SocialPilot feature: Client management](https://www.socialpilot.co/features/client-management)
- No multi-level approval chain was found in the SocialPilot documentation. The model is a single client-approval gate per account.

**Reports and white-label**
- White-label covers "your brand logo, user interface, and analytics PDF reports". Reports go to the client's inbox as consolidated PDFs — [SocialPilot feature: Client management](https://www.socialpilot.co/features/client-management)
- Report recipients can open reports without logging into SocialPilot — [SocialPilot: Advanced reports](https://socialpilot.co/features/advanced-reports) (search snippet)
- Third-party claim, from a competitor with a commercial stake: SocialPilot's interface, approval emails and client login stay SocialPilot-branded, and white-labelling stops at reports. This is not confirmed by official documentation — [Cloud Campaign](https://www.cloudcampaign.com/smm-tips/is-socialpilot-effective-white-label-agencies)

**Pricing** (conflicting; flag)
- The official pricing page as served to this fetch (localised to India, INR) showed **Standard** ₹2,000/mo monthly or ₹1,700/mo annual, with 10 accounts, 1 user and no client management. **Premium** was ₹6,000/mo or ₹5,100/mo, with 30 accounts, 3 users, client management, white-label reports and client approval. **Enterprise** was custom, with unlimited users, unlimited clients and "Advanced White Label". Extra accounts are ₹200/mo, and extra users on Premium are ₹200/mo — [SocialPilot pricing](https://www.socialpilot.co/pricing)
- The USD tiers reported by third parties disagree with each other:
  - Essentials $30/mo monthly ($25.50 annual), Standard $50 ($42.50), Premium $100 ($85), Ultimate $200 ($170) — [SocialChamp, competitor blog, 2026](https://www.socialchamp.com/blog/socialpilot-pricing/)
  - Essentials $20 ($17 annual), Standard $40 ($34), extra accounts $4/mo, "verified July 10, 2026" — [postfa.st](https://postfa.st/socialpilot-alternatives)
  - The older help-centre example references an "Agency" plan — [SocialPilot help](https://help.socialpilot.co/article/573-how-do-i-add-clients-to-my-team)

### Inferences
- SocialPilot's **refreshable invite link** is the closest documented precedent for a revocable onboarding link: one link, many clients, preset permissions and platform allow-list, and kill-and-rotate on demand.
- The **Auto-Approve at T-1h** fallback is a notable pattern for agencies whose clients are slow to approve. Podo Social could make it a per-client opt-in.
- The INR pricing (₹1,700–₹6,000/mo, client features only from Premium) is a directly relevant price benchmark for an Indian agency tool. It needs a human re-check because it was served geo-localised.

### Gaps
- Expiry, single-use behaviour, revocation or password protection for **Approvals on the Go** links are not documented publicly.
- Whether invite emails and approval pages can use a custom domain or sender. The vendor pages are silent, and the competitor claim says no.
- Canonical USD prices and plan names as of October 2026. Sources conflict, and the official page served INR.
- Whether SocialPilot's help centre names a feature "Client Connect". Nothing was found under that name.

## Planable: workspaces per client, guest approvers, multi-level approval, share links and security settings

### Takeaway
Planable is **workspace-per-client** and priced per workspace with unlimited users. Each workspace has its own pages, calendar, members, approvals and labels. Clients are invited as **"Client" membership** (they see only external-facing content and comments) with a role such as Approver or Guest, plus granular toggles. Approval types are None and Optional (Basic), Required (Pro), and **Multi-level** (Enterprise only). People without an account can **view and comment through a public post share link** and do not use a seat. Invite links **expire after 7 days** and can be deleted. No password protection or expiry setting was found for public share links.

### Cited Findings
**Workspaces and roles**
- Each workspace is a separate environment for one client or brand, with its own pages, calendar, members, approvals, templates, labels and timetable. Access does not carry over between workspaces, and one person can hold different roles in different workspaces — [Planable guide: workspaces](https://planable.io/guides/planable-workspaces/)
- The roles are Owner (transferable, irreversibly), Administrator, Contributor (create, edit, schedule, publish), Writer (create and edit), Approver ("approve content and leave feedback only") and Guest ("view content only") — [Planable guide: workspaces](https://planable.io/guides/planable-workspaces/)
- **Client is a membership type, not a role.** Client members see only external-facing content and comments, while team members also see internal notes and drafts — [Planable guide: workspaces](https://planable.io/guides/planable-workspaces/)
- The granular per-person toggles are View, Approve, Edit, Publish, Analyze, Engage and Admin; for example, a client who can approve but not edit — [Planable guide: workspaces](https://planable.io/guides/planable-workspaces/)
- Clients are invited through the "Workspace users" button with their email and name, and should be invited as "Client" members so that work in progress stays hidden — [Planable help: managing users](https://help.planable.io/hc/articles/21715463679644) (search snippet; page returned 403). The help-centre pages conflict on whether clients need an individual account or can skip sign-up — same source plus [Planable help: user permissions](https://help.planable.io/en/articles/2367538-user-permissions) (snippets)
- **Invite links** can be created only by Administrators. They grant a preset membership type and permission level, **lapse after 7 days**, and can be deleted at any time — [Planable guide: workspaces](https://planable.io/guides/planable-workspaces/)

**Guest and external access without an account**
- "Create public share link" (desktop) or "Share post link" (mobile) creates a per-post link that works without a Planable account. "No sign-in is required to view or comment", and "public guests do not count towards your workspace members limit" — [Planable help: share posts with a public link](https://help.planable.io/en/articles/3803135-share-posts-with-a-public-link) (search snippet; the page returned 404 on direct fetch and may have moved)
- Planable's own blog says clients who don't want an account can receive a "guest view link" to review and comment without logging in — [Planable blog: content calendar tools](https://planable.io/blog/content-calendar-tools/) (search snippet)
- Whether a public-link guest can **approve**, rather than only view and comment, is not confirmed. The help snippet mentions viewing and commenting only, and Approver is a member role.

**Approval workflows**
- Approval types: None; Optional; **Required** (Pro), where at least one approval is needed before publishing; **Multi-level** (Enterprise), with two or more approval levels before publishing. Per-workspace settings cover who may approve, auto-schedule on approval, locking content after approval, and reminders for pending approvals — [Planable guide: workspaces](https://planable.io/guides/planable-workspaces/); [Planable pricing](https://planable.io/pricing/)
- The multi-level example given is internal approvers (content creator → design → executive) followed by final client approval — [Planable help: client approval guide](https://help.planable.io/hc/en-us/articles/22581435847324) (search snippet)
- Bulk approval is available on Pro and Enterprise but not Basic — [Planable pricing](https://planable.io/pricing/)

**Reports**
- Analytics is a paid add-on on Basic and Pro and included on Enterprise. It covers fast reports, page and post metrics, audience, best time to post, and competitors — [Planable pricing](https://planable.io/pricing/)
- Client-ready reports can be exported or shared as a link — [Planable blog](https://planable.io/blog/content-calendar-tools/) (search snippet; vendor marketing)
- No white-label offering was found on the pricing page — [Planable pricing](https://planable.io/pricing/)

**Plans and limits** (official pricing page, 2026-10-09)
- **Basic $33/workspace/month**: unlimited users, 60 posts/workspace/month, 4 social pages, 3 campaigns, 10 GB, approvals None or Optional, 1-week version history.
- **Pro $49/workspace/month**: 150 posts, 10 pages, 10 campaigns, 50 GB, approvals add Required, bulk approval, 30-day version history.
- **Enterprise**: custom pricing, needed for 5+ workspaces; unlimited posts, 50 pages, Multi-level approval, analytics and inbox included, SSO.
- The yearly toggle shows "2 months free". The page was ambiguous about whether $33/$49 are annual-billed rates.
- Add-ons per workspace per month: Analytics $12 (cards) or $14 (table/FAQ); Inbox $7.5 or $9; Listening $82.5 or $99. These inconsistencies are on the page itself. Free trial: 50 posts total with no time limit — [Planable pricing](https://planable.io/pricing/)

### Inferences
- Planable's **Client membership** flag (external-facing content only, separate from role) is a clean data-model pattern: `membership_type ∈ {team, client}` × `role` × permission toggles, scoped per workspace.
- Planable puts **time-limited links** (7 days) on *invites*, while its per-post public view and comment links seem to have no documented expiry. That is a security gap a magic-link approver design can improve on.

### Gaps
- No public documentation was found on **password protection, expiry or revocation of public share links** beyond invite links (7-day lapse, deletable). The share-link help article 404'd on direct fetch.
- Whether guests on a public link can approve. Unconfirmed.
- Whether a whole-calendar or feed share link exists, as opposed to per-post links, and with what controls. Not confirmed from official docs.

## Common patterns across all three: onboarding a new client, approval links, per-client reporting

### Takeaway
All three treat the **client as a scoped container**: a Sendible workspace, a Planable workspace, or in SocialPilot a client user mapped to specific accounts. Each has a **no-password account-connection flow**: OAuth through Sendible's widget and reconnect email, or SocialPilot's invite link plus the Connect Accounts permission. Each offers an **external, no-login path for feedback**: SocialPilot approval links, Planable public post links, and Sendible's emailed reconnect links. Formal approval still leans on a role (Approver or Client) attached to a user. None of the three publicly documents expiry, password or audit controls on client-facing approval links. The only documented link controls are SocialPilot's disable and refresh on invite links and Planable's 7-day lapse on invite links.

### Cited Findings
- Onboarding through a self-serve link or widget that clients use to connect their own accounts by OAuth: Sendible Client Connect widget — [Sendible](https://www.sendible.com/features/client-connect?hsLang=en); SocialPilot Client Invite Link — [SocialPilot help](https://help.socialpilot.co/article/573-how-do-i-add-clients-to-my-team); Planable invite links lapsing after 7 days — [Planable guide](https://planable.io/guides/planable-workspaces/)
- Restricting the client's connect scope: SocialPilot lets admins allow-list platforms per invite link or user — [SocialPilot help](https://help.socialpilot.co/article/343-how-do-i-manage-my-clients-access)
- Re-authentication handled outside the app by email link: Sendible — [Sendible](https://www.sendible.com/features/client-connect?hsLang=en)
- No-login approval or feedback: SocialPilot Approvals on the Go (approve or send back) — [SocialPilot](https://www.socialpilot.co/product-update/approvals-on-the-go); Planable public link (view and comment, no seat) — [Planable help](https://help.planable.io/en/articles/3803135-share-posts-with-a-public-link) (snippet)
- Approval gating is per account (SocialPilot "Need Client Approval") or per workspace (Planable approval type; Sendible client "requires approval") — sources above
- Multi-level approval is publicly documented only for Planable, and only on Enterprise — [Planable guide](https://planable.io/guides/planable-workspaces/)
- Per-client reporting: Sendible has standard and custom reports per workspace plus white-label client login — [Sendible pricing](https://www.sendible.com/pricing); SocialPilot emails PDF reports that recipients can open without logging in — [SocialPilot](https://www.socialpilot.co/features/client-management); Planable reports are a per-workspace analytics add-on — [Planable pricing](https://planable.io/pricing/)
- The pricing unit is the client: Sendible charges per workspace in bundles of 6 profiles with unlimited users; Planable charges per workspace with unlimited users; SocialPilot charges per account and seat, with client features gated to Premium or Agency tiers and above — sources above

### Inferences
- A magic-link approver for Podo Social would sit between SocialPilot's no-login approval links and Planable's Approver role. To exceed all three on security, it should add documented **expiry, single-client scoping, revocation or rotation (as in SocialPilot's refresh), and an audit trail of who approved from which link**, none of which these tools document publicly.
- Separating "connect and reconnect accounts" links from "approve content" links, as Sendible does, reduces the blast radius if a link leaks.
- A T-1h auto-approve fallback (SocialPilot) and approval reminders (Planable) both address slow client approvals.

### Gaps
- None of the three publicly documents the token lifetime, password option or revocation for approval or share links. Their internal implementation is not public.
- White-label depth for approval emails and pages (custom sender domain) is documented only for Sendible.
- Pricing in all three cases needs confirmation directly on the vendor pages. Sendible's amounts did not render, SocialPilot's page was geo-localised to INR, and Planable's page has internal inconsistencies.
