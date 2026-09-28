export const WEBHOOK_NAME_MAX_LENGTH = 80;

export const AUTOPOST_TITLE_MAX_LENGTH = 80;
export const AUTOPOST_TEMPLATE_MAX_LENGTH = 2000;
/** Placeholders: {{title}}, {{url}} and {{description}}. */
export const AUTOPOST_DEFAULT_TEMPLATE = '{{title}}\n\n{{url}}';
/** New feed items turned into posts per check, so a busy feed cannot flood the channels. */
export const AUTOPOST_MAX_ITEMS_PER_RUN = 5;
