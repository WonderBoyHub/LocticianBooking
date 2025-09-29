import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { clsx } from 'clsx';

interface BaseChartProps {
  data: any[];
  className?: string;
  height?: number;
  width?: string;
  colors?: string[];
  loading?: boolean;
  error?: string;
  title?: string;
  description?: string;
  showTooltip?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
}

interface LineChartProps extends BaseChartProps {
  type: 'line';
  xDataKey: string;
  lines: {
    dataKey: string;
    stroke?: string;
    strokeWidth?: number;
    dot?: boolean;
    name?: string;
  }[];
}

interface AreaChartProps extends BaseChartProps {
  type: 'area';
  xDataKey: string;
  areas: {
    dataKey: string;
    stackId?: string;
    fill?: string;
    stroke?: string;
    name?: string;
  }[];
}

interface BarChartProps extends BaseChartProps {
  type: 'bar';
  xDataKey: string;
  bars: {
    dataKey: string;
    fill?: string;
    stackId?: string;
    name?: string;
  }[];
}

interface PieChartProps extends BaseChartProps {
  type: 'pie';
  dataKey: string;
  nameKey: string;
  innerRadius?: number;
  outerRadius?: number;
  showLabels?: boolean;
}

export type ChartProps = LineChartProps | AreaChartProps | BarChartProps | PieChartProps;

const DEFAULT_COLORS = [
  '#8B6B47', // brand-primary
  '#D2B48C', // brand-secondary
  '#6B4E32', // brand-dark
  '#F5F5DC', // brand-accent
  '#C19A6B',
  '#E8D5B7',
  '#5D4037',
  '#4E342E',
];

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
  </div>
);

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center justify-center h-64 text-gray-500">
    <div className="text-center">
      <p className="text-sm">{message}</p>
    </div>
  </div>
);

const CustomTooltip: React.FC<any> = ({
  active,
  payload,
  label,
  colors = DEFAULT_COLORS,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center text-sm">
            <div
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: entry.color || colors[index % colors.length] }}
            />
            <span className="text-gray-600 mr-2">{entry.name}:</span>
            <span className="font-medium text-gray-900">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const Chart: React.FC<ChartProps> = ({
  data,
  className,
  height = 300,
  width = '100%',
  colors = DEFAULT_COLORS,
  loading = false,
  error,
  title,
  description,
  showTooltip = true,
  showLegend = true,
  showGrid = true,
  ...props
}) => {
  const containerClass = clsx(
    'bg-white rounded-lg border border-gray-200 p-4',
    className
  );

  if (loading) {
    return (
      <div className={containerClass}>
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>}
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClass}>
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>}
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={containerClass}>
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>}
        <ErrorMessage message="No data available" />
      </div>
    );
  }

  const renderChart = () => {
    switch (props.type) {
      case 'line':
        return (
          <ResponsiveContainer width={width} height={height}>
            <LineChart data={data}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis
                dataKey={props.xDataKey}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              {showTooltip && <Tooltip content={<CustomTooltip colors={colors} />} />}
              {showLegend && <Legend />}
              {props.lines.map((line, index) => (
                <Line
                  key={line.dataKey}
                  dataKey={line.dataKey}
                  stroke={line.stroke || colors[index % colors.length]}
                  strokeWidth={line.strokeWidth || 2}
                  dot={line.dot !== false}
                  name={line.name || line.dataKey}
                  activeDot={{ r: 4, fill: line.stroke || colors[index % colors.length] }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width={width} height={height}>
            <AreaChart data={data}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis
                dataKey={props.xDataKey}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              {showTooltip && <Tooltip content={<CustomTooltip colors={colors} />} />}
              {showLegend && <Legend />}
              {props.areas.map((area, index) => (
                <Area
                  key={area.dataKey}
                  dataKey={area.dataKey}
                  stackId={area.stackId}
                  fill={area.fill || colors[index % colors.length]}
                  stroke={area.stroke || colors[index % colors.length]}
                  name={area.name || area.dataKey}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width={width} height={height}>
            <BarChart data={data}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis
                dataKey={props.xDataKey}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              {showTooltip && <Tooltip content={<CustomTooltip colors={colors} />} />}
              {showLegend && <Legend />}
              {props.bars.map((bar, index) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  fill={bar.fill || colors[index % colors.length]}
                  stackId={bar.stackId}
                  name={bar.name || bar.dataKey}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const RADIAN = Math.PI / 180;
        const renderCustomizedLabel = ({
          cx, cy, midAngle, innerRadius, outerRadius, percent, index
        }: any) => {
          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
          const x = cx + radius * Math.cos(-midAngle * RADIAN);
          const y = cy + radius * Math.sin(-midAngle * RADIAN);

          return (
            <text
              x={x}
              y={y}
              fill="white"
              textAnchor={x > cx ? 'start' : 'end'}
              dominantBaseline="central"
              fontSize={12}
              fontWeight="medium"
            >
              {`${(percent * 100).toFixed(0)}%`}
            </text>
          );
        };

        return (
          <ResponsiveContainer width={width} height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={props.showLabels ? renderCustomizedLabel : false}
                outerRadius={props.outerRadius || 80}
                innerRadius={props.innerRadius || 0}
                fill="#8884d8"
                dataKey={props.dataKey}
                nameKey={props.nameKey}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              {showTooltip && <Tooltip content={<CustomTooltip colors={colors} />} />}
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <ErrorMessage message="Unknown chart type" />;
    }
  };

  return (
    <div className={containerClass}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>}
          {description && <p className="text-sm text-gray-600">{description}</p>}
        </div>
      )}
      {renderChart()}
    </div>
  );
};