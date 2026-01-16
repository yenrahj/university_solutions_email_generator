// api/generate.js - Main endpoint for email generation

const hubspot = require('../lib/hubspot');
const openai = require('../lib/openai');
const config = require('../config');

module.exports = async (req, res) => {
  console.log('🚀 Starting email generation...');
  const startTime = Date.now();
  
  // Get environment variables
  const hubspotKey = process.env.HUBSPOT_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const listId = process.env.HUBSPOT_LIST_ID;
  
  if (!hubspotKey || !openaiKey || !listId) {
    return res.status(500).json({ 
      error: 'Missing required environment variables',
      required: ['HUBSPOT_API_KEY', 'OPENAI_API_KEY', 'HUBSPOT_LIST_ID']
    });
  }
  
  try {
    // Get contacts from HubSpot list
    const limit = parseInt(req.query.limit) || 10;
    console.log(`📋 Fetching up to ${limit} contacts from list ${listId}...`);
    
    const contacts = await hubspot.getContacts(hubspotKey, listId, limit);
    console.log(`Found ${contacts.length} contacts`);
    
    if (contacts.length === 0) {
      return res.json({ success: true, processed: 0, message: 'No contacts in list' });
    }
    
    const results = [];
    
    for (const contact of contacts) {
      const contactId = contact.vid || contact.id;
      const props = contact.properties || {};
      
      try {
        // Extract contact info
        const firstname = props.firstname?.value || '';
        const lastname = props.lastname?.value || '';
        const jobtitle = props.jobtitle?.value || 'Administrator';
        const email = props.email?.value || '';
        const prospectResearch = props.prospect_research_summary?.value || '';
        
        console.log(`\n📧 Processing: ${firstname} ${lastname} (${jobtitle})`);
        
        // Get company research from HubSpot
        const company = await hubspot.getCompanyResearch(hubspotKey, contact);
        console.log(`   Institution: ${company.name}`);
        
        if (prospectResearch) {
          console.log(`   Prospect research: Found (${prospectResearch.length} chars)`);
        }
        
        // Use prospect research (which already includes IPEDS data from the enrichment API)
        let combinedResearch = '';
        if (prospectResearch) {
          combinedResearch += `${prospectResearch}\n\n`;
        }
        if (company.research) {
          combinedResearch += `COMPANY NOTES: ${company.research}`;
        }
        
        // Determine persona from job title
        const persona = categorizeRole(jobtitle);
        console.log(`   Persona: ${persona}`);
        
        // Build the prompt
        const prompt = buildPrompt({
          firstname,
          lastname,
          jobtitle,
          institution: company.name,
          research: combinedResearch,
          persona,
          industry: company.industry,
          size: company.size
        });
        
        // Generate emails (returns structured object)
        console.log('   Generating emails...');
        const emails = await openai.generateEmails(openaiKey, prompt);
        
        // Log what we got
        console.log(`   Email 1: "${emails.email1?.subject}"`);
        console.log(`   Email 2: "${emails.email2?.subject}"`);
        console.log(`   Email 3: "${emails.email3?.subject}"`);
        console.log(`   Email 4: "${emails.email4?.subject}"`);
        console.log(`   Email 5: "${emails.email5?.subject}"`);
        
        // Save to HubSpot (10 separate fields)
        await hubspot.saveEmails(hubspotKey, contactId, emails);
        
        results.push({
          contactId,
          name: `${firstname} ${lastname}`,
          status: 'success'
        });
        
        // Rate limiting
        await sleep(500);
        
      } catch (error) {
        console.error(`❌ Error processing ${contactId}:`, error.message);
        results.push({
          contactId,
          status: 'error',
          error: error.message
        });
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const successCount = results.filter(r => r.status === 'success').length;
    
    console.log(`\n✅ Complete in ${duration}s - ${successCount}/${results.length} successful`);
    
    return res.json({
      success: true,
      processed: results.length,
      successful: successCount,
      duration: `${duration}s`,
      results
    });
    
  } catch (error) {
    console.error('❌ Generation failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Categorize job title into persona
 */
function categorizeRole(jobtitle) {
  const title = (jobtitle || '').toLowerCase();
  
  for (const [persona, data] of Object.entries(config.personas)) {
    if (data.patterns.some(p => title.includes(p))) {
      return persona;
    }
  }
  
  // Default based on common patterns
  if (title.includes('vp') || title.includes('vice president')) return 'VP_ENROLLMENT';
  if (title.includes('director')) return 'DEAN_ONLINE';
  if (title.includes('dean')) return 'DEAN_ONLINE';
  
  return 'VP_ENROLLMENT'; // Default
}

/**
 * Build the prompt for OpenAI - let GPT do strategy analysis
 */
function buildPrompt({ firstname, lastname, jobtitle, institution, research, persona, industry, size }) {
  return `**ANALYZE THIS RESEARCH AND GENERATE A 5-EMAIL SEQUENCE**

You MUST output a STRATEGY section first, then all 5 emails.

**PROSPECT:**
- Name: ${firstname} ${lastname || ''} (DO NOT use in emails - HubSpot adds greeting)
- Title: ${jobtitle}
- Institution: ${institution}

**RESEARCH:**
${research || 'No detailed research available.'}

**REMEMBER:**
1. Output STRATEGY section first (hook type, sequence plan, which research detail each email uses)
2. Then output all 5 emails with ===EMAIL X=== markers
3. ZERO names in email body
4. Email 1 and Email 4 are NEW threads (no "Re:")
5. Emails 2, 3, 5 are replies (use "Re: [subject]")
6. Natural numbers ("nearly tripled" not "194%")
7. **EXECUTIVE CONVERSATIONAL TONE** - Professional but warm. Complete sentences. "I noticed" not "Saw".
8. Subject lines: 5-8 words (not 3-5)
9. Word counts: Email 1: 50-75, Email 2: 40-60, Emails 3-4: 90-120, Email 5: 40-60
10. **CALENDAR LINKS** - Emails 3, 4, 5 MUST include: [Here's my calendar](https://meetings.hubspot.com/jack-harney/allcampus)

**EMAIL-SPECIFIC PERSONALIZATION (CRITICAL):**
- Email 1: Lead with primary hook (news, buying signal, pain, or data)
- Email 2: Different angle + case study
- Email 3: Value prop + DIFFERENT HOOK from Emails 1-2 + calendar link
- Email 4: Different value prop + ANOTHER specific detail + calendar link (NEW THREAD)
- Email 5: Circle back to Email 1's initiative + calendar link

**DO NOT write generic value props. CONNECT each value prop to their specific situation.**`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
