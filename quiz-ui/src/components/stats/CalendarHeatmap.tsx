import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { HeatmapChart } from "echarts/charts";
import {
  CalendarComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { CalendarDayData } from "@/lib/types";

echarts.use([
  HeatmapChart,
  CalendarComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

interface CalendarHeatmapProps {
  data: CalendarDayData[];
  year: number;
}

export function CalendarHeatmap({ data, year }: CalendarHeatmapProps) {
  const maxValue = useMemo(
    () => Math.max(...data.map((d) => d.count), 1),
    [data],
  );

  const option = useMemo(() => {
    const heatmapData = data.map((d) => [d.date, d.count]);

    return {
      tooltip: {
        formatter: (params: { value: unknown[]; dataIndex: number }) => {
          const [date, count] = params.value as [string, number];
          const day = data.find((d) => d.date === date);
          return `${date}<br/>练习: <b>${count}</b> 题<br/>正确: <b>${day?.correct_count ?? 0}</b> 题`;
        },
      },
      visualMap: {
        min: 0,
        max: maxValue,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        inRange: {
          color: ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"],
        },
        textStyle: { fontSize: 11 },
      },
      calendar: {
        top: 30,
        left: 40,
        right: 30,
        bottom: 50,
        cellSize: ["auto", 16],
        range: year,
        itemStyle: {
          borderWidth: 3,
          borderColor: "transparent",
        },
        yearLabel: { show: false },
        dayLabel: {
          firstDay: 1,
          fontSize: 11,
          nameMap: ["日", "一", "二", "三", "四", "五", "六"],
        },
        monthLabel: {
          fontSize: 11,
          nameMap: "cn",
        },
      },
      series: [
        {
          type: "heatmap",
          coordinateSystem: "calendar",
          data: heatmapData,
        },
      ],
    };
  }, [data, year, maxValue]);

  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <h3 className="mb-3 text-sm font-semibold">
        {year} 年练习日历
      </h3>
      <ReactECharts
        echarts={echarts}
        option={option}
        style={{ height: 180 }}
        notMerge
      />
    </div>
  );
}
