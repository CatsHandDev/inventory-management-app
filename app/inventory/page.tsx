// app/inventory/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { usePickingLogic } from '../hooks/usePickingLogics'; // ピッキングロジックを再利用
import type { OrderItem, PickingItemRow } from '../types';

// 在庫データの型を定義
type InventoryData = string[][];

// 在庫シート名を取得するカスタムフック
function useInventorySheetNames() {
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  // ... (APIを呼び出すロジック)
  useEffect(() => {
    fetch('/api/inventory-sheets').then(res => res.json()).then(data => setSheetNames(data.sheetNames || []));
  }, []);
  return sheetNames;
}

export default function InventoryPage() {
  // --- 状態管理 ---
  // 商品台帳シートのデータ（ピッキングロジックで使用）
  const [productSheet, setProductSheet] = useState<string[][]>([]);
  // 読み込んだCSVデータ
  const [csvData, setCsvData] = useState<OrderItem[]>([]);
  // 在庫管理シートの全シート名
  const sheetNames = useInventorySheetNames();
  // UIで選択中のシート名
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  // 読み込んだ在庫データ
  const [inventoryData, setInventoryData] = useState<InventoryData>([]);
  // UIで入力された情報
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [manager, setManager] = useState(''); // "担当者" in Korean for variable name
  
  // ピッキングロジックを再利用して販売個数を計算
  const { pickingList: salesData } = usePickingLogic(csvData, productSheet);

  // --- データ読み込み ---
  // 商品台帳シートの読み込み（既存のロジックを簡略化）
  useEffect(() => {
    // 実際には useSheetData のようなフックを使う
    // fetch('/api/sheet-data').then(res => res.json()).then(data => setProductSheet(data.values));
  }, []);

  // 選択中の在庫シートが変更されたら、データを読み込む
  useEffect(() => {
    if (selectedSheet) {
      fetch(`/api/inventory-read?sheetName=${selectedSheet}`)
        .then(res => res.json())
        .then(data => setInventoryData(data.values || []));
    }
  }, [selectedSheet]);

  // CSVファイル読み込みハンドラ
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // ... Papa.parseでcsvDataとproductSheetをセットするロジック ...
  };

  // 在庫書き込みハンドラ
  const handleWriteInventory = async () => {
    if (!selectedSheet || salesData.length === 0) {
      alert('シートを選択し、CSVを読み込んでください。');
      return;
    }

    console.log("計算された販売データ:", salesData);
    console.log("現在の在庫データ:", inventoryData);

    // ここに販売データと在庫データを照合し、書き込みAPI(/api/inventory-write)を
    // ループで呼び出すロジックを実装します。
    alert('書き込みロジックは未実装です。コンソールログを確認してください。');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>在庫管理</h1>
      </header>
      <main style={{ padding: '20px' }}>
        {/* --- 操作パネル --- */}
        <div className="settings-panel">
          <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)}>
            <option value="">-- シートを選択 --</option>
            {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
          <input type="text" placeholder="担当者" value={manager} onChange={e => setManager(e.target.value)} />
          <input type="file" accept=".csv" onChange={handleFileChange} />
          <button onClick={handleWriteInventory}>在庫を更新</button>
        </div>

        {/* --- 在庫表示テーブル --- */}
        <div className="list-container">
          <h2>在庫一覧: {selectedSheet}</h2>
          <table>
            <thead>
              {inventoryData[0] && <tr>{inventoryData[0].map((header, i) => <th key={i}>{header}</th>)}</tr>}
            </thead>
            <tbody>
              {inventoryData.slice(1).map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}