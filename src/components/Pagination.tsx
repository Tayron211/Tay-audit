import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ChevronDown,
  Check
} from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemName?: string;
  pageSizeOptions?: number[];
  onPageSizeChange?: (newSize: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemName = 'elementos',
  pageSizeOptions = [8, 15, 30, 50],
  onPageSizeChange
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  const pageSizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPageSizeOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (pageSizeRef.current && !pageSizeRef.current.contains(e.target as Node)) {
        setIsPageSizeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isPageSizeOpen]);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate numbered pages with smart truncation
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    const showEllipsisStart = safeCurrentPage > 3;
    const showEllipsisEnd = safeCurrentPage < totalPages - 2;

    if (!showEllipsisStart && showEllipsisEnd) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (showEllipsisStart && !showEllipsisEnd) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages);
    }

    return pages;
  };

  const handlePageSelect = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== safeCurrentPage) {
      onPageChange(page);
    }
  };

  if (totalItems === 0) return null;

  return (
    <div 
      className="tay-pagination-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        margin: '18px 0 10px',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Resumen Informativo de Resultados */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.74rem',
          color: 'var(--text-secondary)',
          padding: '0 4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary)',
            boxShadow: '0 0 6px var(--accent-glow)'
          }} />
          <span>
            Mostrando <strong>{startItem} - {endItem}</strong> de <strong>{totalItems}</strong> {itemName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
            Pág. <strong style={{ color: 'var(--accent-primary)' }}>{safeCurrentPage}</strong> de {totalPages}
          </span>

          {onPageSizeChange && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} ref={pageSizeRef}>
              <span style={{ fontSize: '0.70rem', fontWeight: 600, color: 'var(--text-muted)' }}>Ver:</span>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setIsPageSizeOpen(prev => !prev)}
                  className="btn-flat"
                  style={{
                    height: '28px',
                    minWidth: '54px',
                    padding: '0 8px 0 10px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    fontFamily: "'JetBrains Mono', monospace",
                    borderRadius: '8px',
                    background: 'var(--bg-acrylic-card)',
                    color: 'var(--text-primary)',
                    border: isPageSizeOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-acrylic)',
                    boxShadow: isPageSizeOpen ? '0 0 0 2px var(--accent-glow)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '5px',
                    cursor: 'pointer'
                  }}
                  title="Cantidad de elementos por página"
                  aria-haspopup="listbox"
                  aria-expanded={isPageSizeOpen}
                >
                  <span>{pageSize}</span>
                  <ChevronDown
                    size={13}
                    style={{
                      color: isPageSizeOpen ? 'var(--accent-primary)' : 'var(--text-muted)',
                      transform: isPageSizeOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  />
                </button>

                {isPageSizeOpen && (
                  <div
                    role="listbox"
                    className="acrylic-select-popover"
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 6px)',
                      top: 'auto',
                      right: 0,
                      left: 'auto',
                      minWidth: '76px',
                      padding: '4px',
                      borderRadius: '11px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      zIndex: 10050
                    }}
                  >
                    {pageSizeOptions.map((opt) => {
                      const isSelected = opt === pageSize;
                      return (
                        <button
                          key={opt}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onPageSizeChange(opt);
                            setIsPageSizeOpen(false);
                          }}
                          className={`acrylic-select-option ${isSelected ? 'is-selected' : ''}`}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '7px',
                            fontSize: '0.75rem',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: isSelected ? 800 : 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px'
                          }}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check size={12} strokeWidth={2.8} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controles de Navegación Multipágina Numerada */}
      {totalPages > 1 && (
        <div
          className="tay-pagination-controls"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            flexWrap: 'wrap',
            padding: '6px 10px',
            borderRadius: '12px',
            background: 'var(--bg-acrylic-card)',
            border: '1px solid var(--border-acrylic)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          {/* Botón Primera Página */}
          <button
            type="button"
            onClick={() => handlePageSelect(1)}
            disabled={safeCurrentPage === 1}
            title="Primera página"
            className="pagination-nav-btn"
            style={{
              opacity: safeCurrentPage === 1 ? 0.35 : 1,
              pointerEvents: safeCurrentPage === 1 ? 'none' : 'auto'
            }}
          >
            <ChevronsLeft size={16} />
          </button>

          {/* Botón Anterior */}
          <button
            type="button"
            onClick={() => handlePageSelect(safeCurrentPage - 1)}
            disabled={safeCurrentPage === 1}
            title="Página anterior"
            className="pagination-nav-btn"
            style={{
              opacity: safeCurrentPage === 1 ? 0.35 : 1,
              pointerEvents: safeCurrentPage === 1 ? 'none' : 'auto'
            }}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Botones Numerados */}
          {getPageNumbers().map((num, idx) => {
            if (typeof num === 'string') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '0 4px',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    userSelect: 'none'
                  }}
                >
                  •••
                </span>
              );
            }

            const isActive = num === safeCurrentPage;
            return (
              <button
                key={`page-${num}`}
                type="button"
                onClick={() => handlePageSelect(num)}
                className={`pagination-num-btn ${isActive ? 'is-active' : ''}`}
                style={{
                  minWidth: '34px',
                  height: '34px',
                  padding: '0 6px',
                  borderRadius: '8px',
                  border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  background: isActive ? 'var(--accent-primary)' : 'transparent',
                  color: isActive ? 'var(--accent-contrast, #000000)' : 'var(--text-primary)',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 8px var(--accent-glow)' : 'none'
                }}
              >
                {num}
              </button>
            );
          })}

          {/* Botón Siguiente */}
          <button
            type="button"
            onClick={() => handlePageSelect(safeCurrentPage + 1)}
            disabled={safeCurrentPage === totalPages}
            title="Página siguiente"
            className="pagination-nav-btn"
            style={{
              opacity: safeCurrentPage === totalPages ? 0.35 : 1,
              pointerEvents: safeCurrentPage === totalPages ? 'none' : 'auto'
            }}
          >
            <ChevronRight size={16} />
          </button>

          {/* Botón Última Página */}
          <button
            type="button"
            onClick={() => handlePageSelect(totalPages)}
            disabled={safeCurrentPage === totalPages}
            title="Última página"
            className="pagination-nav-btn"
            style={{
              opacity: safeCurrentPage === totalPages ? 0.35 : 1,
              pointerEvents: safeCurrentPage === totalPages ? 'none' : 'auto'
            }}
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;

