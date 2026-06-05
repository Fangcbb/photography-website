import { NextResponse } from 'next/server';

const NETEASE_API = 'http://127.0.0.1:3002';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Load cookies from environment
const COOKIES = {
  MUSIC_A_T: process.env.MUSIC_A_T || '',
  MUSIC_R_T: process.env.MUSIC_R_T || '',
  MUSIC_R_U: process.env.MUSIC_R_U || '',
  MUSIC_U: process.env.MUSIC_U || '',
  NMTID: process.env.NMTID || '',
  csrf: process.env.__csrf || '',
};

function buildCookieHeader(): string {
  return Object.entries(COOKIES)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export async function GET() {
  try {
    const uid = process.env.USER_ID;
    if (!uid) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401, headers: corsHeaders });
    }

    const cookieStr = buildCookieHeader();
    const response = await fetch(`${NETEASE_API}/likelist?uid=${uid}&limit=100`, {
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
