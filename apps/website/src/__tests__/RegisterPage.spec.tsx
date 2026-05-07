import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/auth/supabase-browser', () => ({
  createClient: vi.fn(),
}));

async function getRegisterPage() {
  return import('../app/[locale]/(auth)/register/page');
}

describe('RegisterPage', () => {
  it('renders the registration form', async () => {
    const { default: RegisterPage } = await getRegisterPage();
    render(<RegisterPage />);
    expect(screen.getByText('title')).toBeDefined();
    expect(screen.getByText('subtitle')).toBeDefined();
    expect(screen.getByLabelText('nameLabel')).toBeDefined();
    expect(screen.getByLabelText('emailLabel')).toBeDefined();
    expect(screen.getByLabelText('passwordLabel')).toBeDefined();
    expect(screen.getByLabelText('confirmPasswordLabel')).toBeDefined();
    expect(screen.getByText('submit')).toBeDefined();
  });

  it('renders a link to login page', async () => {
    const { default: RegisterPage } = await getRegisterPage();
    render(<RegisterPage />);
    expect(screen.getByText('loginLink')).toBeDefined();
  });
});
