import { NextResponse } from 'next/server';

const NETEASE_API = 'http://127.0.0.1:3002';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET() {
  try {
    const userId = process.env.USER_ID;
    const nickname = process.env.USER_NICKNAME;

    if (!userId) {
      return NextResponse.json({ loggedIn: false }, { headers: corsHeaders });
    }

    // Verify the cookie is still valid by calling the API
    const COOKIES = {
      MUSIC_A_T: process.env.MUSIC_A_T || '',
      MUSIC_R_T: process.env.MUSIC_R_T || '',
      MUSIC_R_U: process.env.MUSIC_R_U || '',
      MUSIC_U: process.env.MUSIC_U || '',
      NMTID: process.env.NMTID || '',
      csrf: process.env.__csrf || '',
    };

    const cookieStr = Object.entries(COOKIES)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    const response = await fetch(`${NETEASE_API}/user/account`, {
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const data = await response.json();

    if (data.code === 200 && data.profile) {
      return NextResponse.json({
        loggedIn: true,
        userId: data.profile.userId,
        nickname: data.profile.nickname,
        avatarUrl: data.profile.avatarUrl,
      }, { headers: corsHeaders });
    }

    return NextResponse.json({ loggedIn: false }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ loggedIn: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
