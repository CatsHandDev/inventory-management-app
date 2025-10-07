import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetName = searchParams.get('sheetName');
    if (!sheetName) {
      return NextResponse.json({ error: 'シート名が指定されていません' }, { status: 400 });
    }

    const spreadsheetId = process.env.INVENTORY_SHEET_ID as string;
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // 読み取りだけならreadonlyでOK
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const range = `${sheetName}!C3:AG`;

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return NextResponse.json({ values: response.data.values || [] });

  } catch (err) {
    const error = err as Error;
    console.error('Inventory Read API Error:', error.message); // サーバー側でエラー内容を確認

    // エラーが発生したことをクライアントに伝えるレスポンスを返す
    return NextResponse.json(
      { error: `在庫データの読み込みに失敗しました: ${error.message}` },
      { status: 500 } // 500 Internal Server Error
    );
  }
}