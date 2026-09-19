import { redirect } from 'next/navigation';

/** Root → redirect straight to dashboard (middleware handles auth). */
export default function RootPage() {
  redirect('/dashboard');
}
