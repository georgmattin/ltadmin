"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatistikaKaartProps {
  pealkiri: string
  väärtus: string
  muutus: string
  ikoon: ReactNode
}

export function StatistikaKaart({ pealkiri, väärtus, muutus, ikoon }: StatistikaKaartProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{pealkiri}</CardTitle>
        {ikoon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{väärtus}</div>
        <p className="text-xs text-muted-foreground">{muutus}</p>
      </CardContent>
    </Card>
  )
}
