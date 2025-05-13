import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET() {
  const headerList = await headers();
  const forwardedProto = headerList.get('x-forwarded-proto');
  const host = headerList.get('host');

  return NextResponse.json({
    nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    forwardedProto: forwardedProto,
    host: host,
    allHeaders: Object.fromEntries(headerList.entries()) 
  });
}