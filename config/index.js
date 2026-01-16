// config/index.js - All configuration in one place

module.exports = {
  // Product info
  product: {
    name: "AllCampus Licensing Model",
    tagline: "OPM-quality support without the revenue share",
    pricing: {
      base: "$9,615/month",
      media_fee: "12.5% of spend",
      contract: "Month-to-month"
    }
  },

  // Map job titles to personas
  personas: {
    VP_ENROLLMENT: {
      patterns: ['enrollment', 'admissions', 'recruitment', 'student services'],
      pain: "Missing enrollment targets despite marketing spend",
      hook: "enrollment growth",
      economic_buyer: "PROVOST"
    },
    VP_MARKETING: {
      patterns: ['marketing', 'communications', 'brand', 'creative'],
      pain: "Marketing spend not converting to enrollments",
      hook: "marketing ROI",
      economic_buyer: "PROVOST"
    },
    PROVOST: {
      patterns: ['provost', 'academic affairs', 'chief academic', 'vp academic'],
      pain: "Online programs underperforming strategic goals",
      hook: "strategic enrollment growth",
      economic_buyer: "PROVOST"
    },
    CFO: {
      patterns: ['cfo', 'chief financial', 'finance', 'vp finance', 'treasurer'],
      pain: "ROI on marketing investments unclear",
      hook: "predictable ROI",
      economic_buyer: "CFO"
    },
    DEAN_ONLINE: {
      patterns: ['dean', 'online', 'distance', 'extended', 'continuing', 'adult'],
      pain: "Growing online without adequate support",
      hook: "online program growth",
      economic_buyer: "PROVOST"
    },
    PROGRAM_DIRECTOR: {
      patterns: ['program director', 'program manager', 'coordinator', 'mba', 'nursing'],
      pain: "Program enrollment below capacity",
      hook: "filling your program",
      economic_buyer: "DEAN_ONLINE"
    }
  },

  // Email sequence configuration
  emails: {
    e1: {
      name: "Initial Outreach",
      problem_focus: "enrollment_gap",
      length: "50-70 words",
      structure: "Hook → Pain → Capability → Soft CTA"
    },
    e2: {
      name: "Value Add",
      problem_focus: "conversion_rates",
      length: "40-60 words", 
      structure: "New angle → Specific result → Question"
    },
    e3: {
      name: "Soft Close",
      problem_focus: "competitive_positioning",
      length: "30-50 words",
      structure: "Final value → Easy out → Clear CTA"
    }
  },

  // HubSpot property names for storing emails
  hubspotProperties: {
    email1Subject: 'generated_email_1_subject',
    email1Body: 'generated_email_1_body',
    email2Subject: 'generated_email_2_subject',
    email2Body: 'generated_email_2_body',
    email3Subject: 'generated_email_3_subject',
    email3Body: 'generated_email_3_body',
    generatedAt: 'generated_at'
  },

  // Key differentiators to weave in
  differentiators: [
    "Month-to-month (no long-term contract)",
    "No revenue share (keep 100% of tuition)",
    "Sub-5-minute speed-to-lead response",
    "Dedicated enrollment specialists (not call centers)",
    "40+ university partnerships",
    "Transparent reporting"
  ],

  // Results to reference
  results: [
    "40-60% enrollment increase in year one",
    "67% improvement in inquiry-to-enrollment conversion",
    "ROI of 300-500% within first year"
  ],

  // Subject line templates by persona
  subjectTemplates: {
    e1: {
      VP_ENROLLMENT: ["{firstname} - enrollment thought", "Quick question about {institution}'s conversions"],
      VP_MARKETING: ["{firstname} - marketing ROI thought", "Question about {institution}'s marketing ROI"],
      PROVOST: ["{institution}'s enrollment position", "Can this help {institution}?"],
      CFO: ["{firstname} - cost savings thought", "ROI question for {institution}"],
      DEAN_ONLINE: ["{firstname} - online program thought", "Quick question about enrollment"],
      PROGRAM_DIRECTOR: ["The support {institution} might be missing", "{firstname} - program growth thought"]
    },
    e3: {
      default: "Re: {previousSubject}"
    },
    e4: {
      VP_ENROLLMENT: ["One more thought for {institution}", "{firstname}, quick question"],
      VP_MARKETING: ["{firstname}, one last thought", "Quick follow-up"],
      PROVOST: ["One last thought on growth", "Final thought for {institution}"],
      CFO: ["One more thought on ROI", "{firstname} - final thought"],
      DEAN_ONLINE: ["One more thought on growth", "Question about {institution}'s programs"],
      PROGRAM_DIRECTOR: ["Question about your program", "{firstname}, quick question"]
    }
  }
};
