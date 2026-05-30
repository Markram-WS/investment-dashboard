import { useCallback } from 'react';
import { PortfolioData } from '../screens/types';

export const useMarkdownRenderer = () => {
  const renderRiskStatus = useCallback((status: string): string => {
    const statusColors: Record<string, string> = {
      Safe: 'bg-teal-100 text-teal-800',
      Warning: 'bg-yellow-100 text-yellow-800',
      Danger: 'bg-red-100 text-red-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  }, []);

  const renderMarkdown = useCallback((content: string): string => {
    return content
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*)`/gim, '<code>$1</code>')
      .replace(/\n$/gim, '<br />');
  }, []);

  const isGridType = useCallback((portfolio: PortfolioData | null): boolean => {
    if (!portfolio) return false;
    const type = portfolio.port_type?.toLowerCase() || '';
    return type.includes('grid') || type.includes('margin');
  }, []);

  return { renderMarkdown, renderRiskStatus, isGridType };
};