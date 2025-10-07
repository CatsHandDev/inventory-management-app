import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetName = searchParams.get('sheetName'); // クエリパラメータからシート名を取得
    if (!sheetName) {
      return NextResponse.json({ error: 'シート名が指定されていません' }, { status: 400 });
    }

    const spreadsheetId = process.env.INVENTORY_SHEET_ID as string;
    const auth = new google.auth.GoogleAuth({ /* ... 認証 ... */ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    
    // ヘッダーは3行目、データは4行目から。C列からAG列まで取得
    const range = `${sheetName}!C3:AG`;

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return NextResponse.json({ values: response.data.values || [] });
  } catch (err) { /* ... エラー処理 ... */ }
}