"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import styles from './page.module.css';
import { usePickingLogic } from './hooks/usePickingLogics';
import type { OrderItem, InventoryItem } from './types';
import { Box, Button, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import { CloudUpload as CloudUploadIcon, Update as UpdateIcon } from '@mui/icons-material';
import CsvLoadTab from './components/CsvLoadTab/CsvLoadTab';
import InventoryManageTab from './components/InventoryManageTab/InventoryManageTab';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { IconButton } from '@mui/material';

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
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});

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

  const processedInventory = useMemo(() => {
    if (inventoryData.length < 2) {
      return [];
    }
    return inventoryData.slice(1).map(row => {
      const jan = String(row[5] || '').trim();
      const rawQuantity = row[6] || ''; // まず文字列として取得
      // .replace(/,/g, '') で全てのカンマを除去してからパースする
      const parsedQuantity = parseInt(rawQuantity.replace(/,/g, ''), 10) || 0;

      return {
        productName: String(row[0] || '').trim(),
        asin:        String(row[4] || '').trim(),
        jan,
        quantity:    parsedQuantity,
      };
    });
  }, [inventoryData]);

  const mergedInventory = useMemo((): InventoryItem[] => {
    // パフォーマンスのため、販売データをJANをキーにしたMapに変換
    const salesMap = new Map<string, number>();
    salesData.forEach(sale => {
      const cleanJan = String(sale.JANコード || '').trim();
      if (cleanJan && sale.単品換算数 > 0) {
        salesMap.set(cleanJan, sale.単品換算数);
      }
    });
    
    // processedInventoryをベースに、販売情報を追加
    return processedInventory.map(item => {
      const salesCount = salesMap.get(item.jan) || 0;
      return {
        ...item, // 元の在庫情報 (productName, asin, jan, quantity)
        salesCount,
        updatedQuantity: item.quantity - salesCount,
      };
    });
  }, [processedInventory, salesData]);

  // --- ユーザーがファイルを選択したときに呼ばれる
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  // --- 「CSVを読み込み集計」ボタンが押されたときに呼ばれる
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

  // --- 「在庫を更新」ボタンが押されたときに呼ばれる
  const handleWriteInventory = async () => {
    // --- 1. バリデーション ---
    if (!selectedSheet || !date || !time || !manager) { /* ... */ return; }
    const itemsToUpdate = mergedInventory.filter(item => item.salesCount > 0);
    if (itemsToUpdate.length === 0) { /* ... */ return; }
    if (inventoryData.length < 2) { /* ... */ return; }

    setIsUpdating(true);

    // --- 2. 書き込み可能な「クリーンな列グループ」を特定 ---
    let startColIndex = -1; // 書き込み開始列 (C列基準の0-based index)

    // 書き込み対象の列グループの開始インデックスをリスト化 (J, N, R, ...)
    const groupStartIndices = [7, 11, 15, 19, 23, 27, 31];

    for (const groupStartIndex of groupStartIndices) {
      let isGroupClean = true;
      const groupEndIndex = groupStartIndex + 3;

      // 更新対象の全商品について、このグループが使われていないかチェック
      for (const item of itemsToUpdate) {
        const rowIndex = mergedInventory.findIndex(invItem => invItem.jan === item.jan);
        if (rowIndex === -1) continue;
        
        const targetRowData = inventoryData[rowIndex + 1];

        // グループ内の4列をチェック
        for (let col = groupStartIndex; col <= groupEndIndex; col++) {
          if (targetRowData[col] && targetRowData[col].trim() !== '') {
            // 一つでも値があれば、このグループは「汚染されている」
            isGroupClean = false;
            break; // この行のチェックを終了
          }
        }
        if (!isGroupClean) break; // このグループのチェックを終了
      }

      // このグループがすべての更新対象商品でクリーンだったら、ここを書き込み先とする
      if (isGroupClean) {
        startColIndex = groupStartIndex;
        break;
      }
    }
    
    if (startColIndex === -1) {
      alert('エラー: 書き込み可能な空き列グループが見つかりませんでした。\n更新対象の商品の行を確認してください。');
      setIsUpdating(false);
      return;
    }

    // --- 3. APIに送る更新リクエストのリストを作成 ---
    const updatePromises = [];
    const sheetFirstColumnIndex = 'C'.charCodeAt(0) - 'A'.charCodeAt(0);

    // 3-1. ヘッダー行の更新 (日付)
    const headerRowNumber = 3;
    const headerRange = `${selectedSheet}!${String.fromCharCode('A'.charCodeAt(0) + startColIndex + sheetFirstColumnIndex)}${headerRowNumber}`;
    updatePromises.push(
      fetch('/api/inventory-write', {
        body: JSON.stringify({
        sheetName: selectedSheet, range: headerRange, values: [[date]]
      })})
    );
    
    // 3-2. 各商品のデータ行の更新
    itemsToUpdate.forEach(item => {
      const rowIndex = mergedInventory.findIndex(invItem => invItem.jan === item.jan);
      if (rowIndex === -1) return;

      const sheetRowNumber = rowIndex + 4;
      
      const range = `${selectedSheet}!${String.fromCharCode('A'.charCodeAt(0) + startColIndex + sheetFirstColumnIndex)}${sheetRowNumber}:${String.fromCharCode('A'.charCodeAt(0) + startColIndex + 3 + sheetFirstColumnIndex)}${sheetRowNumber}`;
      
      const values = [[date, time, item.updatedQuantity, manager]];

      updatePromises.push(
        fetch('/api/inventory-write', {
          body: JSON.stringify({
          sheetName: selectedSheet, range, values
        })})
      );
    });

    // --- 4. すべての更新リクエストを並列で実行 ---
    try {
      await Promise.all(updatePromises);
      alert(`${itemsToUpdate.length}件の商品在庫を更新しました。`);
      // データを再読み込み
      fetch(`/api/inventory-read?sheetName=${selectedSheet}`).then(res => res.json()).then(data => setInventoryData(data.values || []));
    } catch (error) {
      alert('更新処理中にエラーが発生しました。');
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  // --- 「今日」ボタンがクリックされたときに呼ばれる ---
  const handleSetToday = () => {
    const today = new Date();
    // YYYY-MM-DD 形式にフォーマット
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setDate(`${year}-${month}-${day}`);
  };

  // --- 「現在時刻」ボタンがクリックされたときに呼ばれる ---
  const handleSetCurrentTime = () => {
    const now = new Date();
    // HH:MM 形式にフォーマット
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setTime(`${hours}:${minutes}`);
  };

  return (
    <div>
      <header className={styles.header}><h1>在庫管理</h1></header>
      <main className={styles.main}>
        {/* --- タブナビゲーション --- */}
        <div className={styles.navContainer}>
          <div className={styles.navTabs}>
            <button onClick={() => setActiveTab('load')} disabled={activeTab === 'load'}>1. CSV読み込み & 集計</button>
            <button onClick={() => setActiveTab('manage')} disabled={activeTab === 'manage'}>2. 在庫更新 & 確認</button>
          </div>
        </div>

        {/* --- コンテンツパネル (コンポーネントを呼び出すだけ) --- */}
        <div className={styles.contentPanel}>
          {activeTab === 'load' ? (
            <CsvLoadTab
              selectedFile={selectedFile}
              isProductSheetLoading={isProductSheetLoading}
              salesData={salesData}
              onFileSelect={handleFileSelect}
              onLoadAndAggregate={handleLoadAndAggregate}
            />
          ) : (
            <InventoryManageTab
              sheetNames={sheetNames}
              selectedSheet={selectedSheet}
              date={date}
              time={time}
              manager={manager}
              isUpdating={isUpdating}
              mergedInventory={mergedInventory}
              onSetSelectedSheet={setSelectedSheet}
              onSetDate={setDate}
              onSetTime={setTime}
              onSetManager={setManager}
              onSetToday={handleSetToday}
              onSetCurrentTime={handleSetCurrentTime}
              onWriteInventory={handleWriteInventory}
            />
          )}
        </div>
      </main>
    </div>
  );
}