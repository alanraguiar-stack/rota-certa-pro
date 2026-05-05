import { useEffect } from 'react';

const APP_NAME = 'Rota Certa';

/**
 * Define o document.title da página no formato "Título · Rota Certa".
 * Restaura para o nome do app ao desmontar o componente.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
