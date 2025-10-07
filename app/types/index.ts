export interface OrderItem {
  '注文日時': string;
  '配送方法(複数配送先)': string;
  'チェック項目': string;
  '販売店舗': string;
  'GoQ管理番号': string;
  'お荷物伝票番号': string;
  '送付先郵便番号': string;
  '送付先住所（全て）': string;
  '送付先氏名': string;
  '商品名': string;
  '個数': string;
  'JANコード': string;
  '合計金額': string;
  '受注番号': string;
  '注文者氏名': string;
  '商品コード': string;
  'SKU管理番号': string;
  '商品URL': string;
  '商品SKU': string;
}

export interface PickingItem {
  '商品名': string;
  '個数': number;
  'JANコード': string;
}

export interface PickingItemRow {
  asin: string;
  商品名: string;
  JANコード: string;
  個数: number;
  単品換算数: number;
}

export interface InventoryItem {
  productName: string;
  asin: string;
  jan: string;
  quantity: number;
  salesCount: number;
  updatedQuantity: number;
}