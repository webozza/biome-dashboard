"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: {
    value: string | number;
    isUp: boolean;
  };
  color?: string;
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  color = "var(--primary)" 
}: MetricCardProps) {
  return (
    <div className="card group relative overflow-hidden flex flex-col gap-5">
      {/* Background Synthesis Glow */}
      <div 
        className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-[60px] opacity-10 transition-opacity group-hover:opacity-20"
        style={{ backgroundColor: color }}
      />
      
      <div className="flex justify-between items-start relative z-10">
        <div 
          className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-xl shadow-black/20" 
          style={{ backgroundColor: `${color}15`, color: color, border: `1px solid ${color}30` }}
        >
          <Icon className="w-6 h-6 drop-shadow-sm" />
        </div>
        {trend && (
          <div 
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              trend.isUp ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
            } border border-current opacity-80 shadow-sm`}
          >
            {trend.isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>
      
      <div className="relative z-10">
        <p className="text-muted text-[10px] font-black tracking-[0.2em] uppercase opacity-60 mb-2">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-black text-white italic tracking-tighter">{value}</h3>
        </div>
        {subtitle && <p className="text-muted text-[10px] mt-2 font-bold tracking-tight italic opacity-40">{subtitle}</p>}
      </div>
      
      <div className="h-1 w-full bg-white/[0.03] rounded-full overflow-hidden relative z-10">
        <div 
          className="h-full rounded-full transition-all duration-[2000ms] ease-out shadow-[0_0_10px_currentColor]" 
          style={{ width: "65%", backgroundColor: color, color: color }}
        ></div>
      </div>
    </div>
  );
}
