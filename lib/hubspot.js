// lib/hubspot.js - HubSpot integration for email generator

const axios = require('axios');

const BASE_URL = 'https://api.hubapi.com';

/**
 * Get contacts from a HubSpot list with pagination
 */
async function getContacts(apiKey, listId, limit = 10, unprocessedOnly = false) {
  let allUnprocessed = [];
  let vidOffset = null;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 10;

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
    vidOffset = response.data['vid-offset'];
    
    if (unprocessedOnly) {
      const unprocessed = contacts.filter(c => {
        const generatedAt = c.properties?.generated_at?.value;
        return !generatedAt || generatedAt === '';
      });
      console.log(`   Page ${pageCount}: found ${unprocessed.length} unprocessed out of ${contacts.length} contacts`);
      allUnprocessed.push(...unprocessed);
    } else {
      return contacts.slice(0, limit);
    }
    
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
  
  return {
    name: companyName,
    research: '',
    industry: '',
    size: ''
  };
}

/**
 * Save generated emails to contact
 * Includes: 5 subjects, 5 bodies, 5 subject formats, 5 email formats, linkedin, timestamp
 */
async function saveEmails(apiKey, contactId, emails) {
  // Convert newlines to <br> tags for HubSpot
  const toHtml = (text) => (text || '').replace(/\n/g, '<br>');
  
  const properties = {
    // Email 1
    generated_email_1_subject: emails.email1?.subject || '',
    generated_email_1_body: toHtml(emails.email1?.body),
    subject_1_format_used: emails.email1?.subjectFormat || '',
    email_1_format_used: emails.email1?.emailFormat || '',
    // Email 2
    generated_email_2_subject: emails.email2?.subject || '',
    generated_email_2_body: toHtml(emails.email2?.body),
    subject_2_format_used: emails.email2?.subjectFormat || '',
    email_2_format_used: emails.email2?.emailFormat || '',
    // Email 3
    generated_email_3_subject: emails.email3?.subject || '',
    generated_email_3_body: toHtml(emails.email3?.body),
    subject_3_format_used: emails.email3?.subjectFormat || '',
    email_3_format_used: emails.email3?.emailFormat || '',
    // Email 4
    generated_email_4_subject: emails.email4?.subject || '',
    generated_email_4_body: toHtml(emails.email4?.body),
    subject_4_format_used: emails.email4?.subjectFormat || '',
    email_4_format_used: emails.email4?.emailFormat || '',
    // Email 5
    generated_email_5_subject: emails.email5?.subject || '',
    generated_email_5_body: toHtml(emails.email5?.body),
    subject_5_format_used: emails.email5?.subjectFormat || '',
    email_5_format_used: emails.email5?.emailFormat || '',
    // LinkedIn
    linkedin_connection_content: emails.linkedin || '',
    // Timestamp
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
  
  console.log(`✅ Saved 5 emails + formats + LinkedIn for contact ${contactId}`);
}

/**
 * Get a single contact by ID
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
