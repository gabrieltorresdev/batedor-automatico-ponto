import { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Info, RefreshCw, AlertTriangle, LogIn, LogOut, Coffee, Timer, ExternalLink, ChevronDown, ChevronUp, ArrowDown, ArrowUp } from 'lucide-react';
import { useTimeline, refreshTimeline, SpecialPunchEvent } from "@/hooks/useTimeline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

type EventType = 
  | 'in'
  | 'lunch-start'
  | 'lunch-end'
  | 'out'
  | 'sporadic-out'
  | 'sporadic-in';

interface PunchEvent {
  time: Date;
  type: EventType;
  isActual: boolean;
  description?: string;
}

interface CompactPunchTimelineProps {
  clockInTime?: Date;
  lunchStartTime?: Date;
  lunchEndTime?: Date;
  clockOutTime?: Date;
  specialEvents?: Array<{
    timestamp: Date;
    type: 'sporadic-out' | 'sporadic-in';
    description?: string;
  }>;
  className?: string;
  onRefresh?: () => void;
}

export const CompactPunchTimeline = ({
  clockInTime,
  lunchStartTime,
  lunchEndTime,
  clockOutTime,
  specialEvents = [],
  className = '',
  onRefresh
}: CompactPunchTimelineProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCompact, setIsCompact] = useState(true);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  const hasAnyData = clockInTime || lunchStartTime || lunchEndTime || clockOutTime || (specialEvents && specialEvents.length > 0);
  
  const formatTime = (date?: Date) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };
  
  const handleRefresh = () => {
    if (onRefresh) {
      setIsRefreshing(true);
      Promise.resolve(onRefresh()).finally(() => {
        setIsRefreshing(false);
        if (typeof refreshTimeline === 'function') {
          refreshTimeline();
        }
      });
    } else if (typeof refreshTimeline === 'function') {
      setIsRefreshing(true);
      Promise.resolve(refreshTimeline()).finally(() => {
        setIsRefreshing(false);
      });
    }
  };
  
  const getLunchDurationMinutes = (): number => {
    if (!lunchStartTime || !lunchEndTime) return 0;
    
    const lunchDuration = lunchEndTime.getTime() - lunchStartTime.getTime();
    return Math.floor(lunchDuration / (60 * 1000));
  };
  
  const getLunchWarningTime = (): string => {
    if (!clockInTime) return '--:--';
    
    const lunchLimit = new Date(clockInTime);
    lunchLimit.setHours(lunchLimit.getHours() + 6);
    
    return lunchLimit.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };
  
  const getEndDayWarningTime = (): string => {
    if (!clockInTime) return '--:--';
    
    const endLimit = new Date(clockInTime);
    endLimit.setHours(endLimit.getHours() + 9);
    
    if (lunchStartTime && lunchEndTime) {
      const lunchDuration = lunchEndTime.getTime() - lunchStartTime.getTime();
      const standardLunchDuration = 60 * 60 * 1000;
      
      if (lunchDuration > standardLunchDuration) {
        const extraLunchTime = lunchDuration - standardLunchDuration;
        endLimit.setTime(endLimit.getTime() + extraLunchTime);
      }
    }
    
    if (specialEvents && specialEvents.length > 0) {
      const pairedEvents = getPairedSporadicEvents(specialEvents);
      
      pairedEvents.forEach(pair => {
        if (pair.out && pair.in) {
          const ausenceTime = pair.in.timestamp.getTime() - pair.out.timestamp.getTime();
          endLimit.setTime(endLimit.getTime() + ausenceTime);
        }
      });
    }
    
    return endLimit.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };
  
  const isPastWarningTime = (warningTime: string): boolean => {
    if (warningTime === '--:--') return false;
    
    const currentTimeString = currentTime.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    return currentTimeString > warningTime;
  };
  
  const getWorkingTime = () => {
    if (!clockInTime) return '0h 0m';
    
    const allEvents: Array<{time: Date, isEntry: boolean}> = [];
    
    allEvents.push({time: clockInTime, isEntry: true});
    
    if (lunchStartTime) {
      allEvents.push({time: lunchStartTime, isEntry: false});
    }
    
    if (lunchEndTime) {
      allEvents.push({time: lunchEndTime, isEntry: true});
    }
    
    if (specialEvents && specialEvents.length > 0) {
      specialEvents.forEach(event => {
        if (event.type === 'sporadic-out') {
          allEvents.push({time: event.timestamp, isEntry: false});
        } else if (event.type === 'sporadic-in') {
          allEvents.push({time: event.timestamp, isEntry: true});
        }
      });
    }
    
    if (clockOutTime) {
      allEvents.push({time: clockOutTime, isEntry: false});
    } else {
      allEvents.push({time: new Date(), isEntry: false});
    }
    
    allEvents.sort((a, b) => a.time.getTime() - b.time.getTime());
    
    let totalMinutes = 0;
    let lastEntry: Date | null = null;
    
    for (let i = 0; i < allEvents.length; i++) {
      const event = allEvents[i];
      
      if (event.isEntry) {
        lastEntry = event.time;
      } else if (lastEntry) {
        const periodMinutes = Math.floor((event.time.getTime() - lastEntry.getTime()) / 60000);
        totalMinutes += periodMinutes;
        lastEntry = null;
      }
    }
    
    if (!clockOutTime && totalMinutes > 0) {}
    
    totalMinutes = Math.max(0, totalMinutes);
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  };
  
  const getPairedSporadicEvents = (events: Array<{timestamp: Date, type: string}>) => {
    const sortedEvents = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    const pairs: Array<{out?: {timestamp: Date, type: string}, in?: {timestamp: Date, type: string}}> = [];
    let currentOut: {timestamp: Date, type: string} | null = null;
    
    for (const event of sortedEvents) {
      if (event.type === 'sporadic-out') {
        if (currentOut) {
          pairs.push({ out: currentOut });
        }
        currentOut = event;
      } else if (event.type === 'sporadic-in' && currentOut) {
        pairs.push({ out: currentOut, in: event });
        currentOut = null;
      }
    }
    
    if (currentOut) {
      pairs.push({ out: currentOut });
    }
    
    return pairs;
  };
  
  const timelineEvents = useMemo(() => {
    const events: {
      time: Date;
      type: 'entrada' | 'saida-almoco' | 'volta-almoco' | 'saida-esporadica' | 'reentrada' | 'saida';
      location?: string;
      showLocation: boolean;
    }[] = [];
    
    let lastLocation = '';
    
    if (clockInTime) {
      let firstLocation = specialEvents?.find(e => e.description)?.description || 'ESCRITORIO';
      
      events.push({
        time: clockInTime,
        type: 'entrada',
        location: firstLocation,
        showLocation: true
      });
      
      lastLocation = firstLocation || '';
    }
    
    if (lunchStartTime) {
      const specialEvent = specialEvents?.find(e => 
        Math.abs(new Date(e.timestamp).getTime() - lunchStartTime.getTime()) < 10000
      );
      
      const location = specialEvent?.description;
      
      events.push({
        time: lunchStartTime,
        type: 'saida-almoco',
        location,
        showLocation: location !== undefined && location !== lastLocation
      });
      
      if (location) {
        lastLocation = location;
      }
    }
    
    if (lunchEndTime) {
      const specialEvent = specialEvents?.find(e => 
        Math.abs(new Date(e.timestamp).getTime() - lunchEndTime.getTime()) < 10000
      );
      
      const location = specialEvent?.description;
      
      events.push({
        time: lunchEndTime,
        type: 'volta-almoco',
        location,
        showLocation: location !== undefined && location !== lastLocation
      });
      
      if (location) {
        lastLocation = location;
      }
    }
    
    if (specialEvents && specialEvents.length > 0) {
      const sortedEvents = [...specialEvents].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      for (const specialEvent of sortedEvents) {
        const time = new Date(specialEvent.timestamp);
        const location = specialEvent.description;
        
        const isMainEvent = 
          (clockInTime && Math.abs(time.getTime() - clockInTime.getTime()) < 10000) || 
          (lunchStartTime && Math.abs(time.getTime() - lunchStartTime.getTime()) < 10000) ||
          (lunchEndTime && Math.abs(time.getTime() - lunchEndTime.getTime()) < 10000) ||
          (clockOutTime && Math.abs(time.getTime() - clockOutTime.getTime()) < 10000);
        
        if (isMainEvent) continue;
        
        events.push({
          time,
          type: specialEvent.type === 'sporadic-out' ? 'saida-esporadica' : 'reentrada',
          location,
          showLocation: location !== undefined && location !== lastLocation
        });
        
        if (location) {
          lastLocation = location;
        }
      }
    }
    
    if (clockOutTime) {
      const specialEvent = specialEvents?.find(e => 
        Math.abs(new Date(e.timestamp).getTime() - clockOutTime.getTime()) < 10000
      );
      
      const location = specialEvent?.description;
      
      events.push({
        time: clockOutTime,
        type: 'saida',
        location,
        showLocation: location !== undefined && location !== lastLocation
      });
    }
    
    return events.sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [clockInTime, lunchStartTime, lunchEndTime, clockOutTime, specialEvents]);
  
  useEffect(() => {
    console.log('Timeline events com localização:', timelineEvents);
  }, [timelineEvents]);
  
  const toggleCompact = () => {
    setIsCompact(!isCompact);
  };
  
  if (isCompact) {
    return (
      <div className={cn(
        "w-full bg-card rounded-md shadow-sm border overflow-hidden",
        className
      )}>
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Jornada</span>
          </div>
          
        <div className="flex items-center gap-2">
            {hasAnyData && clockInTime && (
              <div className="flex items-center gap-1 bg-muted/30 px-1.5 py-0.5 rounded text-xs">
                <span className="text-muted-foreground">Tempo:</span>
                <span className="font-medium">{getWorkingTime()}</span>
              </div>
            )}
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={toggleCompact}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  Expandir visualização
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            </div>
        </div>
        
        {hasAnyData && (
          <div className="px-2 pb-2 flex flex-wrap gap-1.5">
            {timelineEvents.find(e => e.type === 'entrada') && (
              <div className="flex items-center gap-1 bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5 text-xs">
                <LogIn className="h-3 w-3" />
                <span>{formatTime(clockInTime)}</span>
              </div>
            )}
            
            {lunchStartTime && lunchEndTime && (
              <div className="flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 text-xs">
                <Coffee className="h-3 w-3" />
                <span>{formatTime(lunchStartTime)} - {formatTime(lunchEndTime)}</span>
              </div>
            )}
            
            {specialEvents && specialEvents.length > 0 && (
              <div className="flex items-center gap-1 bg-rose-100 text-rose-800 rounded-full px-2 py-0.5 text-xs">
                <ExternalLink className="h-3 w-3" />
                <span>{specialEvents.filter(e => e.type === 'sporadic-out').length}</span>
              </div>
            )}
            
            {clockOutTime && (
              <div className="flex items-center gap-1 bg-purple-100 text-purple-800 rounded-full px-2 py-0.5 text-xs">
                <LogOut className="h-3 w-3" />
                <span>{formatTime(clockOutTime)}</span>
              </div>
            )}
            
            {!clockOutTime && clockInTime && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-1 bg-red-100 text-red-800 rounded-full px-2 py-0.5 text-xs cursor-help",
                      isPastWarningTime(getEndDayWarningTime()) && "bg-red-200 text-red-900"
                    )}>
                      <AlertTriangle className="h-3 w-3" />
                      <span>Saída: {getEndDayWarningTime()}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p>Calculado como: entrada + 9h</p>
                    {lunchStartTime && lunchEndTime && (
                      <p className="mt-1">
                        {getLunchDurationMinutes() > 60 
                          ? `Como seu almoço foi mais longo que 1h, ${getLunchDurationMinutes() - 60} minutos foram adicionados`
                          : 'Seu almoço foi de no máximo 1h (padrão)'}
                      </p>
                    )}
                    {specialEvents && specialEvents.length > 0 && (
                      <p className="mt-1">Tempo de ausências esporádicas foi adicionado ao limite</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
        </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full bg-card rounded-md shadow-sm border overflow-hidden",
      className
    )}>
      <div
        className="timeline-debug hidden"
        data-events={JSON.stringify({
          clockInTime,
          lunchStartTime,
          lunchEndTime,
          clockOutTime,
          specialEvents
        })}
      />
      
      <div className="flex items-center justify-between p-2 bg-muted/30 border-b">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Jornada de Trabalho</span>
        </div>
        <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                    onClick={handleRefresh}
                  disabled={isRefreshing}
                  >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                </Button>
                </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                Atualizar dados
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={toggleCompact}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                Compactar visualização
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
        </div>
      </div>
      
      <div className="px-2.5 py-2">
        <div className="space-y-1.5">
          {timelineEvents.map((event, index) => {
            let icon;
            let bgColor;
            let textColor;
            let label;
            
            switch (event.type) {
              case 'entrada':
                icon = <LogIn className="h-3 w-3" />;
                bgColor = "bg-emerald-100";
                textColor = "text-emerald-600";
                label = "Entrada";
                break;
              case 'saida-almoco':
                icon = <Coffee className="h-3 w-3" />;
                bgColor = "bg-amber-100";
                textColor = "text-amber-600";
                label = "Saída almoço";
                break;
              case 'volta-almoco':
                icon = <Timer className="h-3 w-3" />;
                bgColor = "bg-blue-100";
                textColor = "text-blue-600";
                label = "Retorno almoço";
                break;
              case 'saida-esporadica':
                icon = <ArrowDown className="h-3 w-3" />;
                bgColor = "bg-rose-100";
                textColor = "text-rose-600";
                label = "Saída esporádica";
                break;
              case 'reentrada':
                icon = <ArrowUp className="h-3 w-3" />;
                bgColor = "bg-indigo-100";
                textColor = "text-indigo-600";
                label = "Reentrada";
                break;
              case 'saida':
                icon = <LogOut className="h-3 w-3" />;
                bgColor = "bg-purple-100";
                textColor = "text-purple-600";
                label = "Saída";
                break;
            }
            
            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={cn("h-5 w-5 rounded-full flex items-center justify-center", bgColor)}>
                    <div className={textColor}>{icon}</div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm">{label}</span>
                    {event.showLocation && event.location && (
                      <span className="text-xs text-muted-foreground">
                        {event.location}
                      </span>
                    )}
                  </div>
            </div>
                <span className="text-sm font-medium">{formatTime(event.time)}</span>
        </div>
            );
          })}
          
          {!clockOutTime && clockInTime && (
            <>
              {!lunchStartTime && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm cursor-help">Limite para intervalo</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p>Calculado como: entrada + 6h</p>
                          <p className="mt-1">Horário máximo recomendado para iniciar o intervalo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
                    isPastWarningTime(getLunchWarningTime()) && "text-amber-600"
                  )}>
                    {getLunchWarningTime()}
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-3 w-3 text-red-600" />
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm cursor-help opacity-70">Limite de expediente</span>
                </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p>Calculado como: entrada + 9h</p>
                        {lunchStartTime && lunchEndTime && (
                          <p className="mt-1">
                            {getLunchDurationMinutes() > 60 
                              ? `Como seu almoço foi mais longo que 1h, ${getLunchDurationMinutes() - 60} minutos foram adicionados`
                              : 'Seu almoço foi de no máximo 1h (padrão)'}
                          </p>
                        )}
                        {specialEvents && specialEvents.length > 0 && (
                          <p className="mt-1">Tempo de ausências esporádicas foi adicionado ao limite</p>
                        )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
      </div>
                <span className={cn(
                  "text-sm font-medium opacity-70",
                  isPastWarningTime(getEndDayWarningTime()) && "text-red-600"
                )}>
                  {getEndDayWarningTime()}
            </span>
          </div>
            </>
          )}
          
          {hasAnyData && clockInTime && (
            <div className="flex items-center justify-between pt-2 mt-1 border-t">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-3 w-3 text-primary" />
          </div>
                <span className="text-sm">Tempo trabalhado</span>
          </div>
              <span className="text-sm font-medium">{getWorkingTime()}</span>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};