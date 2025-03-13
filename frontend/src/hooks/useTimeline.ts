import { useState, useEffect, useCallback, useRef } from 'react';
import { ObterDadosTimeline } from '../../wailsjs/go/main/App';
import { withRuntime } from '@/lib/wailsRuntime';

interface RawPunchRecord {
  timestamp: string;
  type: number;
  location: string;
}

export interface SpecialPunchEvent {
  timestamp: string;
  type: 'sporadic-out' | 'sporadic-in';
  description?: string;
}

export interface TimelineData {
  clockInTime?: string;
  lunchStartTime?: string;
  lunchEndTime?: string;
  clockOutTime?: string;
  specialEvents?: SpecialPunchEvent[];
  rawRecords?: RawPunchRecord[];
}

const processRawRecords = (records?: RawPunchRecord[]): Partial<TimelineData> => {
  if (!records || records.length === 0) {
    return {};
  }
  
  const sortedRecords = [...records].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  console.log('Processando registros ordenados:', sortedRecords);
  
  const result: Partial<TimelineData> = {
    rawRecords: sortedRecords,
    specialEvents: []
  };
  
  const entradas = sortedRecords.filter(r => r.type === 0);
  const saidasAlmoco = sortedRecords.filter(r => r.type === 1);
  const saidas = sortedRecords.filter(r => r.type === 2);
  
  console.log(`Encontrados: ${entradas.length} entradas, ${saidasAlmoco.length} saídas de almoço, ${saidas.length} saídas`);
  
  if (entradas.length > 0) {
    result.clockInTime = entradas[0].timestamp;
  }
  
  if (saidasAlmoco.length > 0) {
    result.lunchStartTime = saidasAlmoco[0].timestamp;
    
    const lunchStartTime = new Date(saidasAlmoco[0].timestamp);
    const entradaAposAlmoco = entradas.find(e => new Date(e.timestamp) > lunchStartTime);
    
    if (entradaAposAlmoco) {
      result.lunchEndTime = entradaAposAlmoco.timestamp;
    }
  }
  
  let lastProcessedTime = result.clockInTime ? new Date(result.clockInTime) : new Date(0);
  
  if (result.lunchEndTime) {
    lastProcessedTime = new Date(result.lunchEndTime);
  }
  
  for (let i = 0; i < saidas.length; i++) {
    const saida = saidas[i];
    const saidaTime = new Date(saida.timestamp);
    
    const proximaEntrada = entradas.find(e => new Date(e.timestamp) > saidaTime);
    
    if (proximaEntrada && new Date(proximaEntrada.timestamp) > lastProcessedTime) {
      result.specialEvents?.push({
        timestamp: saida.timestamp,
        type: 'sporadic-out',
        description: saida.location
      });
      
      result.specialEvents?.push({
        timestamp: proximaEntrada.timestamp,
        type: 'sporadic-in',
        description: proximaEntrada.location
      });
      
      lastProcessedTime = new Date(proximaEntrada.timestamp);
    } else if (i === saidas.length - 1) {
      result.clockOutTime = saida.timestamp;
    } else {
      result.specialEvents?.push({
        timestamp: saida.timestamp,
        type: 'sporadic-out',
        description: saida.location
      });
    }
  }
  
  if (result.specialEvents && result.specialEvents.length > 0) {
    result.specialEvents.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    console.log('Eventos especiais:', result.specialEvents);
  }
  
  console.log('Timeline processada:', result);
  return result;
};

export function useTimeline() {
  const [timelineData, setTimelineData] = useState<TimelineData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshInProgressRef = useRef<boolean>(false);
  const runtimeErrorCount = useRef<number>(0);

  const fetchTimelineData = useCallback(async (force = false) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    if (refreshInProgressRef.current && !force) {
      console.log('Timeline: Refresh already in progress, scheduling for later...');
      refreshTimeoutRef.current = setTimeout(() => fetchTimelineData(true), 500);
      return;
    }
    
    try {
      refreshInProgressRef.current = true;
      setIsLoading(true);
      setError(null);
      
      console.log('Timeline: Fetching data from backend...');
      
      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao buscar dados da timeline')), 5000);
      });
      
      const rawData = await Promise.race([
        withRuntime<any>(() => ObterDadosTimeline(), {}),
        timeoutPromise
      ]);
      
      console.log('Timeline: Raw data received:', rawData);
      
      let processedData: TimelineData = {};
      
      if (rawData.records && Array.isArray(rawData.records)) {
        processedData = processRawRecords(rawData.records) as TimelineData;
      } else {
        processedData = {
          clockInTime: rawData.clockInTime,
          lunchStartTime: rawData.lunchStartTime,
          lunchEndTime: rawData.lunchEndTime,
          clockOutTime: rawData.clockOutTime,
          specialEvents: rawData.specialEvents || [],
        };
      }
      
      console.log('Timeline: Processed data:', processedData);
      
      if (!processedData.specialEvents) {
        processedData.specialEvents = [];
      }
      
      setTimelineData(processedData);
      setLastUpdated(new Date());
      runtimeErrorCount.current = 0;
    } catch (error) {
      console.error('Timeline: Error fetching data:', error);
      
      if (error instanceof Error && error.name === 'RuntimeError') {
        runtimeErrorCount.current += 1;
      }
      
      const errorMessage = 
        runtimeErrorCount.current > 2 
          ? 'Problemas de conexão com o aplicativo. Tente reiniciar.' 
          : typeof error === 'string' 
            ? error 
            : error instanceof Error 
              ? error.message 
              : 'Erro desconhecido ao buscar dados';
      
      setError(errorMessage);
      
      if (runtimeErrorCount.current > 5) {
        console.error('Timeline: Too many runtime errors, stopping auto-refresh');
        return;
      }
    } finally {
      setIsLoading(false);
      refreshInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    console.log('Timeline: Hook mounted, initializing data');
    fetchTimelineData();
    
    return () => {
      console.log('Timeline: Hook unmounted, cleaning up');
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchTimelineData]);

  useEffect(() => {
    const handleRefreshEvent = () => {
      console.log('Timeline: Refresh event received, updating data...');
      fetchTimelineData();
    };

    window.addEventListener('refresh_timeline', handleRefreshEvent);

    return () => {
      window.removeEventListener('refresh_timeline', handleRefreshEvent);
    };
  }, [fetchTimelineData]);

  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;
    let refreshInterval: NodeJS.Timeout;
    let userActive = true;
    
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      userActive = true;
      inactivityTimer = setTimeout(() => {
        userActive = false;
      }, 10 * 60 * 1000);
    };

    refreshInterval = setInterval(() => {
      if (userActive) {
        console.log('Timeline: Auto-refreshing data...');
        fetchTimelineData();
      }
    }, 5 * 60 * 1000);

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = resetInactivityTimer;
    
    resetInactivityTimer();
    
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });
    
    return () => {
      console.log('Timeline: Clearing auto-refresh');
      
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      clearInterval(refreshInterval);
      clearTimeout(inactivityTimer);
    };
  }, [fetchTimelineData]);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      await fetchTimelineData(true);
    } catch (error) {
      console.error('Timeline: Error in manual refresh:', error);
      throw error;
    }
  }, [fetchTimelineData]);

  const timelineProps = {
    clockInTime: timelineData.clockInTime ? new Date(timelineData.clockInTime) : undefined,
    lunchStartTime: timelineData.lunchStartTime ? new Date(timelineData.lunchStartTime) : undefined,
    lunchEndTime: timelineData.lunchEndTime ? new Date(timelineData.lunchEndTime) : undefined,
    clockOutTime: timelineData.clockOutTime ? new Date(timelineData.clockOutTime) : undefined,
    specialEvents: timelineData.specialEvents ? timelineData.specialEvents.map(event => ({
      ...event,
      timestamp: new Date(event.timestamp)
    })) : [],
  };

  return {
    ...timelineProps,
    isLoading,
    error,
    lastUpdated,
    refresh
  };
}

export const refreshTimeline = (): void => {
  console.log('Timeline: Dispatching refresh event');
  
  try {
    window.dispatchEvent(new CustomEvent('refresh_timeline'));
  } catch (error) {
    console.error('Timeline: Error dispatching refresh event:', error);
  }
};
