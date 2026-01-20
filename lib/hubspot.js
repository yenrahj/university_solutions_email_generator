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
  const response = await axios.get(
    `${BASE_URL}/contacts/v1/lists/${listId}/contacts/all`,
    {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      params: {
        count: unprocessedOnly ? 100 : limit, // Fetch more if filtering
        property: [
          'firstname', 'lastname', 'email', 'company', 'jobtitle',
          'associatedcompanyid', 'generated_email_draft', 'prospect_research_summary',
          'generated_at'
        ]
      },
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
  
  let contacts = response.data.contacts || [];
  
  // Filter for unprocessed contacts if requested
  if (unprocessedOnly) {
    contacts = contacts.filter(c => {
      const generatedAt = c.properties?.generated_at?.value;
      return !generatedAt || generatedAt === '';
    });
    // Limit after filtering
    contacts = contacts.slice(0, limit);
  }
  
  return contacts;
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
  const properties = {
    // Email 1 (New Thread)
    generated_email_1_subject: emails.email1?.subject || '',
    generated_email_1_body: emails.email1?.body || '',
    // Email 2 (Reply to #1)
    generated_email_2_subject: emails.email2?.subject || '',
    generated_email_2_body: emails.email2?.body || '',
    // Email 3 (Reply to #1)
    generated_email_3_subject: emails.email3?.subject || '',
    generated_email_3_body: emails.email3?.body || '',
    // Email 4 (New Thread)
    generated_email_4_subject: emails.email4?.subject || '',
    generated_email_4_body: emails.email4?.body || '',
    // Email 5 (Reply to #4)
    generated_email_5_subject: emails.email5?.subject || '',
    generated_email_5_body: emails.email5?.body || '',
    // Timestamp (full ISO string for single-line text field)
    generated_at: new Date().toISOString()
  };
  
  // Debug: log what we're sending
  console.log('Saving to HubSpot - Email 1 subject:', properties.generated_email_1_subject);
  console.log('Saving to HubSpot - Email 1 body length:', properties.generated_email_1_body.length);
  
  try {
    const response = await axios.patch(
      `${BASE_URL}/crm/v3/objects/contacts/${contactId}`,
      { properties },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('HubSpot response status:', response.status);
    console.log(`✅ Saved 5 emails for contact ${contactId}`);
  } catch (error) {
    console.error('HubSpot save error:', error.response?.data || error.message);
    throw error;
  }
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
