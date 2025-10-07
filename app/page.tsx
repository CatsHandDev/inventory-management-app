"use client";

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import styles from './page.module.css';
import { usePickingLogic } from './hooks/usePickingLogics';
import type { OrderItem, PickingItemRow } from './types';

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

// 商品台帳データを取得
function useProductSheet() {
  const [productSheet, setProductSheet] = useState<string[][]>([]);
  useEffect(() => {
    fetch('/api/product-sheet').then(res => res.json()).then(data => setProductSheet(data.values || []));
  }, []);
  return productSheet;
}

export default function InventoryPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<OrderItem[]>([]);
  const productSheet = useProductSheet();
  const sheetNames = useInventorySheetNames();
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [inventoryData, setInventoryData] = useState<InventoryData>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [manager, setManager] = useState('');
  
  // ピッキングロジックを再利用して販売個数を計算
  const { pickingList: salesData } = usePickingLogic(csvData, productSheet);

  // --- データ読み込み ---
  // --- データ読み込み ---
  useEffect(() => {
    if (selectedSheet) {
      fetch(`/api/inventory-read?sheetName=${selectedSheet}`)
        .then(res => res.json())
        .then(data => setInventoryData(data.values || []));
    }
  }, [selectedSheet]);

  // ファイルが選択されたときのハンドラ
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  // 「読み込み＆集計」ボタンが押されたときのハンドラ
  const handleLoadAndAggregate = () => {
    if (!selectedFile) {
      alert('CSVファイルを選択してください。');
      return;
    }

    Papa.parse<OrderItem>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      encoding: "Shift_JIS",
      complete: (results) => {
        setCsvData(results.data as OrderItem[]);
        alert(`${results.data.length}件の注文データを読み込み、集計しました。`);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        alert('CSVファイルの読み込みに失敗しました。');
      }
    });
  };

  // 在庫書き込みハンドラ (まだ中身は実装しない)
  const handleWriteInventory = async () => { /* ... */ };

  return (
    <div>
      <header className={styles.header}>
        <h1>在庫管理</h1>
      </header>
      <main className={styles.main}>
        {/* --- 操作パネル --- */}
        <div className={styles.settingsPanel}>
          <input type="file" accept=".csv" onChange={handleFileSelect} />
          <button onClick={handleLoadAndAggregate}>CSVを読み込み集計</button>
        </div>

        {/* --- 集計結果表示エリア --- */}
        {salesData.length > 0 && (
          <div className={styles.salesContainer}>
            <h2>販売個数 集計リスト</h2>
            <table>
              <thead>
                <tr>
                  <th>商品名</th>
                  <th>JAN</th>
                  <th>販売個数 (単品換算)</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((item, index) => (
                  <tr key={`${item.JANコード}-${index}`}>
                    <td>{item.商品名}</td>
                    <td>{item.JANコード}</td>
                    <td style={{ textAlign: 'center' }}>{item.単品換算数}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- 在庫管理操作＆表示エリア --- */}
        <div className={styles.settingsPanel} style={{ marginTop: '2rem' }}>
          <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)}>
            <option value="">-- 在庫シートを選択 --</option>
            {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
          <input type="text" placeholder="担当者" value={manager} onChange={e => setManager(e.target.value)} />
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