/* RideNova – agent portal policy. OWNED BY THE ADMIN PORTAL (Admin portal → Agent portal control, A31).
   The admin portal edits this policy and publishes it in two ways:
     * live, to agent-portal tabs open on the same site (BroadcastChannel, see agent-sync.js), and
     * as this file ("Download agent-policy.js" on A31), to copy into agent-portal/assets/js/ on the agent portal server.
   The agent portal only reads it: agents cannot change their own role, channels, limits or templates.
   Synthetic demo values. A browser cannot enforce anything – the backend of the next phase must enforce these rules. */
window.RN_AGENT_POLICY = {
  version: 1,
  publishedAt: '2026-10-10T09:00:00+05:30',
  publishedBy: 'Priya K. · Operations manager',
  demoCode: '246810',

  // every contact channel the agents work in; "on" is the admin's switch for the whole channel
  channels: {
    call:      { on: true, label: 'Voice calls',      slaMins: 1,   hours: '24 × 7' },
    email:     { on: true, label: 'Email',            slaMins: 240, hours: '24 × 7' },
    chat:      { on: true, label: 'In-app chat',      slaMins: 2,   hours: '24 × 7' },
    app:       { on: true, label: 'In-app tickets',   slaMins: 480, hours: '24 × 7' },
    whatsapp:  { on: true, label: 'WhatsApp',         slaMins: 15,  hours: '07:00–23:00' },
    facebook:  { on: true, label: 'Facebook',         slaMins: 60,  hours: '08:00–22:00' },
    instagram: { on: true, label: 'Instagram',        slaMins: 60,  hours: '08:00–22:00' },
    x:         { on: true, label: 'X (Twitter)',      slaMins: 30,  hours: '24 × 7' }
  },

  // who the agents support
  audiences: { customer: true, driver: true, partner: true },

  routing: {
    strategy: 'skills',      // skills | longest-idle | round-robin
    autoAssign: true,        // new conversations go straight to an available agent with the right skills
    maxChats: 3,             // live chats and social conversations one agent may hold at the same time
    ringSecs: 20,            // an offered call rings this long before it returns to the queue
    wrapUpSecs: 30,          // after-call work time before the agent is offered the next call
    maskNumbers: true,       // agents only ever see masked phone numbers and e-mail addresses
    recordCalls: true        // calls are recorded for quality (simulated: nothing is recorded)
  },

  // what each agent role may do
  roles: {
    L1:  { label: 'Agent',           refundLimit: 200,  outbound: true, publicReply: false, close: true, reassign: false, team: false, export: false },
    L2:  { label: 'Senior agent',    refundLimit: 1000, outbound: true, publicReply: true,  close: true, reassign: true,  team: false, export: false },
    SUP: { label: 'Team supervisor', refundLimit: 5000, outbound: true, publicReply: true,  close: true, reassign: true,  team: true,  export: true }
  },

  // agent accounts are created, changed and suspended only by the admin
  agents: [
    { id: 'AG-101', name: 'Meera S.',  role: 'L1',  team: 'Customer care', channels: ['call', 'email', 'chat', 'app', 'whatsapp'], audiences: ['customer'], langs: 'English, Hindi, Telugu', active: true },
    { id: 'AG-102', name: 'Vikram R.', role: 'L2',  team: 'Driver care',   channels: ['call', 'email', 'chat', 'app', 'whatsapp', 'facebook', 'instagram', 'x'], audiences: ['driver', 'customer'], langs: 'English, Hindi, Kannada', active: true },
    { id: 'AG-103', name: 'Farah N.',  role: 'L1',  team: 'Partner care',  channels: ['call', 'email', 'app', 'facebook', 'instagram', 'x'], audiences: ['partner'], langs: 'English, Urdu, Hindi', active: true },
    { id: 'AG-104', name: 'Rohan D.',  role: 'SUP', team: 'All teams',     channels: ['call', 'email', 'chat', 'app', 'whatsapp', 'facebook', 'instagram', 'x'], audiences: ['customer', 'driver', 'partner'], langs: 'English, Hindi, Tamil', active: true },
    { id: 'AG-105', name: 'Sana P.',   role: 'L1',  team: 'Social media',  channels: ['whatsapp', 'facebook', 'instagram', 'x'], audiences: ['customer', 'driver', 'partner'], langs: 'English, Marathi', active: false }
  ],

  dispositions: ['Information given', 'Refund issued', 'Fare adjusted', 'Lost item returned', 'Payout fixed', 'Account updated',
    'Order issue fixed', 'Escalated to another team', 'Duplicate', 'No response from user'],
  escalations: ['Safety team', 'Finance team', 'Driver operations', 'Partner success', 'Legal & compliance'],

  // reply templates the agents may use; written and approved by the admin
  macros: [
    { id: 'M1', title: 'Refund timeline', on: true, text: 'Your refund has been issued. UPI and wallet refunds arrive within 1–3 working days; cards take 5–7 working days.' },
    { id: 'M2', title: 'Lost item – driver contacted', on: true, text: 'We have contacted the driver about your item. We will share the return time with you shortly.' },
    { id: 'M3', title: 'Payout delay (drivers)', on: true, text: 'Your payout is being processed. Payouts reach your bank account within 24 hours of the weekly settlement.' },
    { id: 'M4', title: 'Partner menu update', on: true, text: 'Menu changes go live within 15 minutes after you save them in the partner app.' },
    { id: 'M5', title: 'Move to private message', on: true, text: 'Sorry about this. We have sent you a private message so we can look into your account details safely.' },
    { id: 'M6', title: 'Safety – we are on it', on: true, text: 'Your safety comes first. Our safety team has been alerted and will call you right away. In danger? Call 112.' }
  ],

  // knowledge articles the agents read while helping; maintained by the admin
  kb: [
    { id: 'K1', audience: 'customer', title: 'Refunds: how long they take', body: 'UPI and wallet refunds arrive within 1–3 working days, cards within 5–7. Agents may issue goodwill credit up to their role limit; above it, escalate to the Finance team.' },
    { id: 'K2', audience: 'customer', title: 'Lost items', body: 'Confirm the ride, contact the driver through a masked call, agree a return time. A return fee of ₹100 applies when the driver drops the item.' },
    { id: 'K3', audience: 'customer', title: 'Fare disputes', body: 'Compare the quoted and final fare on the ride record. Route changes, waiting time and tolls explain most differences. Adjust only when the record supports it.' },
    { id: 'K4', audience: 'driver', title: 'Weekly payouts', body: 'Settlement runs every Monday. Payouts reach the bank within 24 hours. Failed payouts usually mean a wrong IFSC code – ask the driver to update bank details.' },
    { id: 'K5', audience: 'driver', title: 'Account paused', body: 'Paused accounts are reviewed by Driver operations. Do not promise reactivation; escalate with the driver ID and reason.' },
    { id: 'K6', audience: 'partner', title: 'Restaurant order disputes', body: 'Check the order timeline. Missing items reported within 2 hours are refunded to the customer and deducted from the partner payout.' },
    { id: 'K7', audience: 'partner', title: 'Partner payouts and fees', body: 'Partner payouts are weekly. The platform fee and taxes are shown per order in the partner app under Payouts.' },
    { id: 'K8', audience: 'all', title: 'Safety first', body: 'Any report of danger, assault or an accident is escalated to the Safety team at once, whatever the channel. Never ask the person to wait in a queue.' },
    { id: 'K9', audience: 'all', title: 'Social media replies', body: 'Never share account details in public. Thank, apologise and move the conversation to a private message. Hide comments that contain personal data.' }
  ],

  announcements: [
    { at: '2026-10-10T09:00:00+05:30', level: 'info', text: 'Festival week: expect more ride and food contacts in the evening. Breaks are planned between 15:00 and 17:00.' }
  ]
};
