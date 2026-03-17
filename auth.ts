import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    signIn({ profile }) {
      const allowed = (process.env.ADMIN_EMAIL ?? '')
        .split(',')
        .map(e => e.trim().toLowerCase());
      return allowed.includes((profile?.email ?? '').toLowerCase());
    },
  },
});
