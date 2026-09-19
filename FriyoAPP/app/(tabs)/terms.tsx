import { LegalDocumentScreen } from '@/components/ui/LegalDocumentScreen';

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      title="Terms of Service"
      updated="July 24, 2026"
      intro="These terms govern your use of Friyo. By creating an account or using Friyo, you agree to use the service responsibly and in accordance with these terms."
      sections={[
        {
          title: 'The Friyo service',
          body: 'Friyo provides tools for food inventory, recipe discovery, meal planning, AI assistance, and community participation. Features may change as the service improves.',
        },
        {
          title: 'AI and nutrition information',
          body: 'AI-generated food recognition, recipes, substitutions, expiration estimates, calorie estimates, and nutrition information may be incomplete or inaccurate. Check ingredient labels, food safety, allergies, dietary requirements, and cooking temperatures yourself. Friyo does not provide medical advice.',
        },
        {
          title: 'Your account',
          body: 'You are responsible for providing accurate account information, protecting access to your account, and notifying Friyo about unauthorized use. You may delete your account at any time from Settings.',
        },
        {
          title: 'Community conduct',
          body: 'Do not post unlawful, abusive, discriminatory, sexually explicit, dangerous, deceptive, infringing, or privacy-invasive content. Do not impersonate others, harass users, distribute spam, or attempt to interfere with the service. Friyo may remove content or restrict accounts that violate these rules.',
        },
        {
          title: 'Your content',
          body: 'You retain ownership of content you submit. You grant Friyo the limited rights needed to host, process, display, moderate, and distribute that content within the service. You must have permission to upload the content you submit.',
        },
        {
          title: 'Availability',
          body: 'We work to keep Friyo available and reliable, but do not guarantee uninterrupted or error-free operation. To the extent permitted by law, the service is provided as available without warranties not expressly stated here.',
        },
        {
          title: 'Contact',
          body: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ? `Contact us at ${process.env.EXPO_PUBLIC_SUPPORT_EMAIL} for questions about these terms.` : 'Contact details must be configured before release.',
        },
      ]}
    />
  );
}
