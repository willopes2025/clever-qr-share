import { WidgetConfig, AvailableWidget } from "@/hooks/useDashboardConfig";
import { WidgetRenderer } from "./WidgetRenderer";

interface DashboardWidgetGridProps {
  widgets: WidgetConfig[];
  availableWidgets: AvailableWidget[];
  onRemoveWidget: (widgetId: string) => void;
  onResizeWidget: (widgetId: string, size: 'small' | 'medium' | 'large') => void;
}

export const DashboardWidgetGrid = ({
  widgets,
  availableWidgets,
  onRemoveWidget,
  onResizeWidget
}: DashboardWidgetGridProps) => {
  // Sort widgets by position
  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position);

  const getWidgetMeta = (widgetKey: string) => {
    return availableWidgets.find(w => w.widget_key === widgetKey);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sortedWidgets.map(widgetConfig => (
        <WidgetRenderer
          key={widgetConfig.id}
          widgetConfig={widgetConfig}
          widgetMeta={getWidgetMeta(widgetConfig.widget_key)}
          onRemove={() => onRemoveWidget(widgetConfig.id)}
          onResize={(size) => onResizeWidget(widgetConfig.id, size)}
        />
      ))}
    </div>
  );
};
