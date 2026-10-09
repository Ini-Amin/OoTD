# OoTD Product Plan

> **Discover real outfits, shop the pieces, share your style, and earn if you choose to.**

## 1. Product vision

**OoTD** combines fashion inspiration, social media, and commerce:

- **Pinterest-like discovery** for outfit inspiration, collections, trends, and aesthetics.
- **Social profiles** where people share their outfits and follow style creators.
- **Shoppable looks** with product and affiliate links attached to outfit pieces.
- **Creator services** where people can optionally make outfits or styling recommendations for others, with optional tips or payment.
- **Future circular-fashion features** where users can give away, sell, swap, or donate old clothes.

The key principle is that **OoTD is creator-first**. Anyone can create a user profile and publish OoTDs at launch, except brands. Brands participate through a separate verified product catalog, so real people, independent creators, and small brands can be discovered without allowing large brands to dominate the social experience.

---

## 2. The OoTD concept

An **OoTD** is the main type of post on the platform. It is more than a photo: it is a complete outfit someone can discover, save, recreate, shop, or use for inspiration.

Each OoTD can include:

- One or more outfit photos
- A title and caption
- Style tags, such as `streetwear`, `minimal`, `vintage`, `hijab fashion`, or `workwear`
- Occasion tags, such as work, date night, campus, travel, wedding, or festival
- Season and weather information
- Optional fit notes, including size, height, or how an item fits
- Tagged clothing, accessories, and beauty products
- Optional external shopping or affiliate links, after automated safety validation
- Styling notes from the creator

Users can like, comment, save, share, or add OoTDs to their own collections.

---

## 3. Users and value

| User | Main goal | OoTD value |
|---|---|---|
| Style explorer | Find fashion ideas | Personalized outfit feed, boards, trends, and search |
| Creator / affiliate | Share outfits and possibly earn | Shoppable OoTDs, links, analytics, and a creator storefront |
| Small fashion brand | Make products available to creators | Product catalog and product attribution without controlling the social feed |
| Stylist / curator | Help others dress or plan looks | Portfolio, styling requests, optional payments, and tips |
| Shopper | Find items that fit a desired look | Tagged products, alternatives, price information, and external links |
| Circular-fashion user | Give unused clothes a new life | Future give-away, swap, resale, and donation listings |

---

## 4. Product principles

### 4.1 Creator-first discovery

Outfits and people should be the center of the platform—not advertisements. Discovery should reward relevance, quality, originality, and a healthy variety of creators.

### 4.2 Commerce is optional

A user should be able to post an OoTD simply for inspiration. Product tags and affiliate links are available, but are not required.

### 4.3 Payments and tips are optional

Some people may enjoy creating outfits or styling recommendations for others as a hobby. They can do so for free. Others can enable optional tips or set a price for a service.

### 4.4 Profiles are personal creative spaces

Profiles should feel like a personal homepage, inspired by early social platforms such as Friendster or MySpace—but with modern usability, performance, accessibility, and safety.

### 4.5 Support small creators and small brands

OoTD should avoid a pay-to-win feed. Small creators and independent brands should have meaningful opportunities to be discovered.

### 4.6 Circular fashion belongs in the long-term vision

Fashion does not need to mean buying new things. Reusing, giving away, swapping, selling, and donating clothing should become part of OoTD after the core community is established.

---

## 5. Profile customization

Full profile customization is a meaningful differentiator, but it should be delivered in safe stages. Completely unrestricted HTML/CSS customization is risky because it can harm performance, accessibility, security, and mobile usability.

### Version 1: configurable profile themes

Users can customize:

- Avatar and header image
- Background color, accent color, and font pairing from approved options
- Bio, pronouns, location, and style identity
- Style tags and favorite aesthetics
- Featured OoTDs
- Featured collections or mood boards
- Link blocks for social media, shop links, or portfolios
- A customizable grid style for their posts

### Future: modular profile homepage

Users can arrange profile modules, for example:

- Intro / bio
- Featured outfit
- Recent OoTDs
- Collections
- Wishlist
- Currently loving
- Favorite creators
- Styling services
- Shop my links
- Clothing giveaway or swap listings
- Guestbook-style messages, if moderation controls are strong enough

This retains the fun personal-homepage feeling without allowing unsafe custom scripts or arbitrary code.

### Future: community-made theme marketplace

OoTD can later let users design and publish reusable profile themes. A theme is a safe, platform-defined package—not custom code—and may include approved colors, fonts, background assets, grid presets, and module arrangements.

- Theme creators can publish free themes first.
- Premium themes and creator earnings should come later, after OoTD has enough active users and payout/KYC requirements are ready.
- Every public theme needs automated checks and, when necessary, moderation for accessibility, copyright, inappropriate imagery, and impersonation.
- Themes cannot contain JavaScript, custom HTML, tracking pixels, external embeds, or arbitrary CSS.

---

## 6. Brand participation model

Brands should not operate like normal fashion creators in the social feed.

### Brands should not be able to

- Create standard social creator profiles
- Publish normal organic OoTD posts in the creator feed
- Follow and comment on users as a brand account
- Pay to dominate the main inspiration feed at launch

### Brands can use a limited product catalog

Verified brands can:

- Upload product photos, descriptions, categories, prices, and store URLs
- Keep stock and availability information current
- Receive attribution when creators tag their products
- View aggregated product metrics, such as saves, outfit tags, and outbound clicks
- Start with free or low-cost catalog access while the marketplace is growing

Brands and merchants—not OoTD—handle product checkout, fulfillment, returns, customer support, and delivery for product purchases.

### Fair distribution safeguards

- Rank outfits ahead of raw product popularity.
- Cap repeated exposure from the same brand or creator in a browsing session.
- Give promising new creators and small brands exploration opportunities.
- Keep paid promotion separate from organic creator discovery.
- Clearly label sponsored posts, gifted items, and paid collaborations.

---

## 7. MVP: first version

The first product should prove three key behaviors:

1. People create and share outfits.
2. People discover, save, and follow outfits and creators.
3. Some creators choose to attach useful shopping links.

### 7.1 Accounts and profiles

- Email or social sign-in
- Username, display name, bio, and avatar
- Style preferences during onboarding
- Public/private profile option
- Basic profile theme customization
- Follow/unfollow creators

### 7.2 OoTD creation

- Upload one or multiple images
- Add caption and outfit title
- Add aesthetic, occasion, season, and category tags
- Tag products manually
- Add optional external or affiliate links
- Save as draft or publish

### 7.3 Discovery and social features

- Personalized home feed
- Explore page
- Search by creator, aesthetic, occasion, tag, and product category
- Likes, comments, follows, and shares
- Saved collections / mood boards
- Creator profile pages

For the earliest version, a chronological or lightly relevance-ranked feed is enough. A complex recommendation algorithm can wait until there is meaningful behavior data.

### 7.4 Product and affiliate links

- Product name, brand, category, price, and external URL
- **Automated link safety validation** before a link becomes public
- Affiliate disclosure label selected by the creator
- Outbound click tracking
- Basic creator dashboard with clicks and estimated earnings

Do not require manual verification for every ordinary creator link in the MVP; it will slow publishing and create a large operations burden. Instead, validate the URL automatically: require HTTPS, check redirect destinations, block known risky domains and URL shorteners, and disable links that later fail checks or receive credible reports.

Use stronger verification for **brand-catalog products**: verify the brand, its catalog administrator, and the merchant/product domain. A catalog product can receive a visible `Verified brand product` label. This makes the distinction honest: a normal creator link is a checked external link, while a catalog link has stronger business verification.

OoTD sends users to the merchant or affiliate destination. Brands and merchants handle product checkout and fulfillment; OoTD does not process merchant orders in the first version.

---

## 8. Optional styling help and tips

Some users can make OoTD recommendations for other people.

### Example use cases

- Help me choose an outfit for a wedding
- Build a modest-fashion outfit under a set budget
- Create a campus wardrobe from clothes I already own
- Find a date-night look
- Make a mood board for my trip

### Creator options

A creator can choose one of these modes:

- **Free help:** anyone can request ideas, with no payment expected.
- **Tips welcome:** the creator offers help for free, but users may leave an optional tip after receiving it.
- **Paid service:** the creator sets a price for a defined styling service.

### First service flow

1. A user submits an outfit/styling request.
2. They include context: event, budget, measurements or size preferences if desired, preferred styles, deadline, and optional reference photos.
3. A creator accepts, declines, or proposes a different price/timeline.
4. The creator delivers a look, mood board, product links, or written recommendations.
5. The requester can optionally tip, or pays if the service was listed as paid.

Start with asynchronous digital recommendations. Live calls and in-person styling can be supported in the future, but only through a clear approved-service agreement—not informal or unprotected arrangements.

### Live and in-person service protection

A brand, merchant, or organizer that wants a creator to provide live or in-person styling must use an OoTD service agreement. This is important to prevent abuse, unpaid labor, or unclear expectations.

The agreement should define:

- The brand/organizer identity and verified contact information
- The creator's role, deliverables, schedule, and location
- Compensation, tips, travel reimbursement, and payment timing
- Whether products are gifted, borrowed, returned, or owned by the creator
- Content usage rights and disclosure requirements
- Cancellation, safety, and dispute rules

Creators should be able to decline opportunities, set their own price, and report brands or organizers that violate agreements. The platform should not require creators to work for free in exchange for "exposure."

---

## 9. Future: pre-loved clothing and giving back

Pre-loved clothing can become a **separate OoTD product or website** in the future, rather than being added to the first social-fashion application. It may share an OoTD identity or account system later, but it should have its own safety, exchange, payment, and logistics design.

This keeps the first OoTD product focused on outfit discovery and creators, while allowing circular fashion to become a serious product when the team is ready.

### Possible listing types

- **Give away:** offer clothing for free to another user.
- **Swap:** exchange clothing with another user.
- **Sell pre-loved:** list used clothing at a price.
- **Donate:** connect clothing with approved charities or local donation partners.
- **Borrow / rent:** potentially later, after trust and logistics systems are mature.

### Important safety and trust requirements

- Clear item-condition labels and photos
- Location privacy controls
- Safe pickup guidance or shipping support
- User ratings only after completed exchanges
- Prohibited-item policy
- Reporting, dispute, and anti-scam controls
- Potential identity verification for sellers, depending on local regulations and payment requirements

For Indonesia, this could later support local payment methods and delivery partners, but it is best to validate the community and listing behavior before building complex logistics integrations.

---

## 10. Monetization strategy

### Phase 1: affiliate links

- Creators attach affiliate or external purchase links to their looks.
- OoTD may take a fee only when it provides the tracking or affiliate infrastructure.
- Letting creators use their own links for free at first can help attract creators.

### Phase 2: optional styling services

- Free requests remain possible.
- Tips are voluntary.
- OoTD takes a platform fee only from paid styling work, plus payment processing fees where applicable.

### Phase 3: brand tools

- Free or low-cost verified brand catalog during early growth, followed by paid advanced tools
- Brand product analytics
- Store/catalog integrations
- Structured creator collaboration and live-service agreements

### Avoid at the beginning

- Feed ads
- Paid feed ranking
- Expensive creator subscriptions
- Paid verification as a status symbol

These would undermine the creator-first identity too early.

---

## 11. Trust, safety, and legal basics

Fashion, affiliate links, payments, and community exchanges all need protection from the beginning.

### Initial requirements

- Report and block features
- Content moderation workflow
- Copyright and image-ownership reports
- Prohibition of counterfeit, unsafe, or misleading listings
- Affiliate-link and sponsored-content disclosure
- Rules for paid collaborations and gifted products
- Product-link verification, review, and abuse prevention
- Privacy controls for location, sizing, and personal details
- Clear terms for styling services, cancellation, refunds, and disputes
- Verified organizer/brand agreements for live or in-person work
- No unpaid-work requirement: creators must explicitly agree to any free collaboration

### Payment note

Do not manually calculate commissions from arbitrary affiliate URLs. Begin with creator-owned affiliate links or a supported affiliate network/merchant integration.

For paid styling work, use a marketplace payment provider that supports payouts and identity verification when legally required.

---

## 12. Suggested navigation

- **Home** — personalized OoTD feed
- **Explore** — styles, trends, creators, occasions, and products
- **Create** — publish an OoTD
- **Requests** — styling requests, messages, tips, and paid work
- **Profile** — customizable personal homepage, looks, collections, links, and listings

---

## 13. Core data model

| Entity | Purpose |
|---|---|
| `User` | Profile, preferences, role, and customization settings |
| `Outfit` | An OoTD post with media, caption, tags, and visibility |
| `OutfitItem` | A tagged product or clothing item within an outfit |
| `Product` | Catalog product details, price, URL, and brand attribution |
| `BrandCatalog` | Verified brand and its catalog management data |
| `Collection` | User-created saved outfit and product boards |
| `Follow` | Relationship between users |
| `Comment` | Comments and moderation state |
| `StyleService` | Optional free, tip-based, or paid creator offerings |
| `StylingRequest` | A request for help, requirements, progress, and delivery |
| `Transaction` | Optional payments, tips, platform fee, and payout state |
| `AffiliateClick` | Outbound-link tracking and attribution |
| `PreLovedListing` | Future giveaway, swap, sale, or donation item listing |

---

## 14. Delivery roadmap

### Milestone 1 — Fashion social foundation

**Goal:** Prove that users want to post and discover OoTDs.

- Authentication and onboarding
- Basic custom profiles
- OoTD creation and image uploads
- Home feed, explore, search
- Likes, comments, follows, saves
- Collections / mood boards
- Reporting and moderation baseline

**Success signal:** users repeatedly post, save outfits, and return to browse.

### Early launch strategy: solve the cold start

Do not launch to every fashion audience at once. Start with one clearly defined Indonesian community where people already share outfit inspiration, for example a campus-style community, a modest-fashion community, local thrift/vintage creators, or a streetwear community. The exact group should be chosen based on the founder's real access to creators—not only what looks large online.

1. Recruit **30–50 founding creators** before public launch. They must agree to post real content; do not fill the product with copied or fake outfits.
2. Ask each founding creator to publish **5–10 OoTDs** before or during the first month. This creates enough content for visitors to browse.
3. Give founding creators meaningful non-cash benefits: early profile customization, a founding badge, direct feedback access, featured launch collections, and first access to future affiliate tools.
4. Launch as an invite-only beta for friends and followers of those creators. A small, active feed is better than a large, empty public launch.
5. Add easy sharing of an OoTD to Instagram, TikTok, WhatsApp, and other channels so creators bring their existing audience back to OoTD.
6. Run a simple weekly theme or challenge, such as `Campus Monday`, `Thrift Friday`, or `One Item Three Looks`, to make posting easier.
7. Measure whether users save outfits, follow creators, and return the next week. Expand only after the first community has repeat activity.

**Do not pay creators just for random posts unless there is a clear agreement and budget.** A small founding community that genuinely likes the product is more sustainable than paying for content that does not create retention.

### Milestone 2 — Shoppable looks

**Goal:** Prove product discovery and creator-commerce intent.

- Product tagging
- External and affiliate links
- Click tracking
- Creator earnings dashboard
- Product search
- Basic verified brand catalog
- Affiliate and sponsorship disclosure

**Success signal:** users click product links and creators keep posting tagged looks.

### Milestone 3 — Styling community

**Goal:** Enable direct value exchange between users and creators.

- Styling profile / availability toggle
- Free, tip-based, and paid request modes
- Structured styling requests
- Request messages and delivery
- Tips and optional payments
- Reviews after completed requests

**Success signal:** users complete requests, optionally tip, and return for future styling help.

### Milestone 4 — Separate circular-fashion product

**Goal:** Validate a dedicated give-away, swap, resale, and donation experience without weakening the core OoTD product.

- Separate product/site scope and safety policy
- Give-away listings
- Swaps and pre-loved sales
- Donation flows
- Location and shipping options
- Exchange safety tools and reputation

### Milestone 5 — Ecosystem and scale

- Better personalized recommendations
- Brand analytics and catalog integrations
- Creator-brand collaboration tools
- Local payments and shipping integrations
- Mobile applications
- Internationalization, including Indonesian language and Rupiah support

---

## 15. Suggested technical direction

For an initial web MVP:

- **Frontend:** Next.js and TypeScript
- **Database/backend:** PostgreSQL with Supabase or a custom API
- **Authentication:** Supabase Auth, Clerk, or Auth.js
- **Image storage:** Supabase Storage or Cloudinary
- **Payments:** Stripe Connect or a payment provider that supports the launch market and marketplace payouts
- **Search:** PostgreSQL full-text search first; dedicated search later if necessary
- **Analytics:** product analytics platform or a simple internal event table

Start as a web application. Build native mobile apps after validating recurring use and the core social loop.

---

## 16. Confirmed launch decisions and remaining questions

### Confirmed

1. **Publishing:** everyone can create a profile and publish OoTDs at launch, except brands. Brands use the separate product catalog.
2. **Links:** ordinary creator links receive automated safety validation, not manual verification. Brand-catalog products require stronger business, domain, and product verification.
3. **Brand catalog pricing:** begin free or low-cost, then charge for advanced brand tools once the marketplace has proven value.
4. **Product fulfillment:** the brand or merchant handles purchase checkout, fulfillment, returns, delivery, and product customer support.
5. **Styling services:** creators decide whether each service is free, tip-based, or paid. Live or in-person brand engagements require a verified organizer agreement that protects the creator from abuse and unpaid labor.
6. **Theme marketplace:** community-made themes are a later feature; themes use safe platform controls and may become a creator-earnings product.
7. **Pre-loved clothing:** give-away, swap, resale, and donation flows will be a separate future OoTD product/site.

### Still to decide

1. Which countries are included at launch? This affects payments, affiliates, language, currency, shipping, and regulation.
2. Do brands upload products manually first, or through store integrations later?
3. Which profile customization options belong in version 1?
4. Will pre-loved clothing start with free local giveaways, or wait until shipping/payment protections are ready?

---

## 17. Recommended first build

Build a **creator-first, customizable social fashion platform** with:

1. User profiles with safe theme/layout customization
2. OoTD outfit posts
3. Feed, discovery, follows, saves, and collections
4. Optional product and affiliate links
5. Clear disclosure and moderation features

After people are actively creating and discovering looks, add optional styling requests, tips, payments, and eventually the pre-loved clothing community.
