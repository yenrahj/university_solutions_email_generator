// api/preview.js - Preview emails for a single contact without saving

const hubspot = require('../lib/hubspot');
const openai = require('../lib/openai');
const config = require('../config');

module.exports = async (req, res) => {
  const contactId = req.query.contactId || req.query.id;
  
  if (!contactId) {
    return res.status(400).json({ 
      error: 'Missing contactId parameter',
      usage: '/api/preview?contactId=123'
    });
  }
  
  const hubspotKey = process.env.HUBSPOT_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!hubspotKey || !openaiKey) {
    return res.status(500).json({ error: 'Missing API keys' });
  }
  
  try {
    console.log(`👀 Previewing emails for contact ${contactId}...`);
    
    // Get contact
    const contact = await hubspot.getContactById(hubspotKey, contactId);
    const props = contact.properties || {};
    
    const firstname = props.firstname?.value || '';
    const lastname = props.lastname?.value || '';
    const jobtitle = props.jobtitle?.value || 'Administrator';
    const email = props.email?.value || '';
    const prospectResearch = props.prospect_research_summary?.value || '';
    
    // Get company from HubSpot
    const company = await hubspot.getCompanyResearch(hubspotKey, contact);
    
    // Use prospect research (which already includes IPEDS data from the enrichment API)
    let combinedResearch = '';
    if (prospectResearch) {
      combinedResearch += `${prospectResearch}\n\n`;
    }
    if (company.research) {
      combinedResearch += `COMPANY NOTES: ${company.research}`;
    }
    
    // Categorize
    const persona = categorizeRole(jobtitle);
    const personaData = config.personas[persona];
    
    // Determine recommended style based on research
    let recommendedStyle = 'D (Peer Observation)';
    let styleReason = 'Limited research available';
    
    if (combinedResearch) {
      const hasPainPoints = /🔥 PAIN INDICATORS:|PAIN POINTS:/i.test(combinedResearch);
      const hasNews = /📰 RECENT DEVELOPMENTS:|NEWS HOOK:/i.test(combinedResearch);
      const hasBuyingSignal = /exploring partnerships|evaluating vendors/i.test(combinedResearch);
      
      if (hasNews) {
        recommendedStyle = 'A (News Hook)';
        styleReason = 'Recent news/developments found';
      } else if (hasBuyingSignal) {
        recommendedStyle = 'Buying Signal';
        styleReason = 'Active buying signals detected';
      } else if (hasPainPoints) {
        recommendedStyle = 'C (Pain Point Direct)';
        styleReason = 'Pain indicators found - address enrollment challenges';
      }
    }
    
    // Build prompt and generate
    const prompt = buildPrompt({
      firstname,
      lastname,
      jobtitle,
      institution: company.name,
      research: combinedResearch,
      industry: company.industry,
      size: company.size
    }, persona);
    
    const emails = await openai.generateEmails(openaiKey, prompt);
    
    return res.json({
      success: true,
      contact: {
        id: contactId,
        name: `${firstname} ${lastname}`.trim(),
        email,
        title: jobtitle,
        institution: company.name
      },
      research: {
        prospect: prospectResearch || null,
        hubspot: company.research || null
      },
      analysis: {
        persona,
        painPoint: personaData?.pain,
        economicBuyer: personaData?.economic_buyer,
        recommendedStyle,
        styleReason
      },
      emails: {
        email1: emails.email1,
        email2: emails.email2,
        email3: emails.email3,
        email4: emails.email4,
        email5: emails.email5
      },
      note: "This is a preview - emails were NOT saved to HubSpot. Body fields are HTML formatted."
    });
    
  } catch (error) {
    console.error('Preview error:', error);
    return res.status(500).json({ error: error.message });
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

function buildPrompt(contact, persona) {
  return `**ANALYZE THIS RESEARCH AND GENERATE A 5-EMAIL SEQUENCE**

You MUST output a STRATEGY section first, then all 5 emails.

**PROSPECT:**
- Name: ${contact.firstname} ${contact.lastname || ''} (DO NOT use in emails - HubSpot adds greeting)
- Title: ${contact.jobtitle}
- Institution: ${contact.institution}

**RESEARCH:**
${contact.research || 'No detailed research available.'}

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
