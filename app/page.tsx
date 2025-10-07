"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import styles from './page.module.css';
import { usePickingLogic } from './hooks/usePickingLogics';
import type { OrderItem, InventoryItem } from './types';

// 在庫データの型を定義
type InventoryData = string[][];

// 在庫シート名を取得するカスタムフック
function useInventorySheetNames() {
  const [sheetNames, setSheetNames] = useState<string[]>([]);

  useEffect(() => {
    // ページ読み込み時に一度だけAPIを叩く
    fetch('/api/inventory-sheets')
      .then(res => res.json())
      .then(data => setSheetNames(data.sheetNames || [])); // 結果をstateに保存
  }, []); // 依存配列が空なので、初回レンダリング時のみ実行
  return sheetNames; // stateを返す
}

// 商品台帳データを取得
function useProductSheet(): { productSheet: string[][]; isLoading: boolean } {
  const [productSheet, setProductSheet] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/product-sheet')
      .then(res => res.json())
      .then(data => {
        setProductSheet(data.values || []);
      })
      .catch(error => {
        console.error("商品台帳の読み込みに失敗:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return { productSheet, isLoading };
}

const STAFF_LIST = ['A', 'B', 'C'];

export default function InventoryPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<OrderItem[]>([]);
  const { productSheet, isLoading: isProductSheetLoading } = useProductSheet();
  const sheetNames = useInventorySheetNames();
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [inventoryData, setInventoryData] = useState<InventoryData>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [manager, setManager] = useState('');
  const [activeTab, setActiveTab] = useState<'load' | 'manage'>('load');
  const [isUpdating, setIsUpdating] = useState(false);

  // ピッキングロジックを再利用して販売個数を計算
  const { pickingList: salesData } = usePickingLogic(csvData, productSheet);

  // --- データ読み込み ---
  useEffect(() => {
    if (selectedSheet) {
      fetch(`/api/inventory-read?sheetName=${selectedSheet}`)
        .then(res => res.json())
        .then(data => setInventoryData(data.values || []));
    }
  }, [selectedSheet]);

  const mergedInventory = useMemo((): InventoryItem[] => {
    if (inventoryData.length < 2) {
      return [];
    }

    const salesMap = new Map<string, number>();
    salesData.forEach(sale => {
      // `.trim()` を使って前後の空白を削除
      const cleanJan = sale.JANコード?.trim();
      if (cleanJan && sale.単品換算数 > 0) {
        salesMap.set(cleanJan, sale.単品換算数);
      }
    });

    // デバッグ用のログ
    if (salesMap.size > 0) {
        console.log("【デバッグ】生成された salesMap (キー: JAN):", salesMap);
    }

    return inventoryData.slice(1).map(row => {
      // こちらも `.trim()` を使って空白を削除
      const jan = row[5]?.trim() || '';
      const currentQuantity = parseInt(row[6], 10) || 0;

      const salesCount = salesMap.get(jan) || 0;

      if (salesCount > 0) {
          console.log(`【デバッグ】マッチ成功！ 在庫JAN: "${jan}", 販売数: ${salesCount}`);
      }

      return {
        productName: row[0] || '',
        asin:        row[4] || '',
        jan:         jan, // 整形後のJANを保持
        quantity:    currentQuantity,
        salesCount:  salesCount,
        updatedQuantity: currentQuantity - salesCount,
      };
    });
  }, [inventoryData, salesData]);

  /** ユーザーがファイルを選択したときに呼ばれる */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  /** 「CSVを読み込み集計」ボタンが押されたときに呼ばれる */
  const handleLoadAndAggregate = () => {
    if (!selectedFile) {
      alert('CSVファイルを選択してください。');
      return;
    }
    if (isProductSheetLoading) {
      alert('商品台帳を読み込み中です。少し待ってから再度お試しください。');
      return;
    }
    if (productSheet.length === 0) {
      alert('商品台帳の読み込みが完了していません。少し待ってから再度お試しください。');
      return;
    }

    Papa.parse<OrderItem>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      encoding: "Shift_JIS",
      complete: (results) => {
        setCsvData(results.data as OrderItem[]);
        // alert(`${results.data.length}件の注文データを読み込み、集計しました。\n「在庫更新 & 確認」タブに移動して結果を確認してください。`);
        // setActiveTab('manage'); // 自動でタブを切り替える
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        alert('CSVファイルの読み込みに失敗しました。');
      }
    });
  };

  /** 「在庫を更新」ボタンが押されたときに呼ばれる */
  const handleWriteInventory = async () => {
    // --- 1. 入力値のバリデーション ---
    if (!selectedSheet || !date || !time || !manager) {
      alert('在庫シート、日付、時間、担当者をすべて選択・入力してください。');
      return;
    }
    const itemsToUpdate = mergedInventory.filter(item => item.salesCount > 0);
    if (itemsToUpdate.length === 0) {
      alert('更新対象の販売データがありません。CSVを読み込んでください。');
      return;
    }

    setIsUpdating(true); // 更新開始

    // --- 2. 更新対象の列を特定 ---
    // ヘッダーは3行目、データは4行目から。APIはC列から取得しているので、inventoryData[0]がC列以降のヘッダー。
    const headerRow = inventoryData[0];
    // ヘッダー行(3行目)から、ユーザーが選択した日付と一致する列を探す
    // 注: スプレッドシートの日付形式とinput[type=date]の形式('YYYY-MM-DD')を合わせる必要があります
    const dateColumnIndex = headerRow.findIndex(cell => cell === date);

    if (dateColumnIndex === -1) {
      alert(`エラー: 選択された日付「${date}」がシートのヘッダーに見つかりません。`);
      setIsUpdating(false);
      return;
    }

    // 更新する列のインデックスを計算 (APIから返されたデータ基準)
    const timeColIndex = dateColumnIndex + 1;
    const stockColIndex = dateColumnIndex + 2;
    const managerColIndex = dateColumnIndex + 3;

    // --- 3. APIに送る更新リクエストのリストを作成 ---
    const updatePromises = itemsToUpdate.map(item => {
      // 在庫データ内での行インデックスを探す
      const rowIndexInSheetData = mergedInventory.findIndex(invItem => invItem.jan === item.jan);
      // スプレッドシート上の実際の行番号に変換 (+4 = ヘッダー3行 + 1-based index)
      const sheetRowNumber = rowIndexInSheetData + 4;

      // 更新範囲 (例: 'シート名!K5:M5')
      const range = `${selectedSheet}!${String.fromCharCode(65 + timeColIndex + 2)}${sheetRowNumber}:${String.fromCharCode(65 + managerColIndex + 2)}${sheetRowNumber}`;

      const values = [[time, item.updatedQuantity, manager]];

      return fetch('/api/inventory-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName: selectedSheet, range, values }),
      });
    });

    // --- 4. すべての更新リクエストを並列で実行 ---
    try {
      const results = await Promise.all(updatePromises);
      const failedUpdates = results.filter(res => !res.ok);

      if (failedUpdates.length > 0) {
        alert(`${failedUpdates.length}件の更新に失敗しました。コンソールを確認してください。`);
        console.error("Failed responses:", failedUpdates);
      } else {
        alert(`${itemsToUpdate.length}件の商品の在庫更新が完了しました。`);
        // 成功したらデータを再読み込みして画面に反映
        fetch(`/api/inventory-read?sheetName=${selectedSheet}`)
          .then(res => res.json())
          .then(data => setInventoryData(data.values || []));
      }
    } catch (error) {
      alert('更新処理中に予期せぬエラーが発生しました。');
      console.error(error);
    } finally {
      setIsUpdating(false); // 更新終了
    }
  };

  return (
    <div>
      <header className={styles.header}>
        <h1>在庫管理</h1>
      </header>
      <main className={styles.main}>

        {/* --- タブナビゲーション --- */}
        <div className={styles.navContainer}>
          <div className={styles.navTabs}>
            <button onClick={() => setActiveTab('load')} disabled={activeTab === 'load'}>
              1. CSV読み込み & 集計
            </button>
            <button onClick={() => setActiveTab('manage')} disabled={activeTab === 'manage'}>
              2. 在庫更新 & 確認
            </button>
          </div>
        </div>

        {/* --- コンテンツパネル (アクティブなタブに応じて切り替え) --- */}
        <div className={styles.contentPanel}>
          {activeTab === 'load' ? (
            // --- 1. CSV読み込みタブのコンテンツ ---
            <div>
              <div className={styles.settingsPanel}>
                <input type="file" accept=".csv" onChange={handleFileSelect} />
                 {/* ローディング中はボタンを無効化 */}
                <button onClick={handleLoadAndAggregate} disabled={isProductSheetLoading}>
                  {isProductSheetLoading ? '商品台帳を準備中...' : 'CSVを読み込み集計'}
                </button>
              </div>

              {salesData.length > 0 && (
                <div className={styles.salesContainer}>
                  <h2>販売個数 集計リスト</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>商品名</th>
                        <th>ASIN</th>
                        <th>JAN</th>
                        <th>販売個数 (単品換算)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.map((item, index) => (
                        <tr key={`${item.JANコード}-${index}`}>
                          <td>{item.商品名}</td>
                          <td>{item.asin}</td>
                          <td>{item.JANコード}</td>
                          <td style={{ textAlign: 'center' }}>{item.単品換算数}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            // --- 2. 在庫更新タブのコンテンツ ---
            <div>
              <div className={styles.settingsPanel}>
                <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)}>
                  <option value="">-- 在庫シートを選択 --</option>
                  {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                <input type="time" value={time} onChange={e => setTime(e.target.value)} />
                <select value={manager} onChange={e => setManager(e.target.value)}>
                  <option value="" disabled>-- 担当者を選択 --</option>
                  {STAFF_LIST.map(staff => <option key={staff} value={staff}>{staff}</option>)}
                </select>
                <button onClick={handleWriteInventory}>在庫を更新</button>
              </div>

              <div className={styles.listContainer}>
                <h2>在庫一覧: {selectedSheet || "シート未選択"}</h2>
                <table>
                  <thead>
                    <tr>
                      <th>商品名</th>
                      <th>ASIN</th>
                      <th>JAN</th>
                      <th>現在庫</th>
                      <th style={{ color: 'blue' }}>販売数</th>
                      <th style={{ color: 'red' }}>更新後在庫</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedInventory.map((item, index) => (
                      <tr key={`${item.asin}-${index}`}>
                        <td>{item.productName}</td>
                        <td>{item.asin}</td>
                        <td>{item.jan}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        {/* 新しいデータセルを追加 */}
                        <td style={{ textAlign: 'center', color: 'blue', fontWeight: 'bold' }}>
                          {item.salesCount > 0 ? item.salesCount : '-'}
                        </td>
                        <td style={{ textAlign: 'center', color: 'red', fontWeight: 'bold' }}>
                          {item.updatedQuantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}