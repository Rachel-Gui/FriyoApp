import { LegalDocumentScreen } from '@/components/ui/LegalDocumentScreen';

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      updated="July 24, 2026"
      intro="Friyo helps you manage food inventory, discover recipes, and plan meals. This policy explains the information Friyo processes and the choices available to you."
      sections={[
        {
          title: 'Information we process',
          body: 'Friyo processes account details such as your name and email; dietary preferences, allergies, cooking preferences, and health goals you provide; fridge inventory, meal plans, saved recipes, and cooking history; photos submitted for fridge scanning or community posts; AI chat requests; community posts, comments, likes, and reports; and technical information needed to secure and operate the service.',
        },
        {
          title: 'How we use information',
          body: 'We use this information to authenticate your account, maintain your inventory, personalize recipes and meal plans, provide AI-assisted features, operate community functionality, prevent abuse, send requested notifications, troubleshoot problems, and improve reliability.',
        },
        {
          title: 'AI providers',
          body: 'When you choose AI chat or fridge scanning, the content needed to complete your request may be sent to Google Gemini or OpenAI for processing. This can include your prompt, a submitted fridge image, relevant inventory, and dietary preferences. Friyo requests your permission before first use. Avoid including unnecessary sensitive personal information.',
        },
        {
          title: 'Service providers',
          body: 'Friyo may use infrastructure and processing providers such as Railway, PostgreSQL, Redis, Amazon Web Services, Firebase, Expo, Google, and OpenAI. They process information only as needed to provide their services and subject to their applicable data-protection commitments.',
        },
        {
          title: 'Retention and deletion',
          body: 'We retain account information while your account is active and as reasonably necessary to operate and secure the service. You can permanently delete your account from Settings. Account deletion removes your profile and associated inventory, scans, meal records, and user-generated content, except information we must retain for legal, security, or fraud-prevention obligations.',
        },
        {
          title: 'Your choices',
          body: 'You can decline device permissions, withdraw AI processing consent in Settings, edit your profile, delete individual content where available, log out, or permanently delete your account. Some features will not work without the information or permission they require.',
        },
        {
          title: 'Children',
          body: 'Friyo is not directed to children under 13, and we do not knowingly collect personal information from children under 13.',
        },
        {
          title: 'Contact',
          body: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ? `Contact us at ${process.env.EXPO_PUBLIC_SUPPORT_EMAIL} for privacy questions or support.` : 'Contact details must be configured before release.',
        },
      ]}
    />
  );
}
