"use client";

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function PieChart({ data, height = 300 }: PieChartProps) {
  // Gesamtsumme für Prozentberechnung
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Daten mit Prozentangaben anreichern
  const dataWithPercent = data.map((item) => ({
    ...item,
    percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0",
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={dataWithPercent}
          cx="50%"
          cy="40%"
          innerRadius="35%"
          outerRadius="55%"
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {dataWithPercent.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length > 0) {
              const data = payload[0].payload as { name: string; value: number; percent: string };
              return (
                <div
                  style={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#f1f5f9",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 500 }}>{data.name}</p>
                  <p style={{ margin: "4px 0 0 0", color: "#ffffff" }}>
                    {data.value.toLocaleString("de-DE")} ({data.percent}%)
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend
          formatter={(value, entry) => {
            const payload = entry.payload as { percent?: string; value?: number } | undefined;
            const percent = payload?.percent || "0";
            const val = payload?.value || 0;
            return (
              <span style={{ color: "#f1f5f9" }}>
                {value}: {val.toLocaleString("de-DE")} ({percent}%)
              </span>
            );
          }}
          layout="horizontal"
          align="center"
          verticalAlign="bottom"
        />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

