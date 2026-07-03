"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface WeeklyTutCardProps {
  activityCalendar?: { date: string; volume: number }[];
  isLoading?: boolean;
}

export function WeeklyTutCard({ activityCalendar, isLoading }: WeeklyTutCardProps) {
  const weekData = React.useMemo(() => {
    if (!activityCalendar) return [];
    const cutoff = subDays(new Date(), 6);
    return activityCalendar
      .filter((d) => parseISO(d.date) >= cutoff)
      .map((d) => ({
        label: format(parseISO(d.date), "EEE"),
        tut: d.volume,
      }));
  }, [activityCalendar]);

  const weeklyTotal = weekData.reduce((s, d) => s + d.tut, 0);
  const maxTut = Math.max(...weekData.map((d) => d.tut), 1);

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="mb-3 h-8 w-20" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          <span>Volume total</span>
        </div>
        <div className="mb-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {weeklyTotal.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {weeklyTotal === 1 ? "s" : "s"}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">7 derniers jours</div>
        <div className="mt-2 h-14">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekData} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis hide domain={[0, maxTut]} />
              <Bar
                dataKey="tut"
                fill="hsl(var(--primary))"
                radius={[2, 2, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
