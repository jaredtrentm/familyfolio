'use client';

import { X, Plus } from 'lucide-react';
import { WIDGET_DEFINITIONS, type WidgetDefinition } from './WidgetRegistry';
import { motion, AnimatePresence } from 'framer-motion';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widgetId: string) => void;
  existingWidgets: string[];
  locale: string;
}

export function AddWidgetModal({
  isOpen,
  onClose,
  onAddWidget,
  existingWidgets,
  locale,
}: AddWidgetModalProps) {
  const availableWidgets = WIDGET_DEFINITIONS.filter(
    w => !existingWidgets.includes(w.id)
  );

  const t = (key: string) => {
    const texts: Record<string, Record<string, string>> = {
      title: { en: 'Add Widget', zh: '添加小组件' },
      noWidgets: { en: 'All widgets are already added', zh: '所有小组件已添加' },
      close: { en: 'Close', zh: '关闭' },
    };
    return texts[key]?.[locale] || texts[key]?.en || key;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('title')}
              </h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              {availableWidgets.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {t('noWidgets')}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {availableWidgets.map((widget) => (
                    <WidgetCard
                      key={widget.id}
                      widget={widget}
                      locale={locale}
                      onAdd={() => onAddWidget(widget.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t('close')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WidgetCard({
  widget,
  locale,
  onAdd,
}: {
  widget: WidgetDefinition;
  locale: string;
  onAdd: () => void;
}) {
  const Icon = widget.icon;
  const name = locale === 'zh' ? widget.nameZh : widget.name;

  return (
    <button
      onClick={onAdd}
      className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left group"
    >
      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30">
        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {widget.defaultSize.w}x{widget.defaultSize.h}
        </p>
      </div>
      <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
    </button>
  );
}
