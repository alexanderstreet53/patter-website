import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const db = getDb();
  const existing = await db
    .collection('waitlist')
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await db.collection('waitlist').add({
    email: email.toLowerCase(),
    signedUpAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
