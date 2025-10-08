"use client";

import React from 'react';
import styles from './CsvLoadTab.module.css';
import type { PickingItemRow } from '../../types';
import { Box, Button } from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';

interface Props {
  selectedFile: File | null;
  isProductSheetLoading: boolean;
  salesData: PickingItemRow[];
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadAndAggregate: () => void;
}

const CsvLoadTab: React.FC<Props> = ({
  selectedFile,
  isProductSheetLoading,
  salesData,
  onFileSelect,
  onLoadAndAggregate,
}) => {
  return (
    <div>
      <Box sx={{ p: 2, border: '1px dashed grey', borderRadius: 2, textAlign: 'center', mb: 2 }}>
        <Button component="label" variant="contained" startIcon={<CloudUploadIcon />}>
          CSVファイルを選択
          <input type="file" accept=".csv" onChange={onFileSelect} style={{ display: 'none' }} />
        </Button>
        {selectedFile && <p style={{ marginTop: '1rem' }}>選択中: {selectedFile.name}</p>}
      </Box>
      <Button 
        onClick={onLoadAndAggregate} 
        variant="contained" 
        color="primary"
        disabled={!selectedFile || isProductSheetLoading}
        fullWidth
      >
        {isProductSheetLoading ? '商品台帳を準備中...' : 'CSVを読み込み集計'}
      </Button>
      
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
  );
};

export default CsvLoadTab;