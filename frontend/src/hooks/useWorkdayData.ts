import { useState, useEffect } from 'react';
import { useTimeline } from './useTimeline';

export interface WorkdayData {
  isLoading: boolean;
  error?: string | null;
  clockInTime?: Date;
  lunchStartTime?: Date;
  lunchEndTime?: Date;
  clockOutTime?: Date;
  extraBreakMinutes: number;
}

export const useWorkdayData = (): WorkdayData => {
  const {
    clockInTime,
    lunchStartTime,
    lunchEndTime,
    clockOutTime,
    isLoading,
    error,
    refresh
  } = useTimeline();

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 120000);
    
    return () => clearInterval(interval);
  }, [refresh]);

  const extraBreakMinutes = 
    (lunchStartTime && lunchEndTime) ? 
      Math.max(0, Math.floor((lunchEndTime.getTime() - lunchStartTime.getTime()) / 60000) - 60) : 
      0;

  return {
    isLoading,
    error: error,
    clockInTime,
    lunchStartTime,
    lunchEndTime,
    clockOutTime,
    extraBreakMinutes
  };
};