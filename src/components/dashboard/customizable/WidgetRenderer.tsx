import { WidgetConfig, AvailableWidget } from "@/hooks/useDashboardConfig";
import { KPIWidget } from "./widgets/KPIWidget";
import { AreaChartWidget } from "./widgets/AreaChartWidget";
import { BarChartWidget } from "./widgets/BarChartWidget";
import { PieChartWidget } from "./widgets/PieChartWidget";
import { useWidgetData, DateRange } from "@/hooks/useWidgetData";

interface WidgetRendererProps {
  widgetConfig: WidgetConfig;
  widgetMeta: AvailableWidget | undefined;
  dateRange: DateRange;
  onRemove: () => void;
  onResize: (size: 'small' | 'medium' | 'large') => void;
}

export const WidgetRenderer = ({
  widgetConfig,
  widgetMeta,
  dateRange,
  onRemove,
  onResize
}: WidgetRendererProps) => {
  const { data, loading } = useWidgetData(widgetConfig.widget_key, dateRange);

  if (!widgetMeta) {
    return null;
  }

  const widgetType = widgetMeta.widget_type || 'kpi';

  // Get grid column span based on size
  const getSizeClass = () => {
    switch (widgetConfig.size) {
      case 'small':
        return 'col-span-1';
      case 'medium':
        return 'col-span-1 md:col-span-2';
      case 'large':
        return 'col-span-1 md:col-span-2 lg:col-span-3';
      default:
        return 'col-span-1';
    }
  };

  const renderWidget = () => {
    switch (widgetType) {
      case 'area_chart':
        return (
          <AreaChartWidget
            widgetKey={widgetConfig.widget_key}
            name={widgetMeta.name}
            description={widgetMeta.description || undefined}
            size={widgetConfig.size}
            sizeOptions={widgetMeta.size_options}
            dateRange={dateRange}
            onRemove={onRemove}
            onResize={onResize}
          />
        );
      case 'bar_chart':
        return (
          <BarChartWidget
            widgetKey={widgetConfig.widget_key}
            name={widgetMeta.name}
            description={widgetMeta.description || undefined}
            size={widgetConfig.size}
            sizeOptions={widgetMeta.size_options}
            dateRange={dateRange}
            onRemove={onRemove}
            onResize={onResize}
          />
        );
      case 'pie_chart':
        return (
          <PieChartWidget
            widgetKey={widgetConfig.widget_key}
            name={widgetMeta.name}
            description={widgetMeta.description || undefined}
            size={widgetConfig.size}
            sizeOptions={widgetMeta.size_options}
            dateRange={dateRange}
            onRemove={onRemove}
            onResize={onResize}
          />
        );
      case 'kpi':
      default:
        return (
          <KPIWidget
            widgetKey={widgetConfig.widget_key}
            name={widgetMeta.name}
            description={widgetMeta.description}
            icon={widgetMeta.icon}
            size={widgetConfig.size}
            sizeOptions={widgetMeta.size_options}
            data={data}
            loading={loading}
            onRemove={onRemove}
            onResize={onResize}
          />
        );
    }
  };

  return (
    <div className={getSizeClass()} key={`${widgetConfig.id}-${dateRange.start.getTime()}-${dateRange.end.getTime()}`}>
      {renderWidget()}
    </div>
  );
};
