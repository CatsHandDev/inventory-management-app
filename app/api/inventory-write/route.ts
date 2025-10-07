import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: Request) {
  try {
    const { sheetName, row, col, value } = await request.json(); // 書き込み情報をリクエストボディから取得
    if (!sheetName || row === undefined || col === undefined || value === undefined) {
      return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
    }

    const spreadsheetId = process.env.INVENTORY_SHEET_ID as string;
    const auth = new google.auth.GoogleAuth({ /* ... 認証 ... */ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 書き込みたいセルの範囲をA1形式で指定 (例: 'シート1!I5')
    const range = `${sheetName}!${String.fromCharCode(65 + col)}${row + 1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]],
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) { /* ... エラー処理 ... */ }
}