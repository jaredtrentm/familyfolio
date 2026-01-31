'use client';

import CountUp from 'react-countup';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  locale?: string;
}

export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  duration = 1.5,
  className = '',
  locale = 'en-US',
}: AnimatedNumberProps) {
  const formatNumber = (num: number): string => {
    return num.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <span className={className}>
      <CountUp
        end={value}
        duration={duration}
        decimals={decimals}
        prefix={prefix}
        suffix={suffix}
        separator=","
        formattingFn={(num) => `${prefix}${formatNumber(num)}${suffix}`}
        preserveValue
      />
    </span>
  );
}
