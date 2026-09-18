'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'new_roadmap_auth';

// Called directly as a <form action={checkPasscode}> handler.
export async function checkPasscode(formData) {
  const input = (formData.get('passcode') || '').toString();
  const next = (formData.get('next') || '/').toString();
  const expected = process.env.SITE_PASSCODE;

  if (!expected || input !== expected) {
    redirect('/enter-passcode?error=1&next=' + encodeURIComponent(next));
  }

  cookies().set(COOKIE_NAME, expected, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect(next || '/');
}
