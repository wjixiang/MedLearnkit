import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { DailyPracticeStats } from "@/lib/types";

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const SUBJECT_COLORS = [
  "#5470c6",
  "#91cc75",
  "#fac858",
  "#ee6666",
  "#73c0de",
  "#3ba272",
  "#fc8452",
  "#9a60b4",
  "#ea7ccc",
  "#48b8d0",
];

interface DailyPracticeChartProps {
  data: DailyPracticeStats[];
  selectedClass?: string;
}

export function DailyPracticeChart({
  data,
  selectedClass,
}: DailyPracticeChartProps) {
  const option = useMemo(() => {
    if (data.length === 0) {
      return { title: { text: "暂无数据", left: "center", top: "middle" } };
    }

    // Collect all class names
    const allClasses = Array.from(
      new Set(data.flatMap((d) => d.by_class.map((c) => c.quiz_class))),
    );

    const classes = selectedClass
      ? allClasses.filter((c) => c === selectedClass)
      : allClasses;

    const dates = data.map((d) => {
      const parts = d.date.split("-");
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    });

    // Build bar series per class
    const barSeries = classes.map((cls, i) => ({
      name: cls,
      type: "bar" as const,
      stack: "total",
      emphasis: { focus: "series" as const },
      itemStyle: {
        color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
        borderRadius: [0, 0, 0, 0],
      },
      data: data.map((d) => {
        const breakdown = d.by_class.find((c) => c.quiz_class === cls);
        return breakdown ? breakdown.count : 0;
      }),
    }));

    // Round corners on the topmost visible series
    if (barSeries.length > 0) {
      barSeries[barSeries.length - 1].itemStyle.borderRadius = [4, 4, 0, 0];
    }

    // Accuracy line
    const lineSeries = {
      name: "正确率",
      type: "line" as const,
      yAxisIndex: 1,
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      lineStyle: { width: 2, color: "#ee6666" },
      itemStyle: { color: "#ee6666" },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(238,102,102,0.15)" },
          { offset: 1, color: "rgba(238,102,102,0)" },
        ]),
      },
      data: data.map((d) => d.accuracy),
    };

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params: unknown[]) => {
          const items = params as {
            seriesName: string;
            value: number;
            marker: string;
            axisValue?: string;
          }[];
          if (!items.length) return "";
          let html = `<div style="font-weight:600;margin-bottom:4px">${items[0].axisValue ?? ""}</div>`;
          let total = 0;
          for (const item of items) {
            if (item.seriesName === "正确率") {
              html += `<div>${item.marker} ${item.seriesName}: <b>${item.value.toFixed(1)}%</b></div>`;
            } else {
              total += item.value;
              html += `<div>${item.marker} ${item.seriesName}: <b>${item.value}</b></div>`;
            }
          }
          if (barSeries.length > 1) {
            html += `<div style="border-top:1px solid #eee;margin-top:4px;padding-top:4px">合计: <b>${total}</b></div>`;
          }
          return html;
        },
      },
      legend: {
        bottom: 30,
        type: "scroll",
      },
      grid: {
        top: 10,
        right: 60,
        bottom: 80,
        left: 50,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: {
          fontSize: 11,
          interval: Math.max(Math.floor(data.length / 10), 0),
        },
      },
      yAxis: [
        {
          type: "value",
          name: "题数",
          minInterval: 1,
          axisLabel: { fontSize: 11 },
        },
        {
          type: "value",
          name: "正确率%",
          min: 0,
          max: 100,
          axisLabel: { fontSize: 11, formatter: "{value}%" },
          splitLine: { show: false },
        },
      ],
      dataZoom:
        data.length > 30
          ? [
              {
                type: "slider",
                bottom: 5,
                height: 20,
                borderColor: "transparent",
                backgroundColor: "rgba(0,0,0,0.04)",
                fillerColor: "rgba(0,0,0,0.08)",
              },
            ]
          : [],
      series: [...barSeries, lineSeries],
    };
  }, [data, selectedClass]);

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">每日练习统计</h3>
      <ReactECharts
        echarts={echarts}
        option={option}
        style={{ height: 320 }}
        notMerge
      />
    </div>
  );
}
