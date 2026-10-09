# Agency → client models in Agorapulse, Vista Social and Sprout Social (as of Oct 2026)

Research run 2026-10-09. Primary sources are official help centers, pricing pages and API docs. Some help-center pages returned HTTP 403 to direct fetch. Facts from those pages come from search-result snippets of the official URL and are marked "(snippet)". Third-party sources are labelled.

## Agorapulse: organizations vs workspaces, roles per workspace, client shared calendar/approval, reports

### Takeaway
Agorapulse has a three-level model: **Organization → Workspaces → Social profiles**. Each user holds one organization role plus a separate role on every profile they can access. Restricting a member to particular workspaces (which is how clients get isolated) and custom roles both require the unpriced **Custom** plan. Clients approve posts through a **Shared Calendar** that works from an email invite or link, with no Agorapulse login and no paid seat. Profile-level reports are white-label on every plan. Scheduled and PPTX "Power Reports" start at Advanced, and the read-only Analytics Open API is Custom-only. Every API request is scoped by organization ID + workspace ID + profile ID.

### Cited Findings
**Hierarchy and roles**
- The Organization is the top-level account. Organization roles cover account-wide settings, billing and user management. Profiles are managed inside workspaces, and a member can be given access to specific profiles within a workspace, each with its own profile role. The article was dated July 29, 2026. — [Agorapulse: Team management settings explained](https://support.agorapulse.com/en/articles/9542481-team-settings-explained)
- Paid organization roles:
  - **Owner**: one per organization, full control, transferable, Admin on all profiles.
  - **Co-owner**: manages subscription, team and settings, and connects profiles. Admin on all profiles.
  - **Manager**: manages users, profiles and organization settings. Read-only on the subscription but can buy add-ons. Admin on all profiles.
  - **Advanced Member**: no account settings. Can be assigned profiles and by default can connect or remove profiles.
  - **Member**: profile permissions only.
  - Only Owner, Co-owner and Manager can open Team management. — [same](https://support.agorapulse.com/en/articles/9542481-team-settings-explained)
- Free-seat roles:
  - **Profile Connector**: can connect, renew and remove only the profiles and ad accounts they connected. Cannot publish, reply in the inbox or view reports.
  - **Archie user**: Archie (the AI assistant) and Publishing only. — [same](https://support.agorapulse.com/en/articles/9542481-team-settings-explained)
- Profile roles:
  - **Admin**: full access.
  - **Editor**: everything except configuration.
  - **Moderator**: all Inbox features and can schedule posts, but cannot publish them, so their posts need approval.
  - **Guest**: view-only.
  - Profile roles, including Guest, can only be assigned to paid seats. — [same](https://support.agorapulse.com/en/articles/9542481-team-settings-explained)
- "Workspace access management" lets you choose which workspaces a Member can see. It is available on **Custom plans**. Co-owners and Managers automatically see all workspaces. — [same](https://support.agorapulse.com/en/articles/9542481-team-settings-explained)
- Custom organization and profile roles are Custom-plan only. — [Agorapulse permissions matrix (snippet)](https://support.agorapulse.com/en/articles/8764534-agorapulse-permissions-matrix); [pricing](https://www.agorapulse.com/pricing/) ("Custom roles & permissions": Custom only)
- Billing is per seat. Each subscription includes one user, and every invited user needs another seat. — [Agorapulse: managing your team (snippet)](https://support.agorapulse.com/en/articles/9542494-managing-your-team)
- Older help-article versions list different role sets (Owner/Manager/Member). Use the July 2026 article above. — [snippet of older version](https://intercom.help/agorapulse/en/articles/9542481-team-settings-explained)
- Agorapulse marketing describes agency use as "separate groups for each client" in one dashboard, with "no need to switch between accounts". — [Agorapulse agencies page](https://www.agorapulse.com/features/agencies/)
- **Third-party (competitor Cloud Campaign):** claims Agorapulse client separation is group-based rather than workspace-based. — [Cloud Campaign](https://www.cloudcampaign.com/smm-tips/agorapulse-for-marketing-agencies-evaluation)

**Client access and approvals**
- **Shared Calendar.** External reviewers need no Agorapulse account. They get access by email invite ("New access to __ calendar" → "See content") or by a shared link. They can view posts for the profiles they were given, approve or reject them, and comment. — [Agorapulse: access the shared calendar as an external user (snippet)](https://support.agorapulse.com/en/articles/12010367-how-to-access-the-shared-calendar-as-an-external-user)
- Approved content publishes at the scheduled time and rejected content is not scheduled. Each calendar has a URL showing scheduled, published, to-approve and rejected content. — [Agorapulse release note (snippet)](https://agorapulse.com/release-notes/shared-calendar-for-easy-content-approval-collaboration); [Shared calendar explained (snippet)](https://support.agorapulse.com/en/articles/9979006-shared-calendar-explained)
- An older release note priced shared calendars at **$19 per calendar** and said reviewers do not count against user limits. This is likely outdated, since current plans bundle calendars. — [release note (snippet)](https://agorapulse.com/release-notes/shared-calendar-for-easy-content-approval-collaboration)
- Plan gating:
  - Simple one-step approvals, routed "to teammates or clients": Professional and up.
  - Multi-step approval workflows: Custom only.
  - Shared calendars: none on Standard or Professional, 5 on Advanced, unlimited and customizable on Custom.
  - "Profile Connector" (clients connect their own profiles): Advanced and up. — [Agorapulse pricing](https://www.agorapulse.com/pricing/)

**Reports**
- Profile-level report types: Audience, Posts Insights, Community Management, Competitors, Meta Ads, and **Report Studio** (a customizable grid/widget builder).
- "Power Reports" (automated report exports, PPTX export, custom comparison periods) need Advanced or Custom.
- Only profile Admins and Editors can create Report Studio reports, schedule exports or export.
- Data retention: Standard 6 months, Professional 12 months, Advanced and Custom 24 months. — [Agorapulse reports explained](https://support.agorapulse.com/en/articles/11066993-agorapulse-reports-explained)
- Pricing page features by plan:
  - White-label reporting: all plans.
  - PDF/CSV export: all plans.
  - PPTX export: Advanced and up.
  - Scheduled report emails: Advanced and up.
  - Cross-network group reports: Advanced and up.
  - ROI report: Advanced and up.
  - Reports open API: Custom only. — [Agorapulse pricing](https://www.agorapulse.com/pricing/)

**API**
- The Analytics Open API is read-only and exports report data (the same data as CSV exports) for BI tools. It is available on the Custom plan.
- Each user generates a personal API key under Personal settings → API Keys. A key's access mirrors that user's permissions, and Agorapulse recommends an Owner or Manager key for full coverage.
- **Every request needs organization ID, workspace ID and profile ID.** Docs are at api.agorapulse.com/docs.
- The API excludes custom reports, ROI reports and Listening. — [Agorapulse Analytics Open API (snippet)](https://support.agorapulse.com/en/articles/9155447-analytics-open-api); [How to connect to Open API (snippet)](https://support.agorapulse.com/en/articles/12417183-how-to-connect-to-agorapulse-s-open-api)
- **Third-party (Supergood):** reports a rate limit of 500 requests per 30 minutes and coverage of 6 networks. The help center says Facebook, Instagram and LinkedIn. Unverified. — [Supergood API report card](https://supergood.ai/api-report-card/agorapulse)

**Pricing (USD, per user/month; the page shows two unlabelled figures, read here as monthly vs annual)**
- Standard $99 / $79 annual. Professional $149 / $119. Advanced $199 / $149. Custom is quote-only.
- 10 social profiles per plan (Custom: unlimited). Extra profiles are shown as "$10 / $15 per month each", apparently with a strikethrough, so the current rate is unclear. — [Agorapulse pricing](https://www.agorapulse.com/pricing/)

### Inferences
- Agorapulse's "workspace" is the closest match to Podo's SocialCustomer. Its Organization maps to Podo's Organization. Per-profile roles sit underneath, so the role model is two-level: organization role plus per-profile role. Workspace-scoped member visibility being Custom-only suggests workspace isolation is treated as an enterprise feature.
- Approval without login, using a tokenized calendar link that doesn't consume a seat, is a core agency pattern in Agorapulse.
- The API's org/workspace/profile ID triple is a clean model for Podo's own API scoping: `organizationId` / `socialCustomerId` / `profileId`.

### Gaps
- Whether workspaces exist on non-Custom plans (as containers without access restriction), and how many workspaces each plan allows. The help center does not define "workspace".
- Whether the shared calendar link supports passwords or expiry, and whether it shows multi-step stages. Not found.
- Details of the white-label options (logo upload, removing Agorapulse branding). The reports article does not cover them.
- Whether there is an all-clients overview or a workspace switcher UI. No official documentation found.

## Vista Social: profile groups, roles per group, approval workflows, client access, white-label tier

### Takeaway
Vista Social's tenant is an account. Inside it, **profile groups** act as client containers, and Vista recommends one profile group per client. The roles are Account Admin, Profile Group Admin, and Restricted User, who gets feature-level No Access, View or Manage permissions plus a "Contributor" publish level. Approval workflows can mix internal steps with a final client step done through a **shared calendar link** that needs no login and can carry a password and an expiry. White-label reports and dashboard plus client profile-connect sit on **Scale ($449/mo)**. Custom-domain white-labelling is also sold as an add-on. The API is a paid add-on enabled by sales, and there is also an MCP server with profile-group tools.

### Cited Findings
**Hierarchy and roles**
- Profile groups are "like containers for a brand, client, group, or project". All connected profiles are grouped by profile group. You can schedule to a whole group at once, and reports can be scheduled by profile group. Only account admins can create profile groups. — [Vista Social: How to create profile groups](https://support.vistasocial.com/hc/en-us/articles/11328133941915-How-to-create-profile-groups-in-Vista-Social)
- Role types:
  - **Account admins**: full access, including closing the account.
  - **Profile group admins**: full access to specific profile groups only.
  - **Restricted users**: specific feature permissions or read-only access.
  - Each feature can be set to **No Access / View / Manage**.
  - Publish also has a **Contributor** level. Contributors' posts go to Pending Approval and admins are notified.
  - Only primary account holders and admins can change permissions.
  - A user can belong to only one subscription/team at a time. — [Vista Social help center (snippets across articles)](https://support.vistasocial.com/hc/en-us/articles/4409604728219); [related](https://support.vistasocial.com/hc/en-us/articles/10064132443163)
- Profile Group Settings can cap the number of profiles and users per group, or allow unlimited. Vista's agency guidance is one profile group per client, choosing which groups each invited team member can access. — [Vista Social help center (snippet)](https://support.vistasocial.com/hc/en-us/articles/21958238548123)

**Approvals and client access**
- Approval workflows live under Settings → Publishing Settings → Approval Workflows.
  - A step can be marked as a **Shared calendar** step for a client.
  - Posts are assigned to a workflow from the composer (Assign → workflow → Schedule).
  - Internal steps 1–2 can precede final client approval through the link. — [Vista Social help (snippet)](https://support.vistasocial.com/hc/en-us/articles/46361005152283); [Vista blog: approval workflow](https://vistasocial.com/insights/social-media-post-approval-workflow-in-vista-social/)
- Shared calendar links:
  - Created from Publishing Calendar → Export → Share, with "Viewers can approve" switched on.
  - Optional date range, expiry date and **password**.
  - Optional auto-delete on expiry, which permanently removes the link and its approval history access.
  - Viewers approve or reject and leave a note **without logging in**.
  - Vista recommends hiding "in review" posts until it is the client's turn. — [Vista: Shared Calendar – Reviewing content without logging in (snippet; page returned 403 to fetch)](https://support.vistasocial.com/hc/en-us/articles/18158890067355-Shared-Calendar-Reviewing-content-without-logging-in); [Vista shared calendar guide](https://vistasocial.com/insights/streamline-content-approvals-vista-socials-shared-calendar-guide/)
- Help articles disagree on tier gating. One says Professional has single-step approval only, with multi-step unavailable. Another marks shared-calendar approvals unavailable on Professional. — [Vista help (snippets)](https://support.vistasocial.com/hc/en-us/articles/46353782814363)
- From the pricing page:
  - Shared calendars: Advanced 10, Scale 25, Enterprise 100 (customizable).
  - Approvals on Advanced cover "outside teams and clients".
  - "Client profile connect" (clients link their own profiles): Scale. — [Vista Social pricing](https://vistasocial.com/pricing/)

**Reports and white-label**
- Pricing page:
  - Scheduled reports: all plans.
  - Custom saved reports: Advanced and up.
  - "White label your reports and dashboard": Scale.
  - Custom domain for Vista Page: Advanced. — [Vista Social pricing](https://vistasocial.com/pricing/)
- The white-label setting in account settings puts the organization name and a square (1:1) logo on the report cover. Reports can have custom cover pages and sections can be removed. — [Vista white-label page](https://vistasocial.com/white-label/); [Vista help (snippet)](https://support.vistasocial.com/hc/en-us/articles/42319734243611)
- The **Custom Domain Whitelabeling** add-on puts your own domain on shared calendars, report links, connect links, email notifications and the dashboard. Vista sets it up, including SSL. — [Vista help (snippet)](https://support.vistasocial.com/hc/en-us/articles/16852036868507); [Vista white-label platform page](https://vistasocial.com/white-label-social-media-management-platform/)
- The help feature table (snippet) puts **Branded PDF Reports** as an add-on on Professional and included on Advanced, Scale and Enterprise. It shows custom domains for shared calendars as an add-on on Professional and a dashboard/login custom domain from Advanced. This conflicts with the pricing page, which puts white-label on Scale. — [Vista help (snippet)](https://support.vistasocial.com/hc/en-us/articles/16852036868507) vs [pricing](https://vistasocial.com/pricing/)

**API**
- The API is a **paid add-on enabled by an account rep**. Docs are public and pricing is given by sales. — [Vista Social blog: SMM API pricing](https://vistasocial.com/insights/social-media-management-api-pricing/)
- Vista publishes MCP tools including "Create profile group", "Find profile groups" ("in your workspace"), "Find profiles" (by name, network or profile group), queue listing, and "Lists approval workflows available for your profile groups". So profile group is the scoping unit exposed to integrations. — [Vista Social's Available MCP Tools](https://support.vistasocial.com/hc/en-us/articles/46525029430299-Vista-Social-s-Available-MCP-Tools)
- The pricing page lists integrations as MCP, Zapier and Make.com. — [pricing](https://vistasocial.com/pricing/)

**Pricing (USD)**
- Professional $99/mo ($950/yr): 15 profiles.
- Advanced $199/mo ($1,910/yr): 30 profiles.
- Scale $449/mo ($4,310/yr): 70 profiles, 4 users. Extra profiles come in packs of 10.
- Enterprise: custom, unlimited profiles, 8+ users.
- User counts conflict within the page: Professional is 2 in the table and 3 in the FAQ, Advanced is 3 vs 6.
- Add-ons: Listening $75/mo, X integration $29/mo, Employee Advocacy $199/mo for 25 employees. — [Vista Social pricing](https://vistasocial.com/pricing/)

### Inferences
- Vista's profile group is a direct analogue of Podo's SocialCustomer. The "Profile Group Admin" role (full control of only their group) matches a per-customer admin role in Podo.
- Client approval as a **typed step inside a multi-step workflow**, delivered through a password- and expiry-protected link, is the most complete public pattern of the three tools.
- The per-group profile and user caps suggest group-level quota enforcement is useful when agencies resell seats per client.

### Gaps
- REST API base URL, auth scheme and whether requests are scoped by group ID. The public docs URL was not found in this run.
- Whether multiple accounts can be linked under one agency (multi-account switching or an all-clients overview). Not found.
- Authoritative tier mapping for single-step vs multi-step approvals. Sources conflict.

## Sprout Social: groups/customers, permissions, approval workflows, report builder, API scoping

### Takeaway
Sprout's tenant is a **customer**, the Sprout account, identified by `customer_id` in the API. Inside it, **Groups** bundle social profiles and are the unit of user access. A profile can belong to several groups. Each user then gets a per-profile publishing level (No Access → Full Publishing, including "Needs Approval") plus feature permissions. Multi-step Message Approval Workflows, on Professional and Advanced, can include non-Sprout approvers by email. Scheduled PDF report delivery is Advanced-only, and shareable report links come with Premium Analytics. The public API (Advanced plan) puts every call under `/v1/{customer_id}/…` and filters by `group_id`.

### Cited Findings
**Hierarchy and permissions**
- Groups organize profiles so a team can be given a whole group instead of individual profiles. Creating, editing and moving profiles between groups needs the **Manage Permissions** company permission.
- Deleting a group removes profiles that belong only to that group. Profiles in several groups stay. — [Sprout: create, manage and organize Groups and Social Profiles (snippet; 403 on fetch)](https://support.sproutsocial.com/hc/en-us/articles/38267314140813-How-to-create-manage-and-organize-Groups-and-Social-Profiles-in-Sprout-Social)
- Per-profile permission levels: **No Access, Read Only, Needs Approval, Can Reply, Full Publishing**. Read Only is the minimum to see a profile under a group. — [Sprout Message Approval Product Guide (PDF)](https://media.sproutsocial.com/uploads/Sprout-Social-Message-Approval-Product-Guide.pdf)
- Feature permissions (Dashboard, Asset Library, Listening, Post Approvals, View Reporting, Manage Tags) are separate. The Roles & Team Members page has a Bulk User Permissions tool that filters by Groups/Profiles, Roles, Permissions or Teams. — [Sprout help (snippets)](https://support.sproutsocial.com/hc/en-us/articles/202443876); [Settings overview](https://support.sproutsocial.com/hc/en-us/articles/4415368915981-Settings-overview)

**Approvals**
- Message Approval Workflows: Professional and Advanced plans. Only users with the Administration company permission can create them.
  - Each step lists Sprout users or **email addresses of non-Sprout users** as approvers.
  - You choose who must approve at each step, and more steps can be added.
  - Optionally, Full Publishing users can skip steps.
  - The workflow is chosen in Compose → Publishing Workflows. — [Sprout help: Message Approval Workflows (snippet)](https://support.sproutsocial.com/hc/en-us/articles/205974715)
- "Needs Approval" users must submit messages before they reach Scheduled or Queue. The "Approve" permission lets Read-Only or Publish users approve. — [Sprout insights: message approval](https://sproutsocial.com/insights/message-approval-workflow)
- **Third-party claim (unverified):** messages that are not approved by send time are auto-rejected. Not confirmed in Sprout docs. — [search summary of third-party guide](https://posteverywhere.ai/blog/how-to-set-up-a-social-media-approval-workflow)

**Reports**
- Report Builder assembles custom reports from data modules and widgets, with notes. The source is a 2017 announcement, so the UI is likely changed. — [Sprout insights: Report Builder](https://sproutsocial.com/insights/?p=104522)
- Shareable report links can be **Public** (anyone with the link) or **Invite-only** (by email), with an optional dynamic date range and an expiry. — [Sprout help (snippet)](https://support.sproutsocial.com/hc/en-us/articles/24821431669773); [Premium Analytics](https://sproutsocial.com/features/premium-analytics)
- Scheduled recurring PDF delivery (weekly or monthly, to recipient emails) is **Advanced plan only**. — [Sprout: Scheduling and Sending Report PDFs (snippet)](https://support.sproutsocial.com/hc/en-us/articles/115002389306-Scheduling-and-Sending-Report-PDFs)
- Premium Analytics is an add-on, from Standard upward, and its price is not listed. Many Report Builder filters and widgets require it. — [Sprout pricing](https://sproutsocial.com/pricing/); [Sprout help (snippet)](https://support.sproutsocial.com/hc/en-us/articles/360042108512)

**API scoping**
- `GET /v1/metadata/client` takes no customer ID and returns the customer IDs and names the credentials can access. Every other path is `/v1/{customer_id}/…`. — [Sprout API docs](https://api.sproutsocial.com/docs/)
- Endpoints under `/v1/{customer_id}/metadata/customer`:
  - the root returns profiles, each with a `groups` array.
  - `/groups` returns `group_id` and name.
  - `/tags` returns tags limited to specific groups or available in all.
  - `/users`, `/teams`, `/topics` (Listening, each with a `group_id`) and `/queues` (case queues linked to teams). — [Sprout API docs](https://api.sproutsocial.com/docs/)
- The Messages endpoint accepts at most one `group_id`, and the requested profiles must belong to it. Multi-profile publishing requires the profiles to share a group. — [Sprout API docs](https://api.sproutsocial.com/docs/)
- Auth is either OAuth 2.0 (recommended; client config under Settings → Global Features → API; short-lived JWT; machine-to-machine and user flows) or API tokens generated by users with the API Permissions permission. Both are sent as `Authorization: Bearer`.
- Limits are 60 requests/min and 250,000 requests/month, with HTTP 429 when exceeded. — [Sprout API docs](https://api.sproutsocial.com/docs/)
- The pricing page puts "The Sprout API" on **Advanced**. — [Sprout pricing](https://sproutsocial.com/pricing/)

**Pricing (USD per seat/month)**
- Essentials: $79 annual or $99 monthly, 5 profiles. This tier appears new in 2026.
- Standard $199, 5 profiles.
- Professional $299, unlimited profiles.
- Advanced $399, unlimited profiles.
- Enterprise: custom.
- The page shows a single figure for Standard, Professional and Advanced, and the trial runs on annual billing. — [Sprout pricing](https://sproutsocial.com/pricing/)
- **Third-party (Agorapulse blog):** says scheduled reports are only on a "$499/mo" Sprout plan. This looks outdated against the current $399 Advanced price. — [Agorapulse: Sprinklr vs Sprout](https://www.agorapulse.com/blog/social-media-management-tools/sprinklr-vs-sprout-social/)

### Inferences
- In Sprout, an agency is normally one customer, with **one Group per client**. A single login reaching several customer IDs (via `/metadata/client`) implies multi-account access for agencies running separate Sprout accounts per client. The docs do not describe a switcher UI.
- Groups double as the API and data-partition key (tags, Listening topics and message queries are filtered by group). That supports Podo making `socialCustomerId` a mandatory filter on every query and on every tag or asset table.
- Sprout lets a profile belong to several groups, a many-to-many relationship. Podo's simpler one-profile-to-one-SocialCustomer design is stricter isolation.

### Gaps
- Whether Sprout reports can carry custom logos or be white-labelled. No official white-label documentation found; Sprout is generally not marketed as white-label.
- Limits on the number of groups per plan, and per-step approver counts. Not found.
- An official description of external guest or client portal access beyond email approvers and report links. Not found.
- Current monthly-billing prices for Standard, Professional and Advanced. Not shown on the page.

## Cross-cutting: plan tiers, prices and the agency model (summary of above)

### Takeaway
All three tools model agency as tenant and client as a container: an Agorapulse **workspace**, a Vista **profile group**, a Sprout **group**. In all three, users get access per container and permissions per profile or feature. All three let clients approve without a paid seat (Agorapulse and Vista through a link, Sprout through email approvers). Strong isolation, custom roles, multi-step approvals and APIs are gated to top tiers: Agorapulse Custom, Vista Scale/Enterprise or add-on, Sprout Professional/Advanced.

### Cited Findings
- Agorapulse: Custom-only for workspace access restriction, custom roles, multi-step approvals and the Open API. — [team settings](https://support.agorapulse.com/en/articles/9542481-team-settings-explained); [pricing](https://www.agorapulse.com/pricing/)
- Vista: Scale ($449/mo) for white-label reports and dashboard and client profile connect. The API is an add-on. — [pricing](https://vistasocial.com/pricing/); [API pricing post](https://vistasocial.com/insights/social-media-management-api-pricing/)
- Sprout: Professional+ for approval workflows, Advanced for the API and scheduled PDFs. — [approval help (snippet)](https://support.sproutsocial.com/hc/en-us/articles/205974715); [pricing](https://sproutsocial.com/pricing/); [scheduled PDFs (snippet)](https://support.sproutsocial.com/hc/en-us/articles/115002389306-Scheduling-and-Sending-Report-PDFs)
- Pricing units differ: Agorapulse and Sprout charge per user/seat, while Vista charges a flat plan price that includes a set number of users and profiles. — the three pricing pages above.

### Inferences
- For an Indian agency market, Vista's flat per-account pricing plus per-group caps is the closest fit for agencies with many small clients. Per-seat pricing (Agorapulse, Sprout) penalizes agencies with large teams.
- A no-login, tokenized client approval link with optional password and expiry is table stakes across competitors. Multi-step workflows with a client step and per-client white-label reports are the main differentiators.

### Gaps
- INR pricing or India-specific plans for any of the three. Not researched or found.
- Internal data isolation (separate databases vs row-level). Not public for all three.
- An all-clients agency overview dashboard. None of the three documents one explicitly in the sources found.
