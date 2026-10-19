/** Built-in branded image templates (logo + colours + headline overlay). */

export const BRANDED_TEMPLATE_IDS = [
  'offer-banner',
  'quote-card',
  'testimonial',
  'hiring',
  'event',
  'carousel-slide',
] as const;

export type BrandedTemplateId = (typeof BRANDED_TEMPLATE_IDS)[number];

export interface BrandedTemplateVariable {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  maxLength: number;
}

export interface BrandedTemplate {
  id: BrandedTemplateId;
  label: string;
  description: string;
  width: number;
  height: number;
  variables: BrandedTemplateVariable[];
}

export const BRANDED_TEMPLATES: BrandedTemplate[] = [
  {
    id: 'offer-banner',
    label: 'Offer banner',
    description: 'Landscape promo with headline, offer line and CTA.',
    width: 1200,
    height: 628,
    variables: [
      { key: 'headline', label: 'Headline', placeholder: 'Festive sale', required: true, maxLength: 60 },
      { key: 'offer', label: 'Offer line', placeholder: 'Up to 40% off this week', required: true, maxLength: 80 },
      { key: 'cta', label: 'CTA', placeholder: 'Shop now', required: false, maxLength: 28 },
    ],
  },
  {
    id: 'quote-card',
    label: 'Quote card',
    description: 'Square quote with optional attribution.',
    width: 1080,
    height: 1080,
    variables: [
      { key: 'quote', label: 'Quote', placeholder: 'Results compound when the brand stays consistent.', required: true, maxLength: 220 },
      { key: 'attribution', label: 'Attribution', placeholder: 'Founder name', required: false, maxLength: 60 },
    ],
  },
  {
    id: 'testimonial',
    label: 'Testimonial',
    description: 'Customer quote with name and role.',
    width: 1080,
    height: 1080,
    variables: [
      { key: 'quote', label: 'Customer quote', placeholder: 'They doubled our qualified leads in 60 days.', required: true, maxLength: 220 },
      { key: 'name', label: 'Name', placeholder: 'Priya Sharma', required: true, maxLength: 60 },
      { key: 'role', label: 'Role / company', placeholder: 'CMO, Bloom Retail', required: false, maxLength: 80 },
    ],
  },
  {
    id: 'hiring',
    label: 'Hiring',
    description: 'Portrait “we’re hiring” card with role and location.',
    width: 1080,
    height: 1350,
    variables: [
      { key: 'headline', label: 'Headline', placeholder: "We're hiring", required: true, maxLength: 40 },
      { key: 'role', label: 'Role', placeholder: 'Performance Marketing Manager', required: true, maxLength: 80 },
      { key: 'location', label: 'Location', placeholder: 'Bengaluru · Hybrid', required: false, maxLength: 60 },
      { key: 'cta', label: 'CTA', placeholder: 'Apply today', required: false, maxLength: 28 },
    ],
  },
  {
    id: 'event',
    label: 'Event',
    description: 'Landscape event invite with date and venue.',
    width: 1200,
    height: 628,
    variables: [
      { key: 'title', label: 'Event title', placeholder: 'Client growth workshop', required: true, maxLength: 80 },
      { key: 'date', label: 'Date / time', placeholder: 'Sat 25 Oct · 4:00 PM IST', required: true, maxLength: 60 },
      { key: 'venue', label: 'Venue', placeholder: 'Online · Zoom', required: false, maxLength: 80 },
      { key: 'cta', label: 'CTA', placeholder: 'Save your seat', required: false, maxLength: 28 },
    ],
  },
  {
    id: 'carousel-slide',
    label: 'Carousel slide',
    description: 'Square carousel frame with headline and body.',
    width: 1080,
    height: 1080,
    variables: [
      { key: 'headline', label: 'Headline', placeholder: 'Tip 2 of 5', required: true, maxLength: 60 },
      { key: 'body', label: 'Body', placeholder: 'Lead with one clear offer. Cut the rest.', required: true, maxLength: 180 },
      { key: 'footer', label: 'Footer', placeholder: 'Swipe for more →', required: false, maxLength: 40 },
    ],
  },
];

export function getBrandedTemplate(id: string): BrandedTemplate | undefined {
  return BRANDED_TEMPLATES.find((template) => template.id === id);
}
