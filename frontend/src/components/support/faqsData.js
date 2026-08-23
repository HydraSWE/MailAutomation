export const FAQS_DATA = [
  {
    id: "faq-1",
    category: "Getting Started",
    question: "How do I connect my domain and configure SPF and DKIM records?",
    answer: "To configure your custom domain, navigate to SMTP Settings > Sending Domains in your Mail Flow dashboard. Copy the provided TXT (SPF) and CNAME/TXT (DKIM) records and add them to your DNS provider (e.g. Cloudflare, GoDaddy, AWS Route53). DNS propagation usually takes between 5 to 30 minutes, after which our automated verifier will mark your domain as Authenticated.",
    badge: "DNS Setup",
    readTime: "3 min read",
  },
  {
    id: "faq-2",
    category: "Billing & USDT",
    question: "How does USDT payment confirmation and automated subscription activation work?",
    answer: "When you choose a plan or custom quote, Mail Flow generates a dedicated TRC-20 USDT deposit address with a lock-in quote rate. Our blockchain listener continuously scans the Tron network for your transaction. As soon as 19 network confirmations are achieved (typically under 2 minutes), your account is automatically upgraded and an official USDT invoice is generated.",
    badge: "TRC-20 USDT",
    readTime: "2 min read",
  },
  {
    id: "faq-3",
    category: "SMTP & Relays",
    question: "What SMTP ports and encryption modes are supported?",
    answer: "Mail Flow supports both standard STARTTLS on port 587 and SSL/TLS on port 465. Custom SMTP relay servers also support port 25 for authenticated internal relays. We enforce modern TLS 1.2+ ciphers and support both password-based and token-based SMTP authentication.",
    badge: "Infrastructure",
    readTime: "4 min read",
  },
  {
    id: "faq-4",
    category: "Deliverability",
    question: "How does automated IP warmup and deliverability protection work?",
    answer: "Our engine uses intelligent ramp-up algorithms that gradually increase daily sending volumes across new SMTP accounts over a 14-day schedule. Additionally, our automated feedback loops monitor bounce and complaint rates, temporarily throttling campaigns if hard bounces exceed 2.5% to protect your sender reputation.",
    badge: "Warmup Engine",
    readTime: "5 min read",
  },
  {
    id: "faq-5",
    category: "Security",
    question: "How do I set up 2-Factor Authentication (2FA) and manage team member roles?",
    answer: "Organization owners and administrators can enforce 2FA across all team members via Account Admin > Security. We support standard TOTP authenticator apps (Google Authenticator, 1Password, Authy). Granular role permissions allow you to assign Owner, Admin, Manager, Operator, or Viewer roles to restrict billing and broadcast access.",
    badge: "TOTP 2FA",
    readTime: "3 min read",
  },
  {
    id: "faq-6",
    category: "API & Webhooks",
    question: "How do I generate API keys and configure delivery status webhooks?",
    answer: "API keys with scoped permissions can be generated under Developer Settings > API Keys. You can configure webhook endpoints to receive real-time JSON event notifications for message.delivered, message.bounced, message.opened, and message.clicked with HMAC-SHA256 signature verification.",
    badge: "REST API",
    readTime: "4 min read",
  },
];

export const CATEGORIES_DATA = [
  { id: "All", label: "All Topics", sub: "6 articles", icon: "Sparkles" },
  { id: "Getting Started", label: "Getting Started", sub: "DNS & Setup", icon: "Rocket" },
  { id: "Billing & USDT", label: "Billing & USDT", sub: "Invoices & Tron", icon: "CreditCard" },
  { id: "SMTP & Relays", label: "SMTP & Relays", sub: "Ports & TLS", icon: "Server" },
  { id: "Deliverability", label: "Deliverability", sub: "Warmup & Spam", icon: "TrendingUp" },
  { id: "Security", label: "Security & 2FA", sub: "TOTP & Roles", icon: "ShieldCheck" },
];
