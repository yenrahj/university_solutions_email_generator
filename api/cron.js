// api/cron.js - Cron job to process contacts and generate emails
// Runs every 5 minutes, processes 5 contacts per run

const hubspot = require('../lib/hubspot');
const openai = require('../lib/openai');
const config = require('../config');

// Configuration
const LIST_ID = process.env.HUBSPOT_LIST_ID || 1242; // University Solutions email generation list
const BATCH_SIZE = 3;

module.exports = async (req, res) => {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow manual triggers in development or if no secret is set
    if (process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const hubspotKey = process.env.HUBSPOT_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!hubspotKey || !openaiKey) {
    console.error('❌ Missing API keys');
    return res.status(500).json({ error: 'Missing API keys' });
  }

  const startTime = Date.now();
  console.log(`\n🕐 Cron job started at ${new Date().toISOString()}`);
  console.log(`📋 Fetching up to ${BATCH_SIZE} unprocessed contacts from list ${LIST_ID}...`);

  try {
    // Get unprocessed contacts from list
    const contacts = await hubspot.getContacts(hubspotKey, LIST_ID, BATCH_SIZE, true);

    if (contacts.length === 0) {
      console.log('✅ No unprocessed contacts found. Queue is empty.');
      return res.json({
        success: true,
        message: 'No unprocessed contacts',
        processed: 0,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      });
    }

    console.log(`📧 Found ${contacts.length} contacts to process`);

    const results = [];

    for (const contact of contacts) {
      const contactId = contact.vid;
      const props = contact.properties || {};
      const firstname = props.firstname?.value || '';
      const lastname = props.lastname?.value || '';
      const jobtitle = props.jobtitle?.value || 'Administrator';
      const prospectResearch = props.prospect_research_summary?.value || '';

      console.log(`\n👤 Processing: ${firstname} ${lastname} (${contactId})`);

      try {
        // Get company info
        const company = await hubspot.getCompanyResearch(hubspotKey, contact);

        // Use prospect research (which already includes IPEDS data from the enrichment API)
        let combinedResearch = '';
        if (prospectResearch) {
          combinedResearch += `${prospectResearch}\n\n`;
        }
        if (company.research) {
          combinedResearch += `COMPANY NOTES: ${company.research}`;
        }

        // Categorize role
        const persona = categorizeRole(jobtitle);
        const personaData = config.personas[persona];

        // Build prompt
        const prompt = buildPrompt({
          firstname,
          jobtitle,
          institution: company.name,
          research: combinedResearch,
          persona,
          industry: company.industry,
          size: company.size
        });

        // Generate emails
        console.log('   Generating emails...');
        const emails = await openai.generateEmails(openaiKey, prompt);

        // Log what we got
        console.log(`   Email 1: "${emails.email1?.subject}"`);
        console.log(`   Email 2: "${emails.email2?.subject}"`);
        console.log(`   Email 3: "${emails.email3?.subject}"`);
        console.log(`   Email 4: "${emails.email4?.subject}"`);
        console.log(`   Email 5: "${emails.email5?.subject}"`);

        // Save to HubSpot
        await hubspot.saveEmails(hubspotKey, contactId, emails);

        results.push({
          contactId,
          name: `${firstname} ${lastname}`,
          status: 'success'
        });

        // Rate limiting between contacts - 5 seconds to prevent 429 errors
        await sleep(5000);

      } catch (error) {
        console.error(`❌ Error processing ${contactId}:`, error.message);
        results.push({
          contactId,
          name: `${firstname} ${lastname}`,
          status: 'error',
          error: error.message
        });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const successCount = results.filter(r => r.status === 'success').length;

    console.log(`\n✅ Cron complete in ${duration}s - ${successCount}/${results.length} successful`);

    return res.json({
      success: true,
      processed: results.length,
      successful: successCount,
      failed: results.length - successCount,
      duration: `${duration}s`,
      results
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
    });
  }
};

function categorizeRole(jobtitle) {
  const title = (jobtitle || '').toLowerCase();

  for (const [persona, data] of Object.entries(config.personas)) {
    if (data.patterns.some(p => title.includes(p))) {
      return persona;
    }
  }

  if (title.includes('vp') || title.includes('vice president')) return 'VP_ENROLLMENT';
  if (title.includes('director')) return 'DEAN_ONLINE';
  if (title.includes('dean')) return 'DEAN_ONLINE';

  return 'VP_ENROLLMENT';
}

function buildPrompt({ firstname, lastname, jobtitle, institution, research, persona, industry, size }) {
  return `**EXECUTE THE OUTREACH STRATEGY FOR THIS PROSPECT**

**PROSPECT:**
- Name: ${firstname} ${lastname || ''} (DO NOT use in emails - HubSpot adds greeting)
- Title: ${jobtitle}
- Institution: ${institution}

**STRATEGIC OUTREACH PLAN:**
${research || 'No detailed research available.'}

**YOUR TASK:**
The report above contains a COMPLETE STRATEGY created by our sales strategist. Your job is to EXECUTE it by writing 5 emails that follow the guidance precisely.

**READ AND FOLLOW:**
1. TONE STRATEGY - Use the recommended tone, formality, and technical depth
2. EMAIL-BY-EMAIL STRATEGY - Each email has specific instructions for what to say
3. PAIN POINT ANALYSIS - Address pain points in the emails specified
4. SERVICE PRIORITIZATION - Emphasize the services marked as primary/secondary
5. SPECIFIC REFERENCES - Include "MUST Mention" items, avoid "DO NOT Mention" items
6. SUBJECT LINE SUGGESTIONS - Use them or create similar ones

**CRITICAL RULES:**
- Zero names in email body (HubSpot adds greeting)
- Check for news about contact → use "your" not their name
- Only reference programs within their CONTACT SCOPE
- Only mention Course Design if marked "YES with evidence"
- Emails 3, 4, 5 must include calendar link

Output the 5 emails in ===EMAIL X=== format now.`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
