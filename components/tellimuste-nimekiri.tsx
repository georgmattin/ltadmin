"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowDownIcon, ArrowUpIcon, FileTextIcon, FilterIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, XCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from 'date-fns'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { createClient } from '@supabase/supabase-js'
import { Input } from "@/components/ui/input"
import { debounce } from '@/lib/utils'

// Initialize Supabase client (preferably this should be in a separate utility file)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Define Tellimus type based on Supabase one_time_orders table structure
type Tellimus = {
  id: string
  tellija_eesnimi: string
  tellija_perenimi: string
  tellija_firma: string
  created_at: string
  total_cost: number
  payment_status: string
  company_name: string
  status: string
  qm_status: string
  fm_status: string
  user_id?: string
  tellija_epost?: string
}

type Pagination = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

type SortField = "klient" | "created_at" | "total_cost" | "payment_status"
type SortDirection = "asc" | "desc"
type FilterType = "all" | "paid" | "full_analysis" | "quick_analysis"

export function TellimusteNimekiri() {
  const [tellimused, setTellimused] = useState<Tellimus[]>([])
  const [filteredTellimused, setFilteredTellimused] = useState<Tellimus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [filter, setFilter] = useState<FilterType>("all")
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 15,
    totalCount: 0,
    totalPages: 1
  })
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null)
  const [runningAnalysis, setRunningAnalysis] = useState<string | null>(null)
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [searchResults, setSearchResults] = useState<Tellimus[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [searchLoading, setSearchLoading] = useState<boolean>(false)
  const [totalSearchCount, setTotalSearchCount] = useState<number>(0)

  const fetchOrders = async (page = 1) => {
    try {
      setLoading(true)
      // Fetch orders from our secure API endpoint with pagination
      const response = await fetch(`/api/orders?page=${page}&pageSize=${pagination.pageSize}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Andmete laadimine ebaõnnestus')
      }
      
      const { data, pagination: paginationData } = await response.json()
      setTellimused(data || [])
      setFilteredTellimused(data || [])
      setPagination(paginationData)
    } catch (error: any) {
      setError(error.message || 'Andmete laadimine ebaõnnestus')
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders(pagination.page)
  }, [])

  useEffect(() => {
    // Apply filters when the filter state changes
    let results = [...tellimused]
    
    switch (filter) {
      case "paid":
        results = tellimused.filter(tellimus => tellimus.payment_status === "paid")
        break
      case "full_analysis":
        results = tellimused.filter(tellimus => tellimus.fm_status === "Done")
        break
      case "quick_analysis":
        results = tellimused.filter(tellimus => 
          tellimus.qm_status === "Done" && tellimus.fm_status !== "Done"
        )
        break
      default:
        // No filtering for "all"
        break
    }
    
    setFilteredTellimused(results)
  }, [filter, tellimused])

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    
    // If filter is active, just change the page state but don't refetch
    if (filter !== "all") {
      setPagination(prev => ({ ...prev, page: newPage }))
    } else {
      // Only fetch from API when no filter is active
      fetchOrders(newPage)
    }
  }

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (field !== sortField) return null
    return sortDirection === "asc" ? (
      <ArrowUpIcon className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDownIcon className="ml-1 h-4 w-4" />
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-primary text-primary-foreground">Makstud</Badge>
      case "pending":
        return <Badge variant="outline">Eelanalüüs tehtud</Badge>
      case "cancelled":
        return <Badge variant="destructive">Tühistatud</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Format date from ISO to dd.MM.yyyy
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Invalid date'
    
    try {
      // Ensure we're working with a date string that has the time part zeroed out
      // This helps avoid timezone issues when displaying just the date
      const [datePart] = dateString.split('T')
      if (!datePart) return 'Invalid date'
      
      // Parse the date part only and format it
      return format(new Date(`${datePart}T00:00:00Z`), 'dd.MM.yyyy')
    } catch (error) {
      console.error('Date formatting error:', error, 'for date:', dateString)
      return 'Invalid date'
    }
  }

  // Format price - returns €0 for pending payments, otherwise €20.00
  const formatPrice = (price: number, paymentStatus: string) => {
    return paymentStatus === "pending" ? "€0" : "€20.00";
  }

  // Handle payment status update
  const updatePaymentStatus = async (id: string, newStatus: string) => {
    try {
      setUpdatingPayment(id)
      
      // Get the current tellimus
      const currentTellimus = tellimused.find(t => t.id === id)
      if (!currentTellimus) return
      
      // Immediately update local state for better UX
      const updatedTellimused = tellimused.map(tellimus => 
        tellimus.id === id ? { ...tellimus, payment_status: newStatus } : tellimus
      )
      setTellimused(updatedTellimused)
      
      // Update filtered tellimused as well
      const updatedFilteredTellimused = filteredTellimused.map(tellimus => 
        tellimus.id === id ? { ...tellimus, payment_status: newStatus } : tellimus
      )
      
      // If filter is set to "paid", we need to handle removing/adding items
      if (filter === "paid") {
        if (newStatus === "paid") {
          // Item should be added if not already there
          if (!filteredTellimused.some(t => t.id === id)) {
            updatedFilteredTellimused.push({...currentTellimus, payment_status: newStatus})
          }
        } else {
          // Item should be removed if status is not paid
          const filteredResults = updatedFilteredTellimused.filter(t => t.id !== id)
          setFilteredTellimused(filteredResults)
          // Early return since we've already updated filteredTellimused
          toast({
            title: "Makse staatus uuendatud",
            description: `Tellimuse staatuseks on nüüd ${newStatus === 'paid' ? 'makstud' : 'ootel'}.`,
          })
          
          // Try the API update in the background
          fetch(`/api/orders/${id}/payment-status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus }),
          }).catch(err => console.error('Background update failed:', err))
          
          setUpdatingPayment(null)
          return
        }
      }
      
      // Update filtered list for other filter cases
      setFilteredTellimused(updatedFilteredTellimused)
      
      // Show success toast immediately for better UX
      toast({
        title: "Makse staatus uuendatud",
        description: `Tellimuse staatuseks on nüüd ${newStatus === 'paid' ? 'makstud' : 'ootel'}.`,
      })
      
      // Perform actual API update
      const response = await fetch(`/api/orders/${id}/payment-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Makse staatuse uuendamine ebaõnnestus')
      }
    } catch (error: any) {
      console.error('Error updating payment status:', error)
      toast({
        title: "Viga",
        description: error.message || 'Makse staatuse uuendamine ebaõnnestus',
        variant: "destructive",
      })
      
      // Revert the changes on error by refetching
      fetchOrders(pagination.page)
    } finally {
      setUpdatingPayment(null)
    }
  }

  // Handle running full analysis
  const runFullAnalysis = async (tellimus: Tellimus) => {
    try {
      setRunningAnalysis(tellimus.id)
      
      // API endpoint and authentication
      const uri = "https://developmenttestpythonbackendleiatoetus-fwahaqcnfcexewbz.swedencentral-01.azurewebsites.net/api/final-match-start"
      const headers = {
        "Authorization": "Bearer leiatoetusgu4SGC8HNgH9WbiRgQ3hjamDrh4hpSUKMK7vWIjkzJt4hAfH2i99otpohjEzfEpMwKXjpNxhfZ9EB0qBOAKxtFqQ2ZLd6TWLFxuiEIklYshjMTn7ONFa7j",
        "Content-Type": "application/json"
      }
      
      // Request body with order ID and user ID
      const body = {
        one_time_order_id: tellimus.id,
        user_id: tellimus.user_id || "9c1fda95-a1d3-4a71-93e6-8cd6543dd517" // Fallback to a default if not available
      }
      
      // Make the API request
      const response = await fetch(uri, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Põhjaliku analüüsi käivitamine ebaõnnestus')
      }
      
      // Handle successful response
      const result = await response.json()
      
      toast({
        title: "Põhjalik analüüs käivitatud",
        description: "Analüüsi tulemused on peagi saadaval.",
      })
      
      // Refresh the order list to get updated statuses
      fetchOrders(pagination.page)
    } catch (error: any) {
      console.error('Error running full analysis:', error)
      toast({
        title: "Viga",
        description: error.message || 'Põhjaliku analüüsi käivitamine ebaõnnestus',
        variant: "destructive",
      })
    } finally {
      setRunningAnalysis(null)
    }
  }

  // Handle invoice PDF download
  const downloadInvoicePdf = async (tellimus: Tellimus) => {
    try {
      setDownloadingInvoice(tellimus.id);
      
      // First, find the invoice ID from Supabase invoices table
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('id')
        .eq('order_id', tellimus.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no results
      
      if (invoiceError) {
        console.error("Supabase error:", invoiceError);
        throw new Error(invoiceError.message || 'Viga andmebaasi päringus');
      }
      
      if (!invoiceData) {
        // Try to create an invoice if it doesn't exist
        toast({
          title: "Arvet ei leitud",
          description: "Genereerime uue arve...",
        });
        
        // Call API to generate invoice (you would need to implement this)
        const createInvoiceResponse = await fetch('/api/create-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            order_id: tellimus.id,
            customer_name: `${tellimus.tellija_eesnimi} ${tellimus.tellija_perenimi}`,
            company_name: tellimus.tellija_firma || tellimus.company_name
          }),
        });
        
        if (!createInvoiceResponse.ok) {
          throw new Error('Arve loomine ebaõnnestus');
        }
        
        const newInvoice = await createInvoiceResponse.json();
        
        if (!newInvoice || !newInvoice.id) {
          throw new Error('Arve loomine ebaõnnestus');
        }
        
        var invoiceId = newInvoice.id;
      } else {
        var invoiceId = invoiceData.id;
      }
      
      console.log("Found invoice ID:", invoiceId);
      
      // Use our proxy API endpoint to generate and download the PDF
      // This avoids CORS issues since we're making a request to our own server
      const response = await fetch('/api/generate-invoice-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: invoiceId }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("PDF generation error:", errorText);
        throw new Error('PDF genereerimine ebaõnnestus');
      }
      
      // Convert response to blob
      const blob = await response.blob();
      
      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `arve_${tellimus.id.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "PDF allalaadimine õnnestus",
        description: "Arve PDF on salvestatud teie seadmesse.",
      });
    } catch (error: any) {
      console.error('Error downloading invoice PDF:', error);
      toast({
        title: "Viga",
        description: error.message || 'PDF allalaadimine ebaõnnestus',
        variant: "destructive",
      });
    } finally {
      setDownloadingInvoice(null);
    }
  };

  // New function to handle search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      // If search is empty, reset to normal filtered view
      setSearchResults([]);
      setIsSearching(false);
      setSearchLoading(false);
      setTotalSearchCount(0);
      return;
    }
    
    setIsSearching(true);
    setSearchLoading(true);
    
    // Normalize the search query (lowercase for case-insensitive search)
    const normalizedQuery = query.toLowerCase().trim();
    
    try {
      // Always perform a server-side search to get data from all pages
      const response = await fetch(`/api/orders/search?query=${encodeURIComponent(normalizedQuery)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Otsing ebaõnnestus');
      }
      
      const { data, totalCount, fullTextSearchUsed } = await response.json();
      setSearchResults(data || []);
      setTotalSearchCount(totalCount || data.length || 0);
      
      // Notify user if full text search was used
      if (fullTextSearchUsed) {
        toast({
          title: "Info",
          description: "Otsing sisaldab ka täistekstiotsinguga leitud tellimusi.",
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error('Error searching orders:', error);
      toast({
        title: "Viga",
        description: error.message || 'Otsing ebaõnnestus',
        variant: "destructive",
      });
      setSearchResults([]);
      setTotalSearchCount(0);
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      handleSearch(query);
    }, 300),
    [tellimused]
  );

  // Handle search input changes
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  // Determine which orders to display (search results, filtered, or all)
  const displayedOrders = useMemo(() => {
    if (isSearching && searchQuery) {
      return searchResults;
    }
    return filteredTellimused;
  }, [isSearching, searchQuery, searchResults, filteredTellimused]);

  if (loading && pagination.page === 1) {
    return <div className="p-4 text-center">Laadin tellimusi...</div>
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Viga: {error}</div>
  }

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <Button variant="outline">
          Ekspordi nimekiri
        </Button>
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative">
            {searchLoading ? (
              <div className="absolute left-2.5 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary"></div>
            ) : (
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            )}
            <Input 
              type="search" 
              placeholder="Otsi tellimusi..."
              className="pl-8 md:w-[300px]" 
              value={searchQuery}
              onChange={handleSearchInputChange}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearching(false);
                  setSearchResults([]);
                }}
              >
                <XCircleIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
          <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Vali filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kõik tellimused</SelectItem>
              <SelectItem value="paid">Makstud tellimused</SelectItem>
              <SelectItem value="full_analysis">Põhjalik analüüs teostatud</SelectItem>
              <SelectItem value="quick_analysis">Ainult eelanalüüs teostatud</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Tellimus ID</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("klient")}>
                <div className="flex items-center">Klient {getSortIcon("klient")}</div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("created_at")}>
                <div className="flex items-center">Kuupäev {getSortIcon("created_at")}</div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("total_cost")}>
                <div className="flex items-center">Summa {getSortIcon("total_cost")}</div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("payment_status")}>
                <div className="flex items-center">Makse staatus {getSortIcon("payment_status")}</div>
              </TableHead>
              <TableHead>Olek</TableHead>
              <TableHead className="text-right">Tegevused</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  {searchLoading 
                    ? "Otsin tellimusi..." 
                    : (isSearching 
                        ? `Otsingule "${searchQuery}" ei leitud vasteid` 
                        : "Tellimusi ei leitud")}
                </TableCell>
              </TableRow>
            ) : (
              displayedOrders.map((tellimus) => (
                <TableRow key={tellimus.id}>
                  <TableCell className="font-medium">{tellimus.id.substring(0, 8)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{tellimus.tellija_eesnimi} {tellimus.tellija_perenimi}</div>
                    <div className="text-sm text-muted-foreground">
                      {tellimus.tellija_firma || tellimus.company_name || 'Firma puudub'}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(tellimus.created_at)}</TableCell>
                  <TableCell>{formatPrice(tellimus.total_cost || 0, tellimus.payment_status)}</TableCell>
                  <TableCell>
                    <Select
                      value={tellimus.payment_status}
                      onValueChange={(value) => updatePaymentStatus(tellimus.id, value)}
                      disabled={updatingPayment === tellimus.id}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Ootel</SelectItem>
                        <SelectItem value="paid">Makstud</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{getStatusBadge(tellimus.payment_status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => downloadInvoicePdf(tellimus)}
                        disabled={downloadingInvoice === tellimus.id}
                      >
                        <FileTextIcon className="mr-1 h-4 w-4" />
                        {downloadingInvoice === tellimus.id ? 'Laadin...' : 'Lae alla PDF arve'}
                      </Button>
                      <Button size="sm" variant="outline">
                        Lae alla PDF toetuste analüüs
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => runFullAnalysis(tellimus)}
                        disabled={runningAnalysis === tellimus.id}
                      >
                        {runningAnalysis === tellimus.id ? 'Käivitamine...' : 'Käivita põhjalik analüüs'}
                      </Button>
                      <Button size="sm" variant="outline">
                        Käivita eelanalüüs
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Show search results count when searching */}
      {isSearching && searchResults.length > 0 && (
        <div className="mt-2 text-sm text-muted-foreground">
          Leitud {searchResults.length} tellimust 
          {totalSearchCount > searchResults.length && ` (kokku ${totalSearchCount})`} 
          otsingule "{searchQuery}"
        </div>
      )}
      
      {/* Pagination controls - only show when not searching */}
      {!loading && !isSearching && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center space-x-6">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1 || loading}
          >
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Eelmine
          </Button>
          
          <div className="text-sm">
            Lehekülg {pagination.page} / {pagination.totalPages}
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages || loading}
          >
            Järgmine
            <ChevronRightIcon className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
