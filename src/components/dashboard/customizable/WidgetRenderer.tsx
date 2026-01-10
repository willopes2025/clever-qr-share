import { WidgetConfig, AvailableWidget } from "@/hooks/useDashboardConfig";
import { KPIWidget } from "./widgets/KPIWidget";
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

  return (
    <div className={getSizeClass()}>
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
    </div>
  );
};
