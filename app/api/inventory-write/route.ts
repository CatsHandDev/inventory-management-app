import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: Request) {
  try {
    // rangeとvalues (2D配列) を受け取るように変更
    const { sheetName, range, values } = await request.json();
    if (!sheetName || !range || !values) {
      return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
    }

    const spreadsheetId = process.env.INVENTORY_SHEET_ID as string;
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'], // 書き込みスコープ
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range, // 受け取ったrangeをそのまま使用
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values, // 受け取ったvaluesをそのまま使用
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const error = err as Error;
    console.error('Inventory Write API Error:', error.message);
    return NextResponse.json(
      { error: `在庫データの書き込みに失敗: ${error.message}` },
      { status: 500 }
    );
  }
}