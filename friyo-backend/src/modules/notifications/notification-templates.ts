/**
 * Centralised notification template registry.
 *
 * Templates use {{variable}} placeholders rendered by `renderTemplate()`.
 * All raw strings are defined here so product copy lives in one place.
 */

export type TemplateKey =
  | 'expiry_reminder'
  | 'recipe_liked'
  | 'friend_request'
  | 'recipe_approved'
  | 'recipe_rejected'
  | 'weekly_recap'
  | 'party_invite'
  | 'admin_push';

export interface NotificationTemplate {
  title: string;
  body:  string;
}

export const NOTIFICATION_TEMPLATES: Record<TemplateKey, NotificationTemplate> = {
  expiry_reminder: {
    title: '🧊 Items Expiring Soon',
    body:  '{{item_names}} expire in {{days}} day(s). {{recipe_name}} uses them perfectly!',
  },
  recipe_liked: {
    title: '❤️ Someone liked your recipe!',
    body:  '{{user_name}} liked your recipe "{{recipe_name}}".',
  },
  friend_request: {
    title: '👥 New Friend Request',
    body:  '{{user_name}} wants to be your friend.',
  },
  recipe_approved: {
    title: '✅ Recipe Approved!',
    body:  "Your recipe \"{{recipe_name}}\" has been approved and published!",
  },
  recipe_rejected: {
    title: '❌ Recipe Not Approved',
    body:  "Your recipe \"{{recipe_name}}\" was not approved. Reason: {{reason}}",
  },
  weekly_recap: {
    title: '📊 Your Weekly Recap',
    body:  'You cooked {{count}} meal(s) this week. {{streak_msg}}',
  },
  party_invite: {
    title: '🎉 Party Invitation',
    body:  '{{host_name}} invited you to join "{{party_name}}"! Use code: {{invite_code}}',
  },
  admin_push: {
    title: '{{title}}',
    body:  '{{body}}',
  },
};

/**
 * Render a template by replacing {{key}} placeholders with values from `vars`.
 */
export function renderTemplate(
  key: TemplateKey,
  vars: Record<string, string | number>,
): NotificationTemplate {
  const tpl = NOTIFICATION_TEMPLATES[key];

  const replace = (str: string): string =>
    str.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
      k in vars ? String(vars[k]) : `{{${k}}}`,
    );

  return {
    title: replace(tpl.title),
    body:  replace(tpl.body),
  };
}
