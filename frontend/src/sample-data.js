(function (root) {
  root.SampleData = {
    inputs: { company_name: 'Symplify Marketing', consultant_name: 'Hichem A', consultant_email: '', price: '$75' },
    transcript: 'We need a reliable lead generation system that finds qualified merchant trade suppliers and delivers verified records every week.',
    proposal: {
      serviceType: 'lead generation',
      slides: [
        { type: 'cover', title: 'Lead generation for Symplify Marketing', serviceType: 'lead generation', subtitle: 'A system that finds qualified merchant trade suppliers and delivers verified records every week.', company: 'Symplify Marketing', consultant: 'Hichem A', date: 'December 12, 2025' },
        { type: 'signal', eyebrow: 'The signal', heading: 'Where things stand', intro: 'Your growth depends on finding the right prospects consistently, but manual research makes volume and quality difficult to maintain.', roles: ['Founder', 'Sales rep', 'Marketing lead'], rolesNote: 'This proposal is written for any one of these roles taking ownership of prospecting.', nodes: [
          { tag: '01 · SIGNAL', title: 'Inconsistent prospecting', desc: 'Research is performed manually and takes time away from outreach and delivery.' },
          { tag: '02 · SIGNAL', title: 'The wrong audience', desc: 'Broad searches can surface tradespeople instead of the merchant trade suppliers who match.' },
          { tag: '03 · SIGNAL', title: 'Unverified records', desc: 'Incomplete or inaccurate contact details create wasted outreach.' }
        ]},
        { type: 'architecture', eyebrow: 'The pipeline', heading: 'How it works', intro: 'Together these steps form one repeatable system.', nodes: [
          { step: '01 · STEP', title: 'Define the target', desc: 'Translate the ideal customer profile into clear search criteria.', hot: true },
          { step: '02 · STEP', title: 'Source prospects', desc: 'Structured research workflow finds matching businesses.' },
          { step: '03 · STEP', title: 'Verify data', desc: 'Clean and validate records before delivery.' },
          { step: '04 · STEP', title: 'Deliver at volume', desc: 'Consistent weekly process supporting the agreed record target.' },
          { step: '05 · STEP', title: 'Improve continuously', desc: 'Review results and refine targeting over time.' }
        ], note: '∞ continuous · loops back overnight' },
        { type: 'volume', eyebrow: 'Volume & cadence', heading: 'Weekly delivery', intro: 'A structured cadence keeps the pipeline fed every week.', cards: [
          { day: 'Day 1–2', icon: '🔍', title: 'Research', desc: 'Target-market definition and source identification.' },
          { day: 'Day 3–4', icon: '📋', title: 'Source & verify', desc: 'Prospect research and contact data verification.' },
          { day: 'Day 5', icon: '✅', title: 'Quality review', desc: 'Record cleanup and confidence check before handover.' },
          { day: 'Day 5+', icon: '📦', title: 'Deliver', desc: 'Structured spreadsheet delivered to your inbox.' }
        ], metrics: ['50+ records per week', 'Email + phone verified', 'Weekly cadence'] },
        { type: 'tools', eyebrow: 'Tools & stack', heading: 'What runs the system', tools: [
          { role: 'Research', name: 'Apollo', desc: 'Prospecting database for structured lead research.', price: '' },
          { role: 'Verify', name: 'NeverBounce', desc: 'Email verification to protect sender reputation.', price: '' },
          { role: 'Enrich', name: 'Clearbit', desc: 'Firmographic data to confirm target-market fit.', price: '' },
          { role: 'Deliver', name: 'Google Sheets', desc: 'Structured delivery spreadsheet for easy handoff.', price: '' }
        ], note: 'All tools are used only for this project and are not shared with third parties.' },
        { type: 'investment', eyebrow: 'Investment', heading: 'Your investment', panels: [
          { tag: 'Total project fee', amount: '$75', note: 'One fixed fee covering the full scope described in this proposal.', items: [], hot: false },
          { tag: 'Deposit due at signing', amount: '$37.50', note: 'Confirmation to begin work — balance payable on handover.', items: [], hot: true }
        ]},
        { type: 'close', pill: 'Next step', heading: "Let's get started", intro: 'A quick call to align on targeting, then we begin.', steps: [
          { num: '01', title: 'Align on targeting', desc: 'Share your ideal customer profile and geographic criteria.' },
          { num: '02', title: 'We begin research', desc: 'The first batch of verified records is delivered within 5 business days.' },
          { num: '03', title: 'Review and handover', desc: 'We walk through the results and hand over the process.' }
        ], cta: 'Get started →' },
        { type: 'terms', heading: 'Terms & signature', termsText: 'Hichem A will build the system for Symplify Marketing according to the description laid out in this proposal. Additional features beyond the listed requirements may affect the timeline and costs outlined above.\n\nBy signing below, both parties indicate their acceptance of this proposal and constitute approval to begin work upon Symplify Marketing\'s payment of the deposit.', company: 'Symplify Marketing', consultant: 'Hichem A', email: '', date: 'December 12, 2025' }
      ]
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
