"use client"

import { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, KeyIcon, UserIcon, XCircleIcon, EyeIcon, EyeOffIcon, LinkIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from 'date-fns'
import { toast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { debounce } from '@/lib/utils'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

// Define User type based on Supabase auth.users and profiles tables
type User = {
  id: string
  email: string
  created_at: string
  last_sign_in_at?: string
  email_confirmed_at?: string
  phone?: string
  eesnimi: string
  perenimi: string
  profile_created_at?: string
  user_metadata?: any
  app_metadata?: any
}

type Pagination = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export function KasutajateNimekiri() {
  const [kasutajad, setKasutajad] = useState<User[]>([])
  const [filteredKasutajad, setFilteredKasutajad] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1
  })
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [searchLoading, setSearchLoading] = useState<boolean>(false)
  const [totalSearchCount, setTotalSearchCount] = useState<number>(0)

  // Password change state
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

  // Magic link generation state
  const [generatingMagicLink, setGeneratingMagicLink] = useState<string | null>(null)

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/users?page=${page}&pageSize=${pagination.pageSize}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Kasutajate laadimine ebaõnnestus')
      }
      
      const { data, pagination: paginationData } = await response.json()
      setKasutajad(data || [])
      setFilteredKasutajad(data || [])
      setPagination(paginationData)
    } catch (error: any) {
      setError(error.message || 'Kasutajate laadimine ebaõnnestus')
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async (query: string) => {
    if (!query || query.trim() === '') {
      setSearchResults([])
      setIsSearching(false)
      setTotalSearchCount(0)
      return
    }

    try {
      setSearchLoading(true)
      setIsSearching(true)
      
      const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Otsing ebaõnnestus')
      }
      
      const { data, totalCount } = await response.json()
      setSearchResults(data || [])
      setTotalSearchCount(totalCount || 0)
    } catch (error: any) {
      console.error('Error searching users:', error)
      toast({
        title: "Otsingu viga",
        description: error.message || "Kasutajate otsimine ebaõnnestus",
        variant: "destructive",
      })
    } finally {
      setSearchLoading(false)
    }
  }

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((query: string) => searchUsers(query), 300),
    []
  )

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    debouncedSearch(query)
  }

  const clearSearch = () => {
    setSearchQuery("")
    setSearchResults([])
    setIsSearching(false)
    setTotalSearchCount(0)
  }

  const handlePageChange = (newPage: number) => {
    if (isSearching) return // Don't paginate during search
    setPagination(prev => ({ ...prev, page: newPage }))
    fetchUsers(newPage)
  }

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'dd.MM.yyyy HH:mm')
    } catch {
      return 'Teadmata'
    }
  }

  const getEmailBadge = (user: User) => {
    if (user.email_confirmed_at) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Kinnitatud</Badge>
    }
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Kinnitamata</Badge>
  }

  const handleChangePassword = async () => {
    if (!selectedUser) return

    if (newPassword !== confirmPassword) {
      toast({
        title: "Viga",
        description: "Paroolid ei ühti",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Viga",
        description: "Parool peab olema vähemalt 6 tähemärki pikk",
        variant: "destructive",
      })
      return
    }

    try {
      setChangingPassword(true)
      
      const response = await fetch(`/api/users/${selectedUser.id}/change-password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: newPassword
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Parooli muutmine ebaõnnestus')
      }

      toast({
        title: "Õnnestus",
        description: `Kasutaja ${selectedUser.email} parool on edukalt muudetud`,
      })

      // Reset form and close dialog
      setNewPassword("")
      setConfirmPassword("")
      setPasswordDialogOpen(false)
      setSelectedUser(null)
      setShowPassword(false)
    } catch (error: any) {
      console.error('Error changing password:', error)
      toast({
        title: "Viga",
        description: error.message || "Parooli muutmine ebaõnnestus",
        variant: "destructive",
      })
    } finally {
      setChangingPassword(false)
    }
  }

  const openPasswordDialog = (user: User) => {
    setSelectedUser(user)
    setPasswordDialogOpen(true)
    setNewPassword("")
    setConfirmPassword("")
    setShowPassword(false)
  }

  const handleGenerateMagicLink = async (user: User) => {
    try {
      setGeneratingMagicLink(user.id)
      
      const response = await fetch(`/api/users/${user.id}/generate-magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Magic lingi genereerimine ebaõnnestus')
      }

      const { magicLink } = await response.json()

      // Copy to clipboard
      await navigator.clipboard.writeText(magicLink)
      
      toast({
        title: "Õnnestus",
        description: `Magic link kasutajale ${user.email} on genereeritud ja kopeeritud clipboardi`,
      })
    } catch (error: any) {
      console.error('Error generating magic link:', error)
      toast({
        title: "Viga",
        description: error.message || "Magic lingi genereerimine ebaõnnestus",
        variant: "destructive",
      })
    } finally {
      setGeneratingMagicLink(null)
    }
  }

  // Determine which users to display (search results or regular list)
  const displayedUsers = useMemo(() => {
    if (isSearching && searchQuery) {
      return searchResults
    }
    return filteredKasutajad
  }, [isSearching, searchQuery, searchResults, filteredKasutajad])

  if (loading && pagination.page === 1) {
    return <div className="p-4 text-center">Laadin kasutajaid...</div>
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
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Otsi kasutajaid..."
              className="pl-8 md:w-[300px]"
              value={searchQuery}
              onChange={handleSearchInputChange}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
              >
                <XCircleIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isSearching && (
        <div className="mb-4 flex items-center justify-between bg-muted p-3 rounded-lg">
          <div className="text-sm">
            {searchLoading ? (
              "Otsin kasutajaid..."
            ) : (
              `Leitud ${totalSearchCount} kasutajat otsingule "${searchQuery}"`
            )}
          </div>
          <Button variant="outline" size="sm" onClick={clearSearch}>
            Tühista otsing
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kasutaja</TableHead>
              <TableHead>E-post</TableHead>
              <TableHead>Registreeritud</TableHead>
              <TableHead>Viimane sisselogimine</TableHead>
              <TableHead>E-posti staatus</TableHead>
              <TableHead className="text-right">Tegevused</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  {searchLoading 
                    ? "Otsin kasutajaid..." 
                    : (isSearching 
                        ? `Otsingule "${searchQuery}" ei leitud vasteid` 
                        : "Kasutajaid ei leitud")}
                </TableCell>
              </TableRow>
            ) : (
              displayedUsers.map((kasutaja) => (
                <TableRow key={kasutaja.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {kasutaja.eesnimi || kasutaja.perenimi 
                            ? `${kasutaja.eesnimi} ${kasutaja.perenimi}`.trim()
                            : 'Nimi puudub'
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {kasutaja.id.substring(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{kasutaja.email}</TableCell>
                  <TableCell>{formatDate(kasutaja.created_at)}</TableCell>
                  <TableCell>
                    {kasutaja.last_sign_in_at 
                      ? formatDate(kasutaja.last_sign_in_at)
                      : 'Pole kunagi'
                    }
                  </TableCell>
                  <TableCell>{getEmailBadge(kasutaja)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPasswordDialog(kasutaja)}
                        className="gap-2"
                      >
                        <KeyIcon className="h-4 w-4" />
                        Muuda parooli
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateMagicLink(kasutaja)}
                        disabled={generatingMagicLink === kasutaja.id}
                        className="gap-2"
                      >
                        <LinkIcon className="h-4 w-4" />
                        {generatingMagicLink === kasutaja.id ? "Genereerin..." : "Magic Link"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination - only show when not searching */}
      {!isSearching && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            Lehekülg {pagination.page} / {pagination.totalPages} 
            (kokku {pagination.totalCount} kasutajat)
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Eelmine
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              Järgmine
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Muuda kasutaja parooli</DialogTitle>
            <DialogDescription>
              Muuda kasutaja {selectedUser?.email} parooli. Uus parool peab olema vähemalt 6 tähemärki pikk.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-password" className="text-right">
                Uus parool
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Sisesta uus parool"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="confirm-password" className="text-right">
                Kinnita parool
              </Label>
              <div className="col-span-3">
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Kinnita uus parool"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
              disabled={changingPassword}
            >
              Tühista
            </Button>
            <Button
              type="button"
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword || !confirmPassword}
            >
              {changingPassword ? "Muudan..." : "Muuda parooli"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 