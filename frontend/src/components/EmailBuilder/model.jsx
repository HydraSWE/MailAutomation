export const blockTypes = ["Heading", "Text", "Image", "Button", "Divider", "Spacer", "HTML"];

export const RECIPIENT_VARIABLES = [
  { tag: "{name}", label: "Contact Name", desc: "Replaced with recipient's name" },
  { tag: "{company}", label: "Company Name", desc: "Replaced with recipient's company" },
  { tag: "{email}", label: "Email Address", desc: "Replaced with recipient's email" },
];

export const PRESET_COLORS = [
  "#4f46e5", // Indigo
  "#0284c7", // Sky Blue
  "#059669", // Emerald
  "#e11d48", // Rose
  "#d97706", // Amber
  "#7c3aed", // Purple
  "#0f172a", // Dark Slate
  "#475569", // Slate Muted
  "#cbd5e1", // Light Gray
  "#ffffff", // White
];

export const COLOR_PALETTES = [
  {
    name: "Indigo Modern",
    description: "Sleek, tech-focused corporate theme",
    colors: [
      { hex: "#4f46e5", name: "Primary Indigo" },
      { hex: "#1e293b", name: "Dark Text" },
      { hex: "#64748b", name: "Muted Text" },
      { hex: "#e0e7ff", name: "Soft Accent" },
    ],
  },
  {
    name: "Emerald Growth",
    description: "Fresh, vibrant green & nature theme",
    colors: [
      { hex: "#10b981", name: "Emerald Accent" },
      { hex: "#064e3b", name: "Deep Green Text" },
      { hex: "#047857", name: "Button Green" },
      { hex: "#d1fae5", name: "Mint Light" },
    ],
  },
  {
    name: "Ocean Breeze",
    description: "Clean, trustworthy blue tones",
    colors: [
      { hex: "#0284c7", name: "Ocean Blue" },
      { hex: "#0f172a", name: "Navy Dark" },
      { hex: "#38bdf8", name: "Sky Accent" },
      { hex: "#e0f2fe", name: "Ice Light" },
    ],
  },
  {
    name: "Sunset Passion",
    description: "High-energy red & pink promotion",
    colors: [
      { hex: "#e11d48", name: "Rose Primary" },
      { hex: "#881337", name: "Crimson Text" },
      { hex: "#f43f5e", name: "Vibrant Button" },
      { hex: "#ffe4e6", name: "Blush Light" },
    ],
  },
  {
    name: "Royal Purple",
    description: "Premium, luxury brand aesthetics",
    colors: [
      { hex: "#8b5cf6", name: "Violet Primary" },
      { hex: "#4c1d95", name: "Deep Purple Text" },
      { hex: "#a78bfa", name: "Soft Purple" },
      { hex: "#f3e8ff", name: "Lavender Light" },
    ],
  },
];

export const RAW_HTML_PRESETS = {
  responsive: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Special Announcement</title>
</head>
<body style="margin:0; padding:20px; background-color:#f8fafc; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#334155;">
  <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg, #4f46e5, #7c3aed); padding:32px 24px; text-align:center; color:#ffffff;">
      <h1 style="margin:0; font-size:24px; font-weight:700;">Hello {name}!</h1>
      <p style="margin:8px 0 0; opacity:0.9; font-size:14px;">Exclusive Update for {company}</p>
    </div>
    <div style="padding:32px 24px; line-height:1.6;">
      <p style="font-size:15px; margin-top:0;">Dear {name},</p>
      <p style="font-size:15px;">We are excited to share a customized solution crafted specifically for <strong>{company}</strong>.</p>
      <div style="text-align:center; margin:32px 0;">
        <a href="https://annomous.com" style="background:#4f46e5; color:#ffffff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">Explore Now</a>
      </div>
              <p style="font-size:14px; color:#64748b; margin-bottom:0;">Best regards,<br>The Mail Flow Team</p>
    </div>
  </div>
</body>
</html>`,

  minimal: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <h2 style="color: #4f46e5;">Hi {name},</h2>
  <p>Thank you for connecting with us at <strong>{company}</strong>!</p>
  <p>We are reaching out to help streamline your mail campaigns with automated personalization.</p>
  <p style="margin-top: 24px;">
    <a href="https://annomous.com" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Get Started</a>
  </p>
</div>`,
};

export function makeBlock(type) {
  const id = crypto.randomUUID();
  const defaults = {
    Heading: { text: "Hello {name} - Special Announcement for {company}", color: "#1e293b" },
    Text: { text: "Discover our latest features and upgrade your campaigns today.", color: "#475569" },
    Image: { src: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&auto=format&fit=crop&q=80", alt: "Campaign banner" },
    Button: { text: "Get Started Now", url: "https://annomous.com", background: "#4f46e5", color: "#ffffff" },
    Divider: { color: "#cbd5e1" },
    Spacer: { height: 24 },
    HTML: { html: "<p style='color:#6366f1;font-weight:bold;'>Exclusive offer for {company}</p>" },
  };
  return { id, type: type.toLowerCase(), data: defaults[type] || {} };
}

export function renderBlock(block) {
  if (!block || !block.data) return null;
  switch (block.type) {
    case "heading":
      return <h2 style={{ color: block.data.color || "#1e293b" }}>{block.data.text || ""}</h2>;
    case "text":
      return <p style={{ color: block.data.color || "#475569" }}>{block.data.text || ""}</p>;
    case "image":
      return <img src={block.data.src || ""} alt={block.data.alt || ""} style={{ maxWidth: "100%", borderRadius: "8px" }} />;
    case "button":
      return (
        <a
          className="email-button"
          href={block.data.url || "#"}
          style={{ backgroundColor: block.data.background || "#4f46e5", color: block.data.color || "#ffffff" }}
        >
          {block.data.text || "Button"}
        </a>
      );
    case "divider":
      return <hr style={{ borderColor: block.data.color || "#cbd5e1" }} />;
    case "spacer":
      return <div style={{ height: Number(block.data.height || 24) }} />;
    case "html":
      return (
        <iframe
          sandbox=""
          srcDoc={block.data.html || ""}
          title="HTML block preview"
          className="w-full min-h-20 border-0 bg-white pointer-events-none"
        />
      );
    default:
      return null;
  }
}
