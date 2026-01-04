import React from 'react';
import { motion } from 'framer-motion';

interface Column {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  stickyHeader?: boolean;
  maxHeight?: string;
  hoverable?: boolean;
}

const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  stickyHeader = true,
  maxHeight = '600px',
  hoverable = true
}) => {
  return (
    <div className="relative rounded-xl overflow-hidden border border-[#262626]">
      <div 
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <table className="w-full">
          <thead 
            className={`
              bg-[#0A0A0A] 
              ${stickyHeader ? 'sticky top-0 z-10' : ''}
            `}
          >
            <tr className="border-b border-[#262626]">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-6 py-4
                    text-sm font-semibold text-[#E5E5E5] uppercase tracking-wider
                    text-${column.align || 'left'}
                    ${column.width || ''}
                  `}
                  style={{
                    backdropFilter: 'blur(12px)',
                    backgroundColor: 'rgba(10, 10, 10, 0.95)'
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1A1A]">
            {data.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: rowIndex * 0.02 }}
                className={`
                  bg-[#111111]
                  transition-all duration-200
                  ${hoverable ? 'hover:bg-[#1A1A1A] hover:shadow-lg cursor-pointer' : ''}
                `}
                style={{
                  boxShadow: hoverable ? undefined : 'none'
                }}
                whileHover={hoverable ? {
                  backgroundColor: 'rgba(26, 26, 26, 1)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                } : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`
                      px-6 py-5
                      text-sm text-[#A3A3A3]
                      text-${column.align || 'left'}
                    `}
                  >
                    {row[column.key]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
        
        {data.length === 0 && (
          <div className="text-center py-12 text-[#737373]">
            No data available
          </div>
        )}
      </div>
    </div>
  );
};

export default DataTable;
