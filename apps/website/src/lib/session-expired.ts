'use client';

import { registerSessionExpiredCallback } from '@vendorhub/api-client';

export function registerWebsiteSessionExpiredHandler(showModal: () => void): void {
  registerSessionExpiredCallback(() => {
    showModal();
  });
}
