import { getRequestConfig } from 'next-intl/server';
import { en, ar } from '@vendorhub/i18n';

export default getRequestConfig(async ({ locale }) => {
  const messages = locale === 'ar' ? ar : en;
  return { messages };
});
