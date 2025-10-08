"use client";

import React from 'react';
import styles from './InventoryManageTab.module.css';
import type { InventoryItem } from '../../types';
import { Box, Button, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import { Update as UpdateIcon } from '@mui/icons-material';

const STAFF_LIST = ['宮原', '田中', '河野', '木村', '森本', '廣瀬'];

interface Props {
  sheetNames: string[];
  selectedSheet: string;
  date: string;
  time: string;
  manager: string;
  isUpdating: boolean;
  mergedInventory: InventoryItem[];
  onSetSelectedSheet: (value: string) => void;
  onSetDate: (value: string) => void;
  onSetTime: (value: string) => void;
  onSetManager: (value: string) => void;
  onSetToday: () => void;
  onSetCurrentTime: () => void;
  onWriteInventory: () => void;
}

const InventoryManageTab: React.FC<Props> = (props) => {
  return (
    <div>
      <Box className={styles.settingsPanel} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5rem' }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>在庫シート *</InputLabel>
          <Select value={props.selectedSheet} label="在庫シート *" onChange={e => props.onSetSelectedSheet(e.target.value)} size="small">
            {props.sheetNames.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TextField label="日付 *" type="date" value={props.date} onChange={e => props.onSetDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small"/>
          <Button onClick={props.onWriteInventory} variant="contained" color="success" startIcon={<UpdateIcon />}>
            今日
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TextField label="時間 *" type="time" value={props.time} onChange={e => props.onSetTime(e.target.value)} InputLabelProps={{ shrink: true }} size="small"/>
          <Button onClick={props.onSetCurrentTime} variant="contained" color="success" startIcon={<UpdateIcon />}>
            現在
          </Button>
        </Box>
        
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>担当者 *</InputLabel>
          <Select value={props.manager} label="担当者 *" onChange={e => props.onSetManager(e.target.value)} size="small">
            {STAFF_LIST.map(staff => <MenuItem key={staff} value={staff}>{staff}</MenuItem>)}
          </Select>
        </FormControl>

        <div style={{ flex: 1 }}/>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={props.onWriteInventory} variant="contained" color="success" startIcon={<UpdateIcon />} disabled={props.isUpdating}>
                {props.isUpdating ? '更新中...' : '在庫を更新'}
            </Button>
        </Box>
      </Box>      

      <h2 className={styles.listHeaderTitle}>
        在庫一覧: {props.selectedSheet || "シート未選択"}
      </h2>

      <div className={styles.listScroller}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '65%' }}>商品名</th>
              <th style={{ width: '10%' }}>ASIN</th>
              <th style={{ width: '10%' }}>JAN</th>
              <th style={{ width: '5%' }}>現在庫</th>
              <th style={{ width: '5%', color: 'blue' }}>販売数</th>
              <th style={{ width: '5%', color: 'red' }}>更新後在庫</th>
            </tr>
          </thead>
          <tbody>
            {props.mergedInventory.map((item, index) => (
              <tr key={`${item.asin}-${index}`}>
                <td>{item.productName}</td>
                <td>{item.asin}</td>
                <td>{item.jan}</td>
                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ textAlign: 'center', color: 'blue', fontWeight: 'bold' }}>{item.salesCount > 0 ? item.salesCount : '-'}</td>
                <td style={{ textAlign: 'center', color: 'red', fontWeight: 'bold' }}>{item.updatedQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryManageTab;