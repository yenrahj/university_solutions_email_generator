# AllCampus Email Generator

Automated personalized email sequence generation for AllCampus sales outreach.

## What It Does

1. Pulls enriched contacts from HubSpot list (default: 1242)
2. Reads the prospect research summary from the enrichment tool
3. Uses OpenAI to generate a 5-email personalized sequence
4. Writes emails back to HubSpot contact properties

## Key Features

- **AllCampus Brand Voice**: Professional but warm, consultative not salesy
- **Contact Scope Awareness**: Only references data relevant to the contact's division
- **Self-Reference Handling**: Uses "your" not their name when news is about the contact
- **Course Design Restraint**: Only mentions course design if there's explicit evidence of need
- **Unique Sequences**: Each email has a different hook/angle

## Email Sequence Structure

1. **Email 1** (50-75 words): The Hook - specific detail from research
2. **Email 2** (40-60 words): The Proof - different angle + case study
3. **Email 3** (90-120 words): The Value - how AllCampus helps + calendar link
4. **Email 4** (90-120 words): Fresh Thread - new subject, different value prop + calendar link
5. **Email 5** (40-60 words): The Close - circle back + easy out + calendar link

## Environment Variables

```
HUBSPOT_API_KEY=your-hubspot-token
OPENAI_API_KEY=your-openai-key
HUBSPOT_LIST_ID=1242 (optional, defaults to 1242)
CRON_SECRET=your-cron-secret (optional)
```

## Deployment

Deploy to Vercel and set up a cron job to run the email generation queue.

## Critical Rules Enforced

- Zero names in email body (HubSpot adds greeting)
- Division scope filtering (Business Dean only sees business data)
- Self-reference rule (use "your" for news about contact)
- Course design only with explicit evidence
- No generic assumptions
- Each email must be unique
