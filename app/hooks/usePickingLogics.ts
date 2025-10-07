import { useMemo } from "react";
import type { OrderItem, PickingItemRow } from "../types";

const SKU_LOT_UNIT_MAP: { [key: string]: number } = {
  "-2": 2, "-4": 4, "-6": 6,
};

export function usePickingLogic(data: OrderItem[], sheet: string[][]) {
  const { pickingList, totalSingleUnits } = useMemo(() => {
    const map = new Map<string, PickingItemRow>();

    data.forEach((item) => {
      const itemCode = item["商品コード"];
      const itemSku = item["商品SKU"];
      const count = parseInt(item["個数"], 10) || 0;
      if (count === 0) return;

      let asin = "";
      let jan = "";
      let lotUnit = 1;
      let productName = item['商品名'];

      let targetRow: string[] | undefined = undefined;

      // フォールバック用の関数を定義 (itemSkuでQ列を検索)
      const findRowBySkuInQ = () => itemSku ? sheet.find(r => r[16]?.toLowerCase() === itemSku.toLowerCase()) : undefined;

      if (itemCode) {
        // --- Step 1: P列(index 15)で一次検索 ---
        const pRows = sheet.filter(r => r[15]?.toLowerCase() === itemCode.toLowerCase());

        // --- Step 2: P列のヒット数で分岐 ---
        if (pRows.length === 0) {
          // Case A: P列にヒットなし -> フォールバック
          targetRow = findRowBySkuInQ();

        } else if (pRows.length === 1) {
          // Case B: P列に1件ヒット
          const theOnePRow = pRows[0];
          if (theOnePRow[16]?.toLowerCase() === itemCode.toLowerCase()) {
            // Q列の値がitemCodeと一致 -> この行を採用
            targetRow = theOnePRow;
          } else {
            // Q列の値が不一致 -> フォールバック
            targetRow = findRowBySkuInQ();
          }

        } else if (pRows.length >= 2) {
          // Case C: P列に2件以上ヒット (新旧パッケージの可能性)
          const qRowBySku = findRowBySkuInQ();
          if (qRowBySku) {
            // const handoverText = qRowBySku[12] || qRowBySku[13] || "";
            // if (handoverText === 'ページ引継ぎ' || handoverText === 'カタログ引継ぎ') {
              targetRow = qRowBySku;
            // }
          }
        }
      } else {
        // itemCode自体がCSVにない場合もフォールバック
        targetRow = findRowBySkuInQ();
      }

      // --- Step 3: 最終的なロット入数と商品情報を決定 ---
      let lotUnitOverride: number | undefined = undefined;
      const skuFromCsv = item['SKU管理番号'];
      if (skuFromCsv && SKU_LOT_UNIT_MAP[skuFromCsv]) {
        lotUnitOverride = SKU_LOT_UNIT_MAP[skuFromCsv];
      }

      if (targetRow) {
        asin = targetRow[4] || "";
        const lotUnitFromSheet = parseInt(targetRow[6] || "1", 10);
        jan = targetRow[5] || ""; // ここでjanが設定される
        productName = targetRow[17] || item["商品名"];
        lotUnit = lotUnitOverride !== undefined ? lotUnitOverride : lotUnitFromSheet;
      } else {
        lotUnit = lotUnitOverride !== undefined ? lotUnitOverride : 1;
      }

      const singleUnits = lotUnit * count;
      const mapKey = jan || asin || productName;

      if (map.has(mapKey)) {
        // ...
      } else {
        map.set(mapKey, {
          asin: asin,
          商品名: productName,
          JANコード: jan,
          個数: count,
          単品換算数: singleUnits,
        });
      }
    });

    const list = Array.from(map.values());
    const totalSingles = list.reduce((sum, item) => sum + item.単品換算数, 0);
    return { pickingList: list, totalSingleUnits: totalSingles };
  }, [data, sheet]);

  return { pickingList, totalSingleUnits };
}