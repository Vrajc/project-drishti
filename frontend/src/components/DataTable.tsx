import React from 'react';
import { motion } from 'framer-motion';

interface Column {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  /** Hide this column on the mobile card view (e.g. redundant index columns) */
  hideOnMobile?: boolean;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  stickyHeader?: boolean;
  maxHeight?: string;
  hoverable?: boolean;
  /** Column key used as the card heading on mobile. Defaults to the first column. */
  primaryKey?: string;
}

// Static lookup: Tailwind scans source text, so an interpolated
// `text-${align}` class never makes it into the generated stylesheet.
const ALIGN_CLASS: Record<NonNullable<Column['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
};

const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  stickyHeader = true,
  maxHeight = '600px',
  hoverable = true,
  primaryKey
}) => {
  const headingKey = primaryKey ?? columns[0]?.key;

  if (data.length === 0) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-[#262626]">
        <div className="text-center py-12 px-4 text-[#737373] text-sm">
          No data available
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ---------- Mobile: stacked cards ----------
          A 6-column table can't be read on a 375px screen; each row becomes
          a labelled card instead so nothing needs horizontal scrubbing. */}
      <div className="md:hidden space-y-3">
        {data.map((row, rowIndex) => {
          const heading = headingKey ? row[headingKey] : null;
          const details = columns.filter(
            (column) => column.key !== headingKey && !column.hideOnMobile
          );

          return (
            <motion.div
              key={rowIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(rowIndex * 0.02, 0.3) }}
              className="rounded-xl border border-[#262626] bg-[#111111] p-4"
            >
              {heading != null && (
                <div className="text-sm font-semibold text-[#E5E5E5] mb-3 break-anywhere">
                  {heading}
                </div>
              )}
              <dl className="space-y-2">
                {details.map((column) => (
                  <div
                    key={column.key}
                    className="flex items-start justify-between gap-3"
                  >
                    <dt className="text-xs uppercase tracking-wider text-[#737373] shrink-0">
                      {column.label}
                    </dt>
                    <dd className="text-sm text-[#A3A3A3] text-right min-w-0 break-anywhere">
                      {row[column.key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          );
        })}
      </div>

      {/* ---------- Tablet and up: real table ---------- */}
      <div className="relative hidden md:block rounded-xl overflow-hidden border border-[#262626]">
        <div className="overflow-auto" style={{ maxHeight }}>
          <table className="w-full min-w-[40rem]">
            <thead className={`bg-[#0A0A0A] ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
              <tr className="border-b border-[#262626]">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 lg:px-6 py-4 text-xs lg:text-sm font-semibold text-[#E5E5E5] uppercase tracking-wider whitespace-nowrap ${
                      ALIGN_CLASS[column.align || 'left']
                    } ${column.width || ''}`}
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
                  transition={{ delay: Math.min(rowIndex * 0.02, 0.3) }}
                  className={`bg-[#111111] transition-all duration-200 ${
                    hoverable ? 'hover:bg-[#1A1A1A] hover:shadow-lg cursor-pointer' : ''
                  }`}
                  whileHover={
                    hoverable
                      ? {
                          backgroundColor: 'rgba(26, 26, 26, 1)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 lg:px-6 py-4 lg:py-5 text-sm text-[#A3A3A3] ${
                        ALIGN_CLASS[column.align || 'left']
                      }`}
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default DataTable;
