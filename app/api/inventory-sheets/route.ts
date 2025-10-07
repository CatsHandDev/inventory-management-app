import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// どのシートからデータを取得するかを定義
// NOTE: 複数のシートや広範囲を一度に読み込むとパフォーマンスに影響する可能性があります
const SHEET_RANGE = '出品管理!A:R'; // ピッキングリストの仕様からR列(17)までが必要

export async function GET() {
  try {
    const spreadsheetId = process.env.PRODUCT_SHEET_ID as string; // 商品台帳シートIDを使用
    
    // 認証ロジック (読み取り専用でOK)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SHEET_RANGE,
    });

    return NextResponse.json({ values: response.data.values || [] });
  } catch (err) {
    const error = err as Error;
    console.error('Product Sheet API Error:', error.message);
    return NextResponse.json(
      { error: `商品台帳シートの取得に失敗: ${error.message}` },
      { status: 500 }
    );
  }
}