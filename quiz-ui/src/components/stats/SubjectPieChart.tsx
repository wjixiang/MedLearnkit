import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { PieChart, SunburstChart } from "echarts/charts";
import { TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { SubjectPracticeStats } from "@/lib/types";

echarts.use([
  PieChart,
  SunburstChart,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

const BASE_COLORS = [
  "#5470c6",
  "#91cc75",
  "#fac858",
  "#ee6666",
  "#73c0de",
  "#3ba272",
  "#fc8452",
  "#9a60b4",
];

interface SubjectPieChartProps {
  data: SubjectPracticeStats[];
}

export function SubjectPieChart({ data }: SubjectPieChartProps) {
  const option = useMemo(() => {
    if (data.length === 0) {
      return { title: { text: "暂无数据", left: "center", top: "middle" } };
    }

    // Build sunburst data: inner = class, outer = type
    const sunburstData = data.map((subject, idx) => {
      const baseColor = BASE_COLORS[idx % BASE_COLORS.length];
      const children = subject.by_type.map((type, ti) => ({
        name: type.quiz_type,
        value: type.count,
        itemStyle: {
          color: adjustColorBrightness(baseColor, 0.5 + ti * 0.2),
        },
      }));

      return {
        name: subject.quiz_class,
        value: subject.total_count,
        children,
        itemStyle: { color: baseColor },
        accuracy: subject.accuracy,
      };
    });

    return {
      tooltip: {
        formatter: (params: {
          name: string;
          value: number;
          data: { accuracy?: number };
          treePathInfo: { name: string }[];
        }) => {
          const path = params.treePathInfo;
          if (path.length === 2) {
            // Inner ring (class level)
            return `${params.name}<br/>题数: <b>${params.value}</b><br/>正确率: <b>${params.data.accuracy?.toFixed(1)}%</b>`;
          }
          // Outer ring (type level)
          const parentName = path[1]?.name ?? "";
          return `${parentName} > ${params.name}<br/>题数: <b>${params.value}</b>`;
        },
      },
      series: [
        {
          type: "sunburst",
          data: sunburstData,
          radius: ["15%", "90%"],
          sort: null,
          emphasis: { focus: "ancestor" },
          levels: [
            {},
            {
              // Inner ring: class
              r0: "15%",
              r: "55%",
              label: {
                fontSize: 11,
                formatter: (params: {
                  name: string;
                  data: { accuracy?: number };
                }) => {
                  const acc = params.data.accuracy?.toFixed(0) ?? "0";
                  return `${params.name}\n${acc}%`;
                },
              },
              itemStyle: { borderWidth: 2, borderColor: "rgba(255,255,255,0.8)" },
            },
            {
              // Outer ring: type
              r0: "55%",
              r: "90%",
              label: {
                fontSize: 10,
                formatter: (params: { name: string; value: number }) =>
                  `${params.name}`,
              },
              itemStyle: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
            },
          ],
        },
      ],
    };
  }, [data]);

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">科目练习分布</h3>
      <ReactECharts
        echarts={echarts}
        option={option}
        style={{ height: 350 }}
        notMerge
      />
    </div>
  );
}

function adjustColorBrightness(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(Math.min(255, r * factor));
  const ng = Math.round(Math.min(255, g * factor));
  const nb = Math.round(Math.min(255, b * factor));
  return `rgb(${nr},${ng},${nb})`;
}
