export { default } from 'next-auth/middleware';

export const config = {
  // Protect everything under (admin) routes
  matcher: [
    '/dashboard/:path*',
    '/users/:path*',
    '/ingredients/:path*',
    '/recipes/:path*',
    '/community/:path*',
    '/analytics/:path*',
    '/ops/:path*',
    '/admins/:path*',
  ],
};
