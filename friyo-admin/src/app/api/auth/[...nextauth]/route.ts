import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';
import type { AdminUser } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Admin Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          const { data: envelope } = await axios.post(`${API_BASE}/admin/auth/login`, {
            username: credentials.username,
            password: credentials.password,
          });

          const data = envelope.data ?? envelope;
          if (data.access_token && data.admin) {
            return {
              id:          data.admin.id,
              name:        data.admin.username,
              email:       data.admin.email,
              accessToken: data.access_token,
              admin:       data.admin,
            };
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],

  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 /* 8 hours */ },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        token.accessToken = u.accessToken;
        token.admin       = u.admin;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.admin       = token.admin as AdminUser;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
