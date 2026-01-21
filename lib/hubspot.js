// lib/hubspot.js - Simple HubSpot integration

const axios = require('axios');

const BASE_URL = 'https://api.hubapi.com';

/**
 * Get contacts from a HubSpot list (legacy v1 API)
 * @param {string} apiKey - HubSpot API key
 * @param {number} listId - Legacy list ID
 * @param {number} limit - Max contacts to return
 * @param {boolean} unprocessedOnly - Only return contacts without generated_at
 */
async function getContacts(apiKey, listId, limit = 10, unprocessedOnly = false) {
  let allUnprocessed = [];
  let vidOffset = null;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 10; // Safety limit - check up to 1000 contacts
  
  while (hasMore && allUnprocessed.length < limit && pageCount < maxPages) {
    pageCount++;
    
    const params = {
      count: 100,
      property: [
        'firstname', 'lastname', 'email', 'company', 'jobtitle',
        'associatedcompanyid', 'generated_email_draft', 'prospect_research_summary',
        'generated_at'
      ]
    };
    
    if (vidOffset) {
      params.vidOffset = vidOffset;
    }
    
    const response = await axios.get(
      `${BASE_URL}/contacts/v1/lists/${listId}/contacts/all`,
      {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        params,
        paramsSerializer: params => {
          return Object.entries(params)
            .flatMap(([key, value]) => {
              if (Array.isArray(value)) {
                return value.map(v => `${key}=${encodeURIComponent(v)}`);
              }
              return `${key}=${encodeURIComponent(value)}`;
            })
            .join('&');
        }
      }
    );
    
    const contacts = response.data.contacts || [];
    hasMore = response.data['has-more'] || false;
    vidOffset = response.data['vid-offset'] || null;
    
    if (unprocessedOnly) {
      // Filter for unprocessed contacts
      const unprocessed = contacts.filter(c => {
        const generatedAt = c.properties?.generated_at?.value;
        return !generatedAt || generatedAt === '';
      });
      allUnprocessed.push(...unprocessed);
      
      // Log progress if we're paginating
      if (pageCount > 1 || unprocessed.length === 0) {
        console.log(`   Page ${pageCount}: found ${unprocessed.length} unprocessed out of ${contacts.length} contacts`);
      }
    } else {
      return contacts.slice(0, limit);
    }
    
    // If we have enough, stop
    if (allUnprocessed.length >= limit) {
      break;
    }
  }
  
  return allUnprocessed.slice(0, limit);
}

/**
 * Get company details and research
 */
async function getCompanyResearch(apiKey, contact) {
  const props = contact.properties || {};
  const companyName = props.company?.value || 'your institution';
  
  // Try to get associated company
  if (props.associatedcompanyid?.value) {
    try {
      const response = await axios.get(
        `${BASE_URL}/crm/v3/objects/companies/${props.associatedcompanyid.value}`,
        {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          params: {
            properties: 'name,domain,industry,numberofemployees,description,notes,company_research_brief'
          }
        }
      );
      
      const company = response.data.properties || {};
      const research = company.company_research_brief || company.notes || company.description || '';
      
      return {
        name: company.name || companyName,
        research: research,
        industry: company.industry || '',
        size: company.numberofemployees || ''
      };
    } catch (e) {
      console.log('Could not fetch company:', e.message);
    }
  }
  
  // Fallback
  return {
    name: companyName,
    research: '',
    industry: '',
    size: ''
  };
}

/**
 * Save generated emails to contact (10 fields: 5 subjects + 5 bodies)
 * @param {string} apiKey - HubSpot API key
 * @param {string} contactId - Contact ID
 * @param {object} emails - { email1-5: {subject, body} }
 * NOTE: Requires HubSpot properties: generated_email_[1-5]_subject, generated_email_[1-5]_body
 */
async function saveEmails(apiKey, contactId, emails) {
  // Convert newlines to <br> tags so HubSpot sequences preserve line breaks
  const toHtml = (text) => (text || '').replace(/\n/g, '<br>');
  
  const properties = {
    // Email 1 (New Thread)
    generated_email_1_subject: emails.email1?.subject || '',
    generated_email_1_body: toHtml(emails.email1?.body),
    // Email 2 (Reply to #1)
    generated_email_2_subject: emails.email2?.subject || '',
    generated_email_2_body: toHtml(emails.email2?.body),
    // Email 3 (Reply to #1)
    generated_email_3_subject: emails.email3?.subject || '',
    generated_email_3_body: toHtml(emails.email3?.body),
    // Email 4 (New Thread)
    generated_email_4_subject: emails.email4?.subject || '',
    generated_email_4_body: toHtml(emails.email4?.body),
    // Email 5 (Reply to #4)
    generated_email_5_subject: emails.email5?.subject || '',
    generated_email_5_body: toHtml(emails.email5?.body),
    // Timestamp (full ISO string for single-line text field)
    generated_at: new Date().toISOString()
  };
  
  await axios.patch(
    `${BASE_URL}/crm/v3/objects/contacts/${contactId}`,
    { properties },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  console.log(`✅ Saved 5 emails for contact ${contactId}`);
}

/**
 * Get a single contact by ID (for testing)
 */
async function getContactById(apiKey, contactId) {
  const response = await axios.get(
    `${BASE_URL}/crm/v3/objects/contacts/${contactId}`,
    {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      params: {
        properties: 'firstname,lastname,email,company,jobtitle,associatedcompanyid,prospect_research_summary'
      }
    }
  );
  
  // Convert to v1 format for compatibility
  const contact = response.data;
  const v1Props = {};
  for (const [key, value] of Object.entries(contact.properties || {})) {
    v1Props[key] = { value };
  }
  
  return { id: contact.id, properties: v1Props };
}

module.exports = {
  getContacts,
  getCompanyResearch,
  saveEmails,
  getContactById
};
