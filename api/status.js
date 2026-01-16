// api/status.js - Health check endpoint

module.exports = async (req, res) => {
  res.json({
    status: 'ok',
    product: 'AllCampus Licensing Email Generator',
    version: '1.0.0',
    endpoints: {
      generate: '/api/generate?limit=10',
      preview: '/api/preview?contactId=123'
    },
    config: {
      hubspot: !!process.env.HUBSPOT_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      listId: process.env.HUBSPOT_LIST_ID || 'not set'
    }
  });
};
