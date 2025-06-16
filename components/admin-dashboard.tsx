"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { FileTextIcon, SearchIcon, SlidersIcon, UsersIcon, CalendarIcon, CalendarRangeIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { TellimusteNimekiri } from "@/components/tellimuste-nimekiri"
import { KasutajateNimekiri } from "@/components/kasutajate-nimekiri"
import { StatistikaKaart } from "@/components/statistika-kaart"
import { Logo } from "@/components/logo"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { et } from "date-fns/locale"
import { cn } from "@/lib/utils"

type Statistics = {
  paidOrdersCount: number;
  quickAnalysesCount: number;
  fullAnalysesCount: number;
  usersCount: number;
  period?: string;
}

type PeriodOption = {
  value: string;
  label: string;
}

type ActiveView = 'tellimused' | 'kasutajad' | 'analuusid' | 'seaded'

export function AdminDashboard() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('tellimused');

  const periodOptions: PeriodOption[] = [
    { value: "all", label: "Kõik aeg" },
    { value: "today", label: "Täna" },
    { value: "7days", label: "Viimased 7 päeva" },
    { value: "30days", label: "Viimased 30 päeva" },
    { value: "3months", label: "Viimased 3 kuud" },
    { value: "6months", label: "Viimased 6 kuud" },
    { value: "1year", label: "Viimane aasta" },
    { value: "custom", label: "Kohandatud ajavahemik" },
  ];

  useEffect(() => {
    async function fetchStatistics() {
      try {
        setLoading(true);

        let url = '/api/statistics';
        const params = new URLSearchParams();

        if (selectedPeriod === 'custom' && dateRange.from && dateRange.to) {
          params.append('from', dateRange.from.toISOString());
          params.append('to', dateRange.to.toISOString());
        } else {
          params.append('period', selectedPeriod);
        }

        url = `${url}?${params.toString()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Statistika laadimine ebaõnnestus');
        }
        
        const data = await response.json();
        setStatistics(data);
      } catch (error: any) {
        setError(error.message || 'Statistika laadimine ebaõnnestus');
        console.error('Error fetching statistics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStatistics();
  }, [selectedPeriod, dateRange]);

  const getPeriodLabel = (value: string): string => {
    if (value === 'custom' && dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'dd.MM.yyyy')} - ${format(dateRange.to, 'dd.MM.yyyy')}`;
    }
    const option = periodOptions.find(opt => opt.value === value);
    return option ? option.label : "Kõik aeg";
  };

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(value);
    if (value === 'custom') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
    }
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'tellimused':
        return 'Tellimused';
      case 'kasutajad':
        return 'Kasutajad';
      case 'analuusid':
        return 'Analüüsid';
      case 'seaded':
        return 'Seaded';
      default:
        return 'Tellimused';
    }
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'tellimused':
        return (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Tellimused</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="search" placeholder="Otsi tellimusi..." className="pl-8 md:w-[300px]" />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <TellimusteNimekiri />
            </div>
          </div>
        );
      case 'kasutajad':
        return (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Kasutajad</h2>
            </div>
            <div className="mt-4">
              <KasutajateNimekiri />
            </div>
          </div>
        );
      case 'analuusid':
        return (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Analüüsid</h2>
            </div>
            <div className="mt-4">
              <p className="text-muted-foreground">Analüüside haldamise funktsioonid tulekul...</p>
            </div>
          </div>
        );
      case 'seaded':
        return (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Seaded</h2>
            </div>
            <div className="mt-4">
              <p className="text-muted-foreground">Süsteemi seadete haldamine tulekul...</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background py-5">
        <div className="flex items-center px-4 md:px-6">
          <Logo />
          <nav className="ml-auto flex gap-4 sm:gap-6">
            <Button 
              variant={activeView === 'tellimused' ? "default" : "ghost"} 
              className="text-sm font-medium"
              onClick={() => setActiveView('tellimused')}
            >
              Tellimused
            </Button>
            <Button 
              variant={activeView === 'kasutajad' ? "default" : "ghost"} 
              className="text-sm font-medium"
              onClick={() => setActiveView('kasutajad')}
            >
              Kasutajad
            </Button>
            <Button 
              variant={activeView === 'analuusid' ? "default" : "ghost"} 
              className="text-sm font-medium"
              onClick={() => setActiveView('analuusid')}
            >
              Analüüsid
            </Button>
            <Button 
              variant={activeView === 'seaded' ? "default" : "ghost"} 
              className="text-sm font-medium"
              onClick={() => setActiveView('seaded')}
            >
              Seaded
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="mb-4 flex justify-end">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Ajavahemik:</span>
            <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vali ajavahemik" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPeriod === 'custom' &&
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarRangeIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd.MM.yyyy")} - {format(dateRange.to, "dd.MM.yyyy")}
                        </>
                      ) : (
                        format(dateRange.from, "dd.MM.yyyy")
                      )
                    ) : (
                      "Vali kuupäevavahemik"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange as any}
                    initialFocus
                    locale={et}
                  />
                </PopoverContent>
              </Popover>
            }
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatistikaKaart
            pealkiri="Makstud tellimusi"
            väärtus={loading ? "Laadin..." : error ? "Viga" : `${statistics?.paidOrdersCount || 0}`}
            muutus={loading || error ? "" : getPeriodLabel(selectedPeriod)}
            ikoon={<FileTextIcon className="h-4 w-4 text-muted-foreground" />}
          />
          <StatistikaKaart
            pealkiri="E-posti andnud kasutajaid"
            väärtus={loading ? "Laadin..." : error ? "Viga" : `${statistics?.usersCount || 0}`}
            muutus={loading || error ? "" : getPeriodLabel(selectedPeriod)}
            ikoon={<UsersIcon className="h-4 w-4 text-muted-foreground" />}
          />
          <StatistikaKaart
            pealkiri="Teostatud eelanalüüse"
            väärtus={loading ? "Laadin..." : error ? "Viga" : `${statistics?.quickAnalysesCount || 0}`}
            muutus={loading || error ? "" : getPeriodLabel(selectedPeriod)}
            ikoon={<SlidersIcon className="h-4 w-4 text-muted-foreground" />}
          />
          <StatistikaKaart
            pealkiri="Teostatud põhjalikke analüüse"
            väärtus={loading ? "Laadin..." : error ? "Viga" : `${statistics?.fullAnalysesCount || 0}`}
            muutus={loading || error ? "" : getPeriodLabel(selectedPeriod)}
            ikoon={<SlidersIcon className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
        <div className="mt-6">
          {renderActiveView()}
        </div>
      </main>
    </div>
  )
}
