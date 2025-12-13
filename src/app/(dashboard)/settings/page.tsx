import { redirect } from 'next/navigation';

export default function SettingsPage() {
  // User settings redirect to profile
  redirect('/profile');
}

